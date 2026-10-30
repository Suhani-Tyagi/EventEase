/**
 * Authentication management module for EventEase.
 * Controls signup, signin, recovery, reset, and modal UI states.
 */

import { apiRequest, setCsrfToken } from './api.js';

let currentUser = null;
let authChangeListeners = [];

export function onAuthStateChanged(callback) {
  authChangeListeners.push(callback);
}

function notifyAuthChange(user) {
  currentUser = user;
  authChangeListeners.forEach((fn) => {
    try {
      fn(user);
    } catch (e) {
      console.error('Error in auth listener:', e);
    }
  });
}

export function getCurrentUser() {
  return currentUser;
}

export async function checkAuthStatus() {
  try {
    const data = await apiRequest('/api/auth/me');
    if (data && data.authenticated && data.user) {
      if (data.csrf_token) {
        setCsrfToken(data.csrf_token);
      }
      notifyAuthChange(data.user);
      return data.user;
    } else {
      notifyAuthChange(null);
      return null;
    }
  } catch (err) {
    console.warn('Failed to verify session status:', err);
    notifyAuthChange(null);
    return null;
  }
}

export async function signup(email, password) {
  const data = await apiRequest('/api/auth/signup', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  });
  if (data.csrf_token) {
    setCsrfToken(data.csrf_token);
  }
  notifyAuthChange(data.user);
  return data.user;
}

export async function signin(email, password) {
  const data = await apiRequest('/api/auth/signin', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  });
  if (data.csrf_token) {
    setCsrfToken(data.csrf_token);
  }
  notifyAuthChange(data.user);
  return data.user;
}

export async function signout() {
  try {
    await apiRequest('/api/auth/signout', { method: 'POST' });
  } finally {
    setCsrfToken(null);
    notifyAuthChange(null);
  }
}

export async function requestRecovery(email) {
  return await apiRequest('/api/auth/recover', {
    method: 'POST',
    body: JSON.stringify({ email }),
  });
}

export async function resetPassword(token, newPassword) {
  return await apiRequest('/api/auth/reset-password', {
    method: 'POST',
    body: JSON.stringify({ token, new_password: newPassword }),
  });
}

// Modal management
let authModal = null;
let lastFocusedElement = null;

export function openAuthModal(tab = 'signin') {
  authModal = document.getElementById('auth-modal');
  if (!authModal) return;

  lastFocusedElement = document.activeElement;
  switchAuthTab(tab);

  if (typeof authModal.showModal === 'function') {
    authModal.showModal();
  } else {
    authModal.setAttribute('open', 'true');
  }

  // Focus the first input of the active tab
  setTimeout(() => {
    const activePanel = authModal.querySelector('.auth-tab-panel:not(.hidden)');
    if (activePanel) {
      const firstInput = activePanel.querySelector('input');
      if (firstInput) firstInput.focus();
    }
  }, 50);
}

export function closeAuthModal() {
  authModal = document.getElementById('auth-modal');
  if (!authModal) return;

  if (typeof authModal.close === 'function') {
    authModal.close();
  } else {
    authModal.removeAttribute('open');
  }

  if (lastFocusedElement && typeof lastFocusedElement.focus === 'function') {
    lastFocusedElement.focus();
  }
}

export function switchAuthTab(tabId) {
  const modal = document.getElementById('auth-modal');
  if (!modal) return;

  const tabs = modal.querySelectorAll('.auth-nav-tab');
  const panels = modal.querySelectorAll('.auth-tab-panel');

  tabs.forEach((tab) => {
    const isTarget = tab.dataset.tab === tabId;
    tab.classList.toggle('active', isTarget);
    tab.setAttribute('aria-selected', isTarget ? 'true' : 'false');
  });

  panels.forEach((panel) => {
    const isTarget = panel.id === `auth-panel-${tabId}`;
    panel.classList.toggle('hidden', !isTarget);
  });
}

/**
 * Initialize event listeners for auth UI buttons and forms.
 */
