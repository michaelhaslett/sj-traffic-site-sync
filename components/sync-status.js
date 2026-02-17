/**
 * Sync status component — shows pending sync items and completed syncs.
 */

import { getState, subscribe } from '../js/store.js';
import { retryPendingSyncs } from '../js/sync.js';
import { getAllChecklists } from '../js/db.js';
import { showToast } from '../js/toast.js';

/**
 * Render the sync status panel into a container.
 * @param {HTMLElement} container
 */
export async function renderSyncStatus(container) {
  const { syncQueue } = getState();
  const checklists = await getAllChecklists();
  const completed = checklists.filter(c => c.completedAt);

  container.innerHTML = `
    <div style="margin-bottom: var(--sp-lg);">
      ${syncQueue.length > 0 ? `
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom: var(--sp-md);">
          <span style="font-weight:700; color: var(--sj-dark-green);">Pending (${syncQueue.length})</span>
          <button class="btn btn--secondary btn--small" id="retry-sync">Retry All</button>
        </div>
        <div class="sync-list">
          ${syncQueue.map(item => `
            <div class="sync-item">
              <div class="sync-item__info">
                <span class="sync-item__job">${item.jobId || 'Unknown'}</span>
                <span class="sync-item__date">${item.queuedAt ? new Date(item.queuedAt).toLocaleString() : ''}</span>
              </div>
              <span class="sync-badge sync-badge--pending">Pending</span>
            </div>
          `).join('')}
        </div>
      ` : `
        <div class="empty-state" style="padding: var(--sp-lg);">
          <div class="empty-state__icon">&#10003;</div>
          <div class="empty-state__title">All synced</div>
          <p>No pending items in the queue.</p>
        </div>
      `}
    </div>

    ${completed.length > 0 ? `
      <div>
        <span style="font-weight:700; color: var(--sj-dark-green); display:block; margin-bottom: var(--sp-md);">
          Completed Checklists (${completed.length})
        </span>
        <div class="sync-list">
          ${completed.map(c => `
            <div class="sync-item">
              <div class="sync-item__info">
                <span class="sync-item__job">${c.jobId}</span>
                <span class="sync-item__date">${c.completedAt ? new Date(c.completedAt).toLocaleString() : ''}</span>
              </div>
              <span class="sync-badge sync-badge--synced">Done</span>
            </div>
          `).join('')}
        </div>
      </div>
    ` : ''}
  `;

  const retryBtn = container.querySelector('#retry-sync');
  if (retryBtn) {
    retryBtn.addEventListener('click', async () => {
      retryBtn.disabled = true;
      retryBtn.textContent = 'Syncing...';
      await retryPendingSyncs();
      // Re-render after sync
      await renderSyncStatus(container);
    });
  }
}
