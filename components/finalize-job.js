/**
 * Finalize Job component — summary of all stages + SUBMIT JOB.
 * Shows green ticks / warnings for each stage, final sign-off,
 * and a big submit button.
 */

import { getState } from '../js/store.js';
import { getChecklist, getEquipmentCheck, getPhotosForJob, getIncidentsForJob } from '../js/db.js';

/**
 * Render the finalize job screen.
 * @param {HTMLElement} container
 * @param {Object} job
 * @param {Object} shutdownData - { returned, missing, skipped }
 * @param {Function} onSubmit - called with full job summary after sign-off
 */
export async function renderFinalizeJob(container, job, shutdownData, onSubmit) {
  const state = getState();
  const staff = state.currentStaff;

  const equipCheck = await getEquipmentCheck(job.id);
  const checklist = await getChecklist(job.id);
  const photos = await getPhotosForJob(job.id);
  const incidents = await getIncidentsForJob(job.id);

  const hasMissing = shutdownData && !shutdownData.skipped && Object.keys(shutdownData.missing || {}).length > 0;
  const checklistComplete = checklist?.completedAt;
  const equipComplete = equipCheck?.completedAt;

  container.innerHTML = `
    <div class="finalize-job">
      <div class="finalize-job__header">
        <div class="checklist-header__job-id">${job.id}</div>
        <div class="checklist-header__client">${escHtml(job.client)}</div>
        <div class="checklist-header__project">${escHtml(job.project)}</div>
      </div>

      <div class="finalize-job__summary">
        <h3 class="finalize-job__summary-title">Job Summary</h3>

        <div class="finalize-stage ${equipComplete ? 'finalize-stage--ok' : 'finalize-stage--warn'}">
          <span class="finalize-stage__icon">${equipComplete ? '&#10003;' : '&#9888;'}</span>
          <div>
            <div class="finalize-stage__label">Equipment Check</div>
            <div class="finalize-stage__detail">
              ${equipComplete ? `Completed ${new Date(equipCheck.completedAt).toLocaleTimeString()}` : 'Not completed'}
            </div>
          </div>
        </div>

        <div class="finalize-stage ${checklistComplete ? 'finalize-stage--ok' : 'finalize-stage--warn'}">
          <span class="finalize-stage__icon">${checklistComplete ? '&#10003;' : '&#9888;'}</span>
          <div>
            <div class="finalize-stage__label">Site Checklist</div>
            <div class="finalize-stage__detail">
              ${checklistComplete
                ? `${Object.values(checklist.checkStates).filter(c => c.checked).length} items checked, ${photos.length} photos`
                : 'Not completed'}
            </div>
          </div>
        </div>

        <div class="finalize-stage ${shutdownData && !shutdownData.skipped ? (hasMissing ? 'finalize-stage--warn' : 'finalize-stage--ok') : 'finalize-stage--neutral'}">
          <span class="finalize-stage__icon">${!shutdownData ? '&#8987;' : hasMissing ? '&#9888;' : '&#10003;'}</span>
          <div>
            <div class="finalize-stage__label">Equipment Return</div>
            <div class="finalize-stage__detail">
              ${!shutdownData
                ? 'Pending'
                : shutdownData.skipped
                  ? 'Skipped (no equipment recorded)'
                  : hasMissing
                    ? `${Object.keys(shutdownData.missing).length} item(s) missing — will be reported`
                    : 'All equipment returned'}
            </div>
          </div>
        </div>

        ${incidents.length > 0 ? `
          <div class="finalize-stage finalize-stage--warn">
            <span class="finalize-stage__icon">&#9888;</span>
            <div>
              <div class="finalize-stage__label">Incidents Reported</div>
              <div class="finalize-stage__detail">${incidents.length} incident(s) logged during this job</div>
            </div>
          </div>
        ` : ''}
      </div>

      <div class="settings-card" style="margin-top: var(--sp-md);">
        <div class="settings-card__title">Final Sign-Off</div>
        <div class="signoff__field">
          <label class="signoff__label">Signed off by</label>
          <input type="text" class="signoff__input" id="final-signoff-name"
                 value="${escHtml(staff?.name || '')}" readonly>
        </div>
        <div class="signoff__field" style="margin-top: var(--sp-md);">
          <label class="signoff__label">Comment (optional)</label>
          <textarea class="signoff__input" id="final-comment" rows="3"
                    placeholder="Any final notes about this job..."></textarea>
        </div>
        <div class="signoff__canvas-container" style="margin-top: var(--sp-md);">
          <canvas id="final-sig-canvas" class="signoff__canvas" width="600" height="200"></canvas>
          <div class="signoff__canvas-actions">
            <button class="btn btn--ghost btn--small" id="final-sig-clear">Clear</button>
          </div>
        </div>
      </div>

      <div class="signoff__location" id="final-gps">
        <span>&#128205;</span>
        <span>Acquiring location...</span>
      </div>

      <button class="btn btn--primary finalize-job__submit" id="finalize-submit" disabled>
        SUBMIT JOB
      </button>

      <p style="font-size: var(--fs-xs); color: var(--color-text-muted); text-align: center; margin-top: var(--sp-sm);">
        This will sync all data to Google Sheets and close out the job.
      </p>
    </div>
  `;

  // Setup signature
  let hasSignature = false;
  const canvas = container.querySelector('#final-sig-canvas');
  setupCanvas(canvas, () => { hasSignature = true; updateBtn(); });
  container.querySelector('#final-sig-clear').addEventListener('click', () => {
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    hasSignature = false;
    updateBtn();
  });

  // GPS
  let gpsData = null;
  if (navigator.geolocation) {
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        gpsData = { lat: pos.coords.latitude, lng: pos.coords.longitude, accuracy: pos.coords.accuracy };
        container.querySelector('#final-gps').innerHTML = `<span>&#128205;</span><span>${gpsData.lat.toFixed(6)}, ${gpsData.lng.toFixed(6)}</span>`;
      },
      () => {
        container.querySelector('#final-gps').innerHTML = `<span>&#128205;</span><span>Location unavailable</span>`;
      },
      { enableHighAccuracy: true, timeout: 15000 }
    );
  }

  function updateBtn() {
    container.querySelector('#finalize-submit').disabled = !hasSignature;
  }

  // Submit
  container.querySelector('#finalize-submit').addEventListener('click', () => {
    const comment = container.querySelector('#final-comment').value.trim();
    const signoff = {
      name: staff?.name || 'Unknown',
      comment,
      signature: canvas.toDataURL('image/png'),
      timestamp: new Date().toISOString(),
      gps: gpsData,
    };

    // Show success
    container.innerHTML = `
      <div class="signoff__success" style="margin-top: var(--sp-2xl);">
        <div class="signoff__success-icon">&#9989;</div>
        <div class="signoff__success-text">Job Submitted</div>
        <p style="color: var(--color-text-muted); margin-top: var(--sp-sm);">
          ${escHtml(job.id)} — ${escHtml(staff?.name || '')}<br>
          ${new Date().toLocaleString()}
        </p>
      </div>
    `;

    setTimeout(() => {
      onSubmit({
        signoff,
        shutdownData,
        equipCheck,
        checklist,
        photos,
        incidents,
      });
    }, 2000);
  });
}

function setupCanvas(canvas, onDraw) {
  const ctx = canvas.getContext('2d');
  let drawing = false;

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

  function getPos(e) {
    const touch = e.touches ? e.touches[0] : e;
    const r = canvas.getBoundingClientRect();
    return { x: touch.clientX - r.left, y: touch.clientY - r.top };
  }

  function start(e) { e.preventDefault(); drawing = true; const p = getPos(e); ctx.beginPath(); ctx.moveTo(p.x, p.y); }
  function move(e) { if (!drawing) return; e.preventDefault(); const p = getPos(e); ctx.lineTo(p.x, p.y); ctx.stroke(); onDraw(); }
  function end() { drawing = false; }

  canvas.addEventListener('mousedown', start);
  canvas.addEventListener('mousemove', move);
  canvas.addEventListener('mouseup', end);
  canvas.addEventListener('mouseleave', end);
  canvas.addEventListener('touchstart', start, { passive: false });
  canvas.addEventListener('touchmove', move, { passive: false });
  canvas.addEventListener('touchend', end);
}

function escHtml(str) {
  const d = document.createElement('div');
  d.textContent = str || '';
  return d.innerHTML;
}
