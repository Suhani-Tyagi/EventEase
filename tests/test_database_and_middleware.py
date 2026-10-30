"""Comprehensive unit tests for database, middleware, lifespan, and resilience."""

import os
from datetime import UTC, datetime, timedelta
from typing import Any
from unittest.mock import MagicMock, patch

import pytest
from fastapi import FastAPI, Request
from httpx import ASGITransport, AsyncClient
from sqlalchemy import Engine
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import Session
from sqlalchemy.pool import StaticPool

from app.api.routes import get_llm_client
from app.core.config import Settings, get_settings
from app.core.database import (
    Base,
    DatabaseUnavailableError,
    ensure_db_initialized,
    get_db,
    get_engine,
    get_engine_args,
    get_session_factory,
    init_db,
)
from app.core.security import (
    RequestSizeLimitMiddleware,
    create_limiter,
    is_trusted_proxy,
)
from app.main import create_app, lifespan
from app.models.models import UserSession
from app.services.auth import AuthService
from app.services.budget import _load_budget_templates
from app.services.checklist import _load_checklist_templates
from app.services.ideas import IdeasService, _load_fallback_ideas
from app.services.llm_client import GeminiClient, MockLLMClient
from app.services.timeline import _load_timeline_templates

# ==============================================================================
# Database Engine & Session Tests
# ==============================================================================


def test_database_engine_sqlite_args() -> None:
    """Verify engine arguments for sqlite file vs in-memory."""
    file_args = get_engine_args("sqlite:///./test.db")
    assert file_args.get("connect_args") == {"check_same_thread": False}
    assert "poolclass" not in file_args

    mem_args = get_engine_args("sqlite:///:memory:")
    assert mem_args.get("connect_args") == {"check_same_thread": False}
    assert mem_args.get("poolclass") is StaticPool


def test_database_engine_postgres_args() -> None:
    """Verify engine arguments for PostgreSQL include pool_pre_ping and pool_recycle."""
    pg_args = get_engine_args("postgresql://user:pass@localhost:5432/db")
    assert pg_args.get("pool_pre_ping") is True
    assert pg_args.get("pool_recycle") == 300


def test_database_get_engine_sqlite_memory() -> None:
    """Verify get_engine creates SQLite engine in non-Vercel environment."""
    get_engine.cache_clear()
    with patch.dict(os.environ, {"DATABASE_URL": "sqlite:///:memory:"}, clear=False):
        os.environ.pop("VERCEL", None)
        get_settings.cache_clear()
        engine = get_engine()
        assert isinstance(engine, Engine)
        assert "sqlite" in str(engine.url)
    get_engine.cache_clear()
    get_settings.cache_clear()


def test_database_get_engine_vercel_sqlite_rejected() -> None:
    """Verify get_engine raises DatabaseUnavailableError if SQLite is used on Vercel."""
    get_engine.cache_clear()
    with patch.dict(
        os.environ,
        {"VERCEL": "1", "DATABASE_URL": "sqlite:///./eventease.db"},
        clear=False,
    ):
        get_settings.cache_clear()
        with pytest.raises(DatabaseUnavailableError) as exc_info:
            get_engine()
        assert "Vercel deployments require a persistent PostgreSQL DATABASE_URL" in str(
            exc_info.value
        )
    get_engine.cache_clear()
    get_settings.cache_clear()


def test_database_url_normalization() -> None:
    """Verify postgres URL prefixes are normalized to postgresql+psycopg driver."""
    test_urls = [
        (
            "postgres://user:pass@host:5432/db",
            "postgresql+psycopg://user:pass@host:5432/db",
        ),
        (
            "postgresql+psycopg2://user:pass@host:5432/db",
            "postgresql+psycopg://user:pass@host:5432/db",
        ),
        (
            "postgresql://user:pass@host:5432/db",
            "postgresql+psycopg://user:pass@host:5432/db",
        ),
    ]
    for raw_url, expected in test_urls:
        get_engine.cache_clear()
        with patch.dict(os.environ, {"DATABASE_URL": raw_url}, clear=False):
            os.environ.pop("VERCEL", None)
            get_settings.cache_clear()
            with patch("app.core.database.create_engine") as mock_create:
                mock_create.return_value = MagicMock(spec=Engine)
                get_engine()
                mock_create.assert_called_once()
                call_url = mock_create.call_args[0][0]
                assert call_url == expected
    get_engine.cache_clear()
    get_settings.cache_clear()


