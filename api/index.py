"""Vercel serverless entrypoint for EventEase FastAPI application."""

import os
import sys
import traceback
from typing import Any

# Ensure project root is in sys.path for Vercel serverless execution
CURRENT_DIR = os.path.dirname(os.path.abspath(__file__))
PROJECT_ROOT = os.path.dirname(CURRENT_DIR)
if PROJECT_ROOT not in sys.path:
    sys.path.insert(0, PROJECT_ROOT)

startup_error: str | None = None
startup_trace: list[str] = []

app: Any

try:
    from app.main import app as fastapi_app

    class VercelPathMiddleware:
        """Normalize Vercel serverless routing, rewrite scopes, and forwarded paths."""

        def __init__(self, asgi_app: Any) -> None:
            self.asgi_app = asgi_app

        async def __call__(
            self, scope: dict[str, Any], receive: Any, send: Any
        ) -> None:
            if scope.get("type") in ("http", "websocket"):
                headers = dict(scope.get("headers", []))
                # Inspect headers populated by Vercel's edge proxy in priority order
                forwarded_uri = (
                    headers.get(b"x-forwarded-uri", b"").decode("latin1")
                    or headers.get(b"x-original-url", b"").decode("latin1")
                    or headers.get(b"x-rewrite-url", b"").decode("latin1")
                    or headers.get(b"x-invoke-path", b"").decode("latin1")
                    or headers.get(b"x-matched-path", b"").decode("latin1")
                )
                raw_path = scope.get("path", "")

                target_path = forwarded_uri if forwarded_uri else raw_path
                clean_path = target_path.split("?")[0] if target_path else "/"

                # Handle root, index aliases, and prefixes
                root_aliases = (
                    "",
                    "/",
                    "/api/index.py",
                    "/api/index",
                    "/api/index.py/",
                )
                if clean_path in root_aliases:
                    scope["path"] = "/"
                elif clean_path.startswith("/api/index.py/"):
                    scope["path"] = clean_path[len("/api/index.py"):]
                elif clean_path.startswith("/api/index/"):
                    scope["path"] = clean_path[len("/api/index"):]
                else:
                    scope["path"] = clean_path

                if not scope["path"].startswith("/") and scope["path"]:
                    scope["path"] = "/" + scope["path"]

            await self.asgi_app(scope, receive, send)

    app = VercelPathMiddleware(fastapi_app)

except Exception as exc:
    startup_error = str(exc)
    startup_trace = traceback.format_exc().splitlines()

    from fastapi import FastAPI
    from fastapi.responses import JSONResponse

    fallback_app = FastAPI(title="EventEase Startup Error")

    @fallback_app.api_route(
        "/{path_name:path}", methods=["GET", "POST", "PUT", "DELETE"]
    )
    async def catch_all(path_name: str) -> JSONResponse:
        _ = path_name
        return JSONResponse(
            status_code=500,
            content={
                "error": "Startup Crash",
                "details": startup_error,
                "traceback": startup_trace,
            },
        )

    app = fallback_app
