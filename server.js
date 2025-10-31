const express = require('express');
const bodyParser = require('body-parser');
const session = require('express-session');
const path = require('path');
const multer = require('multer');
const Parse = require('parse/node');

const app = express();
const PORT = process.env.PORT || 3000;

// ========== Parse Setup ==========
Parse.initialize(
  process.env.PARSE_APP_ID || 'ndllquiCdZTiGY1MMBsEN1MYhF8p89iK15oEYqW4',
  process.env.PARSE_JS_KEY || 'Qwcb3M1flH9cRlcCovDJ0YvKrb91Xmvp9voPd1Iz'
);
Parse.serverURL = process.env.PARSE_SERVER_URL || 'https://parseapi.back4app.com';

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
app.use(express.static(__dirname));

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

// ========== Routes ==========

// Public API (GET all items)
app.get('/api/items', async (req, res) => {
  try {
    const Item = Parse.Object.extend('Item');
    const query = new Parse.Query(Item);
    query.descending('createdAt');
    const results = await query.find();
    const data = results.map((obj) => ({
      id: obj.id,
      name: obj.get('name'),
      price: obj.get('price'),
      category: obj.get('category'),
      description: obj.get('description'),
      image: obj.get('image'),
    }));
    res.json(data);
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
    await item.save();
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
    const query = new Parse.Query('Item');
    const item = await query.get(id);
    item.set('name', name);
    item.set('price', price);
    item.set('category', category);
    item.set('description', description);
    if (req.file) item.set('image', '/images/' + req.file.filename);
    await item.save();
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
    const query = new Parse.Query('Item');
    const item = await query.get(id);
    await item.destroy();
    res.redirect('/admin');
  } catch (err) {
    console.error(err);
    res.status(500).send('Error deleting item');
  }
});

// ========== Start Server ==========
app.listen(PORT, () => {
  console.log(`✅ Server running on port ${PORT}`);
});