def test_database_engine_creation_error_handling() -> None:
    """Verify get_engine logs error and re-raises if create_engine fails."""
    get_engine.cache_clear()
    with patch.dict(os.environ, {"DATABASE_URL": "postgresql://bad_url"}, clear=False):
        os.environ.pop("VERCEL", None)
        get_settings.cache_clear()
        with patch(
            "app.core.database.create_engine", side_effect=Exception("Driver fail")
        ):
            with pytest.raises(Exception) as exc_info:
                get_engine()
            assert "Driver fail" in str(exc_info.value)
    get_engine.cache_clear()
    get_settings.cache_clear()


def test_database_session_lifecycle(test_engine: Engine) -> None:
    """Verify get_session_factory and get_db generator."""
    factory = get_session_factory(test_engine)
    session = factory()
    assert isinstance(session, Session)
    session.close()

    # Test get_db generator
    with patch("app.core.database.get_session_factory", return_value=factory):
        db_gen = get_db()
        sess = next(db_gen)
        assert isinstance(sess, Session)
        with pytest.raises(StopIteration):
            next(db_gen)


def test_ensure_db_initialized(test_engine: Engine) -> None:
    """Verify ensure_db_initialized executes cleanly and idempotently."""
    ensure_db_initialized(test_engine)
    assert "users" in Base.metadata.tables

    # Second call should be a no-op
    ensure_db_initialized(test_engine)


def test_init_db_error_handling() -> None:
    """Verify init_db logs and re-raises exceptions on metadata creation failure."""
    mock_eng = MagicMock(spec=Engine)
    with patch.object(
        Base.metadata, "create_all", side_effect=SQLAlchemyError("Schema lock error")
    ), pytest.raises(SQLAlchemyError):
        init_db(mock_eng)


# ==============================================================================
# Application Lifespan & Middleware Tests
# ==============================================================================


@pytest.mark.asyncio
async def test_app_lifespan_initialization() -> None:
    """Verify ASGI lifespan initializes database schema and handles notices."""
    test_app = FastAPI()
    with patch("app.main.init_db") as mock_init:
        async with lifespan(test_app):
            mock_init.assert_called_once()

    # Verify notice handling when init_db raises an exception
    with patch(
        "app.main.init_db", side_effect=Exception("Notice: read-only filesystem")
    ):
        async with lifespan(test_app):
            pass  # Should log warning and proceed without crashing


@pytest.mark.asyncio
async def test_app_security_headers(async_client: AsyncClient) -> None:
    """Verify enterprise security headers are enforced on all HTTP responses."""
    response = await async_client.get("/api/health")
    assert response.status_code == 200
    headers = response.headers

    assert headers.get("x-content-type-options") == "nosniff"
    assert headers.get("x-frame-options") == "DENY"
    assert headers.get("referrer-policy") == "strict-origin-when-cross-origin"
    assert "default-src 'self'" in headers.get("content-security-policy", "")
    assert "camera=()" in headers.get("permissions-policy", "")


@pytest.mark.asyncio
async def test_request_size_limit_middleware() -> None:
    """Verify RequestSizeLimitMiddleware rejects oversized request bodies with 413."""
    app = FastAPI()
    app.add_middleware(RequestSizeLimitMiddleware, max_bytes=100)

    @app.post("/test-size")
    async def post_endpoint(request: Request) -> dict[str, str]:
        _ = await request.body()
        return {"status": "ok"}

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        # 1. Payload within limit
        ok_res = await client.post("/test-size", content=b"a" * 50)
        assert ok_res.status_code == 200

        # 2. Payload exceeding limit via Content-Length header
        too_large_res = await client.post(
            "/test-size",
            content=b"a" * 150,
            headers={"Content-Length": "150"},
        )
        assert too_large_res.status_code == 413
        assert "exceeds limit" in too_large_res.json()["detail"]


@pytest.mark.asyncio
async def test_unhandled_exception_handler() -> None:
    """Verify unhandled_exception_handler sanitizes 500 and 503 errors."""
    app = create_app()

    @app.get("/trigger-db-error")
    async def trigger_db_error() -> None:
        raise DatabaseUnavailableError("Storage down")

    @app.get("/trigger-generic-error")
    async def trigger_generic_error() -> None:
        raise RuntimeError("Unexpected internal computation failure")

    transport = ASGITransport(app=app, raise_app_exceptions=False)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        # Test 503 for database unavailability
        res_503 = await client.get("/trigger-db-error")
        assert res_503.status_code == 503
        assert res_503.json()["error"] == "Account storage unavailable"

        # Test 500 for generic runtime exception
        res_500 = await client.get("/trigger-generic-error")
        assert res_500.status_code == 500
        assert res_500.json()["error"] == "Internal Server Error"
        assert "unexpected error" in res_500.json()["detail"]
        assert "computation failure" not in res_500.text  # Sanitized


