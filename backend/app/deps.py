from fastapi import Header, HTTPException

from .clients import supabase
from .config import SUPABASE_ENABLED


async def require_auth(authorization: str | None = Header(default=None)):
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
