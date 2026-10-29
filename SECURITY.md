# EventEase Security Architecture & Threat Model

## 1. Threat Model & Overview
EventEase handles celebration planning inputs from web clients, manages user accounts and saved celebration plans in a persistent database, and coordinates with Google's Gemini LLM. Because user input is processed by deterministic algorithms, database engines, and GenAI models, security defenses are layered at the perimeter, authentication, database, application, model framing, and client rendering tiers.

---

## 2. Threat Vector Mitigations

| Threat Vector | Mitigation Strategy | Implementation Reference |
| :--- | :--- | :--- |
| **Credential / Password Theft** | Modern `bcrypt` password hashing with unique salt per user; plain-text passwords never stored or logged. | `app/core/security.py`, `app/services/auth.py` |
| **Session Hijacking / Theft** | Cryptographically secure 256-bit entropy tokens, SHA-256 hashed in database, stored in `HttpOnly`, `SameSite=Lax` cookies; never stored in `localStorage`. | `app/core/security.py`, `app/api/auth_routes.py` |
| **Cross-Site Request Forgery (CSRF)** | Mandatory `X-CSRF-Token` header verification against active session token on all mutating methods (`POST`, `PUT`, `DELETE`). | `app/api/deps.py`, `static/js/api.js` |
| **Multi-Tenant Infiltration (ID Manipulation)** | All event plan queries enforce `user_id == current_user.id`. Manipulation of plan IDs returns `404 Not Found` (zero information leakage). | `app/services/events.py`, `app/api/event_routes.py` |
| **Email Enumeration** | Password recovery returns a generic success message regardless of whether an email address exists in the database. | `app/api/auth_routes.py` |
| **Brute-Force Authentication Attacks** | Dedicated strict rate limits on authentication and recovery endpoints (`AUTH_RATE_LIMIT_PER_MINUTE`, default 10/min). | `app/core/security.py`, `app/api/auth_routes.py` |
| **Database Failure & Stack Leakage** | Database errors and SQLAlchemy tracebacks are caught, logged privately, and returned as sanitized generic HTTP errors. | `app/api/deps.py`, `app/api/event_routes.py` |
| **Prompt Injection Attacks** | Input sanitization, isolation delimiters, system prompt isolation, and output schema validation. | `app/core/security.py`, `app/services/ideas.py` |
| **Cross-Site Scripting (XSS)** | Strict Content Security Policy (`script-src 'self'`) and pure `textContent` DOM manipulation. | `app/core/security.py`, `static/js/app.js` |
| **Denial of Service (DoS)** | Max payload limits (1MB), rate limiting wired into settings, and async client timeouts. | `RequestSizeLimitMiddleware`, `limiter` |
| **Spreadsheet Formula Injection** | Cells starting with `=, +, -, @, \t, \r, |, %` are prefixed with `'` to render as literal text. | `app/core/security.py`, `static/js/app.js` |
| **Proxy Header IP Spoofing** | Only inspects `X-Forwarded-For` or `X-Real-IP` when the peer host matches `TRUSTED_PROXIES`. | `app/core/security.py` (`get_client_ip`) |
| **Serverless Information Leakage** | Exception sanitization; stack traces and internal errors logged privately, returning generic 500. | `api/index.py` |
| **Unbounded Cache Growth** | Proactive expired entry pruning and eviction of oldest entries when cache reaches capacity. | `app/services/ideas.py` |
| **Data Tampering & Mass Assignment** | Strict Pydantic v2 validation forbidding unknown fields (`extra="forbid"`). | `app/schemas.py` |
| **Credential & Secret Leakage** | `pydantic-settings` environment isolation; secrets never logged or exposed in client responses. | `app/core/config.py`, `.env.example` |
| **Clickjacking & MIME Confusion** | `X-Frame-Options: DENY`, `frame-ancestors 'none'`, and `X-Content-Type-Options: nosniff`. | `SecurityHeadersMiddleware` |
| **Container Privilege Escalation** | Dockerfile creates and executes under non-root user (`appuser:10001`). | `Dockerfile` |

---

## 3. In-Depth Defense Layers

