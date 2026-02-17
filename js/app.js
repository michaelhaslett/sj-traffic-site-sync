/**
 * SJ Traffic Site Checklist v2 — App Bootstrap & Router
 * Three-stage flow: Equipment Check → Site Checklist → Site Shutdown → Finalize
 * Plus incident reporting from any stage.
 */

import { initStore, getState, setState, setCurrentStaff, clearCurrentStaff } from './store.js';
import { loadData, buildChecklist, groupByCategory, resolveCharacteristics } from './checklist-engine.js';
import { saveChecklist, getChecklist, getAllChecklists, getEquipmentCheck, getPhotosForJob, getIncidentsForJob } from './db.js';
import { syncChecklist, refreshSyncQueue, retryPendingSyncs, syncIncident, syncEquipmentLoss } from './sync.js';
import { renderNavBar } from '../components/nav-bar.js';
import { renderJobList } from '../components/job-list.js';
import { renderChecklistView } from '../components/checklist-view.js';
import { renderSignOff } from '../components/sign-off.js';
import { renderSyncStatus } from '../components/sync-status.js';
import { renderSettings } from '../components/settings.js';
import { renderLogin } from '../components/login.js';
import { renderStepIndicator, computeStageStatus } from '../components/step-indicator.js';
import { renderEquipmentCheck } from '../components/equipment-check.js';
import { renderWeatherInput, getWeatherValues } from '../components/weather-input.js';
import { renderPhotoCapture, getPhotoCount } from '../components/photo-capture.js';
import { renderHseqNotes, getHseqNotesValue } from '../components/hseq-notes.js';
import { renderShutdownView } from '../components/shutdown-view.js';
import { renderFinalizeJob } from '../components/finalize-job.js';
import { renderIncidentForm } from '../components/incident-form.js';

import { showToast } from './toast.js';
export { showToast };

const app = document.getElementById('app');

// ── Router ──────────────────────────────────────────────

const routes = {
  '#/login':      renderLoginScreen,
  '#/jobs':       renderJobsScreen,
  '#/equipment':  renderEquipmentScreen,
  '#/checklist':  renderChecklistScreen,
  '#/signoff':    renderSignOffScreen,
  '#/shutdown':   renderShutdownScreen,
  '#/finalize':   renderFinalizeScreen,
  '#/incident':   renderIncidentScreen,
  '#/sync':       renderSyncScreen,
  '#/settings':   renderSettingsScreen,
};

function getRouteInfo() {
  const hash = window.location.hash || '#/login';
  const parts = hash.split('/');
  const base = '#/' + (parts[1] || 'login');
  const param = parts[2] || null;
  return { base, param, full: hash };
}

function navigate(hash) {
  window.location.hash = hash;
}

async function handleRoute() {
  const { base, param } = getRouteInfo();
  const state = getState();

  // Guard: must login first
  if (!state.currentStaff && base !== '#/login') {
    navigate('#/login');
    return;
  }

  // If staff is logged in but on login screen, redirect to jobs
  if (state.currentStaff && base === '#/login') {
    navigate('#/jobs');
    return;
  }

  setState({ route: base, activeJobId: param || state.activeJobId });

  const renderFn = routes[base];
  if (renderFn) {
    await renderFn(param);
  } else {
    navigate('#/jobs');
  }
}

// ── Screen Renderers ────────────────────────────────────

async function renderLoginScreen() {
  app.innerHTML = '<div id="login-root"></div>';
  await renderLogin(document.getElementById('login-root'), (staff) => {
    navigate('#/jobs');
  });
}

async function renderJobsScreen() {
  const { jobs } = await loadJobData();
  const checklists = await getAllChecklists();
  const checklistMap = new Map(checklists.map(c => [c.jobId, c]));

  app.innerHTML = `
    ${renderNavBar()}
    <main class="main">
      <div class="section-header">
        <div>
          <div class="section-header__title">Today's Jobs</div>
          <div class="section-header__subtitle">${jobs.length} job${jobs.length !== 1 ? 's' : ''} assigned</div>
        </div>
      </div>
      <div class="job-list" id="job-list"></div>
    </main>
    ${renderBottomNav('jobs')}
  `;

  const listEl = document.getElementById('job-list');
  listEl.innerHTML = await renderJobList(jobs, checklistMap);

  listEl.querySelectorAll('.job-card').forEach(card => {
    card.addEventListener('click', () => {
      const jobId = card.dataset.jobId;
      navigate(`#/equipment/${jobId}`);
    });
  });

  attachBottomNavHandlers();
}

