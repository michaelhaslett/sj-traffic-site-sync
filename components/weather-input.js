/**
 * Weather input component — visibility + conditions dropdowns.
 */

const VISIBILITY_OPTIONS = ['Clear', 'Light Haze', 'Fog', 'Heavy Fog', 'Dust'];
const WEATHER_OPTIONS = ['Fine', 'Overcast', 'Light Rain', 'Heavy Rain', 'Storms', 'Extreme Heat (>40C)', 'High Winds'];

/**
 * Render weather inputs.
 * @param {Object|null} current - { visibility, weather } or null
 * @returns {string} HTML
 */
export function renderWeatherInput(current) {
  const vis = current?.visibility || '';
  const wth = current?.weather || '';

  return `
    <div class="weather-input settings-card">
      <div class="settings-card__title">Weather Conditions</div>
      <div class="weather-input__row">
        <div class="signoff__field" style="flex:1;">
          <label class="signoff__label">Visibility</label>
          <select class="signoff__input weather-select" id="weather-visibility">
            <option value="">Select...</option>
            ${VISIBILITY_OPTIONS.map(o => `<option value="${o}" ${vis === o ? 'selected' : ''}>${o}</option>`).join('')}
          </select>
        </div>
        <div class="signoff__field" style="flex:1;">
          <label class="signoff__label">Conditions</label>
          <select class="signoff__input weather-select" id="weather-conditions">
            <option value="">Select...</option>
            ${WEATHER_OPTIONS.map(o => `<option value="${o}" ${wth === o ? 'selected' : ''}>${o}</option>`).join('')}
          </select>
        </div>
      </div>
    </div>
  `;
}

/**
 * Get current weather values from the DOM.
 * @returns {{ visibility: string, weather: string }}
 */
export function getWeatherValues() {
  const vis = document.getElementById('weather-visibility')?.value || '';
  const wth = document.getElementById('weather-conditions')?.value || '';
  return { visibility: vis, weather: wth };
}
