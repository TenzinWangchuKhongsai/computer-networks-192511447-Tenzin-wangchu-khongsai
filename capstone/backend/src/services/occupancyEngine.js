const { getConnection } = require('../database/connection');
const deviceService = require('./deviceService');
const sensorService = require('./sensorService');
const realDeviceService = require('./realDeviceService');
const commandQueue = require('./commandQueue');

class OccupancyEngine {
  constructor() {
    this.io = null;
    this.roomCounters = new Map(); // roomId -> { pos: number, neg: number, state: string }
  }

  setIO(io) {
    this.io = io;
  }

  /**
   * Get fail-safe policy from settings ('turn_off' | 'keep_state')
   */
  getFailSafePolicy() {
    const db = getConnection();
    const row = db.prepare("SELECT value FROM settings WHERE key = 'camera_failsafe_policy'").get();
    return row ? row.value : 'turn_off';
  }

  /**
   * Get stability buffer thresholds from settings
   */
  getStabilityThresholds() {
    const db = getConnection();
    const posRow = db.prepare("SELECT value FROM settings WHERE key = 'stability_buffer_on'").get();
    const negRow = db.prepare("SELECT value FROM settings WHERE key = 'stability_buffer_off'").get();
    return {
      bufferOn: posRow ? parseInt(posRow.value) : 3,
      bufferOff: negRow ? parseInt(negRow.value) : 5
    };
  }

  /**
   * Get occupancy state for a room
   */
  getState(roomId) {
    const db = getConnection();
    const row = db.prepare(`
      SELECT o.*, r.name as room_name, s.name as cctv_name
      FROM occupancy_state o
      JOIN rooms r ON o.room_id = r.id
      LEFT JOIN cctv_sources s ON o.cctv_source_id = s.id
      WHERE o.room_id = ?
    `).get(roomId);

    if (row) return row;

    // Default initialization
    const room = db.prepare('SELECT * FROM rooms WHERE id = ?').get(roomId);
    if (!room) return null;

    const initial = {
      room_id: roomId,
      room_name: room.name,
      source: 'simulation',
      cctv_source_id: null,
      state: room.occupancy ? 'OCCUPIED' : 'VACANT',
      last_detection_class: null,
      last_confidence: 0,
      consecutive_positive: 0,
      consecutive_negative: 0,
      fail_safe_action: this.getFailSafePolicy(),
      last_change: new Date().toISOString()
    };

    db.prepare(`
      INSERT OR REPLACE INTO occupancy_state (
        room_id, source, state, fail_safe_action, last_change
      ) VALUES (?, 'simulation', ?, ?, CURRENT_TIMESTAMP)
    `).run(roomId, initial.state, initial.fail_safe_action);

    return initial;
  }

  /**
   * Get all room occupancy states
   */
  getAllStates() {
    const db = getConnection();
    const rooms = db.prepare('SELECT id FROM rooms').all();
    return rooms.map(r => this.getState(r.id));
  }

  /**
   * Handle Camera Failure (Disconnect / Stream Error / Unavailable)
   */
  handleCameraFailure(roomId, sourceInfo = {}) {
    const db = getConnection();
    const room = db.prepare('SELECT * FROM rooms WHERE id = ?').get(roomId);
    if (!room) return;

    const policy = this.getFailSafePolicy();
    const timeStr = new Date().toLocaleTimeString();
    const sourceLabel = sourceInfo.sourceName || (sourceInfo.source === 'cctv' ? 'CCTV Camera' : 'Local Webcam');

    // Update state to UNKNOWN
    db.prepare(`
      INSERT OR REPLACE INTO occupancy_state (
        room_id, source, state, last_detection_class, fail_safe_action, last_change
      ) VALUES (?, ?, 'UNKNOWN', 'CAMERA_FAILURE', ?, CURRENT_TIMESTAMP)
    `).run(roomId, sourceInfo.source || 'cctv', policy);

    const eventMsg = `[FAIL-SAFE] ${sourceLabel} signal lost in ${room.name}. Occupancy set to UNKNOWN. Fail-safe action: ${policy === 'turn_off' ? 'Turning devices OFF' : 'Preserving current state'}.`;

    db.prepare('INSERT INTO events (type, room_id, message) VALUES (?, ?, ?)')
      .run('fail_safe', roomId, eventMsg);

    // Enforce Fail-Safe Action
    if (policy === 'turn_off') {
      // Turn off virtual devices
      deviceService.turnOffAll(roomId);

      // Turn off real devices in this room that are in auto mode
      const realDevices = realDeviceService.getAll(roomId);
      for (const rd of realDevices) {
        if (rd.control_mode === 'auto' && rd.state === 'ON') {
          commandQueue.enqueue(rd.id, 'TURN_OFF').catch(err => {
            console.error(`[FAIL-SAFE] Failed to turn off real device ${rd.id}:`, err.message);
          });
        }
      }
    }

    if (this.io) {
      this.io.emit('occupancy-update', {
        roomId,
        state: 'UNKNOWN',
        source: sourceInfo.source || 'cctv',
        failSafeTriggered: true,
        policy
      });
      this.io.emit('event-new', {
        type: 'fail_safe',
        room_id: roomId,
        message: eventMsg,
        timestamp: new Date().toISOString()
      });
      this.io.emit('device-update', { roomId, devices: deviceService.getAll(roomId) });
    }
  }

