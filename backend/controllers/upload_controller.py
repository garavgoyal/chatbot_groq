"""The actual logic behind /api/upload/document and /api/chat/vision."""
import base64
import io

from fastapi import HTTPException, UploadFile
from pypdf import PdfReader

from clients import groq_client, embedder
from config import (
    SYSTEM_PROMPT, MAX_DOCUMENT_SIZE, MAX_IMAGE_SIZE, ALLOWED_DOCUMENT_EXTENSIONS,
    SUPABASE_ENABLED,
)
from controllers.title_controller import maybe_set_title
from dependencies import get_owned_conversation
from storage import add_document_chunks, save_message


def extract_text(filename: str, raw: bytes) -> str:
    if filename.lower().endswith(".pdf"):
        reader = PdfReader(io.BytesIO(raw))
        return "\n".join(page.extract_text() or "" for page in reader.pages)
    return raw.decode("utf-8", errors="ignore")


def chunk_text(text: str, size: int = 500):
    return [text[i:i + size] for i in range(0, len(text), size)]


async def handle_document_upload(file: UploadFile, user):
    if not file.filename or not file.filename.lower().endswith(ALLOWED_DOCUMENT_EXTENSIONS):
        raise HTTPException(
            status_code=400,
            detail=f"Unsupported file type. Allowed: {', '.join(ALLOWED_DOCUMENT_EXTENSIONS)}",
        )

    raw = await file.read()
    if len(raw) > MAX_DOCUMENT_SIZE:
        raise HTTPException(status_code=413, detail=f"File too large (max {MAX_DOCUMENT_SIZE // (1024*1024)}MB)")

    text = extract_text(file.filename, raw)
    if not text.strip():
        raise HTTPException(status_code=400, detail="Couldn't extract any text from this file")

    chunks = chunk_text(text)
    embeddings = embedder.encode(chunks)
    add_document_chunks(chunks, embeddings, user.id)

    return {"status": "ok", "chunks_added": len(chunks)}


async def handle_vision_chat(file: UploadFile, question: str, conversation_id: str, user):
    if SUPABASE_ENABLED:
        get_owned_conversation(conversation_id, user.id)

    if not file.content_type or not file.content_type.startswith("image/"):
        raise HTTPException(status_code=400, detail="File must be an image")

    raw = await file.read()
    if len(raw) > MAX_IMAGE_SIZE:
        raise HTTPException(status_code=413, detail=f"Image too large (max {MAX_IMAGE_SIZE // (1024*1024)}MB)")

    b64 = base64.b64encode(raw).decode("utf-8")

    try:
        completion = groq_client.chat.completions.create(
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
    except Exception:
        raise HTTPException(status_code=502, detail="Vision service is unavailable right now")
    reply = completion.choices[0].message.content

    user_note = question or "Describe this image."
    save_message(conversation_id, "user", user_note, image_url=f"[uploaded: {file.filename}]")
    save_message(conversation_id, "assistant", reply)
    maybe_set_title(conversation_id, user_note, reply)

    return {
        "reply": reply,
        "tokens": completion.usage.total_tokens if completion.usage else None,
    }
