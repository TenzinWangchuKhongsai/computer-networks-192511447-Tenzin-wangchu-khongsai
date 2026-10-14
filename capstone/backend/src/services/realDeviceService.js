const { getConnection } = require('../database/connection');
const { createDeviceAdapter } = require('./deviceAdapters');
const commandQueue = require('./commandQueue');

class RealDeviceService {
  constructor() {
    this.io = null;
  }

  setIO(io) {
    this.io = io;
    commandQueue.setIO(io);
  }

  /**
   * Get all real devices, enriched with room names
   */
  getAll(roomId = null) {
    const db = getConnection();
    if (roomId) {
      return db.prepare(`
        SELECT d.*, r.name as room_name
        FROM real_devices d
        LEFT JOIN rooms r ON d.room_id = r.id
        WHERE d.room_id = ?
        ORDER BY d.id
      `).all(roomId);
    }
    return db.prepare(`
      SELECT d.*, r.name as room_name
      FROM real_devices d
      LEFT JOIN rooms r ON d.room_id = r.id
      ORDER BY d.id
    `).all();
  }

  /**
   * Get single real device by ID
   */
  getById(id) {
    const db = getConnection();
    return db.prepare(`
      SELECT d.*, r.name as room_name
      FROM real_devices d
      LEFT JOIN rooms r ON d.room_id = r.id
      WHERE d.id = ?
    `).get(id);
  }

  /**
   * Test physical connection without saving
   */
  async testConnection(deviceData) {
    try {
      const adapter = createDeviceAdapter(deviceData);
      const result = await adapter.connect();
      return result;
    } catch (err) {
      return {
        success: false,
        status: 'error',
        message: `Connection test failed: ${err.message}`
      };
    }
  }

  /**
   * Register a new real device
   */
  async create(data) {
    const db = getConnection();
    const {
      name, room_id, type, connection_type, protocol,
      ip_address, port, bluetooth_identifier, config_json,
      rated_power_watts, control_mode
    } = data;

    if (!name || !type || !connection_type || !protocol) {
      throw new Error('Name, type, connection_type, and protocol are required.');
    }

    // Verify initial connection status
    let initialStatus = 'unknown';
    let lastSeen = null;
    let lastError = null;

    try {
      const testRes = await this.testConnection(data);
      if (testRes.success) {
        initialStatus = 'connected';
        lastSeen = new Date().toISOString();
      } else {
        initialStatus = testRes.status || 'disconnected';
        lastError = testRes.message;
      }
    } catch (e) {
      initialStatus = 'error';
      lastError = e.message;
    }

    const result = db.prepare(`
      INSERT INTO real_devices (
        name, room_id, type, connection_type, protocol,
        ip_address, port, bluetooth_identifier, config_json,
        rated_power_watts, state, control_mode, control_status,
        last_seen, last_error, total_runtime_seconds
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'OFF', ?, ?, ?, ?, 0)
    `).run(
      name,
      room_id || null,
      type,
      connection_type,
      protocol,
      ip_address || null,
      port ? parseInt(port) : null,
      bluetooth_identifier || null,
      typeof config_json === 'object' ? JSON.stringify(config_json) : (config_json || null),
      rated_power_watts ? parseFloat(rated_power_watts) : 40.0,
      control_mode || 'auto',
      initialStatus,
      lastSeen,
      lastError
    );

    const device = this.getById(result.lastInsertRowid);

    // Log registration event
    db.prepare('INSERT INTO events (type, room_id, message) VALUES (?, ?, ?)')
      .run('real_device', room_id || null, `Registered real device: ${name} (${connection_type.toUpperCase()})`);

    if (this.io) {
      this.io.emit('real-device-update', device);
    }

    return device;
  }

  /**
   * Update real device configuration
   */
  async update(id, updates) {
    const db = getConnection();
    const existing = this.getById(id);
    if (!existing) throw new Error('Device not found');

    const fields = [
      'name', 'room_id', 'type', 'connection_type', 'protocol',
      'ip_address', 'port', 'bluetooth_identifier', 'config_json',
      'rated_power_watts', 'control_mode'
    ];

    const sets = [];
    const values = [];

    for (const field of fields) {
      if (updates[field] !== undefined) {
        sets.push(`${field} = ?`);
        let val = updates[field];
        if (field === 'config_json' && typeof val === 'object') {
          val = JSON.stringify(val);
        }
        values.push(val);
      }
    }

    if (sets.length > 0) {
      values.push(id);
      db.prepare(`UPDATE real_devices SET ${sets.join(', ')} WHERE id = ?`).run(...values);
    }

    const updated = this.getById(id);
    if (this.io) {
      this.io.emit('real-device-update', updated);
    }
    return updated;
  }

  /**
   * Delete a real device
   */
  delete(id) {
    const db = getConnection();
    db.prepare('DELETE FROM device_commands WHERE device_id = ?').run(id);
    db.prepare('DELETE FROM real_automation_rules WHERE real_device_id = ?').run(id);
    const result = db.prepare('DELETE FROM real_devices WHERE id = ?').run(id);
    if (this.io) {
      this.io.emit('real-device-deleted', { id });
    }
    return result.changes > 0;
  }

  /**
   * Manual Toggle Device State
   */
  async toggle(id) {
    const device = this.getById(id);
    if (!device) throw new Error('Device not found');
    const targetCommand = device.state === 'ON' ? 'TURN_OFF' : 'TURN_ON';
    return commandQueue.enqueue(id, targetCommand);
  }

  /**
   * Set Power State via Command Queue
   */
  async setPowerState(id, targetOn) {
    const command = targetOn ? 'TURN_ON' : 'TURN_OFF';
    return commandQueue.enqueue(id, command);
  }

  /**
   * Toggle between AUTO and MANUAL mode
   */
  setControlMode(id, mode) {
    const db = getConnection();
    if (!['auto', 'manual'].includes(mode)) {
      throw new Error('Mode must be "auto" or "manual"');
    }
    db.prepare('UPDATE real_devices SET control_mode = ? WHERE id = ?').run(mode, id);
    const updated = this.getById(id);
    if (this.io) {
      this.io.emit('real-device-update', updated);
    }
    return updated;
  }

  /**
   * Get summary statistics of real devices
   */
  getStats() {
    const db = getConnection();
    const devices = db.prepare('SELECT * FROM real_devices').all();
    const activeDevices = devices.filter(d => d.state === 'ON');
    const totalPowerWatts = activeDevices.reduce((sum, d) => sum + (d.rated_power_watts || 0), 0);

    return {
      totalCount: devices.length,
      activeCount: activeDevices.length,
      connectedCount: devices.filter(d => d.control_status === 'connected').length,
      totalPowerWatts,
      totalPowerKW: totalPowerWatts / 1000
    };
  }
}

module.exports = new RealDeviceService();
