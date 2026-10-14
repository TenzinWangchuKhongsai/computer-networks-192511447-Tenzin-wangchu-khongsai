const express = require('express');
const router = express.Router();
const automationEngine = require('../services/automationEngine');

// GET /api/automation/rules - Get all rules
router.get('/rules', (req, res) => {
  try {
    const rules = automationEngine.getRules();
    res.json(rules);
  } catch (err) {
    console.error('[API] Error fetching rules:', err.message);
    res.status(500).json({ error: 'Failed to fetch automation rules' });
  }
});

// GET /api/automation/rules/:id - Get single rule
router.get('/rules/:id', (req, res) => {
  try {
    const rule = automationEngine.getRule(req.params.id);
    if (!rule) return res.status(404).json({ error: 'Rule not found' });
    res.json(rule);
  } catch (err) {
    console.error('[API] Error fetching rule:', err.message);
    res.status(500).json({ error: 'Failed to fetch rule' });
  }
});

// PUT /api/automation/rules/:id - Update rule
router.put('/rules/:id', (req, res) => {
  try {
    const rule = automationEngine.getRule(req.params.id);
    if (!rule) return res.status(404).json({ error: 'Rule not found' });

    const { enabled, threshold } = req.body;
    if (enabled === undefined && threshold === undefined) {
      return res.status(400).json({ error: 'Provide enabled or threshold to update' });
    }
    if (threshold !== undefined && (typeof threshold !== 'number' || threshold < 0)) {
      return res.status(400).json({ error: 'Invalid threshold value' });
    }

    const updated = automationEngine.updateRule(rule.id, { enabled, threshold });

    const io = req.app.get('io');
    if (io) {
      io.emit('automation-update', updated);
    }

    res.json(updated);
  } catch (err) {
    console.error('[API] Error updating rule:', err.message);
    res.status(500).json({ error: 'Failed to update rule' });
  }
});

// POST /api/automation/evaluate/:roomId - Manually trigger automation for a room
router.post('/evaluate/:roomId', (req, res) => {
  try {
    const actions = automationEngine.evaluateRoom(parseInt(req.params.roomId));
    res.json({ actions });
  } catch (err) {
    console.error('[API] Error evaluating automation:', err.message);
    res.status(500).json({ error: 'Failed to evaluate automation' });
  }
});

module.exports = router;
