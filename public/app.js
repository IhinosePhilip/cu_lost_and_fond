// ===== API CONFIG =====
// Works on localhost and any hosted domain automatically
const API = '/api';

// Token stored in sessionStorage (cleared on tab close)
const Auth = {
  getToken: () => sessionStorage.getItem('cu_token'),
  setToken: (t) => sessionStorage.setItem('cu_token', t),
  getUser: () => JSON.parse(sessionStorage.getItem('cu_user') || 'null'),
  setUser: (u) => sessionStorage.setItem('cu_user', JSON.stringify(u)),
  clear: () => { sessionStorage.removeItem('cu_token'); sessionStorage.removeItem('cu_user'); }
};

// ===== HTTP HELPERS =====
async function apiFetch(path, options = {}) {
  const token = Auth.getToken();
  const headers = { 'Content-Type': 'application/json', ...(options.headers || {}) };
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const res = await fetch(API + path, { ...options, headers });
  const data = await res.json().catch(() => ({}));

  if (!res.ok) throw new Error(data.error || `Request failed (${res.status})`);
  return data;
}

// ===== DEPARTMENTS =====
const DEPARTMENTS = {
  CST:  ['Computer Science', 'Mathematics', 'Physics', 'Chemistry', 'Biochemistry',
         'Microbiology', 'Industrial Chemistry', 'Biological Sciences',
         'Architecture', 'Building Technology'],
  COE:  ['Civil Engineering', 'Electrical & Electronics Engineering', 'Mechanical Engineering',
         'Chemical Engineering', 'Petroleum Engineering',
         'Information & Communication Engineering', 'Computer Engineering'],
  CMSS: ['Accounting', 'Banking & Finance', 'Business Administration', 'Economics',
         'Mass Communication', 'Industrial Relations', 'Sociology',
         'Political Science'],
  CLDS: ['General Studies', 'Philosophy', 'Christian Religious Studies',
         'History & International Studies', 'Psychology', 'International Relations',
         'English'],
  STAFF: ['Registry', 'Bursary', 'ICT Services', 'Library', 'Student Affairs',
          'Security', 'Facilities Management', 'Academic Affairs',
          'Research & Development', 'Other']
};

// ===== AUTH UI =====
function switchTab(tab) {
  document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
  document.getElementById('signinForm').classList.add('hidden');
  document.getElementById('signupForm').classList.add('hidden');
  clearMessages();

  if (tab === 'signin') {
    document.getElementById('signinForm').classList.remove('hidden');
    document.querySelectorAll('.tab-btn')[0].classList.add('active');
  } else {
    document.getElementById('signupForm').classList.remove('hidden');
    document.querySelectorAll('.tab-btn')[1].classList.add('active');
  }
}

function clearMessages() {
  ['signinError','signupError','signupSuccess','reportMsg'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.textContent = '';
  });
}

function updateEmailHint() {
  const type = document.getElementById('userType').value;
  const hints = {
    student: 'format: firstinitialsurname.matricno@stu.cu.edu.ng  e.g. pihinose.2303882@stu.cu.edu.ng',
    postgrad: 'format: firstinitialsurname.matricno@pg.cu.edu.ng',
    staff: 'format: firstname.lastname@cu.edu.ng'
  };
  document.getElementById('emailHint').textContent = `(${hints[type]})`;
  populateDepartments();
}

function populateDepartments() {
  const college = document.getElementById('signupCollege').value;
  const deptSelect = document.getElementById('signupDepartment');
  deptSelect.innerHTML = '<option value="">-- Select Department --</option>';
  if (college && DEPARTMENTS[college]) {
    DEPARTMENTS[college].forEach(d => {
      const opt = document.createElement('option');
      opt.value = d; opt.textContent = d;
      deptSelect.appendChild(opt);
    });
  }
}

