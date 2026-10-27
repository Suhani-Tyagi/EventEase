"""Backward-planned timeline generator with adaptive compression."""

import json
from datetime import date, timedelta
from pathlib import Path
from typing import Any

from app.schemas import EventType, TimelineMilestone, TimelinePlan

DATA_DIR = Path(__file__).resolve().parent.parent / "data"
TIMELINE_TEMPLATES_FILE = DATA_DIR / "timeline_templates.json"


def _load_timeline_templates() -> dict[str, Any]:
    """Load baseline milestone templates from JSON."""
    with open(TIMELINE_TEMPLATES_FILE, encoding="utf-8") as f:
        data: dict[str, Any] = json.load(f)
        return data


TIMELINE_TEMPLATES = _load_timeline_templates()


def generate_timeline(
    event_date: date,
    event_type: EventType,
    reference_date: date | None = None,
) -> TimelinePlan:
    """Generate a backward-planned milestone schedule.

    Adapts gracefully to available time:
    - Normal schedules preserve full standard intervals.
    - Compressed schedules (<90 days, <30 days, or <7 days) adaptively scale
      milestone target dates to fit between today and event day.
    """
    ref_date = reference_date or date.today()
    days_remaining = (event_date - ref_date).days

    raw_milestones = TIMELINE_TEMPLATES.get(
        event_type.value, TIMELINE_TEMPLATES["wedding"]
    )
    total_stages = len(raw_milestones)

    # Determine compression status and baseline interval
    is_compressed = days_remaining < 90
    advisory: str | None = None

    if days_remaining <= 7:
        is_compressed = True
        advisory = (
            "Urgent Express Timeline: Under 7 days remaining. Tasks are "
            "compressed into daily blitz intervals. Focus immediately on core "
            "vendor locks and confirmations."
        )
    elif days_remaining < 30:
        is_compressed = True
        advisory = (
            "Accelerated Timeline: Less than one month remaining. Milestone "
            "phases have been compressed to ensure crucial bookings occur on time."
        )
    elif days_remaining < 90:
        is_compressed = True
        advisory = (
            "Fast-Track Timeline: Planning window is under 3 months. Tasks are "
            "scheduled in concentrated phases leading up to the celebration."
        )

    milestones: list[TimelineMilestone] = []

    if is_compressed:
        # Scale milestone dates proportionally between today and event date
        for idx, stage in enumerate(raw_milestones):
            if idx == total_stages - 1:
                target_date = event_date
                days_before = 0
            else:
                fraction = idx / (total_stages - 1)
                offset_days = int(days_remaining * fraction)
                target_date = ref_date + timedelta(days=offset_days)
                days_before = max((event_date - target_date).days, 0)

            period_label = (
                f"T-{days_before} Days ({stage['period_label']})"
                if days_before > 0
                else "Event Day"
            )

            milestones.append(
                TimelineMilestone(
                    period_label=period_label,
                    target_date=target_date,
                    days_before_event=days_before,
                    tasks=stage["tasks"],
                    description=stage["description"],
                )
            )
    else:
        # Standard timeline using template days_before
        for stage in raw_milestones:
            days_before = int(stage["days_before"])
            if days_before >= days_remaining:
                target_date = ref_date
                adjusted_days = days_remaining
            else:
                target_date = event_date - timedelta(days=days_before)
                adjusted_days = days_before

            milestones.append(
                TimelineMilestone(
                    period_label=stage["period_label"],
                    target_date=target_date,
                    days_before_event=adjusted_days,
                    tasks=stage["tasks"],
                    description=stage["description"],
                )
            )

    return TimelinePlan(
        event_date=event_date,
        days_remaining=days_remaining,
        is_compressed=is_compressed,
        advisory=advisory,
        milestones=milestones,
    )
