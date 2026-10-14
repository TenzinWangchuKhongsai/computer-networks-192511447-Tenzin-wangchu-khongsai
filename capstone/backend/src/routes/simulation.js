const express = require('express');
const router = express.Router();
const simulationEngine = require('../services/simulationEngine');

// GET /api/simulation/status - Get simulation status
router.get('/status', (req, res) => {
  try {
    res.json(simulationEngine.getStatus());
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch simulation status' });
  }
});

// POST /api/simulation/start - Start simulation
router.post('/start', (req, res) => {
  try {
    simulationEngine.start();
    res.json(simulationEngine.getStatus());
  } catch (err) {
    console.error('[API] Error starting simulation:', err.message);
    res.status(500).json({ error: 'Failed to start simulation' });
  }
});

// POST /api/simulation/pause - Pause simulation
router.post('/pause', (req, res) => {
  try {
    simulationEngine.pause();
    res.json(simulationEngine.getStatus());
  } catch (err) {
    console.error('[API] Error pausing simulation:', err.message);
    res.status(500).json({ error: 'Failed to pause simulation' });
  }
});

// POST /api/simulation/reset - Reset simulation
router.post('/reset', (req, res) => {
  try {
    simulationEngine.reset();
    res.json(simulationEngine.getStatus());
  } catch (err) {
    console.error('[API] Error resetting simulation:', err.message);
    res.status(500).json({ error: 'Failed to reset simulation' });
  }
});

// POST /api/simulation/step - Execute one simulation step
router.post('/step', (req, res) => {
  try {
    simulationEngine.step();
    res.json(simulationEngine.getStatus());
  } catch (err) {
    console.error('[API] Error stepping simulation:', err.message);
    res.status(500).json({ error: 'Failed to execute simulation step' });
  }
});

// PUT /api/simulation/speed - Set simulation speed
router.put('/speed', (req, res) => {
  try {
    const { speed } = req.body;
    if (![0.5, 1, 2, 5, 10].includes(speed)) {
      return res.status(400).json({ error: 'Speed must be one of: 0.5, 1, 2, 5, 10' });
    }
    simulationEngine.setSpeed(speed);
    res.json(simulationEngine.getStatus());
  } catch (err) {
    console.error('[API] Error setting speed:', err.message);
    res.status(500).json({ error: 'Failed to set simulation speed' });
  }
});

// PUT /api/simulation/auto - Toggle auto-simulation
router.put('/auto', (req, res) => {
  try {
    const { enabled } = req.body;
    if (typeof enabled !== 'boolean') {
      return res.status(400).json({ error: 'enabled must be a boolean' });
    }
    simulationEngine.setAutoSimulation(enabled);
    res.json(simulationEngine.getStatus());
  } catch (err) {
    console.error('[API] Error toggling auto-simulation:', err.message);
    res.status(500).json({ error: 'Failed to toggle auto-simulation' });
  }
});

module.exports = router;
