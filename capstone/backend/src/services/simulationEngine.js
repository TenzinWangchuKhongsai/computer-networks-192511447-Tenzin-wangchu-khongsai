const { getConnection } = require('../database/connection');
const automationEngine = require('./automationEngine');
const energyEngine = require('./energyEngine');
const deviceService = require('./deviceService');
const sensorService = require('./sensorService');

class SimulationEngine {
  constructor() {
    this.io = null;
    this.interval = null;
    this.status = 'paused'; // 'running', 'paused'
    this.speed = 1;         // 0.5, 1, 2, 5, 10
    this.autoSimulation = false;
    this.tickCount = 0;
  }

  setIO(io) {
    this.io = io;
    automationEngine.setIO(io);
    energyEngine.setIO(io);
  }

  /**
   * Start the simulation loop
   */
  start() {
    if (this.status === 'running') return;
    this.status = 'running';
    this.tickCount = 0;
    energyEngine.lastTickTime = Date.now();

    const intervalMs = Math.max(200, 1000 / this.speed);
    this.interval = setInterval(() => this._tick(), intervalMs);

    this._saveSetting('simulation_status', 'running');
    this._logEvent('system', null, 'Simulation started');
    this._broadcastStatus();
    console.log(`[SIM] Simulation started at ${this.speed}x speed`);
  }

  /**
   * Pause the simulation
   */
  pause() {
    if (this.status === 'paused') return;
    this.status = 'paused';
    if (this.interval) {
      clearInterval(this.interval);
      this.interval = null;
    }

    this._saveSetting('simulation_status', 'paused');
    this._logEvent('system', null, 'Simulation paused');
    this._broadcastStatus();
    console.log('[SIM] Simulation paused');
  }

  /**
   * Reset the simulation
   */
  reset() {
    this.pause();
    const { resetDatabase } = require('../database/init');
    resetDatabase();
    energyEngine.reset();
    this.tickCount = 0;
    this.autoSimulation = false;

    this._logEvent('system', null, 'Simulation reset — all data reinitialized');
    this._broadcastStatus();
    this._broadcastFullState();
    console.log('[SIM] Simulation reset');
  }

  /**
   * Execute a single simulation step
   */
  step() {
    this._tick();
    this._logEvent('system', null, 'Manual simulation step executed');
  }

  /**
   * Set simulation speed
   */
  setSpeed(speed) {
    const validSpeeds = [0.5, 1, 2, 5, 10];
    if (!validSpeeds.includes(speed)) return;
    this.speed = speed;
    this._saveSetting('simulation_speed', String(speed));

    // Restart interval if running
    if (this.status === 'running') {
      clearInterval(this.interval);
      const intervalMs = Math.max(200, 1000 / this.speed);
      this.interval = setInterval(() => this._tick(), intervalMs);
    }

    this._broadcastStatus();
    console.log(`[SIM] Speed set to ${speed}x`);
  }

  /**
   * Toggle auto-simulation mode
   */
  setAutoSimulation(enabled) {
    this.autoSimulation = enabled;
    this._saveSetting('auto_simulation', String(enabled));
    this._broadcastStatus();
    console.log(`[SIM] Auto-simulation ${enabled ? 'enabled' : 'disabled'}`);
  }

  /**
   * Get current simulation status
   */
  getStatus() {
    return {
      status: this.status,
      speed: this.speed,
      autoSimulation: this.autoSimulation,
      tickCount: this.tickCount
    };
  }

  /**
   * Core simulation tick
   */
  _tick() {
    this.tickCount++;
    const db = getConnection();

    // Auto-simulation: randomly change environment
    if (this.autoSimulation) {
      this._autoSimulate(db);
    }

    // Run automation engine on all rooms
    automationEngine.evaluateAllRooms();

    // Calculate energy
    energyEngine.tick(this.speed);

    // Broadcast full state periodically (every 5 ticks)
    if (this.tickCount % 5 === 0) {
      this._broadcastFullState();
    }
  }

  /**
   * Automatic environmental changes
   */
  _autoSimulate(db) {
    const rooms = db.prepare('SELECT * FROM rooms').all();
    const updateOccStmt = db.prepare('UPDATE rooms SET occupancy = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?');
    const updateTempStmt = db.prepare('UPDATE rooms SET temperature = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?');
    const updateLightStmt = db.prepare('UPDATE rooms SET light_level = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?');

    const executeAutoSim = db.transaction(() => {
      for (const room of rooms) {
        // Skip server rooms from occupancy changes
        if (room.type === 'server_room') continue;

        // Random occupancy changes (5% chance per tick per room)
        if (Math.random() < 0.05) {
          const newOccupancy = room.occupancy ? 0 : 1;
          updateOccStmt.run(newOccupancy, room.id);
          sensorService.updateByRoomAndType(room.id, 'occupancy', newOccupancy);

          if (newOccupancy === 1) {
            deviceService.setStatusByRoomAndType(room.id, 'light', true);
          } else {
            deviceService.turnOffAll(room.id);
          }

          const action = newOccupancy ? 'became occupied' : 'became empty';
          this._logEvent('occupancy', room.id, `${room.name} ${action}`);

          if (this.io) {
            this.io.emit('room-update', { roomId: room.id, changes: { occupancy: newOccupancy } });
          }
        }

        // Temperature drift (±0.3°C, 10% chance)
        if (Math.random() < 0.10) {
          const drift = (Math.random() - 0.5) * 0.6;
          let newTemp = Math.round((room.temperature + drift) * 10) / 10;
          newTemp = Math.max(18, Math.min(32, newTemp));
          updateTempStmt.run(newTemp, room.id);
          sensorService.updateByRoomAndType(room.id, 'temperature', newTemp);

          if (this.io) {
            this.io.emit('sensor-update', { roomId: room.id, type: 'temperature', value: newTemp });
          }
        }

        // Light level changes (±5%, 8% chance)
        if (Math.random() < 0.08) {
          const lightDrift = (Math.random() - 0.5) * 10;
          let newLight = Math.round(room.light_level + lightDrift);
          newLight = Math.max(0, Math.min(100, newLight));
          updateLightStmt.run(newLight, room.id);
          sensorService.updateByRoomAndType(room.id, 'light', newLight);

          if (this.io) {
            this.io.emit('sensor-update', { roomId: room.id, type: 'light', value: newLight });
          }
        }
      }
    });

    executeAutoSim();
  }

  /**
   * Broadcast full state to all clients
   */
  _broadcastFullState() {
    if (!this.io) return;
    const db = getConnection();
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

    this.io.emit('full-state', {
      rooms: enrichedRooms,
      devices,
      sensors,
      energy: energySummary,
      simulation: this.getStatus()
    });
  }

  _broadcastStatus() {
    if (this.io) {
      this.io.emit('simulation-status', this.getStatus());
    }
  }

  _logEvent(type, roomId, message) {
    const db = getConnection();
    db.prepare('INSERT INTO events (type, room_id, message) VALUES (?, ?, ?)').run(type, roomId, message);
    // Keep max 200 events in database
    db.prepare('DELETE FROM events WHERE id NOT IN (SELECT id FROM events ORDER BY id DESC LIMIT 200)').run();
    if (this.io) {
      this.io.emit('event-new', {
        type,
        room_id: roomId,
        message,
        timestamp: new Date().toISOString()
      });
    }
  }

  _saveSetting(key, value) {
    const db = getConnection();
    db.prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)').run(key, value);
  }
}

module.exports = new SimulationEngine();
