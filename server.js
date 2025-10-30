const express = require('express');
const bodyParser = require('body-parser');
const session = require('express-session');
const path = require('path');
const multer = require('multer');
const { Pool } = require('pg'); // ✅ PostgreSQL
const fetch = require('node-fetch');

const fs = require('fs');

const ca = fs.readFileSync('/path/to/aiven-ca.crt').toString();


const app = express();
const PORT = process.env.PORT || 3000;

// ========== Middleware ==========
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());
app.use(
  session({
    secret: 'super-secret-key',
    resave: false,
    saveUninitialized: false,
  })
);

// Serve static files
app.use('/public', express.static(path.join(__dirname, 'public')));
app.use('/images', express.static(path.join(__dirname, 'public/images')));
app.use(express.static(__dirname)); // serve index.html

// ========== Admin credentials ==========
const ADMIN_USER = 'admin';
const ADMIN_PASS = 'Mazen2025!';

// ========== Multer setup ==========
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, path.join(__dirname, 'public/images'));
  },
  filename: (req, file, cb) => {
    cb(null, Date.now() + '_' + file.originalname);
  },
});
const upload = multer({ storage });

// ========== PostgreSQL setup ==========
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }, // ✅ Required for Render PostgreSQL
});

// Create table if not exists
(async () => {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS items (
        id SERIAL PRIMARY KEY,
        name TEXT,
        price TEXT,
        category TEXT,
        description TEXT,
        image TEXT
      )
    `);
    console.log('✅ Connected to PostgreSQL and ensured "items" table exists.');
  } catch (err) {
    console.error('❌ PostgreSQL connection error:', err);
  }
})();

// ========== Routes ==========

// 🩺 Health route
app.get('/health', (req, res) => res.status(200).send('OK'));

// Public API
app.get('/api/items', async (req, res) => {
  try {
    const { rows } = await pool.query('SELECT * FROM items ORDER BY id DESC');
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json([]);
  }
});

// Admin login page
app.get('/admin', (req, res) => {
  if (req.session.loggedIn)
    return res.sendFile(path.join(__dirname, 'admin/dashboard.html'));
  res.sendFile(path.join(__dirname, 'admin/login.html'));
});

// Handle admin login
app.post('/admin/login', (req, res) => {
  const { username, password } = req.body;
  if (username === ADMIN_USER && password === ADMIN_PASS) {
    req.session.loggedIn = true;
    return res.redirect('/admin');
  }
  res.send('Invalid credentials. <a href="/admin">Try again</a>');
});

// Handle logout
app.post('/admin/logout', (req, res) => {
  req.session.destroy(() => res.redirect('/admin'));
});

// Add new item
app.post('/admin/add-item', upload.single('image'), async (req, res) => {
  if (!req.session.loggedIn) return res.status(403).send('Not authorized');
  const { name, price, category, description } = req.body;
  const image = req.file ? '/images/' + req.file.filename : '';
  try {
    await pool.query(
      'INSERT INTO items (name, price, category, description, image) VALUES ($1, $2, $3, $4, $5)',
      [name, price, category, description, image]
    );
    res.redirect('/admin');
  } catch (err) {
    console.error(err);
    res.status(500).send('Error adding item');
  }
});

// Edit item
app.post('/admin/edit-item', upload.single('image'), async (req, res) => {
  if (!req.session.loggedIn) return res.status(403).send('Not authorized');
  const { id, name, price, category, description } = req.body;

  try {
    if (req.file) {
      const image = '/images/' + req.file.filename;
      await pool.query(
        'UPDATE items SET name=$1, price=$2, category=$3, description=$4, image=$5 WHERE id=$6',
        [name, price, category, description, image, id]
      );
    } else {
      await pool.query(
        'UPDATE items SET name=$1, price=$2, category=$3, description=$4 WHERE id=$5',
        [name, price, category, description, id]
      );
    }
    res.redirect('/admin');
  } catch (err) {
    console.error(err);
    res.status(500).send('Error editing item');
  }
});

// Delete item
app.post('/admin/delete-item', async (req, res) => {
  if (!req.session.loggedIn) return res.status(403).send('Not authorized');
  const { id } = req.body;
  try {
    await pool.query('DELETE FROM items WHERE id=$1', [id]);
    res.redirect('/admin');
  } catch (err) {
    console.error(err);
    res.status(500).send('Error deleting item');
  }
});

// ========== Start Server ==========
app.listen(PORT, () => {
  console.log(`✅ Server running on port ${PORT}`);

  // 🕒 Self-ping every 5 minutes to prevent sleep
  const appUrl =
    process.env.RENDER_EXTERNAL_URL ||
    'https://superclean.onrender.com/public/index.html';
  setInterval(() => {
    fetch(`${appUrl}/health`)
      .then((res) => console.log(`Self-ping OK: ${res.status}`))
      .catch((err) => console.error('Self-ping failed:', err.message));
  }, 5 * 60 * 1000);
});
