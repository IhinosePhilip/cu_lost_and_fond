const express = require('express');
const Database = require('better-sqlite3');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const cors = require('cors');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'cu-lost-found-dev-secret';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'admin1234';

// ===== MIDDLEWARE =====
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// ===== DATABASE SETUP =====
// On Render, use /data (persistent disk mount). Locally use project root.
const DB_DIR = process.env.DB_PATH || __dirname;
if (!fs.existsSync(DB_DIR)) fs.mkdirSync(DB_DIR, { recursive: true });
const db = new Database(path.join(DB_DIR, 'cu_lostfound.db'));

// Enable WAL mode for better performance
db.pragma('journal_mode = WAL');

// Create tables
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    first_name TEXT NOT NULL,
    surname TEXT NOT NULL,
    email TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL,
    user_type TEXT NOT NULL CHECK(user_type IN ('student','postgrad','staff')),
    college TEXT NOT NULL,
    department TEXT NOT NULL,
    registered_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    status TEXT NOT NULL CHECK(status IN ('lost','found','claimed')),
    category TEXT NOT NULL,
    location TEXT NOT NULL,
    description TEXT NOT NULL,
    item_date TEXT NOT NULL,
    contact TEXT,
    reported_by INTEGER NOT NULL,
    reporter_name TEXT NOT NULL,
    claimed_by TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (reported_by) REFERENCES users(id)
  );

  CREATE TABLE IF NOT EXISTS login_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    email TEXT NOT NULL,
    name TEXT NOT NULL,
    user_type TEXT NOT NULL,
    login_time TEXT NOT NULL DEFAULT (datetime('now'))
  );
`);

// ===== AUTH MIDDLEWARE =====
function authMiddleware(req, res, next) {
  const authHeader = req.headers['authorization'];
  if (!authHeader) return res.status(401).json({ error: 'No token provided' });
  const token = authHeader.split(' ')[1];
  try {
    req.user = jwt.verify(token, JWT_SECRET);
    next();
  } catch {
    res.status(401).json({ error: 'Invalid or expired token' });
  }
}

function adminMiddleware(req, res, next) {
  authMiddleware(req, res, () => {
    if (!req.user.isAdmin) return res.status(403).json({ error: 'Admin access required' });
    next();
  });
}

// ===== EMAIL VALIDATION =====
// Format: first initial + surname + matric no  e.g. pihinose.2303882@stu.cu.edu.ng
function validateCUEmail(email, userType) {
  email = email.trim().toLowerCase();
  if (userType === 'student') return /^[a-z]{2,}[a-z]+\.\d{7}@stu\.cu\.edu\.ng$/.test(email);
  if (userType === 'postgrad') return /^[a-z]{2,}[a-z]+\.\d{7}@pg\.cu\.edu\.ng$/.test(email);
  if (userType === 'staff')   return /^[a-z]+\.[a-z]+@cu\.edu\.ng$/.test(email);
  return false;
}

// ===== AUTH ROUTES =====

// POST /api/auth/signup
app.post('/api/auth/signup', async (req, res) => {
  try {
    const { firstName, surname, college, department, email, password, userType } = req.body;

    if (!firstName || !surname || !college || !department || !email || !password || !userType) {
      return res.status(400).json({ error: 'All fields are required.' });
    }

    const cleanEmail = email.trim().toLowerCase();

    if (!validateCUEmail(cleanEmail, userType)) {
      const formats = {
        student: 'firstinitialsurname.matricno@stu.cu.edu.ng  (e.g. pihinose.2303882@stu.cu.edu.ng)',
        postgrad: 'firstinitialsurname.matricno@pg.cu.edu.ng',
        staff: 'firstname.lastname@cu.edu.ng'
      };
      return res.status(400).json({ error: `Invalid email format. Expected: ${formats[userType]}` });
    }

    if (password.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters.' });
    }

    const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(cleanEmail);
    if (existing) {
      return res.status(409).json({ error: 'An account with this email already exists.' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const result = db.prepare(`
      INSERT INTO users (first_name, surname, email, password, user_type, college, department)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(firstName.trim(), surname.trim(), cleanEmail, hashedPassword, userType, college, department);

    res.status(201).json({ message: 'Account created successfully.' });
  } catch (err) {
    console.error('Signup error:', err);
    res.status(500).json({ error: 'Server error during signup.' });
  }
});

