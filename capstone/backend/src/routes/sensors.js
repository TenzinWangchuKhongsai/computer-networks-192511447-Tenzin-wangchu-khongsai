const express = require('express');
const router = express.Router();
const sensorService = require('../services/sensorService');

// GET /api/sensors - Get all sensors
router.get('/', (req, res) => {
  try {
    const { roomId } = req.query;
    const sensors = sensorService.getAll(roomId ? parseInt(roomId) : null);
    res.json(sensors);
  } catch (err) {
    console.error('[API] Error fetching sensors:', err.message);
    res.status(500).json({ error: 'Failed to fetch sensors' });
  }
});

// GET /api/sensors/:id - Get single sensor
router.get('/:id', (req, res) => {
  try {
    const sensor = sensorService.getById(req.params.id);
    if (!sensor) return res.status(404).json({ error: 'Sensor not found' });
    res.json(sensor);
  } catch (err) {
    console.error('[API] Error fetching sensor:', err.message);
    res.status(500).json({ error: 'Failed to fetch sensor' });
  }
});

// PUT /api/sensors/:id - Update sensor value
router.put('/:id', (req, res) => {
  try {
    const sensor = sensorService.getById(req.params.id);
    if (!sensor) return res.status(404).json({ error: 'Sensor not found' });

    const { value } = req.body;
    if (value === undefined || value === null) {
      return res.status(400).json({ error: 'value is required' });
    }

    if (!sensorService.validateValue(sensor.type, value)) {
      return res.status(400).json({ error: `Invalid value for ${sensor.type} sensor` });
    }

    const updated = sensorService.updateValue(sensor.id, value);
    res.json(updated);
  } catch (err) {
    console.error('[API] Error updating sensor:', err.message);
    res.status(500).json({ error: 'Failed to update sensor' });
  }
});

module.exports = router;
