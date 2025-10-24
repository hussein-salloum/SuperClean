const express = require('express');
const bodyParser = require('body-parser');
const session = require('express-session');
const path = require('path');
const fs = require('fs');
const multer = require('multer');

const app = express();
const PORT = process.env.PORT || 3000;

// === Configuration ===
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());
app.use(session({
  secret: 'your‑very‑strong‑secret', 
  resave: false,
  saveUninitialized: false
}));

// Serve static files
app.use('/public', express.static(path.join(__dirname, 'public')));
app.use('/images', express.static(path.join(__dirname, 'public/images')));

// Admin credentials (single user)
const ADMIN_USER = 'admin';
const ADMIN_PASS = 'password123';  // change this!

// === File where items are stored ===
const ITEMS_FILE = path.join(__dirname, 'public/items.json');

// === Multer setup for image upload ===
const storage = multer.diskStorage({
  destination: function(req, file, cb) {
    cb(null, path.join(__dirname, 'public/images'));
  },
  filename: function(req, file, cb) {
    // prefix timestamp to avoid collisions
    cb(null, Date.now() + '_' + file.originalname);
  }
});
const upload = multer({ storage: storage });

// === Routes ===

// Public menu JSON endpoint
app.get('/api/items', (req, res) => {
  fs.readFile(ITEMS_FILE, 'utf8', (err, data) => {
    if (err) {
      return res.status(500).json({ error: 'Could not read items file' });
    }
    let items = [];
    try { items = JSON.parse(data); } catch(e) { items = []; }
    res.json(items);
  });
});

// Admin login page
app.get('/admin', (req, res) => {
  if (req.session.loggedIn) {
    return res.sendFile(path.join(__dirname, 'admin/dashboard.html'));
  }
  res.sendFile(path.join(__dirname, 'admin/login.html'));
});

// Admin login form submission
app.post('/admin/login', (req, res) => {
  const { username, password } = req.body;
  if (username === ADMIN_USER && password === ADMIN_PASS) {
    req.session.loggedIn = true;
    return res.redirect('/admin');
  }
  res.send('Invalid credentials. <a href="/admin">Try again</a>');
});

// Admin logout
app.post('/admin/logout', (req, res) => {
  req.session.destroy(err => {
    res.redirect('/admin');
  });
});

// Handle new item submission (image + name + price + category)
app.post('/admin/add‑item', upload.single('image'), (req, res) => {
  if (!req.session.loggedIn) {
    return res.status(403).send('Not authorized');
  }
  const { name, price, category } = req.body;
  const imageFile = req.file ? '/images/' + req.file.filename : '';
  const newItem = { name, price, category, image: imageFile };
  
  fs.readFile(ITEMS_FILE, 'utf8', (err, data) => {
    let items = [];
    if (!err) {
      try { items = JSON.parse(data); } catch(e) { items = []; }
    }
    items.push(newItem);
    fs.writeFile(ITEMS_FILE, JSON.stringify(items, null,2), err2 => {
      if (err2) {
        return res.status(500).send('Could not save item');
      }
      res.redirect('/admin');
    });
  });
});

// Start server
app.listen(PORT, () => {
  console.log(`Server started on http://localhost:${PORT}`);
});
