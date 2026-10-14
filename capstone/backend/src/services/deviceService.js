const { getConnection } = require('../database/connection');

class DeviceService {
  /**
   * Get all devices, optionally filtered by room
   */
  getAll(roomId = null) {
    const db = getConnection();
    if (roomId) {
      return db.prepare('SELECT * FROM devices WHERE room_id = ? ORDER BY type').all(roomId);
    }
    return db.prepare('SELECT d.*, r.name as room_name FROM devices d JOIN rooms r ON d.room_id = r.id ORDER BY d.room_id, d.type').all();
  }

  /**
   * Get a single device by ID
   */
  getById(id) {
    const db = getConnection();
    return db.prepare('SELECT d.*, r.name as room_name FROM devices d JOIN rooms r ON d.room_id = r.id WHERE d.id = ?').get(id);
  }

  /**
   * Get device by room and type
   */
  getByRoomAndType(roomId, type) {
    const db = getConnection();
    return db.prepare('SELECT * FROM devices WHERE room_id = ? AND type = ?').get(roomId, type);
  }

  /**
   * Toggle device ON/OFF
   */
  toggle(id) {
    const db = getConnection();
    const device = this.getById(id);
    if (!device) return null;
    const newStatus = device.status ? 0 : 1;
    db.prepare('UPDATE devices SET status = ? WHERE id = ?').run(newStatus, id);
    return this.getById(id);
  }

  /**
   * Set device status explicitly
   */
  setStatus(id, status) {
    const db = getConnection();
    db.prepare('UPDATE devices SET status = ? WHERE id = ?').run(status ? 1 : 0, id);
    return this.getById(id);
  }

  /**
   * Set device status by room and type
   */
  setStatusByRoomAndType(roomId, type, status) {
    const db = getConnection();
    db.prepare('UPDATE devices SET status = ? WHERE room_id = ? AND type = ?').run(status ? 1 : 0, roomId, type);
    return this.getByRoomAndType(roomId, type);
  }

  /**
   * Turn off all devices in a room
   */
  turnOffAll(roomId) {
    const db = getConnection();
    db.prepare('UPDATE devices SET status = 0 WHERE room_id = ?').run(roomId);
    return this.getAll(roomId);
  }

  /**
   * Calculate total power consumption for a room
   */
  getRoomPower(roomId) {
    const db = getConnection();
    const result = db.prepare(
      'SELECT COALESCE(SUM(power_rating), 0) as total_power FROM devices WHERE room_id = ? AND status = 1'
    ).get(roomId);
    return result.total_power;
  }

  /**
   * Calculate total power consumption for all rooms
   */
  getTotalPower() {
    const db = getConnection();
    const result = db.prepare(
      'SELECT COALESCE(SUM(power_rating), 0) as total_power FROM devices WHERE status = 1'
    ).get();
    return result.total_power;
  }

  /**
   * Get power breakdown by device type
   */
  getPowerByType() {
    const db = getConnection();
    return db.prepare(
      'SELECT type, COUNT(*) as count, SUM(CASE WHEN status = 1 THEN 1 ELSE 0 END) as active_count, SUM(CASE WHEN status = 1 THEN power_rating ELSE 0 END) as total_power FROM devices GROUP BY type'
    ).all();
  }

  /**
   * Get count of active devices
   */
  getActiveCount() {
    const db = getConnection();
    const result = db.prepare('SELECT COUNT(*) as count FROM devices WHERE status = 1').get();
    return result.count;
  }
}

module.exports = new DeviceService();
