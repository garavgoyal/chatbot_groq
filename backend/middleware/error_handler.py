"""Catch-all for exceptions that escape a route handler without being
turned into an HTTPException — a bug, not an expected failure. Without
this, FastAPI's default behavior is a bare 500 with no JSON body; this
gives the frontend a consistent {"detail": ...} shape to work with and
logs the real traceback server-side instead of letting it vanish.

This does NOT shadow FastAPI's built-in HTTPException handling (the try/
except blocks in each controller still produce their own proper status
codes) — Starlette picks the most specific exception handler registered,
so HTTPException still resolves to FastAPI's own handler; only truly
unhandled exceptions fall through to this one."""
import logging

from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse

logger = logging.getLogger("app.errors")


def register_error_handlers(app: FastAPI):
    @app.exception_handler(Exception)
    async def unhandled_exception_handler(request: Request, exc: Exception):
        logger.exception(f"Unhandled error on {request.method} {request.url.path}")
        return JSONResponse(status_code=500, content={"detail": "Internal server error"})
