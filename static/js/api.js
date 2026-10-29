/**
 * API client module for EventEase.
 * Handles HTTP requests, CSRF token management, and structured error responses.
 */

let activeCsrfToken = null;

export function setCsrfToken(token) {
  activeCsrfToken = token;
}

export function getCsrfToken() {
  if (activeCsrfToken) return activeCsrfToken;

  // Attempt to read from eventease_csrf cookie
  const match = document.cookie.match(/(?:^|;\s*)eventease_csrf=([^;]+)/);
  if (match) {
    activeCsrfToken = decodeURIComponent(match[1]);
  }
  return activeCsrfToken;
}

/**
 * Execute a JSON API request with credentials and CSRF protection.
 * @param {string} url
 * @param {RequestInit} [options]
 * @returns {Promise<any>}
 */
export async function apiRequest(url, options = {}) {
  const method = (options.method || 'GET').toUpperCase();
  const headers = new Headers(options.headers || {});

  if (!headers.has('Accept')) {
    headers.set('Accept', 'application/json');
  }

  // Auto-set Content-Type for requests with JSON body
  if (options.body && typeof options.body === 'string' && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }

  // Attach CSRF token on state-changing methods
  if (['POST', 'PUT', 'DELETE', 'PATCH'].includes(method)) {
    const csrf = getCsrfToken();
    if (csrf && !headers.has('X-CSRF-Token')) {
      headers.set('X-CSRF-Token', csrf);
    }
  }

  const fetchOptions = {
    ...options,
    method,
    headers,
    credentials: options.credentials || 'same-origin',
  };

  try {
    const response = await fetch(url, fetchOptions);

    // Parse JSON or text
    let data;
    const contentType =
      response.headers && typeof response.headers.get === 'function'
        ? response.headers.get('content-type') || ''
        : 'application/json';
    if (contentType.includes('application/json')) {
      data = await response.json();
    } else {
      data = await response.text();
    }

    if (!response.ok) {
      let errorMessage = 'An error occurred while processing your request.';
      if (typeof data === 'object' && data !== null) {
        if (data.detail) {
          if (Array.isArray(data.detail)) {
            errorMessage = data.detail.map((err) => `${err.loc?.join('.') || 'field'}: ${err.msg}`).join(', ');
          } else {
            errorMessage = String(data.detail);
          }
        } else if (data.error) {
          errorMessage = String(data.error);
        }
      }

      const error = new Error(errorMessage);
      error.status = response.status;
      error.data = data;
      throw error;
    }

    return data;
  } catch (err) {
    if (err.name === 'TypeError' && err.message.includes('fetch')) {
      const netErr = new Error('Network error. Please check your internet connection or server status.');
      netErr.status = 0;
      throw netErr;
    }
    throw err;
  }
}