// POST /api/auth/signin
app.post('/api/auth/signin', async (req, res) => {
  try {
    const { email, password, isAdmin } = req.body;
    const cleanEmail = email.trim().toLowerCase();

    // Admin login
    if (isAdmin) {
      if (cleanEmail === 'admin@cu.edu.ng' && password === ADMIN_PASSWORD) {
        const token = jwt.sign({ email: cleanEmail, isAdmin: true, firstName: 'Admin', surname: '' }, JWT_SECRET, { expiresIn: '8h' });
        db.prepare('INSERT INTO login_logs (email, name, user_type) VALUES (?, ?, ?)').run(cleanEmail, 'Admin', 'admin');
        return res.json({ token, user: { email: cleanEmail, isAdmin: true, firstName: 'Admin', surname: '' } });
      }
      return res.status(401).json({ error: 'Invalid admin credentials.' });
    }

    const user = db.prepare('SELECT * FROM users WHERE email = ?').get(cleanEmail);
    if (!user) return res.status(401).json({ error: 'Invalid email or password.' });

    const match = await bcrypt.compare(password, user.password);
    if (!match) return res.status(401).json({ error: 'Invalid email or password.' });

    const token = jwt.sign(
      { id: user.id, email: user.email, firstName: user.first_name, surname: user.surname, userType: user.user_type, college: user.college, department: user.department },
      JWT_SECRET,
      { expiresIn: '8h' }
    );

    db.prepare('INSERT INTO login_logs (email, name, user_type) VALUES (?, ?, ?)').run(user.email, `${user.first_name} ${user.surname}`, user.user_type);

    res.json({
      token,
      user: {
        id: user.id,
        email: user.email,
        firstName: user.first_name,
        surname: user.surname,
        userType: user.user_type,
        college: user.college,
        department: user.department,
        registeredAt: user.registered_at
      }
    });
  } catch (err) {
    console.error('Signin error:', err);
    res.status(500).json({ error: 'Server error during sign in.' });
  }
});

// GET /api/auth/me
app.get('/api/auth/me', authMiddleware, (req, res) => {
  if (req.user.isAdmin) return res.json({ user: req.user });
  const user = db.prepare('SELECT id, first_name, surname, email, user_type, college, department, registered_at FROM users WHERE id = ?').get(req.user.id);
  if (!user) return res.status(404).json({ error: 'User not found' });
  res.json({
    user: {
      id: user.id,
      email: user.email,
      firstName: user.first_name,
      surname: user.surname,
      userType: user.user_type,
      college: user.college,
      department: user.department,
      registeredAt: user.registered_at
    }
  });
});

// ===== ITEMS ROUTES =====

// GET /api/items
app.get('/api/items', authMiddleware, (req, res) => {
  const { status, search } = req.query;
  let query = 'SELECT * FROM items WHERE 1=1';
  const params = [];

  if (status && status !== 'all') {
    query += ' AND status = ?';
    params.push(status);
  }

  if (search) {
    query += ' AND (name LIKE ? OR description LIKE ? OR location LIKE ? OR category LIKE ?)';
    const s = `%${search}%`;
    params.push(s, s, s, s);
  }

  query += ' ORDER BY created_at DESC';
  const items = db.prepare(query).all(...params);
  res.json({ items });
});

