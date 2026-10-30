/**
 * EventEase - Frontend Application Logic (ES Module)
 * WCAG 2.1 AA Compliant & Secure (strictly uses textContent for dynamic content)
 */

import { setupAuthUI, checkAuthStatus, onAuthStateChanged, openAuthModal, getCurrentUser } from './auth.js';
import { fetchUserEvents, fetchEventDetail, createDatabaseEvent, updateDatabaseEvent, duplicateDatabaseEvent, deleteDatabaseEvent, renderSavedEventsWorkspace, getActiveDatabaseEventId, setActiveDatabaseEventId } from './events.js';
import { setupCharacterWidgets, reactToBudget, reactToMilestone, reactToVendorBooking, reactToCreativeTab, triggerLumiReaction, triggerSparkles } from './characters.js';

// Application State
const state = {
  currentStep: 1,
  currentPlan: null,
  activePlanId: null,
  activePlanName: "",
  checklistStatusMap: {},
  vendorNotes: {},
  vendorContacts: {},
  completedMilestones: new Set(),
  budgetAllocations: [],
  vendorQuotes: [],
  activeQuoteFilter: "all",
  currentTipIndex: 0,
  activeVendorFilter: "all",
  aiStatus: { configured: false, mode: "offline_fallback" },
};

const STORAGE_KEY = "eventease_saved_plan_v1";
const LIBRARY_STORAGE_KEY = "eventease_plan_library_v1";

// Curated Planning Tips for Lumi
const planningTips = [
  "Did you know? Locking in an 8% emergency contingency buffer saves 92% of events from budget overruns! 💡",
  "When touring venues, always ask if cleanup and trash disposal are included in the rental fee! 🧹",
  "For catering, family-style or food truck catering can save 20-30% compared to traditional plated service! 🌮",
  "Always request a sample audio check during your vendor walkthrough to ensure acoustic limits match local noise ordinances! 🎶",
  "Photography golden hour is 45 minutes before sunset — schedule your couple or group portraits right then! 📸✨",
  "Planning backward from your event date guarantees high-demand vendors are booked before calendars fill up! 🗓️",
  "Always confirm whether your venue requires certified or licensed bartenders for alcohol service! 🍷",
];

// DOM Element Selectors
const elements = {
  themeToggle: document.getElementById("theme-toggle"),
  themeIcon: document.getElementById("theme-icon"),
  themeText: document.getElementById("theme-text"),
  liveRegion: document.getElementById("live-region"),
  alertRegion: document.getElementById("alert-region"),

  // Plan Library Section
  libCountBadge: document.getElementById("lib-count-badge"),
  btnSaveCurrentToLibrary: document.getElementById("btn-save-current-to-library"),
  btnClearAllPlans: document.getElementById("btn-clear-all-plans"),
  planLibraryGrid: document.getElementById("plan-library-grid"),
  emptyLibraryMsg: document.getElementById("empty-library-msg"),

  // AI Engine Status Indicator in Header
  aiEnginePill: document.getElementById("ai-engine-pill"),
  statusPulseDot: document.getElementById("status-pulse-dot"),
  statusText: document.getElementById("status-text"),

  // Saved Plan Banner
  savedPlanBanner: document.getElementById("saved-plan-banner"),
  savedPlanTimestamp: document.getElementById("saved-plan-timestamp"),
  btnRestorePlan: document.getElementById("btn-restore-plan"),
  btnDiscardPlan: document.getElementById("btn-discard-plan"),

  // Form Steps
  eventForm: document.getElementById("event-form"),
  step1: document.getElementById("step-1"),
  step2: document.getElementById("step-2"),
  step3: document.getElementById("step-3"),
  pillStep1: document.getElementById("pill-step-1"),
  pillStep2: document.getElementById("pill-step-2"),
  pillStep3: document.getElementById("pill-step-3"),
  formStepGuide: document.getElementById("form-step-guide"),
  formGuideText: document.getElementById("form-guide-text"),

  // Form Navigation Buttons
  btnToStep2: document.getElementById("btn-to-step-2"),
  btnBackToStep1: document.getElementById("btn-back-to-step-1"),
  btnToStep3: document.getElementById("btn-to-step-3"),
  btnBackToStep2: document.getElementById("btn-back-to-step-2"),
  btnGeneratePlan: document.getElementById("btn-generate-plan"),
  btnGenerateSpinner: document.getElementById("btn-generate-spinner"),
  btnGenerateText: document.getElementById("btn-generate-text"),

  // Form Inputs
  eventType: document.getElementById("event-type"),
  eventDate: document.getElementById("event-date"),
  eventCity: document.getElementById("event-city"),
  guestCount: document.getElementById("guest-count"),
  currency: document.getElementById("currency"),
  totalBudget: document.getElementById("total-budget"),
  eventTheme: document.getElementById("event-theme"),
  culturalDietary: document.getElementById("cultural-dietary"),
  specialNotes: document.getElementById("special-notes"),
  liveEstimateText: document.getElementById("live-estimate-text"),

  // Presets
  presetWedding: document.getElementById("preset-wedding"),
  presetBirthday: document.getElementById("preset-birthday"),
  presetCommunity: document.getElementById("preset-community"),

  // Hero Mascot
  lumiHeroStage: document.getElementById("lumi-hero-stage"),
  lumiHeroText: document.getElementById("lumi-hero-text"),
  btnHeroSparkle: document.getElementById("btn-hero-sparkle"),
  btnHeroTip: document.getElementById("btn-hero-tip"),

  // Floating Lumi Assistant Widget
  lumiWidget: document.getElementById("lumi-widget"),
  lumiWidgetBubble: document.getElementById("lumi-widget-bubble"),
  lumiWidgetText: document.getElementById("lumi-widget-text"),
  lumiBubbleClose: document.getElementById("lumi-bubble-close"),
  lumiWidgetBtn: document.getElementById("lumi-widget-btn"),
  lumiMinimizeBtn: document.getElementById("lumi-minimize-btn"),

  // Results Section & Plan Header
  loadingIndicator: document.getElementById("loading-indicator"),
  resultsContainer: document.getElementById("results-container"),
  resultsMetaText: document.getElementById("results-meta-text"),
  activePlanNameInput: document.getElementById("active-plan-name-input"),
  btnSavePlanName: document.getElementById("btn-save-plan-name"),
  saveIndicator: document.getElementById("save-indicator"),
  saveStatusText: document.getElementById("save-status-text"),
  fallbackNoticeBanner: document.getElementById("fallback-notice-banner"),
  fallbackReasonText: document.getElementById("fallback-reason-text"),
  budgetWarningBanner: document.getElementById("budget-warning-banner"),
  budgetWarningText: document.getElementById("budget-warning-text"),

  // Compact Celebration Progress Dashboard
  planningDashboard: document.getElementById("planning-dashboard"),
  dashBudgetStatus: document.getElementById("dash-budget-status"),
  dashBudgetMeta: document.getElementById("dash-budget-meta"),
  dashBudgetFill: document.getElementById("dash-budget-fill"),
  dashMilestonesCount: document.getElementById("dash-milestones-count"),
  dashMilestonesMeta: document.getElementById("dash-milestones-meta"),
  dashMilestonesFill: document.getElementById("dash-milestones-fill"),
  dashVendorsCount: document.getElementById("dash-vendors-count"),
  dashVendorsMeta: document.getElementById("dash-vendors-meta"),
  dashVendorsFill: document.getElementById("dash-vendors-fill"),
  dashDaysRemaining: document.getElementById("dash-days-remaining"),
  dashNextDeadlineText: document.getElementById("dash-next-deadline-text"),

  // Deliverable 1: Budget
  costPerGuestBadge: document.getElementById("cost-per-guest-badge"),
  budgetBalanceBar: document.getElementById("budget-balance-bar"),
  budgetTotalDisplay: document.getElementById("budget-total-display"),
  budgetAllocatedDisplay: document.getElementById("budget-allocated-display"),
  budgetContingencyDisplay: document.getElementById("budget-contingency-display"),
  budgetStatusPill: document.getElementById("budget-status-pill"),
  btnResetBudget: document.getElementById("btn-reset-budget"),
  budgetExplanation: document.getElementById("budget-explanation"),
  budgetTableBody: document.getElementById("budget-table-body"),
  budgetTotalAmount: document.getElementById("budget-total-amount"),
  budgetFootPct: document.getElementById("budget-foot-pct"),
  budgetFootStatus: document.getElementById("budget-foot-status"),
  budgetSegmentedBar: document.getElementById("budget-segmented-bar"),
  budgetBarSummary: document.getElementById("budget-bar-summary"),

  // Deliverable 2: Timeline
  timelineDaysBadge: document.getElementById("timeline-days-badge"),
  timelineAdvisoryBox: document.getElementById("timeline-advisory-box"),
  timelineAdvisoryText: document.getElementById("timeline-advisory-text"),
  timelineStepper: document.getElementById("timeline-stepper"),
  milestoneTrackerPill: document.getElementById("milestone-tracker-pill"),

  // Deliverable 3: Checklist
  checklistSummaryBadge: document.getElementById("checklist-summary-badge"),
  checklistContainer: document.getElementById("checklist-container"),
  vendorProgressFill: document.getElementById("vendor-progress-fill"),
  vendorProgressPercent: document.getElementById("vendor-progress-percent"),
  vendorFilterBar: document.getElementById("vendor-filter-bar"),
  countAll: document.getElementById("count-all"),
  countTodo: document.getElementById("count-todo"),
  countContacted: document.getElementById("count-contacted"),
  countBooked: document.getElementById("count-booked"),

  // Deliverable 4: Ideas
  tabThemes: document.getElementById("tab-themes"),
  tabDecor: document.getElementById("tab-decor"),
  tabMenu: document.getElementById("tab-menu"),
  tabActivities: document.getElementById("tab-activities"),
  tabTips: document.getElementById("tab-tips"),
  panelThemes: document.getElementById("panel-themes"),
  panelDecor: document.getElementById("panel-decor"),
  panelMenu: document.getElementById("panel-menu"),
  panelActivities: document.getElementById("panel-activities"),
  panelTips: document.getElementById("panel-tips"),
  ideasListThemes: document.getElementById("ideas-list-themes"),
  ideasListDecor: document.getElementById("ideas-list-decor"),
  ideasListMenu: document.getElementById("ideas-list-menu"),
  ideasListActivities: document.getElementById("ideas-list-activities"),
  ideasListTips: document.getElementById("ideas-list-tips"),

  // Deliverable 5: Vendor Quotes
  quoteCountBadge: document.getElementById("quote-count-badge"),
  quoteEntryForm: document.getElementById("quote-entry-form"),
  quoteCategory: document.getElementById("quote-category"),
  quoteVendorName: document.getElementById("quote-vendor-name"),
  quoteBaseAmount: document.getElementById("quote-base-amount"),
  quoteExtraFees: document.getElementById("quote-extra-fees"),
  quoteIncludedServices: document.getElementById("quote-included-services"),
  quotePaymentTerms: document.getElementById("quote-payment-terms"),
  quoteStatus: document.getElementById("quote-status"),
  btnAddQuote: document.getElementById("btn-add-quote"),
  btnResetQuoteForm: document.getElementById("btn-reset-quote-form"),
  quoteFilterBar: document.getElementById("quote-filter-bar"),
  quoteCardsGrid: document.getElementById("quote-cards-grid"),
  emptyQuotesMsg: document.getElementById("empty-quotes-msg"),
  quoteCountAll: document.getElementById("quote-count-all"),

  // Export Buttons & Actions
  btnCopySummary: document.getElementById("btn-copy-summary"),
  btnExportJson: document.getElementById("btn-export-json"),
  btnExportCsv: document.getElementById("btn-export-csv"),
  btnExportIcs: document.getElementById("btn-export-ics"),
  btnPrintView: document.getElementById("btnPrintView") || document.getElementById("btn-print-view"),
  btnStartNewPlan: document.getElementById("btn-start-new-plan"),
  btnCelebrate: document.getElementById("btn-celebrate"),
  confettiContainer: document.getElementById("confetti-canvas-container"),
  toastContainer: document.getElementById("toast-container"),

  // Confirm Reset Modal
  confirmModal: document.getElementById("confirm-modal"),
  modalTitle: document.getElementById("modal-title"),
  modalDesc: document.getElementById("modal-desc"),
  btnModalCancel: document.getElementById("btn-modal-cancel"),
  btnModalConfirm: document.getElementById("btn-modal-confirm"),
};

/**
 * Announce message to assistive technology via ARIA live regions
 */
function announceLive(message, isAssertive = false) {
  const target = isAssertive ? elements.alertRegion : elements.liveRegion;
  if (target) {
    target.textContent = "";
    setTimeout(() => {
      target.textContent = message;
    }, 50);
  }
}

/**
 * Display a modern, non-intrusive floating toast notification
 */
function showToast(message) {
  if (!elements.toastContainer) return;

  const toast = document.createElement("div");
  toast.className = "toast-message";
  toast.textContent = message;

  elements.toastContainer.appendChild(toast);

  setTimeout(() => {
    toast.classList.add("toast-out");
    setTimeout(() => {
      toast.remove();
    }, 280);
  }, 2800);
}

/**
 * Copy text securely to clipboard and show cute confirmation toast
 */
async function copyToClipboard(text, successMessage = "Copied to clipboard! 📋✨") {
  try {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(text);
    } else {
      const textArea = document.createElement("textarea");
      textArea.value = text;
      textArea.style.position = "fixed";
      textArea.style.left = "-999999px";
      document.body.appendChild(textArea);
      textArea.focus();
      textArea.select();
      document.execCommand("copy");
      textArea.remove();
    }
    showToast(successMessage);
    announceLive(successMessage);
  } catch (err) {
    console.warn("Failed to copy to clipboard:", err);
    showToast("Selected text copied!");
  }
}

/**
 * Aesthetic Confetti Shower Particle Generator (Respects Reduced Motion)
 */
