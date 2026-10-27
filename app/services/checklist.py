"""Vendor checklist generation and management service."""

import json
from pathlib import Path
from typing import Any

from app.schemas import ChecklistStatus, ChecklistTask, EventType, VendorChecklist

DATA_DIR = Path(__file__).resolve().parent.parent / "data"
CHECKLIST_TEMPLATES_FILE = DATA_DIR / "checklist_templates.json"


def _load_checklist_templates() -> dict[str, Any]:
    """Load baseline vendor checklist templates from JSON."""
    with open(CHECKLIST_TEMPLATES_FILE, encoding="utf-8") as f:
        data: dict[str, Any] = json.load(f)
        return data


CHECKLIST_TEMPLATES = _load_checklist_templates()


def get_vendor_checklist(
    event_type: EventType,
    custom_statuses: dict[str, ChecklistStatus] | None = None,
) -> VendorChecklist:
    """Retrieve full vendor checklist for the specified event type."""
    raw_tasks = CHECKLIST_TEMPLATES.get(
        event_type.value, CHECKLIST_TEMPLATES["wedding"]
    )
    status_map = custom_statuses or {}

    tasks: list[ChecklistTask] = []
    for item in raw_tasks:
        task_id = item["id"]
        status = status_map.get(task_id, ChecklistStatus(item.get("status", "to-do")))
        tasks.append(
            ChecklistTask(
                id=task_id,
                category=item["category"],
                vendor_type=item["vendor_type"],
                questions_to_ask=item["questions_to_ask"],
                status=status,
                notes=item.get("notes"),
            )
        )

    return VendorChecklist(event_type=event_type, tasks=tasks)
