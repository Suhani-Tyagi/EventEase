"""Unit and integration tests for recent improvements:

1. Serverless public error sanitization without leaking tracebacks.
2. Configured rate-limiting and serverless proxy IP extraction.
3. Bounded IdeasService cache eviction and expired entry purging.
4. Health endpoint dynamic AI mode and rate-limit metadata.
5. Export data consistency and contingency calculation.
"""

from datetime import UTC, datetime
from typing import Any
from unittest.mock import MagicMock

import pytest
from fastapi import Request
from httpx import ASGITransport, AsyncClient

from app.core.config import get_settings
from app.core.security import get_client_ip, get_rate_limit_value
from app.schemas import EventType
from app.services.budget import calculate_budget
from app.services.ideas import IdeasService

# ==============================================================================
# 1. Serverless Error Sanitization (api/index.py)
# ==============================================================================


@pytest.mark.asyncio
async def test_serverless_fallback_sanitizes_errors() -> None:
    """Ensure api/index.py fallback app returns generic 500 without tracebacks."""
    import api.index as serverless_module

    # Create fallback app simulating startup failure
    test_error = RuntimeError("Database connection string leaked: secret_pass_123")
    fallback_app = serverless_module.create_fallback_app(test_error)

    transport = ASGITransport(app=fallback_app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        response = await client.get("/")

        assert response.status_code == 500
        data = response.json()

        # Must return generic user-friendly message
        assert data["error"] == "Internal Server Error"
        assert (
            data["detail"]
            == "The service is temporarily unavailable. Please try again later."
        )

        # Must NEVER leak internal error details or tracebacks
        assert "secret_pass_123" not in response.text
        assert "traceback" not in response.text.lower()
        assert "RuntimeError" not in response.text


# ==============================================================================
# 2. Configured Rate Limiting & Client IP Resolution
# ==============================================================================


def test_get_rate_limit_value_matches_settings() -> None:
    """Ensure get_rate_limit_value dynamically references settings."""
    settings = get_settings()
    expected = f"{settings.rate_limit_per_minute}/minute"
    assert get_rate_limit_value() == expected


def test_get_client_ip_from_x_forwarded_for() -> None:
    """Ensure get_client_ip resolves the first client IP in X-Forwarded-For."""
    scope: dict[str, Any] = {
        "type": "http",
        "headers": [
            (b"x-forwarded-for", b"203.0.113.195, 70.41.3.18, 150.172.238.178"),
        ],
        "client": ("10.0.0.1", 54321),
    }
    request = Request(scope)
    assert get_client_ip(request) == "203.0.113.195"


def test_get_client_ip_from_x_real_ip() -> None:
    """Ensure get_client_ip falls back to X-Real-IP when X-Forwarded-For is absent."""
    scope: dict[str, Any] = {
        "type": "http",
        "headers": [
            (b"x-real-ip", b"198.51.100.42"),
        ],
        "client": ("10.0.0.1", 54321),
    }
    request = Request(scope)
    assert get_client_ip(request) == "198.51.100.42"


def test_get_client_ip_fallback_to_client_host() -> None:
    """Ensure get_client_ip uses client.host when no proxy headers exist."""
    scope: dict[str, Any] = {
        "type": "http",
        "headers": [],
        "client": ("192.168.1.50", 12345),
    }
    request = Request(scope)
    assert get_client_ip(request) == "192.168.1.50"


def test_get_client_ip_fallback_default() -> None:
    """Ensure get_client_ip returns 127.0.0.1 when client info is missing."""
    scope: dict[str, Any] = {
        "type": "http",
        "headers": [],
        "client": None,
    }
    request = Request(scope)
    assert get_client_ip(request) == "127.0.0.1"


# ==============================================================================
# 3. IdeasService Bounded Cache Eviction & Purging
# ==============================================================================


def test_ideas_cache_purge_expired() -> None:
    """Ensure expired cache entries are pruned upon access."""
    service = IdeasService(llm_client=MagicMock(), max_cache_entries=10)
    service._cache.clear()

    now = datetime.now(UTC).timestamp()

    # Insert an expired entry
    service._cache["expired_key"] = (
        {"themes": ["Old"]},
        now - 100,  # Expired in past
    )
    # Insert an unexpired entry
    service._cache["fresh_key"] = (
        {"themes": ["Fresh"]},
        now + 3600,  # Valid for an hour
    )

    assert service.cache_size == 2
    service._purge_expired(now)

    assert service.cache_size == 1
    assert "fresh_key" in service._cache
    assert "expired_key" not in service._cache


def test_ideas_cache_eviction_when_capacity_reached() -> None:
    """Ensure least-recently-expiring items are evicted when cache reaches capacity."""
    service = IdeasService(llm_client=MagicMock(), max_cache_entries=3)
    service._cache.clear()

    now = datetime.now(UTC).timestamp()

    # Add 3 entries up to max capacity
    service._cache["key_early"] = ({"themes": ["Early"]}, now + 50)
    service._cache["key_mid"] = ({"themes": ["Mid"]}, now + 100)
    service._cache["key_late"] = ({"themes": ["Late"]}, now + 200)

    assert service.cache_size == 3

    # Manually trigger eviction
    service._evict_oldest()

    # The entry closest to expiry ("key_early") should be evicted
    assert service.cache_size == 2
    assert "key_early" not in service._cache
    assert "key_mid" in service._cache
    assert "key_late" in service._cache


# ==============================================================================
# 4. Health Endpoint AI Mode and Rate Limit
# ==============================================================================


@pytest.mark.asyncio
async def test_health_endpoint_metadata(async_client: AsyncClient) -> None:
    """Ensure /api/health exposes ai_mode, gemini_configured, and rate_limit."""
    response = await async_client.get("/api/health")
    assert response.status_code == 200
    data = response.json()

    assert data["status"] == "healthy"
    assert "ai_mode" in data
    assert data["ai_mode"] in ("live", "offline_fallback")
    assert "gemini_configured" in data
    assert isinstance(data["gemini_configured"], bool)
    assert data["rate_limit"].endswith("/minute")


# ==============================================================================
# 5. Export Data Consistency & Contingency Calculation
# ==============================================================================


def test_budget_contingency_calculation_from_items() -> None:
    """Ensure contingency reserve amount is calculated accurately from budget items."""
    budget = calculate_budget(
        event_type=EventType.WEDDING,
        total_budget=25000.0,
        guest_count=100,
        currency="USD",
    )

    # Contingency category exists in items
    contingency_items = [
        item
        for item in budget.items
        if "contingency" in item.category.lower()
    ]
    assert len(contingency_items) == 1
    contingency = contingency_items[0]

    # Deterministic 8% buffer
    assert contingency.percentage == 8.0
    expected_amount = round(25000.0 * 0.08, 2)
    assert contingency.amount == expected_amount

    # Sum of all category amounts must equal total budget
    total_allocated = round(sum(i.amount for i in budget.items), 2)
    assert total_allocated == 25000.0

    # Sum of all category percentages must equal 100%
    total_percentage = round(sum(i.percentage for i in budget.items), 1)
    assert total_percentage == 100.0
