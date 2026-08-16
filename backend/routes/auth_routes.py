from fastapi import APIRouter, Depends

from controllers import auth_controller
from dependencies import require_auth
from models.schemas import SignUpRequest, LoginRequest

router = APIRouter()


@router.post("/api/auth/signup")
def signup(req: SignUpRequest):
    return auth_controller.signup_user(req)


@router.post("/api/auth/login")
def login(req: LoginRequest):
    return auth_controller.login_user(req)


@router.get("/api/auth/me")
def me(user=Depends(require_auth)):
    return auth_controller.get_current_user_info(user)
