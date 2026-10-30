"""Unit tests for Authentication, Authorization, and Event Persistence."""

from typing import Any
from unittest.mock import patch

import pytest
from httpx import AsyncClient

from app.core.database import Base, get_engine_args, init_db
from app.core.security import (
    generate_secure_token,
    get_auth_rate_limit_value,
    hash_password,
    hash_token,
    verify_password,
)
from app.models.models import EventPlanModel, User, UserSession
from app.services.auth import AuthService


@pytest.mark.asyncio
async def test_auth_signup_flow(async_client: AsyncClient) -> None:
    """Verify user registration sets session cookies and forbids duplicates."""
    signup_payload = {
        "email": "planner@example.com",
        "password": "Password123!",
    }
    response = await async_client.post("/api/auth/signup", json=signup_payload)
    assert response.status_code == 201
    data = response.json()
    assert data["authenticated"] is True
    assert data["user"]["email"] == "planner@example.com"
    assert data["csrf_token"] is not None

    # Verify session cookie was set
    assert "eventease_session" in response.cookies
    assert "eventease_csrf" in response.cookies

    # Attempt duplicate signup -> should return 409
    dup_res = await async_client.post("/api/auth/signup", json=signup_payload)
    assert dup_res.status_code == 409
    assert "already exists" in dup_res.json()["detail"]


@pytest.mark.asyncio
async def test_auth_signin_and_signout_flow(async_client: AsyncClient) -> None:
    """Verify signin credential check and session termination on signout."""
    # Register user first
    await async_client.post(
        "/api/auth/signup",
        json={"email": "organizer@example.com", "password": "SecurePassword987!"},
    )

    # Valid signin
    signin_res = await async_client.post(
        "/api/auth/signin",
        json={"email": "organizer@example.com", "password": "SecurePassword987!"},
    )
    assert signin_res.status_code == 200
    assert signin_res.json()["authenticated"] is True
    session_cookie = signin_res.cookies.get("eventease_session")
    csrf_cookie = signin_res.cookies.get("eventease_csrf")
    assert session_cookie is not None
    assert csrf_cookie is not None

    # Invalid password -> 401 generic error
    wrong_pwd_res = await async_client.post(
        "/api/auth/signin",
        json={"email": "organizer@example.com", "password": "WrongPassword!"},
    )
    assert wrong_pwd_res.status_code == 401
    assert "Invalid email or password" in wrong_pwd_res.json()["detail"]

    # Non-existent email -> 401 generic error (avoids enumeration)
    non_existent_res = await async_client.post(
        "/api/auth/signin",
        json={"email": "nobody@example.com", "password": "AnyPassword!"},
    )
    assert non_existent_res.status_code == 401
    assert "Invalid email or password" in non_existent_res.json()["detail"]

    # Verify /api/auth/me with active session
    me_res = await async_client.get(
        "/api/auth/me", headers={"Cookie": f"eventease_session={session_cookie}"}
    )
    assert me_res.status_code == 200
    assert me_res.json()["authenticated"] is True
    assert me_res.json()["user"]["email"] == "organizer@example.com"

    # Signout
    signout_res = await async_client.post(
        "/api/auth/signout",
        headers={"Cookie": f"eventease_session={session_cookie}"},
    )
    assert signout_res.status_code == 200
    assert "signed out" in signout_res.json()["message"]

    # Check /api/auth/me after signout -> session revoked
    me_after = await async_client.get(
        "/api/auth/me", headers={"Cookie": f"eventease_session={session_cookie}"}
    )
    assert me_after.status_code == 200
    assert me_after.json()["authenticated"] is False


@pytest.mark.asyncio
async def test_delete_account_flow(async_client: AsyncClient) -> None:
    """Verify authenticated user can delete their account and associated sessions."""
    # Register user
    signup_res = await async_client.post(
        "/api/auth/signup",
        json={"email": "deleteme@example.com", "password": "Password123!"},
    )
    assert signup_res.status_code == 201
    session_cookie = signup_res.cookies.get("eventease_session")
    csrf_token = signup_res.json()["csrf_token"]
    cookie_header = f"eventease_session={session_cookie}"

    # Attempt delete without CSRF -> 403 Forbidden
    no_csrf = await async_client.delete(
        "/api/auth/me",
        headers={"Cookie": cookie_header},
    )
    assert no_csrf.status_code == 403

    # Delete with valid CSRF token -> 200 OK
    del_res = await async_client.delete(
        "/api/auth/me",
        headers={"Cookie": cookie_header, "X-CSRF-Token": csrf_token},
    )
    assert del_res.status_code == 200
    assert "deleted" in del_res.json()["message"]

    # Verify /api/auth/me returns unauthenticated
    me_after = await async_client.get(
        "/api/auth/me",
        headers={"Cookie": cookie_header},
    )
    assert me_after.status_code == 200
    assert me_after.json()["authenticated"] is False

    # Attempt to sign in again -> 401 because user no longer exists
    signin_res = await async_client.post(
        "/api/auth/signin",
        json={"email": "deleteme@example.com", "password": "Password123!"},
    )
    assert signin_res.status_code == 401