function triggerConfetti() {
  if (!elements.confettiContainer) return;

  // Respect user preference for reduced motion (both OS preference and in-app toggle)
  if (
    document.documentElement.classList.contains("reduce-motion-active") ||
    (typeof isMotionEnabled === "function" && !isMotionEnabled()) ||
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  ) {
    return;
  }

  // Clear previous confetti
  elements.confettiContainer.textContent = "";

  const colors = [
    "#DDD3C9", // WARM FOG
    "#ECC4C3", // BERRY GOOD
    "#B97D7B", // USU KOUBAI BLOSSOM
    "#928E5E", // MEADOW MAUVE
    "#575527", // SOLDIER GREEN
    "#f6e6e5", // Soft Blossom
    "#c9bea2", // Warm Sand
    "#deb0af", // Rose Blush
  ];
  const shapes = ["circle", "rect", "star"];
  const particleCount = 70;

  for (let i = 0; i < particleCount; i++) {
    const piece = document.createElement("div");
    piece.className = "confetti-piece";

    const color = colors[Math.floor(Math.random() * colors.length)];
    const shape = shapes[Math.floor(Math.random() * shapes.length)];
    const left = Math.random() * 100;
    const size = 6 + Math.random() * 8;
    const duration = 2.2 + Math.random() * 1.5;
    const delay = Math.random() * 0.6;

    piece.style.left = `${left}vw`;
    piece.style.width = `${size}px`;
    piece.style.height = shape === "rect" ? `${size * 1.4}px` : `${size}px`;
    piece.style.backgroundColor = color;
    piece.style.animationDuration = `${duration}s`;
    piece.style.animationDelay = `${delay}s`;

    if (shape === "circle") {
      piece.style.borderRadius = "50%";
    } else if (shape === "star") {
      piece.style.clipPath =
        "polygon(50% 0%, 61% 35%, 98% 35%, 68% 57%, 79% 91%, 50% 70%, 21% 91%, 32% 57%, 2% 35%, 39% 35%)";
    }

    elements.confettiContainer.appendChild(piece);
  }

  // Auto clean up after animation finishes
  setTimeout(() => {
    if (elements.confettiContainer) {
      elements.confettiContainer.textContent = "";
    }
  }, 4200);
}

/**
 * Format currency with international number formatter fallback
 */
function formatCurrency(amount, currencyCode = "USD") {
  const safeAmount = typeof amount === "number" && !isNaN(amount) ? amount : 0;
  return `${currencyCode} ${safeAmount.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

/**
 * Setup Theme Toggle (Light / Dark)
 */
function initTheme() {
  const savedTheme = localStorage.getItem("eventease-theme");
  const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
  const initialTheme = savedTheme || (prefersDark ? "dark" : "light");

  applyTheme(initialTheme);

  elements.themeToggle?.addEventListener("click", () => {
    const currentTheme = document.documentElement.getAttribute("data-theme") || "light";
    const nextTheme = currentTheme === "dark" ? "light" : "dark";
    applyTheme(nextTheme);
    localStorage.setItem("eventease-theme", nextTheme);
    announceLive(`Switched to ${nextTheme} theme`);
    showToast(`Switched to ${nextTheme === "dark" ? "Dark 🌙" : "Light ☀️"} mode`);
  });
}

function applyTheme(theme) {
  if (theme === "dark") {
    document.documentElement.setAttribute("data-theme", "dark");
    if (elements.themeIcon) elements.themeIcon.innerHTML = "&#9788;";
    if (elements.themeText) elements.themeText.textContent = "Light Mode";
    elements.themeToggle?.setAttribute("aria-pressed", "true");
  } else {
    document.documentElement.removeAttribute("data-theme");
    if (elements.themeIcon) elements.themeIcon.innerHTML = "&#9790;";
    if (elements.themeText) elements.themeText.textContent = "Dark Mode";
    elements.themeToggle?.setAttribute("aria-pressed", "false");
  }
}

/**
 * Check Backend AI Health & Update Status Pill
 */
async function checkAiStatus() {
  try {
    const res = await fetch("/api/health");
    if (!res.ok) throw new Error("Health endpoint error");
    const data = await res.json();
    state.aiStatus = {
      configured: Boolean(data.gemini_configured),
      mode: data.ai_mode || "offline_fallback",
    };

    if (elements.aiEnginePill && elements.statusText) {
      if (data.ai_mode === "live") {
        elements.aiEnginePill.classList.remove("offline-fallback");
        elements.aiEnginePill.classList.add("live-ai");
        elements.statusText.textContent = "Live AI Engine (Gemini)";
        elements.aiEnginePill.setAttribute(
          "title",
          "Google Gemini AI is configured and providing live customized inspiration."
        );
      } else {
        elements.aiEnginePill.classList.remove("live-ai");
        elements.aiEnginePill.classList.add("offline-fallback");
        elements.statusText.textContent = "Offline Fallback (Curated)";
        elements.aiEnginePill.setAttribute(
          "title",
          "Deterministic planning active with curated offline inspiration templates."
        );
      }
    }
  } catch (err) {
    if (elements.statusText) {
      elements.statusText.textContent = "Offline Fallback (Curated)";
    }
  }
}

/**
 * Interactive Mascots & Companion Logic with Minimize Toggle
 */
function initMascots() {
  // Hero Sparkle button
  elements.btnHeroSparkle?.addEventListener("click", () => {
    triggerConfetti();
    if (elements.lumiHeroText) {
      elements.lumiHeroText.textContent =
        "✨ Sparkles activated! May your event be bright, beautiful, and completely stress-free!";
    }
    showToast("✨ Celebration sparkles launched!");
  });

  // Hero Tip button
  elements.btnHeroTip?.addEventListener("click", () => {
    state.currentTipIndex = (state.currentTipIndex + 1) % planningTips.length;
    if (elements.lumiHeroText) {
      elements.lumiHeroText.textContent = planningTips[state.currentTipIndex];
    }
  });

  // Tap Lumi directly on stage
  elements.lumiHeroStage?.addEventListener("click", () => {
    triggerConfetti();
    state.currentTipIndex = (state.currentTipIndex + 1) % planningTips.length;
    if (elements.lumiHeroText) {
      elements.lumiHeroText.textContent = planningTips[state.currentTipIndex];
    }
    showToast("Lumi says: 'Let's plan something extraordinary!' 🪄");
  });

  // Floating Lumi widget button
  elements.lumiWidgetBtn?.addEventListener("click", () => {
    if (elements.lumiWidget) {
      // If widget was minimized, un-minimize it on click
      if (elements.lumiWidget.classList.contains("minimized")) {
        elements.lumiWidget.classList.remove("minimized");
        if (elements.lumiMinimizeBtn) elements.lumiMinimizeBtn.innerHTML = "&minus;";
        localStorage.setItem("eventease-lumi-minimized", "false");
      }
    }

    if (elements.lumiWidgetBubble) {
      elements.lumiWidgetBubble.classList.remove("hidden");
    }
    state.currentTipIndex = (state.currentTipIndex + 1) % planningTips.length;
    if (elements.lumiWidgetText) {
      elements.lumiWidgetText.textContent = planningTips[state.currentTipIndex];
    }
    triggerConfetti();
    showToast("Lumi's Planning Companion active! ✨");
  });

  // Floating widget close bubble button
  elements.lumiBubbleClose?.addEventListener("click", (e) => {
    e.stopPropagation();
    elements.lumiWidgetBubble?.classList.add("hidden");
  });

  // Floating widget minimize toggle button
  if (elements.lumiMinimizeBtn && !elements.lumiMinimizeBtn.dataset.wired) {
    elements.lumiMinimizeBtn.dataset.wired = "true";
    elements.lumiMinimizeBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      const isMinimized = elements.lumiWidget?.classList.toggle("minimized");
      if (elements.lumiMinimizeBtn) {
        elements.lumiMinimizeBtn.innerHTML = isMinimized ? "&#43;" : "&minus;";
        elements.lumiMinimizeBtn.setAttribute(
          "aria-label",
          isMinimized ? "Restore celebration companion" : "Minimize celebration companion"
        );
      }
      localStorage.setItem("eventease-lumi-minimized", isMinimized ? "true" : "false");
      showToast(isMinimized ? "Lumi minimized 🪄" : "Lumi restored ✨");
    });
  }

  // Restore saved minimize state
  if (localStorage.getItem("eventease-lumi-minimized") === "true") {
    elements.lumiWidget?.classList.add("minimized");
    if (elements.lumiMinimizeBtn) {
      elements.lumiMinimizeBtn.innerHTML = "&#43;";
      elements.lumiMinimizeBtn.setAttribute("aria-label", "Restore celebration companion");
    }
  }
}

/**
 * Update mascot guide text based on current intake step
 */
function updateMascotStep(stepNumber) {
  const stepGuides = {
    1: "Step 1: Set your celebration date, city, and event type to begin. 📅✨",
    2: "Step 2: Enter guest count & total budget. Our deterministic engine locks in an 8% emergency contingency! 💰",
    3: "Step 3: Tell me your aesthetic theme and any dietary requests! 🎨🍽️",
  };

  if (elements.formGuideText) {
    elements.formGuideText.textContent = stepGuides[stepNumber] || "Complete requirements to proceed.";
  }

  if (elements.lumiWidgetText) {
    elements.lumiWidgetText.textContent = stepGuides[stepNumber] || "I'm right here if you need any planning tips! ✨";
  }
}

/**
 * Step Navigation & Form Validation
 */
function setStep(stepNumber) {
  state.currentStep = stepNumber;

  // Toggle active fieldset
  [elements.step1, elements.step2, elements.step3].forEach((stepEl, idx) => {
    if (stepEl) {
      if (idx + 1 === stepNumber) {
        stepEl.classList.add("active");
        stepEl.removeAttribute("hidden");
      } else {
        stepEl.classList.remove("active");
        stepEl.setAttribute("hidden", "true");
      }
    }
  });

  // Toggle active indicator pill
  [elements.pillStep1, elements.pillStep2, elements.pillStep3].forEach((pillEl, idx) => {
    if (pillEl) {
      if (idx + 1 === stepNumber) {
        pillEl.classList.add("active");
      } else {
        pillEl.classList.remove("active");
      }
    }
  });

  // Update companion guidance
  updateMascotStep(stepNumber);

  // Focus first input of active step for keyboard accessibility
  const activeFieldset = document.getElementById(`step-${stepNumber}`);
  const firstInput = activeFieldset?.querySelector("input, select, textarea");
  firstInput?.focus();

  announceLive(`Step ${stepNumber} of 3 active`);
}

function validateStep1() {
  let isValid = true;

  // Validate Event Type
  const eventTypeEl = elements.eventType;
  const eventTypeError = document.getElementById("event-type-error");
  if (!eventTypeEl.value) {
    if (eventTypeError) eventTypeError.textContent = "Please select an event type.";
    eventTypeEl.setAttribute("aria-invalid", "true");
    isValid = false;
  } else {
    if (eventTypeError) eventTypeError.textContent = "";
    eventTypeEl.removeAttribute("aria-invalid");
  }

  // Validate Date
  const dateEl = elements.eventDate;
  const dateError = document.getElementById("event-date-error");
  if (!dateEl.value) {
    if (dateError) dateError.textContent = "Please select a valid future event date.";
    dateEl.setAttribute("aria-invalid", "true");
    isValid = false;
  } else {
    const selectedDate = new Date(dateEl.value);
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    if (selectedDate <= today) {
      if (dateError) dateError.textContent = "Event date must be in the future.";
      dateEl.setAttribute("aria-invalid", "true");
      isValid = false;
    } else {
      if (dateError) dateError.textContent = "";
      dateEl.removeAttribute("aria-invalid");
    }
  }

  // Validate City
  const cityEl = elements.eventCity;
  const cityError = document.getElementById("event-city-error");
  if (!cityEl.value || cityEl.value.trim().length < 2) {
    if (cityError) cityError.textContent = "City must be at least 2 characters long.";
    cityEl.setAttribute("aria-invalid", "true");
    isValid = false;
  } else {
    if (cityError) cityError.textContent = "";
    cityEl.removeAttribute("aria-invalid");
  }

  return isValid;
}

function validateStep2() {
  let isValid = true;

  // Validate Guest Count
  const guestEl = elements.guestCount;
  const guestError = document.getElementById("guest-count-error");
  const guestVal = parseInt(guestEl.value, 10);
  if (isNaN(guestVal) || guestVal < 1 || guestVal > 10000) {
    if (guestError) guestError.textContent = "Guest count must be between 1 and 10,000.";
    guestEl.setAttribute("aria-invalid", "true");
    isValid = false;
  } else {
    if (guestError) guestError.textContent = "";
    guestEl.removeAttribute("aria-invalid");
  }

  // Validate Currency
  const currEl = elements.currency;
  const currError = document.getElementById("currency-error");
  if (!currEl.value) {
    if (currError) currError.textContent = "Please select a currency.";
    currEl.setAttribute("aria-invalid", "true");
    isValid = false;
  } else {
    if (currError) currError.textContent = "";
    currEl.removeAttribute("aria-invalid");
  }

  // Validate Total Budget
  const budgetEl = elements.totalBudget;
  const budgetError = document.getElementById("total-budget-error");
  const budgetVal = parseFloat(budgetEl.value);
  if (isNaN(budgetVal) || budgetVal < 1 || budgetVal > 50000000) {
    if (budgetError) budgetError.textContent = "Total budget must be between 1 and 50,000,000.";
    budgetEl.setAttribute("aria-invalid", "true");
    isValid = false;
  } else {
    if (budgetError) budgetError.textContent = "";
    budgetEl.removeAttribute("aria-invalid");
  }

  return isValid;
}

/**
 * Live Cost-per-Guest Estimate Calculation
 */
function updateLiveEstimate() {
  if (!elements.liveEstimateText) return;
  const guests = parseInt(elements.guestCount?.value, 10);
  const budget = parseFloat(elements.totalBudget?.value);
  const curr = elements.currency?.value || "USD";

  if (!isNaN(guests) && guests > 0 && !isNaN(budget) && budget > 0) {
    const perGuest = budget / guests;
    elements.liveEstimateText.textContent = `${formatCurrency(perGuest, curr)} per guest (${guests} attendees • ${formatCurrency(budget, curr)} total)`;
  } else {
    elements.liveEstimateText.textContent =
      "Enter guests and budget to see estimated per-guest allocation";
  }
}

/**
 * Load Demonstration Presets
 */
async function loadPresets() {
  try {
    const res = await fetch("/api/presets");
    if (!res.ok) return;
    const presets = await res.json();

    const attachPreset = (btn, key) => {
      btn?.addEventListener("click", () => {
        const data = presets[key];
        if (!data) return;

        elements.eventType.value = data.event_type;
        elements.eventDate.value = data.date;
        elements.eventCity.value = data.city;
        elements.guestCount.value = data.guest_count;
        elements.currency.value = data.currency;
        elements.totalBudget.value = data.total_budget;
        elements.eventTheme.value = data.theme || "";
        elements.culturalDietary.value = data.cultural_dietary_preferences || "";
        elements.specialNotes.value = data.special_notes || "";

        updateLiveEstimate();
        setStep(1);
        triggerConfetti();
        announceLive(`Loaded preset: ${data.name}`);
        showToast(`Loaded "${data.name}" scenario! 🍷✨`);

        if (elements.lumiHeroText) {
          elements.lumiHeroText.textContent = `Loaded ${data.name}! Click 'Generate Full Celebration Plan' to calculate! ✨`;
        }

        elements.eventForm?.scrollIntoView({ behavior: "smooth", block: "start" });
      });
    };

    attachPreset(elements.presetWedding, "wedding");
    attachPreset(elements.presetBirthday, "birthday");
    attachPreset(elements.presetCommunity, "community");
  } catch (err) {
    console.warn("Could not load presets from /api/presets:", err);
  }
}

let pendingModalAction = null;
let lastFocusedModalTrigger = null;

function showConfirmationModal({ title, message, confirmText = "Confirm", onConfirm }) {
  if (elements.modalTitle) elements.modalTitle.textContent = title;
  if (elements.modalDesc) elements.modalDesc.textContent = message;
  if (elements.btnModalConfirm) elements.btnModalConfirm.textContent = confirmText;
  pendingModalAction = onConfirm;
  lastFocusedModalTrigger = document.activeElement;

  if (elements.confirmModal) {
    if (typeof elements.confirmModal.showModal === "function") {
      elements.confirmModal.showModal();
    } else {
      elements.confirmModal.setAttribute("open", "true");
    }
  }
}

/**
 * Plan Library (Multiple Local Plans) Management
 */
function getPlanLibrary() {
  try {
    const raw = localStorage.getItem(LIBRARY_STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch (e) {
    console.warn("Error reading plan library:", e);
    return [];
  }
}

function savePlanLibrary(list) {
  try {
    localStorage.setItem(LIBRARY_STORAGE_KEY, JSON.stringify(list));
    renderPlanLibrary();
    return true;
  } catch (err) {
    if (err && (err.name === "QuotaExceededError" || err.code === 22)) {
      showToast("Browser storage quota exceeded! Please remove some older plans. ⚠️");
      announceLive("Browser storage quota exceeded. Please remove some older plans.", true);
    } else {
      showToast("Failed to save to local plan library.");
    }
    return false;
  }
}

function saveCurrentPlanToLibrary(customName) {
  if (!state.currentPlan) {
    showToast("Please generate or restore a plan first! ✨");
    return;
  }

  const p = state.currentPlan;
  const name = (
    customName ||
    elements.activePlanNameInput?.value ||
    state.activePlanName ||
    `${p.intake.event_type.toUpperCase()} in ${p.intake.city}`
  ).trim();

  state.activePlanName = name;
  if (elements.activePlanNameInput) {
    elements.activePlanNameInput.value = name;
  }

  const planId = state.activePlanId || `plan_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
  state.activePlanId = planId;

  const library = getPlanLibrary();
  const existingIdx = library.findIndex((item) => item.id === planId);

  const payload = {
    version: 1,
    id: planId,
    name: name,
    savedAt: new Date().toISOString(),
    intake: {
      eventType: elements.eventType?.value,
      date: elements.eventDate?.value,
      city: elements.eventCity?.value,
      guestCount: elements.guestCount?.value,
      totalBudget: elements.totalBudget?.value,
      currency: elements.currency?.value,
      theme: elements.eventTheme?.value,
      culturalDietary: elements.culturalDietary?.value,
      specialNotes: elements.specialNotes?.value,
    },
    plan: state.currentPlan,
    checklistStatusMap: state.checklistStatusMap,
    vendorNotes: state.vendorNotes,
    vendorContacts: state.vendorContacts,
    completedMilestones: Array.from(state.completedMilestones),
    budgetAllocations: state.budgetAllocations,
    vendorQuotes: state.vendorQuotes,
  };

  if (existingIdx >= 0) {
    library[existingIdx] = payload;
  } else {
    library.unshift(payload);
  }

  const saved = savePlanLibrary(library);
  if (saved) {
    savePlanLocally();
    showToast(`Plan "${name}" saved to library! 📚✨`);
    announceLive(`Plan saved to local library as ${name}`);
  }
}

