"""FastAPI application factory for EventEase."""

import logging
from collections.abc import AsyncIterator
from contextlib import asynccontextmanager
from pathlib import Path
from typing import cast

from fastapi import FastAPI, Request, status
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.gzip import GZipMiddleware
from fastapi.responses import HTMLResponse, JSONResponse
from fastapi.staticfiles import StaticFiles
from slowapi.errors import RateLimitExceeded
from sqlalchemy.exc import SQLAlchemyError
from starlette.exceptions import HTTPException as StarletteHTTPException

from app.api.auth_routes import router as auth_router
from app.api.event_routes import router as event_router
from app.api.routes import router as api_router
from app.core.config import Settings, get_settings
from app.core.database import DatabaseUnavailableError, init_db
from app.core.security import (
    RequestSizeLimitMiddleware,
    SecurityHeadersMiddleware,
    limiter,
)

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
logger = logging.getLogger("eventease")

BASE_DIR = Path(__file__).resolve().parent.parent
STATIC_DIR = BASE_DIR / "static"
TEMPLATES_DIR = BASE_DIR / "templates"


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncIterator[None]:
    """Initialize database schema when the application starts."""
    _ = app
    try:
        init_db()
    except Exception as exc:
        logger.warning(
            "Database initialization on startup encountered notice: %s", str(exc)
        )
    yield


async def rate_limit_handler(request: Request, exc: Exception) -> JSONResponse:
    """Return a stable API response when a client exceeds its request limit."""
    _ = (request, exc)
    return JSONResponse(
        status_code=status.HTTP_429_TOO_MANY_REQUESTS,
        content={
            "error": "Too Many Requests",
            "detail": (
                "Rate limit exceeded. Please wait before submitting another request."
            ),
        },
    )


async def validation_exception_handler(
    request: Request, exc: Exception
) -> JSONResponse:
    """Return field-level validation details without echoing submitted values."""
    _ = request
    validation_error = cast(RequestValidationError, exc)
    errors = [
        {
            "field": " -> ".join(str(item) for item in error.get("loc", [])),
            "message": str(error.get("msg")),
        }
        for error in validation_error.errors()
    ]
    return JSONResponse(
        status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
        content={
            "error": "Validation Error",
            "detail": "Invalid input provided.",
            "errors": errors,
        },
    )


async def http_exception_handler(request: Request, exc: Exception) -> JSONResponse:
    """Serialize framework HTTP errors consistently."""
    _ = request
    http_error = cast(StarletteHTTPException, exc)
    return JSONResponse(
        status_code=http_error.status_code,
        content={"error": "HTTP Error", "detail": http_error.detail},
    )


async def unhandled_exception_handler(request: Request, exc: Exception) -> JSONResponse:
    """Log internal errors and return sanitized API responses."""
    _ = request
    logger.error("Unhandled server exception: %s", str(exc), exc_info=True)
    if isinstance(exc, (DatabaseUnavailableError, SQLAlchemyError)):
        return JSONResponse(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            content={
                "error": "Account storage unavailable",
                "detail": (
                    "Account storage is unavailable. On Vercel, configure "
                    "DATABASE_URL with a reachable PostgreSQL database, then redeploy."
                ),
            },
        )
    return JSONResponse(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        content={
            "error": "Internal Server Error",
            "detail": "An unexpected error occurred. Please try again later.",
        },
    )


def _register_exception_handlers(app: FastAPI) -> None:
    """Register API error serializers on the application."""
    app.add_exception_handler(RateLimitExceeded, rate_limit_handler)
    app.add_exception_handler(RequestValidationError, validation_exception_handler)
    app.add_exception_handler(StarletteHTTPException, http_exception_handler)
    app.add_exception_handler(Exception, unhandled_exception_handler)


def _configure_middleware(app: FastAPI, settings: Settings) -> None:
    """Install security, request-size, compression, and CORS middleware."""
    app.add_middleware(SecurityHeadersMiddleware)
    app.add_middleware(
        RequestSizeLimitMiddleware,
        max_bytes=settings.max_request_body_bytes,
    )
    app.add_middleware(GZipMiddleware, minimum_size=1000)
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origins_list,
        allow_origin_regex=settings.vercel_origin_regex,
        allow_credentials=True,
        allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS", "HEAD"],
        allow_headers=["*"],
    )


def _mount_static_assets(app: FastAPI) -> None:
    """Mount static files from local and serverless deployment paths."""
    static_paths = (
        STATIC_DIR,
        Path.cwd() / "static",
        BASE_DIR / "static",
        Path("/var/task/static"),
    )
    static_path = next((path for path in static_paths if path.exists()), None)
    if static_path is not None:
        app.mount(
            "/static",
            StaticFiles(directory=str(static_path), html=False),
            name="static",
        )


def _register_page_routes(app: FastAPI) -> None:
    """Register the frontend and API root routes."""

    @app.get("/", include_in_schema=False)
    @app.get("/index.html", include_in_schema=False)
    @app.get("/api/index.py", include_in_schema=False)
    @app.get("/api/index", include_in_schema=False)
    async def index() -> HTMLResponse:
        candidates = (
            TEMPLATES_DIR / "index.html",
            Path.cwd() / "templates" / "index.html",
            BASE_DIR / "templates" / "index.html",
            Path("/var/task/templates/index.html"),
            Path("/var/task/index.html"),
        )
        for path in candidates:
            if path.exists():
                return HTMLResponse(
                    content=path.read_text(encoding="utf-8"),
                    headers={"Cache-Control": "no-cache, must-revalidate"},
                )
        return HTMLResponse(
            content="<h1>EventEase: templates/index.html not found</h1>",
            status_code=500,
        )

    @app.get("/api", include_in_schema=False)
    async def api_root() -> dict[str, str]:
        return {"service": "EventEase API", "status": "active", "docs": "/docs"}


def _register_api_routes(app: FastAPI) -> None:
    """Attach application API routers."""
    app.include_router(auth_router)
    app.include_router(event_router)
    app.include_router(api_router)


def create_app() -> FastAPI:
    """Build the configured EventEase ASGI application."""
    settings = get_settings()
    app = FastAPI(
        title="EventEase API",
        description=(
            "GenAI-powered Celebration & Event Planning Assistant for weddings, "
            "birthdays, and community events."
        ),
        version="1.0.0",
        docs_url="/docs",
        redoc_url="/redoc",
        lifespan=lifespan,
    )
    app.state.limiter = limiter

    _configure_middleware(app, settings)
    _register_exception_handlers(app)
    _mount_static_assets(app)
    _register_page_routes(app)
    _register_api_routes(app)
    return app


app = create_app()