@pytest.mark.asyncio
async def test_auth_recovery_and_reset(async_client: AsyncClient) -> None:
    """Verify recovery does not reveal email existence and resets password."""
    # Register user
    await async_client.post(
        "/api/auth/signup",
        json={"email": "recoverme@example.com", "password": "OldPassword123!"},
    )

    # Request recovery for registered email
    recover_res = await async_client.post(
        "/api/auth/recover", json={"email": "recoverme@example.com"}
    )
    assert recover_res.status_code == 200
    data = recover_res.json()
    assert "instructions to reset your password" in data["message"]
    reset_token = data.get("reset_token")
    assert reset_token is not None  # provided in test environment

    # Request recovery for unknown email -> generic message, reset_token is None
    unknown_res = await async_client.post(
        "/api/auth/recover", json={"email": "unknown@example.com"}
    )
    assert unknown_res.status_code == 200
    assert "instructions to reset your password" in unknown_res.json()["message"]
    assert unknown_res.json().get("reset_token") is None

    # Reset with invalid token
    invalid_reset = await async_client.post(
        "/api/auth/reset-password",
        json={"token": "invalid_fake_token_12345", "new_password": "NewPassword456!"},
    )
    assert invalid_reset.status_code == 400

    # Reset with valid token
    valid_reset = await async_client.post(
        "/api/auth/reset-password",
        json={"token": reset_token, "new_password": "NewPassword456!"},
    )
    assert valid_reset.status_code == 200
    assert "reset successfully" in valid_reset.json()["message"]

    # Old password no longer works
    old_login = await async_client.post(
        "/api/auth/signin",
        json={"email": "recoverme@example.com", "password": "OldPassword123!"},
    )
    assert old_login.status_code == 401

    # New password works
    new_login = await async_client.post(
        "/api/auth/signin",
        json={"email": "recoverme@example.com", "password": "NewPassword456!"},
    )
    assert new_login.status_code == 200


@pytest.mark.asyncio
async def test_event_crud_and_csrf_protection(
    async_client: AsyncClient, sample_wedding_payload: dict[str, Any]
) -> None:
    """Verify event CRUD lifecycle, CSRF enforcement, and persistence."""
    # 1. Unauthenticated attempts should fail with 401
    unauth_list = await async_client.get("/api/events")
    assert unauth_list.status_code == 401

    # Register and sign in user
    signup_res = await async_client.post(
        "/api/auth/signup",
        json={"email": "host@example.com", "password": "PasswordHost123!"},
    )
    session_cookie = signup_res.cookies.get("eventease_session")
    csrf_token = signup_res.json()["csrf_token"]
    cookie_header = f"eventease_session={session_cookie}"

    # 2. Create event without CSRF token -> 403 Forbidden
    event_payload = {
        "name": "Napa Sunset Wedding",
        "intake": sample_wedding_payload,
        "plan_data": {"budget": {"items": []}, "quotes": []},
    }
    no_csrf_res = await async_client.post(
        "/api/events",
        json=event_payload,
        headers={"Cookie": cookie_header},
    )
    assert no_csrf_res.status_code == 403

    # 3. Create event with valid CSRF token -> 201 Created
    headers = {
        "Cookie": cookie_header,
        "X-CSRF-Token": csrf_token,
    }
    create_res = await async_client.post(
        "/api/events", json=event_payload, headers=headers
    )
    assert create_res.status_code == 201
    created_event = create_res.json()
    event_id = created_event["id"]
    assert created_event["name"] == "Napa Sunset Wedding"
    assert created_event["city"] == "San Francisco, CA"

    # 4. List user events
    list_res = await async_client.get("/api/events", headers={"Cookie": cookie_header})
    assert list_res.status_code == 200
    events_list = list_res.json()
    assert len(events_list) == 1
    assert events_list[0]["id"] == event_id

    # 5. Get event detail
    get_res = await async_client.get(
        f"/api/events/{event_id}", headers={"Cookie": cookie_header}
    )
    assert get_res.status_code == 200
    assert get_res.json()["id"] == event_id

    # 6. Update event
    update_payload = {
        "name": "Napa Sunset Wedding (Updated)",
        "intake": sample_wedding_payload,
        "plan_data": {"budget": {"customized": True}},
    }
    update_res = await async_client.put(
        f"/api/events/{event_id}",
        json=update_payload,
        headers=headers,
    )
    assert update_res.status_code == 200
    assert update_res.json()["name"] == "Napa Sunset Wedding (Updated)"

    # 7. Duplicate event
    dup_res = await async_client.post(
        f"/api/events/{event_id}/duplicate",
        headers=headers,
    )
    assert dup_res.status_code == 201
    dup_event = dup_res.json()
    assert dup_event["id"] != event_id
    assert "(Copy)" in dup_event["name"]

    # 8. Delete event
    del_res = await async_client.delete(
        f"/api/events/{event_id}",
        headers=headers,
    )
    assert del_res.status_code == 200
    assert "deleted successfully" in del_res.json()["message"]

    # Confirm original event is gone (404)
    get_after = await async_client.get(
        f"/api/events/{event_id}", headers={"Cookie": cookie_header}
    )
    assert get_after.status_code == 404


