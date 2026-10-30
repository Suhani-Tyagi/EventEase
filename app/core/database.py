"""Database connection and session management using SQLAlchemy."""

import logging
import os
import threading
from collections.abc import Generator
from functools import lru_cache

from sqlalchemy import Engine, create_engine
from sqlalchemy.orm import DeclarativeBase, Session, sessionmaker
from sqlalchemy.pool import StaticPool

from app.core.config import get_settings

logger = logging.getLogger("eventease.database")

_db_init_lock = threading.Lock()
_db_initialized: bool = False


class DatabaseUnavailableError(RuntimeError):
    """Raised when account storage cannot be used by this deployment."""


class Base(DeclarativeBase):
    """Base class for all SQLAlchemy declarative models."""

    pass


def get_engine_args(database_url: str) -> dict[str, object]:
    """Return appropriate engine arguments based on database URL."""
    args: dict[str, object] = {}
    if database_url.startswith("sqlite"):
        args["connect_args"] = {"check_same_thread": False}
        if ":memory:" in database_url:
            args["poolclass"] = StaticPool
    else:
        args["pool_pre_ping"] = True
        args["pool_recycle"] = 300
        args["pool_size"] = 5
        args["max_overflow"] = 5
        args["pool_timeout"] = 30
    return args


@lru_cache
def get_engine() -> Engine:
    """Create and return a cached SQLAlchemy Engine."""
    settings = get_settings()
    db_url = settings.database_url

    if os.getenv("VERCEL") and db_url.startswith("sqlite"):
        raise DatabaseUnavailableError(
            "Vercel deployments require a persistent PostgreSQL DATABASE_URL; "
            "SQLite files are not durable across serverless invocations."
        )

    # Use psycopg 3 explicitly: Vercel/Postgres connection strings commonly use
    # postgres:// or postgresql://, while SQLAlchemy otherwise defaults to the
    # psycopg2 driver (which this project does not install).
    if db_url.startswith("postgres://"):
        db_url = db_url.replace("postgres://", "postgresql+psycopg://", 1)
    elif db_url.startswith("postgresql+psycopg2://"):
        db_url = db_url.replace("postgresql+psycopg2://", "postgresql+psycopg://", 1)
    elif db_url.startswith("postgresql://"):
        db_url = db_url.replace("postgresql://", "postgresql+psycopg://", 1)

    engine_args = get_engine_args(db_url)
    try:
        engine = create_engine(db_url, **engine_args)
        schema_name = db_url.split("://")[0]
        logger.info("Initialized database engine with URL schema: %s", schema_name)
        return engine
    except Exception as exc:
        logger.error(
            "Failed to initialize database engine: %s",
            str(exc),
            exc_info=True,
        )
        raise


def get_session_factory(engine: Engine | None = None) -> sessionmaker[Session]:
    """Return a sessionmaker bound to the given or cached engine."""
    eng = engine or get_engine()
    return sessionmaker(autocommit=False, autoflush=False, bind=eng)


def init_db(engine: Engine | None = None) -> None:
    """Initialize database tables from declarative metadata."""
    global _db_initialized
    eng = engine or get_engine()
    # Import models to ensure they are registered with Base.metadata
    from app.models.models import EventPlanModel, User, UserSession  # noqa: F401

    try:
        Base.metadata.create_all(bind=eng)
        _db_initialized = True
        logger.info("Database tables initialized successfully.")
    except Exception as exc:
        logger.error(
            "Database schema initialization failed: %s", str(exc), exc_info=True
        )
        raise


def ensure_db_initialized(engine: Engine | None = None) -> None:
    """Ensure database schema is initialized at least once idempotently."""
    global _db_initialized
    if not _db_initialized:
        with _db_init_lock:
            if not _db_initialized:
                init_db(engine)


def get_db() -> Generator[Session, None, None]:
    """FastAPI dependency yielding a transactional database session."""
    ensure_db_initialized()
    factory = get_session_factory()
    session = factory()
    try:
        yield session
    finally:
        session.close()
