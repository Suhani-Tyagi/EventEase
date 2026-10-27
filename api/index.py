"""Vercel serverless entrypoint for EventEase FastAPI application."""

import os
import sys
import traceback

# Ensure project root is in sys.path for Vercel serverless execution
CURRENT_DIR = os.path.dirname(os.path.abspath(__file__))
PROJECT_ROOT = os.path.dirname(CURRENT_DIR)
if PROJECT_ROOT not in sys.path:
    sys.path.insert(0, PROJECT_ROOT)

startup_error: str | None = None
startup_trace: list[str] = []

try:
    from app.main import app
except Exception as exc:
    startup_error = str(exc)
    startup_trace = traceback.format_exc().splitlines()

    from fastapi import FastAPI
    from fastapi.responses import JSONResponse

    app = FastAPI(title="EventEase Startup Error")

    @app.api_route("/{path_name:path}", methods=["GET", "POST", "PUT", "DELETE"])
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