// ===== SIGN UP =====
async function signUp() {
  const firstName = document.getElementById('signupFirstName').value.trim();
  const surname   = document.getElementById('signupSurname').value.trim();
  const college   = document.getElementById('signupCollege').value;
  const department = document.getElementById('signupDepartment').value;
  const email     = document.getElementById('signupEmail').value.trim();
  const password  = document.getElementById('signupPassword').value;
  const confirm   = document.getElementById('signupConfirm').value;
  const userType  = document.getElementById('userType').value;
  const errEl = document.getElementById('signupError');
  const okEl  = document.getElementById('signupSuccess');

  errEl.textContent = ''; okEl.textContent = '';

  if (!firstName || !surname) return (errEl.textContent = 'Please enter your first name and surname.');
  if (!college)     return (errEl.textContent = 'Please select your college.');
  if (!department)  return (errEl.textContent = 'Please select your department.');
  if (!email)       return (errEl.textContent = 'Please enter your school email.');
  if (password.length < 6) return (errEl.textContent = 'Password must be at least 6 characters.');
  if (password !== confirm) return (errEl.textContent = 'Passwords do not match.');

  const btn = document.querySelector('#signupForm .btn-primary');
  btn.disabled = true; btn.textContent = 'Creating account...';

  try {
    await apiFetch('/auth/signup', {
      method: 'POST',
      body: JSON.stringify({ firstName, surname, college, department, email, password, userType })
    });
    okEl.textContent = 'Account created successfully! You can now sign in.';
    ['signupFirstName','signupSurname','signupEmail','signupPassword','signupConfirm'].forEach(id => {
      document.getElementById(id).value = '';
    });
    document.getElementById('signupCollege').value = '';
    document.getElementById('signupDepartment').innerHTML = '<option value="">-- Select Department --</option>';
  } catch (err) {
    errEl.textContent = err.message;
  } finally {
    btn.disabled = false; btn.textContent = 'Create Account';
  }
}

// ===== SIGN IN =====
async function signIn() {
  const email   = document.getElementById('signinEmail').value.trim();
  const password = document.getElementById('signinPassword').value;
  const isAdmin = document.getElementById('adminLogin').checked;
  const errEl   = document.getElementById('signinError');
  errEl.textContent = '';

  if (!email || !password) return (errEl.textContent = 'Please enter your email and password.');

  const btn = document.querySelector('#signinForm .btn-primary');
  btn.disabled = true; btn.textContent = 'Signing in...';

  try {
    const data = await apiFetch('/auth/signin', {
      method: 'POST',
      body: JSON.stringify({ email, password, isAdmin })
    });

    Auth.setToken(data.token);
    Auth.setUser(data.user);

    if (data.user.isAdmin) {
      showPage('adminPage');
      loadAdminStats();
      renderAdminUsers();
      renderAdminItems();
      renderAdminLogs();
    } else {
      showPage('appPage');
      document.getElementById('navUser').textContent = `${data.user.firstName} ${data.user.surname}`;
      showSection('board');
    }
  } catch (err) {
    errEl.textContent = err.message;
  } finally {
    btn.disabled = false; btn.textContent = 'Sign In';
  }
}

function logout() {
  Auth.clear();
  showPage('authPage');
  switchTab('signin');
  document.getElementById('signinEmail').value = '';
  document.getElementById('signinPassword').value = '';
  document.getElementById('adminLogin').checked = false;
}

// ===== PAGE / SECTION NAVIGATION =====
function showPage(pageId) {
  document.querySelectorAll('.page').forEach(p => {
    p.classList.remove('active');
    p.classList.add('hidden');
  });
  const page = document.getElementById(pageId);
  page.classList.remove('hidden');
  page.classList.add('active');
}

function showSection(sectionId) {
  document.querySelectorAll('#appPage .section').forEach(s => {
    s.classList.remove('active');
    s.classList.add('hidden');
  });
  document.querySelectorAll('.nav-links .nav-btn').forEach(b => b.classList.remove('active'));

  const section = document.getElementById(sectionId + 'Section');
  section.classList.remove('hidden');
  section.classList.add('active');

  const map = { board: 0, report: 1, profile: 2 };
  const btns = document.querySelectorAll('.nav-links .nav-btn');
  if (map[sectionId] !== undefined) btns[map[sectionId]].classList.add('active');

  if (sectionId === 'board')   renderBoard();
  if (sectionId === 'profile') renderProfile();
  if (sectionId === 'report')  document.getElementById('itemDate').value = new Date().toISOString().split('T')[0];
}

// ===== BOARD =====
let boardDebounce = null;
function renderBoard() {
  clearTimeout(boardDebounce);
  boardDebounce = setTimeout(_renderBoard, 250);
}

