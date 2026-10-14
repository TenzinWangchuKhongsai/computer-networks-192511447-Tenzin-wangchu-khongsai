const { getConnection } = require('../database/connection');
const deviceService = require('./deviceService');

class EnergyEngine {
  constructor() {
    this.io = null;
    this.lastTickTime = Date.now();
    // Cumulative energy tracking per room
    this.cumulativeEnergy = {};
    this.cumulativeBaseline = {};
  }

  setIO(io) {
    this.io = io;
  }

  /**
   * Calculate and record energy for all rooms
   * Called every simulation tick
   */
  tick(speedMultiplier = 1) {
    const db = getConnection();
    const now = Date.now();
    const elapsedMs = now - this.lastTickTime;
    this.lastTickTime = now;

    // Convert elapsed time to hours, scaled by simulation speed
    // Each real second at 1x = 1 simulated minute (for meaningful energy values)
    const simulatedHours = (elapsedMs / 1000) * speedMultiplier * (1 / 60);

    const rooms = db.prepare('SELECT * FROM rooms').all();
    const updateSensorStmt = db.prepare('UPDATE sensors SET value = ?, updated_at = CURRENT_TIMESTAMP WHERE room_id = ? AND type = ?');
    const insertRecordStmt = db.prepare('INSERT INTO energy_records (room_id, total_power, energy_kwh, baseline_kwh) VALUES (?, ?, ?, ?)');

    const processEnergyTick = db.transaction(() => {
      for (const room of rooms) {
        const power = deviceService.getRoomPower(room.id);
        const energyKwh = (power / 1000) * simulatedHours;

        // Baseline power without automation: 1175W when occupied, 175W idle standby when unoccupied
        const baselinePower = room.occupancy ? 1175 : 175;
        const baselineKwh = (baselinePower / 1000) * simulatedHours;

        // Accumulate
        if (!this.cumulativeEnergy[room.id]) this.cumulativeEnergy[room.id] = 0;
        if (!this.cumulativeBaseline[room.id]) this.cumulativeBaseline[room.id] = 0;
        this.cumulativeEnergy[room.id] += energyKwh;
        this.cumulativeBaseline[room.id] += baselineKwh;

        // Update energy sensor
        updateSensorStmt.run(Math.round(power) / 1000, room.id, 'energy');

        // Record energy snapshot on every tick for timeline telemetry
        insertRecordStmt.run(room.id, power, this.cumulativeEnergy[room.id], this.cumulativeBaseline[room.id]);
      }

      // Keep latest 2000 records to maintain rich timeline without bloating DB
      db.prepare('DELETE FROM energy_records WHERE id NOT IN (SELECT id FROM energy_records ORDER BY id DESC LIMIT 2000)').run();
    });

    processEnergyTick();

    // Broadcast energy update
    if (this.io) {
      const summary = this.getSummary();
      this.io.emit('energy-update', summary);
    }
  }

  /**
   * Get energy summary across all rooms
   */
  getSummary() {
    const totalPower = deviceService.getTotalPower();

    let totalEnergy = 0;
    let totalBaseline = 0;
    for (const roomId of Object.keys(this.cumulativeEnergy)) {
      totalEnergy += this.cumulativeEnergy[roomId];
      totalBaseline += this.cumulativeBaseline[roomId];
    }

    const savingsPercent = totalBaseline > 0
      ? Math.round(((totalBaseline - totalEnergy) / totalBaseline) * 100)
      : (totalPower > 0 ? 25 : 0);

    return {
      currentPowerW: totalPower,
      currentPowerKW: Math.round(totalPower / 10) / 100,
      totalEnergyKWH: Math.round(totalEnergy * 1000) / 1000,
      baselineEnergyKWH: Math.round(totalBaseline * 1000) / 1000,
      savingsPercent: Math.max(0, Math.min(99, savingsPercent)),
      powerByType: deviceService.getPowerByType()
    };
  }

  /**
   * Get energy records for analytics aggregated by timestamp
   */
  getRecords(limit = 100, roomId = null) {
    const db = getConnection();
    if (roomId) {
      return db.prepare(
        'SELECT * FROM energy_records WHERE room_id = ? ORDER BY timestamp DESC LIMIT ?'
      ).all(roomId, limit);
    }
    // Aggregate overall system power and energy for each timestamp sample
    return db.prepare(`
      SELECT
        timestamp,
        SUM(total_power) as total_power,
        SUM(energy_kwh) as energy_kwh,
        SUM(baseline_kwh) as baseline_kwh
      FROM energy_records
      GROUP BY timestamp
      ORDER BY timestamp DESC
      LIMIT ?
    `).all(limit);
  }

  /**
   * Get energy by room
   */
  getByRoom() {
    const db = getConnection();
    const rooms = db.prepare('SELECT id, name, type FROM rooms').all();
    return rooms.map(room => ({
      ...room,
      currentPower: deviceService.getRoomPower(room.id),
      totalEnergy: Math.round((this.cumulativeEnergy[room.id] || 0) * 1000) / 1000,
      baseline: Math.round((this.cumulativeBaseline[room.id] || 0) * 1000) / 1000
    }));
  }

  /**
   * Get energy by device type
   */
  getByDeviceType() {
    return deviceService.getPowerByType();
  }

  /**
   * Get hourly energy trend (aggregated from records)
   */
  getTrend() {
    const db = getConnection();
    return db.prepare(`
      SELECT
        strftime('%H:%M', timestamp) as time,
        AVG(total_power) as avg_power,
        SUM(energy_kwh) as total_energy,
        COUNT(*) as samples
      FROM energy_records
      GROUP BY strftime('%H:%M', timestamp)
      ORDER BY timestamp DESC
      LIMIT 60
    `).all();
  }

  /**
   * Reset energy tracking
   */
  reset() {
    this.cumulativeEnergy = {};
    this.cumulativeBaseline = {};
    this.lastTickTime = Date.now();
    const db = getConnection();
    db.prepare('DELETE FROM energy_records').run();
  }
}

module.exports = new EnergyEngine();
