const express = require('express');
const { Pool } = require('pg');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const cors = require('cors');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'cu-lost-found-dev-secret';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'admin1234';

// ===== MIDDLEWARE =====
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// ===== DATABASE SETUP =====
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL ? { rejectUnauthorized: false } : false
});

// Helper: run a query
const query = (text, params) => pool.query(text, params);

// Create tables if they don't exist
async function initDB() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS users (
      id SERIAL PRIMARY KEY,
      first_name TEXT NOT NULL,
      surname TEXT NOT NULL,
      email TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL,
      user_type TEXT NOT NULL CHECK(user_type IN ('student','postgrad','staff')),
      college TEXT NOT NULL,
      department TEXT NOT NULL,
      registered_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS items (
      id SERIAL PRIMARY KEY,
      name TEXT NOT NULL,
      status TEXT NOT NULL CHECK(status IN ('lost','found','claimed')),
      category TEXT NOT NULL,
      location TEXT NOT NULL,
      description TEXT NOT NULL,
      item_date TEXT NOT NULL,
      contact TEXT,
      reported_by INTEGER NOT NULL REFERENCES users(id),
      reporter_name TEXT NOT NULL,
      claimed_by TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS login_logs (
      id SERIAL PRIMARY KEY,
      email TEXT NOT NULL,
      name TEXT NOT NULL,
      user_type TEXT NOT NULL,
      login_time TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);
  console.log('✅ Database tables ready');
}

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
  if (userType === 'student') return /^[a-z]{2,}\.\d{7}@stu\.cu\.edu\.ng$/.test(email);
  if (userType === 'postgrad') return /^[a-z]{2,}\.\d{7}@pg\.cu\.edu\.ng$/.test(email);
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

    const existing = await query('SELECT id FROM users WHERE email = $1', [cleanEmail]);
    if (existing.rows.length > 0) {
      return res.status(409).json({ error: 'An account with this email already exists.' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    await query(
      'INSERT INTO users (first_name, surname, email, password, user_type, college, department) VALUES ($1,$2,$3,$4,$5,$6,$7)',
      [firstName.trim(), surname.trim(), cleanEmail, hashedPassword, userType, college, department]
    );

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
        const token = jwt.sign(
          { email: cleanEmail, isAdmin: true, firstName: 'Admin', surname: '' },
          JWT_SECRET, { expiresIn: '8h' }
        );
        await query('INSERT INTO login_logs (email, name, user_type) VALUES ($1,$2,$3)', [cleanEmail, 'Admin', 'admin']);
        return res.json({ token, user: { email: cleanEmail, isAdmin: true, firstName: 'Admin', surname: '' } });
      }
      return res.status(401).json({ error: 'Invalid admin credentials.' });
    }

    const result = await query('SELECT * FROM users WHERE email = $1', [cleanEmail]);
    const user = result.rows[0];
    if (!user) return res.status(401).json({ error: 'Invalid email or password.' });

    const match = await bcrypt.compare(password, user.password);
    if (!match) return res.status(401).json({ error: 'Invalid email or password.' });

    const token = jwt.sign(
      { id: user.id, email: user.email, firstName: user.first_name, surname: user.surname,
        userType: user.user_type, college: user.college, department: user.department },
      JWT_SECRET, { expiresIn: '8h' }
    );

    await query('INSERT INTO login_logs (email, name, user_type) VALUES ($1,$2,$3)',
      [user.email, `${user.first_name} ${user.surname}`, user.user_type]);

    res.json({
      token,
      user: {
        id: user.id, email: user.email,
        firstName: user.first_name, surname: user.surname,
        userType: user.user_type, college: user.college,
        department: user.department, registeredAt: user.registered_at
      }
    });
  } catch (err) {
    console.error('Signin error:', err);
    res.status(500).json({ error: 'Server error during sign in.' });
  }
});

// GET /api/auth/me
app.get('/api/auth/me', authMiddleware, async (req, res) => {
  if (req.user.isAdmin) return res.json({ user: req.user });
  const result = await query(
    'SELECT id, first_name, surname, email, user_type, college, department, registered_at FROM users WHERE id = $1',
    [req.user.id]
  );
  const user = result.rows[0];
  if (!user) return res.status(404).json({ error: 'User not found' });
  res.json({
    user: {
      id: user.id, email: user.email,
      firstName: user.first_name, surname: user.surname,
      userType: user.user_type, college: user.college,
      department: user.department, registeredAt: user.registered_at
    }
  });
});

// ===== ITEMS ROUTES =====

