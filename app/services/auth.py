"""Authentication and session management service."""

import logging
from datetime import UTC, datetime, timedelta

from sqlalchemy.orm import Session

from app.core.security import (
    generate_secure_token,
    hash_password,
    hash_token,
    verify_password,
)
from app.models.models import User, UserSession

logger = logging.getLogger("eventease.auth")


class AuthService:
    """Service encapsulating user credentials, sessions, and recovery."""

    @staticmethod
    def normalize_email(email: str) -> str:
        """Strip and lowercase email string."""
        return email.strip().lower()

    def create_user(self, db: Session, email: str, password: str) -> User:
        """Register a new user with bcrypt-hashed credentials."""
        norm_email = self.normalize_email(email)
        existing = db.query(User).filter(User.email == norm_email).first()
        if existing:
            raise ValueError("An account with this email address already exists.")

        pwd_hash = hash_password(password)
        user = User(
            email=norm_email,
            password_hash=pwd_hash,
        )
        db.add(user)
        db.commit()
        db.refresh(user)
        logger.info("New user registered successfully: %s", user.id)
        return user

    def authenticate_user(
        self,
        db: Session,
        email: str,
        password: str,
        user_agent: str | None = None,
        ip_address: str | None = None,
        max_age_seconds: int = 604800,
    ) -> tuple[User, str, str]:
        """Verify credentials and issue a new secure session.

        Returns (user, raw_session_token, csrf_token).
        """
        norm_email = self.normalize_email(email)
        user = db.query(User).filter(User.email == norm_email).first()
        if not user or not verify_password(password, user.password_hash):
            raise ValueError("Invalid email or password.")

        raw_session_token = generate_secure_token(32)
        token_hash = hash_token(raw_session_token)
        csrf_token = generate_secure_token(32)
        expires_at = datetime.now(UTC) + timedelta(seconds=max_age_seconds)

        session = UserSession(
            user_id=user.id,
            session_token_hash=token_hash,
            csrf_token=csrf_token,
            expires_at=expires_at,
            user_agent=user_agent[:500] if user_agent else None,
            ip_address=ip_address[:60] if ip_address else None,
        )
        db.add(session)
        db.commit()
        logger.info("Session established for user: %s", user.id)
        return user, raw_session_token, csrf_token

    def get_session_user(
        self, db: Session, raw_session_token: str
    ) -> tuple[User, str] | None:
        """Resolve active user and csrf token from raw session cookie.

        Returns None if session does not exist or has expired.
        """
        if not raw_session_token:
            return None

        token_hash = hash_token(raw_session_token)
        session = (
            db.query(UserSession)
            .filter(UserSession.session_token_hash == token_hash)
            .first()
        )
        if not session:
            return None

        now = datetime.now(UTC)
        # Handle SQLite naive datetimes by ensuring timezone awareness
        exp = session.expires_at
        if exp.tzinfo is None:
            exp = exp.replace(tzinfo=UTC)

        if exp < now:
            logger.info(
                "Purging expired session %s for user %s", session.id, session.user_id
            )
            db.delete(session)
            db.commit()
            return None

        return session.user, session.csrf_token

    def terminate_session(self, db: Session, raw_session_token: str) -> bool:
        """Revoke and delete the active session."""
        if not raw_session_token:
            return False

        token_hash = hash_token(raw_session_token)
        session = (
            db.query(UserSession)
            .filter(UserSession.session_token_hash == token_hash)
            .first()
        )
        if session:
            db.delete(session)
            db.commit()
            logger.info("Session terminated successfully.")
            return True
        return False

    def request_password_recovery(
        self, db: Session, email: str, ttl_minutes: int = 60
    ) -> str | None:
        """Create a password reset token.

        Returns the raw reset token (useful for dev/test environments).
        Always completes without disclosing account existence.
        """
        norm_email = self.normalize_email(email)
        user = db.query(User).filter(User.email == norm_email).first()
        if not user:
            return None

        raw_reset_token = generate_secure_token(32)
        user.reset_token_hash = hash_token(raw_reset_token)
        user.reset_token_expires_at = datetime.now(UTC) + timedelta(minutes=ttl_minutes)
        db.commit()
        logger.info("Generated password reset token for user: %s", user.id)
        return raw_reset_token

    def reset_password(
        self, db: Session, raw_reset_token: str, new_password: str
    ) -> bool:
        """Reset password using a valid reset token and revoke existing sessions."""
        if not raw_reset_token:
            return False

        token_hash = hash_token(raw_reset_token)
        user = db.query(User).filter(User.reset_token_hash == token_hash).first()
        if not user or not user.reset_token_expires_at:
            return False

        now = datetime.now(UTC)
        exp = user.reset_token_expires_at
        if exp.tzinfo is None:
            exp = exp.replace(tzinfo=UTC)

        if exp < now:
            logger.warning(
                "Attempted to reset password with expired token for user %s", user.id
            )
            return False

        user.password_hash = hash_password(new_password)
        user.reset_token_hash = None
        user.reset_token_expires_at = None

        # Revoke all active sessions on password change
        db.query(UserSession).filter(UserSession.user_id == user.id).delete()
        db.commit()
        logger.info(
            "Password successfully updated and sessions revoked for user: %s", user.id
        )
        return True
