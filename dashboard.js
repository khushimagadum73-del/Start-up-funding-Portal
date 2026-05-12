const API = 'http://127.0.0.1:5000';

const getToken    = () => localStorage.getItem('ib_token');
const authHeaders = () => ({ 'X-Auth-Token': getToken() || '' });

/* ===== THEME — apply saved preference immediately ===== */
(function() {
  const saved = localStorage.getItem('ib_theme') || 'dark';
  document.documentElement.setAttribute('data-theme', saved);
})();

/* ── detect which dashboard we're on ── */
const isAdminPage    = !!document.getElementById('users-tbody');
const isStartupPage  = !!document.getElementById('section-proposals');
const isInvestorPage = !!document.getElementById('section-inv-overview');

/* ── page meta for header title/subtitle ── */
const PAGE_META = {
  overview:            { title: 'Admin Dashboard',     subtitle: 'Platform overview & management' },
  users:               { title: 'Manage Users',         subtitle: 'View and manage all registered users' },
  startups:            { title: 'Startups',             subtitle: 'All registered startup accounts' },
  investors:           { title: 'Investors',            subtitle: 'All registered investor accounts' },
  deals:               { title: 'Deals',                subtitle: 'Active deals on the platform' },
  notifications:       { title: 'Notifications',        subtitle: 'Platform alerts and messages' },
  settings:            { title: 'Settings',             subtitle: 'Platform configuration' },
  proposals:           { title: 'My Proposals',         subtitle: 'Manage your funding proposals' },
  interested:          { title: 'Interested Investors',  subtitle: 'Investors who want to fund your proposals' },
  funding:             { title: 'Funding Tracker',      subtitle: 'Track your funding progress' },
  meetings:            { title: 'Meetings',             subtitle: 'Your scheduled investor meetings' },
  profile:             { title: 'My Profile',           subtitle: 'Your startup profile' },
  'st-overview':       { title: 'Startup Dashboard',    subtitle: 'Manage your startup & funding' },
  investors:           { title: 'Find Investors',       subtitle: 'Discover and connect with investors' },
  notifications:       { title: 'Notifications',        subtitle: 'Your latest activity' },
  'inv-overview':      { title: 'Investor Dashboard',   subtitle: 'Discover & fund top startups' },
  'inv-discover':      { title: 'Discover Startups',    subtitle: 'Browse real startup proposals' },
  'inv-interests':     { title: 'My Interests',         subtitle: 'Proposals you showed interest in' },
  'inv-meetings':      { title: 'Meetings',             subtitle: 'Your scheduled meetings' },
  'inv-notifications': { title: 'Notifications',        subtitle: 'Platform alerts and updates' },
  'inv-profile':       { title: 'My Profile',           subtitle: 'Your investor profile' },
};

/* ── sidebar toggle ── */
const sidebar      = document.getElementById('sidebar');
const sidebarToggle = document.getElementById('sidebar-toggle');
const dashMain     = document.querySelector('.dash-main');

sidebarToggle?.addEventListener('click', () => {
  if (window.innerWidth <= 768) {
    sidebar.classList.toggle('open');
  } else {
    sidebar.classList.toggle('collapsed');
    dashMain?.classList.toggle('expanded');
  }
});

/* ── theme toggle ── */
const themeToggle = document.getElementById('theme-toggle');
themeToggle?.addEventListener('click', () => {
  const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
  const next = isDark ? 'light' : 'dark';
  document.documentElement.setAttribute('data-theme', next);
  themeToggle.innerHTML = next === 'dark' ? '<i class="fas fa-moon"></i>' : '<i class="fas fa-sun"></i>';
  localStorage.setItem('ib_theme', next);
});
// set correct icon on load
if (themeToggle) {
  const current = document.documentElement.getAttribute('data-theme');
  themeToggle.innerHTML = current === 'dark' ? '<i class="fas fa-moon"></i>' : '<i class="fas fa-sun"></i>';
}

/* ── logout ── */
const logoutBtn = document.getElementById('logout-btn');
if (logoutBtn) {
  logoutBtn.addEventListener('click', async () => {
    try { await fetch(`${API}/logout`, { method: 'POST', headers: authHeaders() }); } catch {}
    localStorage.removeItem('ib_token');
    window.location.replace('login.html');
  });
}

/* ── load current user ── */
async function loadUser() {
  if (!getToken()) { window.location.replace('login.html'); return; }
  try {
    const res = await fetch(`${API}/me`, { headers: authHeaders() });
    if (res.status === 401) { window.location.replace('login.html'); return; }
    if (!res.ok) return;
    const data = await res.json();
    const nameEl   = document.getElementById('user-name');
    const avatarEl = document.getElementById('user-avatar');
    if (nameEl)   nameEl.textContent   = `${data.first_name} ${data.last_name}`;
    if (avatarEl) avatarEl.textContent = (data.first_name[0] + data.last_name[0]).toUpperCase();
  } catch {}
}
loadUser();

