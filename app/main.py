"""FastAPI application factory for EventEase."""

import logging
from collections.abc import AsyncIterator
from contextlib import asynccontextmanager
from pathlib import Path
from typing import Any

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
from app.core.config import get_settings
from app.core.database import DatabaseUnavailableError, init_db
from app.core.security import (
    RequestSizeLimitMiddleware,
    SecurityHeadersMiddleware,
    limiter,
)

# Configure logging
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
    """Application lifespan manager to initialize database schema on startup."""
    _ = app
    try:
        init_db()
    except Exception as exc:
        logger.warning(
            "Database initialization on startup encountered notice: %s", str(exc)
        )
    yield


def create_app() -> FastAPI:
    """Create and configure the FastAPI application instance."""
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

    # Attach rate limiter to app state
    app.state.limiter = limiter

    # Security & compression middleware
    app.add_middleware(SecurityHeadersMiddleware)
    app.add_middleware(
        RequestSizeLimitMiddleware,
        max_bytes=settings.max_request_body_bytes,
    )
    app.add_middleware(GZipMiddleware, minimum_size=1000)

    # CORS configuration
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origins_list,
        allow_credentials=True,
        allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS", "HEAD"],
        allow_headers=["*"],
    )

    # Exception Handlers
    @app.exception_handler(RateLimitExceeded)
    async def rate_limit_handler(
        request: Request, exc: RateLimitExceeded
    ) -> JSONResponse:
        _ = (request, exc)
        return JSONResponse(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            content={
                "error": "Too Many Requests",
                "detail": (
                    "Rate limit exceeded. "
                    "Please wait before submitting another request."
                ),
            },
        )

    @app.exception_handler(RequestValidationError)
    async def validation_exception_handler(
        request: Request, exc: RequestValidationError
    ) -> JSONResponse:
        _ = request
        errors: list[dict[str, Any]] = []
        for err in exc.errors():
            loc = " -> ".join(str(item) for item in err.get("loc", []))
            errors.append({"field": loc, "message": str(err.get("msg"))})
        return JSONResponse(
            status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
            content={
                "error": "Validation Error",
                "detail": "Invalid input provided.",
                "errors": errors,
            },
        )

    @app.exception_handler(StarletteHTTPException)
    async def http_exception_handler(
        request: Request, exc: StarletteHTTPException
    ) -> JSONResponse:
        _ = request
        return JSONResponse(
            status_code=exc.status_code,
            content={
                "error": "HTTP Error",
                "detail": exc.detail,
            },
        )

    @app.exception_handler(Exception)
    async def unhandled_exception_handler(
        request: Request, exc: Exception
    ) -> JSONResponse:
        _ = request
        logger.error("Unhandled server exception: %s", str(exc), exc_info=True)
        if isinstance(exc, (DatabaseUnavailableError, SQLAlchemyError)):
            return JSONResponse(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                content={
                    "error": "Account storage unavailable",
                    "detail": (
                        "Account storage is unavailable. On Vercel, configure "
                        "DATABASE_URL with a reachable PostgreSQL database, then "
                        "redeploy."
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

    # Mount static assets if directory exists
    static_paths = [
        STATIC_DIR,
        Path.cwd() / "static",
        Path(__file__).resolve().parent.parent / "static",
        Path("/var/task/static"),
    ]
    for s_path in static_paths:
        if s_path.exists():
            app.mount(
                "/static",
                StaticFiles(directory=str(s_path), html=False),
                name="static",
            )
            break

    # Serve index.html with serverless fallback search
    @app.get("/", include_in_schema=False)
    @app.get("/index.html", include_in_schema=False)
    @app.get("/api/index.py", include_in_schema=False)
    @app.get("/api/index", include_in_schema=False)
    async def index() -> HTMLResponse:
        possible_paths = [
            TEMPLATES_DIR / "index.html",
            Path.cwd() / "templates" / "index.html",
            Path(__file__).resolve().parent.parent / "templates" / "index.html",
            Path("/var/task/templates/index.html"),
            Path("/var/task/index.html"),
        ]
        for path in possible_paths:
            if path.exists():
                content = path.read_text(encoding="utf-8")
                return HTMLResponse(
                    content=content,
                    headers={"Cache-Control": "no-cache, must-revalidate"},
                )
        return HTMLResponse(
            content="<h1>EventEase: templates/index.html not found</h1>",
            status_code=500,
        )

    @app.get("/api", include_in_schema=False)
    async def api_root() -> dict[str, str]:
        return {"service": "EventEase API", "status": "active", "docs": "/docs"}

    # Include API routes
    app.include_router(auth_router)
    app.include_router(event_router)
    app.include_router(api_router)

    return app


app = create_app()