async function _renderBoard() {
  const grid = document.getElementById('itemsGrid');
  const status = document.getElementById('filterStatus').value;
  const search = document.getElementById('filterSearch').value.trim();

  grid.innerHTML = `<div class="empty-state"><div class="empty-icon">⏳</div><p>Loading items...</p></div>`;

  try {
    const params = new URLSearchParams();
    if (status !== 'all') params.set('status', status);
    if (search) params.set('search', search);

    const data = await apiFetch(`/items?${params}`);
    const items = data.items;

    if (!items.length) {
      grid.innerHTML = `<div class="empty-state"><div class="empty-icon">🔍</div><p>No items found.</p></div>`;
      return;
    }

    grid.innerHTML = items.map(item => `
      <div class="item-card ${item.status}" onclick="openItemModal(${item.id})">
        <div class="item-card-header">
          <div class="item-card-title">${escHtml(item.name)}</div>
          <span class="badge badge-${item.status}">${item.status}</span>
        </div>
        <div class="item-card-meta">📂 ${escHtml(item.category)} &nbsp;|&nbsp; 📍 ${escHtml(item.location)}</div>
        <div class="item-card-meta">📅 ${formatDate(item.item_date)}</div>
        <div class="item-card-desc">${escHtml(item.description.substring(0, 100))}${item.description.length > 100 ? '...' : ''}</div>
      </div>
    `).join('');
  } catch (err) {
    grid.innerHTML = `<div class="empty-state"><div class="empty-icon">⚠️</div><p>${escHtml(err.message)}</p></div>`;
  }
}

// ===== ITEM MODAL =====
async function openItemModal(itemId) {
  const modal = document.getElementById('itemModal');
  const body  = document.getElementById('modalBody');
  body.innerHTML = `<div style="text-align:center;padding:2rem;color:var(--cu-gray)">Loading...</div>`;
  modal.classList.remove('hidden');

  try {
    // Fetch fresh item list and find by id
    const data = await apiFetch('/items');
    const item = data.items.find(i => i.id === itemId);
    if (!item) throw new Error('Item not found.');

    const user = Auth.getUser();
    const canClaim = item.status === 'found' && item.reported_by !== user.id && !item.claimed_by;

    body.innerHTML = `
      <div class="modal-title">${escHtml(item.name)}</div>
      <span class="badge badge-${item.status}" style="margin-bottom:1rem;display:inline-block">${item.status.toUpperCase()}</span>
      <div class="modal-row"><span class="modal-label">Category:</span><span class="modal-value">${escHtml(item.category)}</span></div>
      <div class="modal-row"><span class="modal-label">Location:</span><span class="modal-value">${escHtml(item.location)}</span></div>
      <div class="modal-row"><span class="modal-label">Date:</span><span class="modal-value">${formatDate(item.item_date)}</span></div>
      <div class="modal-row"><span class="modal-label">Description:</span><span class="modal-value">${escHtml(item.description)}</span></div>
      <div class="modal-row"><span class="modal-label">Reported by:</span><span class="modal-value">${escHtml(item.reporter_name)}</span></div>
      ${item.contact ? `<div class="modal-row"><span class="modal-label">Contact:</span><span class="modal-value">${escHtml(item.contact)}</span></div>` : ''}
      ${item.claimed_by ? `<div class="modal-row"><span class="modal-label">Claimed by:</span><span class="modal-value">${escHtml(item.claimed_by)}</span></div>` : ''}
      ${canClaim ? `<button class="claim-btn" id="claimBtn" onclick="claimItem(${item.id})">Mark as Claimed by Me</button>` : ''}
      ${item.status === 'claimed' ? `<p style="color:var(--cu-gold);font-weight:600;margin-top:1rem;">✓ This item has been claimed.</p>` : ''}
    `;
  } catch (err) {
    body.innerHTML = `<p style="color:var(--cu-danger)">${escHtml(err.message)}</p>`;
  }
}

async function claimItem(itemId) {
  const btn = document.getElementById('claimBtn');
  if (btn) { btn.disabled = true; btn.textContent = 'Claiming...'; }
  try {
    await apiFetch(`/items/${itemId}/claim`, { method: 'PATCH' });
    closeModal();
    renderBoard();
  } catch (err) {
    alert(err.message);
    if (btn) { btn.disabled = false; btn.textContent = 'Mark as Claimed by Me'; }
  }
}