function openPlanFromLibrary(planId) {
  const library = getPlanLibrary();
  const target = library.find((item) => item.id === planId);
  if (!target) return;

  restoreSavedPlan(target);
  showToast(`Opened "${target.name}"! 📖`);
}

function deepClone(obj) {
  if (typeof structuredClone === "function") {
    return structuredClone(obj);
  }
  return JSON.parse(JSON.stringify(obj));
}

function duplicatePlanInLibrary(planId) {
  const library = getPlanLibrary();
  const target = library.find((item) => item.id === planId);
  if (!target) return;

  const copy = deepClone(target);
  copy.id = `plan_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
  copy.name = `${target.name} (Copy)`;
  copy.savedAt = new Date().toISOString();

  library.unshift(copy);
  const saved = savePlanLibrary(library);
  if (saved) {
    showToast(`Duplicated "${target.name}"! 📋`);
  }
}

function deletePlanFromLibrary(planId) {
  const library = getPlanLibrary();
  const target = library.find((item) => item.id === planId);
  const targetName = target ? target.name : "this plan";

  showConfirmationModal({
    title: "Delete Plan from Library?",
    message: `Are you sure you want to permanently delete "${targetName}" from this browser's local storage? This cannot be undone.`,
    confirmText: "Yes, Delete Plan",
    onConfirm: () => {
      const updated = library.filter((item) => item.id !== planId);
      savePlanLibrary(updated);
      if (state.activePlanId === planId) {
        localStorage.removeItem(STORAGE_KEY);
      }
      showToast(`Deleted "${targetName}". 🗑️`);
      announceLive("Plan deleted from library.");
    },
  });
}

function clearAllPlans() {
  showConfirmationModal({
    title: "Clear All Saved Plans?",
    message: "This will permanently remove all saved celebration plans, custom budget allocations, vendor contacts, private notes, and quote comparisons stored in this browser on this device. This cannot be undone.",
    confirmText: "Yes, Clear All Plans",
    onConfirm: () => {
      localStorage.removeItem(STORAGE_KEY);
      localStorage.removeItem(LIBRARY_STORAGE_KEY);

      state.currentPlan = null;
      state.activePlanId = null;
      state.activePlanName = "";
      state.checklistStatusMap = {};
      state.vendorNotes = {};
      state.vendorContacts = {};
      state.completedMilestones.clear();
      state.budgetAllocations = [];
      state.vendorQuotes = [];

      if (elements.activePlanNameInput) elements.activePlanNameInput.value = "";
      elements.resultsContainer?.classList.add("hidden");
      elements.savedPlanBanner?.classList.add("hidden");

      renderPlanLibrary();
      renderVendorQuotes();
      showToast("All local plans and records have been cleared.");
      announceLive("All local plans and records cleared.");
    },
  });
}

function renderPlanLibrary() {
  if (!elements.planLibraryGrid) return;
  const library = getPlanLibrary();

  if (elements.libCountBadge) {
    elements.libCountBadge.textContent = `${library.length} Saved Plan${library.length === 1 ? "" : "s"}`;
  }

  elements.planLibraryGrid.textContent = "";

  if (library.length === 0) {
    elements.emptyLibraryMsg?.classList.remove("hidden");
    return;
  }

  elements.emptyLibraryMsg?.classList.add("hidden");

  library.forEach((item) => {
    const card = document.createElement("div");
    card.className = "plan-item-card";
    if (state.activePlanId && state.activePlanId === item.id) {
      card.classList.add("active-plan-card");
    }

    const topDiv = document.createElement("div");
    topDiv.className = "plan-card-top";

    const titleEl = document.createElement("h3");
    titleEl.className = "plan-card-name";
    titleEl.textContent = item.name || "Untitled Plan";
    topDiv.appendChild(titleEl);

    if (state.activePlanId && state.activePlanId === item.id) {
      const activeBadge = document.createElement("span");
      activeBadge.className = "badge badge-accent";
      activeBadge.textContent = "Active";
      topDiv.appendChild(activeBadge);
    }
    card.appendChild(topDiv);

    const metaDiv = document.createElement("div");
    metaDiv.className = "plan-card-meta";
    const dateFormatted = new Date(item.savedAt).toLocaleDateString();
    const city = item.intake?.city || item.plan?.intake?.city || "";
    const eventType = (item.intake?.eventType || item.plan?.intake?.event_type || "").toUpperCase();
    const targetDate = item.intake?.date || item.plan?.intake?.date || "";
    metaDiv.textContent = `${eventType} in ${city} • Date: ${targetDate} • Saved: ${dateFormatted}`;
    card.appendChild(metaDiv);

    const statsDiv = document.createElement("div");
    statsDiv.className = "plan-card-stats";
    const budgetVal = item.intake?.totalBudget || item.plan?.budget?.total_budget || 0;
    const curr = item.intake?.currency || item.plan?.budget?.currency || "USD";
    const guests = item.intake?.guestCount || item.plan?.intake?.guest_count || 0;
    const completedM = item.completedMilestones ? item.completedMilestones.length : 0;
    const quotesCount = item.vendorQuotes ? item.vendorQuotes.length : 0;
    statsDiv.textContent = `${formatCurrency(Number(budgetVal), curr)} • ${guests} guests • ${completedM} milestones done • ${quotesCount} quotes`;
    card.appendChild(statsDiv);

    const actionsDiv = document.createElement("div");
    actionsDiv.className = "plan-card-actions";

    const planName = item.name || "Untitled Plan";

    const openBtn = document.createElement("button");
    openBtn.type = "button";
    openBtn.className = "btn btn-sm btn-primary";
    openBtn.textContent = "Open";
    openBtn.setAttribute("aria-label", `Open ${planName}`);
    openBtn.addEventListener("click", () => openPlanFromLibrary(item.id));
    actionsDiv.appendChild(openBtn);

    const dupBtn = document.createElement("button");
    dupBtn.type = "button";
    dupBtn.className = "btn btn-sm btn-secondary";
    dupBtn.textContent = "Duplicate";
    dupBtn.setAttribute("aria-label", `Duplicate ${planName}`);
    dupBtn.addEventListener("click", () => duplicatePlanInLibrary(item.id));
    actionsDiv.appendChild(dupBtn);

    const delBtn = document.createElement("button");
    delBtn.type = "button";
    delBtn.className = "btn btn-sm btn-secondary btn-danger";
    delBtn.textContent = "Delete";
    delBtn.setAttribute("aria-label", `Delete ${planName}`);
    delBtn.addEventListener("click", () => deletePlanFromLibrary(item.id));
    actionsDiv.appendChild(delBtn);

    card.appendChild(actionsDiv);
    elements.planLibraryGrid.appendChild(card);
  });
}

function setupPlanLibrary() {
  elements.btnSaveCurrentToLibrary?.addEventListener("click", () => {
    saveCurrentPlanToLibrary();
  });

  elements.btnSavePlanName?.addEventListener("click", () => {
    saveCurrentPlanToLibrary();
  });

  elements.activePlanNameInput?.addEventListener("input", (e) => {
    state.activePlanName = e.target.value;
    savePlanLocally();
  });

  elements.btnClearAllPlans?.addEventListener("click", () => {
    clearAllPlans();
  });
}

/**
 * LocalStorage Auto-Save & Plan Restoration
 */
function savePlanLocally() {
  if (!state.currentPlan) return;

  try {
    const payload = {
      version: 1,
      id: state.activePlanId,
      name: state.activePlanName,
      savedAt: new Date().toISOString(),
      intake: {
        eventType: elements.eventType?.value,
        date: elements.eventDate?.value,
        city: elements.eventCity?.value,
        guestCount: elements.guestCount?.value,
        totalBudget: elements.totalBudget?.value,
        currency: elements.currency?.value,
        theme: elements.eventTheme?.value,
        culturalDietary: elements.culturalDietary?.value,
        specialNotes: elements.specialNotes?.value,
      },
      plan: state.currentPlan,
      checklistStatusMap: state.checklistStatusMap,
      vendorNotes: state.vendorNotes,
      vendorContacts: state.vendorContacts,
      completedMilestones: Array.from(state.completedMilestones),
      budgetAllocations: state.budgetAllocations,
      vendorQuotes: state.vendorQuotes,
    };

    localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
    if (elements.saveStatusText) {
      elements.saveStatusText.textContent = "Saved locally";
    }
    if (elements.saveIndicator) {
      elements.saveIndicator.classList.remove("saving");
    }
  } catch (err) {
    if (err && (err.name === "QuotaExceededError" || err.code === 22)) {
      showToast("Storage quota exceeded! Delete older plans to free space. ⚠️");
    } else {
      console.warn("Could not save plan to localStorage:", err);
    }
  }
}