### 3.1 User Accounts, Session Security & Multi-Tenant Isolation
- **Password Hashing (bcrypt)**:
  - User passwords must meet minimum length requirements ($\ge 8$ characters).
  - Passwords are salted and hashed using `bcrypt.hashpw(password.encode(), bcrypt.gensalt())`.
  - Passwords are never logged, echoed, or included in serialization schemas (`app/schemas.py` excludes password hashes from `UserResponse`).
- **Session Tokens & Cookies**:
  - Session tokens are cryptographically generated with 32 bytes of secure random entropy (`secrets.token_urlsafe(32)`).
  - The database `user_sessions` table stores **SHA-256 hashes** of session tokens (`hash_token(token)`), protecting user accounts even in the unlikely event of an offline database snapshot compromise.
  - Cookies are marked with `HttpOnly`, `SameSite=Lax`, and `Secure` (in non-local environments), completely blocking client script access and cross-site exfiltration.
  - Session tokens are strictly **never placed in browser `localStorage`**.
- **CSRF Defense**:
  - The server issues a cryptographically secure CSRF token upon sign-in/sign-up.
  - State-changing API endpoints (`POST`, `PUT`, `DELETE`) require a matching `X-CSRF-Token` header, validated by FastAPI dependency injection (`require_csrf_token`).
- **Multi-Tenant Ownership Verification**:
  - All database queries for event plans assert `EventPlanModel.user_id == current_user.id`.
  - Attempting to read, update, duplicate, or delete an event that does not belong to the authenticated user results in an immediate `404 Not Found`. This prevents enumeration attacks and guarantees cross-user data isolation.
- **Generic Account Recovery**:
  - Recovery requests return an identical generic response regardless of whether an email address exists in the database, preventing username/email harvesting.

---

### 3.2 Prompt-Injection Defense Architecture
User free text (e.g., Theme, Cultural Preferences, Special Notes) represents untrusted external data. We defend against indirect and direct prompt injection through four defensive layers:

1. **Control-Character Stripping & Normalization**:
   - Strips non-printable characters and control bytes (`\x00` through `\x1f`).
   - Normalizes text with Unicode NFKC standard.
2. **Instruction Neutralization**:
   - Replaces common jailbreak phrases (`ignore previous instructions`, `system:`, `you are now`, `<|im_start|>`) with `[filtered_instruction]`.
3. **Delimiter Isolation**:
   - Frames all user data between isolation tokens:
     ```text
     <<<EVENT_INTAKE_DATA_START>>>
     Event Type: wedding
     Location: Napa Valley
     <<<EVENT_INTAKE_DATA_END>>>
     ```
   - User inputs containing `<<<` or `>>>` are escaped to `&lt;&lt;&lt;` and `&gt;&gt;&gt;` to prevent breaking out of isolation framing.
4. **Structured Schema Enforcement**:
   - The LLM is instructed to respond strictly in JSON matching the `PersonalizedIdeas` schema. Output is parsed by `json.loads` and validated by Pydantic before rendering.

---

### 3.3 Serverless Error Sanitization
In serverless environments (such as Vercel), uncaught exceptions can inadvertently leak database credentials, internal file paths, or framework tracebacks to end users.
- `api/index.py` catches all unhandled exceptions during startup and runtime.
- Diagnostic details and stack traces are logged privately via `logger.critical` and `sys.stderr`.
- The client receives a sanitized, generic 500 JSON payload:
  ```json
  {
    "error": "Internal Server Error",
    "detail": "The service is temporarily unavailable. Please try again later."
  }
  ```

---

### 3.4 Rate Limiting, Proxy Trust & Serverless Reality
- **Trusted Proxy Header Verification**:
  - `app/core/security.py` implements `get_client_ip(request)` and `is_trusted_proxy(peer_host)`.
  - HTTP headers `X-Forwarded-For` and `X-Real-IP` are parsed **only if** the immediate network peer host belongs to `settings.trusted_proxies` (e.g. `127.0.0.1,::1` or cloud ingress CIDRs) or `settings.trust_all_proxies` is explicitly enabled. If the peer is not trusted, the direct peer host is used, preventing IP spoofing attacks against rate limits.
