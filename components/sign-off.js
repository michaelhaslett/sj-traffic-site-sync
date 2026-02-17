/**
 * Sign-off component v2 — captures staff name, signature, GPS, timestamp, and optional comment.
 * Uses currentStaff from store instead of free-text name.
 */

import { getState } from '../js/store.js';

/**
 * Render the sign-off form into a container element.
 * @param {HTMLElement} container - DOM element to render into
 * @param {Object} saved - Saved checklist data
 * @param {Function} onComplete - Callback with sign-off data
 */
export function renderSignOff(container, saved, onComplete) {
  const state = getState();
  const staff = state.currentStaff;
  const userName = staff?.name || '';

  container.innerHTML = `
    <div class="signoff">
      <div class="checklist-header">
        <div class="checklist-header__job-id">${saved.job.id}</div>
        <div class="checklist-header__client">${escHtml(saved.job.client)}</div>
        <div class="checklist-header__project">${escHtml(saved.job.project)}</div>
      </div>

      <div class="settings-card">
        <div class="settings-card__title">Sign-Off Details</div>

        <div class="signoff__field">
          <label class="signoff__label">Signed off by</label>
          <input type="text" class="signoff__input" id="signoff-name" value="${escHtml(userName)}" readonly>
        </div>

        <div class="signoff__field" style="margin-top: var(--sp-md);">
          <label class="signoff__label">Comment (optional)</label>
          <textarea class="signoff__input" id="signoff-comment" rows="3" placeholder="Any notes about this sign-off..."></textarea>
        </div>
      </div>

      <div class="settings-card">
        <div class="settings-card__title">Signature</div>
        <div class="signoff__canvas-container">
          <canvas id="sig-canvas" class="signoff__canvas" width="600" height="200"></canvas>
          <div class="signoff__canvas-actions">
            <button class="btn btn--ghost btn--small" id="sig-clear">Clear</button>
          </div>
        </div>
      </div>

      <div class="signoff__location" id="gps-status">
        <span>&#128205;</span>
        <span>Acquiring location...</span>
      </div>

      <button class="btn btn--primary" id="signoff-submit" disabled>
        Complete Sign-Off
      </button>

      <p style="font-size: var(--fs-xs); color: var(--color-text-muted); text-align: center; margin-top: var(--sp-sm);">
        By signing off you confirm all checklist items have been physically verified on site.
      </p>
    </div>
  `;

  setupSignature(container);
  acquireGPS(container);
  setupSubmitHandler(container, saved, onComplete);
}

// ── Signature Canvas ────────────────────────────────────

function setupSignature(container) {
  const canvas = container.querySelector('#sig-canvas');
  const ctx = canvas.getContext('2d');
  let drawing = false;
  let hasSignature = false;

  // High-DPI support
  const rect = canvas.getBoundingClientRect();
  const dpr = window.devicePixelRatio || 1;
  canvas.width = rect.width * dpr;
  canvas.height = rect.height * dpr;
  ctx.scale(dpr, dpr);
  canvas.style.width = rect.width + 'px';
  canvas.style.height = rect.height + 'px';

  ctx.strokeStyle = '#000';
  ctx.lineWidth = 2;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  function getPos(e) {
    const touch = e.touches ? e.touches[0] : e;
    const r = canvas.getBoundingClientRect();
    return { x: touch.clientX - r.left, y: touch.clientY - r.top };
  }

  function start(e) {
    e.preventDefault();
    drawing = true;
    const pos = getPos(e);
    ctx.beginPath();
    ctx.moveTo(pos.x, pos.y);
  }

  function move(e) {
    if (!drawing) return;
    e.preventDefault();
    const pos = getPos(e);
    ctx.lineTo(pos.x, pos.y);
    ctx.stroke();
    hasSignature = true;
    updateSubmitState(container);
  }

  function end() {
    drawing = false;
  }

  canvas.addEventListener('mousedown', start);
  canvas.addEventListener('mousemove', move);
  canvas.addEventListener('mouseup', end);
  canvas.addEventListener('mouseleave', end);
  canvas.addEventListener('touchstart', start, { passive: false });
  canvas.addEventListener('touchmove', move, { passive: false });
  canvas.addEventListener('touchend', end);

  container.querySelector('#sig-clear').addEventListener('click', () => {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    hasSignature = false;
    updateSubmitState(container);
  });

  // Expose hasSignature check
  canvas._hasSignature = () => hasSignature;
  canvas._toDataURL = () => canvas.toDataURL('image/png');
}

// ── GPS ─────────────────────────────────────────────────

function acquireGPS(container) {
  const statusEl = container.querySelector('#gps-status');

  if (!navigator.geolocation) {
    statusEl.innerHTML = '<span>&#128205;</span><span>GPS not available on this device</span>';
    statusEl._gps = null;
    updateSubmitState(container);
    return;
  }

  navigator.geolocation.getCurrentPosition(
    (pos) => {
      const lat = pos.coords.latitude.toFixed(6);
      const lng = pos.coords.longitude.toFixed(6);
      const acc = Math.round(pos.coords.accuracy);
      statusEl.innerHTML = `<span>&#128205;</span><span>${lat}, ${lng} (${acc}m accuracy)</span>`;
      statusEl._gps = { lat: pos.coords.latitude, lng: pos.coords.longitude, accuracy: pos.coords.accuracy };
      updateSubmitState(container);
    },
    (err) => {
      console.warn('GPS error:', err);
      statusEl.innerHTML = `<span>&#128205;</span><span>Location unavailable (${err.message})</span>`;
      statusEl._gps = null;
      updateSubmitState(container);
    },
    { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
  );
}

// ── Submit ──────────────────────────────────────────────

function updateSubmitState(container) {
  const btn = container.querySelector('#signoff-submit');
  const canvas = container.querySelector('#sig-canvas');
  const hasSig = canvas._hasSignature ? canvas._hasSignature() : false;

  // Name is always set from staff login, just need signature
  btn.disabled = !hasSig;
}

function setupSubmitHandler(container, saved, onComplete) {
  container.querySelector('#signoff-submit').addEventListener('click', () => {
    const name = container.querySelector('#signoff-name').value.trim();
    const comment = container.querySelector('#signoff-comment').value.trim();
    const canvas = container.querySelector('#sig-canvas');
    const gpsEl = container.querySelector('#gps-status');

    const signoffData = {
      name,
      comment,
      signature: canvas._toDataURL ? canvas._toDataURL() : null,
      timestamp: new Date().toISOString(),
      gps: gpsEl._gps || null,
    };

    // Show success state
    container.innerHTML = `
      <div class="signoff__success">
        <div class="signoff__success-icon">&#10004;</div>
        <div class="signoff__success-text">Checklist Signed Off</div>
        <p style="color: var(--color-text-muted); margin-top: var(--sp-sm);">
          ${escHtml(name)} &middot; ${new Date().toLocaleString()}
        </p>
      </div>
    `;

    // Callback after animation
    setTimeout(() => onComplete(signoffData), 1500);
  });
}

function escHtml(str) {
  const d = document.createElement('div');
  d.textContent = str || '';
  return d.innerHTML;
}
