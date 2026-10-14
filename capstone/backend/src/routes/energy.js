const express = require('express');
const router = express.Router();
const energyEngine = require('../services/energyEngine');
const realEnergyService = require('../services/realEnergyService');

// GET /api/energy/unified - Unified energy summary (Simulated + Real Estimated)
router.get('/unified', (req, res) => {
  try {
    const summary = realEnergyService.getSummary();
    res.json(summary);
  } catch (err) {
    console.error('[API] Error fetching unified energy:', err.message);
    res.status(500).json({ error: 'Failed to fetch unified energy' });
  }
});

// GET /api/energy - Get energy summary
router.get('/', (req, res) => {
  try {
    const summary = energyEngine.getSummary();
    res.json(summary);
  } catch (err) {
    console.error('[API] Error fetching energy summary:', err.message);
    res.status(500).json({ error: 'Failed to fetch energy data' });
  }
});

// GET /api/energy/summary - Alias for above
router.get('/summary', (req, res) => {
  try {
    const summary = energyEngine.getSummary();
    res.json(summary);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch energy summary' });
  }
});

// GET /api/energy/by-room - Energy breakdown by room
router.get('/by-room', (req, res) => {
  try {
    const data = energyEngine.getByRoom();
    res.json(data);
  } catch (err) {
    console.error('[API] Error fetching energy by room:', err.message);
    res.status(500).json({ error: 'Failed to fetch energy by room' });
  }
});

// GET /api/energy/by-device - Energy breakdown by device type
router.get('/by-device', (req, res) => {
  try {
    const data = energyEngine.getByDeviceType();
    res.json(data);
  } catch (err) {
    console.error('[API] Error fetching energy by device:', err.message);
    res.status(500).json({ error: 'Failed to fetch energy by device type' });
  }
});

// GET /api/energy/records - Energy time series records
router.get('/records', (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 100;
    const roomId = req.query.roomId ? parseInt(req.query.roomId) : null;
    const records = energyEngine.getRecords(limit, roomId);
    res.json(records);
  } catch (err) {
    console.error('[API] Error fetching energy records:', err.message);
    res.status(500).json({ error: 'Failed to fetch energy records' });
  }
});

// GET /api/energy/trend - Energy trend data
router.get('/trend', (req, res) => {
  try {
    const trend = energyEngine.getTrend();
    res.json(trend);
  } catch (err) {
    console.error('[API] Error fetching energy trend:', err.message);
    res.status(500).json({ error: 'Failed to fetch energy trend' });
  }
});

module.exports = router;
