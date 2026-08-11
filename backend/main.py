import os
import io
import base64
import uuid
import httpx
import json
import asyncio
from pathlib import Path
from typing import List
from datetime import datetime, timezone

import numpy as np
from fastapi import FastAPI, UploadFile, File, Form, Header, HTTPException, Depends
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from sentence_transformers import SentenceTransformer
from pypdf import PdfReader
from groq import Groq
try:
    from supabase import create_client, Client
except ImportError:
    create_client = None
    Client = None
from dotenv import load_dotenv

# -------------------------------------------------------------------
# SETUP
# -------------------------------------------------------------------
load_dotenv(dotenv_path=Path(__file__).parent / ".env")  # loads .env sitting next to this file, no matter where uvicorn was launched from

app = FastAPI()

# Lets your React app (running on a different port) talk to this server
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_methods=["*"],
    allow_headers=["*"],
)

client = Groq(api_key=os.environ.get("GROQ_API_KEY"))
embedder = SentenceTransformer("all-MiniLM-L6-v2")  # for document search

SUPABASE_URL = os.environ.get("SUPABASE_URL")
SUPABASE_KEY = os.environ.get("SUPABASE_KEY")
SUPABASE_ENABLED = bool(SUPABASE_URL and SUPABASE_KEY)

supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY) if SUPABASE_ENABLED else None

# Fallback storage used ONLY when Supabase isn't configured yet.
# Works the same from the frontend's point of view, it just resets
# whenever the backend restarts (no real persistence).
_local_conversations = {}   # conversation_id -> {id, title, updated_at}
_local_messages = {}        # conversation_id -> [ {role, content, image_url} ]

SYSTEM_PROMPT = {
    "role": "system",
    "content": (
        "You are a helpful, friendly assistant. "
        "Always follow the user's formatting instructions exactly — "
        "if they ask for a specific number of lines, words, sentences, or bullet points, "
        "obey that limit strictly even if it means leaving out detail you'd normally include. "
        "Do not add extra explanation, caveats, or padding beyond what was asked for."
    ),
}
WEATHER_TOOLS = [
    {
        "type": "function",
        "function": {
            "name": "get_weather",
            "description": "Get the current real-time weather for a city",
            "parameters": {
                "type": "object",
                "properties": {
                    "city": {"type": "string", "description": "City name, e.g. Amritsar"}
                },
                "required": ["city"]
            }
        }
    }
]
RECENT_MESSAGE_LIMIT = 8   # how many latest chat messages to send in full

doc_store = []  # in-memory document chunks: [{"text": ..., "embedding": ...}]


# -------------------------------------------------------------------
# DATA SHAPES (what a valid request must look like)
# -------------------------------------------------------------------
class SignUpRequest(BaseModel):
    email: str
    password: str


class LoginRequest(BaseModel):
    email: str
    password: str

class Message(BaseModel):
    role: str
    content: str


class ChatRequest(BaseModel):
    conversation_id: str
    messages: List[Message]
    summary: str = ""   # running summary of older conversation, sent by frontend


class SummarizeRequest(BaseModel):
    messages: List[Message]
    previous_summary: str = ""


class ConversationCreate(BaseModel):
    title: str = "New Chat"


# -------------------------------------------------------------------
# HELPERS
# -------------------------------------------------------------------
def build_context(req: ChatRequest):
    """System prompt + summary of old messages + most recent messages."""
    context = [SYSTEM_PROMPT]

    if req.summary:
        context.append({
            "role": "system",
            "content": f"Summary of earlier conversation: {req.summary}",
        })

    recent = req.messages[-RECENT_MESSAGE_LIMIT:]
    context += [m.model_dump() for m in recent]
    return context


def retrieve_relevant(query: str, k: int = 3):
    """Find the k most relevant document chunks for this query."""
    if not doc_store:
        return []
    q_emb = embedder.encode(query)
    scored = sorted(doc_store, key=lambda d: np.dot(d["embedding"], q_emb), reverse=True)
    return [d["text"] for d in scored[:k]]


def extract_text(filename: str, raw: bytes) -> str:
    if filename.lower().endswith(".pdf"):
        reader = PdfReader(io.BytesIO(raw))
        return "\n".join(page.extract_text() or "" for page in reader.pages)
    return raw.decode("utf-8", errors="ignore")


def chunk_text(text: str, size: int = 500):
    return [text[i:i + size] for i in range(0, len(text), size)]


