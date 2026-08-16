"""Naming conversations for the sidebar.

The sidebar used to show the first 40 characters of the opening message,
which reads as a chopped-off sentence ("what is the difference between a
list and a tu") rather than a heading. This asks a small model for a short
topic label instead, and falls back to that old truncation whenever the
call fails, so a conversation always ends up with *some* name."""
import re

from clients import groq_client
from config import DEFAULT_TITLE, MAX_TITLE_LENGTH, TITLE_MODEL, TITLE_PROMPT

from storage import conversation_needs_title, set_conversation_title

EXCERPT_LIMIT = 600   # plenty of signal for a heading without paying for a whole essay


def _truncated(user_message: str) -> str:
    """The previous behaviour, kept as the fallback."""
    return user_message.strip()[:MAX_TITLE_LENGTH].strip() or DEFAULT_TITLE


def _clean(raw: str) -> str:
    """Models like to answer with `Title: "Foo Bar."` — keep just Foo Bar."""
    lines = [line for line in raw.strip().splitlines() if line.strip()]
    if not lines:
        return ""
    title = re.sub(r"^(title|heading|topic)\s*[:\-]\s*", "", lines[0], flags=re.IGNORECASE)
    title = " ".join(title.strip().strip("\"'“”*").rstrip(".!,;:").split())
    if len(title) <= MAX_TITLE_LENGTH:
        return title
    # Cut back to a word boundary — a heading ending mid-word is the exact
    # thing this whole module exists to avoid.
    return title[:MAX_TITLE_LENGTH].rsplit(" ", 1)[0].rstrip(",;:-")


def generate_title(user_message: str, assistant_reply: str) -> str:
    excerpt = f"User: {user_message.strip()[:EXCERPT_LIMIT]}"
    if assistant_reply.strip():
        excerpt += f"\nAssistant: {assistant_reply.strip()[:EXCERPT_LIMIT]}"

    completion = groq_client.chat.completions.create(
        model=TITLE_MODEL,
        messages=[
            {"role": "system", "content": TITLE_PROMPT},
            {"role": "user", "content": excerpt},
        ],
        max_completion_tokens=24,
        temperature=0.3,
    )
    return _clean(completion.choices[0].message.content or "")


def _pick_title(user_message: str, assistant_reply: str) -> str:
    try:
        return generate_title(user_message, assistant_reply) or _truncated(user_message)
    except Exception:
        return _truncated(user_message)


def maybe_set_title(conversation_id: str, user_message: str, assistant_reply: str = ""):
    """Name a conversation after what it's actually about, the first time it
    gets a real exchange. Never raises: by the time this runs the reply has
    already been streamed and saved, so a naming failure must not turn a
    successful exchange into an error."""
    try:
        if not conversation_needs_title(conversation_id):
            return
        set_conversation_title(conversation_id, _pick_title(user_message, assistant_reply))
    except Exception:
        pass
