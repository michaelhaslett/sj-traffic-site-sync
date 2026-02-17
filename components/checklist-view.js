/**
 * Checklist view component — renders the job header,
 * progress bar, category groups, and individual items.
 */

import { groupByCategory } from '../js/checklist-engine.js';

/**
 * Render the full checklist view for a job.
 * @param {Object} job - Job data
 * @param {Object[]} chars - Resolved characteristic tags
 * @param {Object[]} items - Checklist items
 * @param {Object} checkStates - Check states { itemId: { checked, note, timestamp } }
 * @returns {string} HTML
 */
export function renderChecklistView(job, chars, items, checkStates) {
  const groups = groupByCategory(items);
  const done = Object.values(checkStates).filter(c => c.checked).length;
  const total = Object.values(checkStates).length;
  const pct = total > 0 ? Math.round((done / total) * 100) : 0;

  return `
    ${renderHeader(job, chars)}
    ${renderProgress(done, total, pct)}
    <div class="checklist-categories">
      ${groups.map((g, i) => renderCategorySection(g, checkStates, i)).join('')}
    </div>
  `;
}

function renderHeader(job, chars) {
  return `
    <div class="checklist-header">
      <div class="checklist-header__job-id">${job.id} &middot; ${job.tmpRef || ''}</div>
      <div class="checklist-header__client">${escHtml(job.client)}</div>
      <div class="checklist-header__project">${escHtml(job.project)}</div>
      <div class="checklist-header__details">
        <span>&#128205; ${escHtml(job.location)}</span>
        <span>&#128336; ${job.startTime} - ${job.endTime}</span>
        <span>&#128101; ${job.crewSize} crew &middot; Lead: ${escHtml(job.teamLead)}</span>
      </div>
      <div class="job-card__tags" style="margin-top: var(--sp-sm);">
        ${chars.map(c => `<span class="tag ${c.tagClass}">${c.label}</span>`).join('')}
      </div>
    </div>
  `;
}

function renderProgress(done, total, pct) {
  return `
    <div class="progress-bar">
      <div class="progress-bar__fill" style="width: ${pct}%"></div>
    </div>
    <div class="progress-text">${done} of ${total} items complete (${pct}%)</div>
  `;
}

function renderCategorySection(group, checkStates, index) {
  const { category, items } = group;
  const done = items.filter(i => checkStates[i.id]?.checked).length;
  const accentColors = ['var(--sj-orange)', 'var(--sj-blue)', 'var(--sj-teal)', 'var(--sj-dark-green)', 'var(--sj-taupe)'];
  const color = accentColors[index % accentColors.length];

  return `
    <div class="category-section" data-category="${category}">
      <div class="category-header" style="border-left-color: ${color};" onclick="this.nextElementSibling.classList.toggle('collapsed')">
        <span class="category-header__name">${category}</span>
        <span class="category-header__count ${done === items.length ? 'category-header__count--complete' : ''}">${done}/${items.length}</span>
      </div>
      <div class="category-items">
        ${items.map(item => renderChecklistItem(item, checkStates[item.id])).join('')}
      </div>
    </div>
  `;
}

function renderChecklistItem(item, cs) {
  const checked = cs?.checked || false;
  const hasNote = !!(cs?.note);

  return `
    <div class="checklist-item ${checked ? 'checklist-item--checked' : ''}" data-item-id="${item.id}">
      <button class="checklist-item__checkbox" data-item-id="${item.id}">${checked ? '&#10003;' : ''}</button>
      <div class="checklist-item__content">
        <div class="checklist-item__label">${escHtml(item.label)}</div>
      </div>
      <div class="checklist-item__actions">
        <button class="checklist-item__action-btn ${hasNote ? 'checklist-item__action-btn--has-note' : ''}"
                data-action="note" data-item-id="${item.id}" title="Add note">
          &#128221;
        </button>
      </div>
    </div>
  `;
}

function escHtml(str) {
  const d = document.createElement('div');
  d.textContent = str || '';
  return d.innerHTML;
}