export function setupAuthUI() {
  const modal = document.getElementById('auth-modal');
  const btnClose = document.getElementById('btn-close-auth-modal');
  const btnHeaderSignin = document.getElementById('btn-header-signin');
  const btnHeaderSignup = document.getElementById('btn-header-signup');
  const btnLandingSignin = document.getElementById('btn-landing-signin');
  const btnLandingSignup = document.getElementById('btn-landing-signup');
  const btnHeaderSignout = document.getElementById('btn-header-signout');

  if (btnHeaderSignin) {
    btnHeaderSignin.addEventListener('click', () => openAuthModal('signin'));
  }
  if (btnHeaderSignup) {
    btnHeaderSignup.addEventListener('click', () => openAuthModal('signup'));
  }
  if (btnLandingSignin) {
    btnLandingSignin.addEventListener('click', () => openAuthModal('signin'));
  }
  if (btnLandingSignup) {
    btnLandingSignup.addEventListener('click', () => openAuthModal('signup'));
  }
  const btnWorkspaceSignout = document.getElementById('btn-workspace-signout');

  const handleSignout = async () => {
    try {
      await signout();
      const liveRegion = document.getElementById('live-region');
      if (liveRegion) liveRegion.textContent = 'You have logged out successfully.';
    } catch (err) {
      console.error('Logout failed:', err);
    }
  };

  if (btnHeaderSignout) {
    btnHeaderSignout.addEventListener('click', handleSignout);
  }
  if (btnWorkspaceSignout) {
    btnWorkspaceSignout.addEventListener('click', handleSignout);
  }
  if (btnClose) {
    btnClose.addEventListener('click', closeAuthModal);
  }

  // Handle Tab Switch Buttons in Modal
  if (modal) {
    modal.querySelectorAll('.auth-nav-tab').forEach((tab) => {
      tab.addEventListener('click', () => {
        switchAuthTab(tab.dataset.tab);
      });
    });

    // Signin Form Submit
    const formSignin = document.getElementById('form-auth-signin');
    const signinAlert = document.getElementById('signin-alert');
    if (formSignin) {
      formSignin.addEventListener('submit', async (e) => {
        e.preventDefault();
        const email = document.getElementById('signin-email').value.trim();
        const password = document.getElementById('signin-password').value;
        if (signinAlert) signinAlert.classList.add('hidden');

        try {
          await signin(email, password);
          closeAuthModal();
          const liveRegion = document.getElementById('live-region');
          if (liveRegion) liveRegion.textContent = `Signed in as ${email}. Your celebration workspace is ready!`;
        } catch (err) {
          if (signinAlert) {
            signinAlert.textContent = err.message || 'Invalid email or password.';
            signinAlert.classList.remove('hidden');
          }
        }
      });
    }

    // Signup Form Submit
    const formSignup = document.getElementById('form-auth-signup');
    const signupAlert = document.getElementById('signup-alert');
    if (formSignup) {
      formSignup.addEventListener('submit', async (e) => {
        e.preventDefault();
        const email = document.getElementById('signup-email').value.trim();
        const password = document.getElementById('signup-password').value;
        if (signupAlert) signupAlert.classList.add('hidden');

        if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
          if (signupAlert) {
            signupAlert.textContent = 'Enter a valid email address to create your account.';
            signupAlert.classList.remove('hidden');
          }
          document.getElementById('signup-email').focus();
          return;
        }
        if (password.length < 8) {
          if (signupAlert) {
            signupAlert.textContent = 'Choose a password with at least 8 characters.';
            signupAlert.classList.remove('hidden');
          }
          document.getElementById('signup-password').focus();
          return;
        }

        const submitButton = document.getElementById('btn-submit-signup');
        if (submitButton) {
          submitButton.disabled = true;
          submitButton.dataset.originalLabel = submitButton.textContent;
          submitButton.textContent = 'Creating your account…';
        }

        try {
          await signup(email, password);
          closeAuthModal();
          const liveRegion = document.getElementById('live-region');
          if (liveRegion) liveRegion.textContent = `Account created! Welcome, ${email}.`;
        } catch (err) {
          if (signupAlert) {
            signupAlert.textContent = err.message || 'Unable to create account.';
            signupAlert.classList.remove('hidden');
          }
        } finally {
          if (submitButton) {
            submitButton.disabled = false;
            submitButton.textContent = submitButton.dataset.originalLabel || 'Create Account & Start Planning';
          }
        }
      });
    }

    // Password Recovery Form Submit
    const formRecovery = document.getElementById('form-auth-recovery');
    const recoveryAlert = document.getElementById('recovery-alert');
    if (formRecovery) {
      formRecovery.addEventListener('submit', async (e) => {
        e.preventDefault();
        const email = document.getElementById('recovery-email').value.trim();
        if (recoveryAlert) recoveryAlert.classList.add('hidden');

        try {
          const res = await requestRecovery(email);
          if (recoveryAlert) {
            recoveryAlert.className = 'alert-box alert-success';
            recoveryAlert.textContent = res.message;
            if (res.reset_token) {
              const tokenHint = document.createElement('div');
              tokenHint.className = 'reset-token-hint';
              tokenHint.textContent = `Dev/Test Token: ${res.reset_token}`;
              recoveryAlert.appendChild(tokenHint);
              // Auto fill reset token
              const resetInput = document.getElementById('reset-token-input');
              if (resetInput) resetInput.value = res.reset_token;
            }
            recoveryAlert.classList.remove('hidden');
          }
        } catch (err) {
          if (recoveryAlert) {
            recoveryAlert.className = 'alert-box alert-danger';
            recoveryAlert.textContent = err.message || 'Unable to request password recovery.';
            recoveryAlert.classList.remove('hidden');
          }
        }
      });
    }

    // Reset Password Form Submit
    const formReset = document.getElementById('form-auth-reset');
    const resetAlert = document.getElementById('reset-alert');
    if (formReset) {
      formReset.addEventListener('submit', async (e) => {
        e.preventDefault();
        const token = document.getElementById('reset-token-input').value.trim();
        const newPassword = document.getElementById('reset-new-password').value;
        if (resetAlert) resetAlert.classList.add('hidden');

        try {
          const res = await resetPassword(token, newPassword);
          if (resetAlert) {
            resetAlert.className = 'alert-box alert-success';
            resetAlert.textContent = res.message;
            resetAlert.classList.remove('hidden');
          }
          setTimeout(() => switchAuthTab('signin'), 1500);
        } catch (err) {
          if (resetAlert) {
            resetAlert.className = 'alert-box alert-danger';
            resetAlert.textContent = err.message || 'Password reset failed.';
            resetAlert.classList.remove('hidden');
          }
        }
      });
    }
  }

  // Update Navigation UI on Auth State Change
  onAuthStateChanged((user) => {
    const unauthView = document.getElementById('auth-unauth-view');
    const userView = document.getElementById('auth-user-view');
    const navUserEmail = document.getElementById('nav-user-email');

    document.body.classList.toggle('is-authenticated', Boolean(user));

    const btnWsSignout = document.getElementById('btn-workspace-signout');
    if (user) {
      if (unauthView) unauthView.classList.add('hidden');
      if (userView) userView.classList.remove('hidden');
      if (navUserEmail) navUserEmail.textContent = user.email;
      if (btnWsSignout) btnWsSignout.classList.remove('hidden');
    } else {
      if (unauthView) unauthView.classList.remove('hidden');
      if (userView) userView.classList.add('hidden');
      if (btnWsSignout) btnWsSignout.classList.add('hidden');
    }
  });
}
