import base64

from fastapi import APIRouter, Depends, File, Form, UploadFile

from .. import store
from ..clients import client, embedder
from ..config import SUPABASE_ENABLED
from ..deps import require_auth
from ..prompts import SYSTEM_PROMPT
from ..text_utils import chunk_text, extract_text

router = APIRouter(prefix="/api", tags=["documents"])


@router.post("/upload/document")
async def upload_document(file: UploadFile = File(...), user=Depends(require_auth)):
    raw = await file.read()
    text = extract_text(file.filename, raw)
    chunks = chunk_text(text)
    embeddings = embedder.encode(chunks)

    for chunk, emb in zip(chunks, embeddings):
        store.doc_store.append({"text": chunk, "embedding": emb, "user_id": user.id})

    return {"status": "ok", "chunks_added": len(chunks)}


@router.post("/chat/vision")
async def chat_vision(
    file: UploadFile = File(...),
    question: str = Form(""),
    conversation_id: str = Form(...),
    user=Depends(require_auth),
):
    if SUPABASE_ENABLED:
        store.get_owned_conversation(conversation_id, user.id)

    raw = await file.read()
    b64 = base64.b64encode(raw).decode("utf-8")

    completion = client.chat.completions.create(
        model="qwen/qwen3.6-27b",
        messages=[
            SYSTEM_PROMPT,
            {
                "role": "user",
                "content": [
                    {"type": "text", "text": question or "Describe this image."},
                    {"type": "image_url", "image_url": {"url": f"data:image/jpeg;base64,{b64}"}},
                ],
            },
        ],
        max_completion_tokens=300,
        reasoning_effort="none",
    )
    reply = completion.choices[0].message.content

    user_note = question or "Describe this image."
    store.save_message(conversation_id, "user", user_note, image_url=f"[uploaded: {file.filename}]")
    store.maybe_set_title(conversation_id, user_note)
    store.save_message(conversation_id, "assistant", reply)

    return {"reply": reply}
