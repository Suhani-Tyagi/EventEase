/**
 * Planning squad characters & Lumi companion module.
 * Provides context-aware planning tips, purposeful progress reactions,
 * accessible celebration effects, and reduced-motion controls.
 */

let motionEnabled = true;

export function initMotionPreference() {
  // Check OS preference
  const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
  const savedPreference = localStorage.getItem('eventease_motion_enabled');

  if (savedPreference !== null) {
    motionEnabled = savedPreference === 'true';
  } else {
    motionEnabled = !mediaQuery.matches;
  }

  applyMotionState();

  mediaQuery.addEventListener('change', (e) => {
    if (localStorage.getItem('eventease_motion_enabled') === null) {
      motionEnabled = !e.matches;
      applyMotionState();
    }
  });

  const toggleBtn = document.getElementById('motion-toggle');
  if (toggleBtn && !toggleBtn.dataset.wired) {
    toggleBtn.dataset.wired = 'true';
    toggleBtn.addEventListener('click', () => {
      motionEnabled = !motionEnabled;
      localStorage.setItem('eventease_motion_enabled', String(motionEnabled));
      applyMotionState();
    });
  }
}

export function isMotionEnabled() {
  return motionEnabled;
}

function applyMotionState() {
  const root = document.documentElement;
  const toggleBtn = document.getElementById('motion-toggle');
  const toggleText = document.getElementById('motion-text');

  if (motionEnabled) {
    root.classList.remove('reduce-motion-active');
    if (toggleBtn) toggleBtn.setAttribute('aria-pressed', 'false');
    if (toggleText) toggleText.textContent = 'Motion: ON';
  } else {
    root.classList.add('reduce-motion-active');
    if (toggleBtn) toggleBtn.setAttribute('aria-pressed', 'true');
    if (toggleText) toggleText.textContent = 'Motion: OFF';
  }
}

/**
 * Character Context Tips & Reactive Guides
 */
export const CHARACTER_ROLES = {
  barnaby: {
    name: 'Barnaby',
    title: 'Financial Strategist',
    emoji: '🦫',
    color: '#928E5E',
  },
  pip: {
    name: 'Pip',
    title: 'Creative & Hospitality Curator',
    emoji: '🐧',
    color: '#B97D7B',
  },
  shep: {
    name: 'Shep',
    title: 'Milestone Pathfinder',
    emoji: '🐶',
    color: '#575527',
  },
  nova: {
    name: 'Nova',
    title: 'Vendor Contract Scout',
    emoji: '🐱',
    color: '#ECC4C3',
  },
  lumi: {
    name: 'Lumi',
    title: 'Celebration Host Spark',
    emoji: '✨',
    color: '#ECC4C3',
  },
};

/**
 * Update speech bubble and announce for screen readers.
 */
function setSpeechText(bubbleId, text, announcerId = 'live-region') {
  const bubble = document.getElementById(bubbleId);
  if (bubble) {
    const textEl = bubble.querySelector('p') || bubble;
    textEl.textContent = text;
    bubble.classList.add('bubble-pulse');
    setTimeout(() => bubble.classList.remove('bubble-pulse'), 800);
  }

  const live = document.getElementById(announcerId);
  if (live) {
    live.textContent = text;
  }
}

/**
 * Barnaby: Reaction to budget allocations.
 */
export function reactToBudget(isBalanced, status, percentage, contingency) {
  const bubble = document.getElementById('barnaby-speech') || document.getElementById('lumi-hero-speech');
  let message = '';

  if (isBalanced) {
    message = `Barnaby (Budget): "Splendid accounting! Your budget is perfectly balanced (100.0%) with a dedicated ${contingency.toFixed(1)}% safety buffer."`;
  } else if (status === 'over') {
    const overage = (percentage - 100).toFixed(1);
    message = `Barnaby (Budget): "Hold on! We're ${overage}% overallocated (${percentage.toFixed(1)}%). Trim a category or lower allocations to balance."`;
  } else {
    const remaining = (100 - percentage).toFixed(1);
    message = `Barnaby (Budget): "You have ${remaining}% unallocated funds remaining. Allocate them to catering, decor, or boost your contingency."`;
  }

  if (bubble) {
    setSpeechText(bubble.id, message);
  }
}

/**
 * Shep: Reaction to milestone progress.
 */
export function reactToMilestone(completed, total, milestoneName) {
  const bubble = document.getElementById('shep-speech') || document.getElementById('lumi-hero-speech');
  const percent = Math.round((completed / total) * 100);
  let message = '';

  if (completed === total && total > 0) {
    message = `Shep (Timeline): "Outstanding! All ${total} milestones completed! The celebration schedule is 100% prepared."`;
    triggerSparkles();
  } else {
    message = `Shep (Timeline): "${completed} of ${total} milestones marked complete (${percent}%). Next focus: ${milestoneName || 'upcoming deadline'}."`;
  }

  if (bubble) {
    setSpeechText(bubble.id, message);
  }
}

/**
 * Nova: Reaction to vendor updates.
 */
export function reactToVendorBooking(vendorType, status) {
  const bubble = document.getElementById('nova-speech') || document.getElementById('lumi-hero-speech');
  let message = '';

  if (status === 'booked') {
    message = `Nova (Vendors): "Contract secured for ${vendorType}! Be sure to log deposit deadlines and arrival times in your notes."`;
    triggerSparkles();
  } else if (status === 'contacted') {
    message = `Nova (Vendors): "Inquiry sent to ${vendorType}. Check screening questions about overtime and cancellation policies."`;
  } else {
    message = `Nova (Vendors): "${vendorType} is on your checklist. Review recommended screening questions before signing."`;
  }

  if (bubble) {
    setSpeechText(bubble.id, message);
  }
}