function closeModal() {
  document.getElementById('itemModal').classList.add('hidden');
}

// ===== REPORT ITEM =====
async function submitItem() {
  const name        = document.getElementById('itemName').value.trim();
  const status      = document.getElementById('itemStatus').value;
  const category    = document.getElementById('itemCategory').value;
  const location    = document.getElementById('itemLocation').value.trim();
  const description = document.getElementById('itemDescription').value.trim();
  const itemDate    = document.getElementById('itemDate').value;
  const contact     = document.getElementById('itemContact').value.trim();
  const msgEl       = document.getElementById('reportMsg');

  msgEl.textContent = ''; msgEl.style.color = '';

  if (!name)        return (msgEl.textContent = 'Please enter the item name.');
  if (!location)    return (msgEl.textContent = 'Please enter the location.');
  if (!description) return (msgEl.textContent = 'Please add a description.');
  if (!itemDate)    return (msgEl.textContent = 'Please select a date.');

  const btn = document.querySelector('#reportSection .btn-primary');
  btn.disabled = true; btn.textContent = 'Submitting...';

  try {
    await apiFetch('/items', {
      method: 'POST',
      body: JSON.stringify({ name, status, category, location, description, itemDate, contact })
    });
    msgEl.textContent = `Item reported successfully as "${status.toUpperCase()}".`;
    msgEl.style.color = 'var(--cu-success)';
    ['itemName','itemLocation','itemDescription','itemContact'].forEach(id => {
      document.getElementById(id).value = '';
    });
    document.getElementById('itemDate').value = new Date().toISOString().split('T')[0];
  } catch (err) {
    msgEl.textContent = err.message;
    msgEl.style.color = 'var(--cu-danger)';
  } finally {
    btn.disabled = false; btn.textContent = 'Submit Report';
  }
}

// ===== PROFILE =====
async function renderProfile() {
  const user = Auth.getUser();
  const collegeNames = {
    CST:  'College of Science & Technology',
    COE:  'College of Engineering',
    CMSS: 'College of Management & Social Sciences',
    CLDS: 'College of Leadership Development Studies',
    STAFF: 'Staff / Administration'
  };

  document.getElementById('profileCard').innerHTML = `
    <div class="profile-row"><span class="profile-label">Full Name</span><span class="profile-value">${escHtml(user.firstName)} ${escHtml(user.surname)}</span></div>
    <div class="profile-row"><span class="profile-label">Email</span><span class="profile-value">${escHtml(user.email)}</span></div>
    <div class="profile-row"><span class="profile-label">User Type</span><span class="profile-value">${capitalize(user.userType)}</span></div>
    <div class="profile-row"><span class="profile-label">College</span><span class="profile-value">${escHtml(collegeNames[user.college] || user.college)}</span></div>
    <div class="profile-row"><span class="profile-label">Department</span><span class="profile-value">${escHtml(user.department)}</span></div>
    <div class="profile-row"><span class="profile-label">Registered</span><span class="profile-value">${formatDateTime(user.registeredAt)}</span></div>
  `;

  const myGrid = document.getElementById('myItems');
  myGrid.innerHTML = `<div class="empty-state"><div class="empty-icon">⏳</div><p>Loading...</p></div>`;

  try {
    const data = await apiFetch('/items/mine');
    const items = data.items;
    if (!items.length) {
      myGrid.innerHTML = `<div class="empty-state"><div class="empty-icon">📋</div><p>You haven't reported any items yet.</p></div>`;
      return;
    }
    myGrid.innerHTML = items.map(item => `
      <div class="item-card ${item.status}" onclick="openItemModal(${item.id})">
        <div class="item-card-header">
          <div class="item-card-title">${escHtml(item.name)}</div>
          <span class="badge badge-${item.status}">${item.status}</span>
        </div>
        <div class="item-card-meta">📂 ${escHtml(item.category)} &nbsp;|&nbsp; 📍 ${escHtml(item.location)}</div>
        <div class="item-card-meta">📅 ${formatDate(item.item_date)}</div>
        <div class="item-card-desc">${escHtml(item.description.substring(0, 100))}${item.description.length > 100 ? '...' : ''}</div>
      </div>
    `).join('');
  } catch (err) {
    myGrid.innerHTML = `<div class="empty-state"><div class="empty-icon">⚠️</div><p>${escHtml(err.message)}</p></div>`;
  }
}

