const { getConnection } = require('../database/connection');
const energyEngine = require('./energyEngine');

class RealEnergyService {
  constructor() {
    this.intervalId = null;
    this.io = null;
  }

  setIO(io) {
    this.io = io;
  }

  /**
   * Start tracking runtime for real devices
   */
  start() {
    if (this.intervalId) return;
    this.intervalId = setInterval(() => {
      this._accumulateRuntime();
    }, 2000); // Every 2 seconds
  }

  stop() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
  }

  /**
   * Increments runtime seconds for active devices
   */
  _accumulateRuntime() {
    try {
      const db = getConnection();
      db.prepare(`
        UPDATE real_devices
        SET total_runtime_seconds = total_runtime_seconds + 2
        WHERE state = 'ON'
      `).run();
    } catch (err) {
      // Ignore background write errors if DB busy
    }
  }

  /**
   * Get unified energy summary distinguishing Simulated vs Real Estimated
   */
  getSummary() {
    const db = getConnection();
    const simulatedSummary = energyEngine.getSummary();

    // Query real devices
    const realDevices = db.prepare('SELECT * FROM real_devices').all();
    const activeRealDevices = realDevices.filter(d => d.state === 'ON');

    const realEstimatedPowerWatts = activeRealDevices.reduce(
      (sum, d) => sum + (d.rated_power_watts || 0), 0
    );

    // Calculate energy kWh = (Watts * seconds) / (3600 * 1000)
    const realEstimatedEnergyKWH = realDevices.reduce((sum, d) => {
      const seconds = d.total_runtime_seconds || 0;
      const watts = d.rated_power_watts || 0;
      return sum + ((watts * seconds) / (3600 * 1000));
    }, 0);

    // Real device power breakdown by type
    const realPowerByType = {};
    for (const d of realDevices) {
      if (!realPowerByType[d.type]) {
        realPowerByType[d.type] = {
          type: d.type,
          count: 0,
          activeCount: 0,
          totalPowerWatts: 0,
          estimatedEnergyKWH: 0
        };
      }
      realPowerByType[d.type].count++;
      if (d.state === 'ON') {
        realPowerByType[d.type].activeCount++;
        realPowerByType[d.type].totalPowerWatts += d.rated_power_watts || 0;
      }
      realPowerByType[d.type].estimatedEnergyKWH += ((d.rated_power_watts || 0) * (d.total_runtime_seconds || 0)) / (3600 * 1000);
    }

    return {
      // 1. Existing Simulation Energy Metrics (PRESERVED)
      simulated: {
        powerW: simulatedSummary.currentPowerW,
        powerKW: simulatedSummary.currentPowerKW,
        energyKWH: simulatedSummary.totalEnergyKWH,
        baselineKWH: simulatedSummary.baselineEnergyKWH,
        savingsPercent: simulatedSummary.savingsPercent,
        powerByType: simulatedSummary.powerByType
      },

      // 2. Real Devices Estimated Energy Metrics (STRICTLY LABELED ESTIMATED)
      realDevices: {
        deviceCount: realDevices.length,
        activeCount: activeRealDevices.length,
        powerW: realEstimatedPowerWatts,
        powerKW: parseFloat((realEstimatedPowerWatts / 1000).toFixed(4)),
        estimatedEnergyKWH: parseFloat(realEstimatedEnergyKWH.toFixed(5)),
        powerByType: Object.values(realPowerByType),
        calculationMethod: 'rated_power_watts × operating_time (ESTIMATED)'
      }
    };
  }
}

module.exports = new RealEnergyService();
