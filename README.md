# EventEase - Celebration & Event Planning Prototype

[![CI](https://github.com/Suhani-Tyagi/EventEase/actions/workflows/ci.yml/badge.svg)](https://github.com/Suhani-Tyagi/EventEase/actions/workflows/ci.yml)
[![Python 3.11+](https://img.shields.io/badge/python-3.11+-blue.svg)](https://www.python.org/downloads/)
[![Coverage](https://img.shields.io/badge/coverage-92.83%25-brightgreen.svg)]()
[![Code Style: Ruff](https://img.shields.io/badge/code%20style-ruff-000000.svg)](https://github.com/astral-sh/ruff)
[![Type Checked: mypy](https://img.shields.io/badge/mypy-strict-blue.svg)](http://mypy-lang.org/)
[![Accessibility: WCAG 2.1 AA](https://img.shields.io/badge/accessibility-WCAG%202.1%20AA-green.svg)](docs/ACCESSIBILITY.md)

> "An event planning prototype combining deterministic financial and backward-planned timeline algorithms with curated creative ideas, persistent user accounts, multi-tenant database workspace, and interactive planning companions."

---

## Table of Contents
1. [Overview & Solution](#1-overview--solution)
2. [Core Deliverables & Features](#2-core-deliverables--features)
3. [Architecture Overview](#3-architecture-overview)
4. [Quickstart & Installation](#4-quickstart--installation)
   - [Running Locally with Gemini API Key](#running-locally-with-gemini-api-key)
   - [Running Completely Offline (Fallback Mode)](#running-completely-offline-fallback-mode)
   - [Database Setup & Configuration](#database-setup--configuration)
   - [Deploying to Vercel with PostgreSQL](#deploying-to-vercel-with-postgresql)
   - [Running via Docker](#running-via-docker)
5. [Environment Variables](#5-environment-variables)
6. [API Reference & OpenAPI Docs](#6-api-reference--openapi-docs)
7. [Testing & Quality Verification](#7-testing--quality-verification)
8. [Design Decisions & Trade-Offs](#8-design-decisions--trade-offs)
9. [Security & Threat Model](#9-security--threat-model)
10. [Accessibility (WCAG 2.1 AA)](#10-accessibility-wcag-21-aa)

---

## 1. Overview & Solution
Planning a milestone celebration—whether an intimate wedding, a milestone birthday party, or a neighborhood festival—requires balancing realistic financial allocations, backward-planned timelines, and vendor contract vetting.

**EventEase** isolates mathematics and scheduling from creative ideation:
- **Deterministic, pure mathematical algorithms** calculate budget breakdowns and backward-planned milestone schedules (zero hallucinations, 100% explainable derivations).
- **Curated GenAI inspiration (Gemini 2.5 Flash)** recommends tailored aesthetic themes, signature menus, and cost-saving tips.
- **Persistent User Accounts & Multi-Tenant Workspace**: Users sign up or sign in to access their personal celebration workspace with persistent database storage (SQLite or PostgreSQL), preventing data loss across devices.
- **Interactive Character Squad**: Context-aware companions (Barnaby, Shep, Nova, Pip, and Lumi) react purposefully to budget changes, milestone achievements, vendor bookings, and creative ideas.
- **Graceful offline resilience**, ensuring the entire planning prototype operates cleanly even without an internet connection or Gemini API key.

---

## 2. Core Deliverables & Features

### 1. User Accounts & Persistent Database Saved Events
- **Authentication Flow**: Accessible modal dialog supporting Sign Up, Sign In, Sign Out, and Password Recovery / Reset.
- **Persistent Database Workspace**: All celebration plans, customized budget allocations, milestone progress, vendor statuses, and quotes are persisted to the database configured by `DATABASE_URL`.
- **Event Operations**: Users can create, reopen, edit, duplicate, and remove plans from their account database with instant synchronization.
- **Multi-Tenant Security**: Every database query verifies `user_id == current_user.id`. Manipulation of event IDs returns an immediate `404 Not Found`.
- **Zero LocalStorage Source of Truth**: User credentials and saved celebration plans are stored exclusively in the persistent SQL database. `localStorage` is used solely as a temporary device draft cache.

### 2. Interactive Planning Squad & Lumi Companion
- **Barnaby (Financial Strategist - 🦫)**: Provides purposeful reactions to budget balances, overallocation warnings, and contingency buffer checks.
- **Shep (Milestone Pathfinder - 🐶)**: Announces milestone completions, remaining tasks, and upcoming deadlines.
- **Nova (Vendor Contract Scout - 🐱)**: Guides contract screening and deposit deadline logging upon booking vendors.
- **Pip (Creative & Hospitality Curator - 🐧)**: Shares tailored tips when exploring aesthetic themes, decor, menus, and activity tabs.
- **Lumi (Celebration Spark - ✨)**: Celebrates plan generation and milestone completion with sparkles and curated planning tips.
- **Dual-Layer Reduced Motion Controls**: Full compliance with OS `prefers-reduced-motion` plus an in-app Motion Toggle (`#motion-toggle`) to disable decorative motion and particle confetti.

### 3. Multi-Step Event Intake
- Captures event type (`wedding`, `birthday`, `community`), date, headcount (1 to 10,000), total budget, currency, city, aesthetic theme, cultural/dietary traditions, and special notes.
- Divided into 3 focused stages with progress tracking and real-time inline validation.
- 3 One-Click Demonstration Scenarios (Napa Vineyard Wedding, 30th Rooftop Glow Party, Eco-Arts Community Festival).

### 4. Live Editable Budget Planner with Real-Time Balance Validation
- Interactive category breakdown with an 8.0% dedicated Contingency Buffer.
- Users can edit any category percentage or currency amount; the engine immediately updates category totals, validates whether allocations stay balanced, recalculates the per-guest cost, and updates the visual segmented bar.
- One-click "Reset Allocation" restores the benchmark distribution.

### 5. Adaptive Milestone Timeline Generator
- Backward-planned milestone schedule derived from the scheduled celebration date down to Event Day.
- **Adaptive Compression Algorithm**: Automatically scales intervals when planning horizons are compressed (<90 days, <30 days, or express blitz), guaranteeing feasible deadlines.
- Interactive completion checkboxes update progress and trigger celebration milestones.

### 6. Categorized Vendor Checklist with Filters, Notes & Contacts
- Tailored screening questions to ask prospective venues, caterers, photographers, and entertainers before signing contracts.
- Interactive status dropdowns (`to-do`, `contacted`, `booked`) with live counters.
- Filter pills (`All`, `To-Do`, `Contacted`, `Booked`) to focus on active vendor workflows.
- Contact details and private interview notes stored safely in user account database.

### 7. Compact Celebration Progress Dashboard
- 4 real-time progress cards:
  1. **Budget Balance**: Balance status, total allocated percentage, and contingency buffer.
  2. **Milestones Done**: Completed milestones count, completion percentage, and progress bar.
  3. **Vendors Booked**: Booked vs in-progress counts and booking progress bar.
  4. **Event Countdown**: Days remaining and next upcoming deadline reminder.

### 8. Vendor Quote Comparison View
- Side-by-side comparison of user-entered vendor quotes (base price, additional fees, total estimated cost, included services, payment terms, and status).
- **Truthful Labeling**: All quote amounts are strictly labeled as **user-provided records** and are never presented as market benchmarks, automated estimates, or algorithmic pricing.
- Interactive category filtering pills and one-click preferred quote selection.

### 9. Multi-Format Exports with Security & Standards Compliance
- **Copy Summary**: Generates a clean text summary calculating contingency from actual allocations (fixing any undefined field issues).
- **JSON Export**: Downloads the complete state as an indented JSON file.
- **CSV Spreadsheet (Formula Injection Defense)**: Formats event details, budget allocations, milestones, vendor checklists, and quote comparisons into an RFC 4180 compliant CSV file. All cells starting with formula-triggering characters (`=`, `+`, `-`, `@`, `\t`, `\r`, `|`, `%`) are safely prefixed with a single quote (`'`) to ensure spreadsheet applications open them strictly as literal text.
- **.ICS Calendar Export (RFC 5545 Compliant)**: Exports all milestone deadlines and celebration day into standard RFC 5545 iCalendar format. Escapes special characters (`,`, `;`, `\`, line breaks), strictly folds lines at $\le$ 75 octets via `\r\n `, sets exclusive all-day event end dates (`DTEND = DTSTART + 1 day`), and generates stable, unique UIDs (`@eventease.app`).
- **Export Privacy Notice**: Highlights to users when downloaded exports contain private vendor notes, contact details, or quotes.
- **Print / PDF View**: Formatted with a clean print stylesheet (`@media print`) that removes web navigation for physical printing or PDF generation.

---

## 3. Architecture Overview

```mermaid
flowchart TD
    Client["Browser Client (Vanilla HTML5 / Modular ES6)"]
    API["FastAPI Backend (app/main.py)"]
    Auth["Auth Service (bcrypt / SHA-256 session tokens)"]
    Events["Events Service (Multi-Tenant CRUD)"]
    DB[("SQL Database (SQLite / PostgreSQL)")]
    Algorithmic["Deterministic Pure Python Services"]
    LLM["Gemini 2.5 Flash / Offline Fallback Cache"]

    Client -->|"HTTP / SameSite Cookie / CSRF"| API
    API --> Auth
    API --> Events
    Auth --> DB
    Events --> DB
    API -->|"Math & Timelines"| Algorithmic
    API -->|"Ideas & Inspiration"| LLM
```

---

## 4. Quickstart & Installation

### Running Locally with Gemini API Key
```bash
# 1. Clone repository
git clone https://github.com/Suhani-Tyagi/EventEase.git
cd EventEase

# 2. Create and activate virtual environment
python -m venv venv
# Linux/macOS:
source venv/bin/activate
# Windows PowerShell:
.\venv\Scripts\Activate.ps1

# 3. Install dependencies
pip install -r requirements-dev.txt
npm install

# 4. Configure environment
cp .env.example .env
# Edit .env and supply GEMINI_API_KEY and SESSION_SECRET_KEY

# 5. Start development server
uvicorn app.main:app --reload --port 8000
```
Visit `http://localhost:8000` in your web browser.

### Running Completely Offline (Fallback Mode)
If `GEMINI_API_KEY` is omitted or empty, EventEase automatically boots in **Offline Fallback Mode**. All mathematical budgets, adaptive milestone timelines, vendor screening playbooks, and curated offline ideas function normally without an internet connection or external API calls.

### Database Setup & Configuration
By default, EventEase initializes a local SQLite database at `sqlite:///./eventease.db`.
- **Local Development**: No extra database configuration required. Database tables (`users`, `user_sessions`, `event_plans`) are initialized automatically at startup.
- **Production (PostgreSQL)**:
  Configure `DATABASE_URL` in your `.env` or deployment environment:
  ```env
  DATABASE_URL=postgresql://user:password@host:5432/eventease_db
  ```
  The database engine supports PostgreSQL URLs from Vercel, Neon, or Supabase and uses the psycopg 3 driver.

### Deploying to Vercel with PostgreSQL
1. Create or connect a PostgreSQL database (Vercel Marketplace, Neon, or Supabase), then link this repository to Vercel.
2. In the Vercel Dashboard under **Settings > Environment Variables**, add these for **Production, Preview, and Development** as needed:
   - `DATABASE_URL`: Connection string to your PostgreSQL instance (e.g., Supabase, Neon, AWS RDS, or Vercel Postgres).
   - `SESSION_SECRET_KEY`: A cryptographically secure random secret of at least 32 characters.
   - `GEMINI_API_KEY`: (Optional) Your Google Gemini API key.
   - `APP_ENV`: `production`
3. Redeploy after saving the variables. Vercel runs `api/index.py` as a Python serverless function. SQLite is rejected on Vercel because its local files do not persist across serverless invocations. Account creation and saved plans require the PostgreSQL `DATABASE_URL` to be set.

### Running via Docker
```bash
# Build Docker image
docker build -t eventease:latest .

# Run container
docker run -p 8000:8000 -e GEMINI_API_KEY=your_api_key -e SESSION_SECRET_KEY=your_secret eventease:latest
```

---

## 5. Environment Variables

| Variable | Type | Default | Description |
| :--- | :--- | :--- | :--- |
| `DATABASE_URL` | `string` | `sqlite:///./eventease.db` | SQLAlchemy database URL (SQLite for local dev, PostgreSQL required on Vercel). |
| `SESSION_SECRET_KEY` | `string` | `eventease-default-dev-secret-key-change-in-production` | Secret used for cryptographically secure session cookie generation. |
| `SESSION_COOKIE_NAME` | `string` | `eventease_session` | Name of the HTTP-only session cookie. |
| `CSRF_COOKIE_NAME` | `string` | `eventease_csrf` | Name of the CSRF token cookie. |
| `SESSION_MAX_AGE_SECONDS` | `int` | `604800` | Session expiration time (7 days default). |
| `AUTH_RATE_LIMIT_PER_MINUTE` | `int` | `10` | Rate limit for auth and recovery endpoints. |
| `GEMINI_API_KEY` | `string` | `None` | Google Gemini API key. If absent, offline fallback is used. |
| `APP_ENV` | `string` | `development` | Runtime environment (`development`, `production`, `test`). |
| `HOST` | `string` | `127.0.0.1` | Server host address. |
| `PORT` | `int` | `8000` | Server listening port. |
| `CORS_ALLOWED_ORIGINS` | `string` | `http://localhost:8000,http://127.0.0.1:8000` | Comma-separated CORS origin allowlist. |
| `RATE_LIMIT_PER_MINUTE` | `int` | `20` | Max requests per IP per minute on AI endpoints. |
| `REDIS_URL` | `string` | `None` | Optional Redis connection URI (e.g. `redis://localhost:6379`) for shared rate limiting. |
| `TRUSTED_PROXIES` | `string` | `127.0.0.1,::1` | Comma-separated trusted reverse proxy IP addresses or CIDR ranges. |
| `TRUST_ALL_PROXIES` | `bool` | `False` | When True, trusts forwarded headers from any peer IP. |
| `MAX_REQUEST_BODY_BYTES` | `int` | `1048576` | Max allowable request body size (1 MB default). |
| `GEMINI_MODEL` | `string` | `gemini-2.5-flash` | Gemini model variant. |
| `LLM_TIMEOUT_SECONDS` | `float` | `10.0` | Timeout threshold for LLM generation before falling back. |
| `LLM_MAX_RETRIES` | `int` | `2` | Number of retry attempts on transient model errors. |
| `CACHE_TTL_SECONDS` | `int` | `3600` | TTL in seconds for the in-memory ideas cache. |

---

## 6. API Reference & OpenAPI Docs

The interactive OpenAPI documentation is available at `http://127.0.0.1:8000/docs`.

### Authentication Endpoints
- `POST /api/auth/signup`: Register a new account (`email`, `password`).
- `POST /api/auth/signin`: Sign in with email and password, issuing HTTP-only session cookie.
- `POST /api/auth/signout`: Invalidate active session and clear cookies.
- `GET /api/auth/me`: Check session authentication status and retrieve current user profile.
- `POST /api/auth/recover`: Request password recovery instructions (constant-shape generic response).
- `POST /api/auth/reset-password`: Reset password using recovery token.

### Persistent Events Workspace Endpoints
- `GET /api/events`: List all celebration plans owned by the authenticated user.
- `POST /api/events`: Persist a new celebration plan to the user's database account.
- `GET /api/events/{id}`: Retrieve a specific saved event plan (enforces ownership; returns 404 on mismatch).
- `PUT /api/events/{id}`: Update an existing saved event plan.
- `POST /api/events/{id}/duplicate`: Duplicate an existing plan in the database.
- `DELETE /api/events/{id}`: Permanently delete a saved event plan.

### Planning Generation Endpoints
- `GET /api/health`: Health status reporting service health, rate limits, and AI mode (`live` vs `offline_fallback`).
- `GET /api/presets`: Pre-configured demo scenarios (wedding, birthday, community).
- `POST /api/budget`: Pure mathematical budget allocation breakdown.
- `POST /api/timeline`: Adaptive milestone schedule backward-planned from event date.
- `GET /api/checklist/{event_type}`: Categorized screening questions for vendors.
- `POST /api/ideas`: Tailored themes, decor, menus, and cost-saving tips.
- `POST /api/plan`: Unified endpoint returning all deliverables simultaneously.

---

## 7. Testing & Quality Verification

EventEase enforces strict linting, strict static typing, and automated testing across both backend and frontend layers.

### Running Quality Checks
```bash
# 1. Run Ruff Linter
ruff check app tests

# 2. Run MyPy Strict Type Checker
mypy app tests

# 3. Run Pytest Suite with Coverage Enforcement
pytest

# 4. Run Browser-Level DOM Integration Tests
npm run test:browser
```

### Verified Test Results
- **Backend Tests**: **92 tests passing with 92.83% statement coverage** across `app` under Python 3.11:
  - `app/api/auth_routes.py`: 93%
  - `app/api/deps.py`: 97%
  - `app/api/event_routes.py`: 96%
  - `app/api/routes.py`: 94%
  - `app/core/config.py`: 100%
  - `app/core/security.py`: 97%
  - `app/models/models.py`: 100%
  - `app/schemas.py`: 100%
  - `app/services/auth.py`: 90%
  - `app/services/events.py`: 100%
  - `app/services/budget.py`: 91%
  - `app/services/ideas.py`: 93%
  - `app/services/llm_client.py`: 95%
  - `app/services/timeline.py`: 94%
- **Frontend DOM Integration Tests**: **125 tests passing (0 failures)**, covering user signup/signin/signout, database workspace CRUD, character squad reactions, reduced motion toggles, editable budget balancing, milestone completion, vendor status filtering, notes and contacts persistence, CSV formula injection defense, RFC 5545 .ICS export compliance, and accessible WAI-ARIA tab navigation.

---

## 8. Design Decisions & Trade-Offs

1. **Separation of Deterministic Logic vs. AI Generation**:
   - Financial allocations and milestone timelines are computed through pure Python functions without LLM involvement.
   - Budgets and legal countdowns require 100% accuracy, reproducibility, and explainability. LLMs are reserved strictly for creative recommendations (decor, themes, catering concepts).
2. **Persistent Database Source of Truth**:
   - Replaced browser `localStorage` as the source of truth for accounts and saved plans with a persistent SQL database.
   - Preserved SQLite for zero-configuration local development and supported cloud PostgreSQL for Vercel/serverless production.
3. **Vanilla Frontend with Modular ES Scripts (Zero Build Step)**:
   - Decomposed `app.js` into focused modules (`api.js`, `auth.js`, `events.js`, `characters.js`, `exports.js`, `app.js`).
   - Plain semantic HTML5 and vanilla JavaScript without heavy frameworks guarantees instant startup, zero NPM dependency rot, and native browser execution.
4. **Dual-Layer Reduced Motion Controls**:
   - Users can toggle motion directly via `#motion-toggle` in the header or through system preferences (`prefers-reduced-motion`).
5. **Truthful Data Transparency**:
   - Vendor quote amounts are strictly marked as user-entered records; no synthetic benchmarks or artificial market estimates are manufactured.
   - AI status accurately indicates whether live Gemini responses or offline fallback templates are active.

---

## 9. Security & Threat Model
For comprehensive details, review [`SECURITY.md`](SECURITY.md). Key verified defenses include:
- **bcrypt Password Hashing**: Passwords salted and hashed with bcrypt; plain-text passwords never stored or logged.
- **HTTP-Only Session Cookies**: Cryptographically secure 256-bit entropy session tokens stored in `HttpOnly`, `SameSite=Lax` cookies; SHA-256 hashed in the database; tokens never stored in `localStorage`.
- **CSRF Defense**: Double-submit / header token matching (`X-CSRF-Token`) on all state-changing endpoints.
- **Multi-Tenant Ownership Verification**: Every event plan query enforces `user_id == current_user.id`; ID manipulation returns `404 Not Found`.
- **Prompt-Injection Defense**: Delimiter isolation (`<<<EVENT_INTAKE_DATA_START>>>`), control-character stripping, and Unicode NFKC normalization.
- **Serverless Error Sanitization**: Public serverless error sanitization (`api/index.py`) catches unhandled exceptions, logging tracebacks privately and returning generic 500 responses without leaking internals.
- **Reverse Proxy Header Trust**: Client IP resolution only trusts `X-Forwarded-For` and `X-Real-IP` when requests originate from verified upstream proxies configured via `TRUSTED_PROXIES`.
- **CSV Formula Injection Defense**: Sanitizes all exported CSV cells starting with `=, +, -, @, \t, \r, |, %` by prefixing a single quote (`'`), ensuring spreadsheet software renders them strictly as literal text.
- **RFC 5545 iCalendar Compliance**: Escapes special characters, uses exclusive all-day event end dates (`DTEND = DTSTART + 1 day`), and folds lines exceeding 75 octets via `\r\n `.
- **Strict Content Security Policy & Headers**: `script-src 'self'`, `frame-ancestors 'none'`, `X-Content-Type-Options: nosniff`, and non-root Docker execution (`appuser:10001`).

---

## 10. Accessibility (WCAG 2.1 AA)
For verification results and criteria breakdown, see [`docs/ACCESSIBILITY.md`](docs/ACCESSIBILITY.md).
- Landmarks: `<header role="banner">`, `<main role="main">`, `<footer role="contentinfo">`.
- Visible focus outlines (`:focus-visible`) and skip-to-content bypass link.
- High-contrast color palette (Warm Fog, Berry Good, Usu Koubai Blossom, Meadow Mauve, Soldier Green) verified >= 4.5:1 across Light and Dark themes.
- Form controls paired with visible `<label>`, `aria-describedby` hints, and `aria-live` error alerts.
- Fully accessible WAI-ARIA tab navigation supporting `ArrowLeft`, `ArrowRight`, `Home`, and `End` keys.
- Complete support for `prefers-reduced-motion` in CSS and in-app Motion Toggle (`#motion-toggle`).
