"""FastAPI dependencies — functions that run before a route handler and can
block the request or inject a value into it (here: the authenticated user).
This is the idiomatic FastAPI equivalent of Express's "auth middleware";
real ASGI middleware (in middleware/) is for cross-cutting concerns that
apply to every request regardless of route, like logging."""
from typing import Optional
from fastapi import Header, HTTPException

from clients import supabase
from config import SUPABASE_ENABLED


async def require_auth(authorization: Optional[str] = Header(default=None)):
    if not SUPABASE_ENABLED:
        raise HTTPException(status_code=500, detail="Supabase not configured")
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Unauthorized")

    token = authorization.replace("Bearer ", "")
    try:
        user_response = supabase.auth.get_user(token)
    except Exception:
        raise HTTPException(status_code=401, detail="Unauthorized")

    if not user_response or not user_response.user:
        raise HTTPException(status_code=401, detail="Unauthorized")

    return user_response.user


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