function checkSavedPlanOnLoad() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return;

    const data = JSON.parse(raw);
    if (!data || !data.plan) return;

    if (elements.savedPlanBanner) {
      elements.savedPlanBanner.classList.remove("hidden");
    }

    if (elements.savedPlanTimestamp) {
      const savedDate = new Date(data.savedAt);
      const timeStr = savedDate.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
      const dateStr = savedDate.toLocaleDateString();
      const city = data.intake?.city || data.plan?.intake?.city || "your city";
      const eventType = (data.intake?.eventType || data.plan?.intake?.event_type || "event").toUpperCase();
      elements.savedPlanTimestamp.textContent = `Saved ${dateStr} at ${timeStr} (${eventType} in ${city}).`;
    }

    elements.btnRestorePlan?.addEventListener("click", () => {
      restoreSavedPlan(data);
    });

    elements.btnDiscardPlan?.addEventListener("click", () => {
      discardSavedPlan();
    });
  } catch (err) {
    console.warn("Error checking saved plan:", err);
  }
}

function restoreSavedPlan(data) {
  // Populate form fields
  if (data.intake) {
    if (elements.eventType && data.intake.eventType) elements.eventType.value = data.intake.eventType;
    if (elements.eventDate && data.intake.date) elements.eventDate.value = data.intake.date;
    if (elements.eventCity && data.intake.city) elements.eventCity.value = data.intake.city;
    if (elements.guestCount && data.intake.guestCount) elements.guestCount.value = data.intake.guestCount;
    if (elements.currency && data.intake.currency) elements.currency.value = data.intake.currency;
    if (elements.totalBudget && data.intake.totalBudget) elements.totalBudget.value = data.intake.totalBudget;
    if (elements.eventTheme && data.intake.theme) elements.eventTheme.value = data.intake.theme;
    if (elements.culturalDietary && data.intake.culturalDietary)
      elements.culturalDietary.value = data.intake.culturalDietary;
    if (elements.specialNotes && data.intake.specialNotes) elements.specialNotes.value = data.intake.specialNotes;
  }

  state.currentPlan = data.plan;
  state.activePlanId = data.id || null;
  state.activePlanName = data.name || (data.plan ? `${data.plan.intake.event_type.toUpperCase()} in ${data.plan.intake.city}` : "");
  if (elements.activePlanNameInput) {
    elements.activePlanNameInput.value = state.activePlanName;
  }

  state.checklistStatusMap = data.checklistStatusMap || {};
  state.vendorNotes = data.vendorNotes || {};
  state.vendorContacts = data.vendorContacts || {};
  state.completedMilestones = new Set(data.completedMilestones || []);
  state.budgetAllocations = data.budgetAllocations || [];
  state.vendorQuotes = data.vendorQuotes || [];

  updateLiveEstimate();
  renderMasterPlan(data.plan);
  renderPlanLibrary();

  elements.resultsContainer.classList.remove("hidden");
  elements.savedPlanBanner?.classList.add("hidden");
  elements.resultsContainer.scrollIntoView({ behavior: "smooth", block: "start" });

  showToast(`Plan restored! 📋✨`);
  announceLive("Saved celebration plan restored successfully.");
}

function discardSavedPlan() {
  localStorage.removeItem(STORAGE_KEY);
  elements.savedPlanBanner?.classList.add("hidden");
  showToast("Saved plan discarded.");
  announceLive("Saved celebration plan discarded.");
}

/**
 * Handle Start New Plan Modal Flow
 */
function setupNewPlanModal() {
  elements.btnStartNewPlan?.addEventListener("click", () => {
    showConfirmationModal({
      title: "Start a New Celebration Plan?",
      message: "Starting a new plan will reset your current progress, edited budget allocations, completed milestones, and vendor notes. Are you sure you want to proceed?",
      confirmText: "Yes, Start New Plan",
      onConfirm: () => {
        localStorage.removeItem(STORAGE_KEY);
        state.currentPlan = null;
        state.activePlanId = null;
        state.activePlanName = "";
        state.checklistStatusMap = {};
        state.vendorNotes = {};
        state.vendorContacts = {};
        state.completedMilestones.clear();
        state.budgetAllocations = [];
        state.vendorQuotes = [];

        if (elements.activePlanNameInput) elements.activePlanNameInput.value = "";
        elements.resultsContainer?.classList.add("hidden");
        elements.savedPlanBanner?.classList.add("hidden");
        setStep(1);
        renderPlanLibrary();
        renderVendorQuotes();
        elements.eventForm?.scrollIntoView({ behavior: "smooth", block: "start" });

        showToast("Ready for a new celebration plan! ✨");
        announceLive("Reset completed. Started a new celebration plan.");
      },
    });
  });

  elements.btnModalCancel?.addEventListener("click", () => {
    pendingModalAction = null;
    if (elements.confirmModal) {
      if (typeof elements.confirmModal.close === "function") {
        elements.confirmModal.close();
      } else {
        elements.confirmModal.removeAttribute("open");
      }
    }
    if (lastFocusedModalTrigger && typeof lastFocusedModalTrigger.focus === "function") {
      lastFocusedModalTrigger.focus();
    }
  });

  elements.confirmModal?.addEventListener("click", (e) => {
    if (e.target === elements.confirmModal) {
      elements.btnModalCancel?.click();
    }
  });

  elements.btnModalConfirm?.addEventListener("click", () => {
    const action = pendingModalAction;
    pendingModalAction = null;

    if (elements.confirmModal) {
      if (typeof elements.confirmModal.close === "function") {
        elements.confirmModal.close();
      } else {
        elements.confirmModal.removeAttribute("open");
      }
    }

    if (typeof action === "function") {
      action();
    }
  });
}

/**
 * Handle Form Submission -> Request /api/plan
 */