/* ── nav section switching ── */
const _loaded = new Set();

function switchSection(name) {
  document.querySelectorAll('.nav-item[data-section]').forEach(el => {
    el.classList.toggle('active', el.dataset.section === name);
  });

  document.querySelectorAll('.dash-section').forEach(el => {
    el.style.display = el.id === `section-${name}` ? '' : 'none';
  });

  const meta = PAGE_META[name] || {};
  const titleEl    = document.getElementById('page-title');
  const subtitleEl = document.getElementById('page-subtitle');
  if (titleEl)    titleEl.textContent    = meta.title    || '';
  if (subtitleEl) subtitleEl.textContent = meta.subtitle || '';

  if (!_loaded.has(name)) {
    _loaded.add(name);
    if (isAdminPage) {
      if (name === 'overview')  loadAdminData();
      if (name === 'users')     loadAllUsers();
      if (name === 'startups')  loadStartups();
      if (name === 'investors') loadInvestors();
    }
    if (isStartupPage  && name === 'profile')        loadProfile();
    if (isStartupPage  && name === 'st-overview')    {} // no API call needed
    if (isStartupPage  && name === 'interested')     loadAllInterests();
    if (isStartupPage  && name === 'investors')      loadRealInvestors();
    if (isStartupPage  && name === 'notifications')  loadConversations();
    if (isStartupPage  && name === 'meetings')        loadMeetings();
    if (isInvestorPage && name === 'inv-meetings')    loadInvMeetings();
    if (isInvestorPage && name === 'inv-profile')    loadInvestorProfile();
    if (isInvestorPage && name === 'inv-discover')   loadAllProposals();
    if (isInvestorPage && name === 'inv-interests')  loadMyInterests();
    if (isInvestorPage && name === 'inv-notifications') loadInvConversations();
  }
}

document.querySelectorAll('.nav-item[data-section]').forEach(el => {
  el.addEventListener('click', e => {
    e.preventDefault();
    switchSection(el.dataset.section);
    if (window.innerWidth <= 768) sidebar?.classList.remove('open');
  });
});

/* ── boot: pick correct default section ── */
if (isInvestorPage)     switchSection('inv-overview');
else if (isStartupPage) switchSection('st-overview');
else                    switchSection('overview');

/* ════════════════════════════════════════
   ADMIN DATA LOADERS
════════════════════════════════════════ */
async function loadAdminData() {
  try {
    const res = await fetch(`${API}/admin/stats`, { headers: authHeaders() });
    if (!res.ok) return;
    const data = await res.json();
    animateNum('stat-users',     data.total_users     || 0);
    animateNum('stat-startups',  data.total_startups  || 0);
    animateNum('stat-investors', data.total_investors || 0);
    animateNum('stat-deals',     data.total_deals     || 0);
    const tbody = document.getElementById('users-tbody');
    if (!tbody) return;
    if (!data.recent_users?.length) {
      tbody.innerHTML = '<tr><td colspan="6" class="table-empty">No users yet.</td></tr>'; return;
    }
    tbody.innerHTML = data.recent_users.map((u, i) => `
      <tr>
        <td>${i + 1}</td><td>${u.first_name} ${u.last_name}</td><td>${u.email}</td>
        <td><span class="role-tag ${u.role}">${u.role}</span></td>
        <td>${new Date(u.created_at).toLocaleDateString()}</td>
        <td><span class="role-tag ${u.is_active ? 'investor' : 'admin'}">${u.is_active ? 'Active' : 'Inactive'}</span></td>
      </tr>`).join('');
  } catch {
    const tbody = document.getElementById('users-tbody');
    if (tbody) tbody.innerHTML = '<tr><td colspan="6" class="table-empty">Could not load data.</td></tr>';
  }
}

let _allUsers = [];
async function loadAllUsers() {
  const tbody = document.getElementById('all-users-tbody');
  if (!tbody) return;
  try {
    const res = await fetch(`${API}/admin/users`, { headers: authHeaders() });
    if (!res.ok) { tbody.innerHTML = '<tr><td colspan="6" class="table-empty">Could not load users.</td></tr>'; return; }
    _allUsers = await res.json();
    renderUsersTable(_allUsers);
  } catch {
    tbody.innerHTML = '<tr><td colspan="6" class="table-empty">Could not load users.</td></tr>';
  }
}

