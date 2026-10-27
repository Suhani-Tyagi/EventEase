"""Unit tests for vendor checklist logic."""

import pytest

from app.schemas import ChecklistStatus, EventType
from app.services.checklist import get_vendor_checklist

EVENT_TYPES = [EventType.WEDDING, EventType.BIRTHDAY, EventType.COMMUNITY]


@pytest.mark.parametrize("event_type", EVENT_TYPES)
def test_checklist_retrieval(event_type: EventType) -> None:
    """Ensure every event type provides categorized vendor tasks with questions."""
    checklist = get_vendor_checklist(event_type)
    assert checklist.event_type == event_type
    assert len(checklist.tasks) >= 3

    for task in checklist.tasks:
        assert len(task.category) > 0
        assert len(task.vendor_type) > 0
        assert len(task.questions_to_ask) >= 2
        assert task.status == ChecklistStatus.TODO


def test_checklist_custom_status_override() -> None:
    """Ensure custom task status overrides are applied correctly."""
    custom_map = {
        "wed-venue-01": ChecklistStatus.BOOKED,
        "wed-cat-02": ChecklistStatus.CONTACTED,
    }
    checklist = get_vendor_checklist(EventType.WEDDING, custom_statuses=custom_map)

    venue_task = next(t for t in checklist.tasks if t.id == "wed-venue-01")
    cat_task = next(t for t in checklist.tasks if t.id == "wed-cat-02")
    photo_task = next(t for t in checklist.tasks if t.id == "wed-photo-03")

    assert venue_task.status == ChecklistStatus.BOOKED
    assert cat_task.status == ChecklistStatus.CONTACTED
    assert photo_task.status == ChecklistStatus.TODO