- **Shared Store vs. Serverless In-Memory Reality**:
  - EventEase supports a centralized Redis backend via `REDIS_URL` / `settings.redis_url`. When configured, SlowAPI coordinates request counts across multiple application containers or serverless instances.
  - If `REDIS_URL` is omitted or unavailable, the system safely falls back to `memory://`. In serverless deployments (such as Vercel) without Redis, in-memory rate limiting applies **per container instance** rather than enforcing global IP-wide limits across concurrent serverless instances. This operational behavior is documented transparently.

---

### 3.5 Bounded Ideas Cache
- To prevent memory exhaustion in long-running processes or serverless warm containers, `IdeasService` enforces a bounded cache (`max_cache_entries = 256` default).
- On every read/write, expired entries are purged via `_purge_expired()`.
- If cache capacity is reached, entries closest to expiration are pruned via `_evict_oldest()`.

---

### 3.6 Output Encoding & Frontend Protection
- **Modular ES Scripts**:
  - The application architecture is decomposed into focused modules (`api.js`, `auth.js`, `events.js`, `characters.js`, `exports.js`, and `app.js`).
- **Strict `textContent` Rendering**:
  - Dynamic elements are rendered using `document.createElement` and `el.textContent = ...`.
  - `innerHTML` is never used for dynamic user-influenced content.

---

### 3.7 HTTP Security Headers
Every HTTP response includes the following protective headers:
```http
Content-Security-Policy: default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; img-src 'self' data:; connect-src 'self'; frame-ancestors 'none'; base-uri 'self'; form-action 'self';
X-Content-Type-Options: nosniff
X-Frame-Options: DENY
Referrer-Policy: strict-origin-when-cross-origin
Permissions-Policy: camera=(), microphone=(), geolocation=(), payment=()
```

---

### 3.8 Spreadsheet Formula Injection Defense (CSV Export)
When exporting data to CSV format, user-supplied text (such as vendor notes, contact information, category names, or vendor quotes) may contain formula trigger characters. If an attacker inputs `=cmd|...` or `-2+3*cmd`, spreadsheet software (Microsoft Excel, LibreOffice Calc, Google Sheets) might evaluate the payload upon opening.
- Both backend (`app/core/security.py:sanitize_csv_cell`) and frontend (`static/js/exports.js:sanitizeCsvCell`, `static/js/app.js:sanitizeCsvCell`) inspect every field.
- If a string begins with any formula character (`=`, `+`, `-`, `@`, `\t`, `\r`, `|`, `%`), it is prefixed with a single quote character (`'`).
- Spreadsheet processors interpret the leading single quote as a text escape signal, displaying the content strictly as text and completely preventing formula execution.

---

### 3.9 RFC 5545 iCalendar Standards & Sanitization
Calendar event exports (`.ics`) conform strictly to the RFC 5545 specification:
- Text values escape backslashes (`\\`), semicolons (`\;`), commas (`\,`), and line breaks (`\n`).
- All output lines are folded strictly at or before 75 octets using CRLF followed by a single whitespace character (`\r\n `), calculated using UTF-8 byte length rather than character count.
- All-day events define an exclusive end date (`DTEND = DTSTART + 1 day`) per RFC 5545 §3.6.1.
- Each event is assigned a globally unique, stable identifier (`UID:eventease-<type>-<hash>@eventease.app`).

---

### 3.10 Storage Architecture & Source of Truth Disclosure
- **Database Source of Truth**:
  - User accounts and saved celebration plans are stored in the persistent SQL database configured by `DATABASE_URL` (SQLite for local development, PostgreSQL for cloud serverless).
  - Browser `localStorage` is **not** the source of truth for user credentials, authentication tokens, or persisted accounts.
- **Client Cache Disclosure**:
  - Active draft forms and temporary uncommitted state use client storage on that specific device for session survival across accidental page refreshes.
  - This storage is not encrypted and is readable by any script executing on the same origin.
- **Export Privacy Notice**:
  - Users are warned prior to downloading CSV or JSON exports that the files include private vendor notes and contact details.