function renderUsersTable(users) {
  const tbody = document.getElementById('all-users-tbody');
  if (!tbody) return;
  if (!users.length) { tbody.innerHTML = '<tr><td colspan="6" class="table-empty">No users found.</td></tr>'; return; }
  tbody.innerHTML = users.map((u, i) => `
    <tr>
      <td>${i + 1}</td><td>${u.first_name} ${u.last_name}</td><td>${u.email}</td>
      <td><span class="role-tag ${u.role}">${u.role}</span></td>
      <td>${new Date(u.created_at).toLocaleDateString()}</td>
      <td><span class="role-tag ${u.is_active ? 'investor' : 'admin'}">${u.is_active ? 'Active' : 'Inactive'}</span></td>
    </tr>`).join('');
}

document.getElementById('user-search')?.addEventListener('input', filterUsers);
document.getElementById('user-role-filter')?.addEventListener('change', filterUsers);
function filterUsers() {
  const q    = (document.getElementById('user-search')?.value || '').toLowerCase();
  const role = document.getElementById('user-role-filter')?.value || '';
  renderUsersTable(_allUsers.filter(u => {
    const matchQ    = !q    || `${u.first_name} ${u.last_name} ${u.email}`.toLowerCase().includes(q);
    const matchRole = !role || u.role === role;
    return matchQ && matchRole;
  }));
}

async function loadStartups() {
  const tbody = document.getElementById('startups-tbody');
  if (!tbody) return;
  try {
    const res = await fetch(`${API}/admin/startups`, { headers: authHeaders() });
    if (!res.ok) { tbody.innerHTML = '<tr><td colspan="7" class="table-empty">Could not load startups.</td></tr>'; return; }
    const data = await res.json();
    if (!data.length) { tbody.innerHTML = '<tr><td colspan="7" class="table-empty">No startups registered yet.</td></tr>'; return; }
    tbody.innerHTML = data.map((s, i) => `
      <tr>
        <td>${i + 1}</td><td>${s.first_name} ${s.last_name}</td><td>${s.email}</td>
        <td>${s.company_name || '—'}</td><td>${s.industry || '—'}</td>
        <td>${s.funding_stage || '—'}</td><td>${new Date(s.created_at).toLocaleDateString()}</td>
      </tr>`).join('');
  } catch {
    tbody.innerHTML = '<tr><td colspan="7" class="table-empty">Could not load startups.</td></tr>';
  }
}

async function loadInvestors() {
  const tbody = document.getElementById('investors-tbody');
  if (!tbody) return;
  try {
    const res = await fetch(`${API}/admin/investors`, { headers: authHeaders() });
    if (!res.ok) { tbody.innerHTML = '<tr><td colspan="7" class="table-empty">Could not load investors.</td></tr>'; return; }
    const data = await res.json();
    if (!data.length) { tbody.innerHTML = '<tr><td colspan="7" class="table-empty">No investors registered yet.</td></tr>'; return; }
    tbody.innerHTML = data.map((inv, i) => `
      <tr>
        <td>${i + 1}</td><td>${inv.first_name} ${inv.last_name}</td><td>${inv.email}</td>
        <td>${inv.firm_name || '—'}</td><td>${inv.investor_type || '—'}</td>
        <td>${inv.investment_focus || '—'}</td><td>${new Date(inv.created_at).toLocaleDateString()}</td>
      </tr>`).join('');
  } catch {
    tbody.innerHTML = '<tr><td colspan="7" class="table-empty">Could not load investors.</td></tr>';
  }
}

/* ════════════════════════════════════════
   STARTUP DATA LOADERS
════════════════════════════════════════ */
async function loadProfile() {
  if (!getToken()) return;
  try {
    const res = await fetch(`${API}/me`, { headers: authHeaders() });
    if (!res.ok) return;
    const data = await res.json();
    const nameEl  = document.getElementById('profile-name');
    const emailEl = document.getElementById('profile-email');
    if (nameEl)  nameEl.textContent  = `${data.first_name} ${data.last_name}`;
    if (emailEl) emailEl.textContent = data.email;
  } catch {}
}

/* ════════════════════════════════════════
   INVESTOR DATA LOADERS
════════════════════════════════════════ */
async function loadInvestorProfile() {
  if (!getToken()) return;
  try {
    const res = await fetch(`${API}/me`, { headers: authHeaders() });
    if (!res.ok) return;
    const data = await res.json();
    const nameEl  = document.getElementById('inv-profile-name');
    const emailEl = document.getElementById('inv-profile-email');
    if (nameEl)  nameEl.textContent  = `${data.first_name} ${data.last_name}`;
    if (emailEl) emailEl.textContent = data.email;
  } catch {}
}

/* ── counter animation ── */
function animateNum(id, target) {
  const el = document.getElementById(id);
  if (!el) return;
  let cur = 0;
  const step = Math.max(target / 60, 1);
  const t = setInterval(() => {
    cur += step;
    if (cur >= target) { cur = target; clearInterval(t); }
    el.textContent = Math.floor(cur).toLocaleString();
  }, 16);
}
