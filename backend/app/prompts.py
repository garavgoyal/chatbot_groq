from .schemas import ChatRequest

SYSTEM_PROMPT = {
    "role": "system",
    "content": (
        "You are a helpful, friendly assistant. "
        "Always follow the user's formatting instructions exactly — "
        "if they ask for a specific number of lines, words, sentences, or bullet points, "
        "obey that limit strictly even if it means leaving out detail you'd normally include. "
        "Do not add extra explanation, caveats, or padding beyond what was asked for."
    ),
}

RECENT_MESSAGE_LIMIT = 8   # how many latest chat messages to send in full


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