async function renderEquipmentScreen(jobId) {
  if (!jobId) { navigate('#/jobs'); return; }

  const { jobs } = await loadJobData();
  const job = jobs.find(j => j.id === jobId);
  if (!job) { showToast('Job not found', 'error'); navigate('#/jobs'); return; }

  // Check if already completed — skip to checklist
  const existingCheck = await getEquipmentCheck(jobId);
  if (existingCheck?.completedAt) {
    navigate(`#/checklist/${jobId}`);
    return;
  }

  const stageStatus = await getStageStatus(jobId);

  app.innerHTML = `
    ${renderNavBar()}
    <main class="main">
      <button class="back-btn" id="back-btn">&larr; Back to Jobs</button>
      ${renderStepIndicator('equipment', stageStatus)}
      <div id="equipment-root"></div>
    </main>
    ${renderIncidentFAB()}
  `;

  document.getElementById('back-btn').addEventListener('click', () => navigate('#/jobs'));
  attachIncidentFABHandler();

  await renderEquipmentCheck(document.getElementById('equipment-root'), job, (manifest) => {
    showToast('Equipment check complete', 'success');
    navigate(`#/checklist/${jobId}`);
  });
}

async function renderChecklistScreen(jobId) {
  if (!jobId) { navigate('#/jobs'); return; }

  app.innerHTML = `
    ${renderNavBar()}
    <main class="main">
      <div class="loading"><div class="spinner"></div></div>
    </main>
  `;

  const { jobs } = await loadJobData();
  const job = jobs.find(j => j.id === jobId);
  if (!job) { showToast('Job not found', 'error'); navigate('#/jobs'); return; }

  // Build or load checklist
  let saved = await getChecklist(jobId);
  if (!saved) {
    const items = await buildChecklist(job.characteristics, job.client);
    const checkStates = {};
    items.forEach(it => { checkStates[it.id] = { checked: false, note: '', timestamp: null }; });
    saved = { jobId, job, items, checkStates, startedAt: new Date().toISOString() };
    await saveChecklist(saved);
  }

  const chars = await resolveCharacteristics(job.characteristics);
  const stageStatus = await getStageStatus(jobId);

  setState({
    activeJobId: jobId,
    activeStage: 'checklist',
    checklist: saved.items,
    checkStates: saved.checkStates,
    progress: calcProgress(saved.checkStates),
  });

  app.innerHTML = `
    ${renderNavBar()}
    <main class="main">
      <button class="back-btn" id="back-btn">&larr; Back to Jobs</button>
      ${renderStepIndicator('checklist', stageStatus)}

      <div id="weather-root">${renderWeatherInput(saved.weatherConditions || null)}</div>

      ${renderChecklistView(job, chars, saved.items, saved.checkStates)}

      <div id="photos-root" style="margin-top: var(--sp-md);"></div>

      <div id="hseq-root" style="margin-top: var(--sp-md);">${renderHseqNotes(saved.hseqNotes || '')}</div>
    </main>
    ${renderSignOffFAB(saved.checkStates)}
    ${renderIncidentFAB()}
  `;

  document.getElementById('back-btn').addEventListener('click', () => navigate('#/jobs'));
  attachChecklistHandlers(jobId, saved);
  attachIncidentFABHandler();

  // Sign-off FAB handler — saves weather & HSEQ before navigating
  const signoffFab = document.getElementById('signoff-fab');
  if (signoffFab) {
    signoffFab.addEventListener('click', async () => {
      // Save weather + HSEQ values from DOM before navigating away
      const weather = getWeatherValues();
      const hseqNotes = getHseqNotesValue();
      if (weather.visibility || weather.weather) saved.weatherConditions = weather;
      if (hseqNotes) saved.hseqNotes = hseqNotes;
      await saveChecklist(saved);

      navigate(`#/signoff/${jobId}`);
    });
  }

  // Render photo capture
  await renderPhotoCapture(document.getElementById('photos-root'), jobId, (count) => {
    // Photo count updated
  });
}

