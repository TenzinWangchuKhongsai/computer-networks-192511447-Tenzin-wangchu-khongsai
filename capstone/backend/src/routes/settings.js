const express = require('express');
const router = express.Router();
const { getConnection } = require('../database/connection');

// GET /api/settings - Get all settings
router.get('/', (req, res) => {
  try {
    const db = getConnection();
    const rows = db.prepare('SELECT * FROM settings').all();
    const settings = {};
    for (const row of rows) {
      settings[row.key] = row.value;
    }
    res.json(settings);
  } catch (err) {
    console.error('[API] Error fetching settings:', err.message);
    res.status(500).json({ error: 'Failed to fetch settings' });
  }
});

// PUT /api/settings - Update settings
router.put('/', (req, res) => {
  try {
    const db = getConnection();
    const updates = req.body;

    const upsert = db.prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)');
    const updateAll = db.transaction((items) => {
      for (const [key, value] of Object.entries(items)) {
        upsert.run(key, String(value));
      }
    });

    updateAll(updates);

    const io = req.app.get('io');
    if (io) {
      io.emit('settings-update', updates);
    }

    res.json(updates);
  } catch (err) {
    console.error('[API] Error updating settings:', err.message);
    res.status(500).json({ error: 'Failed to update settings' });
  }
});

module.exports = router;
