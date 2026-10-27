# EventEase Security Architecture & Threat Model

## 1. Threat Model & Overview
EventEase handles celebration planning inputs from web clients and coordinates with Google's Gemini LLM. Because user input is processed by both deterministic algorithms and GenAI models, security defenses are layered at the perimeter, application, model framing, and client rendering tiers.

---

## 2. Threat Vector Mitigations

| Threat Vector | Mitigation Strategy | Implementation Reference |
| :--- | :--- | :--- |
| **Prompt Injection Attacks** | Input sanitization, isolation delimiters, system prompt isolation, and output schema validation. | `app/core/security.py`, `app/services/ideas.py` |
| **Cross-Site Scripting (XSS)** | Strict Content Security Policy (`script-src 'self'`) and pure `textContent` DOM manipulation. | `app/core/security.py`, `static/js/app.js` |
| **Denial of Service (DoS)** | Max payload limits (1MB), IP rate limiting (20 req/min), and async client timeouts. | `RequestSizeLimitMiddleware`, `limiter` |
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

### 3.2 Output Encoding & Frontend Protection
- **No Inline JavaScript**:
  - The application uses modular ES scripts (`<script type="module" src="/static/js/app.js">`).
- **Strict `textContent` Rendering**:
  - Dynamic elements are rendered using `document.createElement` and `el.textContent = ...`.
  - `innerHTML` is never used for dynamic user-influenced content.

---

### 3.3 HTTP Security Headers
Every HTTP response includes the following protective headers:
```http
Content-Security-Policy: default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; img-src 'self' data:; connect-src 'self'; frame-ancestors 'none'; base-uri 'self'; form-action 'self';
X-Content-Type-Options: nosniff
X-Frame-Options: DENY
Referrer-Policy: strict-origin-when-cross-origin
Permissions-Policy: camera=(), microphone=(), geolocation=(), payment=()
```

---

### 3.4 Rate Limiting & Resource Protection
- **Per-IP Rate Limiting**: AI endpoints (`/api/ideas` and `/api/plan`) are capped at 20 requests per minute per IP via `slowapi`.
- **Payload Size Capping**: Payloads exceeding 1,048,576 bytes (1 MB) receive an immediate `413 Payload Too Large` error prior to parsing.
- **LLM Timeout & Circuit Breaking**: Calls to Gemini API are bounded by a 10.0-second timeout with an exponential backoff cap (max 2 retries) before falling back to curated offline templates.
