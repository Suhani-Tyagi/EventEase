"""Pytest configuration and shared test fixtures."""

import os
from collections.abc import AsyncGenerator, Generator
from datetime import date, timedelta

import pytest
from fastapi import FastAPI
from httpx import ASGITransport, AsyncClient
from sqlalchemy import Engine, create_engine
from sqlalchemy.orm import Session, sessionmaker
from sqlalchemy.pool import StaticPool

from app.api.routes import get_llm_client
from app.core.config import Settings, get_settings
from app.core.database import Base, get_db
from app.core.security import limiter
from app.main import create_app
from app.services.llm_client import MockLLMClient

# Ensure test environment variables are active before cached settings load
os.environ["AUTH_RATE_LIMIT_PER_MINUTE"] = "100"
os.environ["RATE_LIMIT_PER_MINUTE"] = "100"
get_settings.cache_clear()


@pytest.fixture(autouse=True)
def reset_rate_limiter() -> Generator[None, None, None]:
    """Reset limiter storage between test runs."""
    limiter.reset()
    yield
    limiter.reset()


@pytest.fixture
def test_settings() -> Settings:
    """Return test settings with rate limits and testing flags."""
    return Settings.model_validate(
        {
            "app_env": "test",
            "gemini_api_key": "test_api_key",
            "rate_limit_per_minute": 100,
            "auth_rate_limit_per_minute": 100,
            "cache_ttl_seconds": 300,
            "database_url": "sqlite:///:memory:",
            "trust_all_proxies": True,
        }
    )


@pytest.fixture
def test_engine() -> Generator[Engine, None, None]:
    """Create in-memory SQLite engine with StaticPool for test isolation."""
    engine = create_engine(
        "sqlite:///:memory:",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    Base.metadata.create_all(bind=engine)
    yield engine
    Base.metadata.drop_all(bind=engine)
    engine.dispose()


@pytest.fixture
def mock_llm_valid() -> MockLLMClient:
    """Return mock LLM client responding with valid structured JSON."""
    response_json = """{
        "themes": [
            "Golden Sunset Romance",
            "Rustic Vineyard Elegance",
            "Candlelit Garden"
        ],
        "decor": [
            "Fairylight ceiling canopy",
            "Baby's breath florals",
            "Brass candleholders",
            "Custom acrylic welcome sign"
        ],
        "menu": [
            "Truffle arancini",
            "Pan-seared sea bass",
            "Churro bar",
            "Signature elderflower spritz"
        ],
        "activities": [
            "Audio guestbook",
            "Live wedding painter",
            "Polaroid photo booth",
            "Sparkler farewell"
        ],
        "budget_saving_tips": [
            "Repurpose ceremony arch flowers",
            "Limit open bar to 2 cocktails",
            "Choose local seasonal florals",
            "Family-style dinner service"
        ]
    }"""
    return MockLLMClient(response_text=response_json)


@pytest.fixture
def mock_llm_malformed() -> MockLLMClient:
    """Return mock LLM client responding with malformed non-JSON text."""
    return MockLLMClient(response_text="Not valid json output from model")


@pytest.fixture
def mock_llm_timeout() -> MockLLMClient:
    """Return mock LLM client simulating request timeouts."""
    return MockLLMClient(raise_timeout=True)


@pytest.fixture
def mock_llm_error() -> MockLLMClient:
    """Return mock LLM client simulating API failure."""
    return MockLLMClient(raise_error=True)


@pytest.fixture
def mock_llm_unconfigured() -> MockLLMClient:
    """Return mock LLM client simulating missing API key."""
    return MockLLMClient(is_configured_value=False)


@pytest.fixture
def app(
    mock_llm_valid: MockLLMClient,
    test_settings: Settings,
    test_engine: Engine,
) -> Generator[FastAPI, None, None]:
    """Create test application instance with injected mock dependencies and DB."""
    session_factory = sessionmaker(autocommit=False, autoflush=False, bind=test_engine)

    def override_get_db() -> Generator[Session, None, None]:
        session = session_factory()
        try:
            yield session
        finally:
            session.close()

    application = create_app()
    application.dependency_overrides[get_settings] = lambda: test_settings
    application.dependency_overrides[get_llm_client] = lambda: mock_llm_valid
    application.dependency_overrides[get_db] = override_get_db
    yield application
    application.dependency_overrides.clear()


@pytest.fixture
async def async_client(app: FastAPI) -> AsyncGenerator[AsyncClient, None]:
    """Async HTTP client for testing API routes."""
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://testserver") as client:
        yield client


@pytest.fixture
def sample_wedding_payload() -> dict[str, object]:
    """Return a valid wedding intake payload."""
    event_date = date.today() + timedelta(days=180)
    return {
        "event_type": "wedding",
        "date": event_date.isoformat(),
        "guest_count": 100,
        "total_budget": 20000.0,
        "currency": "USD",
        "city": "San Francisco, CA",
        "theme": "Modern Botanical",
        "cultural_dietary_preferences": "Vegetarian options, Italian wine",
        "special_notes": "Outdoor garden with tent backup",
    }
