from fastapi import APIRouter, Depends

from controllers import conversation_controller
from dependencies import require_auth
from models.schemas import ConversationCreate

router = APIRouter()


@router.post("/api/conversations")
def create_conversation(req: ConversationCreate, user=Depends(require_auth)):
    return conversation_controller.create_conversation(req.title, user.id)


@router.get("/api/conversations")
def list_conversations(user=Depends(require_auth)):
    return conversation_controller.list_conversations(user.id)


@router.get("/api/conversations/{conversation_id}/messages")
def get_conversation_messages(conversation_id: str, user=Depends(require_auth)):
    return conversation_controller.get_conversation_messages(conversation_id, user.id)


@router.delete("/api/conversations/{conversation_id}")
def delete_conversation(conversation_id: str, user=Depends(require_auth)):
    return conversation_controller.delete_conversation(conversation_id, user.id)