async function handlePlanSubmit(e) {
  e.preventDefault();

  if (!validateStep1() || !validateStep2()) {
    announceLive("Form contains errors. Please review requirements.", true);
    showToast("Please complete all required fields correctly.");
    return;
  }

  const payload = {
    event_type: elements.eventType.value,
    date: elements.eventDate.value,
    city: elements.eventCity.value.trim(),
    guest_count: parseInt(elements.guestCount.value, 10),
    total_budget: parseFloat(elements.totalBudget.value),
    currency: elements.currency.value,
    theme: elements.eventTheme.value.trim() || null,
    cultural_dietary_preferences: elements.culturalDietary.value.trim() || null,
    special_notes: elements.specialNotes.value.trim() || null,
  };

  // Set Loading UI
  elements.btnGeneratePlan.disabled = true;
  elements.btnGenerateSpinner.classList.remove("hidden");
  elements.btnGenerateText.textContent = "Calculating Algorithmic Plan...";
  elements.loadingIndicator.classList.remove("hidden");
  elements.resultsContainer.classList.add("hidden");

  if (elements.lumiWidgetText) {
    elements.lumiWidgetText.textContent = "Crunching the numbers & curating aesthetic ideas... 🪄";
  }

  announceLive("Generating event plan. Please wait...");

  try {
    const response = await fetch("/api/plan", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      const msg = errorData.detail || "Failed to generate event plan. Please check inputs.";
      throw new Error(msg);
    }

    const plan = await response.json();
    state.currentPlan = plan;
    state.activePlanId = `plan_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    const defaultName = `${plan.intake.event_type.toUpperCase()} in ${plan.intake.city}`;
    state.activePlanName = defaultName;
    if (elements.activePlanNameInput) {
      elements.activePlanNameInput.value = defaultName;
    }
    state.checklistStatusMap = {};
    state.vendorNotes = {};
    state.vendorContacts = {};
    state.completedMilestones.clear();
    state.budgetAllocations = plan.budget.items.map((i) => ({ ...i }));
    state.vendorQuotes = [];

    renderMasterPlan(plan);
    savePlanLocally();
    saveCurrentPlanToLibrary(defaultName);

    elements.resultsContainer.classList.remove("hidden");
    elements.savedPlanBanner?.classList.add("hidden");
    elements.resultsContainer.scrollIntoView({ behavior: "smooth", block: "start" });

    // Celebration effects
    triggerConfetti();
    triggerSparkles();
    showToast("Celebration Plan generated successfully! 🎉✨");
    announceLive("Event plan generated successfully.");
    triggerLumiReaction("Woohoo! Your celebration blueprint is complete! Check out all 5 deliverables below! 🥳🎉");

    if (elements.lumiHeroText) {
      elements.lumiHeroText.textContent =
        "Woohoo! Your celebration blueprint is complete! Check out all 5 deliverables below! 🥳🎉";
    }
    if (elements.lumiWidgetText) {
      elements.lumiWidgetText.textContent = "Your master plan is ready! Look at those balanced books! 🌟";
    }
  } catch (err) {
    announceLive(`Error: ${err.message}`, true);
    showToast(`Error: ${err.message}`);
    alert(`Could not generate event plan:\n${err.message}`);
  } finally {
    elements.btnGeneratePlan.disabled = false;
    elements.btnGenerateSpinner.classList.add("hidden");
    elements.btnGenerateText.innerHTML = "&#10024; Generate Full Celebration Plan";
    elements.loadingIndicator.classList.add("hidden");
  }
}

/**
 * Render Complete Master Plan Deliverables
 */
function renderMasterPlan(plan) {
  const dateFormatted = new Date(plan.generated_at).toLocaleString();
  elements.resultsMetaText.textContent = `${plan.intake.city} • ${plan.intake.event_type.toUpperCase()} • Generated ${dateFormatted}`;

  // Fallback Notice Banner
  if (plan.ideas.is_fallback) {
    elements.fallbackNoticeBanner.classList.remove("hidden");
    elements.fallbackReasonText.textContent =
      plan.ideas.fallback_reason || "Curated offline suggestions are active.";
  } else {
    elements.fallbackNoticeBanner.classList.add("hidden");
  }

  // Budget Realistic Benchmark Warning
  if (!plan.budget.realistic && plan.budget.warning) {
    elements.budgetWarningBanner.classList.remove("hidden");
    elements.budgetWarningText.textContent = plan.budget.warning;
  } else {
    elements.budgetWarningBanner.classList.add("hidden");
  }

  // 1. Render Budget
  renderBudget(plan.budget);

  // 2. Render Timeline
  renderTimeline(plan.timeline);

  // 3. Render Checklist
  renderChecklist(plan.checklist);

  // 4. Render Ideas
  renderIdeas(plan.ideas);

  // 5. Render Vendor Quotes
  renderVendorQuotes();

  // 6. Update Compact Dashboard Metrics
  updateDashboard();

  // 7. Render Library State
  renderPlanLibrary();
}

/**
 * Deliverable 1: Editable Budget Planner
 */
function renderBudget(budget) {
  const totalBudget = budget.total_budget;
  const currency = budget.currency;

  if (!state.budgetAllocations || state.budgetAllocations.length === 0) {
    state.budgetAllocations = budget.items.map((i) => ({ ...i }));
  }

  elements.budgetExplanation.textContent = budget.explanation;
  elements.budgetTableBody.textContent = "";

  state.budgetAllocations.forEach((item, idx) => {
    const tr = document.createElement("tr");

    // Category
    const tdCategory = document.createElement("td");
    tdCategory.textContent = item.category;

    // Allocation (%) Input
    const tdPct = document.createElement("td");
    tdPct.className = "text-right";
    const pctInput = document.createElement("input");
    pctInput.type = "number";
    pctInput.step = "0.5";
    pctInput.min = "0";
    pctInput.max = "100";
    pctInput.className = "budget-input-pct";
    pctInput.value = item.percentage.toFixed(1);
    pctInput.setAttribute("aria-label", `${item.category} percentage allocation`);

    tdPct.appendChild(pctInput);

    // Amount Input
    const tdAmount = document.createElement("td");
    tdAmount.className = "text-right";
    const amtInput = document.createElement("input");
    amtInput.type = "number";
    amtInput.step = "1";
    amtInput.min = "0";
    amtInput.className = "budget-input-amt";
    amtInput.value = item.amount.toFixed(2);
    amtInput.setAttribute("aria-label", `${item.category} currency amount`);

    tdAmount.appendChild(amtInput);

    // Description
    const tdDesc = document.createElement("td");
    tdDesc.textContent = item.description;

    // Wire Real-Time Change Handlers
    pctInput.addEventListener("input", () => {
      const newPct = parseFloat(pctInput.value);
      if (!isNaN(newPct) && newPct >= 0) {
        item.percentage = newPct;
        item.amount = Math.round(totalBudget * (newPct / 100) * 100) / 100;
        amtInput.value = item.amount.toFixed(2);
        recalculateBudgetMetrics();
      }
    });

    amtInput.addEventListener("input", () => {
      const newAmt = parseFloat(amtInput.value);
      if (!isNaN(newAmt) && newAmt >= 0) {
        item.amount = newAmt;
        item.percentage = totalBudget > 0 ? (newAmt / totalBudget) * 100 : 0;
        pctInput.value = item.percentage.toFixed(1);
        recalculateBudgetMetrics();
      }
    });

    tr.appendChild(tdCategory);
    tr.appendChild(tdPct);
    tr.appendChild(tdAmount);
    tr.appendChild(tdDesc);

    elements.budgetTableBody.appendChild(tr);
  });

  // Reset Button
  elements.btnResetBudget?.replaceWith(elements.btnResetBudget.cloneNode(true));
  elements.btnResetBudget = document.getElementById("btn-reset-budget");
  elements.btnResetBudget?.addEventListener("click", () => {
    state.budgetAllocations = budget.items.map((i) => ({ ...i }));
    renderBudget(budget);
    showToast("Budget allocations reset to benchmark values! 💰");
  });

  recalculateBudgetMetrics();
}

/**
 * Real-Time Budget Recalculation & Balance Validation
 */
function recalculateBudgetMetrics() {
  if (!state.currentPlan) return;

  const totalBudget = state.currentPlan.budget.total_budget;
  const currency = state.currentPlan.budget.currency;
  const guestCount = state.currentPlan.intake.guest_count || 1;

  let totalAllocatedAmt = 0;
  let totalAllocatedPct = 0;

  state.budgetAllocations.forEach((item) => {
    totalAllocatedAmt += item.amount;
    totalAllocatedPct += item.percentage;
  });

  totalAllocatedAmt = Math.round(totalAllocatedAmt * 100) / 100;
  totalAllocatedPct = Math.round(totalAllocatedPct * 10) / 10;

  // Find Contingency Item
  const contingencyItem = state.budgetAllocations.find((i) =>
    i.category.toLowerCase().includes("contingency")
  );
  const contingencyAmt = contingencyItem ? contingencyItem.amount : 0;
  const contingencyPct = contingencyItem ? contingencyItem.percentage : 0;

  // Header Balance Bar Items
  if (elements.budgetTotalDisplay) {
    elements.budgetTotalDisplay.textContent = formatCurrency(totalBudget, currency);
  }
  if (elements.budgetAllocatedDisplay) {
    elements.budgetAllocatedDisplay.textContent = `${formatCurrency(totalAllocatedAmt, currency)} (${totalAllocatedPct.toFixed(1)}%)`;
  }
  if (elements.budgetContingencyDisplay) {
    elements.budgetContingencyDisplay.textContent = `${formatCurrency(contingencyAmt, currency)} (${contingencyPct.toFixed(1)}%)`;
  }

  // Balance Validation
  const diffAmt = Math.round((totalAllocatedAmt - totalBudget) * 100) / 100;
  const isBalanced = Math.abs(diffAmt) < 0.05 || Math.abs(totalAllocatedPct - 100.0) < 0.1;

  if (elements.budgetStatusPill) {
    elements.budgetStatusPill.className = "badge";
    if (isBalanced) {
      elements.budgetStatusPill.classList.add("badge-accent");
      elements.budgetStatusPill.textContent = "Balanced";
    } else if (diffAmt > 0) {
      elements.budgetStatusPill.classList.add("badge-danger");
      elements.budgetStatusPill.textContent = `Over by ${formatCurrency(diffAmt, currency)}`;
    } else {
      elements.budgetStatusPill.classList.add("badge-neutral");
      elements.budgetStatusPill.textContent = `Under by ${formatCurrency(-diffAmt, currency)}`;
    }
  }

  // Table Footer Totals
  if (elements.budgetFootPct) {
    elements.budgetFootPct.textContent = `${totalAllocatedPct.toFixed(1)}%`;
  }
  if (elements.budgetTotalAmount) {
    elements.budgetTotalAmount.textContent = formatCurrency(totalAllocatedAmt, currency);
  }
  if (elements.budgetFootStatus) {
    if (isBalanced) {
      elements.budgetFootStatus.textContent = "Balanced Allocation";
    } else if (diffAmt > 0) {
      elements.budgetFootStatus.textContent = `Overallocated by ${formatCurrency(diffAmt, currency)} (adjust amounts)`;
    } else {
      elements.budgetFootStatus.textContent = `Underallocated by ${formatCurrency(-diffAmt, currency)} (unassigned buffer)`;
    }
  }

  // Recalculate Per-Guest Cost
  const costPerGuest = totalBudget > 0 ? totalAllocatedAmt / guestCount : 0;
  if (elements.costPerGuestBadge) {
    elements.costPerGuestBadge.textContent = `Per-Guest: ${formatCurrency(costPerGuest, currency)}`;
  }

  // Reactive feedback from Financial Strategist Barnaby
  const statusStr = isBalanced ? "balanced" : (diffAmt > 0 ? "over" : "under");
  reactToBudget(isBalanced, statusStr, totalAllocatedPct, contingencyPct);

  // Render Visual Segmented Bar
  renderSegmentedBar(state.budgetAllocations, currency);

  // Update Progress Dashboard
  updateDashboard();

  // Save changes locally
  savePlanLocally();
}

function renderSegmentedBar(items, currency) {
  if (!elements.budgetSegmentedBar) return;

  elements.budgetSegmentedBar.textContent = "";

  const colorMap = [
    "#B97D7B", // USU KOUBAI BLOSSOM
    "#928E5E", // MEADOW MAUVE
    "#575527", // SOLDIER GREEN
    "#ECC4C3", // BERRY GOOD
    "#DDD3C9", // WARM FOG
    "#a16462", // Deep Blossom
    "#777443", // Deep Meadow
    "#3b3917", // Deep Soldier Green
  ];

  let sumPct = 0;
  items.forEach((item, idx) => {
    sumPct += item.percentage;
    const seg = document.createElement("div");
    seg.className = "segment";
    seg.style.width = `${Math.max(0, item.percentage).toFixed(1)}%`;
    seg.style.backgroundColor = colorMap[idx % colorMap.length];
    seg.title = `${item.category}: ${item.percentage.toFixed(1)}% (${formatCurrency(item.amount, currency)})`;
    elements.budgetSegmentedBar.appendChild(seg);
  });

  if (elements.budgetBarSummary) {
    elements.budgetBarSummary.textContent = `${sumPct.toFixed(1)}% Allocated`;
  }
}

/**
 * Deliverable 2: Adaptive Milestone Timeline
 */
function updateMilestoneProgress(timeline) {
  if (!elements.milestoneTrackerPill || !timeline.milestones) return;
  const total = timeline.milestones.length;
  const completed = state.completedMilestones.size;
  elements.milestoneTrackerPill.textContent = `${completed} / ${total} Milestones Done`;

  if (completed === total && total > 0) {
    triggerConfetti();
    showToast("🎉 Amazing! All milestones completed!");
  }

  // Reactive feedback from Milestone Pathfinder Shep
  const uncompleted = (timeline.milestones || []).find((_, idx) => !state.completedMilestones.has(`milestone-${idx}`));
  reactToMilestone(completed, total, uncompleted ? uncompleted.period_label : "All completed");

  updateDashboard();
  savePlanLocally();
}

function renderTimeline(timeline) {
  elements.timelineDaysBadge.textContent = `${timeline.days_remaining} Days Remaining`;

  if (timeline.is_compressed && timeline.advisory) {
    elements.timelineAdvisoryBox.classList.remove("hidden");
    elements.timelineAdvisoryText.textContent = timeline.advisory;
  } else {
    elements.timelineAdvisoryBox.classList.add("hidden");
  }

  updateMilestoneProgress(timeline);

  elements.timelineStepper.textContent = "";

  timeline.milestones.forEach((milestone, idx) => {
    const milestoneId = `milestone-${idx}`;
    const li = document.createElement("li");
    li.className = "timeline-step";

    const itemBtn = document.createElement("button");
    itemBtn.type = "button";
    itemBtn.className = "milestone-item-btn";
    itemBtn.setAttribute("aria-label", `Toggle completion for ${milestone.period_label}`);

    const isCompleted = state.completedMilestones.has(milestoneId);
    if (isCompleted) {
      itemBtn.classList.add("completed");
    }

    const checkboxSpan = document.createElement("span");
    checkboxSpan.className = "milestone-checkbox";
    checkboxSpan.innerHTML = isCompleted ? "&#10004;" : "";

    const contentDiv = document.createElement("div");
    contentDiv.style.flex = "1";

    const header = document.createElement("div");
    header.className = "timeline-step-header";

    const periodSpan = document.createElement("span");
    periodSpan.className = "timeline-step-title timeline-title";
    periodSpan.textContent = milestone.period_label;

    const dateSpan = document.createElement("span");
    dateSpan.className = "timeline-step-date";
    dateSpan.textContent = milestone.target_date;

    header.appendChild(periodSpan);
    header.appendChild(dateSpan);

    const descP = document.createElement("p");
    descP.className = "timeline-step-desc";
    descP.textContent = milestone.description;

    const taskUl = document.createElement("ul");
    taskUl.className = "timeline-tasks-list";

    milestone.tasks.forEach((task) => {
      const taskLi = document.createElement("li");
      taskLi.textContent = task;
      taskUl.appendChild(taskLi);
    });

    contentDiv.appendChild(header);
    contentDiv.appendChild(descP);
    contentDiv.appendChild(taskUl);

    itemBtn.appendChild(checkboxSpan);
    itemBtn.appendChild(contentDiv);

    itemBtn.addEventListener("click", () => {
      if (state.completedMilestones.has(milestoneId)) {
        state.completedMilestones.delete(milestoneId);
        itemBtn.classList.remove("completed");
        checkboxSpan.innerHTML = "";
        showToast("Milestone marked in progress");
      } else {
        state.completedMilestones.add(milestoneId);
        itemBtn.classList.add("completed");
        checkboxSpan.innerHTML = "&#10004;";
        showToast("Milestone completed! 🎉");
      }
      updateMilestoneProgress(timeline);
    });

    li.appendChild(itemBtn);
    elements.timelineStepper.appendChild(li);
  });
}

/**
 * Deliverable 3: Vendor Checklist & Screening Playbook
 */
function updateChecklistSummary() {
  if (!state.currentPlan?.checklist?.tasks) return;
  const tasks = state.currentPlan.checklist.tasks;

  let bookedCount = 0;
  let contactedCount = 0;
  let todoCount = 0;

  tasks.forEach((t) => {
    const st = state.checklistStatusMap[t.id] || t.status || "to-do";
    if (st === "booked") bookedCount++;
    else if (st === "contacted") contactedCount++;
    else todoCount++;
  });

  if (elements.countAll) elements.countAll.textContent = tasks.length;
  if (elements.countTodo) elements.countTodo.textContent = todoCount;
  if (elements.countContacted) elements.countContacted.textContent = contactedCount;
  if (elements.countBooked) elements.countBooked.textContent = bookedCount;

  elements.checklistSummaryBadge.textContent = `${bookedCount} of ${tasks.length} Booked`;

  const pct = tasks.length > 0 ? Math.round((bookedCount / tasks.length) * 100) : 0;
  if (elements.vendorProgressFill) {
    elements.vendorProgressFill.style.width = `${pct}%`;
  }
  if (elements.vendorProgressPercent) {
    elements.vendorProgressPercent.textContent = `${pct}%`;
  }

  if (bookedCount === tasks.length && tasks.length > 0) {
    triggerConfetti();
    showToast("🏆 All vendors successfully booked!");
  }

  updateDashboard();
  savePlanLocally();
}

function renderChecklist(checklist) {
  elements.checklistContainer.textContent = "";

  checklist.tasks.forEach((task) => {
    const card = document.createElement("div");
    card.className = "checklist-item";
    card.dataset.taskId = task.id;

    const currentStatus = state.checklistStatusMap[task.id] || task.status || "to-do";
    card.dataset.status = currentStatus;

    if (currentStatus === "booked") {
      card.classList.add("status-booked");
    }

    const header = document.createElement("div");
    header.className = "checklist-item-header";

    const vendorSpan = document.createElement("span");
    vendorSpan.className = "checklist-item-title";
    vendorSpan.textContent = `${task.category}: ${task.vendor_type}`;

    const select = document.createElement("select");
    select.className = "checklist-status-select";
    select.setAttribute("aria-label", `Booking status for ${task.vendor_type}`);

    ["to-do", "contacted", "booked"].forEach((st) => {
      const opt = document.createElement("option");
      opt.value = st;
      opt.textContent = st.charAt(0).toUpperCase() + st.slice(1);
      if (currentStatus === st) {
        opt.selected = true;
      }
      select.appendChild(opt);
    });

    select.addEventListener("change", (e) => {
      const newStatus = e.target.value;
      state.checklistStatusMap[task.id] = newStatus;
      card.dataset.status = newStatus;

      if (newStatus === "booked") {
        card.classList.add("status-booked");
        showToast(`${task.vendor_type} marked as Booked! 🤝`);
      } else {
        card.classList.remove("status-booked");
      }

      // Reactive feedback from Vendor Contract Scout Nova
      reactToVendorBooking(task.vendor_type, newStatus);

      applyVendorFilter(state.activeVendorFilter);
      updateChecklistSummary();
      announceLive(`Updated ${task.vendor_type} status to ${newStatus}`);
    });

    header.appendChild(vendorSpan);
    header.appendChild(select);

    // Screening Questions
    const questionsUl = document.createElement("ul");
    questionsUl.className = "screening-questions-list";
    task.questions_to_ask.forEach((q) => {
      const qLi = document.createElement("li");
      qLi.style.display = "flex";
      qLi.style.justifyContent = "space-between";
      qLi.style.alignItems = "flex-start";
      qLi.style.gap = "0.5rem";

      const textSpan = document.createElement("span");
      textSpan.textContent = q;

      const copyBtn = document.createElement("button");
      copyBtn.type = "button";
      copyBtn.className = "btn-copy-question";
      copyBtn.innerHTML = "<span>&#128203;</span> Copy";
      copyBtn.title = "Copy screening question for vendor interview";
      copyBtn.addEventListener("click", () => {
        copyToClipboard(q, "Vendor screening question copied! 📋✨");
      });

      qLi.appendChild(textSpan);
      qLi.appendChild(copyBtn);
      questionsUl.appendChild(qLi);
    });

    card.appendChild(header);
    card.appendChild(questionsUl);

    if (task.notes) {
      const notesP = document.createElement("p");
      notesP.className = "protip-box";
      notesP.textContent = `Pro-tip: ${task.notes}`;
      card.appendChild(notesP);
    }

    // Contact Details & Private Notes Inputs
    const extraFieldsDiv = document.createElement("div");
    extraFieldsDiv.className = "vendor-extra-fields";

    // Contact Input
    const contactInput = document.createElement("input");
    contactInput.type = "text";
    contactInput.className = "vendor-contact-input";
    contactInput.placeholder = "Vendor contact details (Name, Phone, Email, Website)";
    contactInput.value = state.vendorContacts[task.id] || "";
    contactInput.setAttribute("aria-label", `Contact information for ${task.vendor_type}`);

    contactInput.addEventListener("input", () => {
      state.vendorContacts[task.id] = contactInput.value.trim();
      savePlanLocally();
    });

    // Notes Textarea
    const notesInput = document.createElement("textarea");
    notesInput.className = "vendor-notes-input";
    notesInput.rows = 2;
    notesInput.placeholder = "Private booking notes, quotes received, next steps...";
    notesInput.value = state.vendorNotes[task.id] || "";
    notesInput.setAttribute("aria-label", `Private notes for ${task.vendor_type}`);

    notesInput.addEventListener("input", () => {
      state.vendorNotes[task.id] = notesInput.value.trim();
      savePlanLocally();
    });

    extraFieldsDiv.appendChild(contactInput);
    extraFieldsDiv.appendChild(notesInput);
    card.appendChild(extraFieldsDiv);

    elements.checklistContainer.appendChild(card);
  });

  setupVendorFilters();
  updateChecklistSummary();
}

function setupVendorFilters() {
  if (!elements.vendorFilterBar) return;

  const buttons = elements.vendorFilterBar.querySelectorAll(".filter-pill");
  buttons.forEach((btn) => {
    btn.addEventListener("click", () => {
      buttons.forEach((b) => {
        b.classList.remove("active");
        b.setAttribute("aria-pressed", "false");
      });
      btn.classList.add("active");
      btn.setAttribute("aria-pressed", "true");

      const filter = btn.dataset.filter || "all";
      state.activeVendorFilter = filter;
      applyVendorFilter(filter);
    });
  });
}

function applyVendorFilter(filter) {
  const cards = elements.checklistContainer.querySelectorAll(".checklist-item");
  cards.forEach((card) => {
    const status = card.dataset.status || "to-do";
    if (filter === "all" || status === filter) {
      card.classList.remove("hidden");
    } else {
      card.classList.add("hidden");
    }
  });
}

/**
 * Deliverable 4: Creative Suggestions
 */
function populateList(listEl, items) {
  listEl.textContent = "";
  items.forEach((text) => {
    const li = document.createElement("li");
    li.className = "idea-item-card idea-card-interactive";
    li.textContent = text;
    li.title = "Click to copy this inspiration idea!";
    li.addEventListener("click", () => {
      copyToClipboard(text, "Creative idea copied to clipboard! 💡✨");
    });
    listEl.appendChild(li);
  });
}

function renderIdeas(ideas) {
  populateList(elements.ideasListThemes, ideas.themes);
  populateList(elements.ideasListDecor, ideas.decor);
  populateList(elements.ideasListMenu, ideas.menu);
  populateList(elements.ideasListActivities, ideas.activities);
  populateList(elements.ideasListTips, ideas.budget_saving_tips);
}

/**
 * Deliverable 5: Vendor Quote Comparison (User Records)
 */
function renderVendorQuotes() {
  if (!elements.quoteCardsGrid) return;

  const quotes = state.vendorQuotes || [];
  if (elements.quoteCountBadge) {
    elements.quoteCountBadge.textContent = `${quotes.length} Quote${quotes.length === 1 ? "" : "s"} Logged`;
  }
  if (elements.quoteCountAll) {
    elements.quoteCountAll.textContent = String(quotes.length);
  }

  // Populate dynamic category filter buttons
  updateQuoteFilterBar();

  // Filter quotes
  const filtered = state.activeQuoteFilter === "all"
    ? quotes
    : quotes.filter((q) => q.category === state.activeQuoteFilter);

  elements.quoteCardsGrid.textContent = "";

  if (filtered.length === 0) {
    elements.emptyQuotesMsg?.classList.remove("hidden");
    if (quotes.length > 0 && filtered.length === 0) {
      if (elements.emptyQuotesMsg) {
        elements.emptyQuotesMsg.textContent = `No quotes found for category "${state.activeQuoteFilter}".`;
      }
    } else if (elements.emptyQuotesMsg) {
      elements.emptyQuotesMsg.textContent = "No vendor quotes added yet. Log proposals received from vendors above to compare total costs, fees, and included deliverables side-by-side.";
    }
    return;
  }

  elements.emptyQuotesMsg?.classList.add("hidden");

  const curr = state.currentPlan?.budget?.currency || "USD";

  filtered.forEach((q) => {
    const card = document.createElement("div");
    card.className = "quote-card";
    if (q.status === "Selected") {
      card.classList.add("selected-quote");
    }

    const header = document.createElement("div");
    header.className = "quote-card-header";

    const titleGroup = document.createElement("div");
    const title = document.createElement("h4");
    title.className = "quote-vendor-title";
    title.textContent = q.vendorName;
    const catTag = document.createElement("span");
    catTag.className = "quote-category-tag";
    catTag.textContent = q.category;
    titleGroup.appendChild(title);
    titleGroup.appendChild(catTag);
    header.appendChild(titleGroup);

    const statusBadge = document.createElement("span");
    statusBadge.className = `badge ${q.status === "Selected" ? "badge-accent" : "badge-neutral"}`;
    statusBadge.textContent = q.status;
    header.appendChild(statusBadge);
    card.appendChild(header);

    // Total Cost banner
    const banner = document.createElement("div");
    banner.className = "quote-cost-banner";
    const costLabel = document.createElement("span");
    costLabel.className = "quote-cost-label";
    costLabel.textContent = "Total Estimated Cost";
    const costVal = document.createElement("span");
    costVal.className = "quote-total-val";
    costVal.textContent = formatCurrency(Number(q.totalAmount), curr);
    banner.appendChild(costLabel);
    banner.appendChild(costVal);
    card.appendChild(banner);

    // Details breakdown
    const details = document.createElement("div");
    details.className = "quote-breakdown-details";

    const baseRow = document.createElement("div");
    baseRow.className = "quote-detail-row";
    baseRow.innerHTML = `<span class="quote-detail-label">Base Quote:</span> <strong>${formatCurrency(Number(q.baseAmount), curr)}</strong>`;
    details.appendChild(baseRow);

    const feeRow = document.createElement("div");
    feeRow.className = "quote-detail-row";
    feeRow.innerHTML = `<span class="quote-detail-label">Extra Fees &amp; Taxes:</span> <strong>${formatCurrency(Number(q.extraFees || 0), curr)}</strong>`;
    details.appendChild(feeRow);

    if (q.paymentTerms) {
      const termsRow = document.createElement("div");
      termsRow.className = "quote-detail-row";
      const termsLabel = document.createElement("span");
      termsLabel.className = "quote-detail-label";
      termsLabel.textContent = "Payment Terms:";
      const termsVal = document.createElement("span");
      termsVal.textContent = q.paymentTerms;
      termsRow.appendChild(termsLabel);
      termsRow.appendChild(termsVal);
      details.appendChild(termsRow);
    }
    card.appendChild(details);

    if (q.includedServices) {
      const scopeBox = document.createElement("div");
      scopeBox.className = "quote-scope-box";
      scopeBox.textContent = `Scope: ${q.includedServices}`;
      card.appendChild(scopeBox);
    }

    // Footer actions
    const footer = document.createElement("div");
    footer.className = "quote-card-footer";

    const toggleBtn = document.createElement("button");
    toggleBtn.type = "button";
    toggleBtn.className = `btn btn-sm ${q.status === "Selected" ? "btn-secondary" : "btn-primary"}`;
    toggleBtn.textContent = q.status === "Selected" ? "Mark Under Review" : "Select Vendor";
    toggleBtn.addEventListener("click", () => {
      q.status = q.status === "Selected" ? "Under Review" : "Selected";
      savePlanLocally();
      renderVendorQuotes();
      showToast(`Updated quote status for ${q.vendorName} to ${q.status}.`);
    });
    footer.appendChild(toggleBtn);

    const deleteBtn = document.createElement("button");
    deleteBtn.type = "button";
    deleteBtn.className = "btn btn-sm btn-secondary";
    deleteBtn.textContent = "Remove";
    deleteBtn.addEventListener("click", () => {
      state.vendorQuotes = state.vendorQuotes.filter((item) => item.id !== q.id);
      savePlanLocally();
      renderVendorQuotes();
      showToast(`Removed quote for ${q.vendorName}.`);
    });
    footer.appendChild(deleteBtn);

    card.appendChild(footer);
    elements.quoteCardsGrid.appendChild(card);
  });
}

function updateQuoteFilterBar() {
  if (!elements.quoteFilterBar) return;

  const categories = Array.from(new Set(state.vendorQuotes.map((q) => q.category))).filter(Boolean);

  // Keep first pill (All)
  const existingButtons = elements.quoteFilterBar.querySelectorAll(".filter-pill:not([data-quote-filter='all'])");
  existingButtons.forEach((b) => b.remove());

  categories.forEach((cat) => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "filter-pill";
    btn.dataset.quoteFilter = cat;
    btn.setAttribute("aria-pressed", state.activeQuoteFilter === cat ? "true" : "false");
    if (state.activeQuoteFilter === cat) btn.classList.add("active");
    const count = state.vendorQuotes.filter((q) => q.category === cat).length;
    btn.textContent = `${cat} (${count})`;
    btn.addEventListener("click", () => {
      elements.quoteFilterBar.querySelectorAll(".filter-pill").forEach((b) => {
        b.classList.remove("active");
        b.setAttribute("aria-pressed", "false");
      });
      btn.classList.add("active");
      btn.setAttribute("aria-pressed", "true");
      state.activeQuoteFilter = cat;
      renderVendorQuotes();
    });
    elements.quoteFilterBar.appendChild(btn);
  });
}

function setupVendorQuoteForm() {
  elements.quoteEntryForm?.addEventListener("submit", (e) => {
    e.preventDefault();

    const category = elements.quoteCategory?.value;
    const vendorName = elements.quoteVendorName?.value?.trim();
    const baseAmount = parseFloat(elements.quoteBaseAmount?.value);
    const extraFees = parseFloat(elements.quoteExtraFees?.value) || 0;
    const includedServices = elements.quoteIncludedServices?.value?.trim() || "";
    const paymentTerms = elements.quotePaymentTerms?.value?.trim() || "";
    const status = elements.quoteStatus?.value || "Under Review";

    if (!category || !vendorName || isNaN(baseAmount) || baseAmount < 0) {
      showToast("Please enter a valid vendor category, name, and base quote amount.");
      return;
    }

    const totalAmount = Math.round((baseAmount + extraFees) * 100) / 100;

    const newQuote = {
      id: `quote_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      category,
      vendorName,
      baseAmount,
      extraFees,
      totalAmount,
      includedServices,
      paymentTerms,
      status,
      createdAt: new Date().toISOString(),
    };

    state.vendorQuotes.push(newQuote);
    savePlanLocally();
    renderVendorQuotes();
    elements.quoteEntryForm.reset();
    showToast(`Quote for "${vendorName}" added! 📊`);
    announceLive(`Quote for ${vendorName} added to vendor comparison.`);
  });

  const allPill = elements.quoteFilterBar?.querySelector("[data-quote-filter='all']");
  allPill?.addEventListener("click", () => {
    elements.quoteFilterBar.querySelectorAll(".filter-pill").forEach((b) => {
      b.classList.remove("active");
      b.setAttribute("aria-pressed", "false");
    });
    allPill.classList.add("active");
    allPill.setAttribute("aria-pressed", "true");
    state.activeQuoteFilter = "all";
    renderVendorQuotes();
  });
}

