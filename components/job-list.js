/**
 * Job list component — renders job cards with status badges.
 */

import { resolveCharacteristics } from '../js/checklist-engine.js';

/**
 * Render the list of job cards.
 * @param {Object[]} jobs - Array of job objects
 * @param {Map} checklistMap - Map of jobId -> saved checklist data
 * @returns {string} HTML string
 */
export async function renderJobList(jobs, checklistMap) {
  if (!jobs.length) {
    return `
      <div class="empty-state">
        <div class="empty-state__icon">&#128203;</div>
        <div class="empty-state__title">No jobs today</div>
        <p>Pull down to refresh or check back later.</p>
      </div>
    `;
  }

  const cards = [];
  for (const job of jobs) {
    const saved = checklistMap.get(job.id);
    const status = getJobStatus(saved);
    const chars = await resolveCharacteristics(job.characteristics);
    cards.push(renderJobCard(job, status, chars));
  }
  return cards.join('');
}

function getJobStatus(saved) {
  if (!saved) return { label: 'Not Started', cssClass: 'job-card__status--not-started' };
  if (saved.completedAt) return { label: 'Completed', cssClass: 'job-card__status--completed' };

  const cs = Object.values(saved.checkStates);
  const done = cs.filter(c => c.checked).length;
  if (done === 0) return { label: 'Not Started', cssClass: 'job-card__status--not-started' };
  return { label: `${done}/${cs.length}`, cssClass: 'job-card__status--in-progress' };
}

function renderJobCard(job, status, chars) {
  return `
    <div class="job-card" data-job-id="${job.id}">
      <div class="job-card__accent"></div>
      <div class="job-card__body">
        <div class="job-card__header">
          <span class="job-card__id">${job.id}</span>
          <span class="job-card__status ${status.cssClass}">${status.label}</span>
        </div>
        <div class="job-card__client">${escHtml(job.client)}</div>
        <div class="job-card__project">${escHtml(job.project)}</div>
        <div class="job-card__meta">
          <span class="job-card__meta-item">&#128205; ${escHtml(job.location)}</span>
          <span class="job-card__meta-item">&#128336; ${job.startTime} - ${job.endTime}</span>
          <span class="job-card__meta-item">&#128101; ${job.crewSize} crew</span>
        </div>
        <div class="job-card__tags">
          ${chars.map(c => `<span class="tag ${c.tagClass}">${c.label}</span>`).join('')}
        </div>
      </div>
    </div>
  `;
}

function escHtml(str) {
  const d = document.createElement('div');
  d.textContent = str || '';
  return d.innerHTML;
}
