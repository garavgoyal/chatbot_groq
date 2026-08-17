from fastapi import APIRouter, Depends, HTTPException

from ..clients import supabase
from ..config import SUPABASE_ENABLED
from ..deps import require_auth
from ..schemas import LoginRequest, SignUpRequest

router = APIRouter(prefix="/api/auth", tags=["auth"])


@router.post("/signup")
def signup(req: SignUpRequest):
    if not SUPABASE_ENABLED:
        raise HTTPException(status_code=500, detail="Supabase not configured")

    try:
        result = supabase.auth.sign_up({"email": req.email, "password": req.password})
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

    if not result.user:
        raise HTTPException(status_code=400, detail="Signup failed")

    return {
        "user_id": result.user.id,
        "email": result.user.email,
        "access_token": result.session.access_token if result.session else None,
        "refresh_token": result.session.refresh_token if result.session else None,
    }


@router.post("/login")
def login(req: LoginRequest):
    if not SUPABASE_ENABLED:
        raise HTTPException(status_code=500, detail="Supabase not configured")

    try:
        result = supabase.auth.sign_in_with_password({"email": req.email, "password": req.password})
    except Exception:
        raise HTTPException(status_code=401, detail="Invalid email or password")

    return {
        "user_id": result.user.id,
        "email": result.user.email,
        "access_token": result.session.access_token,
        "refresh_token": result.session.refresh_token,
    }


@router.get("/me")
def me(user=Depends(require_auth)):
    return {"user_id": user.id, "email": user.email}
