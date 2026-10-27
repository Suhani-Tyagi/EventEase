"""Unit tests for Pydantic schema validation and security boundaries."""

from datetime import date, timedelta

import pytest
from pydantic import ValidationError

from app.schemas import EventIntakeRequest, EventType


def test_valid_event_intake_payload() -> None:
    """Ensure valid payload successfully instantiates EventIntakeRequest."""
    req = EventIntakeRequest(
        event_type=EventType.WEDDING,
        date=date.today() + timedelta(days=90),
        guest_count=150,
        total_budget=25000.0,
        currency="USD",
        city="Chicago, IL",
        theme="Art Deco Glamour",
        cultural_dietary_preferences="Kosher options required",
        special_notes="Need wheelchair accessibility at ceremony site",
    )
    assert req.event_type == EventType.WEDDING
    assert req.guest_count == 150
    assert req.total_budget == 25000.0


def test_past_date_rejected() -> None:
    """Ensure dates in the past are rejected with validation error."""
    past_date = date.today() - timedelta(days=1)
    with pytest.raises(ValidationError) as exc_info:
        EventIntakeRequest(
            event_type=EventType.BIRTHDAY,
            date=past_date,
            guest_count=20,
            total_budget=1000.0,
            city="New York, NY",
        )
    assert "Event date must be in the future" in str(exc_info.value)


def test_today_date_rejected() -> None:
    """Ensure today's date is rejected because planning must be in future."""
    today = date.today()
    with pytest.raises(ValidationError) as exc_info:
        EventIntakeRequest(
            event_type=EventType.COMMUNITY,
            date=today,
            guest_count=50,
            total_budget=500.0,
            city="Boston, MA",
        )
    assert "Event date must be in the future" in str(exc_info.value)


@pytest.mark.parametrize("invalid_guest_count", [0, -1, 10001])
def test_guest_count_boundaries(invalid_guest_count: int) -> None:
    """Ensure guest counts outside [1, 10,000] fail validation."""
    future_date = date.today() + timedelta(days=30)
    with pytest.raises(ValidationError):
        EventIntakeRequest(
            event_type=EventType.BIRTHDAY,
            date=future_date,
            guest_count=invalid_guest_count,
            total_budget=1000.0,
            city="Miami, FL",
        )


@pytest.mark.parametrize("invalid_budget", [0, -500.0, 50_000_001.0])
def test_budget_boundaries(invalid_budget: float) -> None:
    """Ensure non-positive budgets or budgets exceeding 50M fail validation."""
    future_date = date.today() + timedelta(days=45)
    with pytest.raises(ValidationError):
        EventIntakeRequest(
            event_type=EventType.COMMUNITY,
            date=future_date,
            guest_count=50,
            total_budget=invalid_budget,
            city="Denver, CO",
        )


def test_reject_extra_fields() -> None:
    """Ensure unknown/unauthorized fields are strictly rejected."""
    future_date = date.today() + timedelta(days=60)
    raw_data = {
        "event_type": "wedding",
        "date": future_date.isoformat(),
        "guest_count": 80,
        "total_budget": 12000.0,
        "city": "Atlanta, GA",
        "unauthorized_admin_flag": True,  # Extra field
    }
    with pytest.raises(ValidationError) as exc_info:
        EventIntakeRequest.model_validate(raw_data)
    assert "extra_forbidden" in str(exc_info.value)


def test_invalid_event_type() -> None:
    """Ensure invalid event type strings are rejected."""
    future_date = date.today() + timedelta(days=30)
    with pytest.raises(ValidationError):
        EventIntakeRequest(
            event_type="anniversary",  # type: ignore[arg-type]
            date=future_date,
            guest_count=30,
            total_budget=2000.0,
            city="Austin, TX",
        )


def test_string_length_limits() -> None:
    """Ensure string fields exceeding designated max lengths fail validation."""
    future_date = date.today() + timedelta(days=30)
    with pytest.raises(ValidationError):
        EventIntakeRequest(
            event_type=EventType.BIRTHDAY,
            date=future_date,
            guest_count=20,
            total_budget=1500.0,
            city="Seattle, WA",
            theme="A" * 121,  # max is 120
        )
