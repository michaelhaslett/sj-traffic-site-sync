/**
 * Login component — searchable staff list + 4-digit PIN.
 * Mobile-friendly with large touch targets.
 */

import { setCurrentStaff } from '../js/store.js';
import { showToast } from '../js/toast.js';

let staffData = null;

async function loadStaff() {
  if (staffData) return staffData;
  const res = await fetch('data/staff.json');
  staffData = await res.json();
  return staffData;
}

/**
 * Render the login screen into the app container.
 * @param {HTMLElement} container
 * @param {Function} onLogin - called with staff object after successful login
 */
export async function renderLogin(container, onLogin) {
  const { staff } = await loadStaff();

  container.innerHTML = `
    <div class="login-screen">
      <img src="assets/logo-full.png" alt="SJ Traffic" class="login-screen__logo">
      <h2 class="login-screen__title">Site Checklist</h2>
      <p class="login-screen__subtitle">Select your name to sign in</p>

      <div class="login-screen__search-wrap">
        <input type="text" class="login-screen__search" id="staff-search"
               placeholder="Search staff..." autocomplete="off">
      </div>

      <div class="login-screen__staff-list" id="staff-list">
        ${renderStaffList(staff, '')}
      </div>

      <!-- PIN entry (hidden until staff selected) -->
      <div class="login-screen__pin-section" id="pin-section" style="display:none;">
        <div class="login-screen__selected-staff" id="selected-staff-name"></div>
        <p class="login-screen__pin-prompt">Enter your 4-digit PIN</p>
        <div class="login-screen__pin-dots" id="pin-dots">
          <span class="pin-dot"></span>
          <span class="pin-dot"></span>
          <span class="pin-dot"></span>
          <span class="pin-dot"></span>
        </div>
        <div class="login-screen__pin-error" id="pin-error"></div>
        <div class="login-screen__numpad" id="numpad">
          ${[1,2,3,4,5,6,7,8,9,'',0,'back'].map(k => {
            if (k === '') return '<button class="numpad__key numpad__key--empty" disabled></button>';
            if (k === 'back') return '<button class="numpad__key numpad__key--back" data-key="back">&larr;</button>';
            return `<button class="numpad__key" data-key="${k}">${k}</button>`;
          }).join('')}
        </div>
        <button class="btn btn--ghost login-screen__back-btn" id="pin-back">Choose a different person</button>
      </div>
    </div>
  `;

  // State
  let selectedStaff = null;
  let pin = '';

  const searchInput = container.querySelector('#staff-search');
  const staffListEl = container.querySelector('#staff-list');
  const pinSection = container.querySelector('#pin-section');
  const searchWrap = container.querySelector('.login-screen__search-wrap');
  const selectedNameEl = container.querySelector('#selected-staff-name');
  const pinDotsEl = container.querySelector('#pin-dots');
  const pinErrorEl = container.querySelector('#pin-error');

  // Search filtering
  searchInput.addEventListener('input', () => {
    const q = searchInput.value.trim().toLowerCase();
    staffListEl.innerHTML = renderStaffList(staff, q);
    attachStaffClickHandlers();
  });

  // Staff selection
  function attachStaffClickHandlers() {
    staffListEl.querySelectorAll('.staff-item').forEach(item => {
      item.addEventListener('click', () => {
        const id = item.dataset.staffId;
        selectedStaff = staff.find(s => s.id === id);
        if (!selectedStaff) return;

        // Show PIN section
        selectedNameEl.textContent = selectedStaff.name;
        pinSection.style.display = 'flex';
        staffListEl.style.display = 'none';
        searchWrap.style.display = 'none';
        pin = '';
        updatePinDots();
        pinErrorEl.textContent = '';
      });
    });
  }
  attachStaffClickHandlers();

  // Back to staff list
  container.querySelector('#pin-back').addEventListener('click', () => {
    selectedStaff = null;
    pin = '';
    pinSection.style.display = 'none';
    staffListEl.style.display = 'block';
    searchWrap.style.display = 'block';
    pinErrorEl.textContent = '';
    updatePinDots();
  });

  // Numpad
  container.querySelector('#numpad').addEventListener('click', async (e) => {
    const key = e.target.closest('.numpad__key')?.dataset.key;
    if (!key) return;

    if (key === 'back') {
      pin = pin.slice(0, -1);
      pinErrorEl.textContent = '';
    } else if (pin.length < 4) {
      pin += key;
    }

    updatePinDots();

    // Auto-submit when 4 digits entered
    if (pin.length === 4) {
      if (pin === selectedStaff.pin) {
        // Success
        const staffObj = { id: selectedStaff.id, name: selectedStaff.name, role: selectedStaff.role, email: selectedStaff.email };
        await setCurrentStaff(staffObj);
        showToast(`Welcome, ${staffObj.name}`, 'success');
        onLogin(staffObj);
      } else {
        pinErrorEl.textContent = 'Incorrect PIN. Try again.';
        pin = '';
        updatePinDots();
        // Shake animation
        pinDotsEl.classList.add('shake');
        setTimeout(() => pinDotsEl.classList.remove('shake'), 500);
      }
    }
  });

  function updatePinDots() {
    const dots = pinDotsEl.querySelectorAll('.pin-dot');
    dots.forEach((dot, i) => {
      dot.classList.toggle('pin-dot--filled', i < pin.length);
    });
  }

  // Focus search on load
  setTimeout(() => searchInput.focus(), 300);
}

function renderStaffList(staff, query) {
  const filtered = query
    ? staff.filter(s => s.name.toLowerCase().includes(query) || s.role.toLowerCase().includes(query))
    : staff;

  if (!filtered.length) {
    return '<div class="login-screen__no-results">No staff found</div>';
  }

  return filtered.map(s => `
    <button class="staff-item" data-staff-id="${s.id}">
      <div class="staff-item__avatar">${s.name.charAt(0)}</div>
      <div class="staff-item__info">
        <div class="staff-item__name">${escHtml(s.name)}</div>
        <div class="staff-item__role">${escHtml(s.role)}</div>
      </div>
    </button>
  `).join('');
}

function escHtml(str) {
  const d = document.createElement('div');
  d.textContent = str || '';
  return d.innerHTML;
}
