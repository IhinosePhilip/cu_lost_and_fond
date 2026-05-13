// ===== DATA STORE =====
const DB = {
  get users() { return JSON.parse(localStorage.getItem('cu_users') || '[]'); },
  set users(v) { localStorage.setItem('cu_users', JSON.stringify(v)); },

  get items() { return JSON.parse(localStorage.getItem('cu_items') || '[]'); },
  set items(v) { localStorage.setItem('cu_items', JSON.stringify(v)); },

  get logs() { return JSON.parse(localStorage.getItem('cu_logs') || '[]'); },
  set logs(v) { localStorage.setItem('cu_logs', JSON.stringify(v)); },

  get currentUser() { return JSON.parse(sessionStorage.getItem('cu_current') || 'null'); },
  set currentUser(v) { sessionStorage.setItem('cu_current', JSON.stringify(v)); },
};

// Admin credentials (hardcoded)
const ADMIN_EMAIL = 'admin@cu.edu.ng';
const ADMIN_PASSWORD = 'admin1234';

// ===== DEPARTMENTS BY COLLEGE =====
const DEPARTMENTS = {
  CST: [
    'Computer Science', 'Mathematics', 'Physics', 'Chemistry',
    'Biochemistry', 'Microbiology', 'Industrial Chemistry',
    'Statistics', 'Biological Sciences'
  ],
  CENG: [
    'Civil Engineering', 'Electrical & Electronics Engineering',
    'Mechanical Engineering', 'Chemical Engineering',
    'Petroleum Engineering', 'Information & Communication Engineering',
    'Systems Engineering'
  ],
  CBSS: [
    'Accounting', 'Banking & Finance', 'Business Administration',
    'Economics', 'Mass Communication', 'International Relations',
    'Sociology', 'Psychology', 'Political Science'
  ],
  CLDS: [
    'General Studies', 'Philosophy', 'Christian Religious Studies',
    'History & International Studies'
  ],
  CMMS: [
    'Medicine & Surgery', 'Nursing Science', 'Public Health',
    'Medical Laboratory Science', 'Physiotherapy'
  ],
  STAFF: [
    'Registry', 'Bursary', 'ICT Services', 'Library',
    'Student Affairs', 'Security', 'Facilities Management',
    'Academic Affairs', 'Research & Development', 'Other'
  ]
};

// ===== EMAIL VALIDATION =====
function validateEmail(email, userType) {
  email = email.trim().toLowerCase();
  if (userType === 'student') {
    // format: firstname.matricno@stu.cu.edu.ng
    return /^[a-z]+\.\d{7}@stu\.cu\.edu\.ng$/.test(email);
  } else if (userType === 'postgrad') {
    // format: firstname.matricno@pg.cu.edu.ng
    return /^[a-z]+\.\d{7}@pg\.cu\.edu\.ng$/.test(email);
  } else if (userType === 'staff') {
    // format: firstname.lastname@cu.edu.ng
    return /^[a-z]+\.[a-z]+@cu\.edu\.ng$/.test(email);
  }
  return false;
}

function getEmailDomain(userType) {
  if (userType === 'student') return '@stu.cu.edu.ng';
  if (userType === 'postgrad') return '@pg.cu.edu.ng';
  return '@cu.edu.ng';
}

// ===== AUTH FUNCTIONS =====
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
  ['signinError', 'signupError', 'signupSuccess', 'reportMsg'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.textContent = '';
  });
}

function updateEmailHint() {
  const type = document.getElementById('userType').value;
  const hints = {
    student: 'format: firstname.matricno@stu.cu.edu.ng',
    postgrad: 'format: firstname.matricno@pg.cu.edu.ng',
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
      opt.value = d;
      opt.textContent = d;
      deptSelect.appendChild(opt);
    });
  }
}

