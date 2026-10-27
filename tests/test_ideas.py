"""Unit tests for IdeasService, caching, and fallback mechanics."""

from datetime import date, timedelta

import pytest

from app.core.security import USER_DATA_END_DELIMITER, USER_DATA_START_DELIMITER
from app.schemas import EventIntakeRequest, EventType
from app.services.ideas import IdeasService
from app.services.llm_client import MockLLMClient


@pytest.fixture
def intake_request() -> EventIntakeRequest:
    """Fixture for intake request model."""
    return EventIntakeRequest(
        event_type=EventType.WEDDING,
        date=date.today() + timedelta(days=120),
        guest_count=100,
        total_budget=20000.0,
        currency="USD",
        city="Napa, CA",
        theme="Rustic Elegance",
        cultural_dietary_preferences="Gluten-free friendly",
        special_notes="Need outdoor acoustic band",
    )


@pytest.mark.asyncio
async def test_ideas_generation_success(
    intake_request: EventIntakeRequest,
    mock_llm_valid: MockLLMClient,
) -> None:
    """Ensure valid LLM response produces parsed PersonalizedIdeas."""
    service = IdeasService(llm_client=mock_llm_valid)
    ideas = await service.generate_ideas(intake_request)

    assert ideas.is_fallback is False
    assert ideas.fallback_reason is None
    assert len(ideas.themes) == 3
    assert len(ideas.decor) == 4
    assert len(ideas.menu) == 4
    assert len(ideas.activities) == 4
    assert len(ideas.budget_saving_tips) == 4


@pytest.mark.asyncio
async def test_ideas_ttl_caching(
    intake_request: EventIntakeRequest,
) -> None:
    """Ensure identical subsequent requests are served from memory cache."""
    call_count = 0

    class CountingMockClient(MockLLMClient):
        async def generate_json(self, prompt: str, system_instruction: str) -> str:
            _ = (prompt, system_instruction)
            nonlocal call_count
            call_count += 1
            return """{
                "themes": ["A", "B", "C"],
                "decor": ["D1", "D2", "D3", "D4"],
                "menu": ["M1", "M2", "M3", "M4"],
                "activities": ["A1", "A2", "A3", "A4"],
                "budget_saving_tips": ["T1", "T2", "T3", "T4"]
            }"""

    client = CountingMockClient()
    service = IdeasService(llm_client=client, cache_ttl_seconds=300)

    # First call: executes LLM
    res1 = await service.generate_ideas(intake_request)
    assert call_count == 1
    assert res1.is_fallback is False

    # Second call with identical input: served from cache
    res2 = await service.generate_ideas(intake_request)
    assert call_count == 1  # No second LLM call
    assert res1.themes == res2.themes


def test_ideas_prompt_construction(intake_request: EventIntakeRequest) -> None:
    """Ensure user inputs are cleanly isolated inside prompt delimiters."""
    service = IdeasService(llm_client=MockLLMClient())
    prompt = service._build_prompt(intake_request)

    assert USER_DATA_START_DELIMITER in prompt
    assert USER_DATA_END_DELIMITER in prompt
    assert "Event Type: wedding" in prompt
    assert "Napa, CA" in prompt
    assert "Rustic Elegance" in prompt


@pytest.mark.asyncio
async def test_ideas_fallback_on_unconfigured_api_key(
    intake_request: EventIntakeRequest,
    mock_llm_unconfigured: MockLLMClient,
) -> None:
    """Ensure missing or unconfigured API key gracefully returns offline fallback."""
    service = IdeasService(llm_client=mock_llm_unconfigured)
    ideas = await service.generate_ideas(intake_request)

    assert ideas.is_fallback is True
    assert ideas.fallback_reason is not None
    assert "Gemini API key is not configured" in ideas.fallback_reason
    assert len(ideas.themes) > 0
    assert len(ideas.decor) > 0
