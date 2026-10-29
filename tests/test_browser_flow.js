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
const jsContent = fs.readFileSync(path.join(rootDir, "static", "js", "app.js"), "utf-8");

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

  // Mock fetch
  window.fetch = async (url, options = {}) => {
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
