"""Authentication and account recovery API endpoints."""

import logging
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Request, Response, status
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import Session

from app.api.deps import get_auth_service, get_current_user, require_csrf_token
from app.core.config import Settings, get_settings
from app.core.database import DatabaseUnavailableError, get_db
from app.core.security import get_auth_rate_limit_value, get_client_ip, limiter
from app.models.models import User
from app.schemas import (
    AuthMessageResponse,
    AuthStatusResponse,
    UserRecoverRequest,
    UserResetPasswordRequest,
    UserResponse,
    UserSignInRequest,
    UserSignUpRequest,
)
from app.services.auth import AuthService

logger = logging.getLogger("eventease.api.auth")
router = APIRouter(prefix="/api/auth", tags=["Authentication"])


def set_auth_cookies(
    response: Response,
    settings: Settings,
    raw_session_token: str,
    csrf_token: str,
) -> None:
    """Set secure HTTP-only session cookie and client-readable CSRF cookie."""
    is_prod = settings.is_production

    response.set_cookie(
        key=settings.session_cookie_name,
        value=raw_session_token,
        httponly=True,
        samesite="lax",
        secure=is_prod,
        max_age=settings.session_max_age_seconds,
        path="/",
    )
    response.set_cookie(
        key=settings.csrf_cookie_name,
        value=csrf_token,
        httponly=False,
        samesite="lax",
        secure=is_prod,
        max_age=settings.session_max_age_seconds,
        path="/",
    )


def clear_auth_cookies(response: Response, settings: Settings) -> None:
    """Clear session and CSRF cookies."""
    is_prod = settings.is_production
    response.delete_cookie(
        key=settings.session_cookie_name,
        httponly=True,
        samesite="lax",
        secure=is_prod,
        path="/",
    )
    response.delete_cookie(
        key=settings.csrf_cookie_name,
        httponly=False,
        samesite="lax",
        secure=is_prod,
        path="/",
    )


@router.post(
    "/signup",
    response_model=AuthStatusResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Create a new user account",
)
@limiter.limit(get_auth_rate_limit_value)
async def signup(
    request: Request,
    response: Response,
    payload: UserSignUpRequest,
    db: Annotated[Session, Depends(get_db)],
    settings: Annotated[Settings, Depends(get_settings)],
    auth_service: Annotated[AuthService, Depends(get_auth_service)],
) -> AuthStatusResponse:
    """Register a new user account and establish an authenticated session."""
    _ = request
    try:
        user = auth_service.create_user(db, payload.email, payload.password)
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=str(exc),
        ) from exc
    except (DatabaseUnavailableError, SQLAlchemyError) as exc:
        logger.error("Signup storage error: %s", str(exc), exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=(
                "Account storage is unavailable. On Vercel, configure "
                "DATABASE_URL with a reachable PostgreSQL database, then redeploy."
            ),
        ) from exc
    except Exception as exc:
        logger.error("Signup error: %s", str(exc), exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Unable to create account. Please try again later.",
        ) from exc

    client_ip = get_client_ip(request)
    user_agent = request.headers.get("user-agent")

    user, raw_session_token, csrf_token = auth_service.authenticate_user(
        db=db,
        email=payload.email,
        password=payload.password,
        user_agent=user_agent,
        ip_address=client_ip,
        max_age_seconds=settings.session_max_age_seconds,
    )

    set_auth_cookies(response, settings, raw_session_token, csrf_token)

    return AuthStatusResponse(
        authenticated=True,
        user=UserResponse(
            id=user.id,
            email=user.email,
            created_at=user.created_at,
        ),
        csrf_token=csrf_token,
    )


@router.post(
    "/signin",
    response_model=AuthStatusResponse,
    summary="Sign in to user account",
)
@limiter.limit(get_auth_rate_limit_value)
async def signin(
    request: Request,
    response: Response,
    payload: UserSignInRequest,
    db: Annotated[Session, Depends(get_db)],
    settings: Annotated[Settings, Depends(get_settings)],
    auth_service: Annotated[AuthService, Depends(get_auth_service)],
) -> AuthStatusResponse:
    """Authenticate credentials and set HTTP-only session cookie."""
    client_ip = get_client_ip(request)
    user_agent = request.headers.get("user-agent")

    try:
        user, raw_session_token, csrf_token = auth_service.authenticate_user(
            db=db,
            email=payload.email,
            password=payload.password,
            user_agent=user_agent,
            ip_address=client_ip,
            max_age_seconds=settings.session_max_age_seconds,
        )
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password.",
        ) from exc
    except Exception as exc:
        logger.error("Signin error: %s", str(exc), exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Authentication service temporarily unavailable.",
        ) from exc

    set_auth_cookies(response, settings, raw_session_token, csrf_token)

    return AuthStatusResponse(
        authenticated=True,
        user=UserResponse(
            id=user.id,
            email=user.email,
            created_at=user.created_at,
        ),
        csrf_token=csrf_token,
    )


