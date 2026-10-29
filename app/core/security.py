"""Security utilities: input sanitization, security headers, and rate limiting."""

import re
import unicodedata
from collections.abc import Awaitable, Callable
from typing import Any

from fastapi import Request, Response
from slowapi import Limiter
from slowapi.util import get_remote_address
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.responses import JSONResponse

# Shared Rate Limiter using client IP
limiter = Limiter(key_func=get_remote_address)

# Prompt Injection Defense Delimiters
USER_DATA_START_DELIMITER = "<<<EVENT_INTAKE_DATA_START>>>"
USER_DATA_END_DELIMITER = "<<<EVENT_INTAKE_DATA_END>>>"

# Patterns suspicious of prompt injection attacks
INJECTION_PATTERNS = [
    re.compile(
        r"ignore\s+(?:all\s+)?(?:previous|prior)\s+instructions?", re.IGNORECASE
    ),
    re.compile(r"system\s*:\s*", re.IGNORECASE),
    re.compile(r"you\s+are\s+now\s+(?:a|an)\s+", re.IGNORECASE),
    re.compile(r"disregard\s+all\s+", re.IGNORECASE),
    re.compile(r"assistant\s*:\s*", re.IGNORECASE),
    re.compile(r"<\|im_start\|>", re.IGNORECASE),
    re.compile(r"<\|im_end\|>", re.IGNORECASE),
]


def sanitize_text(text: str | None, max_length: int = 500) -> str:
    """Sanitize user free-text fields against control characters and prompt injection.

    - Strips non-printable and control characters (except common whitespace).
    - Neutralizes common prompt-injection override keywords.
    - Enforces length caps.
    """
    if not text:
        return ""

    # Normalize unicode to NFKC
    normalized = unicodedata.normalize("NFKC", text)

    # Remove non-printable control characters (keep standard space, newline, tab)
    clean_chars = [
        ch for ch in normalized
        if (ch in "\n\r\t") or (unicodedata.category(ch)[0] != "C")
    ]
    cleaned = "".join(clean_chars)

    # Defuse common prompt injection patterns
    for pattern in INJECTION_PATTERNS:
        cleaned = pattern.sub("[filtered_instruction]", cleaned)

    # Neutralize custom delimiters to prevent breaking out of framing
    cleaned = cleaned.replace("<<<", "&lt;&lt;&lt;").replace(">>>", "&gt;&gt;&gt;")

    # Cap text length
    return cleaned[:max_length].strip()


class SecurityHeadersMiddleware(BaseHTTPMiddleware):
    """Middleware enforcing secure HTTP headers on every response."""

    async def dispatch(
        self, request: Request, call_next: Callable[[Request], Awaitable[Response]]
    ) -> Response:
        response: Response = await call_next(request)
        # Content Security Policy: disallow inline scripts on app pages,
        # but permit CDN and inline initialization scripts for interactive docs
        clean_path = request.url.path.rstrip("/")
        if clean_path in ("/docs", "/redoc") or clean_path == "/openapi.json":
            response.headers["Content-Security-Policy"] = (
                "default-src 'self'; "
                "script-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net; "
                "style-src 'self' 'unsafe-inline' "
                "https://cdn.jsdelivr.net https://fonts.googleapis.com; "
                "font-src 'self' https://fonts.gstatic.com data:; "
                "img-src 'self' data: https://fastapi.tiangolo.com; "
                "connect-src 'self' https://cdn.jsdelivr.net; "
                "worker-src 'self' blob:; "
                "frame-ancestors 'none'; "
                "base-uri 'self'; "
                "form-action 'self';"
            )
        else:
            response.headers["Content-Security-Policy"] = (
                "default-src 'self'; "
                "script-src 'self'; "
                "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; "
                "font-src 'self' https://fonts.gstatic.com; "
                "img-src 'self' data:; "
                "connect-src 'self'; "
                "frame-ancestors 'none'; "
                "base-uri 'self'; "
                "form-action 'self';"
            )
        response.headers["X-Content-Type-Options"] = "nosniff"
        response.headers["X-Frame-Options"] = "DENY"
        response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
        response.headers["Permissions-Policy"] = (
            "camera=(), microphone=(), geolocation=(), payment=()"
        )
        return response


class RequestSizeLimitMiddleware(BaseHTTPMiddleware):
    """Enforces maximum allowed request body size to prevent payload bloating."""

    def __init__(self, app: Callable[..., Any], max_bytes: int = 1_048_576) -> None:
        super().__init__(app)
        self.max_bytes = max_bytes

    async def dispatch(
        self, request: Request, call_next: Callable[[Request], Awaitable[Response]]
    ) -> Response:
        content_length = request.headers.get("content-length")
        if content_length and int(content_length) > self.max_bytes:
            return JSONResponse(
                status_code=413,
                content={
                    "error": "Payload Too Large",
                    "detail": f"Request size exceeds limit of {self.max_bytes} bytes",
                },
            )
        response: Response = await call_next(request)
        return response
