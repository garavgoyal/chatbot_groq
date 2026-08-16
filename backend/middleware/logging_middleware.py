"""Real ASGI middleware — runs for every request, before and after the
route handler, regardless of which route matched. This is the actual
Express-style "middleware" (vs. dependencies.py's require_auth, which is
FastAPI's per-route equivalent — see the note there)."""
import logging
import time

from starlette.middleware.base import BaseHTTPMiddleware

logger = logging.getLogger("app.requests")


class LoggingMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request, call_next):
        start = time.perf_counter()
        response = await call_next(request)
        duration_ms = (time.perf_counter() - start) * 1000
        logger.info(f'{request.method} {request.url.path} -> {response.status_code} ({duration_ms:.1f}ms)')
        return response
