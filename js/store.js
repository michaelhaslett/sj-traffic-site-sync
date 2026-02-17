/**
 * Reactive state store for the SJ Traffic Checklist app.
 * v2: Added staff login, stages, equipment, weather, photos, incidents.
 */

import { getSetting, setSetting } from './db.js';

const listeners = new Map();
let state = {
  // Auth
  currentStaff: null,          // { id, name, role, email }

  // Jobs
  jobs: [],                    // from mock-jobs.json / Traffio
  activeJobId: null,           // currently selected job

  // Stages
  activeStage: null,           // 'equipment' | 'checklist' | 'shutdown' | 'finalize'

  // Equipment check (Stage 1)
  equipmentManifest: {},       // { itemId: { label, taken: 0 } }

  // Checklist (Stage 2)
  checklist: [],               // built checklist items for active job
  checkStates: {},             // { itemId: { checked, note, timestamp } }
  progress: { done: 0, total: 0 },
  weatherConditions: null,     // { visibility, weather }
  photos: [],                  // [{ id, jobId, label, dataUrl, timestamp }]
  hseqNotes: '',

  // Incidents
  incidents: [],

  // App
  route: '#/login',
  online: navigator.onLine,
  syncQueue: [],
  settings: {
    googleScriptUrl: '',
    sheetId: '',
    hseqEmail: '',
    lostEquipmentEmail: '',
  }
};

/** Get a shallow copy of the full state or a single key. */
export function getState(key) {
  return key !== undefined ? state[key] : { ...state };
}

/** Merge new values into state and notify listeners. */
export function setState(patch) {
  const changed = [];
  for (const [key, val] of Object.entries(patch)) {
    if (state[key] !== val) {
      state[key] = val;
      changed.push(key);
    }
  }
  for (const key of changed) {
    if (listeners.has(key)) {
      for (const fn of listeners.get(key)) {
        try { fn(state[key], state); } catch(e) { console.error('Store listener error:', e); }
      }
    }
  }
  if (changed.length && listeners.has('*')) {
    for (const fn of listeners.get('*')) {
      try { fn(state); } catch(e) { console.error('Store listener error:', e); }
    }
  }
}

/** Subscribe to changes on a specific state key (or '*' for any). Returns unsubscribe fn. */
export function subscribe(key, fn) {
  if (!listeners.has(key)) listeners.set(key, new Set());
  listeners.get(key).add(fn);
  return () => listeners.get(key).delete(fn);
}

/** Initialise state from persisted settings. */
export async function initStore() {
  const staffJson = await getSetting('currentStaff');
  const googleScriptUrl = await getSetting('googleScriptUrl') || '';
  const sheetId = await getSetting('sheetId') || '';
  const hseqEmail = await getSetting('hseqEmail') || '';
  const lostEquipmentEmail = await getSetting('lostEquipmentEmail') || '';

  setState({
    currentStaff: staffJson ? JSON.parse(staffJson) : null,
    settings: { googleScriptUrl, sheetId, hseqEmail, lostEquipmentEmail },
  });

  window.addEventListener('online', () => setState({ online: true }));
  window.addEventListener('offline', () => setState({ online: false }));
}

/** Persist the current staff member. */
export async function setCurrentStaff(staff) {
  await setSetting('currentStaff', JSON.stringify(staff));
  setState({ currentStaff: staff });
}

/** Clear current staff (logout). */
export async function clearCurrentStaff() {
  await setSetting('currentStaff', null);
  setState({ currentStaff: null });
}

/** Persist a settings value. */
export async function saveSetting(key, value) {
  await setSetting(key, value);
  const s = { ...state.settings, [key]: value };
  setState({ settings: s });
}