/**
 * Accessible WAI-ARIA Ideas Tab Switching & Keyboard Navigation
 */
function setupTabs() {
  const tabs = [
    { btn: elements.tabThemes, panel: elements.panelThemes },
    { btn: elements.tabDecor, panel: elements.panelDecor },
    { btn: elements.tabMenu, panel: elements.panelMenu },
    { btn: elements.tabActivities, panel: elements.panelActivities },
    { btn: elements.tabTips, panel: elements.panelTips },
  ];

  const tabIds = ["themes", "decor", "menu", "activities", "tips"];
  const activateTab = (targetIdx) => {
    tabs.forEach(({ btn, panel }, idx) => {
      const isSelected = idx === targetIdx;
      btn?.classList.toggle("active", isSelected);
      btn?.setAttribute("aria-selected", isSelected ? "true" : "false");
      btn?.setAttribute("tabindex", isSelected ? "0" : "-1");

      panel?.classList.toggle("hidden", !isSelected);
      panel?.classList.toggle("active", isSelected);
    });
    tabs[targetIdx].btn?.focus();

    // Creative Curator Pip tips
    reactToCreativeTab(tabIds[targetIdx]);
  };

  tabs.forEach(({ btn }, idx) => {
    btn?.addEventListener("click", () => activateTab(idx));

    // Keyboard Arrow-Key & Home/End Navigation
    btn?.addEventListener("keydown", (e) => {
      let nextIdx = idx;
      if (e.key === "ArrowRight" || e.key === "ArrowDown") {
        e.preventDefault();
        nextIdx = (idx + 1) % tabs.length;
        activateTab(nextIdx);
      } else if (e.key === "ArrowLeft" || e.key === "ArrowUp") {
        e.preventDefault();
        nextIdx = (idx - 1 + tabs.length) % tabs.length;
        activateTab(nextIdx);
      } else if (e.key === "Home") {
        e.preventDefault();
        activateTab(0);
      } else if (e.key === "End") {
        e.preventDefault();
        activateTab(tabs.length - 1);
      }
    });
  });
}

/**
 * Update Compact Celebration Dashboard
 */
