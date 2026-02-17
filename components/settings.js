/**
 * Settings component v2 — Google Sheets config, email settings, staff identity, app info.
 */

import { getState, saveSetting, clearCurrentStaff } from '../js/store.js';
import { showToast } from '../js/toast.js';

/**
 * Render settings into a container element.
 * @param {HTMLElement} container
 */
export function renderSettings(container) {
  const state = getState();
  const { settings, currentStaff } = state;

  container.innerHTML = `
    <div class="settings-card">
      <div class="settings-card__title">Logged In As</div>
      <div style="display:flex; align-items:center; gap: var(--sp-md); margin-bottom: var(--sp-md);">
        <div class="staff-item__avatar" style="width:48px; height:48px; font-size: var(--fs-xl);">
          ${currentStaff?.name ? currentStaff.name.charAt(0) : '?'}
        </div>
        <div>
          <div style="font-weight:700; font-size: var(--fs-lg);">${escHtml(currentStaff?.name || 'Not logged in')}</div>
          <div style="font-size: var(--fs-sm); color: var(--color-text-muted);">${escHtml(currentStaff?.role || '')}</div>
        </div>
      </div>
      <button class="btn btn--secondary btn--small" id="settings-logout">Sign Out</button>
    </div>

    <div class="settings-card">
      <div class="settings-card__title">Google Sheets Sync</div>
      <p style="font-size: var(--fs-sm); color: var(--color-text-muted); margin-bottom: var(--sp-md);">
        Enter the Google Apps Script Web App URL to enable live sync.
      </p>
      <div class="signoff__field">
        <label class="signoff__label">Apps Script URL</label>
        <input type="url" class="signoff__input" id="settings-script-url"
               value="${escHtml(settings.googleScriptUrl || '')}"
               placeholder="https://script.google.com/macros/s/.../exec">
      </div>
      <button class="btn btn--secondary btn--small" id="save-sync" style="margin-top: var(--sp-md);">Save</button>
    </div>

    <div class="settings-card">
      <div class="settings-card__title">Email Notifications</div>
      <p style="font-size: var(--fs-sm); color: var(--color-text-muted); margin-bottom: var(--sp-md);">
        Configure email addresses for incident reports and lost equipment notifications.
      </p>
      <div class="signoff__field">
        <label class="signoff__label">HSEQ / Incident Email</label>
        <input type="email" class="signoff__input" id="settings-hseq-email"
               value="${escHtml(settings.hseqEmail || '')}"
               placeholder="hseq@sjtraffic.com.au">
      </div>
      <div class="signoff__field" style="margin-top: var(--sp-md);">
        <label class="signoff__label">Lost Equipment Email</label>
        <input type="email" class="signoff__input" id="settings-equipment-email"
               value="${escHtml(settings.lostEquipmentEmail || '')}"
               placeholder="ops@sjtraffic.com.au">
      </div>
      <button class="btn btn--secondary btn--small" id="save-emails" style="margin-top: var(--sp-md);">Save Emails</button>
    </div>

    <div class="settings-card">
      <div class="settings-card__title">About</div>
      <p style="font-size: var(--fs-sm); color: var(--color-text-muted);">
        SJ Traffic Site Checklist v2.0.0<br>
        Built for SJ Traffic Pty Ltd<br>
        Offline-first PWA
      </p>
      <button class="btn btn--ghost btn--small" id="clear-data" style="margin-top: var(--sp-md); color: var(--color-danger);">
        Clear All Data
      </button>
    </div>
  `;

  // Sign out
  container.querySelector('#settings-logout').addEventListener('click', async () => {
    await clearCurrentStaff();
    showToast('Signed out', 'info');
    window.location.hash = '#/login';
  });

  // Save sync settings
  container.querySelector('#save-sync').addEventListener('click', async () => {
    const url = container.querySelector('#settings-script-url').value.trim();
    await saveSetting('googleScriptUrl', url);
    showToast('Sync settings saved', 'success');
  });

  // Save email settings
  container.querySelector('#save-emails').addEventListener('click', async () => {
    const hseqEmail = container.querySelector('#settings-hseq-email').value.trim();
    const equipEmail = container.querySelector('#settings-equipment-email').value.trim();
    await saveSetting('hseqEmail', hseqEmail);
    await saveSetting('lostEquipmentEmail', equipEmail);
    showToast('Email settings saved', 'success');
  });

  // Clear data
  container.querySelector('#clear-data').addEventListener('click', async () => {
    if (confirm('This will delete all saved checklists and settings. Are you sure?')) {
      const dbs = await window.indexedDB.databases();
      for (const db of dbs) {
        window.indexedDB.deleteDatabase(db.name);
      }
      localStorage.clear();
      sessionStorage.clear();
      showToast('All data cleared. Reloading...', 'info');
      setTimeout(() => location.reload(), 1500);
    }
  });
}

function escHtml(str) {
  const d = document.createElement('div');
  d.textContent = str || '';
  return d.innerHTML;
}
