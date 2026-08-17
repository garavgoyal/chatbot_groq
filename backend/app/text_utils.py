import io

import numpy as np
from pypdf import PdfReader

from .clients import embedder
from .store import doc_store


def extract_text(filename: str, raw: bytes) -> str:
    if filename.lower().endswith(".pdf"):
        reader = PdfReader(io.BytesIO(raw))
        return "\n".join(page.extract_text() or "" for page in reader.pages)
    return raw.decode("utf-8", errors="ignore")


def chunk_text(text: str, size: int = 500):
    return [text[i:i + size] for i in range(0, len(text), size)]


def retrieve_relevant(query: str, user_id: str, k: int = 3):
    """Find the k most relevant document chunks for this query, scoped to this user."""
    user_chunks = [d for d in doc_store if d.get("user_id") == user_id]
    if not user_chunks:
        return []
    q_emb = embedder.encode(query)
    scored = sorted(user_chunks, key=lambda d: np.dot(d["embedding"], q_emb), reverse=True)
    return [d["text"] for d in scored[:k]]
