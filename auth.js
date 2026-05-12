const API = 'http://127.0.0.1:5000';

const getToken = () => localStorage.getItem('ib_token');
const setToken = (t) => localStorage.setItem('ib_token', t);
const clearToken = () => localStorage.removeItem('ib_token');
const authHeaders = () => ({ 'Content-Type': 'application/json', 'X-Auth-Token': getToken() || '' });

/* ===== THEME — apply saved preference immediately ===== */
(function() {
  const saved = localStorage.getItem('ib_theme') || 'dark';
  document.documentElement.setAttribute('data-theme', saved);
})();

/* ===== THEME TOGGLE (works on all pages) ===== */
(function() {
  function initThemeToggle() {
    const btn = document.getElementById('theme-toggle');
    if (!btn) return;
    const apply = (theme) => {
      document.documentElement.setAttribute('data-theme', theme);
      btn.innerHTML = theme === 'dark' ? '<i class="fas fa-moon"></i>' : '<i class="fas fa-sun"></i>';
      localStorage.setItem('ib_theme', theme);
    };
    apply(localStorage.getItem('ib_theme') || 'dark');
    btn.addEventListener('click', () => {
      const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
      apply(isDark ? 'light' : 'dark');
    });
  }
  // run immediately (script is at bottom of body so DOM is ready)
  initThemeToggle();
})();

/* ===== ROLE SELECTORS ===== */
const ROLE_LABELS = { admin: 'Admin', startup: 'Startup Owner', investor: 'Investor' };
const ROLE_CLASSES = { admin: 'role-admin', startup: 'role-startup', investor: 'role-investor' };

function setupRoleSelector(selectorId, hiddenInputId, bannerId, labelId, onSwitch) {
  const selector = document.getElementById(selectorId);
  if (!selector) return;
  selector.querySelectorAll('.role-pill').forEach(btn => {
    btn.addEventListener('click', () => {
      selector.querySelectorAll('.role-pill').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      const role = btn.dataset.role;
      document.getElementById(hiddenInputId).value = role;
      const banner = document.getElementById(bannerId);
      banner.className = `role-banner ${ROLE_CLASSES[role]}`;
      document.getElementById(labelId).textContent = ROLE_LABELS[role];
      if (onSwitch) onSwitch(role);
    });
  });
}

// Login role selector — also highlights left panel cards
setupRoleSelector('login-role-selector', 'login-role', 'role-banner', 'role-label', (role) => {
  document.querySelectorAll('.role-info-card').forEach(c => c.classList.remove('active'));
  const card = document.getElementById(`info-${role}`);
  if (card) card.classList.add('active');
});

// Signup role selector — swaps dynamic fields + left panel content
setupRoleSelector('signup-role-selector', 'signup-role', 'su-role-banner', 'su-role-label', (role) => {
  const isStartup = role === 'startup';
  document.getElementById('startup-fields').style.display = isStartup ? '' : 'none';
  document.getElementById('investor-fields').style.display = isStartup ? 'none' : '';
  const leftStartup = document.getElementById('left-startup');
  const leftInvestor = document.getElementById('left-investor');
  if (leftStartup) leftStartup.style.display = isStartup ? '' : 'none';
  if (leftInvestor) leftInvestor.style.display = isStartup ? 'none' : '';
});

/* ===== PASSWORD VISIBILITY ===== */
document.querySelectorAll('.toggle-pw').forEach(btn => {
  btn.addEventListener('click', () => {
    const input = btn.closest('.input-wrap').querySelector('input');
    const icon = btn.querySelector('i');
    const hidden = input.type === 'password';
    input.type = hidden ? 'text' : 'password';
    icon.className = hidden ? 'fas fa-eye-slash' : 'fas fa-eye';
  });
});

/* ===== PASSWORD STRENGTH ===== */
const pwInput = document.getElementById('su-password');
if (pwInput) {
  pwInput.addEventListener('input', () => {
    const v = pwInput.value;
    let score = 0;
    if (v.length >= 8) score++;
    if (/[A-Z]/.test(v)) score++;
    if (/[0-9]/.test(v)) score++;
    if (/[^A-Za-z0-9]/.test(v)) score++;
    const levels = [
      { pct: '0%',   color: 'transparent', text: 'Enter a password' },
      { pct: '25%',  color: '#ef4444',     text: 'Weak' },
      { pct: '50%',  color: '#f59e0b',     text: 'Fair' },
      { pct: '75%',  color: '#3b82f6',     text: 'Good' },
      { pct: '100%', color: '#10b981',     text: 'Strong' },
    ];
    const lvl = v.length === 0 ? levels[0] : levels[score];
    const fill = document.getElementById('strength-fill');
    const label = document.getElementById('strength-label');
    fill.style.width = lvl.pct;
    fill.style.background = lvl.color;
    label.textContent = lvl.text;
    label.style.color = lvl.color === 'transparent' ? 'var(--text3)' : lvl.color;
  });
}

