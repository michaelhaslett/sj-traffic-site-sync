/**
 * Shutdown view component (Stage 3) — equipment reconciliation.
 * Compares equipment taken (from Stage 1 manifest) with what's returned.
 */

import { getEquipmentCheck } from '../js/db.js';
import { buildEquipmentList, groupByCategory } from '../js/checklist-engine.js';
import { showToast } from '../js/toast.js';

/**
 * Render the shutdown/reconciliation screen.
 * @param {HTMLElement} container
 * @param {Object} job
 * @param {Function} onComplete - called with { returned, missing } data
 */
export async function renderShutdownView(container, job, onComplete) {
  const manifest = await getEquipmentCheck(job.id);
  const equipmentItems = await buildEquipmentList(job.characteristics);

  // Build items list with taken quantities
  const itemsMap = new Map(equipmentItems.map(i => [i.id, i]));
  const reconcileItems = [];
  if (manifest?.quantities) {
    for (const [itemId, taken] of Object.entries(manifest.quantities)) {
      if (taken > 0) {
        const item = itemsMap.get(itemId);
        if (item) reconcileItems.push({ ...item, taken, returned: taken }); // default: all returned
      }
    }
  }

  // Sort by category
  reconcileItems.sort((a, b) => {
    if (a.category !== b.category) return a.category.localeCompare(b.category);
    return a.label.localeCompare(b.label);
  });
  const groups = groupByCategory(reconcileItems);

  if (reconcileItems.length === 0) {
    container.innerHTML = `
      <div class="settings-card">
        <div class="empty-state">
          <div class="empty-state__icon">&#128230;</div>
          <div class="empty-state__title">No equipment to reconcile</div>
          <p>No equipment was recorded in the pre-departure check.</p>
        </div>
        <button class="btn btn--primary" id="shutdown-skip" style="margin-top: var(--sp-md);">
          Continue to Finalize
        </button>
      </div>
    `;
    container.querySelector('#shutdown-skip').addEventListener('click', () => {
      onComplete({ returned: {}, missing: {}, skipped: true });
    });
    return;
  }

  container.innerHTML = `
    <div class="shutdown-view">
      <div class="settings-card">
        <div class="settings-card__title">Equipment Reconciliation</div>
        <p style="font-size: var(--fs-sm); color: var(--color-text-muted); margin-bottom: var(--sp-md);">
          Confirm how many of each item are being returned to the depot. Flag any missing items.
        </p>
      </div>

      <div class="equipment-groups">
        ${groups.map((g, i) => renderReconcileGroup(g, i)).join('')}
      </div>

      <div id="missing-summary" class="shutdown-missing" style="display:none;"></div>

      <div style="margin-top: var(--sp-lg);">
        <button class="btn btn--primary" id="shutdown-done">
          Confirm Equipment Return
        </button>
      </div>
    </div>
  `;

  const missingEl = container.querySelector('#missing-summary');

  // Attach handlers
  container.querySelectorAll('.reconcile-qty').forEach(input => {
    input.addEventListener('change', () => updateMissingSummary());

    const row = input.closest('.equipment-item');
    row.querySelector('.eq-minus')?.addEventListener('click', () => {
      input.value = Math.max(0, (parseInt(input.value) || 0) - 1);
      updateMissingSummary();
    });
    row.querySelector('.eq-plus')?.addEventListener('click', () => {
      const max = parseInt(input.dataset.taken) || 0;
      input.value = Math.min(max, (parseInt(input.value) || 0) + 1);
      updateMissingSummary();
    });
  });

  function updateMissingSummary() {
    const missing = [];
    container.querySelectorAll('.reconcile-qty').forEach(input => {
      const taken = parseInt(input.dataset.taken) || 0;
      const returned = parseInt(input.value) || 0;
      if (returned < taken) {
        const label = input.dataset.label;
        missing.push({ id: input.dataset.itemId, label, taken, returned, lost: taken - returned });
      }
    });

    if (missing.length > 0) {
      missingEl.style.display = 'block';
      missingEl.innerHTML = `
        <div class="settings-card" style="border: 2px solid var(--color-danger);">
          <div class="settings-card__title" style="color: var(--color-danger);">&#9888; Missing Equipment</div>
          ${missing.map(m => `
            <div class="shutdown-missing__item">
              <span>${escHtml(m.label)}</span>
              <span class="shutdown-missing__count">${m.lost} missing (${m.returned}/${m.taken} returned)</span>
            </div>
          `).join('')}
          <p style="font-size: var(--fs-xs); color: var(--color-text-muted); margin-top: var(--sp-sm);">
            Missing items will be reported for invoicing.
          </p>
        </div>
      `;
    } else {
      missingEl.style.display = 'none';
    }
  }

  container.querySelector('#shutdown-done').addEventListener('click', () => {
    const returned = {};
    const missing = {};
    container.querySelectorAll('.reconcile-qty').forEach(input => {
      const itemId = input.dataset.itemId;
      const taken = parseInt(input.dataset.taken) || 0;
      const ret = parseInt(input.value) || 0;
      returned[itemId] = ret;
      if (ret < taken) {
        missing[itemId] = { label: input.dataset.label, taken, returned: ret, lost: taken - ret };
      }
    });
    onComplete({ returned, missing, skipped: false });
  });
}

function renderReconcileGroup(group, index) {
  const accentColors = ['var(--sj-orange)', 'var(--sj-blue)', 'var(--sj-teal)', 'var(--sj-dark-green)', 'var(--sj-taupe)'];
  const color = accentColors[index % accentColors.length];

  return `
    <div class="category-section">
      <div class="category-header" style="border-left-color: ${color};">
        <span class="category-header__name">${group.category}</span>
      </div>
      <div class="category-items">
        ${group.items.map(item => `
          <div class="equipment-item">
            <div class="equipment-item__info">
              <div class="equipment-item__label">${escHtml(item.label)}</div>
              <div class="equipment-item__unit">Taken: ${item.taken}</div>
            </div>
            <div class="equipment-item__qty-control">
              <button class="eq-stepper eq-minus">-</button>
              <input type="number" class="reconcile-qty equipment-qty"
                     data-item-id="${item.id}" data-taken="${item.taken}" data-label="${escHtml(item.label)}"
                     value="${item.returned}" min="0" max="${item.taken}" inputmode="numeric">
              <button class="eq-stepper eq-plus">+</button>
            </div>
          </div>
        `).join('')}
      </div>
    </div>
  `;
}

function escHtml(str) {
  const d = document.createElement('div');
  d.textContent = str || '';
  return d.innerHTML;
}
