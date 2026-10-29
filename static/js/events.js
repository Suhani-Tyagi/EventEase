/**
 * Database-backed event workspace and persistence module.
 * Replaces client-side local storage as the source of truth for accounts and celebration plans.
 */

import { apiRequest } from './api.js';

let cachedEvents = [];
let activeDatabaseEventId = null;

export function getActiveDatabaseEventId() {
  return activeDatabaseEventId;
}

export function setActiveDatabaseEventId(id) {
  activeDatabaseEventId = id;
}

export async function fetchUserEvents() {
  try {
    const data = await apiRequest('/api/events');
    cachedEvents = Array.isArray(data) ? data : [];
    return cachedEvents;
  } catch (err) {
    console.error('Failed to load user events:', err);
    throw err;
  }
}

export async function fetchEventDetail(eventId) {
  return await apiRequest(`/api/events/${eventId}`);
}

export async function createDatabaseEvent(name, intake, planData) {
  const event = await apiRequest('/api/events', {
    method: 'POST',
    body: JSON.stringify({ name, intake, plan_data: planData }),
  });
  activeDatabaseEventId = event.id;
  await fetchUserEvents();
  return event;
}

export async function updateDatabaseEvent(eventId, name, intake, planData) {
  const event = await apiRequest(`/api/events/${eventId}`, {
    method: 'PUT',
    body: JSON.stringify({ name, intake, plan_data: planData }),
  });
  await fetchUserEvents();
  return event;
}

export async function duplicateDatabaseEvent(eventId) {
  const duplicate = await apiRequest(`/api/events/${eventId}/duplicate`, {
    method: 'POST',
  });
  await fetchUserEvents();
  return duplicate;
}

export async function deleteDatabaseEvent(eventId) {
  await apiRequest(`/api/events/${eventId}`, {
    method: 'DELETE',
  });
  if (activeDatabaseEventId === eventId) {
    activeDatabaseEventId = null;
  }
  await fetchUserEvents();
}

/**
 * Render the persistent database workspace containing user's saved events.
 */
export function renderSavedEventsWorkspace(events, { onOpen, onDuplicate, onDelete, onCreateNew }) {
  const container = document.getElementById('saved-events-grid');
  const countBadge = document.getElementById('workspace-count-badge');
  const navCount = document.getElementById('nav-events-count');
  const emptyMsg = document.getElementById('empty-workspace-msg');

  if (countBadge) {
    countBadge.textContent = `${events.length} ${events.length === 1 ? 'Event' : 'Events'}`;
  }
  if (navCount) {
    navCount.textContent = String(events.length);
  }

  if (!container) return;
  container.innerHTML = '';

  if (!events || events.length === 0) {
    if (emptyMsg) emptyMsg.classList.remove('hidden');
    return;
  }

  if (emptyMsg) emptyMsg.classList.add('hidden');

  events.forEach((ev) => {
    const card = document.createElement('div');
    card.className = 'saved-event-card';
    card.dataset.eventId = ev.id;

    // Format currency
    const formattedBudget = new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: ev.currency || 'USD',
      maximumFractionDigits: 0,
    }).format(ev.total_budget);

    // Format updated date
    const updatedDate = new Date(ev.updated_at).toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });

    card.innerHTML = `
      <div class="saved-event-card-header">
        <h3 class="saved-event-title">${escapeHtml(ev.name)}</h3>
        <span class="badge badge-accent">${escapeHtml(ev.event_type.toUpperCase())}</span>
      </div>
      <div class="saved-event-meta-grid">
        <div class="meta-item">
          <span class="meta-label">Date:</span>
          <span class="meta-val">${escapeHtml(ev.date)}</span>
        </div>
        <div class="meta-item">
          <span class="meta-label">Location:</span>
          <span class="meta-val">${escapeHtml(ev.city || 'TBD')}</span>
        </div>
        <div class="meta-item">
          <span class="meta-label">Headcount:</span>
          <span class="meta-val">${ev.guest_count} guests</span>
        </div>
        <div class="meta-item">
          <span class="meta-label">Budget:</span>
          <span class="meta-val">${formattedBudget}</span>
        </div>
      </div>
      <div class="saved-event-footer">
        <span class="event-timestamp">Updated: ${updatedDate}</span>
        <div class="saved-event-actions">
          <button type="button" class="btn btn-sm btn-primary btn-open-event" data-id="${ev.id}">
            Reopen
          </button>
          <button type="button" class="btn btn-sm btn-secondary btn-dup-event" data-id="${ev.id}" title="Duplicate event">
            Duplicate
          </button>
          <button type="button" class="btn btn-sm btn-danger btn-del-event" data-id="${ev.id}" title="Delete event">
            Delete
          </button>
        </div>
      </div>
    `;

    // Event listeners
    const btnOpen = card.querySelector('.btn-open-event');
    const btnDup = card.querySelector('.btn-dup-event');
    const btnDel = card.querySelector('.btn-del-event');

    if (btnOpen && onOpen) {
      btnOpen.addEventListener('click', () => onOpen(ev.id));
    }
    if (btnDup && onDuplicate) {
      btnDup.addEventListener('click', () => onDuplicate(ev.id));
    }
    if (btnDel && onDelete) {
      btnDel.addEventListener('click', () => onDelete(ev.id, ev.name));
    }

    container.appendChild(card);
  });
}

function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
