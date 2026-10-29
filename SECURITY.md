# EventEase Security Architecture & Threat Model

## 1. Threat Model & Overview
EventEase handles celebration planning inputs from web clients and coordinates with Google's Gemini LLM. Because user input is processed by both deterministic algorithms and GenAI models, security defenses are layered at the perimeter, application, model framing, and client rendering tiers.

---

## 2. Threat Vector Mitigations

| Threat Vector | Mitigation Strategy | Implementation Reference |
| :--- | :--- | :--- |
| **Prompt Injection Attacks** | Input sanitization, isolation delimiters, system prompt isolation, and output schema validation. | `app/core/security.py`, `app/services/ideas.py` |
| **Cross-Site Scripting (XSS)** | Strict Content Security Policy (`script-src 'self'`) and pure `textContent` DOM manipulation. | `app/core/security.py`, `static/js/app.js` |
| **Denial of Service (DoS)** | Max payload limits (1MB), rate limiting wired into settings, and async client timeouts. | `RequestSizeLimitMiddleware`, `limiter` |
| **Serverless Information Leakage** | Exception sanitization; stack traces and internal errors logged privately, returning generic 500. | `api/index.py` |
| **Unbounded Cache Growth** | Proactive expired entry pruning and eviction of oldest entries when cache reaches capacity. | `app/services/ideas.py` |
| **Data Tampering & Mass Assignment** | Strict Pydantic v2 validation forbidding unknown fields (`extra="forbid"`). | `app/schemas.py` |
| **Credential & Secret Leakage** | `pydantic-settings` environment isolation; secrets never logged or exposed in client responses. | `app/core/config.py`, `.env.example` |
| **Clickjacking & MIME Confusion** | `X-Frame-Options: DENY`, `frame-ancestors 'none'`, and `X-Content-Type-Options: nosniff`. | `SecurityHeadersMiddleware` |
| **Container Privilege Escalation** | Dockerfile creates and executes under non-root user (`appuser:10001`). | `Dockerfile` |

---

## 3. In-Depth Defense Layers

### 3.1 Prompt-Injection Defense Architecture
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

### 3.2 Serverless Error Sanitization
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

### 3.3 Rate Limiting & Serverless IP Resolution
- `app/core/security.py` implements `get_client_ip(request)` which inspects `X-Forwarded-For` (first client IP in comma-separated list) and `X-Real-IP` before falling back to `request.client.host`.
- The rate limiter is dynamically wired into application configuration (`settings.rate_limit_per_minute`) on sensitive endpoints (`/api/ideas`, `/api/plan`).

---

### 3.4 Bounded Ideas Cache
- To prevent memory exhaustion in long-running processes or serverless warm containers, `IdeasService` enforces a bounded cache (`max_cache_entries = 256` default).
- On every read/write, expired entries are purged via `_purge_expired()`.
- If cache capacity is reached, entries closest to expiration are pruned via `_evict_oldest()`.

---

### 3.5 Output Encoding & Frontend Protection
- **No Inline JavaScript**:
  - The application uses modular ES scripts (`<script type="module" src="/static/js/app.js">`).
- **Strict `textContent` Rendering**:
  - Dynamic elements are rendered using `document.createElement` and `el.textContent = ...`.
  - `innerHTML` is never used for dynamic user-influenced content.

---

### 3.6 HTTP Security Headers
Every HTTP response includes the following protective headers:
```http
Content-Security-Policy: default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; img-src 'self' data:; connect-src 'self'; frame-ancestors 'none'; base-uri 'self'; form-action 'self';
X-Content-Type-Options: nosniff
X-Frame-Options: DENY
Referrer-Policy: strict-origin-when-cross-origin
Permissions-Policy: camera=(), microphone=(), geolocation=(), payment=()
```