function signUp() {
  const firstName = document.getElementById('signupFirstName').value.trim();
  const surname = document.getElementById('signupSurname').value.trim();
  const college = document.getElementById('signupCollege').value;
  const department = document.getElementById('signupDepartment').value;
  const email = document.getElementById('signupEmail').value.trim().toLowerCase();
  const password = document.getElementById('signupPassword').value;
  const confirm = document.getElementById('signupConfirm').value;
  const userType = document.getElementById('userType').value;
  const errEl = document.getElementById('signupError');
  const okEl = document.getElementById('signupSuccess');

  errEl.textContent = '';
  okEl.textContent = '';

  if (!firstName || !surname) return (errEl.textContent = 'Please enter your first name and surname.');
  if (!college) return (errEl.textContent = 'Please select your college.');
  if (!department) return (errEl.textContent = 'Please select your department.');
  if (!email) return (errEl.textContent = 'Please enter your school email.');
  if (!validateEmail(email, userType)) {
    return (errEl.textContent = `Invalid email format. Expected: firstname${userType === 'staff' ? '.lastname' : '.matricno'}${getEmailDomain(userType)}`);
  }
  if (password.length < 6) return (errEl.textContent = 'Password must be at least 6 characters.');
  if (password !== confirm) return (errEl.textContent = 'Passwords do not match.');

  const users = DB.users;
  if (users.find(u => u.email === email)) {
    return (errEl.textContent = 'An account with this email already exists.');
  }

  const newUser = {
    id: Date.now().toString(),
    firstName,
    surname,
    college,
    department,
    email,
    password,
    userType,
    registeredAt: new Date().toISOString()
  };

  users.push(newUser);
  DB.users = users;

  okEl.textContent = 'Account created successfully! You can now sign in.';
  // Clear form
  ['signupFirstName','signupSurname','signupEmail','signupPassword','signupConfirm'].forEach(id => {
    document.getElementById(id).value = '';
  });
  document.getElementById('signupCollege').value = '';
  document.getElementById('signupDepartment').innerHTML = '<option value="">-- Select Department --</option>';
}

function signIn() {
  const email = document.getElementById('signinEmail').value.trim().toLowerCase();
  const password = document.getElementById('signinPassword').value;
  const isAdmin = document.getElementById('adminLogin').checked;
  const errEl = document.getElementById('signinError');
  errEl.textContent = '';

  if (!email || !password) return (errEl.textContent = 'Please enter your email and password.');

  // Admin login
  if (isAdmin) {
    if (email === ADMIN_EMAIL && password === ADMIN_PASSWORD) {
      DB.currentUser = { email, isAdmin: true, firstName: 'Admin', surname: '' };
      logLogin({ email, firstName: 'Admin', surname: '', userType: 'admin' });
      showPage('adminPage');
      renderAdminUsers();
      renderAdminItems();
      renderAdminLogs();
      return;
    } else {
      return (errEl.textContent = 'Invalid admin credentials.');
    }
  }

  const users = DB.users;
  const user = users.find(u => u.email === email && u.password === password);
  if (!user) return (errEl.textContent = 'Invalid email or password.');

  DB.currentUser = user;
  logLogin(user);
  showPage('appPage');
  document.getElementById('navUser').textContent = `${user.firstName} ${user.surname}`;
  showSection('board');
  renderBoard();
}

function logout() {
  DB.currentUser = null;
  showPage('authPage');
  switchTab('signin');
  document.getElementById('signinEmail').value = '';
  document.getElementById('signinPassword').value = '';
  document.getElementById('adminLogin').checked = false;
}

function logLogin(user) {
  const logs = DB.logs;
  logs.unshift({
    email: user.email,
    name: `${user.firstName} ${user.surname}`,
    userType: user.userType || 'admin',
    time: new Date().toISOString()
  });
  DB.logs = logs;
}

// ===== PAGE NAVIGATION =====
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
  document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));

  const section = document.getElementById(sectionId + 'Section');
  section.classList.remove('hidden');
  section.classList.add('active');

  // Highlight nav button
  const btns = document.querySelectorAll('.nav-links .nav-btn');
  const map = { board: 0, report: 1, profile: 2 };
  if (map[sectionId] !== undefined) btns[map[sectionId]].classList.add('active');

  if (sectionId === 'board') renderBoard();
  if (sectionId === 'profile') renderProfile();
  if (sectionId === 'report') {
    // Set today's date as default
    document.getElementById('itemDate').value = new Date().toISOString().split('T')[0];
  }
}

