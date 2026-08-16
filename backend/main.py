"""Entry point — creates the FastAPI app, wires up middleware, and
includes every route module. Equivalent to server.js in an Express app.
Run with: uvicorn main:app --reload"""
import logging

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from config import ALLOWED_ORIGINS
from middleware.error_handler import register_error_handlers
from middleware.logging_middleware import LoggingMiddleware
from routes import auth_routes, chat_routes, conversation_routes, health_routes, upload_routes

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(name)s %(message)s")

app = FastAPI()

# Order matters: middleware runs outside-in on the way in, inside-out on the
# way out, so the last one added wraps everything else — logging goes last
# so it can time/log the CORS-wrapped response too.
app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_methods=["*"],
    allow_headers=["*"],
)
app.add_middleware(LoggingMiddleware)
register_error_handlers(app)

app.include_router(health_routes.router)
app.include_router(auth_routes.router)
app.include_router(conversation_routes.router)
app.include_router(chat_routes.router)
app.include_router(upload_routes.router)