# ==============================================================================
# Services Edge Cases & Caching Resilience
# ==============================================================================


def test_template_loaders_resilience() -> None:
    """Verify template loaders load clean dict structures."""
    budget_data = _load_budget_templates()
    assert isinstance(budget_data, dict)
    assert "wedding" in budget_data

    timeline_data = _load_timeline_templates()
    assert isinstance(timeline_data, dict)
    assert "wedding" in timeline_data

    checklist_data = _load_checklist_templates()
    assert isinstance(checklist_data, dict)
    assert "wedding" in checklist_data

    ideas_data = _load_fallback_ideas()
    assert isinstance(ideas_data, dict)
    assert "wedding" in ideas_data


@pytest.mark.asyncio
async def test_ideas_service_markdown_fence_stripping(
    sample_wedding_payload: dict[str, Any],
) -> None:
    """Verify IdeasService strips markdown fences from LLM responses."""
    from app.schemas import EventIntakeRequest

    mock_markdown_response = (
        "```json\n"
        "{\n"
        '  "themes": ["A", "B", "C"],\n'
        '  "decor": ["D1", "D2", "D3", "D4"],\n'
        '  "menu": ["M1", "M2", "M3", "M4"],\n'
        '  "activities": ["A1", "A2", "A3", "A4"],\n'
        '  "budget_saving_tips": ["T1", "T2", "T3", "T4"]\n'
        "}\n"
        "```"
    )
    mock_client = MockLLMClient(response_text=mock_markdown_response)
    service = IdeasService(llm_client=mock_client)

    intake = EventIntakeRequest.model_validate(sample_wedding_payload)
    ideas = await service.generate_ideas(intake)

    assert ideas.is_fallback is False
    assert len(ideas.themes) == 3
    assert ideas.themes[0] == "A"


def test_cors_origins_list_property() -> None:
    """Verify cors_origins_list splits and trims comma-separated origins."""
    settings = Settings.model_validate(
        {
            "cors_allowed_origins": (
                "http://localhost:3000 , https://app.example.com , "
            ),
        }
    )
    assert settings.cors_origins_list == [
        "http://localhost:3000",
        "https://app.example.com",
    ]


def test_trusted_proxy_checks() -> None:
    """Verify is_trusted_proxy with trust_all_proxies toggle."""
    assert is_trusted_proxy("127.0.0.1") is True
    assert is_trusted_proxy("localhost") is True
    assert is_trusted_proxy("203.0.113.1") is False

    with patch.dict(os.environ, {"TRUST_ALL_PROXIES": "true"}, clear=False):
        get_settings.cache_clear()
        assert is_trusted_proxy("203.0.113.1") is True
    get_settings.cache_clear()


def test_create_limiter_fallback() -> None:
    """Verify create_limiter falls back to memory:// on invalid storage URI."""
    with patch.dict(
        os.environ, {"REDIS_URL": "invalid-driver://nowhere:1234"}, clear=False
    ):
        get_settings.cache_clear()
        lim = create_limiter()
        assert lim is not None
    get_settings.cache_clear()


@pytest.mark.asyncio
async def test_auth_service_edge_cases(test_engine: Engine) -> None:
    """Verify AuthService invalid tokens, expired sessions, and password recovery."""
    service = AuthService()
    factory = get_session_factory(test_engine)

    with factory() as db:
        # 1. Invalid or empty session token returns None
        assert service.get_session_user(db, "") is None
        assert service.get_session_user(db, "nonexistent-token-12345") is None

        # 2. Terminate session with empty or nonexistent token
        assert service.terminate_session(db, "") is False
        assert service.terminate_session(db, "nonexistent-token-12345") is False

        # 3. Create user and verify duplicate email check
        user = service.create_user(db, "edge_user@example.com", "Password123!")
        assert user.email == "edge_user@example.com"

        with pytest.raises(ValueError) as dup_err:
            service.create_user(db, "edge_user@example.com", "Password123!")
        assert "already exists" in str(dup_err.value)

        # 4. Authenticate user and test expired session cleanup
        user, raw_token, csrf = service.authenticate_user(
            db, "edge_user@example.com", "Password123!"
        )
        assert raw_token is not None

        # Expire session artificially
        user_sess = db.query(UserSession).first()
        assert user_sess is not None
        user_sess.expires_at = datetime.now(UTC) - timedelta(days=2)
        db.commit()

        # get_session_user should detect expired session, delete it, and return None
        assert service.get_session_user(db, raw_token) is None

        # 5. Authenticate with bad password raises ValueError
        with pytest.raises(ValueError) as auth_err:
            service.authenticate_user(db, "edge_user@example.com", "WrongPassword!")
        assert "Invalid email or password" in str(auth_err.value)

        # 6. Authenticate with nonexistent email raises ValueError
        with pytest.raises(ValueError) as no_user_err:
            service.authenticate_user(db, "nobody@example.com", "AnyPassword!")
        assert "Invalid email or password" in str(no_user_err.value)

        # 7. Password recovery for unknown email returns None
        assert service.request_password_recovery(db, "nobody@example.com") is None

        # 8. Password reset with empty or invalid token returns False
        assert service.reset_password(db, "", "NewPass123!") is False
        assert service.reset_password(db, "invalid-token", "NewPass123!") is False

        # 9. Password reset with expired token returns False
        raw_reset = service.request_password_recovery(db, "edge_user@example.com")
        assert raw_reset is not None
        user.reset_token_expires_at = datetime.now(UTC) - timedelta(hours=2)
        db.commit()
        assert service.reset_password(db, raw_reset, "NewPassword456!") is False