async function renderSignOffScreen(jobId) {
  if (!jobId) jobId = getState('activeJobId');
  if (!jobId) { navigate('#/jobs'); return; }

  const saved = await getChecklist(jobId);
  if (!saved) { navigate('#/jobs'); return; }

  const prog = calcProgress(saved.checkStates);
  if (prog.done < prog.total) {
    showToast(`Complete all items first (${prog.done}/${prog.total})`, 'error');
    navigate(`#/checklist/${jobId}`);
    return;
  }

  // Check minimum 3 photos
  const photoCount = await getPhotoCount(jobId);
  if (photoCount < 3) {
    showToast(`Need at least 3 photos (have ${photoCount})`, 'error');
    navigate(`#/checklist/${jobId}`);
    return;
  }

  // Weather + HSEQ are already saved to IndexedDB by the signoff FAB handler
  // (saved before navigating away from the checklist screen)

  const stageStatus = await getStageStatus(jobId);

  app.innerHTML = `
    ${renderNavBar()}
    <main class="main">
      <button class="back-btn" id="back-btn">&larr; Back to Checklist</button>
      ${renderStepIndicator('checklist', stageStatus)}
      <div id="signoff-root"></div>
    </main>
  `;

  document.getElementById('back-btn').addEventListener('click', () => navigate(`#/checklist/${jobId}`));
  renderSignOff(document.getElementById('signoff-root'), saved, async (signoffData) => {
    saved.signOff = signoffData;
    saved.completedAt = new Date().toISOString();
    await saveChecklist(saved);

    showToast('Checklist signed off!', 'success');
    navigate(`#/shutdown/${jobId}`);
  });
}

async function renderShutdownScreen(jobId) {
  if (!jobId) { navigate('#/jobs'); return; }

  const { jobs } = await loadJobData();
  const job = jobs.find(j => j.id === jobId);
  if (!job) { navigate('#/jobs'); return; }

  const stageStatus = await getStageStatus(jobId);

  app.innerHTML = `
    ${renderNavBar()}
    <main class="main">
      <button class="back-btn" id="back-btn">&larr; Back to Jobs</button>
      ${renderStepIndicator('shutdown', stageStatus)}
      <div id="shutdown-root"></div>
    </main>
    ${renderIncidentFAB()}
  `;

  document.getElementById('back-btn').addEventListener('click', () => navigate('#/jobs'));
  attachIncidentFABHandler();

  await renderShutdownView(document.getElementById('shutdown-root'), job, (shutdownData) => {
    // Store shutdown data in sessionStorage for finalize screen
    sessionStorage.setItem(`shutdown_${jobId}`, JSON.stringify(shutdownData));
    showToast('Equipment return confirmed', 'success');
    navigate(`#/finalize/${jobId}`);
  });
}

async function renderFinalizeScreen(jobId) {
  if (!jobId) { navigate('#/jobs'); return; }

  const { jobs } = await loadJobData();
  const job = jobs.find(j => j.id === jobId);
  if (!job) { navigate('#/jobs'); return; }

  // Retrieve shutdown data
  const shutdownJson = sessionStorage.getItem(`shutdown_${jobId}`);
  const shutdownData = shutdownJson ? JSON.parse(shutdownJson) : null;

  const stageStatus = await getStageStatus(jobId);

  app.innerHTML = `
    ${renderNavBar()}
    <main class="main">
      <button class="back-btn" id="back-btn">&larr; Back to Jobs</button>
      ${renderStepIndicator('finalize', stageStatus)}
      <div id="finalize-root"></div>
    </main>
  `;

  document.getElementById('back-btn').addEventListener('click', () => navigate('#/jobs'));

  await renderFinalizeJob(document.getElementById('finalize-root'), job, shutdownData, async (fullPayload) => {
    // Build and sync full job data
    const payload = await buildFullSyncPayload(jobId, fullPayload);
    await syncChecklist(payload);

    // Sync equipment loss if any
    if (shutdownData && !shutdownData.skipped && Object.keys(shutdownData.missing || {}).length > 0) {
      await syncEquipmentLoss({
        jobId: job.id,
        client: job.client,
        project: job.project,
        missing: shutdownData.missing,
        reportedBy: getState().currentStaff?.name || 'Unknown',
        timestamp: new Date().toISOString(),
      });
    }

    // Sync any incidents
    const incidents = await getIncidentsForJob(jobId);
    for (const inc of incidents) {
      await syncIncident(inc);
    }

    // Clean up
    sessionStorage.removeItem(`shutdown_${jobId}`);
    showToast('Job submitted successfully!', 'success');

    setTimeout(() => navigate('#/jobs'), 3000);
  });
}

