const { getConnection } = require('../database/connection');
const deviceService = require('../services/deviceService');
const sensorService = require('../services/sensorService');
const automationEngine = require('../services/automationEngine');
const energyEngine = require('../services/energyEngine');
const realDeviceService = require('../services/realDeviceService');
const cameraService = require('../services/cameraService');
const realEnergyService = require('../services/realEnergyService');

function setupWebSocket(io) {
  io.on('connection', (socket) => {
    console.log(`[WS] Client connected: ${socket.id}`);

    // Send initial full state on connection
    sendFullState(socket);

    // Handle enter room
    socket.on('enter-room', (data) => {
      const { roomId } = data;
      handleOccupancy(io, roomId, true);
    });

    // Handle leave room
    socket.on('leave-room', (data) => {
      const { roomId } = data;
      handleOccupancy(io, roomId, false);
    });

    // Handle virtual device toggle
    socket.on('toggle-device', (data) => {
      const { deviceId } = data;
      const device = deviceService.toggle(deviceId);
      if (device) {
        const devices = deviceService.getAll(device.room_id);
        io.emit('device-update', { roomId: device.room_id, devices });
      }
    });

    // Handle real device toggle
    socket.on('toggle-real-device', async (data) => {
      const { deviceId } = data;
      try {
        await realDeviceService.toggle(deviceId);
      } catch (err) {
        socket.emit('error-msg', { message: err.message });
      }
    });

    // Handle sensor change
    socket.on('change-sensor', (data) => {
      const { roomId, type, value } = data;
      const db = getConnection();

      if (type === 'temperature') {
        db.prepare('UPDATE rooms SET temperature = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(value, roomId);
      } else if (type === 'light') {
        db.prepare('UPDATE rooms SET light_level = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(value, roomId);
      }

      sensorService.updateByRoomAndType(roomId, type, value);
      automationEngine.evaluateRoom(roomId);

      io.emit('sensor-update', { roomId, type, value });

      const room = db.prepare('SELECT * FROM rooms WHERE id = ?').get(roomId);
      const devices = deviceService.getAll(roomId);
      const sensors = sensorService.getAll(roomId);
      io.emit('room-update', {
        roomId,
        room: { ...room, devices, sensors, currentPower: deviceService.getRoomPower(roomId) }
      });
    });

    // Handle request full state
    socket.on('request-state', () => {
      sendFullState(socket);
    });

    socket.on('disconnect', () => {
      console.log(`[WS] Client disconnected: ${socket.id}`);
    });
  });
}

function handleOccupancy(io, roomId, occupied) {
  const db = getConnection();
  const room = db.prepare('SELECT * FROM rooms WHERE id = ?').get(roomId);
  if (!room) return;

  const occupancy = occupied ? 1 : 0;
  db.prepare('UPDATE rooms SET occupancy = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?')
    .run(occupancy, roomId);
  sensorService.updateByRoomAndType(roomId, 'occupancy', occupancy);

  const action = occupied ? 'became occupied' : 'became empty';
  db.prepare('INSERT INTO events (type, room_id, message) VALUES (?, ?, ?)')
    .run('occupancy', roomId, `${room.name} ${action}`);

  // Run automation
  automationEngine.evaluateRoom(roomId);

  // Broadcast updates
  const updatedRoom = db.prepare('SELECT * FROM rooms WHERE id = ?').get(roomId);
  const devices = deviceService.getAll(roomId);
  const sensors = sensorService.getAll(roomId);

  io.emit('room-update', {
    roomId,
    room: { ...updatedRoom, devices, sensors, currentPower: deviceService.getRoomPower(roomId) }
  });

  io.emit('event-new', {
    type: 'occupancy',
    room_id: roomId,
    message: `${room.name} ${action}`,
    timestamp: new Date().toISOString()
  });
}

function sendFullState(socket) {
  const db = getConnection();
  const rooms = db.prepare('SELECT * FROM rooms ORDER BY floor, id').all();
  const devices = deviceService.getAll();
  const sensors = sensorService.getAll();
  const energySummary = energyEngine.getSummary();
  const realDevices = realDeviceService.getAll();
  const cctvSources = cameraService.getAllSources();
  const unifiedEnergy = realEnergyService.getSummary();

  const enrichedRooms = rooms.map(room => ({
    ...room,
    devices: devices.filter(d => d.room_id === room.id),
    sensors: sensors.filter(s => s.room_id === room.id),
    realDevices: realDevices.filter(d => d.room_id === room.id),
    currentPower: devices.filter(d => d.room_id === room.id && d.status)
      .reduce((sum, d) => sum + d.power_rating, 0)
  }));

  socket.emit('full-state', {
    rooms: enrichedRooms,
    devices,
    sensors,
    energy: energySummary,
    realDevices,
    cctvSources,
    unifiedEnergy
  });
}

module.exports = { setupWebSocket };