@pytest.mark.asyncio
async def test_mock_llm_client_branches() -> None:
    """Verify MockLLMClient handles timeout, error, and unconfigured flags."""
    timeout_client = MockLLMClient(raise_timeout=True)
    with pytest.raises(TimeoutError):
        await timeout_client.generate_json("prompt", "instruction")

    error_client = MockLLMClient(raise_error=True)
    with pytest.raises(RuntimeError):
        await error_client.generate_json("prompt", "instruction")

    unconfigured_client = MockLLMClient(is_configured_value=False)
    assert unconfigured_client.is_configured is False


def test_get_llm_client_default_provider() -> None:
    """Verify get_llm_client dependency provider creates GeminiClient."""
    settings = get_settings()
    client = get_llm_client(settings)
    assert isinstance(client, GeminiClient)


@pytest.mark.asyncio
async def test_auth_routes_error_branches(async_client: AsyncClient) -> None:
    """Verify error branches in auth routes."""
    # 1. Signup storage unavailable exception
    with patch.object(
        AuthService, "create_user", side_effect=DatabaseUnavailableError("DB down")
    ):
        res = await async_client.post(
            "/api/auth/signup",
            json={"email": "dberr@example.com", "password": "Password123!"},
        )
        assert res.status_code == 503
        assert "Account storage is unavailable" in res.json()["detail"]

    # 2. Signin unexpected internal exception
    with patch.object(
        AuthService, "authenticate_user", side_effect=Exception("Auth crypto crash")
    ):
        res = await async_client.post(
            "/api/auth/signin",
            json={"email": "crypto@example.com", "password": "Password123!"},
        )
        assert res.status_code == 500
        assert "temporarily unavailable" in res.json()["detail"]


@pytest.mark.asyncio
async def test_event_routes_error_branches(async_client: AsyncClient) -> None:
    """Verify error branches and fallback parsing in event routes."""
    from app.api.event_routes import format_event_detail
    from app.models.models import EventPlanModel

    # 1. Signup user
    signup_res = await async_client.post(
        "/api/auth/signup",
        json={"email": "event_err_user@example.com", "password": "Password123!"},
    )
    cookie = f"eventease_session={signup_res.cookies.get('eventease_session')}"
    csrf_token = signup_res.json()["csrf_token"]
    headers = {"Cookie": cookie, "x-csrf-token": csrf_token}

    # 2. 404 on non-existent event routes
    not_found_id = "00000000-0000-0000-0000-000000000000"
    get_res = await async_client.get(f"/api/events/{not_found_id}", headers=headers)
    assert get_res.status_code == 404

    dup_res = await async_client.post(
        f"/api/events/{not_found_id}/duplicate", headers=headers
    )
    assert dup_res.status_code == 404

    del_res = await async_client.delete(f"/api/events/{not_found_id}", headers=headers)
    assert del_res.status_code == 404

    put_res = await async_client.put(
        f"/api/events/{not_found_id}",
        json={"name": "Updated Name"},
        headers=headers,
    )
    assert put_res.status_code == 404

    # 3. Test format_event_detail with corrupted JSON string
    now = datetime.now(UTC)
    corrupt_event = EventPlanModel(
        id="test-corrupt-id",
        user_id="user-123",
        name="Corrupted Event",
        event_type="wedding",
        date="2026-12-31",
        guest_count=100,
        total_budget=50000.0,
        currency="USD",
        city="New York",
        theme="Rustic",
        cultural_dietary_preferences="Vegan",
        special_notes="None",
        created_at=now,
        updated_at=now,
        plan_data="NOT_VALID_JSON{{{",
    )
    formatted = format_event_detail(corrupt_event)
    assert formatted.plan_data == {}
    assert formatted.id == "test-corrupt-id"
