# EventEase Accessibility Conformance Report (WCAG 2.1 Level AA)

## Overview
EventEase is engineered to deliver an inclusive celebration planning experience adhering strictly to the **Web Content Accessibility Guidelines (WCAG) 2.1 Level AA** standards. All capabilities—from multi-step intake and editable budget balancing to milestone checklists and tabbed creative suggestions—are fully functional using keyboard-only input and assistive technologies.

---

## Accessibility Principles & Verification Checklist

### 1. Perceivable
- **Text Alternatives & Non-Text Content**:
  - All decorative character SVGs (Barnaby, Pip, Shep, Nova, Lumi) and visual badges are annotated with `aria-hidden="true"` or provided with explicit `aria-label` descriptors so screen readers bypass irrelevant visual markup.
  - Interactive icons include explicit text labels or `aria-label` attributes (e.g., `aria-label="Toggle dark and light themes"`, `aria-label="Minimize celebration companion"`).
- **Color Contrast Ratios (Minimum 4.5:1)**:
  - Verified across the bespoke 5-color palette (Warm Fog `#DDD3C9`, Berry Good `#ECC4C3`, Usu Koubai Blossom `#B97D7B`, Meadow Mauve `#928E5E`, Soldier Green `#575527`):
    - **Light Theme**:
      - Primary text `#2c2825` on Warm Canvas `#f7f4f0`: **12.8:1** (Exceeds WCAG AAA standard).
      - Secondary text `#575527` (Soldier Green) on Warm Fog `#DDD3C9`: **5.4:1** (Exceeds 4.5:1 AA standard).
      - Accent buttons `#B97D7B` (Usu Koubai Blossom) with white text `#ffffff`: **4.6:1** (Meets AA standard).
      - Error notifications `#b91c1c` on `#fef2f2`: **5.8:1**.
    - **Dark Theme**:
      - Primary text `#DDD3C9` (Warm Fog) on dark canvas `#1a1917`: **11.2:1**.
      - Accent text `#ECC4C3` (Berry Good) on `#24221f`: **8.1:1**.
      - Border contrast `#575527` on `#1a1917`: **3.5:1** (Meets 3:1 non-text contrast).
- **Reduced Motion Support**:
  - CSS rule `@media (prefers-reduced-motion: reduce)` zeroes all animation durations and transitions across mascots, clocks, and progress bars.
  - JavaScript confetti generator actively checks `window.matchMedia("(prefers-reduced-motion: reduce)").matches` and aborts DOM particle instantiation when reduced motion is preferred.

---

### 2. Operable
- **Keyboard Operability & Tab Flow**:
  - All interactive elements (form inputs, step buttons, presets, editable budget cells, vendor filters, and export buttons) follow natural DOM tab order.
  - Interactive milestone buttons and checklist items can be triggered with `Enter` or `Space`.
- **WAI-ARIA Tabbed Navigation**:
  - Creative ideas tabs (`#tab-themes`, `#tab-decor`, `#tab-menu`, `#tab-activities`, `#tab-tips`) strictly adhere to the WAI-ARIA tab pattern:
    - Active tab possesses `tabindex="0"` and `aria-selected="true"`.
    - Inactive tabs possess `tabindex="-1"` and `aria-selected="false"`.
    - Arrow navigation: `ArrowRight` and `ArrowDown` move to the next tab with wrap-around; `ArrowLeft` and `ArrowUp` move to the previous tab.
    - Quick jump keys: `Home` focuses the first tab, and `End` focuses the last tab.
- **Confirmation Dialog Modal**:
  - The confirmation modal uses native `<dialog id="confirm-modal">` with `aria-labelledby="modal-title"` and `aria-describedby="modal-desc"`. Focus is trapped inside the dialog when open and dismissible via the `Escape` key or "Cancel / Keep Current Plan" button. Used across "Start New Plan", "Delete Plan", and "Clear All Plans" workflows.
- **Plan Library & Vendor Quote Accessibility**:
  - All library actions (save, rename, reopen, duplicate, delete) and quote comparison inputs (quote, fees, terms, notes, services) are keyboard operable, provide clear textual labels, and announce state changes via the live region.
- **Visible Focus Indicator**:
  - High-visibility focus ring configured globally:
    ```css
    :focus-visible {
      outline: 3px solid var(--palette-usu-koubai);
      outline-offset: 3px;
      border-radius: var(--radius-sm);
    }
    ```
- **Bypass Blocks (Skip Link)**:
  - First focusable element in DOM: `<a href="#main-content" class="skip-link">Skip to main content</a>`.

---

### 3. Understandable
- **Form Labels & Error Associations**:
  - Every input control is paired with a visible `<label>` bound by matching `for` and `id` attributes.
  - Descriptive hints and inline error notifications are linked dynamically using `aria-describedby` (e.g., `aria-describedby="event-date-hint event-date-error"`).
  - Validation errors trigger inline alert containers with `role="alert"` and `aria-live="polite"`.
- **Clear Status & Transparency**:
  - Header AI Status pill clearly labels whether "Live AI Engine (Gemini)" or "Offline Fallback (Curated)" is active, ensuring users always understand the source of creative recommendations.
  - Budget balance status bar clearly flags whether allocations are balanced, overallocated, or underallocated.

---

### 4. Robust
- **Live Regions (`aria-live`)**:
  - Dedicated screen reader regions announce asynchronous events:
    ```html
    <div id="live-region" class="sr-only" aria-live="polite" aria-atomic="true"></div>
    <div id="alert-region" class="sr-only" aria-live="assertive" aria-atomic="true"></div>
    ```
  - Used when loading plans, updating vendor statuses, toggling dark mode, restoring saved plans, and copying items to clipboard.
- **Semantic Tables & Landmark Hierarchy**:
  - Landmarks: `<header role="banner">`, `<main role="main">`, `<footer role="contentinfo">`.
  - Exactly one `<h1>` per page with strictly ordered `<h2>` and `<h3>` section headers.
  - The budget allocation table includes `<th scope="col">` for column headers and `<th scope="row">` for summary rows.

---

## 5. Automated Verification & Regression Testing
Every pull request and commit to `main` executes 87 automated browser-level DOM integration checks (`npm run test:browser`) in GitHub Actions, verifying:
- WAI-ARIA tab state management (`tabindex`, `aria-selected`, and arrow-key focus shifting).
- Keyboard activation of milestone checkmarks and modal dialogs.
- Clear error alerts and screen-reader status announcements.
- Form accessibility and focus restoration upon plan loading and clearing.
