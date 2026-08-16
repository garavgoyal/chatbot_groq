"""Pydantic models — the shape every request/response body must match.
FastAPI validates incoming JSON against these automatically."""
from typing import List, Optional
from pydantic import BaseModel

from config import DEFAULT_TITLE


class SignUpRequest(BaseModel):
    email: str
    password: str


class LoginRequest(BaseModel):
    email: str
    password: str


class Message(BaseModel):
    role: str
    content: str


class UserLocation(BaseModel):
    """Where the user is, as reported by their browser. All optional: the
    coordinates need a permission grant (and a secure context) that we may
    never get, while the timezone is always available and is enough to guess
    a nearby city. Sent so weather questions about "here" mean the user's
    here, not a city the model invented."""
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    timezone: Optional[str] = None


class ChatRequest(BaseModel):
    conversation_id: str
    messages: List[Message]
    summary: str = ""   # running summary of older conversation, sent by frontend
    location: Optional[UserLocation] = None


class SummarizeRequest(BaseModel):
    messages: List[Message]
    previous_summary: str = ""


class ConversationCreate(BaseModel):
    title: str = DEFAULT_TITLE