function updateDashboard() {
  if (!state.currentPlan) return;

  const plan = state.currentPlan;
  const currency = plan.budget.currency;
  const totalBudget = plan.budget.total_budget;

  // 1. Budget Balance Metric
  let totalAllocatedAmt = 0;
  let totalAllocatedPct = 0;
  (state.budgetAllocations.length ? state.budgetAllocations : plan.budget.items).forEach((i) => {
    totalAllocatedAmt += i.amount;
    totalAllocatedPct += i.percentage;
  });

  const contingencyItem = (state.budgetAllocations.length ? state.budgetAllocations : plan.budget.items).find(
    (i) => i.category.toLowerCase().includes("contingency")
  );
  const contingencyAmt = contingencyItem ? contingencyItem.amount : totalBudget * 0.08;

  const diffAmt = Math.round((totalAllocatedAmt - totalBudget) * 100) / 100;
  const isBalanced = Math.abs(diffAmt) < 0.05 || Math.abs(totalAllocatedPct - 100.0) < 0.1;

  if (elements.dashBudgetStatus) {
    if (isBalanced) {
      elements.dashBudgetStatus.textContent = "Balanced";
    } else if (diffAmt > 0) {
      elements.dashBudgetStatus.textContent = `Over by ${formatCurrency(diffAmt, currency)}`;
    } else {
      elements.dashBudgetStatus.textContent = `Under by ${formatCurrency(-diffAmt, currency)}`;
    }
  }

  if (elements.dashBudgetMeta) {
    elements.dashBudgetMeta.textContent = `${totalAllocatedPct.toFixed(1)}% allocated • ${formatCurrency(contingencyAmt, currency)} buffer`;
  }

  if (elements.dashBudgetFill) {
    elements.dashBudgetFill.style.width = `${Math.min(100, (totalAllocatedAmt / totalBudget) * 100)}%`;
  }

  // 2. Milestones Metric
  const totalMilestones = plan.timeline.milestones?.length || 0;
  const completedMilestones = state.completedMilestones.size;
  const milestonePct = totalMilestones > 0 ? Math.round((completedMilestones / totalMilestones) * 100) : 0;

  if (elements.dashMilestonesCount) {
    elements.dashMilestonesCount.textContent = `${completedMilestones} / ${totalMilestones}`;
  }
  if (elements.dashMilestonesMeta) {
    elements.dashMilestonesMeta.textContent = `${milestonePct}% milestones complete`;
  }
  if (elements.dashMilestonesFill) {
    elements.dashMilestonesFill.style.width = `${milestonePct}%`;
  }

  // 3. Vendors Metric
  const totalVendors = plan.checklist.tasks?.length || 0;
  let bookedVendors = 0;
  let contactedVendors = 0;
  plan.checklist.tasks?.forEach((t) => {
    const st = state.checklistStatusMap[t.id] || t.status;
    if (st === "booked") bookedVendors++;
    else if (st === "contacted") contactedVendors++;
  });
  const vendorPct = totalVendors > 0 ? Math.round((bookedVendors / totalVendors) * 100) : 0;

  if (elements.dashVendorsCount) {
    elements.dashVendorsCount.textContent = `${bookedVendors} / ${totalVendors}`;
  }
  if (elements.dashVendorsMeta) {
    elements.dashVendorsMeta.textContent = `${bookedVendors} booked • ${contactedVendors} in progress`;
  }
  if (elements.dashVendorsFill) {
    elements.dashVendorsFill.style.width = `${vendorPct}%`;
  }

  // 4. Days Remaining & Next Deadline
  if (elements.dashDaysRemaining) {
    elements.dashDaysRemaining.textContent = `${plan.timeline.days_remaining} Days`;
  }

  if (elements.dashNextDeadlineText && plan.timeline.milestones) {
    const nextMilestone = plan.timeline.milestones.find(
      (_, idx) => !state.completedMilestones.has(`milestone-${idx}`)
    );
    if (nextMilestone) {
      elements.dashNextDeadlineText.textContent = `Next: ${nextMilestone.period_label} (${nextMilestone.target_date})`;
    } else {
      elements.dashNextDeadlineText.textContent = "All milestones completed! 🎉";
    }
  }
}

/**
 * Export Functions: Copy Summary, JSON, CSV, and .ICS Calendar
 */
function setupExports() {
  // 1. Copy formatted textual plan summary (Contingency calculation fixed)
  elements.btnCopySummary?.addEventListener("click", () => {
    if (!state.currentPlan) return;
    const p = state.currentPlan;
    const items = state.budgetAllocations.length ? state.budgetAllocations : p.budget.items;

    // Find actual contingency item from allocations
    const contingencyItem = items.find((i) => i.category.toLowerCase().includes("contingency"));
    const contingencyAmt = contingencyItem ? contingencyItem.amount : p.budget.total_budget * 0.08;
    const contingencyPct = contingencyItem ? contingencyItem.percentage : 8.0;

    const summaryParts = [
      `🎉 EVENTEASE CELEBRATION MASTER PLAN`,
      `---------------------------------------`,
      `Plan Name: ${state.activePlanName || `${p.intake.event_type.toUpperCase()} in ${p.intake.city}`}`,
      `Event: ${p.intake.event_type.toUpperCase()} in ${p.intake.city}`,
      `Date: ${p.intake.date} (${p.timeline.days_remaining} days remaining)`,
      `Attendees: ${p.intake.guest_count} guests`,
      `Total Budget: ${formatCurrency(p.budget.total_budget, p.budget.currency)} (${formatCurrency(p.budget.cost_per_guest, p.budget.currency)}/guest)`,
      `Emergency Contingency: ${formatCurrency(contingencyAmt, p.budget.currency)} (${contingencyPct.toFixed(1)}% safety buffer)`,
      ``,
      `BUDGET BREAKDOWN:`,
      ...items.map(
        (i) => `• ${i.category}: ${i.percentage.toFixed(1)}% (${formatCurrency(i.amount, p.budget.currency)})`
      ),
      ``,
      `MILESTONES COMPLETED: ${state.completedMilestones.size} of ${p.timeline.milestones.length}`,
      ...p.timeline.milestones.map((m, idx) => {
        const mark = state.completedMilestones.has(`milestone-${idx}`) ? "[✓]" : "[ ]";
        return `${mark} ${m.period_label} (${m.target_date}): ${m.description}`;
      }),
      ``,
      `VENDOR PROGRESS:`,
      ...p.checklist.tasks.map((t) => {
        const st = state.checklistStatusMap[t.id] || t.status || "to-do";
        const contact = state.vendorContacts[t.id] ? ` | Contact: ${state.vendorContacts[t.id]}` : "";
        return `• [${st.toUpperCase()}] ${t.category} - ${t.vendor_type}${contact}`;
      }),
    ];

    if (state.vendorQuotes && state.vendorQuotes.length > 0) {
      summaryParts.push(``);
      summaryParts.push(`VENDOR QUOTES (USER RECORDS):`);
      state.vendorQuotes.forEach((q) => {
        summaryParts.push(
          `• [${q.status.toUpperCase()}] ${q.category} - ${q.vendorName}: Total ${formatCurrency(Number(q.totalAmount), p.budget.currency)} (Base: ${formatCurrency(Number(q.baseAmount), p.budget.currency)} + Fees: ${formatCurrency(Number(q.extraFees || 0), p.budget.currency)}) | Terms: ${q.paymentTerms || "N/A"}`
        );
      });
    }

    summaryParts.push(
      ``,
      `TOP THEMES:`,
      ...p.ideas.themes.slice(0, 3).map((t) => `• ${t}`),
      ``,
      `SAVINGS HACKS:`,
      ...p.ideas.budget_saving_tips.slice(0, 3).map((s) => `• ${s}`),
      `---------------------------------------`,
      `Generated by EventEase Algorithmic Core`
    );

    copyToClipboard(summaryParts.join("\n"), "Full celebration summary copied to clipboard! 📋✨");
  });

  // 2. Download JSON
  elements.btnExportJson?.addEventListener("click", () => {
    if (!state.currentPlan) return;

    const exportData = deepClone(state.currentPlan);
    exportData.plan_name = state.activePlanName || `${exportData.intake.event_type} in ${exportData.intake.city}`;
    exportData.budget.items = state.budgetAllocations.length ? state.budgetAllocations : exportData.budget.items;

    exportData.checklist.tasks.forEach((t) => {
      t.status = state.checklistStatusMap[t.id] || t.status || "to-do";
      if (state.vendorNotes[t.id]) t.local_notes = state.vendorNotes[t.id];
      if (state.vendorContacts[t.id]) t.local_contact = state.vendorContacts[t.id];
    });

    exportData.timeline.milestones.forEach((m, idx) => {
      m.completed = state.completedMilestones.has(`milestone-${idx}`);
    });

    exportData.vendor_quotes = state.vendorQuotes || [];
    exportData.exported_at = new Date().toISOString();

    const jsonString = JSON.stringify(exportData, null, 2);
    downloadFile(
      jsonString,
      `eventease_plan_${exportData.intake.event_type}_${exportData.intake.date}.json`,
      "application/json"
    );

    showToast("JSON plan exported! 💾");
    announceLive("Event plan JSON download started.");
  });

  // 3. Download CSV Spreadsheet (Protected against Formula Injection)
  elements.btnExportCsv?.addEventListener("click", () => {
    if (!state.currentPlan) return;
    const p = state.currentPlan;
    const items = state.budgetAllocations.length ? state.budgetAllocations : p.budget.items;

    const sanitizeCsvCell = (val) => {
      if (val === null || val === undefined) return "";
      let str = String(val);
      const trimmed = str.trimStart();
      if (trimmed.length > 0) {
        const firstChar = trimmed[0];
        if (
          firstChar === "=" ||
          firstChar === "+" ||
          firstChar === "-" ||
          firstChar === "@" ||
          firstChar === "\t" ||
          firstChar === "\r" ||
          firstChar === "|" ||
          firstChar === "%"
        ) {
          str = `'${str}`;
        }
      }
      if (str.includes(",") || str.includes('"') || str.includes("\n") || str.includes("\r")) {
        return `"${str.replace(/"/g, '""')}"`;
      }
      return str;
    };

    const csvLines = [
      ["EVENT CELEBRATION PLAN", p.intake.event_type.toUpperCase()],
      ["Plan Name", state.activePlanName || `${p.intake.event_type.toUpperCase()} in ${p.intake.city}`],
      ["Target Date", p.intake.date],
      ["City", p.intake.city],
      ["Planned Guests", p.intake.guest_count],
      ["Total Budget", `${p.budget.currency} ${p.budget.total_budget}`],
      ["Cost Per Guest", `${p.budget.currency} ${p.budget.cost_per_guest}`],
      [],
      ["BUDGET ALLOCATIONS"],
      ["Category", "Percentage (%)", `Amount (${p.budget.currency})`, "Scope & Description"],
      ...items.map((i) => [i.category, i.percentage.toFixed(1), i.amount.toFixed(2), i.description]),
      [],
      ["TIMELINE MILESTONES"],
      ["Period", "Target Date", "Status", "Description", "Tasks"],
      ...p.timeline.milestones.map((m, idx) => [
        m.period_label,
        m.target_date,
        state.completedMilestones.has(`milestone-${idx}`) ? "Completed" : "In Progress",
        m.description,
        m.tasks.join(" | "),
      ]),
      [],
      ["VENDOR TRACKING CHECKLIST (PRIVATE NOTES & CONTACTS)"],
      ["Category", "Vendor Type", "Status", "Contact Details", "Private Notes", "Key Interview Questions"],
      ...p.checklist.tasks.map((t) => [
        t.category,
        t.vendor_type,
        state.checklistStatusMap[t.id] || t.status || "to-do",
        state.vendorContacts[t.id] || "",
        state.vendorNotes[t.id] || t.notes || "",
        t.questions_to_ask.join(" | "),
      ]),
    ];

    if (state.vendorQuotes && state.vendorQuotes.length > 0) {
      csvLines.push([]);
      csvLines.push(["VENDOR QUOTE COMPARISON (USER-PROVIDED RECORDS)"]);
      csvLines.push([
        "Category",
        "Vendor / Company Name",
        "Status",
        `Base Quote (${p.budget.currency})`,
        `Extra Fees (${p.budget.currency})`,
        `Total Cost (${p.budget.currency})`,
        "Included Services & Scope",
        "Payment Terms",
      ]);
      state.vendorQuotes.forEach((q) => {
        csvLines.push([
          q.category,
          q.vendorName,
          q.status,
          Number(q.baseAmount).toFixed(2),
          Number(q.extraFees || 0).toFixed(2),
          Number(q.totalAmount).toFixed(2),
          q.includedServices || "",
          q.paymentTerms || "",
        ]);
      });
    }

    const csvContent = csvLines.map((row) => row.map(sanitizeCsvCell).join(",")).join("\r\n");
    downloadFile(
      csvContent,
      `eventease_budget_${p.intake.event_type}_${p.intake.date}.csv`,
      "text/csv;charset=utf-8;"
    );

    showToast("CSV spreadsheet exported! 📊");
    announceLive("Event plan CSV download started.");
  });

  // 4. Download .ICS Calendar (RFC 5545 Compliant)
  elements.btnExportIcs?.addEventListener("click", () => {
    if (!state.currentPlan) return;
    const p = state.currentPlan;

    const escapeIcsText = (str) => {
      if (!str) return "";
      return String(str)
        .replace(/\\/g, "\\\\")
        .replace(/;/g, "\\;")
        .replace(/,/g, "\\,")
        .replace(/\r\n|\r|\n/g, "\\n");
    };

    const getByteLength = (str) => {
      if (typeof TextEncoder !== "undefined") {
        return new TextEncoder().encode(str).length;
      }
      let bytes = 0;
      for (let i = 0; i < str.length; i++) {
        const code = str.charCodeAt(i);
        if (code <= 0x7f) bytes += 1;
        else if (code <= 0x7ff) bytes += 2;
        else if (code >= 0xd800 && code <= 0xdbff) {
          bytes += 4;
          i++;
        } else bytes += 3;
      }
      return bytes;
    };

    const foldIcsLine = (line) => {
      if (getByteLength(line) <= 75) {
        return line;
      }
      let result = "";
      let currentLineBytes = 0;
      let maxBytes = 75;
      for (const char of line) {
        const charBytes = getByteLength(char);
        if (currentLineBytes + charBytes > maxBytes) {
          result += "\r\n ";
          currentLineBytes = 1 + charBytes;
          maxBytes = 75;
        } else {
          currentLineBytes += charBytes;
        }
        result += char;
      }
      return result;
    };

    const formatDateToIcs = (dateStr) => {
      return dateStr.replace(/-/g, "");
    };

    const getNextDayIcs = (dateStr) => {
      const [year, month, day] = dateStr.split("-").map(Number);
      const date = new Date(Date.UTC(year, month - 1, day));
      date.setUTCDate(date.getUTCDate() + 1);
      const y = date.getUTCFullYear();
      const m = String(date.getUTCMonth() + 1).padStart(2, "0");
      const d = String(date.getUTCDate()).padStart(2, "0");
      return `${y}${m}${d}`;
    };

    const pad = (n) => (n < 10 ? `0${n}` : n);
    const now = new Date();
    const stamp = `${now.getUTCFullYear()}${pad(now.getUTCMonth() + 1)}${pad(now.getUTCDate())}T${pad(now.getUTCHours())}${pad(now.getUTCMinutes())}${pad(now.getUTCSeconds())}Z`;
    const planUidBase = state.activePlanId || `plan-${formatDateToIcs(p.intake.date)}`;

    const events = [];

    // Milestone Deadlines
    p.timeline.milestones.forEach((m, idx) => {
      const dtStart = formatDateToIcs(m.target_date);
      const dtEnd = getNextDayIcs(m.target_date);
      const isDone = state.completedMilestones.has(`milestone-${idx}`);
      const summaryText = escapeIcsText(`[EventEase] ${m.period_label} - ${p.intake.event_type.toUpperCase()} Prep`);
      const tasksFormatted = m.tasks.map((t) => `- ${t}`).join("\n");
      const descText = escapeIcsText(`${m.description}\n\nTasks:\n${tasksFormatted}`);

      const rawLines = [
        "BEGIN:VEVENT",
        `UID:eventease-${planUidBase}-milestone-${idx}@eventease.app`,
        `DTSTAMP:${stamp}`,
        `DTSTART;VALUE=DATE:${dtStart}`,
        `DTEND;VALUE=DATE:${dtEnd}`,
        `SUMMARY:${summaryText}`,
        `DESCRIPTION:${descText}`,
        `STATUS:${isDone ? "COMPLETED" : "CONFIRMED"}`,
        "END:VEVENT",
      ];
      events.push(rawLines.map(foldIcsLine).join("\r\n"));
    });

    // Main Celebration Day Event
    const celebrationDtStart = formatDateToIcs(p.intake.date);
    const celebrationDtEnd = getNextDayIcs(p.intake.date);
    const celebrationSummary = escapeIcsText(`🎉 ${p.intake.event_type.toUpperCase()} Celebration Day!`);
    const celebrationDesc = escapeIcsText(
      `Celebration in ${p.intake.city} with ${p.intake.guest_count} guests! Total budget: ${p.budget.currency} ${p.budget.total_budget}.`
    );

    const celebrationRawLines = [
      "BEGIN:VEVENT",
      `UID:eventease-${planUidBase}-celebration-day@eventease.app`,
      `DTSTAMP:${stamp}`,
      `DTSTART;VALUE=DATE:${celebrationDtStart}`,
      `DTEND;VALUE=DATE:${celebrationDtEnd}`,
      `SUMMARY:${celebrationSummary}`,
      `DESCRIPTION:${celebrationDesc}`,
      "STATUS:CONFIRMED",
      "END:VEVENT",
    ];
    events.push(celebrationRawLines.map(foldIcsLine).join("\r\n"));

    const icsContent = [
      "BEGIN:VCALENDAR",
      "VERSION:2.0",
      "PRODID:-//EventEase//Celebration Planning Prototype//EN",
      "CALSCALE:GREGORIAN",
      "METHOD:PUBLISH",
      ...events,
      "END:VCALENDAR",
    ].join("\r\n");

    downloadFile(
      icsContent,
      `eventease_schedule_${p.intake.event_type}_${p.intake.date}.ics`,
      "text/calendar;charset=utf-8;"
    );

    showToast(".ICS Calendar exported! 🗓️");
    announceLive("Calendar .ICS export download started.");
  });

  // 5. Print / PDF View
  elements.btnPrintView?.addEventListener("click", () => {
    window.print();
  });

  // 6. Celebrate button
  elements.btnCelebrate?.addEventListener("click", () => {
    triggerConfetti();
    showToast("Cheers to your extraordinary celebration! 🥂🎉");
  });
}

