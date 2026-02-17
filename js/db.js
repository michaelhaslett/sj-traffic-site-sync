/**
 * IndexedDB wrapper for offline persistence.
 * v2: Added equipment_checks, incidents, photos stores.
 */

const DB_NAME = 'sj_traffic_checklist';
const DB_VERSION = 2;

let dbInstance = null;

function openDB() {
  if (dbInstance) return Promise.resolve(dbInstance);

  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (e) => {
      const db = e.target.result;
      // v1 stores
      if (!db.objectStoreNames.contains('checklists')) {
        db.createObjectStore('checklists', { keyPath: 'jobId' });
      }
      if (!db.objectStoreNames.contains('pending_syncs')) {
        db.createObjectStore('pending_syncs', { keyPath: 'id', autoIncrement: true });
      }
      if (!db.objectStoreNames.contains('settings')) {
        db.createObjectStore('settings', { keyPath: 'key' });
      }
      // v2 stores
      if (!db.objectStoreNames.contains('equipment_checks')) {
        db.createObjectStore('equipment_checks', { keyPath: 'jobId' });
      }
      if (!db.objectStoreNames.contains('incidents')) {
        const incStore = db.createObjectStore('incidents', { keyPath: 'id', autoIncrement: true });
        incStore.createIndex('jobId', 'jobId', { unique: false });
      }
      if (!db.objectStoreNames.contains('photos')) {
        const photoStore = db.createObjectStore('photos', { keyPath: 'id', autoIncrement: true });
        photoStore.createIndex('jobId', 'jobId', { unique: false });
      }
    };

    request.onsuccess = (e) => {
      dbInstance = e.target.result;
      resolve(dbInstance);
    };

    request.onerror = (e) => reject(e.target.error);
  });
}

async function tx(storeName, mode = 'readonly') {
  const db = await openDB();
  return db.transaction(storeName, mode).objectStore(storeName);
}

function promisify(request) {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

// ── Checklists ───────────────────────────────────────────

export async function saveChecklist(data) {
  const store = await tx('checklists', 'readwrite');
  return promisify(store.put(data));
}

export async function getChecklist(jobId) {
  const store = await tx('checklists', 'readonly');
  return promisify(store.get(jobId));
}

export async function getAllChecklists() {
  const store = await tx('checklists', 'readonly');
  return promisify(store.getAll());
}

export async function deleteChecklist(jobId) {
  const store = await tx('checklists', 'readwrite');
  return promisify(store.delete(jobId));
}

// ── Sync Queue ───────────────────────────────────────────

export async function addToSyncQueue(data) {
  const store = await tx('pending_syncs', 'readwrite');
  return promisify(store.add(data));
}

export async function getPendingSyncs() {
  const store = await tx('pending_syncs', 'readonly');
  return promisify(store.getAll());
}

export async function removeSyncItem(id) {
  const store = await tx('pending_syncs', 'readwrite');
  return promisify(store.delete(id));
}

// ── Settings ─────────────────────────────────────────────

export async function setSetting(key, value) {
  const store = await tx('settings', 'readwrite');
  return promisify(store.put({ key, value }));
}

export async function getSetting(key) {
  const store = await tx('settings', 'readonly');
  const result = await promisify(store.get(key));
  return result ? result.value : null;
}

export async function getAllSettings() {
  const store = await tx('settings', 'readonly');
  const all = await promisify(store.getAll());
  const obj = {};
  for (const item of all) obj[item.key] = item.value;
  return obj;
}

// ── Equipment Checks ─────────────────────────────────────

export async function saveEquipmentCheck(data) {
  const store = await tx('equipment_checks', 'readwrite');
  return promisify(store.put(data));
}

export async function getEquipmentCheck(jobId) {
  const store = await tx('equipment_checks', 'readonly');
  return promisify(store.get(jobId));
}

// ── Incidents ────────────────────────────────────────────

export async function saveIncident(data) {
  const store = await tx('incidents', 'readwrite');
  return promisify(store.add(data));
}

export async function getAllIncidents() {
  const store = await tx('incidents', 'readonly');
  return promisify(store.getAll());
}

export async function getIncidentsForJob(jobId) {
  const store = await tx('incidents', 'readonly');
  const index = store.index('jobId');
  return promisify(index.getAll(jobId));
}

// ── Photos ───────────────────────────────────────────────

export async function savePhoto(data) {
  const store = await tx('photos', 'readwrite');
  return promisify(store.add(data));
}

export async function getPhotosForJob(jobId) {
  const store = await tx('photos', 'readonly');
  const index = store.index('jobId');
  return promisify(index.getAll(jobId));
}

export async function deletePhoto(id) {
  const store = await tx('photos', 'readwrite');
  return promisify(store.delete(id));
}
