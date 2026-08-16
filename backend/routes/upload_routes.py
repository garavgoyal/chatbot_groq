from fastapi import APIRouter, Depends, File, Form, UploadFile

from controllers import upload_controller
from dependencies import require_auth

router = APIRouter()


@router.post("/api/upload/document")
async def upload_document(file: UploadFile = File(...), user=Depends(require_auth)):
    return await upload_controller.handle_document_upload(file, user)


@router.post("/api/chat/vision")
async def chat_vision(
    file: UploadFile = File(...),
    question: str = Form(""),
    conversation_id: str = Form(...),
    user=Depends(require_auth),
):
    return await upload_controller.handle_vision_chat(file, question, conversation_id, user)
