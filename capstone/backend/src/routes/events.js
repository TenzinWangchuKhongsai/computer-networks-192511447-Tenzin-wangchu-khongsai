const express = require('express');
const router = express.Router();
const { getConnection } = require('../database/connection');

// GET /api/events - Get recent events
router.get('/', (req, res) => {
  try {
    const db = getConnection();
    const limit = parseInt(req.query.limit) || 100;
    const type = req.query.type;
    const roomId = req.query.roomId ? parseInt(req.query.roomId) : null;

    let query = 'SELECT e.*, r.name as room_name FROM events e LEFT JOIN rooms r ON e.room_id = r.id';
    const conditions = [];
    const params = [];

    if (type) {
      conditions.push('e.type = ?');
      params.push(type);
    }
    if (roomId) {
      conditions.push('e.room_id = ?');
      params.push(roomId);
    }

    if (conditions.length > 0) {
      query += ' WHERE ' + conditions.join(' AND ');
    }

    query += ' ORDER BY e.timestamp DESC, e.id DESC LIMIT ?';
    params.push(limit);

    const events = db.prepare(query).all(...params);
    res.json(events);
  } catch (err) {
    console.error('[API] Error fetching events:', err.message);
    res.status(500).json({ error: 'Failed to fetch events' });
  }
});

// DELETE /api/events - Clear all events
router.delete('/', (req, res) => {
  try {
    const db = getConnection();
    db.prepare('DELETE FROM events').run();
    res.json({ message: 'Events cleared' });
  } catch (err) {
    console.error('[API] Error clearing events:', err.message);
    res.status(500).json({ error: 'Failed to clear events' });
  }
});

module.exports = router;
