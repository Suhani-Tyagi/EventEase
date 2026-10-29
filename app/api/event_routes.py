"""Event persistence API routes with strict user ownership authorization."""

import json
import logging
from typing import Annotated, Any

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.api.deps import get_current_user, get_event_service, require_csrf_token
from app.core.database import get_db
from app.models.models import EventPlanModel, User
from app.schemas import (
    AuthMessageResponse,
    EventCreateRequest,
    EventDetailResponse,
    EventSummaryResponse,
    EventUpdateRequest,
)
from app.services.events import EventService

logger = logging.getLogger("eventease.api.events")
router = APIRouter(prefix="/api/events", tags=["Saved Events"])


def format_event_detail(event: EventPlanModel) -> EventDetailResponse:
    """Format SQLAlchemy EventPlanModel to Pydantic EventDetailResponse."""
    try:
        plan_dict: dict[str, Any] = json.loads(event.plan_data)
    except Exception:
        plan_dict = {}

    return EventDetailResponse(
        id=event.id,
        name=event.name,
        event_type=event.event_type,
        date=event.date,
        guest_count=event.guest_count,
        total_budget=event.total_budget,
        currency=event.currency,
        city=event.city,
        theme=event.theme,
        cultural_dietary_preferences=event.cultural_dietary_preferences,
        special_notes=event.special_notes,
        plan_data=plan_dict,
        created_at=event.created_at,
        updated_at=event.updated_at,
    )


@router.get(
    "",
    response_model=list[EventSummaryResponse],
    summary="List all celebration plans for authenticated user",
)
async def list_user_events(
    db: Annotated[Session, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
    event_service: Annotated[EventService, Depends(get_event_service)],
) -> list[EventSummaryResponse]:
    """Retrieve all celebration plans owned by the currently authenticated user."""
    events = event_service.list_events(db, current_user.id)
    return [
        EventSummaryResponse(
            id=ev.id,
            name=ev.name,
            event_type=ev.event_type,
            date=ev.date,
            guest_count=ev.guest_count,
            total_budget=ev.total_budget,
            currency=ev.currency,
            city=ev.city,
            created_at=ev.created_at,
            updated_at=ev.updated_at,
        )
        for ev in events
    ]


@router.post(
    "",
    response_model=EventDetailResponse,
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(require_csrf_token)],
    summary="Create and persist a new celebration plan",
)
async def create_user_event(
    payload: EventCreateRequest,
    db: Annotated[Session, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
    event_service: Annotated[EventService, Depends(get_event_service)],
) -> EventDetailResponse:
    """Save a new celebration plan to the database owned by the authenticated user."""
    event = event_service.create_event(
        db=db,
        user_id=current_user.id,
        name=payload.name,
        intake=payload.intake,
        plan_data=payload.plan_data,
    )
    return format_event_detail(event)


@router.get(
    "/{event_id}",
    response_model=EventDetailResponse,
    summary="Retrieve a specific celebration plan by ID",
)
async def get_user_event(
    event_id: str,
    db: Annotated[Session, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
    event_service: Annotated[EventService, Depends(get_event_service)],
) -> EventDetailResponse:
    """Retrieve full details of an event plan.

    Strictly verifies ownership: returns 404 if not found or belongs to another user.
    """
    event = event_service.get_event(db, current_user.id, event_id)
    if not event:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Celebration plan not found.",
        )
    return format_event_detail(event)


@router.put(
    "/{event_id}",
    response_model=EventDetailResponse,
    dependencies=[Depends(require_csrf_token)],
    summary="Update an existing celebration plan",
)
async def update_user_event(
    event_id: str,
    payload: EventUpdateRequest,
    db: Annotated[Session, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
    event_service: Annotated[EventService, Depends(get_event_service)],
) -> EventDetailResponse:
    """Update event plan name, intake parameters, or customized deliverables."""
    event = event_service.update_event(
        db=db,
        user_id=current_user.id,
        event_id=event_id,
        name=payload.name,
        intake=payload.intake,
        plan_data=payload.plan_data,
    )
    if not event:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Celebration plan not found.",
        )
    return format_event_detail(event)


@router.post(
    "/{event_id}/duplicate",
    response_model=EventDetailResponse,
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(require_csrf_token)],
    summary="Duplicate an existing celebration plan",
)
async def duplicate_user_event(
    event_id: str,
    db: Annotated[Session, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
    event_service: Annotated[EventService, Depends(get_event_service)],
) -> EventDetailResponse:
    """Create a copy of an existing celebration plan."""
    duplicate = event_service.duplicate_event(db, current_user.id, event_id)
    if not duplicate:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Celebration plan not found.",
        )
    return format_event_detail(duplicate)


@router.delete(
    "/{event_id}",
    response_model=AuthMessageResponse,
    dependencies=[Depends(require_csrf_token)],
    summary="Delete a celebration plan",
)
async def delete_user_event(
    event_id: str,
    db: Annotated[Session, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
    event_service: Annotated[EventService, Depends(get_event_service)],
) -> AuthMessageResponse:
    """Permanently delete an event plan owned by the authenticated user."""
    success = event_service.delete_event(db, current_user.id, event_id)
    if not success:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Celebration plan not found.",
        )
    return AuthMessageResponse(message="Celebration plan deleted successfully.")
