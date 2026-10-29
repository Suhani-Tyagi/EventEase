"""Event persistence and management service."""

import json
import logging
from typing import Any

from sqlalchemy.orm import Session

from app.core.security import sanitize_text
from app.models.models import EventPlanModel
from app.schemas import EventIntakeRequest

logger = logging.getLogger("eventease.events")


class EventService:
    """Service handling multi-tenant event persistence and lifecycle."""

    def list_events(self, db: Session, user_id: str) -> list[EventPlanModel]:
        """List all celebration plans owned by user, ordered by recent modification."""
        return (
            db.query(EventPlanModel)
            .filter(EventPlanModel.user_id == user_id)
            .order_by(EventPlanModel.updated_at.desc())
            .all()
        )

    def get_event(
        self, db: Session, user_id: str, event_id: str
    ) -> EventPlanModel | None:
        """Retrieve a specific celebration plan strictly verifying user ownership."""
        return (
            db.query(EventPlanModel)
            .filter(
                EventPlanModel.id == event_id,
                EventPlanModel.user_id == user_id,
            )
            .first()
        )

    def create_event(
        self,
        db: Session,
        user_id: str,
        name: str,
        intake: EventIntakeRequest,
        plan_data: dict[str, Any],
    ) -> EventPlanModel:
        """Persist a new celebration plan for the authenticated user."""
        clean_name = (
            sanitize_text(name, max_length=200)
            or f"{intake.event_type.title()} Celebration"
        )
        event = EventPlanModel(
            user_id=user_id,
            name=clean_name,
            event_type=intake.event_type.value,
            date=intake.date.isoformat(),
            guest_count=intake.guest_count,
            total_budget=intake.total_budget,
            currency=intake.currency,
            city=sanitize_text(intake.city, max_length=100),
            theme=sanitize_text(intake.theme, max_length=200),
            cultural_dietary_preferences=sanitize_text(
                intake.cultural_dietary_preferences, max_length=500
            ),
            special_notes=sanitize_text(intake.special_notes, max_length=500),
            plan_data=json.dumps(plan_data),
        )
        db.add(event)
        db.commit()
        db.refresh(event)
        logger.info("Event %s created successfully for user %s", event.id, user_id)
        return event

    def update_event(
        self,
        db: Session,
        user_id: str,
        event_id: str,
        name: str | None = None,
        intake: EventIntakeRequest | None = None,
        plan_data: dict[str, Any] | None = None,
    ) -> EventPlanModel | None:
        """Update an existing celebration plan, verifying ownership."""
        event = self.get_event(db, user_id, event_id)
        if not event:
            return None

        if name is not None:
            event.name = sanitize_text(name, max_length=200) or event.name

        if intake is not None:
            event.event_type = intake.event_type.value
            event.date = intake.date.isoformat()
            event.guest_count = intake.guest_count
            event.total_budget = intake.total_budget
            event.currency = intake.currency
            event.city = sanitize_text(intake.city, max_length=100)
            event.theme = sanitize_text(intake.theme, max_length=200)
            event.cultural_dietary_preferences = sanitize_text(
                intake.cultural_dietary_preferences, max_length=500
            )
            event.special_notes = sanitize_text(intake.special_notes, max_length=500)

        if plan_data is not None:
            event.plan_data = json.dumps(plan_data)

        db.commit()
        db.refresh(event)
        logger.info("Event %s updated successfully for user %s", event.id, user_id)
        return event

    def duplicate_event(
        self, db: Session, user_id: str, event_id: str
    ) -> EventPlanModel | None:
        """Duplicate an existing celebration plan with a copy designation."""
        original = self.get_event(db, user_id, event_id)
        if not original:
            return None

        dup_name = f"{original.name} (Copy)"
        duplicate = EventPlanModel(
            user_id=user_id,
            name=dup_name[:250],
            event_type=original.event_type,
            date=original.date,
            guest_count=original.guest_count,
            total_budget=original.total_budget,
            currency=original.currency,
            city=original.city,
            theme=original.theme,
            cultural_dietary_preferences=original.cultural_dietary_preferences,
            special_notes=original.special_notes,
            plan_data=original.plan_data,
        )
        db.add(duplicate)
        db.commit()
        db.refresh(duplicate)
        logger.info(
            "Event %s duplicated to %s for user %s",
            original.id,
            duplicate.id,
            user_id,
        )
        return duplicate

    def delete_event(self, db: Session, user_id: str, event_id: str) -> bool:
        """Delete a celebration plan, verifying ownership."""
        event = self.get_event(db, user_id, event_id)
        if not event:
            return False

        db.delete(event)
        db.commit()
        logger.info("Event %s deleted for user %s", event_id, user_id)
        return True
