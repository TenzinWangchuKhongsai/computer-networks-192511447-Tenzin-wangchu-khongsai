const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

let db = null;

function getConnection() {
  if (db) return db;

  const dbPath = process.env.DB_PATH || './data/smart_office.db';
  const dbDir = path.dirname(dbPath);

  // Ensure directory exists
  if (!fs.existsSync(dbDir)) {
    fs.mkdirSync(dbDir, { recursive: true });
  }

  db = new Database(dbPath);
  db.pragma('journal_mode = WAL');
  db.pragma('synchronous = NORMAL');
  db.pragma('foreign_keys = ON');

  return db;
}

function closeConnection() {
  if (db) {
    db.close();
    db = null;
  }
}

module.exports = { getConnection, closeConnection };
