from typing import List

from pydantic import BaseModel


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
