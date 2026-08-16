"""Where conversation/message/document data actually lives. Not "models" in
the schema sense (see models/schemas.py for that) — this is the read/write
layer: either real Supabase tables, or the in-memory fallback dicts below
when Supabase isn't configured.

local_conversations / local_messages / doc_store are plain module-level
dicts/lists, imported by reference elsewhere (routes/controllers mutate
them directly for the simple list/create/delete cases) — that's fine in
Python since importing a dict gives you the same object, not a copy."""
from datetime import datetime, timezone
from typing import List

import numpy as np

from clients import supabase, embedder
from config import SUPABASE_ENABLED, MAX_CHUNKS_PER_USER, DEFAULT_TITLE

# Fallback storage used ONLY when Supabase isn't configured yet.
# Works the same from the frontend's point of view, it just resets
# whenever the backend restarts (no real persistence).
local_conversations = {}   # conversation_id -> {id, title, updated_at}
local_messages = {}        # conversation_id -> [ {role, content, image_url} ]

doc_store = []  # in-memory document chunks: [{"text": ..., "embedding": ..., "user_id": ...}]


def add_document_chunks(chunks: List[str], embeddings, user_id: str):
    """Append new chunks for this user, then evict the oldest ones for that
    user past MAX_CHUNKS_PER_USER so doc_store (in-memory, never persisted)
    can't grow without bound over a long-running process."""
    for chunk, emb in zip(chunks, embeddings):
        doc_store.append({"text": chunk, "embedding": emb, "user_id": user_id})

    user_chunk_ids = [id(d) for d in doc_store if d.get("user_id") == user_id]
    overflow = len(user_chunk_ids) - MAX_CHUNKS_PER_USER
    if overflow > 0:
        drop_ids = set(user_chunk_ids[:overflow])  # oldest first (insertion order)
        doc_store[:] = [d for d in doc_store if id(d) not in drop_ids]


def retrieve_relevant(query: str, user_id: str, k: int = 3):
    """Find the k most relevant document chunks for this query, scoped to this user."""
    user_chunks = [d for d in doc_store if d.get("user_id") == user_id]
    if not user_chunks:
        return []
    q_emb = embedder.encode(query)
    scored = sorted(user_chunks, key=lambda d: np.dot(d["embedding"], q_emb), reverse=True)
    return [d["text"] for d in scored[:k]]


def save_message(conversation_id: str, role: str, content: str, image_url: str = None):
    """Insert one message, and bump the conversation's updated_at
    so the sidebar can sort by most-recently-active conversation."""
    if SUPABASE_ENABLED:
        supabase.table("messages").insert({
            "conversation_id": conversation_id,
            "role": role,
            "content": content,
            "image_url": image_url,
        }).execute()
        supabase.table("conversations").update({
            "updated_at": datetime.now(timezone.utc).isoformat()
        }).eq("id", conversation_id).execute()
        return

    local_messages.setdefault(conversation_id, []).append(
        {"role": role, "content": content, "image_url": image_url}
    )
    if conversation_id in local_conversations:
        local_conversations[conversation_id]["updated_at"] = datetime.now(timezone.utc).isoformat()


def conversation_needs_title(conversation_id: str) -> bool:
    """True while a conversation is still on the placeholder title — i.e. it
    hasn't been named after its actual subject yet. Naming itself lives in
    controllers/title_controller.py; this layer only reads and writes."""
    if SUPABASE_ENABLED:
        result = supabase.table("conversations").select("title").eq("id", conversation_id).single().execute()
        return bool(result.data) and result.data["title"] == DEFAULT_TITLE

    conv = local_conversations.get(conversation_id)
    return bool(conv) and conv["title"] == DEFAULT_TITLE


def set_conversation_title(conversation_id: str, title: str):
    if SUPABASE_ENABLED:
        supabase.table("conversations").update({"title": title}).eq("id", conversation_id).execute()
        return

    conv = local_conversations.get(conversation_id)
    if conv:
        conv["title"] = title
