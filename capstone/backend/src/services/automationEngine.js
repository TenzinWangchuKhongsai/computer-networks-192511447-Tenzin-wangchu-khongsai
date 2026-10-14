const { getConnection } = require('../database/connection');
const deviceService = require('./deviceService');

class AutomationEngine {
  constructor() {
    this.io = null;
  }

  setIO(io) {
    this.io = io;
  }

  /**
   * Get all automation rules
   */
  getRules() {
    const db = getConnection();
    return db.prepare('SELECT * FROM automation_rules ORDER BY priority DESC').all();
  }

  /**
   * Get a single rule by ID
   */
  getRule(id) {
    const db = getConnection();
    return db.prepare('SELECT * FROM automation_rules WHERE id = ?').get(id);
  }

  /**
   * Update a rule
   */
  updateRule(id, updates) {
    const db = getConnection();
    const { enabled, threshold } = updates;
    if (enabled !== undefined) {
      db.prepare('UPDATE automation_rules SET enabled = ? WHERE id = ?').run(enabled ? 1 : 0, id);
    }
    if (threshold !== undefined) {
      db.prepare('UPDATE automation_rules SET threshold = ? WHERE id = ?').run(threshold, id);
    }
    return this.getRule(id);
  }

  /**
   * Evaluate and execute automation rules for a specific room
   * Returns array of actions taken
   */
  evaluateRoom(roomId) {
    const db = getConnection();
    const room = db.prepare('SELECT * FROM rooms WHERE id = ?').get(roomId);
    if (!room) return [];

    const rules = db.prepare('SELECT * FROM automation_rules WHERE enabled = 1 ORDER BY priority DESC').all();
    const actions = [];

    for (const rule of rules) {
      const action = this._evaluateRule(rule, room);
      if (action) {
        this._executeAction(action, room);
        actions.push(action);
      }
    }

    return actions;
  }

  /**
   * Evaluate a single rule against a room
   */
  _evaluateRule(rule, room) {
    switch (rule.condition_type) {
      case 'empty_room':
        return this._evaluateEmptyRoom(rule, room);
      case 'low_light':
        return this._evaluateLowLight(rule, room);
      case 'high_light':
        return this._evaluateHighLight(rule, room);
      case 'high_temperature':
        return this._evaluateHighTemperature(rule, room);
      case 'moderate_temperature':
        return this._evaluateModerateTemperature(rule, room);
      case 'comfortable_temperature':
        return this._evaluateComfortableTemperature(rule, room);
      default:
        return null;
    }
  }

  _evaluateEmptyRoom(rule, room) {
    if (!room.occupancy) {
      // Check if any devices are still ON
      const devices = deviceService.getAll(room.id);
      const activeDevices = devices.filter(d => d.status === 1);
      if (activeDevices.length > 0) {
        return {
          rule: rule.name,
          roomId: room.id,
          roomName: room.name,
          action: 'turn_off',
          devices: 'all',
          reason: 'Room is empty - turning off all devices'
        };
      }
    }
    return null;
  }

  _evaluateLowLight(rule, room) {
    if (room.occupancy && room.light_level < rule.threshold) {
      const light = deviceService.getByRoomAndType(room.id, 'light');
      if (light && !light.status) {
        return {
          rule: rule.name,
          roomId: room.id,
          roomName: room.name,
          action: 'turn_on',
          devices: 'light',
          reason: `Light level (${room.light_level}%) below threshold (${rule.threshold}%)`
        };
      }
    }
    return null;
  }

  _evaluateHighLight(rule, room) {
    if (room.occupancy && room.light_level > rule.threshold) {
      const light = deviceService.getByRoomAndType(room.id, 'light');
      if (light && light.status) {
        return {
          rule: rule.name,
          roomId: room.id,
          roomName: room.name,
          action: 'turn_off',
          devices: 'light',
          reason: `Natural light (${room.light_level}%) sufficient (>${rule.threshold}%)`
        };
      }
    }
    return null;
  }

  _evaluateHighTemperature(rule, room) {
    if (room.occupancy && room.temperature > rule.threshold) {
      const cooling = deviceService.getByRoomAndType(room.id, 'cooling');
      if (cooling && !cooling.status) {
        return {
          rule: rule.name,
          roomId: room.id,
          roomName: room.name,
          action: 'turn_on',
          devices: 'cooling',
          reason: `Temperature (${room.temperature}°C) exceeds threshold (${rule.threshold}°C)`
        };
      }
    }
    return null;
  }

  _evaluateModerateTemperature(rule, room) {
    if (room.occupancy && room.temperature > rule.threshold) {
      const fan = deviceService.getByRoomAndType(room.id, 'fan');
      if (fan && !fan.status) {
        return {
          rule: rule.name,
          roomId: room.id,
          roomName: room.name,
          action: 'turn_on',
          devices: 'fan',
          reason: `Temperature (${room.temperature}°C) above comfort level (${rule.threshold}°C)`
        };
      }
    }
    return null;
  }

  _evaluateComfortableTemperature(rule, room) {
    if (room.temperature <= rule.threshold) {
      const cooling = deviceService.getByRoomAndType(room.id, 'cooling');
      if (cooling && cooling.status) {
        return {
          rule: rule.name,
          roomId: room.id,
          roomName: room.name,
          action: 'turn_off',
          devices: 'cooling',
          reason: `Temperature (${room.temperature}°C) comfortable (≤${rule.threshold}°C)`
        };
      }
    }
    return null;
  }

  /**
   * Execute an automation action
   */
  _executeAction(action, room) {
    const db = getConnection();

    if (action.action === 'turn_off' && action.devices === 'all') {
      deviceService.turnOffAll(action.roomId);
    } else if (action.action === 'turn_on') {
      deviceService.setStatusByRoomAndType(action.roomId, action.devices, true);
    } else if (action.action === 'turn_off') {
      deviceService.setStatusByRoomAndType(action.roomId, action.devices, false);
    }

    // Log event
    const deviceLabel = action.devices === 'all' ? 'All devices' : action.devices.charAt(0).toUpperCase() + action.devices.slice(1);
    const statusLabel = action.action === 'turn_on' ? 'ON' : 'OFF';
    const eventMsg = `[AUTO] ${deviceLabel} turned ${statusLabel} in ${room.name} — ${action.reason}`;

    db.prepare('INSERT INTO events (type, room_id, message) VALUES (?, ?, ?)').run(
      'automation', action.roomId, eventMsg
    );

    // Broadcast via WebSocket
    if (this.io) {
      const updatedDevices = deviceService.getAll(action.roomId);
      this.io.emit('device-update', { roomId: action.roomId, devices: updatedDevices });
      this.io.emit('event-new', {
        type: 'automation',
        room_id: action.roomId,
        message: eventMsg,
        timestamp: new Date().toISOString()
      });
    }
  }

  /**
   * Evaluate all rooms (used by simulation engine)
   */
  evaluateAllRooms() {
    const db = getConnection();
    const rooms = db.prepare('SELECT * FROM rooms').all();
    const allActions = [];
    for (const room of rooms) {
      if (room.mode === 'auto') {
        const actions = this.evaluateRoom(room.id);
        allActions.push(...actions);
      }
    }
    return allActions;
  }
}

module.exports = new AutomationEngine();
