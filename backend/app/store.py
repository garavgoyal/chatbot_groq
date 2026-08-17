import uuid
from datetime import datetime, timezone

from fastapi import HTTPException

from .clients import supabase
from .config import SUPABASE_ENABLED

# Fallback storage used ONLY when Supabase isn't configured yet.
# Works the same from the frontend's point of view, it just resets
# whenever the backend restarts (no real persistence).
_local_conversations = {}   # conversation_id -> {id, title, updated_at}
_local_messages = {}        # conversation_id -> [ {role, content, image_url} ]

doc_store = []  # in-memory document chunks: [{"text": ..., "embedding": ..., "user_id": ...}]


def create_conversation(title: str, user_id: str):
    if SUPABASE_ENABLED:
        result = supabase.table("conversations").insert({
            "title": title,
            "user_id": user_id,
        }).execute()
        return result.data[0]

    conv_id = str(uuid.uuid4())
    conv = {"id": conv_id, "title": title, "updated_at": datetime.now(timezone.utc).isoformat()}
    _local_conversations[conv_id] = conv
    _local_messages[conv_id] = []
    return conv


def list_conversations(user_id: str):
    if SUPABASE_ENABLED:
        result = (
            supabase.table("conversations")
            .select("id,title,updated_at")
            .eq("user_id", user_id)
            .order("updated_at", desc=True)
            .execute()
        )
        return result.data

    return sorted(_local_conversations.values(), key=lambda c: c["updated_at"], reverse=True)


def get_conversation_messages(conversation_id: str):
    if SUPABASE_ENABLED:
        result = (
            supabase.table("messages")
            .select("role,content,image_url")
            .eq("conversation_id", conversation_id)
            .order("created_at")
            .execute()
        )
        return result.data

    return _local_messages.get(conversation_id, [])


def delete_conversation(conversation_id: str):
    if SUPABASE_ENABLED:
        supabase.table("messages").delete().eq("conversation_id", conversation_id).execute()
        supabase.table("conversations").delete().eq("id", conversation_id).execute()
    else:
        _local_messages.pop(conversation_id, None)
        _local_conversations.pop(conversation_id, None)


def save_message(conversation_id: str, role: str, content: str, image_url: str = None):
    """Insert one message, and bump the conversation's updated_at
    so the sidebar can sort by most-recently-active conversation."""
    if SUPABASE_ENABLED:
        supabase.table("messages").insert({
            "conversation_id": conversation_id,
            "role": role,
            "content": content,
            "image_url": image_url,
        }).execute()
        supabase.table("conversations").update({
            "updated_at": datetime.now(timezone.utc).isoformat()
        }).eq("id", conversation_id).execute()
        return

    _local_messages.setdefault(conversation_id, []).append(
        {"role": role, "content": content, "image_url": image_url}
    )
    if conversation_id in _local_conversations:
        _local_conversations[conversation_id]["updated_at"] = datetime.now(timezone.utc).isoformat()


def maybe_set_title(conversation_id: str, first_message: str):
    """The first time a conversation gets a real message, rename it
    from 'New Chat' to a short preview of that message."""
    new_title = first_message.strip()[:40] or "New Chat"

    if SUPABASE_ENABLED:
        result = supabase.table("conversations").select("title").eq("id", conversation_id).single().execute()
        if result.data and result.data["title"] == "New Chat":
            supabase.table("conversations").update({"title": new_title}).eq("id", conversation_id).execute()
        return

    conv = _local_conversations.get(conversation_id)
    if conv and conv["title"] == "New Chat":
        conv["title"] = new_title


def get_owned_conversation(conversation_id: str, user_id: str):
    """Fetch a conversation only if it belongs to this user, else 404.
    Used to stop users reading/deleting/posting into each other's conversations."""
    result = (
        supabase.table("conversations")
        .select("id")
        .eq("id", conversation_id)
        .eq("user_id", user_id)
        .execute()
    )
    if not result.data:
        raise HTTPException(status_code=404, detail="Conversation not found")
    return result.data[0]