// ===== ITEMS =====
function submitItem() {
  const user = DB.currentUser;
  const name = document.getElementById('itemName').value.trim();
  const status = document.getElementById('itemStatus').value;
  const category = document.getElementById('itemCategory').value;
  const location = document.getElementById('itemLocation').value.trim();
  const description = document.getElementById('itemDescription').value.trim();
  const date = document.getElementById('itemDate').value;
  const contact = document.getElementById('itemContact').value.trim();
  const msgEl = document.getElementById('reportMsg');

  msgEl.textContent = '';
  msgEl.style.color = '';

  if (!name) return (msgEl.textContent = 'Please enter the item name.');
  if (!location) return (msgEl.textContent = 'Please enter the location.');
  if (!description) return (msgEl.textContent = 'Please add a description.');
  if (!date) return (msgEl.textContent = 'Please select a date.');

  const items = DB.items;
  items.unshift({
    id: Date.now().toString(),
    name,
    status,
    category,
    location,
    description,
    date,
    contact,
    reportedBy: user.email,
    reporterName: `${user.firstName} ${user.surname}`,
    createdAt: new Date().toISOString(),
    claimedBy: null
  });
  DB.items = items;

  msgEl.textContent = `Item reported successfully as "${status.toUpperCase()}".`;
  msgEl.style.color = 'var(--cu-success)';

  // Clear form
  ['itemName','itemLocation','itemDescription','itemContact'].forEach(id => {
    document.getElementById(id).value = '';
  });
  document.getElementById('itemDate').value = new Date().toISOString().split('T')[0];
}

function renderBoard() {
  const grid = document.getElementById('itemsGrid');
  const filterStatus = document.getElementById('filterStatus').value;
  const search = document.getElementById('filterSearch').value.toLowerCase();

  let items = DB.items;
  if (filterStatus !== 'all') items = items.filter(i => i.status === filterStatus);
  if (search) items = items.filter(i =>
    i.name.toLowerCase().includes(search) ||
    i.description.toLowerCase().includes(search) ||
    i.location.toLowerCase().includes(search) ||
    i.category.toLowerCase().includes(search)
  );

  if (items.length === 0) {
    grid.innerHTML = `<div class="empty-state"><div class="empty-icon">🔍</div><p>No items found.</p></div>`;
    return;
  }

  grid.innerHTML = items.map(item => `
    <div class="item-card ${item.status}" onclick="openItemModal('${item.id}')">
      <div class="item-card-header">
        <div class="item-card-title">${escHtml(item.name)}</div>
        <span class="badge badge-${item.status}">${item.status}</span>
      </div>
      <div class="item-card-meta">📂 ${escHtml(item.category)} &nbsp;|&nbsp; 📍 ${escHtml(item.location)}</div>
      <div class="item-card-meta">📅 ${formatDate(item.date)}</div>
      <div class="item-card-desc">${escHtml(item.description.substring(0, 100))}${item.description.length > 100 ? '...' : ''}</div>
    </div>
  `).join('');
}

function openItemModal(itemId) {
  const item = DB.items.find(i => i.id === itemId);
  if (!item) return;
  const user = DB.currentUser;
  const canClaim = item.status === 'found' && item.reportedBy !== user.email && !item.claimedBy;

  document.getElementById('modalBody').innerHTML = `
    <div class="modal-title">${escHtml(item.name)}</div>
    <span class="badge badge-${item.status}" style="margin-bottom:1rem;display:inline-block">${item.status.toUpperCase()}</span>
    <div class="modal-row"><span class="modal-label">Category:</span><span class="modal-value">${escHtml(item.category)}</span></div>
    <div class="modal-row"><span class="modal-label">Location:</span><span class="modal-value">${escHtml(item.location)}</span></div>
    <div class="modal-row"><span class="modal-label">Date:</span><span class="modal-value">${formatDate(item.date)}</span></div>
    <div class="modal-row"><span class="modal-label">Description:</span><span class="modal-value">${escHtml(item.description)}</span></div>
    <div class="modal-row"><span class="modal-label">Reported by:</span><span class="modal-value">${escHtml(item.reporterName)}</span></div>
    ${item.contact ? `<div class="modal-row"><span class="modal-label">Contact:</span><span class="modal-value">${escHtml(item.contact)}</span></div>` : ''}
    ${item.claimedBy ? `<div class="modal-row"><span class="modal-label">Claimed by:</span><span class="modal-value">${escHtml(item.claimedBy)}</span></div>` : ''}
    ${canClaim ? `<button class="claim-btn" onclick="claimItem('${item.id}')">Mark as Claimed by Me</button>` : ''}
    ${item.status === 'claimed' ? `<p style="color:var(--cu-gold);font-weight:600;margin-top:1rem;">✓ This item has been claimed.</p>` : ''}
  `;
  document.getElementById('itemModal').classList.remove('hidden');
}

