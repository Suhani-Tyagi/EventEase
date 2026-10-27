"""Unit tests for backward-planned milestone timeline generator."""

from datetime import date, timedelta

import pytest

from app.schemas import EventType
from app.services.timeline import generate_timeline

EVENT_TYPES = [EventType.WEDDING, EventType.BIRTHDAY, EventType.COMMUNITY]


def test_timeline_far_future_wedding() -> None:
    """Ensure far-future dates produce standard uncompressed milestones."""
    ref_date = date(2026, 1, 1)
    event_date = ref_date + timedelta(days=365)  # 1 year out

    plan = generate_timeline(
        event_date=event_date,
        event_type=EventType.WEDDING,
        reference_date=ref_date,
    )

    assert plan.days_remaining == 365
    assert plan.is_compressed is False
    assert plan.advisory is None
    assert len(plan.milestones) > 0

    # Milestones must culminate on event_date
    assert plan.milestones[-1].target_date == event_date
    assert plan.milestones[-1].days_before_event == 0


def test_timeline_medium_compressed() -> None:
    """Ensure timeline between 30 and 90 days sets fast-track advisory."""
    ref_date = date(2026, 1, 1)
    event_date = ref_date + timedelta(days=60)

    plan = generate_timeline(
        event_date=event_date,
        event_type=EventType.WEDDING,
        reference_date=ref_date,
    )

    assert plan.days_remaining == 60
    assert plan.is_compressed is True
    assert plan.advisory is not None
    assert "Fast-Track Timeline" in plan.advisory


def test_timeline_accelerated_near_term() -> None:
    """Ensure timelines under 30 days scale into accelerated phases."""
    ref_date = date(2026, 1, 1)
    event_date = ref_date + timedelta(days=20)

    plan = generate_timeline(
        event_date=event_date,
        event_type=EventType.BIRTHDAY,
        reference_date=ref_date,
    )

    assert plan.days_remaining == 20
    assert plan.is_compressed is True
    assert plan.advisory is not None
    assert "Accelerated Timeline" in plan.advisory

    # All target dates must fall between ref_date and event_date
    for milestone in plan.milestones:
        assert ref_date <= milestone.target_date <= event_date


def test_timeline_same_week_urgent() -> None:
    """Ensure timelines <= 7 days trigger urgent express blitz mode."""
    ref_date = date(2026, 1, 1)
    event_date = ref_date + timedelta(days=5)

    plan = generate_timeline(
        event_date=event_date,
        event_type=EventType.COMMUNITY,
        reference_date=ref_date,
    )

    assert plan.days_remaining == 5
    assert plan.is_compressed is True
    assert plan.advisory is not None
    assert "Urgent Express Timeline" in plan.advisory
    assert plan.milestones[-1].target_date == event_date


@pytest.mark.parametrize("event_type", EVENT_TYPES)
def test_timeline_all_event_types(event_type: EventType) -> None:
    """Ensure all event types generate valid milestone tasks."""
    ref_date = date(2026, 5, 1)
    event_date = ref_date + timedelta(days=120)

    plan = generate_timeline(
        event_date=event_date,
        event_type=event_type,
        reference_date=ref_date,
    )

    assert len(plan.milestones) >= 3
    for milestone in plan.milestones:
        assert len(milestone.tasks) >= 2
        assert len(milestone.period_label) > 0
