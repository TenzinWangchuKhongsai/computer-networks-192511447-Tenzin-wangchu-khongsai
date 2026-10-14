const express = require('express');
const router = express.Router();
const deviceService = require('../services/deviceService');
const automationEngine = require('../services/automationEngine');
const { getConnection } = require('../database/connection');

// GET /api/devices - Get all devices
router.get('/', (req, res) => {
  try {
    const { roomId } = req.query;
    const devices = deviceService.getAll(roomId ? parseInt(roomId) : null);
    res.json(devices);
  } catch (err) {
    console.error('[API] Error fetching devices:', err.message);
    res.status(500).json({ error: 'Failed to fetch devices' });
  }
});

// GET /api/devices/:id - Get single device
router.get('/:id', (req, res) => {
  try {
    const device = deviceService.getById(req.params.id);
    if (!device) return res.status(404).json({ error: 'Device not found' });
    res.json(device);
  } catch (err) {
    console.error('[API] Error fetching device:', err.message);
    res.status(500).json({ error: 'Failed to fetch device' });
  }
});

// POST /api/devices/:id/toggle - Toggle device ON/OFF
router.post('/:id/toggle', (req, res) => {
  try {
    const db = getConnection();
    const device = deviceService.getById(req.params.id);
    if (!device) return res.status(404).json({ error: 'Device not found' });

    // Check room mode
    const room = db.prepare('SELECT * FROM rooms WHERE id = ?').get(device.room_id);
    if (!room) return res.status(404).json({ error: 'Room not found' });

    const updatedDevice = deviceService.toggle(device.id);
    const statusLabel = updatedDevice.status ? 'ON' : 'OFF';

    // Log event
    db.prepare('INSERT INTO events (type, room_id, message) VALUES (?, ?, ?)').run(
      'device', room.id,
      `${device.type.charAt(0).toUpperCase() + device.type.slice(1)} turned ${statusLabel} in ${room.name}`
    );

    // Broadcast
    const io = req.app.get('io');
    if (io) {
      const allDevices = deviceService.getAll(room.id);
      io.emit('device-update', { roomId: room.id, devices: allDevices });
      io.emit('event-new', {
        type: 'device', room_id: room.id,
        message: `${device.type.charAt(0).toUpperCase() + device.type.slice(1)} turned ${statusLabel} in ${room.name}`,
        timestamp: new Date().toISOString()
      });
    }

    res.json(updatedDevice);
  } catch (err) {
    console.error('[API] Error toggling device:', err.message);
    res.status(500).json({ error: 'Failed to toggle device' });
  }
});

// POST /api/devices/:id/set - Set device status explicitly
router.post('/:id/set', (req, res) => {
  try {
    const db = getConnection();
    const device = deviceService.getById(req.params.id);
    if (!device) return res.status(404).json({ error: 'Device not found' });

    const { status } = req.body;
    if (typeof status !== 'boolean') {
      return res.status(400).json({ error: 'status must be a boolean' });
    }

    const updatedDevice = deviceService.setStatus(device.id, status);
    const room = db.prepare('SELECT name FROM rooms WHERE id = ?').get(device.room_id);
    const statusLabel = status ? 'ON' : 'OFF';

    db.prepare('INSERT INTO events (type, room_id, message) VALUES (?, ?, ?)').run(
      'device', device.room_id,
      `[MANUAL] ${device.type.charAt(0).toUpperCase() + device.type.slice(1)} set to ${statusLabel} in ${room.name}`
    );

    const io = req.app.get('io');
    if (io) {
      const allDevices = deviceService.getAll(device.room_id);
      io.emit('device-update', { roomId: device.room_id, devices: allDevices });
    }

    res.json(updatedDevice);
  } catch (err) {
    console.error('[API] Error setting device:', err.message);
    res.status(500).json({ error: 'Failed to set device status' });
  }
});

// GET /api/devices/stats/summary - Device statistics
router.get('/stats/summary', (req, res) => {
  try {
    const activeCount = deviceService.getActiveCount();
    const totalPower = deviceService.getTotalPower();
    const powerByType = deviceService.getPowerByType();
    res.json({ activeCount, totalPower, powerByType });
  } catch (err) {
    console.error('[API] Error fetching device stats:', err.message);
    res.status(500).json({ error: 'Failed to fetch device stats' });
  }
});

