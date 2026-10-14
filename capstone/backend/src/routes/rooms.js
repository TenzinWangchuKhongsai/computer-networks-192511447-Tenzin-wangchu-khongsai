const express = require('express');
const router = express.Router();
const { getConnection } = require('../database/connection');
const deviceService = require('../services/deviceService');
const sensorService = require('../services/sensorService');
const automationEngine = require('../services/automationEngine');
const energyEngine = require('../services/energyEngine');

// GET /api/rooms - Get all rooms
router.get('/', (req, res) => {
  try {
    const db = getConnection();
    const rooms = db.prepare('SELECT * FROM rooms ORDER BY floor, id').all();

    // Enrich with device and sensor data
    const enriched = rooms.map(room => {
      const devices = deviceService.getAll(room.id);
      const sensors = sensorService.getAll(room.id);
      const currentPower = deviceService.getRoomPower(room.id);
      return { ...room, devices, sensors, currentPower };
    });

    res.json(enriched);
  } catch (err) {
    console.error('[API] Error fetching rooms:', err.message);
    res.status(500).json({ error: 'Failed to fetch rooms' });
  }
});

// GET /api/rooms/:id - Get room detail
router.get('/:id', (req, res) => {
  try {
    const db = getConnection();
    const room = db.prepare('SELECT * FROM rooms WHERE id = ?').get(req.params.id);
    if (!room) return res.status(404).json({ error: 'Room not found' });

    const devices = deviceService.getAll(room.id);
    const sensors = sensorService.getAll(room.id);
    const currentPower = deviceService.getRoomPower(room.id);

    res.json({ ...room, devices, sensors, currentPower });
  } catch (err) {
    console.error('[API] Error fetching room:', err.message);
    res.status(500).json({ error: 'Failed to fetch room' });
  }
});

// POST /api/rooms/occupancy/bulk - Set occupancy for multiple or all rooms
router.post('/occupancy/bulk', (req, res) => {
  try {
    const db = getConnection();
    const { occupied, roomIds, all } = req.body;
    if (typeof occupied !== 'boolean') {
      return res.status(400).json({ error: 'occupied must be a boolean' });
    }

    let targetRooms = [];
    if (all) {
      targetRooms = db.prepare('SELECT * FROM rooms').all();
    } else if (Array.isArray(roomIds) && roomIds.length > 0) {
      const placeholders = roomIds.map(() => '?').join(',');
      targetRooms = db.prepare(`SELECT * FROM rooms WHERE id IN (${placeholders})`).all(...roomIds);
    } else {
      return res.status(400).json({ error: 'Provide all: true or array of roomIds' });
    }

    const occupancy = occupied ? 1 : 0;
    const actionLabel = occupied ? 'became occupied' : 'became empty';
    const io = req.app.get('io');

    const updateTx = db.transaction(() => {
      for (const room of targetRooms) {
        db.prepare('UPDATE rooms SET occupancy = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?')
          .run(occupancy, room.id);
        sensorService.updateByRoomAndType(room.id, 'occupancy', occupancy);

        if (occupied) {
          deviceService.setStatusByRoomAndType(room.id, 'light', true);
        } else {
          deviceService.turnOffAll(room.id);
        }

        db.prepare('INSERT INTO events (type, room_id, message) VALUES (?, ?, ?)')
          .run('occupancy', room.id, `${room.name} ${actionLabel}`);

        automationEngine.evaluateRoom(room.id);
      }
    });

    updateTx();

    const targetDesc = all ? 'All rooms' : `${targetRooms.length} rooms`;
    db.prepare('INSERT INTO events (type, room_id, message) VALUES (?, ?, ?)')
      .run('bulk_action', null, `[BULK] ${targetDesc} set to ${occupied ? 'OCCUPIED' : 'EMPTY'}`);

    // Broadcast update
    if (io) {
      const rooms = db.prepare('SELECT * FROM rooms ORDER BY floor, id').all();
      const devices = deviceService.getAll();
      const sensors = sensorService.getAll();
      const energySummary = energyEngine.getSummary();

      const enrichedRooms = rooms.map(room => ({
        ...room,
        devices: devices.filter(d => d.room_id === room.id),
        sensors: sensors.filter(s => s.room_id === room.id),
        currentPower: deviceService.getRoomPower(room.id)
      }));

      io.emit('full-state', { rooms: enrichedRooms, devices, sensors, energy: energySummary });
    }

    res.json({ message: `Successfully updated ${targetRooms.length} rooms`, count: targetRooms.length });
  } catch (err) {
    console.error('[API] Error updating bulk occupancy:', err.message);
    res.status(500).json({ error: 'Failed to update bulk occupancy' });
  }
});