/**
 * Universal browser file download helper
 */
function downloadFile(content, filename, mimeType) {
  if (typeof window !== "undefined") {
    window.__lastDownloadedFile = { content, filename, mimeType };
  }
  const blob = new Blob([content], { type: mimeType });
  const url = typeof URL.createObjectURL === "function" ? URL.createObjectURL(blob) : "#";
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  if (typeof URL.revokeObjectURL === "function" && url !== "#") {
    URL.revokeObjectURL(url);
  }
}

/**
 * Database Workspace Setup and Synchronization
 */
function setupDatabaseWorkspace() {
  setupAuthUI();
  setupCharacterWidgets();

  const btnSaveDb = document.getElementById("btn-save-event-to-db");
  const dbSaveStatus = document.getElementById("db-save-status");
  const dbSaveBtnText = document.getElementById("db-save-btn-text");
  const btnWorkspaceSignIn = document.getElementById("btn-workspace-signin");
  const btnCreateNewEvent = document.getElementById("btn-create-new-event");

  btnWorkspaceSignIn?.addEventListener("click", () => {
    openAuthModal("signin");
  });

  btnCreateNewEvent?.addEventListener("click", () => {
    setActiveDatabaseEventId(null);
    state.activePlanId = null;
    state.activePlanName = "";
    if (elements.activePlanNameInput) elements.activePlanNameInput.value = "";
    elements.eventForm?.reset();
    setStep(1);
    elements.eventForm?.scrollIntoView({ behavior: "smooth" });
    showToast("Ready to plan a new celebration! ✨");
  });

  async function handleSaveToDatabase() {
    const user = getCurrentUser();
    if (!user) {
      openAuthModal("signin");
      showToast("Please sign in or create an account to save to the database.");
      return;
    }

    if (!state.currentPlan) {
      showToast("Generate or open a plan first before saving.");
      return;
    }

    const planName =
      (elements.activePlanNameInput?.value || "").trim() ||
      state.activePlanName ||
      `${state.currentPlan.intake.city} ${state.currentPlan.intake.event_type.toUpperCase()} (${new Date().toLocaleDateString()})`;

    state.activePlanName = planName;

    const intakeData = {
      event_type: state.currentPlan.intake.event_type || elements.eventType?.value || "other",
      date: state.currentPlan.intake.date || elements.eventDate?.value || new Date().toISOString().split("T")[0],
      city: state.currentPlan.intake.city || elements.eventCity?.value || "City",
      guest_count: Number(state.currentPlan.intake.guest_count || elements.guestCount?.value || 50),
      total_budget: Number(state.currentPlan.intake.total_budget || elements.totalBudget?.value || 5000),
      currency: state.currentPlan.intake.currency || elements.currency?.value || "USD",
      theme: state.currentPlan.intake.theme || elements.eventTheme?.value || null,
      cultural_dietary: state.currentPlan.intake.cultural_dietary || elements.culturalDietary?.value || null,
      special_notes: state.currentPlan.intake.special_notes || elements.specialNotes?.value || null,
    };

    const planData = {
      ...state.currentPlan,
      budgetAllocations: state.budgetAllocations,
      completedMilestones: Array.from(state.completedMilestones),
      checklistStatusMap: state.checklistStatusMap,
      vendorNotes: state.vendorNotes,
      vendorContacts: state.vendorContacts,
      vendorQuotes: state.vendorQuotes,
    };

    try {
      if (dbSaveBtnText) dbSaveBtnText.textContent = "Saving...";
      btnSaveDb?.setAttribute("disabled", "true");

      const activeDbId = getActiveDatabaseEventId();
      let savedEvent;
      if (activeDbId) {
        savedEvent = await updateDatabaseEvent(activeDbId, planName, intakeData, planData);
        showToast(`Updated "${planName}" in database! ☁️`);
      } else {
        savedEvent = await createDatabaseEvent(planName, intakeData, planData);
        showToast(`Saved "${planName}" to database! ☁️`);
      }

      if (dbSaveStatus) {
        dbSaveStatus.classList.remove("hidden");
        dbSaveStatus.textContent = "Saved to Database ✓";
        setTimeout(() => dbSaveStatus.classList.add("hidden"), 4000);
      }

      await reloadDatabaseWorkspace();
    } catch (err) {
      console.error("Save to database error:", err);
      showToast(err.message || "Failed to save plan to database.");
    } finally {
      if (dbSaveBtnText) dbSaveBtnText.textContent = "Save to Database";
      btnSaveDb?.removeAttribute("disabled");
    }
  }

  btnSaveDb?.addEventListener("click", handleSaveToDatabase);

  // Sync workspace on auth state change
  onAuthStateChanged(() => {
    reloadDatabaseWorkspace();
  });

  // Initial check
  checkAuthStatus().then(() => {
    reloadDatabaseWorkspace();
  });
}

async function reloadDatabaseWorkspace() {
  const user = getCurrentUser();
  const authContent = document.getElementById("workspace-auth-content");
  const unauthBanner = document.getElementById("workspace-unauth-banner");

  if (!user) {
    if (authContent) authContent.classList.add("hidden");
    if (unauthBanner) unauthBanner.classList.remove("hidden");
    return;
  }

  if (authContent) authContent.classList.remove("hidden");
  if (unauthBanner) unauthBanner.classList.add("hidden");

  try {
    const events = await fetchUserEvents();
    renderSavedEventsWorkspace(events, {
      onOpen: async (id) => {
        try {
          showToast("Loading event from database...");
          const detail = await fetchEventDetail(id);
          setActiveDatabaseEventId(detail.id);
          state.activePlanName = detail.name;
          if (elements.activePlanNameInput) {
            elements.activePlanNameInput.value = detail.name;
          }

          // Populate intake inputs
          if (detail.intake) {
            if (elements.eventType) elements.eventType.value = detail.intake.event_type || "";
            if (elements.eventDate) elements.eventDate.value = detail.intake.date || "";
            if (elements.eventCity) elements.eventCity.value = detail.intake.city || "";
            if (elements.guestCount) elements.guestCount.value = detail.intake.guest_count || "";
            if (elements.currency) elements.currency.value = detail.intake.currency || "USD";
            if (elements.totalBudget) elements.totalBudget.value = detail.intake.total_budget || "";
            if (elements.eventTheme) elements.eventTheme.value = detail.intake.theme || "";
            if (elements.culturalDietary) elements.culturalDietary.value = detail.intake.cultural_dietary || "";
            if (elements.specialNotes) elements.specialNotes.value = detail.intake.special_notes || "";
          }

          // Restore plan
          const planData = detail.plan_data;
          state.currentPlan = planData;
          state.budgetAllocations =
            planData.budgetAllocations ||
            (planData.budget?.items ? planData.budget.items.map((i) => ({ ...i })) : []);
          state.completedMilestones = new Set(planData.completedMilestones || []);
          state.checklistStatusMap = planData.checklistStatusMap || {};
          state.vendorNotes = planData.vendorNotes || {};
          state.vendorContacts = planData.vendorContacts || {};
          state.vendorQuotes = planData.vendorQuotes || [];

          updateLiveEstimate();

          // Render master plan
          elements.resultsContainer?.classList.remove("hidden");
          renderMasterPlan(state.currentPlan);
          elements.resultsContainer?.scrollIntoView({ behavior: "smooth" });

          triggerLumiReaction(`Loaded "${detail.name}" from your database! ✨`);
          showToast(`Reopened "${detail.name}"`);
        } catch (err) {
          console.error("Failed to open event:", err);
          showToast("Could not load event from database.");
        }
      },
      onDuplicate: async (id) => {
        try {
          const dup = await duplicateDatabaseEvent(id);
          showToast(`Duplicated as "${dup.name}"!`);
          await reloadDatabaseWorkspace();
        } catch (err) {
          showToast("Failed to duplicate event.");
        }
      },
      onDelete: async (id, name) => {
        if (confirm(`Are you sure you want to delete "${name}" from your account database?`)) {
          try {
            await deleteDatabaseEvent(id);
            showToast(`Deleted "${name}".`);
            await reloadDatabaseWorkspace();
          } catch (err) {
            showToast("Failed to delete event.");
          }
        }
      },
      onCreateNew: () => {
        setActiveDatabaseEventId(null);
        elements.eventForm?.reset();
        setStep(1);
        elements.eventForm?.scrollIntoView({ behavior: "smooth" });
      },
    });
  } catch (err) {
    console.error("Failed to fetch user events:", err);
  }
}

/**
 * Initialize Application
 */
function init() {
  initTheme();
  checkAiStatus();
  initMascots();
  setupTabs();
  setupExports();
  setupNewPlanModal();
  setupPlanLibrary();
  setupVendorQuoteForm();
  loadPresets();
  renderPlanLibrary();
  checkSavedPlanOnLoad();
  setupDatabaseWorkspace();

  // Multi-step buttons
  elements.btnToStep2?.addEventListener("click", () => {
    if (validateStep1()) setStep(2);
  });

  elements.btnBackToStep1?.addEventListener("click", () => setStep(1));

  elements.btnToStep3?.addEventListener("click", () => {
    if (validateStep2()) setStep(3);
  });

  elements.btnBackToStep2?.addEventListener("click", () => setStep(2));

  // Live estimate listeners
  elements.guestCount?.addEventListener("input", updateLiveEstimate);
  elements.totalBudget?.addEventListener("input", updateLiveEstimate);
  elements.currency?.addEventListener("change", updateLiveEstimate);

  // Form submit
  elements.eventForm?.addEventListener("submit", handlePlanSubmit);

  // Set default min date for datepicker to tomorrow
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const minDateStr = tomorrow.toISOString().split("T")[0];
  if (elements.eventDate) {
    elements.eventDate.min = minDateStr;
  }
}

// Bootstrap once DOM is loaded
let isInitialized = false;
function safeInit() {
  if (isInitialized) return;
  isInitialized = true;
  init();
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", safeInit);
} else {
  safeInit();
}
