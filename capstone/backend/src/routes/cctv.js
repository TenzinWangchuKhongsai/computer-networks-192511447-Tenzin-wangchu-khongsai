const express = require('express');
const router = express.Router();
const cameraService = require('../services/cameraService');

// GET /api/cctv - List all CCTV sources
router.get('/', (req, res) => {
  try {
    const sources = cameraService.getAllSources();
    res.json(sources);
  } catch (err) {
    console.error('[API] Error fetching CCTV sources:', err.message);
    res.status(500).json({ error: 'Failed to fetch CCTV sources' });
  }
});

// POST /api/cctv/test-connection - Test camera connection before saving
router.post('/test-connection', async (req, res) => {
  try {
    const result = await cameraService.testConnection(req.body);
    res.json(result);
  } catch (err) {
    console.error('[API] CCTV test error:', err.message);
    res.status(500).json({
      success: false,
      status: 'error',
      message: `Test connection failed: ${err.message}`
    });
  }
});

// GET /api/cctv/:id - Single source
router.get('/:id', (req, res) => {
  try {
    const source = cameraService.getSource(parseInt(req.params.id));
    if (!source) return res.status(404).json({ error: 'CCTV source not found' });
    res.json(source);
  } catch (err) {
    console.error('[API] Error fetching CCTV source:', err.message);
    res.status(500).json({ error: 'Failed to fetch CCTV source' });
  }
});

// POST /api/cctv - Register new CCTV source
router.post('/', async (req, res) => {
  try {
    const source = await cameraService.createSource(req.body);
    res.status(201).json(source);
  } catch (err) {
    console.error('[API] Error creating CCTV source:', err.message);
    res.status(400).json({ error: err.message });
  }
});

// PUT /api/cctv/:id - Update CCTV source
router.put('/:id', async (req, res) => {
  try {
    const source = await cameraService.updateSource(parseInt(req.params.id), req.body);
    res.json(source);
  } catch (err) {
    console.error('[API] Error updating CCTV source:', err.message);
    res.status(400).json({ error: err.message });
  }
});

// DELETE /api/cctv/:id - Delete CCTV source
router.delete('/:id', (req, res) => {
  try {
    const success = cameraService.deleteSource(parseInt(req.params.id));
    res.json({ success });
  } catch (err) {
    console.error('[API] Error deleting CCTV source:', err.message);
    res.status(500).json({ error: 'Failed to delete CCTV source' });
  }
});

// POST /api/cctv/:id/test - Test connection of registered source
router.post('/:id/test', async (req, res) => {
  try {
    const source = cameraService.getSource(parseInt(req.params.id), true);
    if (!source) return res.status(404).json({ error: 'CCTV source not found' });
    const result = await cameraService.testConnection(source);
    res.json(result);
  } catch (err) {
    console.error('[API] Error testing CCTV source:', err.message);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