async def get_weather(city: str):
    async with httpx.AsyncClient() as http_client:
        geo_res = await http_client.get(
            "https://geocoding-api.open-meteo.com/v1/search",
            params={"name": city, "count": 1}
        )
        geo_data = geo_res.json()
        if not geo_data.get("results"):
            return {"error": f"Couldn't find location: {city}"}

        lat = geo_data["results"][0]["latitude"]
        lon = geo_data["results"][0]["longitude"]

        weather_res = await http_client.get(
            "https://api.open-meteo.com/v1/forecast",
            params={"latitude": lat, "longitude": lon, "current_weather": True}
        )
        current = weather_res.json()["current_weather"]

        return {
            "city": city,
            "temperature_celsius": current["temperature"],
            "windspeed_kmh": current["windspeed"]
        }



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

    _local_messages.setdefault(conversation_id, []).append(
        {"role": role, "content": content, "image_url": image_url}
    )
    if conversation_id in _local_conversations:
        _local_conversations[conversation_id]["updated_at"] = datetime.now(timezone.utc).isoformat()


def maybe_set_title(conversation_id: str, first_message: str):
    """The first time a conversation gets a real message, rename it
    from 'New Chat' to a short preview of that message."""
    new_title = first_message.strip()[:40] or "New Chat"

    if SUPABASE_ENABLED:
        result = supabase.table("conversations").select("title").eq("id", conversation_id).single().execute()
        if result.data and result.data["title"] == "New Chat":
            supabase.table("conversations").update({"title": new_title}).eq("id", conversation_id).execute()
        return

    conv = _local_conversations.get(conversation_id)
    if conv and conv["title"] == "New Chat":
        conv["title"] = new_title


# -------------------------------------------------------------------
# AUTH — Supabase email/password, role-based personas
# -------------------------------------------------------------------
# -------------------------------------------------------------------
# AUTH — Supabase email/password
# -------------------------------------------------------------------
async def require_auth(authorization: str | None = Header(default=None)):
    if not SUPABASE_ENABLED:
        raise HTTPException(status_code=500, detail="Supabase not configured")
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Unauthorized")

    token = authorization.replace("Bearer ", "")
    try:
        user_response = supabase.auth.get_user(token)
    except Exception:
        raise HTTPException(status_code=401, detail="Unauthorized")

    if not user_response or not user_response.user:
        raise HTTPException(status_code=401, detail="Unauthorized")

    return user_response.user


async def get_current_profile(user=Depends(require_auth)):
    """Fetches role/persona info tied to the authenticated user."""
    result = supabase.table("profiles").select("*").eq("id", user.id).single().execute()
    if not result.data:
        raise HTTPException(status_code=404, detail="Profile not found")
    return result.data


def require_role(*allowed_roles: str):
    """Gate a route to specific personas: Depends(require_role("ngo_admin"))"""
    async def checker(profile=Depends(get_current_profile)):
        if profile["role"] not in allowed_roles:
            raise HTTPException(status_code=403, detail="Forbidden for this role")
        return profile
    return checker

# -------------------------------------------------------------------
# ROUTES
# -------------------------------------------------------------------
@app.get("/")
def health():
    return {"status": "ok"}


@app.post("/api/conversations")
def create_conversation(req: ConversationCreate):
    if SUPABASE_ENABLED:
        result = supabase.table("conversations").insert({"title": req.title}).execute()
        return result.data[0]

    conv_id = str(uuid.uuid4())
    conv = {"id": conv_id, "title": req.title, "updated_at": datetime.now(timezone.utc).isoformat()}
    _local_conversations[conv_id] = conv
    _local_messages[conv_id] = []
    return conv


@app.get("/api/conversations")
def list_conversations():
    if SUPABASE_ENABLED:
        result = (
            supabase.table("conversations")
            .select("id,title,updated_at")
            .order("updated_at", desc=True)
            .execute()
        )
        return result.data

    return sorted(_local_conversations.values(), key=lambda c: c["updated_at"], reverse=True)


@app.get("/api/conversations/{conversation_id}/messages")
def get_conversation_messages(conversation_id: str):
    if SUPABASE_ENABLED:
        result = (
            supabase.table("messages")
            .select("role,content,image_url")
            .eq("conversation_id", conversation_id)
            .order("created_at")
            .execute()
        )
        return result.data

    return _local_messages.get(conversation_id, [])


@app.delete("/api/conversations/{conversation_id}")
def delete_conversation(conversation_id: str):
    if SUPABASE_ENABLED:
        supabase.table("messages").delete().eq("conversation_id", conversation_id).execute()
        supabase.table("conversations").delete().eq("id", conversation_id).execute()
    else:
        _local_messages.pop(conversation_id, None)
        _local_conversations.pop(conversation_id, None)
    return {"status": "deleted"}


