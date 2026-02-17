/**
 * Incident / Near-Miss quick-tap form.
 * Auto-tags GPS, timestamp, user, and job.
 * Queues for sync (always queue, send when online).
 */

import { getState } from '../js/store.js';
import { saveIncident } from '../js/db.js';
import { showToast } from '../js/toast.js';

const CATEGORIES = [
  { id: 'incident', label: 'Incident', icon: '&#9888;', color: 'var(--color-danger)' },
  { id: 'near_miss', label: 'Near Miss', icon: '&#9889;', color: 'var(--color-warning)' },
  { id: 'hazard', label: 'Hazard', icon: '&#128679;', color: 'var(--sj-orange)' },
];

/**
 * Render the incident form into a container.
 * @param {HTMLElement} container
 * @param {Function} onSubmit - called after successful submission
 */
export function renderIncidentForm(container, onSubmit) {
  const state = getState();
  const staff = state.currentStaff;
  const jobId = state.activeJobId;

  container.innerHTML = `
    <div class="incident-form">
      <div class="incident-form__header">
        <span class="incident-form__icon">&#9888;</span>
        <h2 class="incident-form__title">Report Incident</h2>
      </div>

      <div class="incident-form__categories" id="incident-categories">
        ${CATEGORIES.map(c => `
          <button class="incident-cat-btn" data-cat="${c.id}" style="--cat-color: ${c.color};">
            <span class="incident-cat-btn__icon">${c.icon}</span>
            <span>${c.label}</span>
          </button>
        `).join('')}
      </div>

      <div class="signoff__field" style="margin-top: var(--sp-md);">
        <label class="signoff__label">Description</label>
        <textarea class="signoff__input" id="incident-desc" rows="4"
                  placeholder="Briefly describe what happened..."></textarea>
      </div>

      <div class="signoff__field" style="margin-top: var(--sp-md);">
        <label class="signoff__label">Photo (optional)</label>
        <label class="photo-grid__add" style="display:inline-flex; width:auto; padding: var(--sp-md);">
          <span class="photo-grid__add-icon">&#128247;</span>
          <span>Add Photo</span>
          <input type="file" accept="image/*" capture="environment" id="incident-photo-input" style="display:none;">
        </label>
        <div id="incident-photo-preview" style="margin-top: var(--sp-sm);"></div>
      </div>

      <div class="signoff__location" id="incident-gps">
        <span>&#128205;</span>
        <span>Acquiring location...</span>
      </div>

      <button class="btn btn--danger" id="incident-submit" disabled style="width:100%; margin-top: var(--sp-md);">
        Submit Report
      </button>

      <p style="font-size: var(--fs-xs); color: var(--color-text-muted); text-align: center; margin-top: var(--sp-sm);">
        Reports are queued and sent to HSEQ when connected.
      </p>
    </div>
  `;

  let selectedCat = null;
  let photoDataUrl = null;
  let gpsData = null;

  // Category selection
  container.querySelectorAll('.incident-cat-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      container.querySelectorAll('.incident-cat-btn').forEach(b => b.classList.remove('incident-cat-btn--selected'));
      btn.classList.add('incident-cat-btn--selected');
      selectedCat = btn.dataset.cat;
      updateSubmitState();
    });
  });

  // Description
  container.querySelector('#incident-desc').addEventListener('input', updateSubmitState);

  // Photo
  container.querySelector('#incident-photo-input').addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    photoDataUrl = await readFileAsDataUrl(file);
    container.querySelector('#incident-photo-preview').innerHTML = `
      <img src="${photoDataUrl}" style="max-width:200px; border-radius: var(--r-md);">
    `;
  });

  // GPS
  if (navigator.geolocation) {
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        gpsData = { lat: pos.coords.latitude, lng: pos.coords.longitude, accuracy: pos.coords.accuracy };
        const gpsEl = container.querySelector('#incident-gps');
        gpsEl.innerHTML = `<span>&#128205;</span><span>${gpsData.lat.toFixed(6)}, ${gpsData.lng.toFixed(6)}</span>`;
      },
      () => {
        container.querySelector('#incident-gps').innerHTML = `<span>&#128205;</span><span>Location unavailable</span>`;
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  }

  // Submit
  function updateSubmitState() {
    const desc = container.querySelector('#incident-desc').value.trim();
    container.querySelector('#incident-submit').disabled = !(selectedCat && desc.length >= 3);
  }

  container.querySelector('#incident-submit').addEventListener('click', async () => {
    const desc = container.querySelector('#incident-desc').value.trim();

    const incident = {
      jobId: jobId || 'unknown',
      category: selectedCat,
      description: desc,
      photo: photoDataUrl || null,
      reportedBy: staff ? { id: staff.id, name: staff.name } : { name: 'Unknown' },
      timestamp: new Date().toISOString(),
      gps: gpsData,
    };

    await saveIncident(incident);
    showToast('Incident report saved', 'success');
    onSubmit(incident);
  });
}

function readFileAsDataUrl(file) {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = (e) => resolve(e.target.result);
    reader.readAsDataURL(file);
  });
}
