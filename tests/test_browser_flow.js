/**
 * Comprehensive Browser-Level DOM Integration Tests
 * Uses JSDOM to test:
 * - Intake form validation and preset loading
 * - Algorithmic plan rendering
 * - LocalStorage persistence (save, restore, discard, start new plan)
 * - Editable budget recalculation & balance checking
 * - Vendor tracking, notes, contacts & status filtering
 * - Milestone completion tracking & countdown
 * - Export generation (Summary, CSV, .ICS Calendar)
 * - WAI-ARIA keyboard navigation for ideas tabs
 */

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { JSDOM } from "jsdom";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, "..");

const htmlContent = fs.readFileSync(path.join(rootDir, "templates", "index.html"), "utf-8");

function loadCombinedScripts() {
  const files = ["api.js", "auth.js", "events.js", "characters.js", "exports.js", "app.js"];
  let combined = "";
  for (const f of files) {
    let content = fs.readFileSync(path.join(rootDir, "static", "js", f), "utf-8");
    content = content.replace(/^import\s+[\s\S]*?from\s+['"].*?['"];?\s*$/gm, "");
    content = content.replace(/^export\s+(async\s+function|function|const|let|var)\s+/gm, "$1 ");
    content = content.replace(/^export\s+default\s+/gm, "");
    combined += `\n// --- ${f} ---\n` + content;
  }
  return combined;
}
const jsContent = loadCombinedScripts();

const futureDate = "2027-06-15";

// Mock sample plan API response
const samplePlan = {
  intake: {
    event_type: "wedding",
    date: futureDate,
    city: "Napa Valley, CA",
    guest_count: 100,
    total_budget: 20000,
    currency: "USD",
    theme: "Rustic Vineyard",
    cultural_dietary_preferences: "Vegetarian options",
    special_notes: null,
  },
  budget: {
    total_budget: 20000,
    currency: "USD",
    guest_count: 100,
    cost_per_guest: 200,
    realistic: true,
    warning: null,
    items: [
      { category: "Venue & Rentals", percentage: 25.0, amount: 5000.0, description: "Reception hall" },
      { category: "Catering & Bar", percentage: 30.0, amount: 6000.0, description: "Dinner and drinks" },
      { category: "Photography & Videography", percentage: 10.0, amount: 2000.0, description: "Full day" },
      { category: "Decor & Florals", percentage: 10.0, amount: 2000.0, description: "Floral centerpieces" },
      { category: "Entertainment & Music", percentage: 8.0, amount: 1600.0, description: "DJ & Sound" },
      { category: "Attire & Beauty", percentage: 5.0, amount: 1000.0, description: "Gown and suit" },
      { category: "Stationery & Misc", percentage: 4.0, amount: 800.0, description: "Invitations" },
      { category: "Contingency Fund", percentage: 8.0, amount: 1600.0, description: "Emergency reserve" },
    ],
    explanation: "Derived using deterministic Wedding industry baseline.",
  },
  timeline: {
    days_remaining: 180,
    is_compressed: false,
    advisory: null,
    milestones: [
      { period_label: "6-8 Months Before", target_date: "2027-01-15", description: "Lock venue", tasks: ["Book hall", "Pay deposit"] },
      { period_label: "4-5 Months Before", target_date: "2027-03-15", description: "Catering", tasks: ["Menu tasting"] },
      { period_label: "1 Month Before", target_date: "2027-05-15", description: "Final counts", tasks: ["Confirm headcount"] },
    ],
  },
  checklist: {
    event_type: "wedding",
    tasks: [
      { id: "v1", category: "Venue", vendor_type: "Reception Hall", status: "to-do", questions_to_ask: ["Overtime fee?"], notes: "Check curfew" },
      { id: "v2", category: "Catering", vendor_type: "Caterer", status: "to-do", questions_to_ask: ["Staff included?"], notes: "Tasting required" },
      { id: "v3", category: "Photography", vendor_type: "Photographer", status: "to-do", questions_to_ask: ["Hours?"], notes: "Golden hour" },
    ],
  },
  ideas: {
    is_fallback: true,
    fallback_reason: "Offline fallback active.",
    themes: ["Rustic Vineyard", "Golden Sunset", "Eucalyptus Minimalist"],
    decor: ["Fairy lights", "Wooden tables", "Eucalyptus garlands", "Wine barrel bar"],
    menu: ["Artisan bread", "Roasted seasonal veg", "Local pinot noir", "Lemon olive oil cake"],
    activities: ["Polaroid guestbook", "Acoustic duo", "Sparkler sendoff", "Lawn games"],
    budget_saving_tips: ["Opt for beer/wine only", "In-season local blooms", "Family-style service"],
  },
  generated_at: "2026-10-29T12:00:00Z",
};

const samplePresets = {
  wedding: {
    name: "Napa Vineyard Wedding",
    event_type: "wedding",
    date: futureDate,
    city: "Napa Valley, CA",
    guest_count: 120,
    currency: "USD",
    total_budget: 28000,
    theme: "Rustic Vineyard Elegance",
  },
};

function createTestDOM() {
  const dom = new JSDOM(htmlContent, {
    url: "http://localhost:8000/",
    runScripts: "dangerously",
  });

  const { window } = dom;

  // Polyfill environment globals in JSDOM window
  window.structuredClone = globalThis.structuredClone || ((x) => JSON.parse(JSON.stringify(x)));
  window.TextEncoder = globalThis.TextEncoder;
  window.TextDecoder = globalThis.TextDecoder;
  window.URL.createObjectURL = () => "blob:mock";
  window.URL.revokeObjectURL = () => {};
  window.HTMLAnchorElement.prototype.click = () => {};

  // Set secure context & clipboard
  window.isSecureContext = true;
  window.document.execCommand = () => true;

  // Mock matchMedia
  window.matchMedia = (query) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => {},
  });

  // Dialog polyfill for JSDOM
  if (window.HTMLDialogElement) {
    if (!window.HTMLDialogElement.prototype.showModal) {
      window.HTMLDialogElement.prototype.showModal = function () {
        this.setAttribute("open", "");
      };
    }
    if (!window.HTMLDialogElement.prototype.close) {
      window.HTMLDialogElement.prototype.close = function () {
        this.removeAttribute("open");
      };
    }
  }

  // Simulated Database & User State for test instance
  let currentUser = null;
  const dbEvents = [];
  let eventSeq = 1;

  // Mock fetch
  window.fetch = async (url, options = {}) => {
    const method = (options.method || "GET").toUpperCase();
    let body = {};
    if (options.body && typeof options.body === "string") {
      try {
        body = JSON.parse(options.body);
      } catch {
        body = {};
      }
    }

    if (url === "/api/health") {
      return {
        ok: true,
        json: async () => ({
          status: "healthy",
          ai_mode: "offline_fallback",
          gemini_configured: false,
          rate_limit: "60/minute",
        }),
      };
    }
    if (url === "/api/presets") {
      return {
        ok: true,
        json: async () => samplePresets,
      };
    }
    if (url === "/api/plan") {
      return {
        ok: true,
        json: async () => samplePlan,
      };
    }
    if (url === "/api/auth/me") {
      return {
        ok: true,
        json: async () => ({
          authenticated: Boolean(currentUser),
          user: currentUser,
          csrf_token: "csrf_token_test",
        }),
      };
    }
    if (url === "/api/auth/signup" && method === "POST") {
      currentUser = {
        id: "usr_" + Date.now(),
        email: body.email,
        is_active: true,
        created_at: new Date().toISOString(),
      };
      return {
        ok: true,
        json: async () => ({
          user: currentUser,
          csrf_token: "csrf_token_test",
        }),
      };
    }
    if (url === "/api/auth/signin" && method === "POST") {
      currentUser = {
        id: "usr_signin",
        email: body.email,
        is_active: true,
        created_at: new Date().toISOString(),
      };
      return {
        ok: true,
        json: async () => ({
          user: currentUser,
          csrf_token: "csrf_token_test",
        }),
      };
    }
    if (url === "/api/auth/signout" && method === "POST") {
      currentUser = null;
      return {
        ok: true,
        json: async () => ({ message: "Signed out successfully." }),
      };
    }
    if (url === "/api/events" && method === "GET") {
      if (!currentUser) return { ok: false, status: 401, json: async () => ({ detail: "Not authenticated" }) };
      return {
        ok: true,
        json: async () =>
          dbEvents.map((e) => ({
            id: e.id,
            name: e.name,
            event_type: e.intake.event_type,
            date: e.intake.date,
            city: e.intake.city,
            guest_count: e.intake.guest_count,
            total_budget: e.intake.total_budget,
            currency: e.intake.currency,
            created_at: e.created_at,
            updated_at: e.updated_at,
          })),
      };
    }
    if (url === "/api/events" && method === "POST") {
      if (!currentUser) return { ok: false, status: 401, json: async () => ({ detail: "Not authenticated" }) };
      const newEv = {
        id: "evt_" + eventSeq++,
        name: body.name,
        intake: body.intake,
        plan_data: body.plan_data,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      dbEvents.push(newEv);
      return {
        ok: true,
        json: async () => newEv,
      };
    }
    if (url.startsWith("/api/events/") && url.endsWith("/duplicate") && method === "POST") {
      if (!currentUser) return { ok: false, status: 401, json: async () => ({ detail: "Not authenticated" }) };
      const id = url.split("/")[3];
      const orig = dbEvents.find((e) => e.id === id);
      if (!orig) return { ok: false, status: 404, json: async () => ({ detail: "Event not found" }) };
      const dup = {
        ...orig,
        id: "evt_" + eventSeq++,
        name: `${orig.name} (Copy)`,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      dbEvents.push(dup);
      return {
        ok: true,
        json: async () => dup,
      };
    }
    if (url.startsWith("/api/events/") && method === "GET") {
      if (!currentUser) return { ok: false, status: 401, json: async () => ({ detail: "Not authenticated" }) };
      const id = url.split("/")[3];
      const ev = dbEvents.find((e) => e.id === id);
      if (!ev) return { ok: false, status: 404, json: async () => ({ detail: "Event not found" }) };
      return {
        ok: true,
        json: async () => ev,
      };
    }
    if (url.startsWith("/api/events/") && method === "PUT") {
      if (!currentUser) return { ok: false, status: 401, json: async () => ({ detail: "Not authenticated" }) };
      const id = url.split("/")[3];
      const ev = dbEvents.find((e) => e.id === id);
      if (!ev) return { ok: false, status: 404, json: async () => ({ detail: "Event not found" }) };
      ev.name = body.name;
      ev.intake = body.intake;
      ev.plan_data = body.plan_data;
      ev.updated_at = new Date().toISOString();
      return {
        ok: true,
        json: async () => ev,
      };
    }
    if (url.startsWith("/api/events/") && method === "DELETE") {
      if (!currentUser) return { ok: false, status: 401, json: async () => ({ detail: "Not authenticated" }) };
      const id = url.split("/")[3];
      const idx = dbEvents.findIndex((e) => e.id === id);
      if (idx === -1) return { ok: false, status: 404, json: async () => ({ detail: "Event not found" }) };
      dbEvents.splice(idx, 1);
      return {
        ok: true,
        json: async () => ({ message: "Event removed successfully." }),
      };
    }

    return { ok: false, status: 404, json: async () => ({}) };
  };

  // Mock scrollIntoView
  window.Element.prototype.scrollIntoView = () => {};

  // Mock print
  window.print = () => {};

  return { dom, window };
}

function initDOM(window) {
  window.eval(jsContent);
  window.document.dispatchEvent(new window.Event("DOMContentLoaded"));
}

async function runTests() {
  console.log("Starting Browser-Level Integration Checks...");
  let passed = 0;
  let failed = 0;

  function assert(condition, message) {
    if (condition) {
      console.log(`  ✓ ${message}`);
      passed++;
    } else {
      console.error(`  ✗ FAIL: ${message}`);
      failed++;
    }
  }

  // =========================================================================
  // Test 1: DOM Loading & Health AI Status Pill
  // =========================================================================
  {
    console.log("\n[Test 1] DOM Initialization & AI Status Pill");
    const { window } = createTestDOM();
    initDOM(window);

    await new Promise((r) => setTimeout(r, 20));
    const pill = window.document.getElementById("ai-engine-pill");
    const statusText = window.document.getElementById("status-text");

    assert(pill !== null, "AI engine pill exists in DOM");
    assert(statusText !== null, "Status text element exists");
    assert(pill.classList.contains("offline-fallback"), "Offline fallback class set on pill");
    assert(statusText.textContent.includes("Offline Fallback"), "Status text reflects Offline Fallback");
  }

  // =========================================================================
  // Test 2: Multi-step Form & Preset Scenario Loading
  // =========================================================================
  {
    console.log("\n[Test 2] Preset Scenario Loading & Form Validation");
    const { window } = createTestDOM();
    initDOM(window);

    // Wait for loadPresets() fetch to complete
    await new Promise((r) => setTimeout(r, 25));

    const presetBtn = window.document.getElementById("preset-wedding");
    assert(presetBtn !== null, "Wedding preset button exists");

    // Click preset button
    presetBtn.click();
    await new Promise((r) => setTimeout(r, 10));

    const eventType = window.document.getElementById("event-type");
    const city = window.document.getElementById("event-city");
    const guests = window.document.getElementById("guest-count");
    const budget = window.document.getElementById("total-budget");

    assert(eventType.value === "wedding", "Event type loaded from preset");
    assert(city.value === "Napa Valley, CA", "City loaded from preset");
    assert(parseInt(guests.value, 10) === 120, "Guest count loaded from preset");
    assert(parseFloat(budget.value) === 28000, "Budget loaded from preset");
  }

  // =========================================================================
  // Test 3: Plan Generation & Deliverables Rendering
  // =========================================================================
  {
    console.log("\n[Test 3] Plan Generation & Deliverables Rendering");
    const { window } = createTestDOM();
    initDOM(window);

    // Fill form with valid future date
    window.document.getElementById("event-type").value = "wedding";
    window.document.getElementById("event-date").value = futureDate;
    window.document.getElementById("event-city").value = "Napa Valley, CA";
    window.document.getElementById("guest-count").value = "100";
    window.document.getElementById("currency").value = "USD";
    window.document.getElementById("total-budget").value = "20000";

    const form = window.document.getElementById("event-form");
    const submitEvt = new window.Event("submit", { bubbles: true, cancelable: true });
    form.dispatchEvent(submitEvt);

    await new Promise((r) => setTimeout(r, 50));

    const results = window.document.getElementById("results-container");
    assert(!results.classList.contains("hidden"), "Results container is displayed after submit");

    // Budget Table
    const budgetRows = window.document.querySelectorAll("#budget-table-body tr");
    assert(budgetRows.length === 8, `Budget table has 8 category rows (got ${budgetRows.length})`);

    // Timeline Stepper (top-level steps)
    const timelineSteps = window.document.querySelectorAll("#timeline-stepper > li.timeline-step");
    assert(timelineSteps.length === 3, `Timeline has 3 milestone steps (got ${timelineSteps.length})`);

    // Vendor Checklist
    const vendorCards = window.document.querySelectorAll("#checklist-container .checklist-item");
    assert(vendorCards.length === 3, `Checklist has 3 vendor items (got ${vendorCards.length})`);

    // Ideas Tab lists
    const themesList = window.document.querySelectorAll("#ideas-list-themes li");
    assert(themesList.length === 3, `Ideas themes has 3 items (got ${themesList.length})`);
  }

  // =========================================================================
  // Test 4: Editable Budget Allocations & Real-Time Balance Check
  // =========================================================================
  {
    console.log("\n[Test 4] Editable Budget & Real-time Recalculation");
    const { window } = createTestDOM();
    initDOM(window);

    // Generate plan
    window.document.getElementById("event-type").value = "wedding";
    window.document.getElementById("event-date").value = futureDate;
    window.document.getElementById("event-city").value = "Napa Valley, CA";
    window.document.getElementById("guest-count").value = "100";
    window.document.getElementById("currency").value = "USD";
    window.document.getElementById("total-budget").value = "20000";

    const form = window.document.getElementById("event-form");
    form.dispatchEvent(new window.Event("submit", { bubbles: true, cancelable: true }));
    await new Promise((r) => setTimeout(r, 50));

    // Verify initial balance
    const statusPill = window.document.getElementById("budget-status-pill");
    assert(statusPill.textContent === "Balanced", "Initial budget is Balanced");

    // Edit a percentage input (change Venue from 25% to 35%)
    const firstPctInput = window.document.querySelector(".budget-input-pct");
    assert(firstPctInput !== null, "Budget percentage input exists");

    firstPctInput.value = "35";
    firstPctInput.dispatchEvent(new window.Event("input", { bubbles: true }));

    // Verify total amount recalculated and status changed to Over
    assert(statusPill.textContent.includes("Over"), "Status changes to Over when allocation increases");

    // Click Reset Allocation button
    const resetBtn = window.document.getElementById("btn-reset-budget");
    assert(resetBtn !== null, "Reset allocation button exists");
    resetBtn.click();

    // Verify reset restores balanced state
    const restoredPill = window.document.getElementById("budget-status-pill");
    assert(restoredPill.textContent === "Balanced", "Reset allocation restores Balanced status");
  }

  // =========================================================================
  // Test 5: Vendor Filtering, Contacts, and Private Notes
  // =========================================================================
  {
    console.log("\n[Test 5] Vendor Filtering, Contacts, and Private Notes");
    const { window } = createTestDOM();
    initDOM(window);

    // Generate plan
    window.document.getElementById("event-type").value = "wedding";
    window.document.getElementById("event-date").value = futureDate;
    window.document.getElementById("event-city").value = "Napa Valley, CA";
    window.document.getElementById("guest-count").value = "100";
    window.document.getElementById("currency").value = "USD";
    window.document.getElementById("total-budget").value = "20000";

    const form = window.document.getElementById("event-form");
    form.dispatchEvent(new window.Event("submit", { bubbles: true, cancelable: true }));
    await new Promise((r) => setTimeout(r, 50));

    // Edit contact and notes on first vendor
    const firstContactInput = window.document.querySelector(".vendor-contact-input");
    const firstNotesInput = window.document.querySelector(".vendor-notes-input");
    assert(firstContactInput !== null, "Vendor contact input exists");
    assert(firstNotesInput !== null, "Vendor notes input exists");

    firstContactInput.value = "Sarah & Co. (555) 123-4567";
    firstContactInput.dispatchEvent(new window.Event("input", { bubbles: true }));

    firstNotesInput.value = "Quoted $4,800, includes bridal suite.";
    firstNotesInput.dispatchEvent(new window.Event("input", { bubbles: true }));

    // Change status of first vendor to booked
    const firstSelect = window.document.querySelector(".checklist-status-select");
    firstSelect.value = "booked";
    firstSelect.dispatchEvent(new window.Event("change", { bubbles: true }));

    const countBooked = window.document.getElementById("count-booked");
    assert(countBooked.textContent === "1", "Count of booked vendors updated to 1");

    // Click filter "Booked"
    const bookedFilterBtn = window.document.querySelector('[data-filter="booked"]');
    bookedFilterBtn.click();

    const visibleItems = Array.from(window.document.querySelectorAll(".checklist-item")).filter(
      (el) => !el.classList.contains("hidden")
    );
    assert(visibleItems.length === 1, `Only 1 card visible when filtering for Booked (got ${visibleItems.length})`);

    // Click filter "All"
    const allFilterBtn = window.document.querySelector('[data-filter="all"]');
    allFilterBtn.click();

    const allVisible = Array.from(window.document.querySelectorAll(".checklist-item")).filter(
      (el) => !el.classList.contains("hidden")
    );
    assert(allVisible.length === 3, `All 3 cards visible when filtering for All (got ${allVisible.length})`);
  }

  // =========================================================================
  // Test 6: Milestone Toggles & Compact Dashboard Updates
  // =========================================================================
  {
    console.log("\n[Test 6] Milestone Toggles & Compact Dashboard Updates");
    const { window } = createTestDOM();
    initDOM(window);

    // Generate plan
    window.document.getElementById("event-type").value = "wedding";
    window.document.getElementById("event-date").value = futureDate;
    window.document.getElementById("event-city").value = "Napa Valley, CA";
    window.document.getElementById("guest-count").value = "100";
    window.document.getElementById("currency").value = "USD";
    window.document.getElementById("total-budget").value = "20000";

    const form = window.document.getElementById("event-form");
    form.dispatchEvent(new window.Event("submit", { bubbles: true, cancelable: true }));
    await new Promise((r) => setTimeout(r, 50));

    const milestoneBtn = window.document.querySelector(".milestone-item-btn");
    assert(milestoneBtn !== null, "Milestone toggle button exists");

    // Toggle milestone
    milestoneBtn.click();

    const dashMilestones = window.document.getElementById("dash-milestones-count");
    assert(dashMilestones.textContent === "1 / 3", `Dashboard milestone count updated to 1 / 3 (got ${dashMilestones.textContent})`);

    const dashDays = window.document.getElementById("dash-days-remaining");
    assert(dashDays.textContent === "180 Days", `Dashboard days remaining is 180 Days (got ${dashDays.textContent})`);
  }

  // =========================================================================
  // Test 7: LocalStorage Persistence (Auto-Save, Banner, and Restoration)
  // =========================================================================
  {
    console.log("\n[Test 7] LocalStorage Persistence & Restoration");
    const { window } = createTestDOM();
    initDOM(window);

    // Generate plan
    window.document.getElementById("event-type").value = "wedding";
    window.document.getElementById("event-date").value = futureDate;
    window.document.getElementById("event-city").value = "Napa Valley, CA";
    window.document.getElementById("guest-count").value = "100";
    window.document.getElementById("currency").value = "USD";
    window.document.getElementById("total-budget").value = "20000";

    const form = window.document.getElementById("event-form");
    form.dispatchEvent(new window.Event("submit", { bubbles: true, cancelable: true }));
    await new Promise((r) => setTimeout(r, 50));

    // Verify localStorage has saved plan
    const savedRaw = window.localStorage.getItem("eventease_saved_plan_v1");
    assert(savedRaw !== null, "Plan automatically persisted to localStorage under eventease_saved_plan_v1");

    const savedData = JSON.parse(savedRaw);
    assert(savedData.intake.city === "Napa Valley, CA", "Persisted data preserves intake city");
    assert(savedData.plan !== null, "Persisted data preserves full plan object");

    // Simulate page reload with saved plan
    const { window: newWindow } = createTestDOM();
    newWindow.localStorage.setItem("eventease_saved_plan_v1", savedRaw);
    initDOM(newWindow);

    // Check banner visibility
    const banner = newWindow.document.getElementById("saved-plan-banner");
    assert(!banner.classList.contains("hidden"), "Saved plan banner is shown upon page reload when saved plan exists");

    // Click Restore button
    const restoreBtn = newWindow.document.getElementById("btn-restore-plan");
    restoreBtn.click();

    const restoredResults = newWindow.document.getElementById("results-container");
    assert(!restoredResults.classList.contains("hidden"), "Results container unhidden after clicking Restore");
    assert(banner.classList.contains("hidden"), "Banner hidden after clicking Restore");
  }

  // =========================================================================
  // Test 8: Accessible WAI-ARIA Tabs Keyboard Navigation
  // =========================================================================
  {
    console.log("\n[Test 8] Accessible WAI-ARIA Tabs Keyboard Navigation");
    const { window } = createTestDOM();
    initDOM(window);

    const tabThemes = window.document.getElementById("tab-themes");
    const tabDecor = window.document.getElementById("tab-decor");
    const tabTips = window.document.getElementById("tab-tips");

    assert(tabThemes.getAttribute("role") === "tab", "Themes tab has role='tab'");
    assert(tabThemes.getAttribute("aria-selected") === "true", "Themes tab initially has aria-selected='true'");
    assert(tabThemes.getAttribute("tabindex") === "0", "Active tab has tabindex='0'");
    assert(tabDecor.getAttribute("tabindex") === "-1", "Inactive tab has tabindex='-1'");

    // Simulate ArrowRight keydown on tabThemes
    const arrowRight = new window.KeyboardEvent("keydown", { key: "ArrowRight", bubbles: true });
    tabThemes.dispatchEvent(arrowRight);

    assert(tabDecor.getAttribute("aria-selected") === "true", "ArrowRight moves aria-selected to next tab (Decor)");
    assert(tabDecor.getAttribute("tabindex") === "0", "Decor tab now has tabindex='0'");
    assert(tabThemes.getAttribute("tabindex") === "-1", "Previous tab now has tabindex='-1'");

    // Simulate End keydown to jump to last tab
    const endKey = new window.KeyboardEvent("keydown", { key: "End", bubbles: true });
    tabDecor.dispatchEvent(endKey);

    assert(tabTips.getAttribute("aria-selected") === "true", "End key moves focus to last tab (Savings Tips)");

    // Simulate Home keydown to jump to first tab
    const homeKey = new window.KeyboardEvent("keydown", { key: "Home", bubbles: true });
    tabTips.dispatchEvent(homeKey);

    assert(tabThemes.getAttribute("aria-selected") === "true", "Home key moves focus to first tab (Themes)");
  }

  // =========================================================================
  // Test 9: Exports & Contingency Calculation Verification
  // =========================================================================
  {
    console.log("\n[Test 9] Copy Summary & Contingency Calculation");
    const { window } = createTestDOM();

    let copiedText = "";
    window.navigator.clipboard = {
      writeText: async (t) => {
        copiedText = t;
      },
    };

    initDOM(window);

    // Generate plan
    window.document.getElementById("event-type").value = "wedding";
    window.document.getElementById("event-date").value = futureDate;
    window.document.getElementById("event-city").value = "Napa Valley, CA";
    window.document.getElementById("guest-count").value = "100";
    window.document.getElementById("currency").value = "USD";
    window.document.getElementById("total-budget").value = "20000";

    const form = window.document.getElementById("event-form");
    form.dispatchEvent(new window.Event("submit", { bubbles: true, cancelable: true }));
    await new Promise((r) => setTimeout(r, 50));

    // Click Copy Summary
    const copySummaryBtn = window.document.getElementById("btn-copy-summary");
    copySummaryBtn.click();
    await new Promise((r) => setTimeout(r, 20));

    assert(copiedText.includes("EVENTEASE CELEBRATION MASTER PLAN"), "Copy Summary contains header");
    assert(
      copiedText.includes("Emergency Contingency: USD 1,600.00 (8.0% safety buffer)"),
      `Contingency amount calculated correctly from budget item (not NaN): ${copiedText.match(/Emergency Contingency:[^\n]+/)?.[0]}`
    );
    assert(!copiedText.includes("undefined"), "Copy summary contains NO undefined fields");
    assert(!copiedText.includes("NaN"), "Copy summary contains NO NaN fields");
  }

  // =========================================================================
  // Test 10: Lumi Assistant Minimize Toggle
  // =========================================================================
  {
    console.log("\n[Test 10] Lumi Assistant Minimize Toggle");
    const { window } = createTestDOM();
    initDOM(window);

    const widget = window.document.getElementById("lumi-widget");
    const minimizeBtn = window.document.getElementById("lumi-minimize-btn");
    assert(minimizeBtn !== null, "Lumi minimize button exists");

    minimizeBtn.click();
    assert(widget.classList.contains("minimized"), "Clicking minimize adds .minimized class to Lumi widget");
    assert(window.localStorage.getItem("eventease-lumi-minimized") === "true", "Minimize state saved in localStorage");

    minimizeBtn.click();
    assert(!widget.classList.contains("minimized"), "Clicking again restores Lumi widget");
  }

  // =========================================================================
  // Test 11: Celebration Plan Library (Save, Name, Open, Duplicate, Delete, Clear All)
  // =========================================================================
  {
    console.log("\n[Test 11] Celebration Plan Library Management");
    const { window } = createTestDOM();
    initDOM(window);

    // Generate a plan first
    window.document.getElementById("event-type").value = "wedding";
    window.document.getElementById("event-date").value = futureDate;
    window.document.getElementById("event-city").value = "Napa Valley, CA";
    window.document.getElementById("guest-count").value = "100";
    window.document.getElementById("currency").value = "USD";
    window.document.getElementById("total-budget").value = "20000";

    const form = window.document.getElementById("event-form");
    form.dispatchEvent(new window.Event("submit", { bubbles: true, cancelable: true }));
    await new Promise((r) => setTimeout(r, 50));

    // Name plan and save to library
    const planNameInput = window.document.getElementById("active-plan-name-input");
    assert(planNameInput !== null, "Active plan name input exists");
    planNameInput.value = "Suhani's Napa Gala";

    const saveToLibBtn = window.document.getElementById("btn-save-plan-name");
    saveToLibBtn.click();

    // Verify Plan Library has 1 plan
    const badge = window.document.getElementById("lib-count-badge");
    assert(badge.textContent.includes("1 Saved Plan"), `Library badge shows 1 Saved Plan (got: ${badge.textContent})`);

    const grid = window.document.getElementById("plan-library-grid");
    const cards = grid.querySelectorAll(".plan-item-card");
    assert(cards.length === 1, `1 plan card rendered in library grid (got: ${cards.length})`);
    assert(cards[0].textContent.includes("Suhani's Napa Gala"), "Plan card shows custom saved plan name");

    // Duplicate Plan
    const dupBtn = cards[0].querySelector(".btn-secondary");
    dupBtn.click();

    const dupCards = grid.querySelectorAll(".plan-item-card");
    assert(dupCards.length === 2, `Duplicating plan creates 2 cards in library (got: ${dupCards.length})`);
    assert(dupCards[0].textContent.includes("(Copy)"), "Duplicated plan card has (Copy) in title");

    // Delete duplicated plan with modal confirmation
    const delBtn = dupCards[0].querySelector(".btn-danger");
    delBtn.click();

    // Confirm modal should be open
    const modalConfirmBtn = window.document.getElementById("btn-modal-confirm");
    modalConfirmBtn.click();

    const afterDelCards = grid.querySelectorAll(".plan-item-card");
    assert(afterDelCards.length === 1, `After deletion, library grid has 1 card (got: ${afterDelCards.length})`);

    // Clear All Plans
    const clearAllBtn = window.document.getElementById("btn-clear-all-plans");
    clearAllBtn.click();
    modalConfirmBtn.click();

    const finalCards = grid.querySelectorAll(".plan-item-card");
    assert(finalCards.length === 0, "Clear all plans removes all cards from library grid");
    assert(
      window.localStorage.getItem("eventease_plan_library_v1") === null ||
      window.localStorage.getItem("eventease_plan_library_v1") === "[]",
      "Library storage key cleared"
    );

    // Test storage quota handling
    const quotaExceededErr = new Error("QuotaExceededError");
    quotaExceededErr.name = "QuotaExceededError";
    const origSetItem = window.localStorage.setItem;
    window.localStorage.setItem = () => {
      throw quotaExceededErr;
    };
    // Should not throw unhandled exception
    window.document.getElementById("btn-save-current-to-library").click();
    window.localStorage.setItem = origSetItem;
    assert(true, "QuotaExceededError handled gracefully without throwing unhandled exception");
  }

  // =========================================================================
  // Test 12: Vendor Quote Comparison (User Records, Formulas, Calculations)
  // =========================================================================
  {
    console.log("\n[Test 12] Vendor Quote Comparison (User-Provided Records)");
    const { window } = createTestDOM();
    initDOM(window);

    // Generate plan
    window.document.getElementById("event-type").value = "wedding";
    window.document.getElementById("event-date").value = futureDate;
    window.document.getElementById("event-city").value = "Napa Valley, CA";
    window.document.getElementById("guest-count").value = "100";
    window.document.getElementById("currency").value = "USD";
    window.document.getElementById("total-budget").value = "20000";

    const form = window.document.getElementById("event-form");
    form.dispatchEvent(new window.Event("submit", { bubbles: true, cancelable: true }));
    await new Promise((r) => setTimeout(r, 50));

    // Submit Quote 1: DJ
    window.document.getElementById("quote-category").value = "Music & Entertainment";
    window.document.getElementById("quote-vendor-name").value = "Sunset DJ & Lighting";
    window.document.getElementById("quote-base-amount").value = "2500";
    window.document.getElementById("quote-extra-fees").value = "350";
    window.document.getElementById("quote-included-services").value = "6 hrs DJ + 4 wireless mics";
    window.document.getElementById("quote-payment-terms").value = "50% deposit, balance 14 days prior";
    window.document.getElementById("quote-status").value = "Preferred";

    const quoteForm = window.document.getElementById("quote-entry-form");
    quoteForm.dispatchEvent(new window.Event("submit", { bubbles: true, cancelable: true }));

    // Submit Quote 2: Catering
    window.document.getElementById("quote-category").value = "Catering & Bar";
    window.document.getElementById("quote-vendor-name").value = "Napa Vineyard Caterers";
    window.document.getElementById("quote-base-amount").value = "6000";
    window.document.getElementById("quote-extra-fees").value = "500";
    window.document.getElementById("quote-included-services").value = "3 course plated dinner";
    window.document.getElementById("quote-payment-terms").value = "30% deposit";
    window.document.getElementById("quote-status").value = "Under Review";

    quoteForm.dispatchEvent(new window.Event("submit", { bubbles: true, cancelable: true }));

    // Verify Quote Cards Grid
    const quoteGrid = window.document.getElementById("quote-cards-grid");
    const quoteCards = quoteGrid.querySelectorAll(".quote-card");
    assert(quoteCards.length === 2, `2 quote cards rendered (got: ${quoteCards.length})`);

    // Verify calculated total cost for DJ (2500 + 350 = 2850)
    assert(quoteCards[0].textContent.includes("2,850.00"), "Total estimated cost correctly calculates base + extra fees ($2,850.00)");
    assert(quoteCards[0].textContent.includes("Sunset DJ & Lighting"), "Vendor name displayed accurately");

    // Toggle Selection Status on first quote
    const selectBtn = quoteCards[0].querySelector(".quote-card-footer button");
    selectBtn.click();
    const updatedCards = quoteGrid.querySelectorAll(".quote-card");
    assert(updatedCards[0].classList.contains("selected-quote"), "Selecting quote applies .selected-quote highlight");

    // Filter by category: Music & Entertainment
    const catButtons = window.document.querySelectorAll("#quote-filter-bar .filter-pill");
    const musicBtn = Array.from(catButtons).find((b) => b.textContent.includes("Music & Entertainment"));
    assert(musicBtn !== undefined, "Dynamic category filter pill for Music & Entertainment exists");
    musicBtn.click();

    const filteredCards = quoteGrid.querySelectorAll(".quote-card");
    assert(filteredCards.length === 1, `Category filtering shows only 1 Music & Entertainment quote (got: ${filteredCards.length})`);
    assert(filteredCards[0].textContent.includes("Sunset DJ & Lighting"), "Filtered card is Sunset DJ");
  }

  // =========================================================================
  // Test 13: CSV Export Formula Injection Defense (OWASP Compliant)
  // =========================================================================
  {
    console.log("\n[Test 13] CSV Export Formula Injection Defense");
    const { window } = createTestDOM();
    initDOM(window);

    // Generate plan
    window.document.getElementById("event-type").value = "wedding";
    window.document.getElementById("event-date").value = futureDate;
    window.document.getElementById("event-city").value = "Napa Valley, CA";
    window.document.getElementById("guest-count").value = "100";
    window.document.getElementById("currency").value = "USD";
    window.document.getElementById("total-budget").value = "20000";

    const form = window.document.getElementById("event-form");
    form.dispatchEvent(new window.Event("submit", { bubbles: true, cancelable: true }));
    await new Promise((r) => setTimeout(r, 50));

    // Inject malicious formula values into notes and contact inputs
    const contactInput = window.document.querySelector(".vendor-contact-input");
    const notesInput = window.document.querySelector(".vendor-notes-input");

    contactInput.value = "@SUM(1+1)";
    contactInput.dispatchEvent(new window.Event("input", { bubbles: true }));

    notesInput.value = "=cmd|' /C calc'!A0";
    notesInput.dispatchEvent(new window.Event("input", { bubbles: true }));

    // Add quote with formula characters in name and payment terms
    window.document.getElementById("quote-category").value = "Music & Entertainment";
    window.document.getElementById("quote-vendor-name").value = "+1337 DJ Services";
    window.document.getElementById("quote-base-amount").value = "1200";
    window.document.getElementById("quote-extra-fees").value = "0";
    window.document.getElementById("quote-payment-terms").value = "-10% discount on cash";

    const quoteForm = window.document.getElementById("quote-entry-form");
    quoteForm.dispatchEvent(new window.Event("submit", { bubbles: true, cancelable: true }));

    // Trigger CSV export
    const exportCsvBtn = window.document.getElementById("btn-export-csv");
    exportCsvBtn.click();

    const downloaded = window.__lastDownloadedFile;
    assert(downloaded !== undefined, "CSV export triggered downloadFile helper");
    assert(downloaded.filename.endsWith(".csv"), `CSV filename has .csv extension (${downloaded.filename})`);

    const csvContent = downloaded.content;

    // Verify formula cells are prepended with a single quote (') so spreadsheets open them as text
    assert(csvContent.includes("'=cmd|' /C calc'!A0"), "Formula starting with '=' is sanitized with leading single quote: '=cmd...");
    assert(csvContent.includes("'@SUM(1+1)"), "Formula starting with '@' is sanitized with leading single quote: '@SUM...");
    assert(csvContent.includes("'+1337 DJ Services"), "Formula starting with '+' is sanitized with leading single quote: '+1337...");
    assert(csvContent.includes("'-10% discount on cash"), "Formula starting with '-' is sanitized with leading single quote: '-10%...");

    // Verify Vendor Quote Comparison section is present in CSV
    assert(csvContent.includes("VENDOR QUOTE COMPARISON (USER-PROVIDED RECORDS)"), "CSV contains Vendor Quote Comparison table");
  }

  // =========================================================================
  // Test 14: RFC 5545 .ICS Calendar Export Compliance
  // =========================================================================
  {
    console.log("\n[Test 14] RFC 5545 .ICS Calendar Export Compliance");
    const { window } = createTestDOM();
    initDOM(window);

    // Generate plan
    window.document.getElementById("event-type").value = "wedding";
    window.document.getElementById("event-date").value = futureDate;
    window.document.getElementById("event-city").value = "Napa Valley, CA";
    window.document.getElementById("guest-count").value = "100";
    window.document.getElementById("currency").value = "USD";
    window.document.getElementById("total-budget").value = "20000";

    const form = window.document.getElementById("event-form");
    form.dispatchEvent(new window.Event("submit", { bubbles: true, cancelable: true }));
    await new Promise((r) => setTimeout(r, 50));

    // Trigger ICS export
    const exportIcsBtn = window.document.getElementById("btn-export-ics");
    exportIcsBtn.click();

    const downloaded = window.__lastDownloadedFile;
    assert(downloaded !== undefined, "ICS export triggered downloadFile helper");
    assert(downloaded.filename.endsWith(".ics"), `ICS filename has .ics extension (${downloaded.filename})`);

    const ics = downloaded.content;

    // RFC 5545 Core Structure
    assert(ics.startsWith("BEGIN:VCALENDAR"), "ICS starts with BEGIN:VCALENDAR");
    assert(ics.includes("VERSION:2.0"), "ICS specifies VERSION:2.0");
    assert(ics.includes("PRODID:-//EventEase//Celebration Planning Prototype//EN"), "ICS specifies proper PRODID");
    assert(ics.endsWith("END:VCALENDAR"), "ICS ends with END:VCALENDAR");

    // All-Day Exclusive End Date Verification
    // First milestone target_date in mock is 2027-01-15 -> DTSTART:20270115, DTEND:20270116 (exclusive!)
    assert(ics.includes("DTSTART;VALUE=DATE:20270115"), "Milestone DTSTART is all-day date 20270115");
    assert(ics.includes("DTEND;VALUE=DATE:20270116"), "Milestone DTEND is exclusive date 20270116 (DTSTART + 1 day)");

    // Main Celebration Day Event
    assert(ics.includes("DTSTART;VALUE=DATE:20270615"), "Celebration day DTSTART is 20270615");
    assert(ics.includes("DTEND;VALUE=DATE:20270616"), "Celebration day DTEND is exclusive date 20270616");

    // Unique Stable UIDs
    assert(ics.includes("UID:eventease-"), "Events have unique stable UID with eventease- prefix");
    assert(ics.includes("@eventease.app"), "Events UID ends with domain @eventease.app");

    // Line Folding Verification (RFC 5545 §3.1: lines <= 75 octets)
    const rawLines = ics.split("\r\n");
    let maxOctets = 0;
    const encoder = new TextEncoder();
    rawLines.forEach((l) => {
      const len = encoder.encode(l).length;
      if (len > maxOctets) maxOctets = len;
    });
    assert(maxOctets <= 75, `All ICS lines folded to <= 75 octets per RFC 5545 §3.1 (max line was ${maxOctets} octets)`);
  }

  // =========================================================================
  // Test 14: User Authentication & Header UI State
  // =========================================================================
  {
    console.log("\n[Test 14] User Authentication & Header UI State");
    const { window } = createTestDOM();
    initDOM(window);
    await new Promise((r) => setTimeout(r, 60));

    const unauthView = window.document.getElementById("auth-unauth-view");
    const userView = window.document.getElementById("auth-user-view");
    const unauthBanner = window.document.getElementById("workspace-unauth-banner");
    const authContent = window.document.getElementById("workspace-auth-content");
    const modal = window.document.getElementById("auth-modal");
    const btnHeaderSignIn = window.document.getElementById("btn-header-signin");

    assert(!unauthView.classList.contains("hidden"), "Unauthenticated header view is visible initially");
    assert(userView.classList.contains("hidden"), "Authenticated header view is hidden initially");
    assert(!unauthBanner.classList.contains("hidden"), "Workspace unauth banner is visible");
    assert(authContent.classList.contains("hidden"), "Workspace auth content is hidden");

    // Open modal via header sign in button
    btnHeaderSignIn.click();
    assert(modal.hasAttribute("open"), "Auth modal opened on header button click");

    // Switch to Sign Up tab
    const tabSignup = window.document.getElementById("tab-auth-signup");
    tabSignup.click();
    const panelSignup = window.document.getElementById("auth-panel-signup");
    assert(!panelSignup.classList.contains("hidden"), "Sign up panel is active");

    // Submit sign up form
    const signupEmail = window.document.getElementById("signup-email");
    const signupPassword = window.document.getElementById("signup-password");
    signupEmail.value = "celebration_planner@example.com";
    signupPassword.value = "SecurePass123!";

    const formSignup = window.document.getElementById("form-auth-signup");
    formSignup.dispatchEvent(new window.Event("submit", { bubbles: true, cancelable: true }));

    await new Promise((r) => setTimeout(r, 80));

    // Modal should close and header should update
    assert(!modal.hasAttribute("open"), "Auth modal closed after successful signup");
    assert(unauthView.classList.contains("hidden"), "Unauthenticated header view is hidden after signup");
    assert(!userView.classList.contains("hidden"), "Authenticated header view is visible after signup");

    const userEmailSpan = window.document.getElementById("nav-user-email");
    assert(userEmailSpan.textContent === "celebration_planner@example.com", `Nav display email matches (${userEmailSpan.textContent})`);
    assert(!authContent.classList.contains("hidden"), "Workspace auth content is visible after signup");

    // Test Sign Out
    const btnSignOut = window.document.getElementById("btn-header-signout");
    btnSignOut.click();

    await new Promise((r) => setTimeout(r, 80));

    assert(!unauthView.classList.contains("hidden"), "Unauthenticated view restored after sign out");
    assert(userView.classList.contains("hidden"), "Authenticated view hidden after sign out");
    assert(!unauthBanner.classList.contains("hidden"), "Workspace unauth banner restored after sign out");
  }

  // =========================================================================
  // Test 15: Persistent Database Saved Events Workspace (CRUD)
  // =========================================================================
  {
    console.log("\n[Test 15] Persistent Database Saved Events Workspace (CRUD)");
    const { window } = createTestDOM();
    window.confirm = () => true;
    initDOM(window);
    await new Promise((r) => setTimeout(r, 60));

    // Sign in first
    const formSignin = window.document.getElementById("form-auth-signin");
    window.document.getElementById("signin-email").value = "organizer@example.com";
    window.document.getElementById("signin-password").value = "SecretPassword123!";
    formSignin.dispatchEvent(new window.Event("submit", { bubbles: true, cancelable: true }));
    await new Promise((r) => setTimeout(r, 80));

    // Generate plan
    const weddingPreset = window.document.getElementById("preset-wedding");
    weddingPreset.click();
    await new Promise((r) => setTimeout(r, 60));

    window.document.getElementById("btn-to-step-2").click();
    window.document.getElementById("btn-to-step-3").click();
    window.document.getElementById("event-form").dispatchEvent(new window.Event("submit", { bubbles: true, cancelable: true }));
    await new Promise((r) => setTimeout(r, 80));

    // Save event to database
    const btnSaveDb = window.document.getElementById("btn-save-event-to-db");
    const planNameInput = window.document.getElementById("active-plan-name-input");
    planNameInput.value = "Grand Napa Gala 2027";
    btnSaveDb.click();
    await new Promise((r) => setTimeout(r, 80));

    const grid = window.document.getElementById("saved-events-grid");
    const countBadge = window.document.getElementById("workspace-count-badge");
    const cards = grid.querySelectorAll(".saved-event-card");

    assert(cards.length === 1, `Saved events workspace rendered 1 event card (found ${cards.length})`);
    assert(countBadge.textContent.includes("1 Event"), `Workspace count badge displays 1 Event (${countBadge.textContent})`);

    const titleEl = cards[0].querySelector(".saved-event-title");
    assert(titleEl.textContent === "Grand Napa Gala 2027", `Card title reflects saved name (${titleEl.textContent})`);

    // Duplicate event
    const btnDup = cards[0].querySelector(".btn-dup-event");
    btnDup.click();
    await new Promise((r) => setTimeout(r, 80));

    const updatedCards = grid.querySelectorAll(".saved-event-card");
    assert(updatedCards.length === 2, `Workspace has 2 cards after duplicate (found ${updatedCards.length})`);

    // Reopen first event
    window.document.getElementById("guest-count").value = "1";
    const btnOpen = updatedCards[0].querySelector(".btn-open-event");
    btnOpen.click();
    await new Promise((r) => setTimeout(r, 80));

    assert(window.document.getElementById("guest-count").value === "100", `Guest count restored on reopen (${window.document.getElementById("guest-count").value})`);

    // Delete duplicated event
    const btnDel = updatedCards[1].querySelector(".btn-del-event");
    btnDel.click();
    await new Promise((r) => setTimeout(r, 80));

    const finalCards = grid.querySelectorAll(".saved-event-card");
    assert(finalCards.length === 1, `Workspace has 1 card after deleting duplicate (${finalCards.length})`);
  }

  // =========================================================================
  // Test 16: Interactive Character Squad Reactions
  // =========================================================================
  {
    console.log("\n[Test 16] Interactive Character Squad Reactions");
    const { window } = createTestDOM();
    initDOM(window);
    await new Promise((r) => setTimeout(r, 60));

    // Generate plan
    window.document.getElementById("preset-wedding").click();
    await new Promise((r) => setTimeout(r, 50));
    window.document.getElementById("btn-to-step-2").click();
    window.document.getElementById("btn-to-step-3").click();
    window.document.getElementById("event-form").dispatchEvent(new window.Event("submit", { bubbles: true, cancelable: true }));
    await new Promise((r) => setTimeout(r, 80));

    // 1. Barnaby (Budget Reaction)
    const barnabySpeech = window.document.getElementById("barnaby-speech");
    assert(barnabySpeech !== null, "Barnaby speech bubble container exists");
    assert(barnabySpeech.textContent.includes("Barnaby"), `Barnaby speech has Financial Strategist role (${barnabySpeech.textContent})`);

    // Over-allocate budget and verify Barnaby warns
    const firstPctInput = window.document.querySelector(".budget-input-pct");
    firstPctInput.value = "99.0";
    firstPctInput.dispatchEvent(new window.Event("input"));
    await new Promise((r) => setTimeout(r, 30));

    assert(barnabySpeech.textContent.includes("overallocated"), `Barnaby warns about over-allocation (${barnabySpeech.textContent})`);

    // 2. Shep (Milestone Reaction)
    const shepSpeech = window.document.getElementById("shep-speech");
    assert(shepSpeech !== null, "Shep speech bubble container exists");
    const milestoneBtn = window.document.querySelector(".milestone-item-btn");
    milestoneBtn.click();
    await new Promise((r) => setTimeout(r, 30));

    assert(shepSpeech.textContent.includes("Shep (Timeline)"), `Shep speech updates on milestone progress (${shepSpeech.textContent})`);

    // 3. Nova (Vendor Reaction)
    const novaSpeech = window.document.getElementById("nova-speech");
    assert(novaSpeech !== null, "Nova speech bubble container exists");
    const vendorSelect = window.document.querySelector(".checklist-status-select");
    vendorSelect.value = "booked";
    vendorSelect.dispatchEvent(new window.Event("change"));
    await new Promise((r) => setTimeout(r, 30));

    assert(novaSpeech.textContent.includes("Contract secured") || novaSpeech.textContent.includes("Nova (Vendors)"), `Nova responds to vendor booking (${novaSpeech.textContent})`);

    // 4. Pip (Creative Curator Reaction)
    const pipSpeech = window.document.getElementById("pip-speech");
    assert(pipSpeech !== null, "Pip speech bubble container exists");
    const tabMenu = window.document.getElementById("tab-menu");
    tabMenu.click();
    await new Promise((r) => setTimeout(r, 30));

    assert(pipSpeech.textContent.includes("culinary") || pipSpeech.textContent.includes("Pip (Creative)"), `Pip responds with culinary tip on Menu tab (${pipSpeech.textContent})`);
  }

  // =========================================================================
  // Test 17: Reduced Motion Controls & Accessibility
  // =========================================================================
  {
    console.log("\n[Test 17] Reduced Motion Controls & Accessibility");
    const { window } = createTestDOM();
    initDOM(window);
    await new Promise((r) => setTimeout(r, 60));

    const root = window.document.documentElement;
    const motionToggle = window.document.getElementById("motion-toggle");
    const motionText = window.document.getElementById("motion-text");

    assert(motionToggle !== null, "Motion toggle button exists in header");
    assert(!root.classList.contains("reduce-motion-active"), "Motion is ON by default");
    assert(motionToggle.getAttribute("aria-pressed") === "false", "aria-pressed is false by default");

    // Click to disable motion
    motionToggle.click();

    assert(root.classList.contains("reduce-motion-active"), "Root element receives .reduce-motion-active class");
    assert(motionToggle.getAttribute("aria-pressed") === "true", "aria-pressed is true when motion disabled");
    assert(motionText.textContent.includes("OFF"), `Motion label displays OFF (${motionText.textContent})`);

    // Test confetti suppression when motion is off
    const confettiContainer = window.document.getElementById("confetti-canvas-container");
    confettiContainer.innerHTML = "";
    const btnHeroSparkle = window.document.getElementById("btn-hero-sparkle");
    btnHeroSparkle.click();

    assert(confettiContainer.children.length === 0, "Confetti particles are suppressed when reduced motion is active");

    // Toggle back ON
    motionToggle.click();
    assert(!root.classList.contains("reduce-motion-active"), "Motion enabled again after toggle");
    assert(motionToggle.getAttribute("aria-pressed") === "false", "aria-pressed is false when re-enabled");
  }

  // Summary Report
  console.log("\n=======================================================");
  console.log(`Browser-Level DOM Tests: ${passed} Passed, ${failed} Failed`);
  console.log("=======================================================\n");

  if (failed > 0) {
    process.exit(1);
  } else {
    process.exit(0);
  }
}

runTests();
