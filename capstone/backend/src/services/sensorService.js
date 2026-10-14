const { getConnection } = require('../database/connection');

class SensorService {
  /**
   * Get all sensors, optionally filtered by room
   */
  getAll(roomId = null) {
    const db = getConnection();
    if (roomId) {
      return db.prepare('SELECT * FROM sensors WHERE room_id = ? ORDER BY type').all(roomId);
    }
    return db.prepare('SELECT s.*, r.name as room_name FROM sensors s JOIN rooms r ON s.room_id = r.id ORDER BY s.room_id, s.type').all();
  }

  /**
   * Get a single sensor by ID
   */
  getById(id) {
    const db = getConnection();
    return db.prepare('SELECT s.*, r.name as room_name FROM sensors s JOIN rooms r ON s.room_id = r.id WHERE s.id = ?').get(id);
  }

  /**
   * Get sensor by room and type
   */
  getByRoomAndType(roomId, type) {
    const db = getConnection();
    return db.prepare('SELECT * FROM sensors WHERE room_id = ? AND type = ?').get(roomId, type);
  }

  /**
   * Update a sensor's value
   */
  updateValue(id, value) {
    const db = getConnection();
    db.prepare('UPDATE sensors SET value = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(value, id);
    return this.getById(id);
  }

  /**
   * Update sensor by room and type
   */
  updateByRoomAndType(roomId, type, value) {
    const db = getConnection();
    db.prepare('UPDATE sensors SET value = ?, updated_at = CURRENT_TIMESTAMP WHERE room_id = ? AND type = ?').run(value, roomId, type);
    return this.getByRoomAndType(roomId, type);
  }

  /**
   * Validate sensor value based on type
   */
  validateValue(type, value) {
    switch (type) {
      case 'occupancy':
        return value === 0 || value === 1;
      case 'temperature':
        return value >= -10 && value <= 60;
      case 'light':
        return value >= 0 && value <= 100;
      case 'energy':
        return value >= 0;
      default:
        return false;
    }
  }
}

module.exports = new SensorService();
