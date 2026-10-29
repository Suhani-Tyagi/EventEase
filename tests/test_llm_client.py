"""Unit tests for LLM client integration and failure fallback paths."""

from datetime import date, timedelta
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from app.schemas import EventIntakeRequest, EventType
from app.services.ideas import IdeasService
from app.services.llm_client import GeminiClient, MockLLMClient


@pytest.fixture
def sample_request() -> EventIntakeRequest:
    """Fixture for intake request."""
    return EventIntakeRequest(
        event_type=EventType.BIRTHDAY,
        date=date.today() + timedelta(days=45),
        guest_count=30,
        total_budget=1500.0,
        currency="USD",
        city="Portland, OR",
        theme="Retro Arcade",
    )


@pytest.mark.asyncio
async def test_llm_client_unconfigured_error() -> None:
    """Ensure GeminiClient raises ValueError when initialized without API key."""
    client = GeminiClient(api_key=None)
    assert client.is_configured is False
    with pytest.raises(ValueError) as exc:
        await client.generate_json("prompt", "instruction")
    assert "GEMINI_API_KEY is not configured" in str(exc.value)


@pytest.mark.asyncio
async def test_gemini_client_success_mocked() -> None:
    """Ensure GeminiClient parses valid response from google-genai SDK."""
    client = GeminiClient(api_key="valid-key", max_retries=0)

    mock_resp = MagicMock()
    mock_resp.text = '{"themes": ["Vintage"]}'

    with patch("app.services.llm_client.genai.Client") as mock_genai_cls:
        mock_instance = MagicMock()
        mock_instance.aio.models.generate_content = AsyncMock(return_value=mock_resp)
        mock_genai_cls.return_value = mock_instance

        res = await client.generate_json("prompt", "instruction")
        assert res == '{"themes": ["Vintage"]}'


@pytest.mark.asyncio
async def test_gemini_client_retries_and_raises_on_persistent_failure() -> None:
    """Ensure GeminiClient retries up to max_retries on error then raises."""
    client = GeminiClient(api_key="valid-key", max_retries=1, timeout_seconds=2.0)

    with patch("app.services.llm_client.genai.Client") as mock_genai_cls:
        mock_instance = MagicMock()
        mock_instance.aio.models.generate_content = AsyncMock(
            side_effect=RuntimeError("SDK Failure")
        )
        mock_genai_cls.return_value = mock_instance

        with pytest.raises(RuntimeError) as exc:
            await client.generate_json("prompt", "instruction")
        assert "Gemini API failed after 2 attempts" in str(exc.value)


@pytest.mark.asyncio
async def test_ideas_service_fallback_on_malformed_json(
    sample_request: EventIntakeRequest,
    mock_llm_malformed: MockLLMClient,
) -> None:
    """Ensure malformed model output triggers graceful fallback to curated ideas."""
    service = IdeasService(llm_client=mock_llm_malformed)
    ideas = await service.generate_ideas(sample_request)

    assert ideas.is_fallback is True
    assert ideas.fallback_reason is not None
    assert "JSONDecodeError" in ideas.fallback_reason
    assert len(ideas.themes) > 0


@pytest.mark.asyncio
async def test_ideas_service_fallback_on_timeout(
    sample_request: EventIntakeRequest,
    mock_llm_timeout: MockLLMClient,
) -> None:
    """Ensure network timeout triggers graceful fallback."""
    service = IdeasService(llm_client=mock_llm_timeout)
    ideas = await service.generate_ideas(sample_request)

    assert ideas.is_fallback is True
    assert ideas.fallback_reason is not None
    assert "TimeoutError" in ideas.fallback_reason
    assert len(ideas.themes) > 0


@pytest.mark.asyncio
async def test_ideas_service_fallback_on_api_error(
    sample_request: EventIntakeRequest,
    mock_llm_error: MockLLMClient,
) -> None:
    """Ensure unexpected API errors trigger graceful fallback."""
    service = IdeasService(llm_client=mock_llm_error)
    ideas = await service.generate_ideas(sample_request)

    assert ideas.is_fallback is True
    assert ideas.fallback_reason is not None
    assert "RuntimeError" in ideas.fallback_reason
    assert len(ideas.themes) > 0
