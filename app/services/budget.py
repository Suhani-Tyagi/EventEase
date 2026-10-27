"""Deterministic budget allocation and financial analysis service."""

import json
from pathlib import Path
from typing import Any

from app.schemas import BudgetAllocationItem, BudgetPlan, EventType

DATA_DIR = Path(__file__).resolve().parent.parent / "data"
BUDGET_TEMPLATES_FILE = DATA_DIR / "budget_templates.json"


def _load_budget_templates() -> dict[str, Any]:
    """Load pre-configured budget category templates from JSON."""
    with open(BUDGET_TEMPLATES_FILE, encoding="utf-8") as f:
        data: dict[str, Any] = json.load(f)
        return data


BUDGET_TEMPLATES = _load_budget_templates()


def calculate_budget(
    event_type: EventType,
    total_budget: float,
    guest_count: int,
    currency: str = "USD",
) -> BudgetPlan:
    """Calculate deterministic category breakdown and per-guest metrics.

    Pure function with no external side-effects or AI dependencies.
    """
    template = BUDGET_TEMPLATES.get(event_type.value, BUDGET_TEMPLATES["wedding"])
    min_cost_per_guest = float(template.get("min_cost_per_guest", 50.0))
    cost_per_guest = round(total_budget / guest_count, 2)

    # Check realistic threshold
    realistic = cost_per_guest >= min_cost_per_guest
    warning: str | None = None
    if not realistic:
        warning = (
            f"Budget alert: {currency} {cost_per_guest:,.2f} per guest is below the "
            f"recommended benchmark of {currency} {min_cost_per_guest:,.2f} for a "
            f"{event_type.value}. Consider adjusting headcount, increasing budget, "
            "or prioritizing DIY options."
        )

    # Calculate allocated amounts
    items: list[BudgetAllocationItem] = []
    running_allocated = 0.0
    categories = template["categories"]

    for idx, cat in enumerate(categories):
        pct = float(cat["percentage"])
        # Balance rounding differences on final category to preserve exact total
        if idx == len(categories) - 1:
            amount = round(total_budget - running_allocated, 2)
        else:
            amount = round(total_budget * (pct / 100.0), 2)
            running_allocated += amount

        items.append(
            BudgetAllocationItem(
                category=cat["category"],
                percentage=pct,
                amount=amount,
                description=cat["description"],
            )
        )

    explanation = (
        f"Budget derived using deterministic {event_type.value.capitalize()} "
        "industry baseline. Includes an 8.0% dedicated contingency reserve, "
        f"allocating {currency} {cost_per_guest:,.2f} across {guest_count:,} "
        "planned attendees."
    )

    return BudgetPlan(
        total_budget=round(total_budget, 2),
        currency=currency,
        guest_count=guest_count,
        cost_per_guest=cost_per_guest,
        realistic=realistic,
        warning=warning,
        items=items,
        explanation=explanation,
    )