/* ===== HELPERS ===== */
function showError(id, msg) { const e = document.getElementById(id); if (e) e.textContent = msg; }
function clearError(id) { const e = document.getElementById(id); if (e) e.textContent = ''; }
function setInputState(input, state) {
  if (!input) return;
  input.classList.remove('input-error', 'input-success');
  if (state) input.classList.add(state);
}
function showApiError(id, msg) {
  const el = document.getElementById(id);
  if (!el) return;
  el.innerHTML = `<i class="fas fa-exclamation-circle"></i> ${msg}`;
  el.style.display = 'flex';
}
function hideApiError(id) {
  const el = document.getElementById(id);
  if (el) el.style.display = 'none';
}
function showToast(msg, type = 'success') {
  const existing = document.querySelector('.auth-toast');
  if (existing) existing.remove();
  const toast = document.createElement('div');
  toast.className = 'auth-toast';
  toast.style.background = type === 'success' ? 'var(--green)' : 'var(--red)';
  toast.innerHTML = `<i class="fas fa-${type === 'success' ? 'check-circle' : 'exclamation-circle'}"></i> ${msg}`;
  document.body.appendChild(toast);
  requestAnimationFrame(() => toast.classList.add('show'));
  setTimeout(() => { toast.classList.remove('show'); setTimeout(() => toast.remove(), 400); }, 3500);
}
function setBtnLoading(btnId, loading) {
  const btn = document.getElementById(btnId);
  if (!btn) return;
  btn.querySelector('.btn-text').style.display = loading ? 'none' : '';
  btn.querySelector('.btn-loader').style.display = loading ? '' : 'none';
  btn.disabled = loading;
}

/* ===== LOGIN FORM ===== */
const loginForm = document.getElementById('login-form');
if (loginForm) {
  loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    hideApiError('api-error');
    let valid = true;

    const email = document.getElementById('email');
    const password = document.getElementById('password');
    clearError('email-error'); clearError('password-error');
    setInputState(email, null); setInputState(password, null);

    if (!email.value.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.value)) {
      showError('email-error', 'Enter a valid email address.');
      setInputState(email, 'input-error'); valid = false;
    } else { setInputState(email, 'input-success'); }

    if (!password.value || password.value.length < 6) {
      showError('password-error', 'Password must be at least 6 characters.');
      setInputState(password, 'input-error'); valid = false;
    } else { setInputState(password, 'input-success'); }

    if (!valid) return;

    setBtnLoading('login-btn', true);
    try {
      const res = await fetch(`${API}/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: email.value.trim(),
          password: password.value,
          role: document.getElementById('login-role').value
        })
      });
      const data = await res.json();
      if (!res.ok) { showApiError('api-error', data.error || 'Login failed.'); return; }

      setToken(data.token);
      showToast(`Welcome back, ${data.name}!`);
      const redirects = { admin: 'dashboard_admin.html', startup: 'dashboard_startup.html', investor: 'dashboard_investor.html' };
      setTimeout(() => { window.location.href = redirects[data.role] || 'index.html'; }, 1200);
    } catch {
      showApiError('api-error', 'Cannot connect to server. Make sure Flask is running.');
    } finally {
      setBtnLoading('login-btn', false);
    }
  });
}

/* ===== SIGNUP FORM ===== */
const signupForm = document.getElementById('signup-form');
if (signupForm) {
  signupForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    hideApiError('su-api-error');
    let valid = true;

    const firstName = document.getElementById('first-name');
    const lastName  = document.getElementById('last-name');
    const email     = document.getElementById('su-email');
    const password  = document.getElementById('su-password');
    const confirm   = document.getElementById('confirm-password');
    const terms     = document.getElementById('terms');
    const role      = document.getElementById('signup-role').value;

    ['first-name-error','last-name-error','su-email-error','su-password-error','confirm-password-error','terms-error'].forEach(clearError);
    [firstName, lastName, email, password, confirm].forEach(i => setInputState(i, null));

    if (!firstName.value.trim()) { showError('first-name-error', 'Required.'); setInputState(firstName, 'input-error'); valid = false; }
    else setInputState(firstName, 'input-success');

    if (!lastName.value.trim()) { showError('last-name-error', 'Required.'); setInputState(lastName, 'input-error'); valid = false; }
    else setInputState(lastName, 'input-success');

    if (!email.value.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.value)) {
      showError('su-email-error', 'Enter a valid email.'); setInputState(email, 'input-error'); valid = false;
    } else setInputState(email, 'input-success');

    if (role === 'startup' && !document.getElementById('company').value.trim()) {
      showError('company-error', 'Startup name is required.'); valid = false;
    }

    if (!password.value || password.value.length < 8) {
      showError('su-password-error', 'Min. 8 characters.'); setInputState(password, 'input-error'); valid = false;
    } else setInputState(password, 'input-success');

    if (confirm.value !== password.value) {
      showError('confirm-password-error', 'Passwords do not match.'); setInputState(confirm, 'input-error'); valid = false;
    } else if (confirm.value) setInputState(confirm, 'input-success');

    if (!terms.checked) { showError('terms-error', 'You must accept the terms.'); valid = false; }

    if (!valid) return;

    // Build payload
    const payload = {
      first_name: firstName.value.trim(),
      last_name: lastName.value.trim(),
      email: email.value.trim(),
      password: password.value,
      role,
      phone: document.getElementById('phone').value.trim(),
    };
    if (role === 'startup') {
      payload.company_name   = document.getElementById('company').value.trim();
      payload.industry       = document.getElementById('industry').value;
      payload.funding_stage  = document.getElementById('funding-stage').value;
    } else {
      payload.firm_name       = document.getElementById('firm').value.trim();
      payload.investor_type   = document.getElementById('inv-type').value;
      payload.investment_focus= document.getElementById('inv-focus').value;
    }

    setBtnLoading('signup-btn', true);
    try {
      const res = await fetch(`${API}/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      if (!res.ok) { showApiError('su-api-error', data.error || 'Registration failed.'); return; }

      showToast('Account created! Redirecting to login...');
      setTimeout(() => { window.location.href = 'login.html'; }, 1800);
    } catch {
      showApiError('su-api-error', 'Cannot connect to server. Make sure Flask is running.');
    } finally {
      setBtnLoading('signup-btn', false);
    }
  });
}
