const express = require('express');
const router = express.Router();
const occupancyEngine = require('../services/occupancyEngine');
const { getConnection } = require('../database/connection');

// GET /api/occupancy - All occupancy states
router.get('/', (req, res) => {
  try {
    const states = occupancyEngine.getAllStates();
    res.json(states);
  } catch (err) {
    console.error('[API] Error fetching occupancy states:', err.message);
    res.status(500).json({ error: 'Failed to fetch occupancy states' });
  }
});

// GET /api/occupancy/settings/failsafe - Get fail-safe & stability settings
router.get('/settings/failsafe', (req, res) => {
  try {
    const policy = occupancyEngine.getFailSafePolicy();
    const thresholds = occupancyEngine.getStabilityThresholds();
    res.json({ policy, ...thresholds });
  } catch (err) {
    console.error('[API] Error fetching fail-safe settings:', err.message);
    res.status(500).json({ error: 'Failed to fetch settings' });
  }
});

// PUT /api/occupancy/settings/failsafe - Update fail-safe policy
router.put('/settings/failsafe', (req, res) => {
  try {
    const { policy, bufferOn, bufferOff } = req.body;
    const db = getConnection();

    if (policy) {
      if (!['turn_off', 'keep_state'].includes(policy)) {
        return res.status(400).json({ error: 'Policy must be "turn_off" or "keep_state"' });
      }
      db.prepare("INSERT OR REPLACE INTO settings (key, value) VALUES ('camera_failsafe_policy', ?)").run(policy);
    }

    if (bufferOn !== undefined) {
      db.prepare("INSERT OR REPLACE INTO settings (key, value) VALUES ('stability_buffer_on', ?)").run(String(bufferOn));
    }

    if (bufferOff !== undefined) {
      db.prepare("INSERT OR REPLACE INTO settings (key, value) VALUES ('stability_buffer_off', ?)").run(String(bufferOff));
    }

    res.json({
      policy: occupancyEngine.getFailSafePolicy(),
      ...occupancyEngine.getStabilityThresholds()
    });
  } catch (err) {
    console.error('[API] Error updating fail-safe settings:', err.message);
    res.status(500).json({ error: 'Failed to update settings' });
  }
});

// GET /api/occupancy/:roomId - State for specific room
router.get('/:roomId', (req, res) => {
  try {
    const state = occupancyEngine.getState(parseInt(req.params.roomId));
    if (!state) return res.status(404).json({ error: 'Room not found' });
    res.json(state);
  } catch (err) {
    console.error('[API] Error fetching room occupancy:', err.message);
    res.status(500).json({ error: 'Failed to fetch occupancy state' });
  }
});

// POST /api/occupancy/:roomId/detection - Ingest detection from Webcam or CCTV
router.post('/:roomId/detection', (req, res) => {
  try {
    const roomId = parseInt(req.params.roomId);
    // Route through backgroundController so CCTV session stats update
    // and emergency mode is respected
    let result;
    try {
      const backgroundController = require('../services/backgroundController');
      result = backgroundController.processClientDetection(roomId, req.body);
    } catch (e) {
      // Fallback to direct call if controller not ready
      result = occupancyEngine.processDetection(roomId, req.body);
    }
    res.json(result || { success: true });
  } catch (err) {
    console.error('[API] Error processing detection:', err.message);
    res.status(500).json({ error: 'Failed to process detection' });
  }
});


// POST /api/occupancy/:roomId/failure - Report camera failure / stream loss
router.post('/:roomId/failure', (req, res) => {
  try {
    const roomId = parseInt(req.params.roomId);
    occupancyEngine.handleCameraFailure(roomId, req.body);
    res.json({ success: true, state: 'UNKNOWN', failSafeApplied: true });
  } catch (err) {
    console.error('[API] Error reporting camera failure:', err.message);
    res.status(500).json({ error: 'Failed to process camera failure' });
  }
});

module.exports = router;
