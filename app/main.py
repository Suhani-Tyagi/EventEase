"""FastAPI application factory for EventEase."""

import logging
from pathlib import Path
from typing import Any

from fastapi import FastAPI, Request, status
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.gzip import GZipMiddleware
from fastapi.responses import FileResponse, JSONResponse
from fastapi.staticfiles import StaticFiles
from slowapi.errors import RateLimitExceeded
from starlette.exceptions import HTTPException as StarletteHTTPException

from app.api.routes import router as api_router
from app.core.config import get_settings
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
        allow_methods=["GET", "POST", "OPTIONS"],
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
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
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
        # Log error securely without client PII
        logger.error("Unhandled server exception: %s", str(exc), exc_info=True)
        return JSONResponse(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            content={
                "error": "Internal Server Error",
                "detail": "An unexpected error occurred. Please try again later.",
            },
        )

    # Mount static assets if directory exists
    if STATIC_DIR.exists():
        app.mount(
            "/static",
            StaticFiles(directory=str(STATIC_DIR), html=False),
            name="static",
        )

    # Serve index.html template at root
    @app.get("/", include_in_schema=False)
    async def index() -> FileResponse:
        index_file = TEMPLATES_DIR / "index.html"
        response = FileResponse(index_file)
        response.headers["Cache-Control"] = "public, max-age=3600"
        return response

    # Include API routes
    app.include_router(api_router)

    return app


app = create_app()
