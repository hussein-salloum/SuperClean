const express = require('express');
const bodyParser = require('body-parser');
const session = require('express-session');
const path = require('path');
const multer = require('multer');
const sqlite3 = require('sqlite3').verbose();

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

// ========== SQLite setup ==========
const db = new sqlite3.Database('./items.db', (err) => {
  if (err) console.error(err.message);
  else console.log('Connected to SQLite database.');
});

// Create table if not exists
db.run(`CREATE TABLE IF NOT EXISTS items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT,
  price TEXT,
  category TEXT,
  description TEXT,
  image TEXT
)`);

// ========== Routes ==========

// Public API
app.get('/api/items', (req, res) => {
  db.all('SELECT * FROM items', [], (err, rows) => {
    if (err) return res.status(500).json([]);
    res.json(rows);
  });
});

// Admin login page
app.get('/admin', (req, res) => {
  if (req.session.loggedIn) return res.sendFile(path.join(__dirname, 'admin/dashboard.html'));
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
app.post('/admin/add-item', upload.single('image'), (req, res) => {
  if (!req.session.loggedIn) return res.status(403).send('Not authorized');

  const { name, price, category, description } = req.body;
  const image = req.file ? '/images/' + req.file.filename : '';

  db.run(`INSERT INTO items (name, price, category, description, image) VALUES (?, ?, ?, ?, ?)`,
    [name, price, category, description, image],
    (err) => {
      if (err) console.error(err);
      res.redirect('/admin');
    }
  );
});

// Edit item
app.post('/admin/edit-item', upload.single('image'), (req, res) => {
  if (!req.session.loggedIn) return res.status(403).send('Not authorized');

  const { id, name, price, category, description } = req.body;
  let sql = `UPDATE items SET name=?, price=?, category=?, description=?`;
  const params = [name, price, category, description];

  if (req.file) {
    sql += `, image=?`;
    params.push('/images/' + req.file.filename);
  }
  sql += ` WHERE id=?`;
  params.push(id);

  db.run(sql, params, (err) => {
    if (err) console.error(err);
    res.redirect('/admin');
  });
});

// Delete item
app.post('/admin/delete-item', (req, res) => {
  if (!req.session.loggedIn) return res.status(403).send('Not authorized');
  const { id } = req.body;
  db.run(`DELETE FROM items WHERE id=?`, [id], (err) => {
    if (err) console.error(err);
    res.redirect('/admin');
  });
});

// Start server
app.listen(PORT, () => console.log(`✅ Server running on port ${PORT}`));
