"""Integration tests for all HTTP API endpoints."""

from typing import Any

import pytest
from fastapi import status
from httpx import AsyncClient


@pytest.mark.asyncio
async def test_api_health(async_client: AsyncClient) -> None:
    """Ensure /api/health returns healthy status."""
    response = await async_client.get("/api/health")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "healthy"
    assert data["service"] == "EventEase"


@pytest.mark.asyncio
async def test_api_presets(async_client: AsyncClient) -> None:
    """Ensure /api/presets returns wedding, birthday, and community presets."""
    response = await async_client.get("/api/presets")
    assert response.status_code == 200
    data = response.json()
    assert "wedding" in data
    assert "birthday" in data
    assert "community" in data
    assert data["wedding"]["guest_count"] == 120


@pytest.mark.asyncio
async def test_api_budget_success(
    async_client: AsyncClient, sample_wedding_payload: dict[str, Any]
) -> None:
    """Ensure /api/budget calculates deterministic budget plan."""
    response = await async_client.post("/api/budget", json=sample_wedding_payload)
    assert response.status_code == 200
    data = response.json()
    assert data["total_budget"] == 20000.0
    assert data["cost_per_guest"] == 200.0
    assert data["realistic"] is True
    assert len(data["items"]) > 0


@pytest.mark.asyncio
async def test_api_timeline_success(
    async_client: AsyncClient, sample_wedding_payload: dict[str, Any]
) -> None:
    """Ensure /api/timeline generates milestones."""
    response = await async_client.post("/api/timeline", json=sample_wedding_payload)
    assert response.status_code == 200
    data = response.json()
    assert data["days_remaining"] == 180
    assert len(data["milestones"]) > 0


@pytest.mark.asyncio
@pytest.mark.parametrize("event_type", ["wedding", "birthday", "community"])
async def test_api_checklist_success(
    async_client: AsyncClient, event_type: str
) -> None:
    """Ensure /api/checklist/{event_type} returns categorized tasks."""
    response = await async_client.get(f"/api/checklist/{event_type}")
    assert response.status_code == 200
    data = response.json()
    assert data["event_type"] == event_type
    assert len(data["tasks"]) > 0


@pytest.mark.asyncio
async def test_api_ideas_success(
    async_client: AsyncClient, sample_wedding_payload: dict[str, Any]
) -> None:
    """Ensure /api/ideas returns structured ideas."""
    response = await async_client.post("/api/ideas", json=sample_wedding_payload)
    assert response.status_code == 200
    data = response.json()
    assert len(data["themes"]) == 3
    assert len(data["decor"]) == 4
    assert len(data["menu"]) == 4


@pytest.mark.asyncio
async def test_api_full_plan_success(
    async_client: AsyncClient, sample_wedding_payload: dict[str, Any]
) -> None:
    """Ensure /api/plan returns complete plan with all 4 deliverables."""
    response = await async_client.post("/api/plan", json=sample_wedding_payload)
    assert response.status_code == 200
    data = response.json()
    assert "intake" in data
    assert "budget" in data
    assert "timeline" in data
    assert "checklist" in data
    assert "ideas" in data
    assert "generated_at" in data
    assert data["budget"]["cost_per_guest"] == 200.0


@pytest.mark.asyncio
async def test_api_validation_error_format(async_client: AsyncClient) -> None:
    """Ensure invalid payloads return standardized 422 JSON error messages."""
    invalid_payload = {
        "event_type": "invalid_type",
        "date": "2020-01-01",  # Past date
        "guest_count": -5,  # Negative count
        "total_budget": -100,  # Negative budget
        "city": "X",  # Too short
    }
    response = await async_client.post("/api/budget", json=invalid_payload)
    assert response.status_code == 422
    data = response.json()
    assert data["error"] == "Validation Error"
    assert "errors" in data
    assert len(data["errors"]) > 0


@pytest.mark.asyncio
async def test_checklist_invalid_event_type(async_client: AsyncClient) -> None:
    """Ensure invalid event types for checklist return 422."""
    response = await async_client.get("/api/checklist/festival")
    assert response.status_code == 422


@pytest.mark.asyncio
async def test_root_serves_html(async_client: AsyncClient) -> None:
    """Ensure root path / serves index.html."""
    response = await async_client.get("/")
    assert response.status_code == 200
    assert "text/html" in response.headers["content-type"]


@pytest.mark.asyncio
@pytest.mark.parametrize("route", ["/index.html", "/api/index.py", "/api/index"])
async def test_serverless_index_aliases(async_client: AsyncClient, route: str) -> None:
    """Ensure serverless root aliases serve index.html."""
    response = await async_client.get(route)
    assert response.status_code == 200
    assert "text/html" in response.headers["content-type"]


@pytest.mark.asyncio
async def test_api_root(async_client: AsyncClient) -> None:
    """Ensure /api returns service metadata."""
    response = await async_client.get("/api")
    assert response.status_code == 200
    data = response.json()
    assert data["service"] == "EventEase API"
    assert data["status"] == "active"


@pytest.mark.asyncio
async def test_http_404_error_handler(async_client: AsyncClient) -> None:
    """Ensure 404 responses return standardized JSON error format."""
    response = await async_client.get("/api/nonexistent-route")
    assert response.status_code == status.HTTP_404_NOT_FOUND
    data = response.json()
    assert data["error"] == "HTTP Error"
    assert "Not Found" in data["detail"]
