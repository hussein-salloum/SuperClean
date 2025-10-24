const express = require('express');
const bodyParser = require('body-parser');
const session = require('express-session');
const path = require('path');
const multer = require('multer');

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
const ADMIN_PASS = 'password123'; // change this!

// ========== Multer setup for uploads ==========
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, path.join(__dirname, 'public/images'));
  },
  filename: (req, file, cb) => {
    cb(null, Date.now() + '_' + file.originalname);
  },
});
const upload = multer({ storage });

// ========== In-memory item storage ==========
let items = [];

// ========== Routes ==========

// Public API
app.get('/api/items', (req, res) => {
  res.json(items);
});

// Admin login page
app.get('/admin', (req, res) => {
  if (req.session.loggedIn) {
    return res.sendFile(path.join(__dirname, 'admin/dashboard.html'));
  }
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
  req.session.destroy(() => {
    res.redirect('/admin');
  });
});

// Add new item
app.post('/admin/add-item', upload.single('image'), (req, res) => {
  if (!req.session.loggedIn) return res.status(403).send('Not authorized');

  const { name, price, category } = req.body;
  const image = req.file ? '/images/' + req.file.filename : '';
  items.push({ name, price, category, image });

  res.redirect('/admin');
});

// Edit item
app.post('/admin/edit-item', upload.single('image'), (req, res) => {
  if (!req.session.loggedIn) return res.status(403).send('Not authorized');

  const { index, name, price, category } = req.body;
  if (!items[index]) return res.status(404).send('Item not found');

  items[index].name = name;
  items[index].price = price;
  items[index].category = category;
  if (req.file) items[index].image = '/images/' + req.file.filename;

  res.redirect('/admin');
});

// Delete item
app.post('/admin/delete-item', (req, res) => {
  if (!req.session.loggedIn) return res.status(403).send('Not authorized');

  const { index } = req.body;
  if (!items[index]) return res.status(404).send('Item not found');

  items.splice(index, 1);
  res.redirect('/admin');
});

// Start server
app.listen(PORT, () => console.log(`✅ Server running on port ${PORT}`));
