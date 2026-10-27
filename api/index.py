"""Vercel serverless entrypoint for EventEase FastAPI application."""

import os
import sys

# Ensure project root is in sys.path for Vercel serverless execution
CURRENT_DIR = os.path.dirname(os.path.abspath(__file__))
PROJECT_ROOT = os.path.dirname(CURRENT_DIR)
if PROJECT_ROOT not in sys.path:
    sys.path.insert(0, PROJECT_ROOT)

from app.main import app  # noqa: E402

# Vercel ASGI application handler
app = app