// ===== ADMIN =====
function showAdminTab(tab) {
  document.querySelectorAll('.admin-tab').forEach(t => {
    t.classList.remove('active'); t.classList.add('hidden');
  });
  document.querySelectorAll('.admin-nav .nav-links .nav-btn').forEach(b => b.classList.remove('active'));

  const tabEl = document.getElementById('admin' + capitalize(tab));
  tabEl.classList.remove('hidden'); tabEl.classList.add('active');

  const tabMap = { users: 0, items: 1, logs: 2 };
  const btns = document.querySelectorAll('.admin-nav .nav-links .nav-btn');
  if (btns[tabMap[tab]]) btns[tabMap[tab]].classList.add('active');

  if (tab === 'users') renderAdminUsers();
  if (tab === 'items') renderAdminItems();
  if (tab === 'logs')  renderAdminLogs();
}

async function loadAdminStats() {
  try {
    const s = await apiFetch('/admin/stats');
    const statsEl = document.getElementById('adminStatsRow');
    if (!statsEl) return;
    statsEl.innerHTML = `
      <div class="stat-card"><div class="stat-number">${s.totalUsers}</div><div class="stat-label">Registered Users</div></div>
      <div class="stat-card"><div class="stat-number">${s.totalItems}</div><div class="stat-label">Total Items</div></div>
      <div class="stat-card"><div class="stat-number" style="color:var(--cu-danger)">${s.lostItems}</div><div class="stat-label">Lost Items</div></div>
      <div class="stat-card"><div class="stat-number" style="color:var(--cu-success)">${s.foundItems}</div><div class="stat-label">Found Items</div></div>
      <div class="stat-card"><div class="stat-number" style="color:#b8860b">${s.claimedItems}</div><div class="stat-label">Claimed Items</div></div>
      <div class="stat-card"><div class="stat-number">${s.totalLogins}</div><div class="stat-label">Total Logins</div></div>
    `;
  } catch (_) {}
}

async function renderAdminUsers() {
  const search = (document.getElementById('userSearch')?.value || '').trim();
  const tbody = document.getElementById('usersTableBody');
  tbody.innerHTML = `<tr><td colspan="8" style="text-align:center;padding:1.5rem;color:var(--cu-gray)">Loading...</td></tr>`;

  try {
    const params = search ? `?search=${encodeURIComponent(search)}` : '';
    const data = await apiFetch(`/admin/users${params}`);
    const users = data.users;

    if (!users.length) {
      tbody.innerHTML = `<tr><td colspan="8" style="text-align:center;padding:2rem;color:var(--cu-gray)">No users found.</td></tr>`;
      return;
    }

    tbody.innerHTML = users.map((u, i) => `
      <tr>
        <td>${i + 1}</td>
        <td>${escHtml(u.first_name)}</td>
        <td>${escHtml(u.surname)}</td>
        <td>${escHtml(u.email)}</td>
        <td><span class="badge ${u.user_type === 'staff' ? 'badge-found' : u.user_type === 'postgrad' ? 'badge-claimed' : 'badge-lost'}">${capitalize(u.user_type)}</span></td>
        <td>${escHtml(u.college)}</td>
        <td>${escHtml(u.department)}</td>
        <td>${formatDateTime(u.registered_at)}</td>
      </tr>
    `).join('');
  } catch (err) {
    tbody.innerHTML = `<tr><td colspan="8" style="text-align:center;color:var(--cu-danger);padding:1.5rem">${escHtml(err.message)}</td></tr>`;
  }
}