@router.post(
    "/signout",
    response_model=AuthMessageResponse,
    summary="Sign out and revoke active session",
)
async def signout(
    request: Request,
    response: Response,
    db: Annotated[Session, Depends(get_db)],
    settings: Annotated[Settings, Depends(get_settings)],
    auth_service: Annotated[AuthService, Depends(get_auth_service)],
) -> AuthMessageResponse:
    """Revoke active session and delete authentication cookies."""
    token = request.cookies.get(settings.session_cookie_name)
    if token:
        try:
            auth_service.terminate_session(db, token)
        except Exception as exc:
            logger.warning("Error revoking session on signout: %s", str(exc))

    clear_auth_cookies(response, settings)
    return AuthMessageResponse(message="Successfully signed out.")


@router.get(
    "/me",
    response_model=AuthStatusResponse,
    summary="Get current user session status",
)
async def get_current_user_status(
    request: Request,
    db: Annotated[Session, Depends(get_db)],
    settings: Annotated[Settings, Depends(get_settings)],
    auth_service: Annotated[AuthService, Depends(get_auth_service)],
) -> AuthStatusResponse:
    """Check if the client has an active session and return user identity."""
    token = request.cookies.get(settings.session_cookie_name)
    if not token:
        return AuthStatusResponse(authenticated=False, user=None, csrf_token=None)

    resolved = auth_service.get_session_user(db, token)
    if not resolved:
        return AuthStatusResponse(authenticated=False, user=None, csrf_token=None)

    user, csrf_token = resolved
    return AuthStatusResponse(
        authenticated=True,
        user=UserResponse(
            id=user.id,
            email=user.email,
            created_at=user.created_at,
        ),
        csrf_token=csrf_token,
    )


@router.delete(
    "/me",
    response_model=AuthMessageResponse,
    summary="Delete current user account",
    dependencies=[Depends(require_csrf_token)],
)
async def delete_current_user(
    request: Request,
    response: Response,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
    settings: Annotated[Settings, Depends(get_settings)],
) -> AuthMessageResponse:
    """Delete authenticated user account, associated sessions, and stored plans."""
    _ = request
    db.delete(current_user)
    db.commit()
    clear_auth_cookies(response, settings)
    return AuthMessageResponse(message="Account successfully deleted.")


@router.post(
    "/recover",
    response_model=AuthMessageResponse,
    summary="Request password recovery instructions",
)
@limiter.limit(get_auth_rate_limit_value)
async def recover_account(
    request: Request,
    payload: UserRecoverRequest,
    db: Annotated[Session, Depends(get_db)],
    settings: Annotated[Settings, Depends(get_settings)],
    auth_service: Annotated[AuthService, Depends(get_auth_service)],
) -> AuthMessageResponse:
    """Request password reset.

    Always returns a generic success message to prevent email enumeration.
    In development/testing environments, provides the reset token for automation.
    """
    _ = request
    raw_token = auth_service.request_password_recovery(db, payload.email)

    is_dev = settings.app_env.lower() in ("development", "test")
    return AuthMessageResponse(
        message=(
            "If that email address is registered, instructions to reset your "
            "password have been generated."
        ),
        reset_token=raw_token if is_dev else None,
    )


@router.post(
    "/reset-password",
    response_model=AuthMessageResponse,
    summary="Reset password using recovery token",
)
@limiter.limit(get_auth_rate_limit_value)
async def reset_password(
    request: Request,
    payload: UserResetPasswordRequest,
    db: Annotated[Session, Depends(get_db)],
    auth_service: Annotated[AuthService, Depends(get_auth_service)],
) -> AuthMessageResponse:
    """Update password using recovery token and revoke all existing sessions."""
    _ = request
    success = auth_service.reset_password(db, payload.token, payload.new_password)
    if not success:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="The password reset token is invalid or has expired.",
        )

    return AuthMessageResponse(
        message=(
            "Password has been reset successfully. "
            "Please sign in with your new credentials."
        )
    )