function claimItem(itemId) {
  const user = DB.currentUser;
  const items = DB.items;
  const idx = items.findIndex(i => i.id === itemId);
  if (idx === -1) return;
  items[idx].status = 'claimed';
  items[idx].claimedBy = `${user.firstName} ${user.surname} (${user.email})`;
  DB.items = items;
  closeModal();
  renderBoard();
}

function closeModal() {
  document.getElementById('itemModal').classList.add('hidden');
}

// ===== PROFILE =====
function renderProfile() {
  const user = DB.currentUser;
  const collegeNames = {
    CST: 'College of Science & Technology',
    CENG: 'College of Engineering',
    CBSS: 'College of Business & Social Sciences',
    CLDS: 'College of Leadership Development Studies',
    CMMS: 'College of Medicine & Health Sciences',
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

  // My items
  const myItems = DB.items.filter(i => i.reportedBy === user.email);
  const myGrid = document.getElementById('myItems');
  if (myItems.length === 0) {
    myGrid.innerHTML = `<div class="empty-state"><div class="empty-icon">📋</div><p>You haven't reported any items yet.</p></div>`;
    return;
  }
  myGrid.innerHTML = myItems.map(item => `
    <div class="item-card ${item.status}" onclick="openItemModal('${item.id}')">
      <div class="item-card-header">
        <div class="item-card-title">${escHtml(item.name)}</div>
        <span class="badge badge-${item.status}">${item.status}</span>
      </div>
      <div class="item-card-meta">📂 ${escHtml(item.category)} &nbsp;|&nbsp; 📍 ${escHtml(item.location)}</div>
      <div class="item-card-meta">📅 ${formatDate(item.date)}</div>
      <div class="item-card-desc">${escHtml(item.description.substring(0, 100))}${item.description.length > 100 ? '...' : ''}</div>
    </div>
  `).join('');
}

// ===== ADMIN =====
function showAdminTab(tab) {
  document.querySelectorAll('.admin-tab').forEach(t => {
    t.classList.remove('active');
    t.classList.add('hidden');
  });
  document.querySelectorAll('.admin-nav .nav-btn').forEach(b => b.classList.remove('active'));

  document.getElementById('admin' + capitalize(tab)).classList.remove('hidden');
  document.getElementById('admin' + capitalize(tab)).classList.add('active');

  const tabMap = { users: 0, items: 1, logs: 2 };
  const btns = document.querySelectorAll('.admin-nav .nav-links .nav-btn');
  if (btns[tabMap[tab]]) btns[tabMap[tab]].classList.add('active');

  if (tab === 'users') renderAdminUsers();
  if (tab === 'items') renderAdminItems();
  if (tab === 'logs') renderAdminLogs();
}

function renderAdminUsers() {
  const search = (document.getElementById('userSearch')?.value || '').toLowerCase();
  let users = DB.users;
  if (search) users = users.filter(u =>
    u.firstName.toLowerCase().includes(search) ||
    u.surname.toLowerCase().includes(search) ||
    u.email.toLowerCase().includes(search) ||
    u.department.toLowerCase().includes(search)
  );

  const tbody = document.getElementById('usersTableBody');
  if (users.length === 0) {
    tbody.innerHTML = `<tr><td colspan="8" style="text-align:center;color:var(--cu-gray);padding:2rem">No users found.</td></tr>`;
    return;
  }

  tbody.innerHTML = users.map((u, i) => `
    <tr>
      <td>${i + 1}</td>
      <td>${escHtml(u.firstName)}</td>
      <td>${escHtml(u.surname)}</td>
      <td>${escHtml(u.email)}</td>
      <td><span class="badge ${u.userType === 'staff' ? 'badge-found' : u.userType === 'postgrad' ? 'badge-claimed' : 'badge-lost'}">${capitalize(u.userType)}</span></td>
      <td>${escHtml(u.college)}</td>
      <td>${escHtml(u.department)}</td>
      <td>${formatDateTime(u.registeredAt)}</td>
    </tr>
  `).join('');
}

function renderAdminItems() {
  const search = (document.getElementById('itemSearch')?.value || '').toLowerCase();
  let items = DB.items;
  if (search) items = items.filter(i =>
    i.name.toLowerCase().includes(search) ||
    i.location.toLowerCase().includes(search) ||
    i.category.toLowerCase().includes(search) ||
    i.reporterName.toLowerCase().includes(search)
  );

  const tbody = document.getElementById('itemsTableBody');
  if (items.length === 0) {
    tbody.innerHTML = `<tr><td colspan="8" style="text-align:center;color:var(--cu-gray);padding:2rem">No items found.</td></tr>`;
    return;
  }

  tbody.innerHTML = items.map((item, i) => `
    <tr>
      <td>${i + 1}</td>
      <td>${escHtml(item.name)}</td>
      <td><span class="badge badge-${item.status}">${item.status}</span></td>
      <td>${escHtml(item.category)}</td>
      <td>${escHtml(item.location)}</td>
      <td>${escHtml(item.reporterName)}</td>
      <td>${formatDate(item.date)}</td>
      <td>
        ${item.status !== 'claimed' ? `<button class="btn-sm btn-resolve" onclick="adminResolve('${item.id}')">Resolve</button>` : ''}
        <button class="btn-sm btn-delete" onclick="adminDeleteItem('${item.id}')">Delete</button>
      </td>
    </tr>
  `).join('');
}

function renderAdminLogs() {
  const logs = DB.logs;
  const tbody = document.getElementById('logsTableBody');
  if (logs.length === 0) {
    tbody.innerHTML = `<tr><td colspan="5" style="text-align:center;color:var(--cu-gray);padding:2rem">No login activity yet.</td></tr>`;
    return;
  }
  tbody.innerHTML = logs.map((log, i) => `
    <tr>
      <td>${i + 1}</td>
      <td>${escHtml(log.email)}</td>
      <td>${escHtml(log.name)}</td>
      <td><span class="badge ${log.userType === 'admin' ? 'badge-lost' : log.userType === 'staff' ? 'badge-found' : 'badge-claimed'}">${capitalize(log.userType)}</span></td>
      <td>${formatDateTime(log.time)}</td>
    </tr>
  `).join('');
}

function adminResolve(itemId) {
  const items = DB.items;
  const idx = items.findIndex(i => i.id === itemId);
  if (idx !== -1) {
    items[idx].status = 'claimed';
    items[idx].claimedBy = 'Resolved by Admin';
    DB.items = items;
    renderAdminItems();
  }
}

function adminDeleteItem(itemId) {
  if (!confirm('Are you sure you want to delete this item?')) return;
  DB.items = DB.items.filter(i => i.id !== itemId);
  renderAdminItems();
}

// ===== UTILITIES =====
function escHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function capitalize(str) {
  if (!str) return '';
  return str.charAt(0).toUpperCase() + str.slice(1);
}

function formatDate(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr + 'T00:00:00');
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

// ===== INIT =====
(function init() {
  // Seed admin account hint in console
  console.log('Admin login: admin@cu.edu.ng / admin1234');

  // Check if user was already logged in this session
  const user = DB.currentUser;
  if (user) {
    if (user.isAdmin) {
      showPage('adminPage');
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
