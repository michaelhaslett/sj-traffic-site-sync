/**
 * HSEQ notes component — open textarea for fatigue, client dynamics, etc.
 */

/**
 * Render the HSEQ notes textarea.
 * @param {string} currentNotes - Existing notes
 * @returns {string} HTML
 */
export function renderHseqNotes(currentNotes) {
  return `
    <div class="hseq-notes settings-card">
      <div class="settings-card__title">HSEQ Observations</div>
      <p style="font-size: var(--fs-sm); color: var(--color-text-muted); margin-bottom: var(--sp-sm);">
        Note any safety concerns, fatigue observations, client dynamics, unusual road conditions, or other HSEQ matters. No response required — this is for record-keeping.
      </p>
      <textarea class="signoff__input hseq-textarea" id="hseq-notes"
                rows="4" placeholder="e.g. Crew member reported fatigue at 2am. Road surface uneven near km 14. Client rep requested additional signage...">${escHtml(currentNotes || '')}</textarea>
    </div>
  `;
}

/**
 * Get current HSEQ notes value from the DOM.
 * @returns {string}
 */
export function getHseqNotesValue() {
  return document.getElementById('hseq-notes')?.value?.trim() || '';
}

function escHtml(str) {
  const d = document.createElement('div');
  d.textContent = str || '';
  return d.innerHTML;
}
