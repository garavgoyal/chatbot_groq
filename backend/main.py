"""Compat entrypoint so `uvicorn main:app` still works from the backend/ dir.
The actual app lives in app/main.py, split into app/routers/*."""

from app.main import app

__all__ = ["app"]
