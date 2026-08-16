"""The actual logic behind /api/chat and /api/summarize — building the
message context, the optional weather tool-call round trip, and the
streamed reply itself."""
import asyncio
import json

from fastapi import HTTPException
from fastapi.responses import StreamingResponse

from clients import groq_client
from config import (
    SYSTEM_PROMPT, WEATHER_TOOLS, RECENT_MESSAGE_LIMIT, TOKEN_USAGE_MARKER,
    WEATHER_KEYWORDS, SUPABASE_ENABLED,
)
from controllers.title_controller import maybe_set_title
from dependencies import get_owned_conversation
from models.schemas import ChatRequest, SummarizeRequest
from storage import retrieve_relevant, save_message
from weather import get_weather


def build_context(req: ChatRequest):
    """System prompt + summary of old messages + most recent messages."""
    context = [SYSTEM_PROMPT]

    if req.summary:
        context.append({
            "role": "system",
            "content": f"Summary of earlier conversation: {req.summary}",
        })

    recent = req.messages[-RECENT_MESSAGE_LIMIT:]
    context += [m.model_dump() for m in recent]
    return context


def mentions_weather(text: str) -> bool:
    """Cheap pre-filter so we only pay for the extra tool-check Groq call
    (STEP 1 below) when the message plausibly needs it, instead of on
    every single turn."""
    lowered = text.lower()
    return any(keyword in lowered for keyword in WEATHER_KEYWORDS)


def handle_chat(req: ChatRequest, user):
    if SUPABASE_ENABLED:
        get_owned_conversation(req.conversation_id, user.id)

    messages = build_context(req)

    # If we have uploaded documents, inject relevant chunks based on the latest question
    if req.messages:
        last_user_msg = req.messages[-1].content
        relevant_chunks = retrieve_relevant(last_user_msg, user.id)
        if relevant_chunks:
            messages.insert(1, {
                "role": "system",
                "content": "Relevant document context:\n" + "\n---\n".join(relevant_chunks),
            })

    # STEP 1: Quick, non-streaming check — does this message need the weather tool?
    # Only bother with the extra Groq round-trip when the message plausibly
    # needs it — this call used to run on every single turn.
    if req.messages and mentions_weather(req.messages[-1].content):
        # Without this the model happily answers weather questions from
        # nothing when the tool call doesn't happen (or comes back empty),
        # inventing a temperature that reads exactly like a real one.
        messages.append({
            "role": "system",
            "content": (
                "Only state current weather conditions that appear in a get_weather "
                "tool result. Never estimate or invent them. If no weather data is "
                "available, say so and ask which city the user means."
            ),
        })

        try:
            check = groq_client.chat.completions.create(
                messages=messages,
                model="llama-3.3-70b-versatile",
                tools=WEATHER_TOOLS,
            )
            check_reply = check.choices[0].message
        except Exception:
            check_reply = None

        # STEP 2: If a tool call was requested, run it and fold the real result into messages
        if check_reply and check_reply.tool_calls:
            tool_call = check_reply.tool_calls[0]
            args = json.loads(tool_call.function.arguments)

            # `city` is no longer required — an unlocated question ("what's it
            # like outside?") now arrives as use_current_location instead of a
            # guessed city, so read both and let weather.py sort out the rest.
            result = asyncio.run(get_weather(
                city=args.get("city"),
                use_current_location=bool(args.get("use_current_location")),
                user_location=req.location,
            ))

            messages.append({
                "role": "assistant",
                "content": check_reply.content,
                "tool_calls": [
                    {
                        "id": tool_call.id,
                        "type": "function",
                        "function": {
                            "name": tool_call.function.name,
                            "arguments": tool_call.function.arguments
                        }
                    }
                ]
            })
            messages.append({
                "role": "tool",
                "tool_call_id": tool_call.id,
                "content": json.dumps(result)
            })
            # messages now include the real weather data, ready for the final streamed answer below

    # STEP 3: Stream the final answer
    def token_stream():
        full_reply = ""
        total_tokens = None
        try:
            stream = groq_client.chat.completions.create(
                messages=messages,
                model="openai/gpt-oss-120b",
                stream=True,
                max_completion_tokens=800,
                # Asks Groq to send one extra chunk at the end carrying token
                # counts for this exchange. That chunk has an empty `choices`
                # list (hence the `if chunk.choices` guard below).
                extra_body={"stream_options": {"include_usage": True}},
            )
            for chunk in stream:
                if chunk.choices:
                    token = chunk.choices[0].delta.content
                    if token:
                        full_reply += token
                        yield token
                if chunk.usage:
                    total_tokens = chunk.usage.total_tokens
        except Exception:
            # Headers are already sent once streaming starts, so we can't turn
            # this into a proper HTTP error — surface it in the stream instead,
            # and skip saving so a broken/partial reply isn't stored as real history.
            yield "\n\n⚠️ Sorry, something went wrong generating a response. Please try again."
            return

        # Out-of-band marker appended after the real reply so the frontend can
        # show "this reply used N tokens" — stripped out before display there.
        if total_tokens is not None:
            yield TOKEN_USAGE_MARKER.format(tokens=total_tokens)

        # This code runs only AFTER the loop above finishes — i.e. once
        # the model has finished streaming its whole answer — so we save
        # the complete exchange to the database exactly once.
        if req.messages:
            save_message(req.conversation_id, "user", req.messages[-1].content)
        save_message(req.conversation_id, "assistant", full_reply)

        # Named last so the heading can be drawn from the whole exchange, not
        # just the opening question. The frontend refreshes the sidebar once
        # the stream closes, so the real title is there by the time it lists.
        if req.messages:
            maybe_set_title(req.conversation_id, req.messages[-1].content, full_reply)

    return StreamingResponse(token_stream(), media_type="text/plain")


def handle_summarize(req: SummarizeRequest):
    convo_text = "\n".join(f"{m.role}: {m.content}" for m in req.messages)

    prompt = (
        "Summarize the key facts, decisions, and context from this conversation "
        "in 3-4 sentences. Be concise, factual, no filler.\n\n"
    )
    if req.previous_summary:
        prompt += f"Previous summary: {req.previous_summary}\n\n"
    prompt += f"New messages to fold in:\n{convo_text}"

    try:
        completion = groq_client.chat.completions.create(
            messages=[{"role": "user", "content": prompt}],
            model="openai/gpt-oss-20b",
            max_completion_tokens=150,
        )
    except Exception:
        raise HTTPException(status_code=502, detail="Summarization service is unavailable right now")
    return {
        "summary": completion.choices[0].message.content,
        "tokens": completion.usage.total_tokens if completion.usage else None,
    }
