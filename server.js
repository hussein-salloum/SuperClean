require('dotenv').config(); // Load .env
const express = require('express');
const bodyParser = require('body-parser');
const session = require('express-session');
const path = require('path');
const multer = require('multer');
const Parse = require('parse/node');

const app = express();
const PORT = process.env.PORT || 3000;

// ========== Parse Init ==========
Parse.initialize(
  process.env.PARSE_APP_ID,
  process.env.PARSE_JS_KEY,
  process.env.PARSE_MASTER_KEY
);
Parse.serverURL = process.env.PARSE_SERVER_URL;

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
app.use(express.static(__dirname));
app.use('/public', express.static(path.join(__dirname, 'public')));
app.use('/images', express.static(path.join(__dirname, 'public/images')));

// Serve index.html at root
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public/index.html'));
});

// ========== Admin credentials ==========
const ADMIN_USER = process.env.ADMIN_USER;
const ADMIN_PASS = process.env.ADMIN_PASS;

// ========== Multer setup ==========
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, path.join(__dirname, 'public/images')),
  filename: (req, file, cb) => cb(null, Date.now() + '_' + file.originalname)
});
const upload = multer({ storage });

// ========== Routes ==========

// Login page
app.get('/admin', (req, res) => {
  if (req.session.loggedIn) return res.sendFile(path.join(__dirname, 'admin/dashboard.html'));
  res.sendFile(path.join(__dirname, 'admin/login.html'));
});

// Handle login
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
    const Item = Parse.Object.extend('Item');
    const item = new Item();

    item.set('name', name);
    item.set('price', price);
    item.set('category', category);
    item.set('description', description);
    item.set('image', image);

    await item.save(null, { useMasterKey: true });

    res.redirect('/admin');
  } catch (err) {
    console.error('Error saving item:', err);
    res.status(500).send('Error adding item');
  }
});

// Edit item
app.post('/admin/edit-item', upload.single('image'), async (req, res) => {
  if (!req.session.loggedIn) return res.status(403).send('Not authorized');

  const { id, name, price, category, description } = req.body;

  try {
    const Item = Parse.Object.extend('Item');
    const query = new Parse.Query(Item);
    const item = await query.get(id, { useMasterKey: true });

    item.set('name', name);
    item.set('price', price);
    item.set('category', category);
    item.set('description', description);

    if (req.file) {
      const image = '/images/' + req.file.filename;
      item.set('image', image);
    }

    await item.save(null, { useMasterKey: true });
    res.redirect('/admin');
  } catch (err) {
    console.error('Error editing item:', err);
    res.status(500).send('Error editing item');
  }
});

// Delete item
app.post('/admin/delete-item', async (req, res) => {
  if (!req.session.loggedIn) return res.status(403).send('Not authorized');

  const { id } = req.body;

  try {
    const Item = Parse.Object.extend('Item');
    const query = new Parse.Query(Item);
    const item = await query.get(id, { useMasterKey: true });

    await item.destroy({ useMasterKey: true });
    res.redirect('/admin');
  } catch (err) {
    console.error('Error deleting item:', err);
    res.status(500).send('Error deleting item');
  }
});

// Public API: fetch items
app.get('/api/items', async (req, res) => {
  try {
    const Item = Parse.Object.extend('Item');
    const query = new Parse.Query(Item);
    const items = await query.descending('createdAt').find({ useMasterKey: true });

    // Convert Parse objects to plain JS objects
    const plainItems = items.map(it => ({
      id: it.id,
      name: it.get('name'),
      price: it.get('price'),
      category: it.get('category'),
      description: it.get('description'),
      image: it.get('image')
    }));

    res.json(plainItems);
  } catch (err) {
    console.error('Error fetching items:', err);
    res.status(500).json([]);
  }
});

// Start server
app.listen(PORT, () => console.log(`✅ Server running on port ${PORT}`));