@app.post("/api/chat")
def chat(req: ChatRequest):
    messages = build_context(req)

    # If we have uploaded documents, inject relevant chunks based on the latest question
    if req.messages:
        last_user_msg = req.messages[-1].content
        relevant_chunks = retrieve_relevant(last_user_msg)
        if relevant_chunks:
            messages.insert(1, {
                "role": "system",
                "content": "Relevant document context:\n" + "\n---\n".join(relevant_chunks),
            })

    # STEP 1: Quick, non-streaming check — does this message need the weather tool?
    check = client.chat.completions.create(
        messages=messages,
        model="llama-3.3-70b-versatile",
        tools=WEATHER_TOOLS,
    )
    check_reply = check.choices[0].message

    # STEP 2: If a tool call was requested, run it and fold the real result into messages
    if check_reply.tool_calls:
        tool_call = check_reply.tool_calls[0]
        args = json.loads(tool_call.function.arguments)

        result = asyncio.run(get_weather(args["city"]))

        messages.append({
            "role": "assistant",
            "content": check_reply.content,
            "tool_calls": [
                {
                    "id": tool_call.id,
                    "type": "function",
                    "function": {
                        "name": tool_call.function.name,
                        "arguments": tool_call.function.arguments
                    }
                }
            ]
        })
        messages.append({
            "role": "tool",
            "tool_call_id": tool_call.id,
            "content": json.dumps(result)
        })
        # messages now include the real weather data, ready for the final streamed answer below

    # STEP 3: Stream the final answer (unchanged from before — just uses updated messages)
    def token_stream():
        full_reply = ""
        stream = client.chat.completions.create(
            messages=messages,
            model="openai/gpt-oss-120b",
            stream=True,
            max_completion_tokens=800,
        )
        for chunk in stream:
            token = chunk.choices[0].delta.content
            if token:
                full_reply += token
                yield token

        # This code runs only AFTER the loop above finishes — i.e. once
        # the model has finished streaming its whole answer — so we save
        # the complete exchange to the database exactly once.
        if req.messages:
            save_message(req.conversation_id, "user", req.messages[-1].content)
            maybe_set_title(req.conversation_id, req.messages[-1].content)
        save_message(req.conversation_id, "assistant", full_reply)

    return StreamingResponse(token_stream(), media_type="text/plain")


@app.post("/api/summarize")
def summarize(req: SummarizeRequest):
    convo_text = "\n".join(f"{m.role}: {m.content}" for m in req.messages)

    prompt = (
        "Summarize the key facts, decisions, and context from this conversation "
        "in 3-4 sentences. Be concise, factual, no filler.\n\n"
    )
    if req.previous_summary:
        prompt += f"Previous summary: {req.previous_summary}\n\n"
    prompt += f"New messages to fold in:\n{convo_text}"

    completion = client.chat.completions.create(
        messages=[{"role": "user", "content": prompt}],
        model="openai/gpt-oss-20b",
        max_completion_tokens=150,
    )
    return {"summary": completion.choices[0].message.content}


@app.post("/api/upload/document")
async def upload_document(file: UploadFile = File(...)):
    raw = await file.read()
    text = extract_text(file.filename, raw)
    chunks = chunk_text(text)
    embeddings = embedder.encode(chunks)

    for chunk, emb in zip(chunks, embeddings):
        doc_store.append({"text": chunk, "embedding": emb})

    return {"status": "ok", "chunks_added": len(chunks)}


@app.post("/api/chat/vision")
async def chat_vision(
    file: UploadFile = File(...),
    question: str = Form(""),
    conversation_id: str = Form(...),
):
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
    save_message(conversation_id, "user", user_note, image_url=f"[uploaded: {file.filename}]")
    maybe_set_title(conversation_id, user_note)
    save_message(conversation_id, "assistant", reply)

    return {"reply": reply}

@app.post("/api/auth/signup")
def signup(req: SignUpRequest):
    if not SUPABASE_ENABLED:
        raise HTTPException(status_code=500, detail="Supabase not configured")

    result = supabase.auth.sign_up({"email": req.email, "password": req.password})
    if not result.user:
        raise HTTPException(status_code=400, detail="Signup failed")

    supabase.table("profiles").insert({
        "id": result.user.id,
        "email": req.email,
    }).execute()

    return {
        "user_id": result.user.id,
        "email": result.user.email,
        "access_token": result.session.access_token if result.session else None,
        "refresh_token": result.session.refresh_token if result.session else None,
    }


@app.post("/api/auth/login")
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


@app.get("/api/auth/me")
def me(user=Depends(require_auth)):
    return {"user_id": user.id, "email": user.email}