  /**
   * Process a detection frame and advance occupancy state machine
   */
  processDetection(roomId, detectionData) {
    const {
      source,           // 'simulation' | 'webcam' | 'cctv'
      cctvSourceId,     // optional ID of cctv source
      sourceName,       // optional readable name
      personDetected,   // boolean: was a person detected?
      confidence,       // number 0-1
      personCount,      // number
      isFailure         // boolean: did camera fail?
    } = detectionData;

    if (isFailure) {
      return this.handleCameraFailure(roomId, { source, sourceName });
    }

    const db = getConnection();
    const room = db.prepare('SELECT * FROM rooms WHERE id = ?').get(roomId);
    if (!room) return;

    if (!this.roomCounters.has(roomId)) {
      this.roomCounters.set(roomId, {
        pos: 0,
        neg: 0,
        state: room.occupancy ? 'OCCUPIED' : 'VACANT'
      });
    }

    const counter = this.roomCounters.get(roomId);
    const { bufferOn, bufferOff } = this.getStabilityThresholds();

    if (personDetected) {
      counter.pos += 1;
      counter.neg = 0;
    } else {
      counter.neg += 1;
      counter.pos = 0;
    }

    let newState = counter.state;

    // 3 consecutive positive detections -> OCCUPIED
    if (counter.pos >= bufferOn && counter.state !== 'OCCUPIED') {
      newState = 'OCCUPIED';
      counter.state = 'OCCUPIED';
    }
    // 5 consecutive negative detections -> VACANT
    else if (counter.neg >= bufferOff && counter.state !== 'VACANT') {
      newState = 'VACANT';
      counter.state = 'VACANT';
    }

    // Did state transition?
    const hasTransitioned = newState !== (room.occupancy === 1 ? 'OCCUPIED' : 'VACANT');

    if (hasTransitioned) {
      const isOccupied = newState === 'OCCUPIED';
      const timeStr = new Date().toLocaleTimeString();
      const srcName = sourceName || (source === 'cctv' ? 'CCTV' : (source === 'webcam' ? 'Webcam' : 'Simulation'));
      const detectionLabel = isOccupied ? 'PERSON' : 'NO PERSON';

      // 1. Update database room and occupancy_state
      db.prepare('UPDATE rooms SET occupancy = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?')
        .run(isOccupied ? 1 : 0, roomId);

      sensorService.updateByRoomAndType(roomId, 'occupancy', isOccupied ? 1 : 0);

      db.prepare(`
        INSERT OR REPLACE INTO occupancy_state (
          room_id, source, cctv_source_id, state, last_detection_class,
          last_confidence, consecutive_positive, consecutive_negative,
          fail_safe_action, last_change
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
      `).run(
        roomId,
        source,
        cctvSourceId || null,
        newState,
        detectionLabel,
        confidence || 0,
        counter.pos,
        counter.neg,
        this.getFailSafePolicy()
      );

      // 2. Structured log format (per user specification):
      // Example:
      // 14:32:08 Room: Office 1 Source: CCTV-01 Detection: PERSON Occupancy: OCCUPIED
      const logMsg = `${timeStr} | Room: ${room.name} | Source: ${srcName} | Detection: ${detectionLabel} | Occupancy: ${newState}`;

      db.prepare('INSERT INTO events (type, room_id, message) VALUES (?, ?, ?)')
        .run('occupancy', roomId, logMsg);

      // 3. Automation Rules Execution:
      // Real Devices control
      const realDevices = realDeviceService.getAll(roomId);
      for (const rd of realDevices) {
        if (rd.control_mode === 'auto') {
          const targetCmd = isOccupied ? 'TURN_ON' : 'TURN_OFF';
          commandQueue.enqueue(rd.id, targetCmd).catch(err => {
            console.error(`[AUTO] Real device ${rd.name} command error:`, err.message);
          });
        }
      }

      // Virtual Devices control
      if (room.mode === 'auto') {
        if (isOccupied) {
          deviceService.setStatusByRoomAndType(roomId, 'light', true);
        } else {
          deviceService.turnOffAll(roomId);
        }
      }

      // 4. WebSocket Broadcast
      if (this.io) {
        const updatedRoom = db.prepare('SELECT * FROM rooms WHERE id = ?').get(roomId);
        const devices = deviceService.getAll(roomId);
        const sensors = sensorService.getAll(roomId);

        this.io.emit('occupancy-update', {
          roomId,
          state: newState,
          source,
          sourceName: srcName,
          confidence,
          personCount,
          timestamp: new Date().toISOString()
        });

        this.io.emit('room-update', {
          roomId,
          room: { ...updatedRoom, devices, sensors, currentPower: deviceService.getRoomPower(roomId) }
        });

        this.io.emit('event-new', {
          type: 'occupancy',
          room_id: roomId,
          message: logMsg,
          timestamp: new Date().toISOString()
        });
      }
    }

    return {
      roomId,
      state: newState,
      consecutivePositive: counter.pos,
      consecutiveNegative: counter.neg,
      transitioned: hasTransitioned
    };
  }
}

module.exports = new OccupancyEngine();
