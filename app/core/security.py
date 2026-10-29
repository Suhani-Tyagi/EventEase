"""Security utilities: input sanitization, security headers, and rate limiting."""

import re
import unicodedata
from collections.abc import Awaitable, Callable
from typing import Any

from fastapi import Request, Response
from slowapi import Limiter
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.responses import JSONResponse


def is_trusted_proxy(host: str) -> bool:
    """Check if the direct peer is a trusted reverse proxy."""
    from app.core.config import get_settings

    settings = get_settings()
    if settings.trust_all_proxies:
        return True
    trusted_hosts = {
        h.strip() for h in settings.trusted_proxies.split(",") if h.strip()
    }
    trusted_hosts.update({"127.0.0.1", "::1", "localhost", "testclient"})
    return host in trusted_hosts


def get_client_ip(request: Request) -> str:
    """Retrieve client IP address, trusting proxy headers only from trusted proxies."""
    peer_host = (
        request.client.host if request.client and request.client.host else "127.0.0.1"
    )

    if is_trusted_proxy(peer_host):
        forwarded = request.headers.get("x-forwarded-for")
        if forwarded:
            client_ip = forwarded.split(",")[0].strip()
            if client_ip:
                return client_ip
        real_ip = request.headers.get("x-real-ip")
        if real_ip and real_ip.strip():
            return real_ip.strip()

    return peer_host


def get_rate_limit_value() -> str:
    """Dynamically resolve configured rate limit string from application settings."""
    from app.core.config import get_settings

    settings = get_settings()
    return f"{settings.rate_limit_per_minute}/minute"


def create_limiter() -> Limiter:
    """Instantiate SlowAPI limiter with shared storage if REDIS_URL is configured.

    Falls back to memory:// if the configured driver/connection fails.
    """
    from app.core.config import get_settings

    settings = get_settings()
    storage_uri = settings.redis_url if settings.redis_url else "memory://"
    try:
        return Limiter(key_func=get_client_ip, storage_uri=storage_uri)
    except Exception:
        return Limiter(key_func=get_client_ip, storage_uri="memory://")


# Shared Rate Limiter
limiter = create_limiter()

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

# Formula triggering characters for spreadsheet injection defense (OWASP)
CSV_FORMULA_TRIGGERS = ("=", "+", "-", "@", "\t", "\r", "|", "%")


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
        ch
        for ch in normalized
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


def sanitize_csv_cell(value: Any) -> str:
    """Safely format a value for CSV export, preventing formula injection.

    If a text cell begins with =, +, -, @, tab, carriage return, pipe, or %,
    prepends a single quote (') so spreadsheets treat it strictly as text.
    Standard RFC 4180 quotes are applied if commas, quotes, or newlines exist.
    """
    if value is None:
        return ""

    if isinstance(value, (int, float)) and not isinstance(value, bool):
        return str(value)

    raw_str = str(value)
    trimmed = raw_str.lstrip()

    if trimmed and trimmed[0] in CSV_FORMULA_TRIGGERS:
        try:
            float(trimmed)
            is_pure_num = not any(c in trimmed for c in ("=", "@", "\t", "\r", "|"))
        except ValueError:
            is_pure_num = False

        if not is_pure_num or trimmed.startswith(("+", "@", "=", "\t", "\r", "|")):
            raw_str = f"'{raw_str}"

    if any(c in raw_str for c in (",", '"', "\n", "\r")):
        escaped_quotes = raw_str.replace('"', '""')
        return f'"{escaped_quotes}"'

    return raw_str


class SecurityHeadersMiddleware(BaseHTTPMiddleware):
    """Middleware enforcing secure HTTP headers on every response."""

    async def dispatch(
        self, request: Request, call_next: Callable[[Request], Awaitable[Response]]
    ) -> Response:
        response: Response = await call_next(request)
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