// GET /api/items
app.get('/api/items', authMiddleware, async (req, res) => {
  try {
    const { status, search } = req.query;
    let text = 'SELECT * FROM items WHERE 1=1';
    const params = [];

    if (status && status !== 'all') {
      params.push(status);
      text += ` AND status = $${params.length}`;
    }
    if (search) {
      const s = `%${search}%`;
      params.push(s, s, s, s);
      const n = params.length;
      text += ` AND (name ILIKE $${n-3} OR description ILIKE $${n-2} OR location ILIKE $${n-1} OR category ILIKE $${n})`;
    }
    text += ' ORDER BY created_at DESC';

    const result = await query(text, params);
    res.json({ items: result.rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch items.' });
  }
});

// POST /api/items
app.post('/api/items', authMiddleware, async (req, res) => {
  try {
    const { name, status, category, location, description, itemDate, contact } = req.body;
    const user = req.user;

    if (!name || !status || !category || !location || !description || !itemDate) {
      return res.status(400).json({ error: 'All required fields must be filled.' });
    }

    const result = await query(
      `INSERT INTO items (name, status, category, location, description, item_date, contact, reported_by, reporter_name)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *`,
      [name.trim(), status, category, location.trim(), description.trim(), itemDate,
       contact || '', user.id, `${user.firstName} ${user.surname}`]
    );
    res.status(201).json({ item: result.rows[0] });
  } catch (err) {
    console.error('Post item error:', err);
    res.status(500).json({ error: 'Server error posting item.' });
  }
});

// PATCH /api/items/:id/claim
app.patch('/api/items/:id/claim', authMiddleware, async (req, res) => {
  try {
    const result = await query('SELECT * FROM items WHERE id = $1', [req.params.id]);
    const item = result.rows[0];
    if (!item) return res.status(404).json({ error: 'Item not found.' });
    if (item.status === 'claimed') return res.status(400).json({ error: 'Item already claimed.' });
    if (item.reported_by === req.user.id) return res.status(400).json({ error: 'You cannot claim your own item.' });

    const claimedBy = `${req.user.firstName} ${req.user.surname} (${req.user.email})`;
    await query('UPDATE items SET status = $1, claimed_by = $2 WHERE id = $3', ['claimed', claimedBy, req.params.id]);
    res.json({ message: 'Item marked as claimed.' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to claim item.' });
  }
});

// GET /api/items/mine
app.get('/api/items/mine', authMiddleware, async (req, res) => {
  try {
    const result = await query('SELECT * FROM items WHERE reported_by = $1 ORDER BY created_at DESC', [req.user.id]);
    res.json({ items: result.rows });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch your items.' });
  }
});

// ===== ADMIN ROUTES =====

// GET /api/admin/users
app.get('/api/admin/users', adminMiddleware, async (req, res) => {
  try {
    const { search } = req.query;
    let text = 'SELECT id, first_name, surname, email, user_type, college, department, registered_at FROM users WHERE 1=1';
    const params = [];
    if (search) {
      const s = `%${search}%`;
      params.push(s, s, s, s);
      const n = params.length;
      text += ` AND (first_name ILIKE $${n-3} OR surname ILIKE $${n-2} OR email ILIKE $${n-1} OR department ILIKE $${n})`;
    }
    text += ' ORDER BY registered_at DESC';
    const result = await query(text, params);
    res.json({ users: result.rows });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch users.' });
  }
});

// GET /api/admin/items
app.get('/api/admin/items', adminMiddleware, async (req, res) => {
  try {
    const { search } = req.query;
    let text = 'SELECT * FROM items WHERE 1=1';
    const params = [];
    if (search) {
      const s = `%${search}%`;
      params.push(s, s, s, s);
      const n = params.length;
      text += ` AND (name ILIKE $${n-3} OR location ILIKE $${n-2} OR category ILIKE $${n-1} OR reporter_name ILIKE $${n})`;
    }
    text += ' ORDER BY created_at DESC';
    const result = await query(text, params);
    res.json({ items: result.rows });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch items.' });
  }
});

// PATCH /api/admin/items/:id/resolve
app.patch('/api/admin/items/:id/resolve', adminMiddleware, async (req, res) => {
  await query("UPDATE items SET status = 'claimed', claimed_by = 'Resolved by Admin' WHERE id = $1", [req.params.id]);
  res.json({ message: 'Item resolved.' });
});

// DELETE /api/admin/items/:id
app.delete('/api/admin/items/:id', adminMiddleware, async (req, res) => {
  await query('DELETE FROM items WHERE id = $1', [req.params.id]);
  res.json({ message: 'Item deleted.' });
});

// GET /api/admin/logs
app.get('/api/admin/logs', adminMiddleware, async (req, res) => {
  const result = await query('SELECT * FROM login_logs ORDER BY login_time DESC');
  res.json({ logs: result.rows });
});

// GET /api/admin/stats
app.get('/api/admin/stats', adminMiddleware, async (req, res) => {
  try {
    const [users, items, lost, found, claimed, logins] = await Promise.all([
      query('SELECT COUNT(*) FROM users'),
      query('SELECT COUNT(*) FROM items'),
      query("SELECT COUNT(*) FROM items WHERE status = 'lost'"),
      query("SELECT COUNT(*) FROM items WHERE status = 'found'"),
      query("SELECT COUNT(*) FROM items WHERE status = 'claimed'"),
      query('SELECT COUNT(*) FROM login_logs')
    ]);
    res.json({
      totalUsers:   parseInt(users.rows[0].count),
      totalItems:   parseInt(items.rows[0].count),
      lostItems:    parseInt(lost.rows[0].count),
      foundItems:   parseInt(found.rows[0].count),
      claimedItems: parseInt(claimed.rows[0].count),
      totalLogins:  parseInt(logins.rows[0].count)
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch stats.' });
  }
});

// Serve frontend for all other routes
app.get('/{*path}', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// ===== START SERVER =====
initDB()
  .then(() => {
    app.listen(PORT, '0.0.0.0', () => {
      console.log(`\n✅ CU Lost & Found server running on port ${PORT}`);
      console.log(`   Admin login: admin@cu.edu.ng\n`);
    });
  })
  .catch(err => {
    console.error('Failed to initialise database:', err);
    process.exit(1);
  });