async function renderIncidentScreen() {
  const state = getState();

  app.innerHTML = `
    ${renderNavBar()}
    <main class="main">
      <button class="back-btn" id="back-btn">&larr; Back</button>
      <div id="incident-root"></div>
    </main>
  `;

  document.getElementById('back-btn').addEventListener('click', () => {
    const jobId = state.activeJobId;
    if (jobId) {
      window.history.back();
    } else {
      navigate('#/jobs');
    }
  });

  renderIncidentForm(document.getElementById('incident-root'), (incident) => {
    showToast('Incident report saved', 'success');
    // Sync immediately if possible
    syncIncident(incident).catch(() => {});
    setTimeout(() => window.history.back(), 1500);
  });
}

async function renderSyncScreen() {
  await refreshSyncQueue();
  app.innerHTML = `
    ${renderNavBar()}
    <main class="main">
      <div class="section-header">
        <div class="section-header__title">Sync Status</div>
      </div>
      <div id="sync-root"></div>
    </main>
    ${renderBottomNav('sync')}
  `;
  renderSyncStatus(document.getElementById('sync-root'));
  attachBottomNavHandlers();
}

async function renderSettingsScreen() {
  app.innerHTML = `
    ${renderNavBar()}
    <main class="main">
      <div class="section-header">
        <div class="section-header__title">Settings</div>
      </div>
      <div id="settings-root"></div>
    </main>
    ${renderBottomNav('settings')}
  `;
  renderSettings(document.getElementById('settings-root'));
  attachBottomNavHandlers();
}

// ── Checklist Interaction Handlers ──────────────────────

function attachChecklistHandlers(jobId, saved) {
  // Checkbox toggling
  app.querySelectorAll('.checklist-item__checkbox').forEach(cb => {
    cb.addEventListener('click', async () => {
      const itemId = cb.dataset.itemId;
      const cs = saved.checkStates[itemId];
      cs.checked = !cs.checked;
      cs.timestamp = cs.checked ? new Date().toISOString() : null;
      await saveChecklist(saved);

      const row = cb.closest('.checklist-item');
      row.classList.toggle('checklist-item--checked', cs.checked);
      cb.innerHTML = cs.checked ? '&#10003;' : '';

      const prog = calcProgress(saved.checkStates);
      setState({ checkStates: { ...saved.checkStates }, progress: prog });
      updateProgressUI(prog);
      updateSignOffFAB(prog);
      updateCategoryCounts(saved);
    });
  });

  // Note buttons
  app.querySelectorAll('.checklist-item__action-btn[data-action="note"]').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const itemId = btn.dataset.itemId;
      openNoteModal(itemId, saved);
    });
  });
}

