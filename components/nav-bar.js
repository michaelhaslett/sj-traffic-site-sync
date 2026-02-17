/**
 * Top navigation bar component v2.
 * Shows logo, app title, staff name, and online/offline status.
 */

import { getState } from '../js/store.js';

export function renderNavBar() {
  const state = getState();
  const online = state.online;
  const staff = state.currentStaff;

  return `
    <header class="nav-bar">
      <img src="/assets/logo-small.png" alt="SJ Traffic" class="nav-bar__logo">
      <span class="nav-bar__title">Site Checklist</span>
      <div class="nav-bar__status">
        ${staff ? `<span class="nav-bar__user">${escHtml(staff.name)}</span>` : ''}
        <span class="nav-bar__dot ${online ? '' : 'nav-bar__dot--offline'}"></span>
        <span>${online ? 'Online' : 'Offline'}</span>
      </div>
    </header>
  `;
}

function escHtml(str) {
  const d = document.createElement('div');
  d.textContent = str;
  return d.innerHTML;
}
