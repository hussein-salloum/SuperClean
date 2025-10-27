const Database = require('better-sqlite3');
const path = require('path');

// Database file
const db = new Database(path.join(__dirname, 'items.db'));

// Create items table if not exists
db.prepare(`
  CREATE TABLE IF NOT EXISTS items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    price REAL NOT NULL,
    category TEXT NOT NULL,
    description TEXT,
    image TEXT
  )
`).run();

module.exports = db;