async function renderAdminItems() {
  const search = (document.getElementById('itemSearch')?.value || '').trim();
  const tbody = document.getElementById('itemsTableBody');
  tbody.innerHTML = `<tr><td colspan="8" style="text-align:center;padding:1.5rem;color:var(--cu-gray)">Loading...</td></tr>`;

  try {
    const params = search ? `?search=${encodeURIComponent(search)}` : '';
    const data = await apiFetch(`/admin/items${params}`);
    const items = data.items;

    if (!items.length) {
      tbody.innerHTML = `<tr><td colspan="8" style="text-align:center;padding:2rem;color:var(--cu-gray)">No items found.</td></tr>`;
      return;
    }

    tbody.innerHTML = items.map((item, i) => `
      <tr>
        <td>${i + 1}</td>
        <td>${escHtml(item.name)}</td>
        <td><span class="badge badge-${item.status}">${item.status}</span></td>
        <td>${escHtml(item.category)}</td>
        <td>${escHtml(item.location)}</td>
        <td>${escHtml(item.reporter_name)}</td>
        <td>${formatDate(item.item_date)}</td>
        <td>
          ${item.status !== 'claimed' ? `<button class="btn-sm btn-resolve" onclick="adminResolve(${item.id})">Resolve</button> ` : ''}
          <button class="btn-sm btn-delete" onclick="adminDeleteItem(${item.id})">Delete</button>
        </td>
      </tr>
    `).join('');
  } catch (err) {
    tbody.innerHTML = `<tr><td colspan="8" style="text-align:center;color:var(--cu-danger);padding:1.5rem">${escHtml(err.message)}</td></tr>`;
  }
}

async function renderAdminLogs() {
  const tbody = document.getElementById('logsTableBody');
  tbody.innerHTML = `<tr><td colspan="5" style="text-align:center;padding:1.5rem;color:var(--cu-gray)">Loading...</td></tr>`;

  try {
    const data = await apiFetch('/admin/logs');
    const logs = data.logs;

    if (!logs.length) {
      tbody.innerHTML = `<tr><td colspan="5" style="text-align:center;padding:2rem;color:var(--cu-gray)">No login activity yet.</td></tr>`;
      return;
    }

    tbody.innerHTML = logs.map((log, i) => `
      <tr>
        <td>${i + 1}</td>
        <td>${escHtml(log.email)}</td>
        <td>${escHtml(log.name)}</td>
        <td><span class="badge ${log.user_type === 'admin' ? 'badge-lost' : log.user_type === 'staff' ? 'badge-found' : 'badge-claimed'}">${capitalize(log.user_type)}</span></td>
        <td>${formatDateTime(log.login_time)}</td>
      </tr>
    `).join('');
  } catch (err) {
    tbody.innerHTML = `<tr><td colspan="5" style="text-align:center;color:var(--cu-danger);padding:1.5rem">${escHtml(err.message)}</td></tr>`;
  }
}

async function adminResolve(itemId) {
  try {
    await apiFetch(`/admin/items/${itemId}/resolve`, { method: 'PATCH' });
    renderAdminItems();
    loadAdminStats();
  } catch (err) { alert(err.message); }
}

async function adminDeleteItem(itemId) {
  if (!confirm('Are you sure you want to delete this item?')) return;
  try {
    await apiFetch(`/admin/items/${itemId}`, { method: 'DELETE' });
    renderAdminItems();
    loadAdminStats();
  } catch (err) { alert(err.message); }
}

// ===== UTILITIES =====
function escHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;')
    .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function capitalize(str) {
  if (!str) return '';
  return str.charAt(0).toUpperCase() + str.slice(1);
}

function formatDate(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr + (dateStr.includes('T') ? '' : 'T00:00:00'));
  return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

function formatDateTime(isoStr) {
  if (!isoStr) return '';
  const d = new Date(isoStr);
  return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) +
    ' ' + d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
}

// Close modal on backdrop click
document.getElementById('itemModal').addEventListener('click', function(e) {
  if (e.target === this) closeModal();
});

// ===== SHOW / HIDE PASSWORD =====
function togglePw(inputId, btn) {
  const input = document.getElementById(inputId);
  if (input.type === 'password') {
    input.type = 'text';
    btn.textContent = 'Hide';
  } else {
    input.type = 'password';
    btn.textContent = 'Show';
  }
}

// ===== INIT =====
(function init() {
  const token = Auth.getToken();
  const user  = Auth.getUser();

  if (token && user) {
    if (user.isAdmin) {
      showPage('adminPage');
      loadAdminStats();
      renderAdminUsers();
      renderAdminItems();
      renderAdminLogs();
    } else {
      showPage('appPage');
      document.getElementById('navUser').textContent = `${user.firstName} ${user.surname}`;
      showSection('board');
    }
  } else {
    showPage('authPage');
  }
})();
