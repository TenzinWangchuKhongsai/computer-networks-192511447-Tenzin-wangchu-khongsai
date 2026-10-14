const express = require('express');
const router = express.Router();
const realDeviceService = require('../services/realDeviceService');
const commandQueue = require('../services/commandQueue');

// GET /api/real-devices - List all real devices
router.get('/', (req, res) => {
  try {
    const { roomId } = req.query;
    const devices = realDeviceService.getAll(roomId ? parseInt(roomId) : null);
    res.json(devices);
  } catch (err) {
    console.error('[API] Error fetching real devices:', err.message);
    res.status(500).json({ error: 'Failed to fetch real devices' });
  }
});

// GET /api/real-devices/commands/recent - Recent commands log
router.get('/commands/recent', (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 50;
    const commands = commandQueue.getHistory(limit);
    res.json(commands);
  } catch (err) {
    console.error('[API] Error fetching command history:', err.message);
    res.status(500).json({ error: 'Failed to fetch command history' });
  }
});

// GET /api/real-devices/stats - Real devices stats
router.get('/stats', (req, res) => {
  try {
    const stats = realDeviceService.getStats();
    res.json(stats);
  } catch (err) {
    console.error('[API] Error fetching real device stats:', err.message);
    res.status(500).json({ error: 'Failed to fetch stats' });
  }
});

// POST /api/real-devices/test-connection - Test hardware connectivity before saving
router.post('/test-connection', async (req, res) => {
  try {
    const result = await realDeviceService.testConnection(req.body);
    res.json(result);
  } catch (err) {
    console.error('[API] Test connection error:', err.message);
    res.status(500).json({
      success: false,
      status: 'error',
      message: `Test connection failed: ${err.message}`
    });
  }
});

// GET /api/real-devices/:id - Single device
router.get('/:id', (req, res) => {
  try {
    const device = realDeviceService.getById(parseInt(req.params.id));
    if (!device) return res.status(404).json({ error: 'Device not found' });
    res.json(device);
  } catch (err) {
    console.error('[API] Error fetching device:', err.message);
    res.status(500).json({ error: 'Failed to fetch device' });
  }
});

// POST /api/real-devices - Register new real device
router.post('/', async (req, res) => {
  try {
    const device = await realDeviceService.create(req.body);
    res.status(201).json(device);
  } catch (err) {
    console.error('[API] Error registering device:', err.message);
    res.status(400).json({ error: err.message });
  }
});

// PUT /api/real-devices/:id - Update real device
router.put('/:id', async (req, res) => {
  try {
    const device = await realDeviceService.update(parseInt(req.params.id), req.body);
    res.json(device);
  } catch (err) {
    console.error('[API] Error updating device:', err.message);
    res.status(400).json({ error: err.message });
  }
});

// DELETE /api/real-devices/:id - Remove real device
router.delete('/:id', (req, res) => {
  try {
    const success = realDeviceService.delete(parseInt(req.params.id));
    res.json({ success });
  } catch (err) {
    console.error('[API] Error deleting device:', err.message);
    res.status(500).json({ error: 'Failed to delete device' });
  }
});

// POST /api/real-devices/:id/toggle - Manual Toggle
router.post('/:id/toggle', async (req, res) => {
  try {
    const result = await realDeviceService.toggle(parseInt(req.params.id));
    res.json(result);
  } catch (err) {
    console.error('[API] Error toggling device:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// POST /api/real-devices/:id/set - Set state explicitly
router.post('/:id/set', async (req, res) => {
  try {
    const { status } = req.body;
    const targetOn = status === true || status === 'ON' || status === 1;
    const result = await realDeviceService.setPowerState(parseInt(req.params.id), targetOn);
    res.json(result);
  } catch (err) {
    console.error('[API] Error setting device power:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/real-devices/:id/mode - Toggle AUTO / MANUAL mode
router.put('/:id/mode', (req, res) => {
  try {
    const { mode } = req.body;
    const device = realDeviceService.setControlMode(parseInt(req.params.id), mode);
    res.json(device);
  } catch (err) {
    console.error('[API] Error setting device mode:', err.message);
    res.status(400).json({ error: err.message });
  }
});

module.exports = router;