function openNoteModal(itemId, saved) {
  const cs = saved.checkStates[itemId];
  const item = saved.items.find(i => i.id === itemId);

  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.innerHTML = `
    <div class="modal">
      <div class="modal__title">Note: ${item?.label || itemId}</div>
      <textarea id="note-input" placeholder="Add a note...">${cs.note || ''}</textarea>
      <div class="modal__actions">
        <button class="btn btn--ghost" id="note-cancel">Cancel</button>
        <button class="btn btn--primary" style="width:auto;" id="note-save">Save</button>
      </div>
    </div>
  `;
  document.body.appendChild(overlay);

  overlay.querySelector('#note-cancel').addEventListener('click', () => overlay.remove());
  overlay.querySelector('#note-save').addEventListener('click', async () => {
    cs.note = document.getElementById('note-input').value.trim();
    await saveChecklist(saved);
    overlay.remove();
    const noteBtn = app.querySelector(`.checklist-item__action-btn[data-item-id="${itemId}"][data-action="note"]`);
    if (noteBtn) {
      noteBtn.classList.toggle('checklist-item__action-btn--has-note', !!cs.note);
    }
    showToast('Note saved', 'info');
  });

  overlay.addEventListener('click', (e) => { if (e.target === overlay) overlay.remove(); });
  setTimeout(() => document.getElementById('note-input')?.focus(), 200);
}

// ── Progress Helpers ────────────────────────────────────

function calcProgress(checkStates) {
  const items = Object.values(checkStates);
  return { done: items.filter(c => c.checked).length, total: items.length };
}

function updateProgressUI(prog) {
  const pct = prog.total > 0 ? Math.round((prog.done / prog.total) * 100) : 0;
  const bar = app.querySelector('.progress-bar__fill');
  const text = app.querySelector('.progress-text');
  if (bar) bar.style.width = pct + '%';
  if (text) text.textContent = `${prog.done} of ${prog.total} items complete (${pct}%)`;
}

function updateSignOffFAB(prog) {
  const fab = document.getElementById('signoff-fab');
  if (!fab) return;
  const allDone = prog.done === prog.total && prog.total > 0;
  fab.disabled = !allDone;
  fab.textContent = allDone ? 'Sign Off Checklist' : `${prog.done}/${prog.total} Complete`;
}

function updateCategoryCounts(saved) {
  app.querySelectorAll('.category-section').forEach(sec => {
    const cat = sec.dataset.category;
    const items = saved.items.filter(i => i.category === cat);
    const done = items.filter(i => saved.checkStates[i.id]?.checked).length;
    const countEl = sec.querySelector('.category-header__count');
    if (countEl) {
      countEl.textContent = `${done}/${items.length}`;
      countEl.classList.toggle('category-header__count--complete', done === items.length);
    }
  });
}

function renderSignOffFAB(checkStates) {
  const prog = calcProgress(checkStates);
  const allDone = prog.done === prog.total && prog.total > 0;
  return `
    <div class="fab fab--signoff">
      <button class="fab__btn" id="signoff-fab" ${allDone ? '' : 'disabled'}>
        ${allDone ? 'Sign Off Checklist' : `${prog.done}/${prog.total} Complete`}
      </button>
    </div>
  `;
}

// ── Incident FAB ────────────────────────────────────────

function renderIncidentFAB() {
  return `
    <button class="incident-fab" id="incident-fab" title="Report Incident">
      <span class="incident-fab__icon">&#9888;</span>
    </button>
  `;
}

function attachIncidentFABHandler() {
  const fab = document.getElementById('incident-fab');
  if (fab) {
    fab.addEventListener('click', () => navigate('#/incident'));
  }
}

// ── Stage Status Helper ─────────────────────────────────

async function getStageStatus(jobId) {
  const equipCheck = await getEquipmentCheck(jobId);
  const checklist = await getChecklist(jobId);
  const shutdownJson = sessionStorage.getItem(`shutdown_${jobId}`);

  return computeStageStatus({
    equipmentDone: !!equipCheck?.completedAt,
    checklistDone: !!checklist?.completedAt,
    shutdownDone: !!shutdownJson,
    finalizeDone: false,
  }, getState('activeStage') || 'equipment');
}

// ── Bottom Nav ──────────────────────────────────────────

function renderBottomNav(active = 'jobs') {
  const items = [
    { id: 'jobs', icon: '&#128203;', label: 'Jobs', hash: '#/jobs' },
    { id: 'sync', icon: '&#9741;', label: 'Sync', hash: '#/sync' },
    { id: 'settings', icon: '&#9881;', label: 'Settings', hash: '#/settings' },
  ];
  return `
    <nav class="bottom-nav">
      ${items.map(it => `
        <button class="bottom-nav__item ${active === it.id ? 'bottom-nav__item--active' : ''}"
                data-nav="${it.hash}">
          <span class="bottom-nav__icon">${it.icon}</span>
          <span>${it.label}</span>
        </button>
      `).join('')}
    </nav>
  `;
}

