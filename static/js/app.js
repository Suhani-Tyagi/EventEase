/**
 * EventEase - Frontend Application Logic (ES Module)
 * WCAG 2.1 AA Compliant & Secure (strictly uses textContent for dynamic content)
 */

// Application State
const state = {
  currentStep: 1,
  currentPlan: null,
  checklistStatusMap: {},
};

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

  // Presets
  presetWedding: document.getElementById("preset-wedding"),
  presetBirthday: document.getElementById("preset-birthday"),
  presetCommunity: document.getElementById("preset-community"),

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

  // Deliverable 2: Timeline
  timelineDaysBadge: document.getElementById("timeline-days-badge"),
  timelineAdvisoryBox: document.getElementById("timeline-advisory-box"),
  timelineAdvisoryText: document.getElementById("timeline-advisory-text"),
  timelineStepper: document.getElementById("timeline-stepper"),

  // Deliverable 3: Checklist
  checklistSummaryBadge: document.getElementById("checklist-summary-badge"),
  checklistContainer: document.getElementById("checklist-container"),

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

  // Export Buttons
  btnExportJson: document.getElementById("btn-export-json"),
  btnPrintView: document.getElementById("btn-print-view"),
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
 * Setup Theme Toggle (Light / Dark)
 */
function initTheme() {
  const savedTheme = localStorage.getItem("eventease-theme");
  const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
  const currentTheme = savedTheme || (prefersDark ? "dark" : "light");

  applyTheme(currentTheme);

  elements.themeToggle?.addEventListener("click", () => {
    const isDark = document.documentElement.getAttribute("data-theme") === "dark";
    const nextTheme = isDark ? "light" : "dark";
    applyTheme(nextTheme);
  });
}

function applyTheme(theme) {
  document.documentElement.setAttribute("data-theme", theme);
  localStorage.setItem("eventease-theme", theme);
  const isDark = theme === "dark";
  if (elements.themeToggle) {
    elements.themeToggle.setAttribute("aria-pressed", isDark.toString());
  }
  if (elements.themeIcon) {
    elements.themeIcon.textContent = isDark ? "\u2600" : "\u263E";
  }
  if (elements.themeText) {
    elements.themeText.textContent = isDark ? "Light Mode" : "Dark Mode";
  }
}

/**
 * Multi-Step Form Navigation & Validation
 */
function setStep(step) {
  state.currentStep = step;

  // Update fieldset visibility
  elements.step1.classList.toggle("active", step === 1);
  elements.step2.classList.toggle("active", step === 2);
  elements.step3.classList.toggle("active", step === 3);

  // Update pills
  elements.pillStep1.classList.toggle("active", step >= 1);
  elements.pillStep2.classList.toggle("active", step >= 2);
  elements.pillStep3.classList.toggle("active", step >= 3);

  announceLive(`Navigated to Step ${step} of 3.`);

  // Set focus to the first interactive field in the step
  if (step === 1) elements.eventType.focus();
  if (step === 2) elements.guestCount.focus();
  if (step === 3) elements.eventTheme.focus();
}

function clearFieldError(inputEl, errorId) {
  inputEl.classList.remove("input-error");
  const errEl = document.getElementById(errorId);
  if (errEl) errEl.textContent = "";
}

function showFieldError(inputEl, errorId, message) {
  inputEl.classList.add("input-error");
  const errEl = document.getElementById(errorId);
  if (errEl) {
    errEl.textContent = message;
  }
  announceLive(message, true);
}

function validateStep1() {
  let valid = true;
  clearFieldError(elements.eventCity, "event-city-error");
  clearFieldError(elements.eventDate, "event-date-error");

  const city = elements.eventCity.value.trim();
  if (!city || city.length < 2) {
    showFieldError(elements.eventCity, "event-city-error", "City or region is required (minimum 2 characters).");
    valid = false;
  }

  const dateVal = elements.eventDate.value;
  if (!dateVal) {
    showFieldError(elements.eventDate, "event-date-error", "Please select a scheduled event date.");
    valid = false;
  } else {
    const selectedDate = new Date(dateVal + "T00:00:00");
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    if (selectedDate <= today) {
      showFieldError(elements.eventDate, "event-date-error", "Event date must be in the future.");
      valid = false;
    }
  }

  return valid;
}

function validateStep2() {
  let valid = true;
  clearFieldError(elements.guestCount, "guest-count-error");
  clearFieldError(elements.totalBudget, "total-budget-error");

  const guests = parseInt(elements.guestCount.value, 10);
  if (isNaN(guests) || guests < 1 || guests > 10000) {
    showFieldError(elements.guestCount, "guest-count-error", "Guest count must be between 1 and 10,000.");
    valid = false;
  }

  const budget = parseFloat(elements.totalBudget.value);
  if (isNaN(budget) || budget <= 0 || budget > 50000000) {
    showFieldError(elements.totalBudget, "total-budget-error", "Total budget must be greater than 0 and up to 50,000,000.");
    valid = false;
  }

  return valid;
}

/**
 * Load Demo Presets
 */
async function loadPresets() {
  try {
    const res = await fetch("/api/presets");
    if (!res.ok) return;
    const presets = await res.json();

    const applyPreset = (presetKey) => {
      const data = presets[presetKey];
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

      setStep(3);
      announceLive(`Loaded preset: ${data.name}. Ready to generate plan.`);
    };

    elements.presetWedding?.addEventListener("click", () => applyPreset("wedding"));
    elements.presetBirthday?.addEventListener("click", () => applyPreset("birthday"));
    elements.presetCommunity?.addEventListener("click", () => applyPreset("community"));
  } catch (err) {
    console.error("Failed to load presets", err);
  }
}

