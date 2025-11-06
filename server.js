require('dotenv').config();
const express = require('express');
const bodyParser = require('body-parser');
const session = require('express-session');
const path = require('path');
const multer = require('multer');
const fs = require('fs');
const { createClient } = require('@supabase/supabase-js');

const app = express();
const PORT = process.env.PORT || 3000;

// ====== Supabase Init ======
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);
const BUCKET = process.env.SUPABASE_BUCKET || 'product-images';

// ====== Middleware ======
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());
app.use(
  session({
    secret: 'super-secret-key',
    resave: false,
    saveUninitialized: false,
  })
);

// Serve static files from 'public' directly at root
app.use(express.static(path.join(__dirname, 'public')));

// ====== Admin credentials ======
const ADMIN_USER = process.env.ADMIN_USER;
const ADMIN_PASS = process.env.ADMIN_PASS;

// ====== Multer setup (temporary local upload before sending to Supabase) ======
const upload = multer({ dest: path.join(__dirname, 'tmp') });

// ====== Routes ======

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

// ====== Helper: upload image to Supabase Storage ======
async function uploadToSupabaseStorage(localPath, filename) {
  const fileBuffer = fs.readFileSync(localPath);
  const ext = path.extname(filename);
  const remoteName = `${Date.now()}-${Math.random().toString(36).substring(2, 8)}${ext}`;

  const { error: uploadError } = await supabase.storage
    .from(BUCKET)
    .upload(remoteName, fileBuffer, {
      contentType: 'image/jpeg',
      upsert: false,
    });

  if (uploadError) throw uploadError;

  // Get public URL
  const {
    data: { publicUrl },
  } = supabase.storage.from(BUCKET).getPublicUrl(remoteName);

  // Cleanup local file
  fs.unlinkSync(localPath);

  return publicUrl;
}

// ====== Add new item ======
app.post('/admin/add-item', upload.single('image'), async (req, res) => {
  if (!req.session.loggedIn) return res.status(403).send('Not authorized');
  const { name, price, category, description } = req.body;
  let imageUrl = '';

  try {
    if (req.file) {
      imageUrl = await uploadToSupabaseStorage(req.file.path, req.file.originalname);
    }

    const { error } = await supabase.from('items').insert([
      { name, price, category, description, image: imageUrl },
    ]);
    if (error) throw error;

    res.redirect('/admin');
  } catch (err) {
    console.error('Error adding item:', err);
    res.status(500).send('Error adding item');
  }
});

// ====== Edit item ======
app.post('/admin/edit-item', upload.single('image'), async (req, res) => {
  if (!req.session.loggedIn) return res.status(403).send('Not authorized');
  const { id, name, price, category, description } = req.body;
  const updates = { name, price, category, description };

  try {
    if (req.file) {
      const imageUrl = await uploadToSupabaseStorage(req.file.path, req.file.originalname);
      updates.image = imageUrl;
    }

    const { error } = await supabase.from('items').update(updates).eq('id', id);
    if (error) throw error;

    res.redirect('/admin');
  } catch (err) {
    console.error('Error editing item:', err);
    res.status(500).send('Error editing item');
  }
});

// ====== Delete item ======
app.post('/admin/delete-item', async (req, res) => {
  if (!req.session.loggedIn) return res.status(403).send('Not authorized');
  const { id } = req.body;

  try {
    const { error } = await supabase.from('items').delete().eq('id', id);
    if (error) throw error;
    res.redirect('/admin');
  } catch (err) {
    console.error('Error deleting item:', err);
    res.status(500).send('Error deleting item');
  }
});

// ====== Public API: fetch items ======
app.get('/api/items', async (req, res) => {
  try {
    const { data: items, error } = await supabase
      .from('items')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) throw error;
    res.json(items);
  } catch (err) {
    console.error('Error fetching items:', err);
    res.status(500).json([]);
  }
});

// ====== Start Server ======
app.listen(PORT, () => console.log(`✅ Server running on port ${PORT}`));
