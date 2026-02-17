/**
 * Step indicator — visual progress through the 3 stages + finalize.
 */

/**
 * Render the step indicator bar.
 * @param {string} activeStage - 'equipment' | 'checklist' | 'shutdown' | 'finalize'
 * @param {Object} stageStatus - { equipment: 'complete'|'active'|'pending', checklist: ..., shutdown: ..., finalize: ... }
 * @returns {string} HTML
 */
export function renderStepIndicator(activeStage, stageStatus) {
  const steps = [
    { id: 'equipment', label: 'Equip', icon: '&#128230;' },
    { id: 'checklist', label: 'Site', icon: '&#9745;' },
    { id: 'shutdown', label: 'Close', icon: '&#128274;' },
    { id: 'finalize', label: 'Submit', icon: '&#9989;' },
  ];

  return `
    <div class="step-indicator">
      ${steps.map((step, i) => {
        const status = stageStatus[step.id] || 'pending';
        const isActive = step.id === activeStage;
        const classes = [
          'step-indicator__step',
          isActive ? 'step-indicator__step--active' : '',
          status === 'complete' ? 'step-indicator__step--complete' : '',
        ].filter(Boolean).join(' ');

        return `
          <div class="${classes}" data-stage="${step.id}">
            <div class="step-indicator__circle">
              ${status === 'complete' ? '&#10003;' : step.icon}
            </div>
            <div class="step-indicator__label">${step.label}</div>
          </div>
          ${i < steps.length - 1 ? '<div class="step-indicator__line ' + (status === 'complete' ? 'step-indicator__line--complete' : '') + '"></div>' : ''}
        `;
      }).join('')}
    </div>
  `;
}

/**
 * Compute stage statuses from saved job data.
 * @param {Object} jobProgress - { equipmentDone, checklistDone, shutdownDone }
 * @param {string} activeStage
 * @returns {Object} stageStatus
 */
export function computeStageStatus(jobProgress, activeStage) {
  const stages = ['equipment', 'checklist', 'shutdown', 'finalize'];
  const status = {};
  for (const stage of stages) {
    if (jobProgress[stage + 'Done']) {
      status[stage] = 'complete';
    } else if (stage === activeStage) {
      status[stage] = 'active';
    } else {
      status[stage] = 'pending';
    }
  }
  return status;
}