/**
 * Handle Form Submission & Plan Generation
 */
async function handlePlanSubmit(e) {
  e.preventDefault();

  if (!validateStep1()) {
    setStep(1);
    return;
  }
  if (!validateStep2()) {
    setStep(2);
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

  // UI Loading State
  elements.btnGeneratePlan.disabled = true;
  elements.btnGenerateSpinner.classList.remove("hidden");
  elements.loadingIndicator.classList.remove("hidden");
  elements.resultsContainer.classList.add("hidden");
  announceLive("Generating comprehensive event plan. Please wait...");

  try {
    const response = await fetch("/api/plan", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.detail || "Failed to generate event plan.");
    }

    const plan = await response.json();
    state.currentPlan = plan;
    renderPlan(plan);

    elements.resultsContainer.classList.remove("hidden");
    elements.resultsContainer.scrollIntoView({ behavior: "smooth" });
    announceLive("Event plan generated successfully!");
  } catch (err) {
    announceLive(`Error: ${err.message}`, true);
    alert(`Could not generate event plan: ${err.message}`);
  } finally {
    elements.btnGeneratePlan.disabled = false;
    elements.btnGenerateSpinner.classList.add("hidden");
    elements.loadingIndicator.classList.add("hidden");
  }
}

/**
 * Render All Deliverables (Using strictly textContent for security)
 */
function renderPlan(plan) {
  // Update Meta Header
  elements.resultsMetaText.textContent = `${plan.intake.event_type.toUpperCase()} in ${plan.intake.city} \u2022 ${plan.intake.guest_count} Guests \u2022 Date: ${plan.intake.date}`;

  // Fallback Notice
  if (plan.ideas.is_fallback) {
    elements.fallbackNoticeBanner.classList.remove("hidden");
    elements.fallbackReasonText.textContent = plan.ideas.fallback_reason || "Curated offline suggestions are active.";
  } else {
    elements.fallbackNoticeBanner.classList.add("hidden");
  }

  // Realistic Budget Warning
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

function renderTimeline(timeline) {
  elements.timelineDaysBadge.textContent = `${timeline.days_remaining} Days Remaining`;

  if (timeline.is_compressed && timeline.advisory) {
    elements.timelineAdvisoryBox.classList.remove("hidden");
    elements.timelineAdvisoryText.textContent = timeline.advisory;
  } else {
    elements.timelineAdvisoryBox.classList.add("hidden");
  }

  elements.timelineStepper.textContent = "";

  timeline.milestones.forEach((milestone) => {
    const li = document.createElement("li");
    li.className = "timeline-item";

    const header = document.createElement("div");
    header.className = "timeline-item-header";

    const periodSpan = document.createElement("span");
    periodSpan.className = "timeline-period";
    periodSpan.textContent = milestone.period_label;

    const dateSpan = document.createElement("span");
    dateSpan.className = "timeline-target-date";
    dateSpan.textContent = milestone.target_date;

    header.appendChild(periodSpan);
    header.appendChild(dateSpan);

    const descP = document.createElement("p");
    descP.className = "timeline-desc";
    descP.textContent = milestone.description;

    const taskUl = document.createElement("ul");
    taskUl.className = "timeline-tasks-list";

    milestone.tasks.forEach((task) => {
      const taskLi = document.createElement("li");
      taskLi.textContent = task;
      taskUl.appendChild(taskLi);
    });

    li.appendChild(header);
    li.appendChild(descP);
    li.appendChild(taskUl);

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
}

function renderChecklist(checklist) {
  elements.checklistContainer.textContent = "";
  updateChecklistSummary();

  checklist.tasks.forEach((task) => {
    const card = document.createElement("div");
    card.className = "checklist-card";

    const header = document.createElement("div");
    header.className = "checklist-card-header";

    const vendorSpan = document.createElement("span");
    vendorSpan.className = "checklist-vendor-type";
    vendorSpan.textContent = `${task.category}: ${task.vendor_type}`;

    const select = document.createElement("select");
    select.className = "checklist-status-select";
    select.setAttribute("aria-label", `Status for ${task.vendor_type}`);

    ["to-do", "contacted", "booked"].forEach((st) => {
      const opt = document.createElement("option");
      opt.value = st;
      opt.textContent = st.charAt(0).toUpperCase() + st.slice(1);
      const currentStatus = state.checklistStatusMap[task.id] || task.status;
      if (currentStatus === st) {
        opt.selected = true;
      }
      select.appendChild(opt);
    });

    select.addEventListener("change", (e) => {
      const newStatus = e.target.value;
      state.checklistStatusMap[task.id] = newStatus;
      updateChecklistSummary();
      announceLive(`Updated ${task.vendor_type} status to ${newStatus}`);
    });

    header.appendChild(vendorSpan);
    header.appendChild(select);

    const questionsUl = document.createElement("ul");
    questionsUl.className = "checklist-questions";
    task.questions_to_ask.forEach((q) => {
      const qLi = document.createElement("li");
      qLi.textContent = q;
      questionsUl.appendChild(qLi);
    });

    card.appendChild(header);
    card.appendChild(questionsUl);

    if (task.notes) {
      const notesP = document.createElement("p");
      notesP.className = "checklist-notes";
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
    li.textContent = text;
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
 * Export Functions: JSON Download and Print / PDF View
 */
function setupExports() {
  elements.btnExportJson?.addEventListener("click", () => {
    if (!state.currentPlan) return;

    // Merge latest checklist statuses into exported JSON
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

    announceLive("Event plan JSON download started.");
  });

  elements.btnPrintView?.addEventListener("click", () => {
    window.print();
  });
}

/**
 * Initialize Application
 */
function init() {
  initTheme();
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
