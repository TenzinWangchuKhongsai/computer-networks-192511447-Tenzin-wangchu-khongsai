const { getConnection } = require('../database/connection');
const { createDeviceAdapter } = require('./deviceAdapters');

class CommandQueue {
  constructor() {
    this.io = null;
    this.isProcessing = false;
    this.queue = [];
  }

  setIO(io) {
    this.io = io;
  }

  /**
   * Enqueue a command to a real device with deduplication and state safety
   */
  async enqueue(deviceId, command) {
    const db = getConnection();
    const device = db.prepare('SELECT * FROM real_devices WHERE id = ?').get(deviceId);
    if (!device) {
      throw new Error(`Device ID ${deviceId} not found.`);
    }

    const targetState = command === 'TURN_ON' ? 'ON' : (command === 'TURN_OFF' ? 'OFF' : null);

    // DEDUPLICATION: Do not continuously send repeat commands if already in desired state
    if (targetState && device.state === targetState && device.control_status === 'connected') {
      return {
        skipped: true,
        reason: 'DUPLICATE_PREVENTED',
        message: `Device '${device.name}' is already ${targetState}. Command suppressed.`,
        state: device.state
      };
    }

    const commandId = `cmd-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
    const nowIso = new Date().toISOString();

    db.prepare(`
      INSERT INTO device_commands (id, device_id, command, status, attempts, created_at)
      VALUES (?, ?, ?, 'PENDING', 0, CURRENT_TIMESTAMP)
    `).run(commandId, deviceId, command);

    const commandRecord = {
      id: commandId,
      deviceId,
      command,
      status: 'PENDING',
      attempts: 0,
      createdAt: nowIso,
      deviceName: device.name,
      room_id: device.room_id
    };

    if (this.io) {
      this.io.emit('command-new', commandRecord);
    }

    // Execute asynchronously with retry policy
    return this._executeWithRetry(commandId, device, command, targetState);
  }

  /**
   * Executes command with max 3 attempts and exponential backoff
   */
  async _executeWithRetry(commandId, device, command, targetState, maxAttempts = 3) {
    const db = getConnection();
    let attempts = 0;
    let lastError = null;

    while (attempts < maxAttempts) {
      attempts++;
      db.prepare('UPDATE device_commands SET status = ?, attempts = ? WHERE id = ?')
        .run('SENT', attempts, commandId);

      if (this.io) {
        this.io.emit('command-update', { id: commandId, status: 'SENT', attempts });
      }

      try {
        const adapter = createDeviceAdapter(device);
        let result;

        if (command === 'TURN_ON') {
          result = await adapter.turnOn();
        } else if (command === 'TURN_OFF') {
          result = await adapter.turnOff();
        } else {
          result = await adapter.sendCommand(command);
        }

        // SUCCESS
        const completedAt = new Date().toISOString();
        db.prepare(`
          UPDATE device_commands
          SET status = 'SUCCESS', attempts = ?, completed_at = CURRENT_TIMESTAMP, error = NULL
          WHERE id = ?
        `).run(attempts, commandId);

        // Update real device state
        const newState = targetState || result.state || device.state;
        const now = new Date().toISOString();

        // Calculate runtime seconds if turning OFF
        let runtimeAddition = 0;
        if (device.state === 'ON' && newState === 'OFF' && device.last_state_change) {
          const prevTime = new Date(device.last_state_change).getTime();
          runtimeAddition = Math.max(0, Math.round((Date.now() - prevTime) / 1000));
        }

        db.prepare(`
          UPDATE real_devices
          SET state = ?, control_status = 'connected', last_seen = CURRENT_TIMESTAMP,
              last_error = NULL, last_state_change = CURRENT_TIMESTAMP,
              total_runtime_seconds = total_runtime_seconds + ?
          WHERE id = ?
        `).run(newState, runtimeAddition, device.id);

        const updatedDevice = db.prepare('SELECT * FROM real_devices WHERE id = ?').get(device.id);

        // Log system event
        db.prepare('INSERT INTO events (type, room_id, message) VALUES (?, ?, ?)')
          .run('real_device', device.room_id, `[REAL IOT] ${device.name} (${device.connection_type.toUpperCase()}) set to ${newState}`);

        if (this.io) {
          this.io.emit('command-update', {
            id: commandId,
            status: 'SUCCESS',
            attempts,
            completedAt,
            result
          });
          this.io.emit('real-device-update', updatedDevice);
          this.io.emit('event-new', {
            type: 'real_device',
            room_id: device.room_id,
            message: `[REAL IOT] ${device.name} set to ${newState}`,
            timestamp: completedAt
          });
        }

        return {
          id: commandId,
          success: true,
          status: 'SUCCESS',
          state: newState,
          attempts,
          message: result.message || `Command ${command} executed successfully`
        };

      } catch (err) {
        lastError = err.message || 'Unknown execution error';

        if (attempts < maxAttempts) {
          // Exponential backoff wait (e.g. 600ms, 1200ms)
          await new Promise(r => setTimeout(r, attempts * 600));
        }
      }
    }

    // FAILED after retries exhausted
    const completedAt = new Date().toISOString();
    db.prepare(`
      UPDATE device_commands
      SET status = 'FAILED', attempts = ?, completed_at = CURRENT_TIMESTAMP, error = ?
      WHERE id = ?
    `).run(attempts, lastError, commandId);

    db.prepare(`
      UPDATE real_devices
      SET control_status = 'error', last_error = ?
      WHERE id = ?
    `).run(lastError, device.id);

    const updatedDevice = db.prepare('SELECT * FROM real_devices WHERE id = ?').get(device.id);

    if (this.io) {
      this.io.emit('command-update', {
        id: commandId,
        status: 'FAILED',
        attempts,
        completedAt,
        error: lastError
      });
      this.io.emit('real-device-update', updatedDevice);
    }

    return {
      id: commandId,
      success: false,
      status: 'FAILED',
      attempts,
      error: lastError,
      message: `Command failed after ${attempts} attempts: ${lastError}`
    };
  }

  /**
   * Fetch recent command history
   */
  getHistory(limit = 50) {
    const db = getConnection();
    return db.prepare(`
      SELECT c.*, d.name as device_name, d.type as device_type, d.room_id, r.name as room_name
      FROM device_commands c
      JOIN real_devices d ON c.device_id = d.id
      LEFT JOIN rooms r ON d.room_id = r.id
      ORDER BY c.created_at DESC
      LIMIT ?
    `).all(limit);
  }
}

module.exports = new CommandQueue();
