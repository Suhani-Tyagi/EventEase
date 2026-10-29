from datetime import UTC, date, datetime, timedelta
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, Request, status

from app.core.config import Settings, get_settings
from app.core.security import get_rate_limit_value, limiter
from app.schemas import (
    BudgetPlan,
    EventIntakeRequest,
    EventType,
    FullEventPlan,
    PersonalizedIdeas,
    TimelinePlan,
    VendorChecklist,
)
from app.services.budget import calculate_budget
from app.services.checklist import get_vendor_checklist
from app.services.ideas import IdeasService
from app.services.llm_client import GeminiClient, LLMClientProtocol
from app.services.timeline import generate_timeline

router = APIRouter(prefix="/api", tags=["Event Planning"])


def get_llm_client(
    settings: Settings = Depends(get_settings),
) -> LLMClientProtocol:
    """Dependency injector for LLM client."""
    return GeminiClient(
        api_key=settings.gemini_api_key,
        model=settings.gemini_model,
        timeout_seconds=settings.llm_timeout_seconds,
        max_retries=settings.llm_max_retries,
    )


def get_ideas_service(
    client: LLMClientProtocol = Depends(get_llm_client),
    settings: Settings = Depends(get_settings),
) -> IdeasService:
    """Dependency injector for IdeasService."""
    return IdeasService(
        llm_client=client,
        cache_ttl_seconds=settings.cache_ttl_seconds,
    )


@router.get("/health", summary="Service health status")
async def health_check(
    settings: Settings = Depends(get_settings),
) -> dict[str, Any]:
    """Health check reporting service status, rate limits, and AI mode."""
    has_gemini = bool(settings.gemini_api_key and settings.gemini_api_key.strip())
    return {
        "status": "healthy",
        "service": "EventEase",
        "ai_mode": "live" if has_gemini else "offline_fallback",
        "gemini_configured": has_gemini,
        "rate_limit": f"{settings.rate_limit_per_minute}/minute",
    }


@router.get("/presets", summary="Get sample demonstration scenarios")
async def get_presets() -> dict[str, Any]:
    """Return pre-configured sample scenarios for one-click testing."""
    today = date.today()
    return {
        "wedding": {
            "name": "Romantic Vineyard Wedding",
            "event_type": "wedding",
            "date": (today + timedelta(days=240)).isoformat(),
            "guest_count": 120,
            "total_budget": 28000.0,
            "currency": "USD",
            "city": "Napa Valley, CA",
            "theme": "Earthy Rustic Elegance & Candlelight",
            "cultural_dietary_preferences": (
                "Vegetarian & gluten-free options, Italian family style"
            ),
            "special_notes": (
                "Outdoor sunset ceremony followed by covered pavilion reception"
            ),
        },
        "birthday": {
            "name": "Milestone 30th Rooftop Glow Party",
            "event_type": "birthday",
            "date": (today + timedelta(days=45)).isoformat(),
            "guest_count": 40,
            "total_budget": 3500.0,
            "currency": "USD",
            "city": "Austin, TX",
            "theme": "Neon Sunset & Retro Synthwave",
            "cultural_dietary_preferences": (
                "Nut-free desserts, spicy fusion sliders, craft mocktails"
            ),
            "special_notes": (
                "Live DJ setup and high-energy interactive trivia session"
            ),
        },
        "community": {
            "name": "Neighborhood Eco-Arts & Food Festival",
            "event_type": "community",
            "date": (today + timedelta(days=90)).isoformat(),
            "guest_count": 500,
            "total_budget": 9500.0,
            "currency": "USD",
            "city": "Seattle, WA",
            "theme": "Sustainable Living & Community Unity",
            "cultural_dietary_preferences": (
                "Halal, vegan, and local organic food truck partners"
            ),
            "special_notes": (
                "All-ages event in central public park with acoustic stage"
            ),
        },
    }


@router.post(
    "/budget",
    response_model=BudgetPlan,
    summary="Calculate deterministic budget",
)
async def budget_endpoint(request: EventIntakeRequest) -> BudgetPlan:
    """Generate budget breakdown with per-guest metrics and feasibility warnings."""
    return calculate_budget(
        event_type=request.event_type,
        total_budget=request.total_budget,
        guest_count=request.guest_count,
        currency=request.currency,
    )


@router.post(
    "/timeline",
    response_model=TimelinePlan,
    summary="Generate backward-planned timeline",
)
async def timeline_endpoint(request: EventIntakeRequest) -> TimelinePlan:
    """Generate an adaptive milestone schedule backward-planned from event date."""
    return generate_timeline(
        event_date=request.date,
        event_type=request.event_type,
    )


@router.get(
    "/checklist/{event_type}",
    response_model=VendorChecklist,
    summary="Retrieve vendor checklist by event type",
)
async def checklist_endpoint(event_type: EventType) -> VendorChecklist:
    """Retrieve categorized vendor checklist and recommended screening questions."""
    return get_vendor_checklist(event_type=event_type)


@router.post(
    "/ideas",
    response_model=PersonalizedIdeas,
    summary="Generate personalized ideas with GenAI and offline fallback",
)
@limiter.limit(get_rate_limit_value)
async def ideas_endpoint(
    request: Request,
    payload: EventIntakeRequest,
    ideas_service: IdeasService = Depends(get_ideas_service),
) -> PersonalizedIdeas:
    """Generate tailored event themes, decor, menus, activities, and savings tips."""
    _ = request
    return await ideas_service.generate_ideas(payload)


@router.post(
    "/plan",
    response_model=FullEventPlan,
    summary="Generate full comprehensive celebration plan",
)
@limiter.limit(get_rate_limit_value)
async def full_plan_endpoint(
    request: Request,
    payload: EventIntakeRequest,
    ideas_service: IdeasService = Depends(get_ideas_service),
) -> FullEventPlan:
    """Generate all 4 planning deliverables in a single unified response."""
    _ = request
    try:
        budget = calculate_budget(
            event_type=payload.event_type,
            total_budget=payload.total_budget,
            guest_count=payload.guest_count,
            currency=payload.currency,
        )
        timeline = generate_timeline(
            event_date=payload.date,
            event_type=payload.event_type,
        )
        checklist = get_vendor_checklist(event_type=payload.event_type)
        ideas = await ideas_service.generate_ideas(payload)

        return FullEventPlan(
            intake=payload,
            budget=budget,
            timeline=timeline,
            checklist=checklist,
            ideas=ideas,
            generated_at=datetime.now(UTC),
        )
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to generate complete event plan. Please check your inputs.",
        ) from exc
