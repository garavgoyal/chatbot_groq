import asyncio
import json

from fastapi import APIRouter, Depends
from fastapi.responses import StreamingResponse

from .. import store
from ..clients import client
from ..config import SUPABASE_ENABLED
from ..deps import require_auth
from ..prompts import build_context
from ..schemas import ChatRequest, SummarizeRequest
from ..text_utils import retrieve_relevant
from ..weather import WEATHER_TOOLS, get_weather

router = APIRouter(prefix="/api", tags=["chat"])


@router.post("/chat")
def chat(req: ChatRequest, user=Depends(require_auth)):
    if SUPABASE_ENABLED:
        store.get_owned_conversation(req.conversation_id, user.id)

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
    check = client.chat.completions.create(
        messages=messages,
        model="llama-3.3-70b-versatile",
        tools=WEATHER_TOOLS,
    )
    check_reply = check.choices[0].message

    # STEP 2: If a tool call was requested, run it and fold the real result into messages
    if check_reply.tool_calls:
        tool_call = check_reply.tool_calls[0]
        args = json.loads(tool_call.function.arguments)

        result = asyncio.run(get_weather(args["city"]))

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

    # STEP 3: Stream the final answer (unchanged from before — just uses updated messages)
    def token_stream():
        full_reply = ""
        stream = client.chat.completions.create(
            messages=messages,
            model="openai/gpt-oss-120b",
            stream=True,
            max_completion_tokens=800,
        )
        for chunk in stream:
            token = chunk.choices[0].delta.content
            if token:
                full_reply += token
                yield token

        # This code runs only AFTER the loop above finishes — i.e. once
        # the model has finished streaming its whole answer — so we save
        # the complete exchange to the database exactly once.
        if req.messages:
            store.save_message(req.conversation_id, "user", req.messages[-1].content)
            store.maybe_set_title(req.conversation_id, req.messages[-1].content)
        store.save_message(req.conversation_id, "assistant", full_reply)

    return StreamingResponse(token_stream(), media_type="text/plain")


@router.post("/summarize")
def summarize(req: SummarizeRequest, user=Depends(require_auth)):
    convo_text = "\n".join(f"{m.role}: {m.content}" for m in req.messages)

    prompt = (
        "Summarize the key facts, decisions, and context from this conversation "
        "in 3-4 sentences. Be concise, factual, no filler.\n\n"
    )
    if req.previous_summary:
        prompt += f"Previous summary: {req.previous_summary}\n\n"
    prompt += f"New messages to fold in:\n{convo_text}"

    completion = client.chat.completions.create(
        messages=[{"role": "user", "content": prompt}],
        model="openai/gpt-oss-20b",
        max_completion_tokens=150,
    )
    return {"summary": completion.choices[0].message.content}
