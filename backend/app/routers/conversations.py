from fastapi import APIRouter, Depends

from .. import store
from ..config import SUPABASE_ENABLED
from ..deps import require_auth
from ..schemas import ConversationCreate

router = APIRouter(prefix="/api/conversations", tags=["conversations"])


@router.post("")
def create_conversation(req: ConversationCreate, user=Depends(require_auth)):
    return store.create_conversation(req.title, user.id)


@router.get("")
def list_conversations(user=Depends(require_auth)):
    return store.list_conversations(user.id)


@router.get("/{conversation_id}/messages")
def get_conversation_messages(conversation_id: str, user=Depends(require_auth)):
    if SUPABASE_ENABLED:
        store.get_owned_conversation(conversation_id, user.id)
    return store.get_conversation_messages(conversation_id)


@router.delete("/{conversation_id}")
def delete_conversation(conversation_id: str, user=Depends(require_auth)):
    if SUPABASE_ENABLED:
        store.get_owned_conversation(conversation_id, user.id)
    store.delete_conversation(conversation_id)
    return {"status": "deleted"}