function attachBottomNavHandlers() {
  app.querySelectorAll('.bottom-nav__item').forEach(btn => {
    btn.addEventListener('click', () => navigate(btn.dataset.nav));
  });
}

// ── Data Loading ────────────────────────────────────────

async function loadJobData() {
  const state = getState();
  if (state.jobs.length > 0) return { jobs: state.jobs };

  const res = await fetch('/data/mock-jobs.json');
  const data = await res.json();
  setState({ jobs: data.jobs });
  return { jobs: data.jobs };
}

// ── Sync Payload Builders ───────────────────────────────

async function buildFullSyncPayload(jobId, finalizePayload) {
  const saved = await getChecklist(jobId);
  const { jobs } = await loadJobData();
  const job = jobs.find(j => j.id === jobId);

  const { signoff, shutdownData, equipCheck, checklist, photos, incidents } = finalizePayload;

  return {
    type: 'full_job',
    jobId: job?.id || jobId,
    client: job?.client || '',
    project: job?.project || '',
    location: job?.location || '',
    date: job?.date || '',
    characteristics: job?.characteristics || [],
    // Equipment check
    equipment: equipCheck ? {
      quantities: equipCheck.quantities,
      startedAt: equipCheck.startedAt,
      completedAt: equipCheck.completedAt,
    } : null,
    // Checklist
    totalItems: saved?.items?.length || 0,
    checkedItems: saved ? Object.values(saved.checkStates).filter(c => c.checked).length : 0,
    items: saved ? saved.items.map(it => ({
      id: it.id,
      label: it.label,
      category: it.category,
      checked: saved.checkStates[it.id]?.checked || false,
      note: saved.checkStates[it.id]?.note || '',
      timestamp: saved.checkStates[it.id]?.timestamp || null,
    })) : [],
    weather: saved?.weatherConditions || null,
    hseqNotes: saved?.hseqNotes || '',
    photos: photos ? photos.map(p => ({ label: p.label, timestamp: p.timestamp })) : [],
    // Sign-off from checklist stage
    checklistSignOff: saved?.signOff ? {
      name: saved.signOff.name,
      timestamp: saved.signOff.timestamp,
      gps: saved.signOff.gps,
      comment: saved.signOff.comment || '',
    } : null,
    // Shutdown
    shutdown: shutdownData ? {
      returned: shutdownData.returned,
      missing: shutdownData.missing,
      skipped: shutdownData.skipped,
    } : null,
    // Final sign-off
    finalSignOff: signoff ? {
      name: signoff.name,
      timestamp: signoff.timestamp,
      gps: signoff.gps,
      comment: signoff.comment || '',
    } : null,
    // Incidents
    incidentCount: incidents?.length || 0,
    startedAt: saved?.startedAt || '',
    completedAt: new Date().toISOString(),
    appVersion: '2.0.0',
  };
}

// ── Service Worker Registration ─────────────────────────

async function registerSW() {
  if ('serviceWorker' in navigator) {
    try {
      await navigator.serviceWorker.register('/sw.js');
    } catch (e) {
      console.warn('SW registration failed:', e);
    }
  }
}

// ── Bootstrap ───────────────────────────────────────────

async function boot() {
  try {
    await initStore();
    await loadData();
    await refreshSyncQueue();
    await registerSW();

    window.addEventListener('hashchange', handleRoute);
    handleRoute();
  } catch (err) {
    console.error('Boot failed:', err);
    app.innerHTML = `
      <div class="empty-state">
        <div class="empty-state__icon">&#9888;</div>
        <div class="empty-state__title">Failed to load app</div>
        <p>${err.message}</p>
        <button class="btn btn--primary" style="margin-top:16px;width:auto;" onclick="location.reload()">
          Retry
        </button>
      </div>
    `;
  }
}

boot();