// POST /api/items
app.post('/api/items', authMiddleware, (req, res) => {
  try {
    const { name, status, category, location, description, itemDate, contact } = req.body;
    const user = req.user;

    if (!name || !status || !category || !location || !description || !itemDate) {
      return res.status(400).json({ error: 'All required fields must be filled.' });
    }

    const result = db.prepare(`
      INSERT INTO items (name, status, category, location, description, item_date, contact, reported_by, reporter_name)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(name.trim(), status, category, location.trim(), description.trim(), itemDate, contact || '', user.id, `${user.firstName} ${user.surname}`);

    const item = db.prepare('SELECT * FROM items WHERE id = ?').get(result.lastInsertRowid);
    res.status(201).json({ item });
  } catch (err) {
    console.error('Post item error:', err);
    res.status(500).json({ error: 'Server error posting item.' });
  }
});

// PATCH /api/items/:id/claim
app.patch('/api/items/:id/claim', authMiddleware, (req, res) => {
  const item = db.prepare('SELECT * FROM items WHERE id = ?').get(req.params.id);
  if (!item) return res.status(404).json({ error: 'Item not found.' });
  if (item.status === 'claimed') return res.status(400).json({ error: 'Item already claimed.' });
  if (item.reported_by === req.user.id) return res.status(400).json({ error: 'You cannot claim your own item.' });

  const claimedBy = `${req.user.firstName} ${req.user.surname} (${req.user.email})`;
  db.prepare('UPDATE items SET status = ?, claimed_by = ? WHERE id = ?').run('claimed', claimedBy, req.params.id);
  res.json({ message: 'Item marked as claimed.' });
});

// GET /api/items/mine
app.get('/api/items/mine', authMiddleware, (req, res) => {
  const items = db.prepare('SELECT * FROM items WHERE reported_by = ? ORDER BY created_at DESC').all(req.user.id);
  res.json({ items });
});

// ===== ADMIN ROUTES =====

// GET /api/admin/users
app.get('/api/admin/users', adminMiddleware, (req, res) => {
  const { search } = req.query;
  let query = 'SELECT id, first_name, surname, email, user_type, college, department, registered_at FROM users WHERE 1=1';
  const params = [];
  if (search) {
    query += ' AND (first_name LIKE ? OR surname LIKE ? OR email LIKE ? OR department LIKE ?)';
    const s = `%${search}%`;
    params.push(s, s, s, s);
  }
  query += ' ORDER BY registered_at DESC';
  const users = db.prepare(query).all(...params);
  res.json({ users });
});

// GET /api/admin/items
app.get('/api/admin/items', adminMiddleware, (req, res) => {
  const { search } = req.query;
  let query = 'SELECT * FROM items WHERE 1=1';
  const params = [];
  if (search) {
    query += ' AND (name LIKE ? OR location LIKE ? OR category LIKE ? OR reporter_name LIKE ?)';
    const s = `%${search}%`;
    params.push(s, s, s, s);
  }
  query += ' ORDER BY created_at DESC';
  const items = db.prepare(query).all(...params);
  res.json({ items });
});

// PATCH /api/admin/items/:id/resolve
app.patch('/api/admin/items/:id/resolve', adminMiddleware, (req, res) => {
  db.prepare("UPDATE items SET status = 'claimed', claimed_by = 'Resolved by Admin' WHERE id = ?").run(req.params.id);
  res.json({ message: 'Item resolved.' });
});

// DELETE /api/admin/items/:id
app.delete('/api/admin/items/:id', adminMiddleware, (req, res) => {
  db.prepare('DELETE FROM items WHERE id = ?').run(req.params.id);
  res.json({ message: 'Item deleted.' });
});

// GET /api/admin/logs
app.get('/api/admin/logs', adminMiddleware, (req, res) => {
  const logs = db.prepare('SELECT * FROM login_logs ORDER BY login_time DESC').all();
  res.json({ logs });
});

// GET /api/admin/stats
app.get('/api/admin/stats', adminMiddleware, (req, res) => {
  const totalUsers = db.prepare('SELECT COUNT(*) as count FROM users').get().count;
  const totalItems = db.prepare('SELECT COUNT(*) as count FROM items').get().count;
  const lostItems = db.prepare("SELECT COUNT(*) as count FROM items WHERE status = 'lost'").get().count;
  const foundItems = db.prepare("SELECT COUNT(*) as count FROM items WHERE status = 'found'").get().count;
  const claimedItems = db.prepare("SELECT COUNT(*) as count FROM items WHERE status = 'claimed'").get().count;
  const totalLogins = db.prepare('SELECT COUNT(*) as count FROM login_logs').get().count;
  res.json({ totalUsers, totalItems, lostItems, foundItems, claimedItems, totalLogins });
});

// Serve frontend for all other routes
app.get('/{*path}', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// ===== START SERVER =====
app.listen(PORT, '0.0.0.0', () => {
  console.log(`\n✅ CU Lost & Found server running on port ${PORT}`);
  console.log(`   Admin login: admin@cu.edu.ng\n`);
});
