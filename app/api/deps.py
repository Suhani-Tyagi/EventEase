"""Authentication and database dependencies for API routes."""

import logging
from typing import Annotated

from fastapi import Depends, HTTPException, Request, status
from sqlalchemy.orm import Session

from app.core.config import Settings, get_settings
from app.core.database import get_db
from app.models.models import User
from app.services.auth import AuthService
from app.services.events import EventService

logger = logging.getLogger("eventease.deps")


def get_auth_service() -> AuthService:
    """Dependency provider for AuthService."""
    return AuthService()


def get_event_service() -> EventService:
    """Dependency provider for EventService."""
    return EventService()


def get_current_user_and_csrf(
    request: Request,
    db: Annotated[Session, Depends(get_db)],
    settings: Annotated[Settings, Depends(get_settings)],
    auth_service: Annotated[AuthService, Depends(get_auth_service)],
) -> tuple[User, str]:
    """Resolve user and active session CSRF token from HTTP-only cookie."""
    token = request.cookies.get(settings.session_cookie_name)
    if not token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication required. Please sign in.",
        )

    resolved = auth_service.get_session_user(db, token)
    if not resolved:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Session has expired or is invalid. Please sign in again.",
        )

    return resolved


def get_current_user(
    user_and_csrf: Annotated[tuple[User, str], Depends(get_current_user_and_csrf)],
) -> User:
    """Convenience dependency providing the authenticated User model."""
    return user_and_csrf[0]


def require_csrf_token(
    request: Request,
    user_and_csrf: Annotated[tuple[User, str], Depends(get_current_user_and_csrf)],
) -> None:
    """Verify CSRF token for state-changing HTTP requests."""
    if request.method in ("POST", "PUT", "DELETE", "PATCH"):
        provided_csrf = request.headers.get("x-csrf-token")
        expected_csrf = user_and_csrf[1]
        if not provided_csrf or provided_csrf != expected_csrf:
            logger.warning(
                "CSRF validation failed for user %s on %s %s",
                user_and_csrf[0].id,
                request.method,
                request.url.path,
            )
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Invalid or missing CSRF token.",
            )
