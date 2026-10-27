"""Unit tests for deterministic budget planning logic."""

import pytest

from app.schemas import EventType
from app.services.budget import calculate_budget

EVENT_TYPES = [EventType.WEDDING, EventType.BIRTHDAY, EventType.COMMUNITY]


@pytest.mark.parametrize("event_type", EVENT_TYPES)
def test_budget_percentages_sum_to_100(event_type: EventType) -> None:
    """Ensure every event type template percentages strictly sum to 100%."""
    plan = calculate_budget(
        event_type=event_type,
        total_budget=10000.0,
        guest_count=50,
        currency="USD",
    )
    total_pct = sum(item.percentage for item in plan.items)
    assert pytest.approx(total_pct, rel=1e-5) == 100.0


@pytest.mark.parametrize("event_type", EVENT_TYPES)
def test_allocated_amounts_sum_to_total_budget(event_type: EventType) -> None:
    """Ensure sum of allocated item amounts strictly matches input total budget."""
    total_budget = 15783.45
    plan = calculate_budget(
        event_type=event_type,
        total_budget=total_budget,
        guest_count=75,
        currency="EUR",
    )
    sum_amounts = sum(item.amount for item in plan.items)
    assert pytest.approx(sum_amounts, abs=0.01) == total_budget


def test_contingency_fund_percentage_in_range() -> None:
    """Ensure contingency reserve is between 5% and 10% across all templates."""
    for event_type in EventType:
        plan = calculate_budget(
            event_type=event_type,
            total_budget=25000.0,
            guest_count=100,
            currency="USD",
        )
        contingency_items = [
            item for item in plan.items if "contingency" in item.category.lower()
        ]
        assert len(contingency_items) == 1
        pct = contingency_items[0].percentage
        assert 5.0 <= pct <= 10.0


def test_realistic_budget_check() -> None:
    """Ensure realistic flag is True for adequate per-guest budgets."""
    plan = calculate_budget(
        event_type=EventType.WEDDING,
        total_budget=30000.0,
        guest_count=100,  # $300/guest > $75 benchmark
        currency="USD",
    )
    assert plan.realistic is True
    assert plan.warning is None
    assert plan.cost_per_guest == 300.0


def test_unrealistic_budget_warning_triggered() -> None:
    """Ensure warning is produced when per-guest budget falls below benchmark."""
    plan = calculate_budget(
        event_type=EventType.WEDDING,
        total_budget=2000.0,
        guest_count=100,  # $20/guest < $75 benchmark
        currency="USD",
    )
    assert plan.realistic is False
    assert plan.warning is not None
    assert "Budget alert" in plan.warning
    assert plan.cost_per_guest == 20.0


def test_budget_edge_case_single_guest() -> None:
    """Ensure budget planner functions cleanly for 1 attendee."""
    plan = calculate_budget(
        event_type=EventType.BIRTHDAY,
        total_budget=500.0,
        guest_count=1,
        currency="USD",
    )
    assert plan.cost_per_guest == 500.0
    assert plan.realistic is True


def test_budget_edge_case_max_guests() -> None:
    """Ensure budget planner functions for 10,000 community attendees."""
    plan = calculate_budget(
        event_type=EventType.COMMUNITY,
        total_budget=200000.0,
        guest_count=10000,
        currency="GBP",
    )
    assert plan.cost_per_guest == 20.0
    assert plan.realistic is True
    assert plan.currency == "GBP"
