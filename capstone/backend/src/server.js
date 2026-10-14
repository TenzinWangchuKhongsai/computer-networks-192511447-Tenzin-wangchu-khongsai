require('dotenv').config();
const express = require('express');
const http = require('http');
const cors = require('cors');
const { Server } = require('socket.io');
const { initializeDatabase } = require('./database/init');
const { setupWebSocket } = require('./websocket/handler');
const simulationEngine = require('./services/simulationEngine');

// Routes
const roomsRouter = require('./routes/rooms');
const devicesRouter = require('./routes/devices');
const sensorsRouter = require('./routes/sensors');
const automationRouter = require('./routes/automation');
const energyRouter = require('./routes/energy');
const eventsRouter = require('./routes/events');
const simulationRouter = require('./routes/simulation');
const settingsRouter = require('./routes/settings');
const realDevicesRouter = require('./routes/realDevices');
const cctvRouter = require('./routes/cctv');
const occupancyRouter = require('./routes/occupancy');

// IoT Services
const realDeviceService = require('./services/realDeviceService');
const cameraService = require('./services/cameraService');
const occupancyEngine = require('./services/occupancyEngine');
const realEnergyService = require('./services/realEnergyService');

// Background Controller (browser-independent IoT automation)
const backgroundController = require('./services/backgroundController');

const app = express();
const server = http.createServer(app);
const PORT = process.env.PORT || 3001;
const HOST = process.env.HOST || '0.0.0.0'; // Bind to all interfaces for LAN access
const CORS_ORIGIN = process.env.CORS_ORIGIN || true; // Allow all origins for cross-device access


// Socket.IO
const io = new Server(server, {
  cors: {
    origin: CORS_ORIGIN,
    methods: ['GET', 'POST', 'PUT', 'DELETE'],
    credentials: false
  },
  transports: ['websocket', 'polling']
});

// Middleware
app.use(cors({ origin: CORS_ORIGIN, credentials: false }));
app.use(express.json());


// Make io available to routes
app.set('io', io);

// API Routes
app.use('/api/rooms', roomsRouter);
app.use('/api/devices', devicesRouter);
app.use('/api/sensors', sensorsRouter);
app.use('/api/automation', automationRouter);
app.use('/api/energy', energyRouter);
app.use('/api/events', eventsRouter);
app.use('/api/simulation', simulationRouter);
app.use('/api/settings', settingsRouter);
app.use('/api/real-devices', realDevicesRouter);
app.use('/api/cctv', cctvRouter);
app.use('/api/occupancy', occupancyRouter);

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'online', timestamp: new Date().toISOString() });
});

// System Health - full background controller status
app.get('/api/system/health', (req, res) => {
  res.json(backgroundController.getHealth());
});

// Controller settings
app.get('/api/controller/settings', (req, res) => {
  res.json(backgroundController._getPublicSettings());
});

// Automation master switch
app.post('/api/controller/automation', (req, res) => {
  const { enabled } = req.body;
  if (typeof enabled !== 'boolean') return res.status(400).json({ error: 'enabled must be boolean' });
  backgroundController.setAutomation(enabled);
  res.json({ success: true, automationEnabled: enabled });
});

// Master Turn Off — turns off all real devices with verification
app.post('/api/controller/turn-all-off', async (req, res) => {
  try {
    const result = await backgroundController.masterTurnOff();
    res.json(result);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// Emergency Shutdown
app.post('/api/controller/emergency', async (req, res) => {
  try {
    const result = await backgroundController.activateEmergency();
    res.json(result);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// Clear Emergency Mode
app.delete('/api/controller/emergency', (req, res) => {
  backgroundController.clearEmergency();
  res.json({ success: true, emergencyMode: false });
});

// Device Group Control
app.post('/api/controller/group', async (req, res) => {
  try {
    const { group, turnOn } = req.body;
    if (!group || typeof turnOn !== 'boolean') return res.status(400).json({ error: 'group and turnOn required' });
    const result = await backgroundController.groupControl(group, turnOn);
    res.json(result);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// Client reports detection result (webcam AI runs in browser, result reported to backend)
app.post('/api/occupancy/report-detection', (req, res) => {
  try {
    const { roomId, source, cctvSourceId, sourceName, personDetected, confidence, personCount, isFailure } = req.body;
    if (!roomId) return res.status(400).json({ error: 'roomId required' });
    const result = backgroundController.processClientDetection(roomId, {
      source, cctvSourceId, sourceName, personDetected, confidence, personCount, isFailure
    });
    res.json({ success: true, result });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// CCTV monitor status
app.get('/api/cctv/monitor-status', (req, res) => {
  const sessions = Array.from(backgroundController.cctvSessions.values()).map(s => ({
    cctvId: s.cctvId, name: s.name, status: s.status,
    streamStatus: s.streamStatus, detectionStatus: s.detectionStatus,
    occupancyStatus: s.occupancyStatus, failCount: s.failCount,
    lastCheck: s.lastCheck, frameCount: s.frameCount,
  }));
  res.json({ count: sessions.length, sessions });
});

// Network info
app.get('/api/network-info', (req, res) => {
  const os = require('os');
  const interfaces = os.networkInterfaces();
  const addresses = [];
  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name]) {
      if (iface.family === 'IPv4' && !iface.internal) addresses.push({ name, address: iface.address });
    }
  }
  res.json({
    port: PORT,
    frontendPort: 5173,
    addresses,
    primaryAddress: addresses[0]?.address || '127.0.0.1',
    timestamp: new Date().toISOString(),
    controller: {
      status: backgroundController.isRunning ? 'RUNNING' : 'STOPPED',
      automationEnabled: backgroundController.settings.automationEnabled,
      emergencyMode: backgroundController.settings.emergencyMode,
      cctvMonitors: backgroundController.cctvSessions.size,
    }
  });
});

// Global error handler
app.use((err, req, res, next) => {
  console.error('[ERROR]', err.message);
  res.status(500).json({ error: 'Internal server error' });
});

// Initialize
initializeDatabase();
setupWebSocket(io);
simulationEngine.setIO(io);
simulationEngine.start();
simulationEngine.setAutoSimulation(true);

// Initialize Real-World IoT Services
realDeviceService.setIO(io);
cameraService.setIO(io);
occupancyEngine.setIO(io);
realEnergyService.setIO(io);
realEnergyService.start();

// Start Background Controller — runs independently of browser clients
backgroundController.setIO(io);
backgroundController.start();

server.listen(PORT, HOST, () => {
  const os = require('os');
  const ifaces = os.networkInterfaces();
  let lanIP = 'localhost';
  for (const name of Object.keys(ifaces)) {
    for (const iface of (ifaces[name] || [])) {
      if (iface.family === 'IPv4' && !iface.internal) { lanIP = iface.address; break; }
    }
    if (lanIP !== 'localhost') break;
  }

  console.log('');
  console.log('╔══════════════════════════════════════════════════════════╗');
  console.log('║    Smart Office IoT Control Platform — Backend            ║');
  console.log('╠══════════════════════════════════════════════════════════╣');
  console.log(`║  Local:        http://localhost:${PORT}                    ║`);
  console.log(`║  LAN:          http://${lanIP}:${PORT}                ║`);
  console.log(`║  Frontend:     http://${lanIP}:5173                  ║`);
  console.log(`║  WebSocket:    ws://${lanIP}:${PORT}                 ║`);
  console.log('║  Controller:   🟢 Background services active              ║');
  console.log('║  Automation:   🟢 Running (browser-independent)           ║');
  console.log('╚══════════════════════════════════════════════════════════╝');
  console.log('');
});
