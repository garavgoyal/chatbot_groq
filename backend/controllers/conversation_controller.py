"""The actual logic behind each /api/conversations route."""
import uuid
from datetime import datetime, timezone

from clients import supabase
from config import SUPABASE_ENABLED
from dependencies import get_owned_conversation
from storage import local_conversations, local_messages


def create_conversation(title: str, user_id: str):
    if SUPABASE_ENABLED:
        result = supabase.table("conversations").insert({
            "title": title,
            "user_id": user_id,
        }).execute()
        return result.data[0]

    conv_id = str(uuid.uuid4())
    conv = {"id": conv_id, "title": title, "updated_at": datetime.now(timezone.utc).isoformat()}
    local_conversations[conv_id] = conv
    local_messages[conv_id] = []
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

    return sorted(local_conversations.values(), key=lambda c: c["updated_at"], reverse=True)


def get_conversation_messages(conversation_id: str, user_id: str):
    if SUPABASE_ENABLED:
        get_owned_conversation(conversation_id, user_id)

        result = (
            supabase.table("messages")
            .select("role,content,image_url")
            .eq("conversation_id", conversation_id)
            .order("created_at")
            .execute()
        )
        return result.data

    return local_messages.get(conversation_id, [])


def delete_conversation(conversation_id: str, user_id: str):
    if SUPABASE_ENABLED:
        get_owned_conversation(conversation_id, user_id)

        supabase.table("messages").delete().eq("conversation_id", conversation_id).execute()
        supabase.table("conversations").delete().eq("id", conversation_id).execute()
    else:
        local_messages.pop(conversation_id, None)
        local_conversations.pop(conversation_id, None)
    return {"status": "deleted"}