// POST /api/devices/bulk - Bulk configure devices
router.post('/bulk', (req, res) => {
  try {
    const { roomIds, deviceTypes, status, setManualMode } = req.body;
    if (typeof status !== 'boolean') {
      return res.status(400).json({ error: 'status must be a boolean' });
    }
    const db = getConnection();
    const updatedDevices = [];
    const affectedRoomIds = new Set();
    
    // Determine target rooms
    let targetRooms = [];
    if (roomIds === 'all') {
      targetRooms = db.prepare('SELECT id FROM rooms').all().map(r => r.id);
    } else if (Array.isArray(roomIds)) {
      targetRooms = roomIds;
    } else {
      return res.status(400).json({ error: 'roomIds must be "all" or an array of numbers' });
    }

    if (targetRooms.length === 0) {
      return res.json({ message: 'No rooms updated', count: 0 });
    }

    // Determine target device types
    const validTypes = ['light', 'fan', 'cooling'];
    let targetTypes = [];
    if (deviceTypes === 'all') {
      targetTypes = validTypes;
    } else if (Array.isArray(deviceTypes)) {
      targetTypes = deviceTypes.filter(t => validTypes.includes(t));
    } else {
      return res.status(400).json({ error: 'deviceTypes must be "all" or an array of strings' });
    }

    if (targetTypes.length === 0) {
      return res.json({ message: 'No devices updated', count: 0 });
    }

    // Prepare queries
    const updateDeviceStmt = db.prepare('UPDATE devices SET status = ? WHERE room_id = ? AND type = ? RETURNING *');
    const updateRoomModeStmt = db.prepare('UPDATE rooms SET mode = ? WHERE id = ?');
    const getRoomNameStmt = db.prepare('SELECT name FROM rooms WHERE id = ?');
    
    const statusVal = status ? 1 : 0;
    
    db.transaction(() => {
      for (const roomId of targetRooms) {
        let roomAffected = false;
        
        for (const type of targetTypes) {
          const updated = updateDeviceStmt.get(statusVal, roomId, type);
          if (updated) {
            updatedDevices.push({
              ...updated,
              status: updated.status === 1
            });
            roomAffected = true;
          }
        }
        
        if (roomAffected) {
          affectedRoomIds.add(roomId);
        }
      }
      
      // Log bulk event
      if (affectedRoomIds.size > 0) {
        const typesStr = deviceTypes === 'all' ? 'All devices' : targetTypes.map(t => t.charAt(0).toUpperCase() + t.slice(1)).join(', ');
        const roomsStr = roomIds === 'all' ? 'all rooms' : `${affectedRoomIds.size} rooms`;
        const actionStr = status ? 'turned ON' : 'turned OFF';
        
        db.prepare('INSERT INTO events (type, room_id, message) VALUES (?, ?, ?)').run(
          'bulk_action', null,
          `[BULK] ${typesStr} ${actionStr} in ${roomsStr}`
        );
      }
    })();

    const io = req.app.get('io');
    if (io && affectedRoomIds.size > 0) {
      const allDevices = deviceService.getAll();
      const allRooms = db.prepare('SELECT * FROM rooms').all().map(r => ({
        ...r,
        occupancy: r.occupancy === 1
      }));
      
      // Broadcast full state update to ensure UI is completely synced
      const fullState = {
        rooms: allRooms.map(r => ({
          ...r,
          devices: allDevices.filter(d => d.room_id === r.id)
        })),
        stats: {
          activeCount: deviceService.getActiveCount(),
          totalPower: deviceService.getTotalPower()
        }
      };
      
      io.emit('full-state', fullState);
      
      const typesStr = deviceTypes === 'all' ? 'All devices' : targetTypes.map(t => t.charAt(0).toUpperCase() + t.slice(1)).join(', ');
      const roomsStr = roomIds === 'all' ? 'all rooms' : `${affectedRoomIds.size} rooms`;
      
      io.emit('event-new', {
        type: 'bulk_action',
        message: `[BULK] ${typesStr} ${status ? 'turned ON' : 'turned OFF'} in ${roomsStr}`,
        timestamp: new Date().toISOString()
      });
    }

    res.json({ 
      message: `Successfully updated devices in ${affectedRoomIds.size} rooms`,
      updatedCount: updatedDevices.length,
      affectedRooms: Array.from(affectedRoomIds)
    });
  } catch (err) {
    console.error('[API] Error in bulk device update:', err.message);
    res.status(500).json({ error: 'Failed to bulk update devices' });
  }
});

module.exports = router;
