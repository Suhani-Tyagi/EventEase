/**
 * EventEase - Frontend Application Logic (ES Module)
 * WCAG 2.1 AA Compliant & Secure (strictly uses textContent for dynamic content)
 */

// Application State
const state = {
  currentStep: 1,
  currentPlan: null,
  checklistStatusMap: {},
  completedMilestones: new Set(),
  currentTipIndex: 0,
};

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

  // Results Section
  loadingIndicator: document.getElementById("loading-indicator"),
  resultsContainer: document.getElementById("results-container"),
  resultsMetaText: document.getElementById("results-meta-text"),
  fallbackNoticeBanner: document.getElementById("fallback-notice-banner"),
  fallbackReasonText: document.getElementById("fallback-reason-text"),
  budgetWarningBanner: document.getElementById("budget-warning-banner"),
  budgetWarningText: document.getElementById("budget-warning-text"),

  // Deliverable 1: Budget
  costPerGuestBadge: document.getElementById("cost-per-guest-badge"),
  budgetExplanation: document.getElementById("budget-explanation"),
  budgetTableBody: document.getElementById("budget-table-body"),
  budgetTotalAmount: document.getElementById("budget-total-amount"),
  budgetSegmentedBar: document.getElementById("budget-segmented-bar"),

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

  // Export Buttons & Global Containers
  btnCopySummary: document.getElementById("btn-copy-summary"),
  btnExportJson: document.getElementById("btn-export-json"),
  btnPrintView: document.getElementById("btn-print-view"),
  btnCelebrate: document.getElementById("btn-celebrate"),
  confettiContainer: document.getElementById("confetti-canvas-container"),
  toastContainer: document.getElementById("toast-container"),
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
 * Aesthetic Confetti Shower Particle Generator
 */