@pytest.mark.asyncio
async def test_cross_user_isolation(
    async_client: AsyncClient, sample_wedding_payload: dict[str, Any]
) -> None:
    """Verify User A cannot access or manipulate User B's celebration plans."""
    # Register User A and create an event
    res_a = await async_client.post(
        "/api/auth/signup",
        json={"email": "alice@example.com", "password": "AlicePassword123!"},
    )
    cookie_a = f"eventease_session={res_a.cookies.get('eventease_session')}"
    csrf_a = res_a.json()["csrf_token"]
    create_a = await async_client.post(
        "/api/events",
        json={
            "name": "Alice's Secret Party",
            "intake": sample_wedding_payload,
            "plan_data": {},
        },
        headers={"Cookie": cookie_a, "X-CSRF-Token": csrf_a},
    )
    event_a_id = create_a.json()["id"]

    # Register User B
    res_b = await async_client.post(
        "/api/auth/signup",
        json={"email": "bob@example.com", "password": "BobPassword123!"},
    )
    cookie_b = f"eventease_session={res_b.cookies.get('eventease_session')}"
    csrf_b = res_b.json()["csrf_token"]
    headers_b = {"Cookie": cookie_b, "X-CSRF-Token": csrf_b}

    # User B should NOT see Alice's event in listing
    list_b = await async_client.get("/api/events", headers={"Cookie": cookie_b})
    assert list_b.status_code == 200
    assert len(list_b.json()) == 0

    # User B trying to GET Alice's event -> 404 Not Found (avoids revealing existence)
    get_b = await async_client.get(
        f"/api/events/{event_a_id}", headers={"Cookie": cookie_b}
    )
    assert get_b.status_code == 404

    # User B trying to PUT Alice's event -> 404 Not Found
    put_b = await async_client.put(
        f"/api/events/{event_a_id}",
        json={"name": "Hacked Title"},
        headers=headers_b,
    )
    assert put_b.status_code == 404

    # User B trying to duplicate Alice's event -> 404 Not Found
    dup_b = await async_client.post(
        f"/api/events/{event_a_id}/duplicate",
        headers=headers_b,
    )
    assert dup_b.status_code == 404

    # User B trying to delete Alice's event -> 404 Not Found
    del_b = await async_client.delete(
        f"/api/events/{event_a_id}",
        headers=headers_b,
    )
    assert del_b.status_code == 404


def test_cryptographic_and_security_helpers() -> None:
    """Verify password hashing, token hashing, and helper utilities."""
    password = "SuperSecretPassword123!"
    hashed = hash_password(password)
    assert hashed != password
    assert verify_password(password, hashed) is True
    assert verify_password("WrongPassword!", hashed) is False
    assert verify_password(password, "invalid_hash_structure") is False

    token = generate_secure_token(32)
    assert len(token) > 20
    hashed_token = hash_token(token)
    assert len(hashed_token) == 64  # SHA-256 hex string

    auth_rate = get_auth_rate_limit_value()
    assert "/minute" in auth_rate


def test_models_repr_and_database_helpers() -> None:
    """Verify ORM model repr strings and engine args resolution."""
    user = User(id="user-123", email="repr@example.com", password_hash="hash")
    assert "repr@example.com" in repr(user)

    session = UserSession(id="sess-123", user_id="user-123")
    assert "sess-123" in repr(session)

    event = EventPlanModel(id="ev-123", user_id="user-123", name="My Gala")
    assert "My Gala" in repr(event)

    # Test engine args
    sqlite_args = get_engine_args("sqlite:///./test.db")
    assert sqlite_args.get("connect_args") == {"check_same_thread": False}

    postgres_args = get_engine_args("postgresql://user:pass@localhost/db")
    assert postgres_args.get("pool_pre_ping") is True


@pytest.mark.asyncio
async def test_database_exception_handling(async_client: AsyncClient) -> None:
    """Verify database exceptions return clean generic 500 responses."""
    with patch.object(
        AuthService, "create_user", side_effect=Exception("DB connection dropped")
    ):
        res = await async_client.post(
            "/api/auth/signup",
            json={"email": "fail@example.com", "password": "Password123!"},
        )
        assert res.status_code == 500
        assert "Unable to create account" in res.json()["detail"]


def test_init_db_and_session_lifecycle(test_engine: Any) -> None:
    """Verify init_db initializes declarative metadata cleanly."""
    init_db(test_engine)
    assert "users" in Base.metadata.tables
    assert "event_plans" in Base.metadata.tables
    assert "user_sessions" in Base.metadata.tables