/**
 * Pip: Reaction to creative tabs.
 */
export function reactToCreativeTab(tabId) {
  const bubble = document.getElementById('pip-speech') || document.getElementById('lumi-hero-speech');
  const tips = {
    themes: 'Pip (Creative): "Atmosphere sets the mood—cohesive palettes and moodboards elevate any space!"',
    decor: 'Pip (Creative): "Focal-point lighting installations create dramatic impact while keeping table centerpieces cost-effective."',
    menu: 'Pip (Creative): "Signature drinks and seasonal tasting plates give guests an unforgettable culinary memory."',
    activities: 'Pip (Creative): "Interactive stations like guest audio-messages or polaroid walls encourage effortless mingling."',
    tips: 'Pip (Creative): "Repurposing ceremony floral arches for reception tables is an easy, lavish budget-saver."',
  };

  const message = tips[tabId] || tips.themes;
  if (bubble) {
    setSpeechText(bubble.id, message);
  }
}

/**
 * Lumi: Celebration and stage triggers.
 */
export function triggerLumiReaction(text) {
  setSpeechText('lumi-hero-speech', text);
  const widgetText = document.getElementById('lumi-widget-text');
  if (widgetText) widgetText.textContent = text;
}

export function triggerSparkles() {
  if (!isMotionEnabled()) return;

  const container = document.getElementById('confetti-canvas-container');
  if (!container) return;

  const colors = ['#DDD3C9', '#ECC4C3', '#B97D7B', '#928E5E', '#575527'];
  for (let i = 0; i < 24; i++) {
    const sparkle = document.createElement('div');
    sparkle.className = 'confetti-particle';
    sparkle.style.left = `${Math.random() * 100}%`;
    sparkle.style.backgroundColor = colors[Math.floor(Math.random() * colors.length)];
    sparkle.style.animationDuration = `${1.2 + Math.random() * 1.5}s`;
    sparkle.style.width = `${6 + Math.random() * 8}px`;
    sparkle.style.height = `${6 + Math.random() * 8}px`;
    container.appendChild(sparkle);

    setTimeout(() => {
      sparkle.remove();
    }, 2500);
  }
}

/**
 * Setup character widget interactions and minimize button.
 */
export function setupCharacterWidgets() {
  initMotionPreference();

  const heroMascot = document.getElementById('lumi-hero-stage');
  const btnHeroSparkle = document.getElementById('btn-hero-sparkle');
  const btnHeroTip = document.getElementById('btn-hero-tip');
  const lumiWidgetBtn = document.getElementById('lumi-widget-btn');
  const lumiMinimizeBtn = document.getElementById('lumi-minimize-btn');
  const lumiBubbleClose = document.getElementById('lumi-bubble-close');
  const lumiWidget = document.getElementById('lumi-widget');

  const tips = [
    '“Deterministic budget formulas ensure your books always balance to 100%.”',
    '“Contingency buffer (8%) protects you from unexpected overtime or delivery fees!”',
    '“Adaptive milestone timelines compress automatically when planning under short notice.”',
    '“Export your schedule as an .ICS calendar file to sync directly to Google or Apple Calendar!”',
    '“All plans, vendor contacts, and quote comparisons save securely to your database account.”',
  ];
  let tipIndex = 0;

  function cycleTip() {
    tipIndex = (tipIndex + 1) % tips.length;
    triggerLumiReaction(tips[tipIndex]);
  }

  if (heroMascot) {
    heroMascot.addEventListener('click', () => {
      cycleTip();
      triggerSparkles();
    });
  }

  if (btnHeroSparkle) {
    btnHeroSparkle.addEventListener('click', triggerSparkles);
  }

  if (btnHeroTip) {
    btnHeroTip.addEventListener('click', cycleTip);
  }

  if (lumiWidgetBtn) {
    lumiWidgetBtn.addEventListener('click', () => {
      cycleTip();
      if (lumiWidget && lumiWidget.classList.contains('minimized')) {
        lumiWidget.classList.remove('minimized');
      }
    });
  }

  if (lumiMinimizeBtn && lumiWidget && !lumiMinimizeBtn.dataset.wired) {
    lumiMinimizeBtn.dataset.wired = 'true';
    lumiMinimizeBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      const isMinimized = lumiWidget.classList.toggle('minimized');
      lumiMinimizeBtn.innerHTML = isMinimized ? '&#43;' : '&minus;';
      lumiMinimizeBtn.setAttribute(
        'aria-label',
        isMinimized ? 'Restore celebration companion' : 'Minimize celebration companion'
      );
      localStorage.setItem('eventease-lumi-minimized', isMinimized ? 'true' : 'false');
    });

    if (localStorage.getItem('eventease-lumi-minimized') === 'true') {
      lumiWidget.classList.add('minimized');
      lumiMinimizeBtn.innerHTML = '&#43;';
      lumiMinimizeBtn.setAttribute('aria-label', 'Restore celebration companion');
    }
  }

  if (lumiBubbleClose && lumiWidget) {
    lumiBubbleClose.addEventListener('click', (e) => {
      e.stopPropagation();
      const bubble = document.getElementById('lumi-widget-bubble');
      if (bubble) bubble.style.display = 'none';
    });
  }
}