function triggerConfetti() {
  if (!elements.confettiContainer) return;

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
      piece.style.clipPath = "polygon(50% 0%, 61% 35%, 98% 35%, 68% 57%, 79% 91%, 50% 70%, 21% 91%, 32% 57%, 2% 35%, 39% 35%)";
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
 * Interactive Mascots & Companion Logic
 */
function initMascots() {
  // Hero Sparkle button
  elements.btnHeroSparkle?.addEventListener("click", () => {
    triggerConfetti();
    if (elements.lumiHeroText) {
      elements.lumiHeroText.textContent = "✨ Sparkles activated! May your event be bright, beautiful, and completely stress-free!";
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
    if (elements.lumiWidgetBubble) {
      if (elements.lumiWidgetBubble.classList.contains("hidden")) {
        elements.lumiWidgetBubble.classList.remove("hidden");
      }
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
    elements.liveEstimateText.textContent = "Enter guests and budget to see estimated per-guest allocation";
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

        // Update mascot speech
        if (elements.lumiHeroText) {
          elements.lumiHeroText.textContent = `Loaded ${data.name}! Click 'Generate Full Celebration Plan' to calculate! ✨`;
        }

        // Smooth scroll down to intake form
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
    state.checklistStatusMap = {};
    state.completedMilestones.clear();

    renderMasterPlan(plan);

    elements.resultsContainer.classList.remove("hidden");
    elements.resultsContainer.scrollIntoView({ behavior: "smooth", block: "start" });
    
    // Celebration effects
    triggerConfetti();
    showToast("Celebration Plan generated successfully! 🎉✨");
    announceLive("Event plan generated successfully.");

    if (elements.lumiHeroText) {
      elements.lumiHeroText.textContent = "Woohoo! Your celebration blueprint is complete! Check out all 4 deliverables below! 🥳🎉";
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
    elements.fallbackReasonText.textContent = plan.ideas.fallback_reason || "Curated offline suggestions are active.";
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
}

function formatCurrency(amount, currencyCode) {
  return `${currencyCode} ${amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function renderBudget(budget) {
  elements.costPerGuestBadge.textContent = `Per-Guest: ${formatCurrency(budget.cost_per_guest, budget.currency)}`;
  elements.budgetExplanation.textContent = budget.explanation;
  elements.budgetTotalAmount.textContent = formatCurrency(budget.total_budget, budget.currency);

  elements.budgetTableBody.textContent = "";

  // Dynamic visual segmented bar
  if (elements.budgetSegmentedBar) {
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

    budget.items.forEach((item, idx) => {
      const seg = document.createElement("div");
      seg.className = "segment";
      seg.style.width = `${item.percentage.toFixed(1)}%`;
      seg.style.backgroundColor = colorMap[idx % colorMap.length];
      seg.title = `${item.category}: ${item.percentage.toFixed(1)}% (${formatCurrency(item.amount, budget.currency)})`;
      elements.budgetSegmentedBar.appendChild(seg);
    });
  }

  budget.items.forEach((item) => {
    const tr = document.createElement("tr");

    const tdCategory = document.createElement("td");
    tdCategory.textContent = item.category;

    const tdPct = document.createElement("td");
    tdPct.className = "text-right";
    tdPct.textContent = `${item.percentage.toFixed(1)}%`;

    const tdAmount = document.createElement("td");
    tdAmount.className = "text-right";
    tdAmount.textContent = formatCurrency(item.amount, budget.currency);

    const tdDesc = document.createElement("td");
    tdDesc.textContent = item.description;

    tr.appendChild(tdCategory);
    tr.appendChild(tdPct);
    tr.appendChild(tdAmount);
    tr.appendChild(tdDesc);

    elements.budgetTableBody.appendChild(tr);
  });
}

function updateMilestoneProgress(timeline) {
  if (!elements.milestoneTrackerPill || !timeline.milestones) return;
  const total = timeline.milestones.length;
  const completed = state.completedMilestones.size;
  elements.milestoneTrackerPill.textContent = `${completed} / ${total} Milestones Done`;

  if (completed === total && total > 0) {
    triggerConfetti();
    showToast("🎉 Amazing! All milestones completed!");
  }
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

    // Interactive button toggle for each milestone
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
        showToast(`Milestone marked in progress`);
      } else {
        state.completedMilestones.add(milestoneId);
        itemBtn.classList.add("completed");
        checkboxSpan.innerHTML = "&#10004;";
        showToast(`Milestone completed! 🎉`);
      }
      updateMilestoneProgress(timeline);
    });

    li.appendChild(itemBtn);
    elements.timelineStepper.appendChild(li);
  });
}

function updateChecklistSummary() {
  if (!state.currentPlan?.checklist?.tasks) return;
  const tasks = state.currentPlan.checklist.tasks;
  const bookedCount = tasks.filter(
    (t) => (state.checklistStatusMap[t.id] || t.status) === "booked"
  ).length;

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
}

function renderChecklist(checklist) {
  elements.checklistContainer.textContent = "";
  updateChecklistSummary();

  checklist.tasks.forEach((task) => {
    const card = document.createElement("div");
    card.className = "checklist-item";
    const currentStatus = state.checklistStatusMap[task.id] || task.status;
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
    select.setAttribute("aria-label", `Status for ${task.vendor_type}`);

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
      if (newStatus === "booked") {
        card.classList.add("status-booked");
        showToast(`${task.vendor_type} marked as Booked! 🤝`);
      } else {
        card.classList.remove("status-booked");
      }
      updateChecklistSummary();
      announceLive(`Updated ${task.vendor_type} status to ${newStatus}`);
    });

    header.appendChild(vendorSpan);
    header.appendChild(select);

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

    elements.checklistContainer.appendChild(card);
  });
}

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
 * Ideas Tab Switching
 */
function setupTabs() {
  const tabs = [
    { btn: elements.tabThemes, panel: elements.panelThemes },
    { btn: elements.tabDecor, panel: elements.panelDecor },
    { btn: elements.tabMenu, panel: elements.panelMenu },
    { btn: elements.tabActivities, panel: elements.panelActivities },
    { btn: elements.tabTips, panel: elements.panelTips },
  ];

  tabs.forEach(({ btn, panel }) => {
    btn?.addEventListener("click", () => {
      tabs.forEach((t) => {
        t.btn.classList.remove("active");
        t.btn.setAttribute("aria-selected", "false");
        t.panel.classList.add("hidden");
        t.panel.classList.remove("active");
      });

      btn.classList.add("active");
      btn.setAttribute("aria-selected", "true");
      panel.classList.remove("hidden");
      panel.classList.add("active");
    });
  });
}

/**
 * Export Functions: Copy Summary, JSON Download, and Print / PDF View
 */
function setupExports() {
  // Copy formatted textual plan summary
  elements.btnCopySummary?.addEventListener("click", () => {
    if (!state.currentPlan) return;
    const p = state.currentPlan;
    const summary = [
      `🎉 EVENTEASE CELEBRATION MASTER PLAN`,
      `---------------------------------------`,
      `Event: ${p.intake.event_type.toUpperCase()} in ${p.intake.city}`,
      `Date: ${p.intake.date} (${p.timeline.days_remaining} days remaining)`,
      `Attendees: ${p.intake.guest_count} guests`,
      `Total Budget: ${formatCurrency(p.budget.total_budget, p.budget.currency)} (${formatCurrency(p.budget.cost_per_guest, p.budget.currency)}/guest)`,
      `Emergency Contingency: ${formatCurrency(p.budget.contingency_reserve, p.budget.currency)} (8.0% safety buffer)`,
      ``,
      `BUDGET BREAKDOWN:`,
      ...p.budget.items.map((i) => `• ${i.category}: ${i.percentage}% (${formatCurrency(i.amount, p.budget.currency)})`),
      ``,
      `TOP THEMES:`,
      ...p.ideas.themes.slice(0, 3).map((t) => `• ${t}`),
      ``,
      `SAVINGS HACKS:`,
      ...p.ideas.budget_saving_tips.slice(0, 3).map((s) => `• ${s}`),
      `---------------------------------------`,
      `Generated by EventEase Algorithmic Core`,
    ].join("\n");

    copyToClipboard(summary, "Full celebration summary copied to clipboard! 📋✨");
  });

  // Download JSON
  elements.btnExportJson?.addEventListener("click", () => {
    if (!state.currentPlan) return;

    const exportData = structuredClone(state.currentPlan);
    exportData.checklist.tasks.forEach((t) => {
      if (state.checklistStatusMap[t.id]) {
        t.status = state.checklistStatusMap[t.id];
      }
    });

    const jsonString = JSON.stringify(exportData, null, 2);
    const blob = new Blob([jsonString], { type: "application/json" });
    const url = URL.createObjectURL(blob);

    const a = document.createElement("a");
    a.href = url;
    a.download = `eventease_plan_${exportData.intake.event_type}_${exportData.intake.date}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    showToast("JSON plan exported! 💾");
    announceLive("Event plan JSON download started.");
  });

  // Print / PDF View
  elements.btnPrintView?.addEventListener("click", () => {
    window.print();
  });

  // Celebrate button
  elements.btnCelebrate?.addEventListener("click", () => {
    triggerConfetti();
    showToast("Cheers to your extraordinary celebration! 🥂🎉");
  });
}

/**
 * Initialize Application
 */
function init() {
  initTheme();
  initMascots();
  setupTabs();
  setupExports();
  loadPresets();

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
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", init);
} else {
  init();
}