// POST /api/rooms/:id/occupancy - Set room occupancy (enter/leave)
router.post('/:id/occupancy', (req, res) => {
  try {
    const db = getConnection();
    const room = db.prepare('SELECT * FROM rooms WHERE id = ?').get(req.params.id);
    if (!room) return res.status(404).json({ error: 'Room not found' });

    const { occupied } = req.body;
    if (typeof occupied !== 'boolean') {
      return res.status(400).json({ error: 'occupied must be a boolean' });
    }

    const occupancy = occupied ? 1 : 0;
    db.prepare('UPDATE rooms SET occupancy = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?')
      .run(occupancy, room.id);
    sensorService.updateByRoomAndType(room.id, 'occupancy', occupancy);

    if (occupied) {
      deviceService.setStatusByRoomAndType(room.id, 'light', true);
    } else {
      deviceService.turnOffAll(room.id);
    }

    // Log event
    const action = occupied ? 'became occupied (light turned ON)' : 'became empty (all devices turned OFF)';
    db.prepare('INSERT INTO events (type, room_id, message) VALUES (?, ?, ?)')
      .run('occupancy', room.id, `${room.name} ${action}`);

    // Run automation
    const actions = automationEngine.evaluateRoom(room.id);

    // Broadcast
    const io = req.app.get('io');
    if (io) {
      const updatedRoom = db.prepare('SELECT * FROM rooms WHERE id = ?').get(room.id);
      const devices = deviceService.getAll(room.id);
      const sensors = sensorService.getAll(room.id);
      io.emit('room-update', {
        roomId: room.id,
        room: { ...updatedRoom, devices, sensors, currentPower: deviceService.getRoomPower(room.id) }
      });
      io.emit('event-new', {
        type: 'occupancy',
        room_id: room.id,
        message: `${room.name} ${action}`,
        timestamp: new Date().toISOString()
      });
    }

    const updatedRoom = db.prepare('SELECT * FROM rooms WHERE id = ?').get(room.id);
    const devices = deviceService.getAll(room.id);
    const sensors = sensorService.getAll(room.id);
    res.json({ ...updatedRoom, devices, sensors, currentPower: deviceService.getRoomPower(room.id), automationActions: actions });
  } catch (err) {
    console.error('[API] Error updating occupancy:', err.message);
    res.status(500).json({ error: 'Failed to update occupancy' });
  }
});

// PUT /api/rooms/:id/mode - Set room mode (auto/manual)
router.put('/:id/mode', (req, res) => {
  try {
    const db = getConnection();
    const room = db.prepare('SELECT * FROM rooms WHERE id = ?').get(req.params.id);
    if (!room) return res.status(404).json({ error: 'Room not found' });

    const { mode } = req.body;
    if (!['auto', 'manual'].includes(mode)) {
      return res.status(400).json({ error: 'Mode must be "auto" or "manual"' });
    }

    db.prepare('UPDATE rooms SET mode = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?')
      .run(mode, room.id);

    db.prepare('INSERT INTO events (type, room_id, message) VALUES (?, ?, ?)')
      .run('mode', room.id, `${room.name} switched to ${mode.toUpperCase()} mode`);

    const io = req.app.get('io');
    if (io) {
      io.emit('room-update', { roomId: room.id, changes: { mode } });
      io.emit('event-new', {
        type: 'mode', room_id: room.id,
        message: `${room.name} switched to ${mode.toUpperCase()} mode`,
        timestamp: new Date().toISOString()
      });
    }

    res.json({ id: room.id, mode });
  } catch (err) {
    console.error('[API] Error updating mode:', err.message);
    res.status(500).json({ error: 'Failed to update mode' });
  }
});

// PUT /api/rooms/:id/sensor - Update room sensor value
router.put('/:id/sensor', (req, res) => {
  try {
    const db = getConnection();
    const room = db.prepare('SELECT * FROM rooms WHERE id = ?').get(req.params.id);
    if (!room) return res.status(404).json({ error: 'Room not found' });

    const { type, value } = req.body;
    if (!['temperature', 'light', 'occupancy'].includes(type)) {
      return res.status(400).json({ error: 'Invalid sensor type' });
    }
    if (!sensorService.validateValue(type, value)) {
      return res.status(400).json({ error: `Invalid value for ${type} sensor` });
    }

    // Update room field
    if (type === 'temperature') {
      db.prepare('UPDATE rooms SET temperature = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(value, room.id);
    } else if (type === 'light') {
      db.prepare('UPDATE rooms SET light_level = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(value, room.id);
    } else if (type === 'occupancy') {
      db.prepare('UPDATE rooms SET occupancy = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(value, room.id);
      if (value === 1) {
        deviceService.setStatusByRoomAndType(room.id, 'light', true);
      } else {
        deviceService.turnOffAll(room.id);
      }
    }

    // Update sensor table
    sensorService.updateByRoomAndType(room.id, type, value);

    // Run automation
    const actions = automationEngine.evaluateRoom(room.id);

    // Broadcast
    const io = req.app.get('io');
    if (io) {
      io.emit('sensor-update', { roomId: room.id, type, value });
      const updatedRoom = db.prepare('SELECT * FROM rooms WHERE id = ?').get(room.id);
      const devices = deviceService.getAll(room.id);
      const sensors = sensorService.getAll(room.id);
      io.emit('room-update', {
        roomId: room.id,
        room: { ...updatedRoom, devices, sensors, currentPower: deviceService.getRoomPower(room.id) }
      });
    }

    res.json({ roomId: room.id, type, value, automationActions: actions });
  } catch (err) {
    console.error('[API] Error updating sensor:', err.message);
    res.status(500).json({ error: 'Failed to update sensor' });
  }
});

module.exports = router;
