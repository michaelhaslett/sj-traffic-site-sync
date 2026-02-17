/**
 * Equipment Check component (Stage 1) — shows equipment needed
 * for the job and captures quantities taken from depot.
 */

import { buildEquipmentList, groupByCategory, resolveCharacteristics } from '../js/checklist-engine.js';
import { saveEquipmentCheck, getEquipmentCheck } from '../js/db.js';
import { showToast } from '../js/toast.js';

/**
 * Render the equipment check screen into a container.
 * @param {HTMLElement} container
 * @param {Object} job - Job data
 * @param {Function} onComplete - Called with equipment manifest when done
 */
export async function renderEquipmentCheck(container, job, onComplete) {
  // Build or load equipment list
  let saved = await getEquipmentCheck(job.id);
  const equipmentItems = await buildEquipmentList(job.characteristics);
  const chars = await resolveCharacteristics(job.characteristics);
  const groups = groupByCategory(equipmentItems);

  if (!saved) {
    const quantities = {};
    equipmentItems.forEach(item => { quantities[item.id] = 0; });
    saved = { jobId: job.id, quantities, startedAt: new Date().toISOString() };
  }

  container.innerHTML = `
    <div class="equipment-check">
      <div class="checklist-header">
        <div class="checklist-header__job-id">${job.id}</div>
        <div class="checklist-header__client">${escHtml(job.client)}</div>
        <div class="checklist-header__project">${escHtml(job.project)}</div>
        <div class="job-card__tags" style="margin-top: var(--sp-sm);">
          ${chars.map(c => `<span class="tag ${c.tagClass}">${c.label}</span>`).join('')}
        </div>
      </div>

      <div class="section-header" style="margin-top: var(--sp-md);">
        <div class="section-header__title">Equipment to Load</div>
        <div class="section-header__subtitle">${equipmentItems.length} items</div>
      </div>

      <div class="equipment-groups">
        ${groups.map((g, i) => renderEquipmentGroup(g, saved.quantities, i)).join('')}
      </div>

      <div style="margin-top: var(--sp-lg);">
        <button class="btn btn--primary" id="equipment-done">
          Confirm Equipment Loaded
        </button>
      </div>
    </div>
  `;

  // Attach quantity input handlers
  container.querySelectorAll('.equipment-qty').forEach(input => {
    input.addEventListener('change', async () => {
      const itemId = input.dataset.itemId;
      saved.quantities[itemId] = parseInt(input.value) || 0;
      await saveEquipmentCheck(saved);
    });

    // Stepper buttons
    const row = input.closest('.equipment-item');
    row.querySelector('.eq-minus')?.addEventListener('click', async () => {
      const val = Math.max(0, (parseInt(input.value) || 0) - 1);
      input.value = val;
      saved.quantities[input.dataset.itemId] = val;
      await saveEquipmentCheck(saved);
    });
    row.querySelector('.eq-plus')?.addEventListener('click', async () => {
      const val = (parseInt(input.value) || 0) + 1;
      input.value = val;
      saved.quantities[input.dataset.itemId] = val;
      await saveEquipmentCheck(saved);
    });
  });

  // Complete button
  container.querySelector('#equipment-done').addEventListener('click', async () => {
    // Check at least some equipment is loaded
    const total = Object.values(saved.quantities).reduce((a, b) => a + b, 0);
    if (total === 0) {
      showToast('Enter quantities for at least some equipment', 'error');
      return;
    }
    saved.completedAt = new Date().toISOString();
    await saveEquipmentCheck(saved);
    onComplete(saved);
  });
}

function renderEquipmentGroup(group, quantities, index) {
  const accentColors = ['var(--sj-orange)', 'var(--sj-blue)', 'var(--sj-teal)', 'var(--sj-dark-green)', 'var(--sj-taupe)'];
  const color = accentColors[index % accentColors.length];

  return `
    <div class="category-section">
      <div class="category-header" style="border-left-color: ${color};">
        <span class="category-header__name">${group.category}</span>
        <span class="category-header__count">${group.items.length}</span>
      </div>
      <div class="category-items">
        ${group.items.map(item => renderEquipmentItem(item, quantities[item.id] || 0)).join('')}
      </div>
    </div>
  `;
}

function renderEquipmentItem(item, qty) {
  return `
    <div class="equipment-item">
      <div class="equipment-item__info">
        <div class="equipment-item__label">${escHtml(item.label)}</div>
        <div class="equipment-item__unit">${item.unit}</div>
      </div>
      <div class="equipment-item__qty-control">
        <button class="eq-stepper eq-minus">-</button>
        <input type="number" class="equipment-qty" data-item-id="${item.id}"
               value="${qty}" min="0" inputmode="numeric" pattern="[0-9]*">
        <button class="eq-stepper eq-plus">+</button>
      </div>
    </div>
  `;
}

function escHtml(str) {
  const d = document.createElement('div');
  d.textContent = str || '';
  return d.innerHTML;
}
