from fastapi import APIRouter, Depends

from controllers import chat_controller
from dependencies import require_auth
from models.schemas import ChatRequest, SummarizeRequest

router = APIRouter()


@router.post("/api/chat")
def chat(req: ChatRequest, user=Depends(require_auth)):
    return chat_controller.handle_chat(req, user)


@router.post("/api/summarize")
def summarize(req: SummarizeRequest, user=Depends(require_auth)):
    return chat_controller.handle_summarize(req)
