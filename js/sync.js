/**
 * Google Sheets sync module v2.
 * Posts completed checklist data, incidents, and equipment loss
 * to a Google Apps Script Web App.
 * Handles offline queueing and retry.
 */

import { addToSyncQueue, getPendingSyncs, removeSyncItem } from './db.js';
import { getState, setState } from './store.js';
import { showToast } from './toast.js';

/**
 * Sync a completed checklist / full job to Google Sheets.
 * If offline or the request fails, it queues for later retry.
 */
export async function syncChecklist(payload) {
  return sendPayload({ ...payload, syncType: 'checklist' });
}

/**
 * Sync an incident report to Google Sheets + trigger email.
 */
export async function syncIncident(payload) {
  return sendPayload({ ...payload, syncType: 'incident' });
}

/**
 * Sync equipment loss data to Google Sheets + trigger email.
 */
export async function syncEquipmentLoss(payload) {
  return sendPayload({ ...payload, syncType: 'equipment_loss' });
}

/**
 * Core send function — posts to Apps Script or queues for later.
 */
async function sendPayload(payload) {
  const { settings } = getState();
  const url = settings.googleScriptUrl;

  if (!url) {
    await addToSyncQueue({ ...payload, queuedAt: new Date().toISOString() });
    await refreshSyncQueue();
    return { success: false, reason: 'no_url' };
  }

  if (!navigator.onLine) {
    await addToSyncQueue({ ...payload, queuedAt: new Date().toISOString() });
    await refreshSyncQueue();
    showToast('Saved offline. Will sync when connected.', 'info');
    return { success: false, reason: 'offline' };
  }

  try {
    await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      mode: 'no-cors',
    });
    showToast('Synced to Google Sheets', 'success');
    return { success: true };
  } catch (err) {
    console.error('Sync failed, queuing:', err);
    await addToSyncQueue({ ...payload, queuedAt: new Date().toISOString() });
    await refreshSyncQueue();
    showToast('Sync failed. Queued for retry.', 'error');
    return { success: false, reason: 'network_error' };
  }
}

/** Retry all pending sync items. */
export async function retryPendingSyncs() {
  const { settings } = getState();
  const url = settings.googleScriptUrl;
  if (!url || !navigator.onLine) return;

  const pending = await getPendingSyncs();
  let synced = 0;
  for (const item of pending) {
    try {
      await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(item),
        mode: 'no-cors',
      });
      await removeSyncItem(item.id);
      synced++;
    } catch {
      // leave it in queue
    }
  }
  await refreshSyncQueue();
  if (synced > 0) {
    showToast(`Synced ${synced} pending item${synced > 1 ? 's' : ''}`, 'success');
  }
}

/** Refresh the sync queue count in state. */
export async function refreshSyncQueue() {
  const pending = await getPendingSyncs();
  setState({ syncQueue: pending });
}

// Retry when coming back online
window.addEventListener('online', () => {
  setTimeout(() => retryPendingSyncs(), 2000);
});
