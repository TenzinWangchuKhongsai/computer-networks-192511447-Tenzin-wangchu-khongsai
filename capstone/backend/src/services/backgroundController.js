/**
 * backgroundController.js
 *
 * The central background controller for the Smart Office IoT platform.
 * This service runs independently of the browser/frontend.
 * Closing Chrome, Edge, or any client does NOT stop this controller.
 *
 * Responsibilities:
 * 1. CCTV frame monitoring (HTTP/MJPEG/snapshot)
 * 2. Human detection (placeholder — actual AI detection requires frontend COCO-SSD or server-side model)
 * 3. Occupancy state machine
 * 4. Automation engine (real device commands)
 * 5. System health tracking
 * 6. Periodic state broadcast to all WebSocket clients
 */

const { getConnection } = require('../database/connection');
const occupancyEngine = require('./occupancyEngine');
const realDeviceService = require('./realDeviceService');
const commandQueue = require('./commandQueue');
const energyEngine = require('./energyEngine');
const realEnergyService = require('./realEnergyService');

class BackgroundController {
  constructor() {
    this.io = null;
    this.isRunning = false;

    // Service health states
    this.health = {
      backend: 'ONLINE',
      database: 'ONLINE',
      cctvMonitor: 'IDLE',
      detectionWorker: 'IDLE',
      occupancyEngine: 'ONLINE',
      automationEngine: 'ONLINE',
      commandQueue: 'ONLINE',
      deviceManager: 'ONLINE',
      energyService: 'ONLINE',
      websocket: 'ONLINE',
    };

    // Global controller settings
    this.settings = {
      automationEnabled: true,
      emergencyMode: false,
      emergencyModeSetAt: null,
    };

    // Active CCTV monitoring sessions: { cctvId -> { intervalId, failCount, status } }
    this.cctvSessions = new Map();

    // Intervals
    this._healthBroadcastInterval = null;
    this._deviceHealthCheckInterval = null;
    this._settingsSyncInterval = null;
  }

  setIO(io) {
    this.io = io;
  }

  /**
   * Start the background controller
   */
  start() {
    if (this.isRunning) return;
    this.isRunning = true;

    console.log('[CTRL] Background Controller starting...');

    // Load persisted settings from DB
    this._loadSettings();

    // Start CCTV monitoring for all enabled sources
    this._startAllCctvMonitors();

    // Periodic device health check (every 30s)
    this._deviceHealthCheckInterval = setInterval(() => {
      this._checkDeviceHealth();
    }, 30000);

    // Broadcast health status every 10s to all clients
    this._healthBroadcastInterval = setInterval(() => {
      this._broadcastHealth();
    }, 10000);

    // Re-sync CCTV sources every 60s (picks up newly added cameras)
    this._settingsSyncInterval = setInterval(() => {
      this._syncCctvSources();
    }, 60000);

    this.health.backend = 'ONLINE';
    console.log('[CTRL] Background Controller active. Automation:', this.settings.automationEnabled ? 'ON' : 'OFF');
  }

  /**
   * Stop the background controller
   */
  stop() {
    this.isRunning = false;

    // Stop all CCTV sessions
    for (const [cctvId, session] of this.cctvSessions.entries()) {
      if (session.intervalId) clearInterval(session.intervalId);
      this.cctvSessions.delete(cctvId);
    }

    if (this._deviceHealthCheckInterval) clearInterval(this._deviceHealthCheckInterval);
    if (this._healthBroadcastInterval) clearInterval(this._healthBroadcastInterval);
    if (this._settingsSyncInterval) clearInterval(this._settingsSyncInterval);

    console.log('[CTRL] Background Controller stopped.');
  }

  // ===================================================================
  // AUTOMATION MASTER SWITCH
  // ===================================================================

  /**
   * Enable or disable the automation engine
   */
  setAutomation(enabled) {
    this.settings.automationEnabled = enabled;
    this._persistSetting('automation_enabled', enabled ? 'true' : 'false');
    console.log(`[CTRL] Automation ${enabled ? 'ENABLED' : 'DISABLED'}`);

    if (this.io) {
      this.io.emit('controller-settings', this._getPublicSettings());
    }
  }

  /**
   * Activate emergency mode: stops all auto-ON commands, sends OFF to all devices
   */
  async activateEmergency() {
    this.settings.emergencyMode = true;
    this.settings.emergencyModeSetAt = new Date().toISOString();
    this.settings.automationEnabled = false;
    this._persistSetting('emergency_mode', 'true');
    this._persistSetting('automation_enabled', 'false');

    console.log('[CTRL] EMERGENCY MODE ACTIVATED — stopping automation, turning off all devices');

    const result = await this._turnAllDevicesOff({ reason: 'EMERGENCY_SHUTDOWN' });

    const db = getConnection();
    db.prepare('INSERT INTO events (type, room_id, message) VALUES (?, NULL, ?)').run(
      'emergency',
      `[EMERGENCY] Emergency shutdown activated. ${result.summary}`
    );

    if (this.io) {
      this.io.emit('emergency-mode', {
        active: true,
        activatedAt: this.settings.emergencyModeSetAt,
        result,
      });
      this.io.emit('controller-settings', this._getPublicSettings());
    }

    return result;
  }

  /**
   * Clear emergency mode
   */
  clearEmergency() {
    this.settings.emergencyMode = false;
    this.settings.emergencyModeSetAt = null;
    this._persistSetting('emergency_mode', 'false');

    console.log('[CTRL] Emergency mode cleared');

    if (this.io) {
      this.io.emit('emergency-mode', { active: false });
      this.io.emit('controller-settings', this._getPublicSettings());
    }
  }

  /**
   * Get current controller settings (safe for client)
   */
  _getPublicSettings() {
    return {
      automationEnabled: this.settings.automationEnabled,
      emergencyMode: this.settings.emergencyMode,
      emergencyModeSetAt: this.settings.emergencyModeSetAt,
      health: { ...this.health },
      cctvMonitorCount: this.cctvSessions.size,
    };
  }

  // ===================================================================
  // MASTER TURN OFF
  // ===================================================================

  /**
   * Turn off ALL registered real devices with verification.
   * Reports exact results including failures.
   */
  async masterTurnOff(options = {}) {
    const result = await this._turnAllDevicesOff({ reason: options.reason || 'MANUAL_ALL_OFF' });

    const db = getConnection();
    db.prepare('INSERT INTO events (type, room_id, message) VALUES (?, NULL, ?)').run(
      'control',
      `[MASTER OFF] ${result.summary}`
    );

    if (this.io) {
      this.io.emit('master-turnoff-result', result);
      this.io.emit('event-new', {
        type: 'control',
        room_id: null,
        message: `[MASTER OFF] ${result.summary}`,
        timestamp: new Date().toISOString(),
      });
    }

    return result;
  }

  /**
   * Internal: enumerate all real devices and send TURN_OFF to each
   */
  async _turnAllDevicesOff({ reason = 'TURN_ALL_OFF' } = {}) {
    const allDevices = realDeviceService.getAll();

    if (allDevices.length === 0) {
      return {
        targeted: 0,
        confirmed: 0,
        failed: 0,
        unreachable: [],
        summary: 'No real devices registered.',
      };
    }

    const results = await Promise.allSettled(
      allDevices.map(async (device) => {
        try {
          const cmdResult = await commandQueue.enqueue(device.id, 'TURN_OFF');
          return { device: device.name, id: device.id, success: cmdResult.success || cmdResult.skipped, status: cmdResult.status || 'SKIPPED' };
        } catch (err) {
          return { device: device.name, id: device.id, success: false, error: err.message };
        }
      })
    );

    let confirmed = 0;
    let failed = 0;
    const unreachable = [];

    for (const r of results) {
      const val = r.value || {};
      if (r.status === 'fulfilled' && val.success) {
        confirmed++;
      } else {
        failed++;
        unreachable.push(val.device || 'Unknown');
      }
    }

    const total = allDevices.length;
    const summaryParts = [`${confirmed}/${total} devices confirmed OFF.`];
    if (failed > 0) {
      summaryParts.push(`${failed} unreachable: ${unreachable.join(', ')}.`);
    }

    const summary = summaryParts.join(' ');
    console.log(`[CTRL] ${reason}: ${summary}`);

    return {
      targeted: total,
      confirmed,
      failed,
      unreachable,
      summary,
      timestamp: new Date().toISOString(),
    };
  }

  // ===================================================================
  // DEVICE GROUP CONTROL
  // ===================================================================

  /**
   * Turn on/off a group of devices
   * group: 'all' | 'lights' | 'fans' | 'ac' | { roomId } | { type }
   */
  async groupControl(group, turnOn) {
    const command = turnOn ? 'TURN_ON' : 'TURN_OFF';
    const allDevices = realDeviceService.getAll();

    let targets = allDevices;

    if (group === 'lights') {
      targets = allDevices.filter(d => d.type === 'light');
    } else if (group === 'fans') {
      targets = allDevices.filter(d => d.type === 'fan');
    } else if (group === 'ac') {
      targets = allDevices.filter(d => d.type === 'ac');
    } else if (group.roomId) {
      targets = allDevices.filter(d => d.room_id === group.roomId);
    } else if (group.type) {
      targets = allDevices.filter(d => d.type === group.type);
    }

    if (targets.length === 0) {
      return { targeted: 0, confirmed: 0, failed: 0, summary: 'No devices in this group.' };
    }

    const results = await Promise.allSettled(
      targets.map(async (device) => {
        try {
          const r = await commandQueue.enqueue(device.id, command);
          return { device: device.name, success: r.success || r.skipped };
        } catch (err) {
          return { device: device.name, success: false, error: err.message };
        }
      })
    );

    let confirmed = 0, failed = 0;
    const failed_names = [];
    for (const r of results) {
      const v = r.value || {};
      if (r.status === 'fulfilled' && v.success) confirmed++;
      else { failed++; failed_names.push(v.device); }
    }

    const summary = `${confirmed}/${targets.length} devices confirmed ${turnOn ? 'ON' : 'OFF'}.${failed > 0 ? ` Failed: ${failed_names.join(', ')}.` : ''}`;

    return { targeted: targets.length, confirmed, failed, summary, command };
  }

  // ===================================================================
  // CCTV MONITORING (Background — Independent of Browser)
  // ===================================================================

  /**
   * Start monitoring all enabled CCTV sources
   */
  _startAllCctvMonitors() {
    const db = getConnection();
    const sources = db.prepare('SELECT * FROM cctv_sources WHERE enabled = 1').all();

    console.log(`[CTRL] Starting CCTV monitoring for ${sources.length} camera(s)`);

    for (const source of sources) {
      this._startCctvMonitor(source);
    }

    this.health.cctvMonitor = sources.length > 0 ? 'ONLINE' : 'IDLE';
  }

  /**
   * Start monitoring a single CCTV source at the backend
   * For HTTP/snapshot cameras: polls the snapshot URL and checks connectivity
   * For RTSP cameras: periodically probes TCP connectivity (actual frame decoding requires ffmpeg)
   * Full AI detection happens via:
   *   (a) frontend webcam (existing) — browser-dependent
   *   (b) postOccupancyDetection API (client reports detection results to backend)
   *   (c) this service reports connectivity health only (frame AI requires GPU/WASM)
   */
  _startCctvMonitor(source) {
    if (this.cctvSessions.has(source.id)) {
      const existing = this.cctvSessions.get(source.id);
      if (existing.intervalId) clearInterval(existing.intervalId);
    }

    const session = {
      cctvId: source.id,
      roomId: source.room_id,
      name: source.name,
      type: source.type,
      status: 'CONNECTING',
      streamStatus: 'WAITING',
      detectionStatus: 'IDLE',
      occupancyStatus: 'UNKNOWN',
      failCount: 0,
      lastCheck: null,
      frameCount: 0,
    };

    this.cctvSessions.set(source.id, session);

    // Poll camera connectivity every 15 seconds
    const intervalId = setInterval(async () => {
      await this._pollCctvSource(source.id);
    }, 15000);

    session.intervalId = intervalId;

    // Initial check immediately
    setImmediate(() => this._pollCctvSource(source.id));

    console.log(`[CCTV] Monitor started for: ${source.name} (${source.type} - Room ${source.room_id || 'unassigned'})`);
  }

  /**
   * Poll a CCTV source for connectivity and stream health
   */
  async _pollCctvSource(cctvId) {
    const db = getConnection();
    const source = db.prepare('SELECT * FROM cctv_sources WHERE id = ?').get(cctvId);
    if (!source) {
      this.cctvSessions.delete(cctvId);
      return;
    }

    if (!source.enabled) return;

    const session = this.cctvSessions.get(cctvId);
    if (!session) return;

    session.lastCheck = new Date().toISOString();

    const net = require('net');
    const host = source.ip_address || this._extractHost(source.stream_url);
    const port = source.port || (source.type === 'rtsp' ? 554 : 80);

    if (!host) {
      session.status = 'MISCONFIGURED';
      session.streamStatus = 'NO_HOST';
      this._updateCctvStatus(cctvId, 'offline', session);
      return;
    }

    // TCP probe
    const reachable = await new Promise((resolve) => {
      const sock = new net.Socket();
      sock.setTimeout(4000);
      sock.on('connect', () => { sock.destroy(); resolve(true); });
      sock.on('error', () => { sock.destroy(); resolve(false); });
      sock.on('timeout', () => { sock.destroy(); resolve(false); });
      sock.connect(port, host);
    });

    if (!reachable) {
      session.failCount++;
      session.status = 'OFFLINE';
      session.streamStatus = 'UNREACHABLE';

      // After 3 consecutive failures, apply fail-safe
      if (session.failCount >= 3 && source.room_id) {
        this._handleCctvFailure(source, session);
      }

      this._updateCctvStatus(cctvId, 'offline', session);
      console.log(`[CCTV] ${source.name} OFFLINE (fail #${session.failCount})`);
    } else {
      if (session.failCount >= 3 && source.room_id) {
        // Recovery from failure
        console.log(`[CCTV] ${source.name} recovered`);
        this._handleCctvRecovery(source, session);
      }

      session.failCount = 0;
      session.status = 'ONLINE';
      session.streamStatus = source.type === 'rtsp'
        ? 'TCP_CONNECTED (frame decode requires ffmpeg)'
        : 'REACHABLE';
      session.detectionStatus = 'AWAITING_FRAMES';

      this._updateCctvStatus(cctvId, 'online', session);
    }

    // Emit status to all clients
    if (this.io) {
      this.io.emit('cctv-monitor-status', {
        cctvId,
        name: source.name,
        roomId: source.room_id,
        status: session.status,
        streamStatus: session.streamStatus,
        detectionStatus: session.detectionStatus,
        occupancyStatus: session.occupancyStatus,
        lastCheck: session.lastCheck,
        failCount: session.failCount,
      });
    }
  }

  /**
   * Update CCTV status in database
   */
  _updateCctvStatus(cctvId, status, session) {
    const db = getConnection();
    db.prepare(`
      UPDATE cctv_sources
      SET status = ?, last_seen = CASE WHEN ? = 'online' THEN CURRENT_TIMESTAMP ELSE last_seen END
      WHERE id = ?
    `).run(status, status, cctvId);

    if (this.io) {
      const updated = db.prepare('SELECT * FROM cctv_sources WHERE id = ?').get(cctvId);
      if (updated) this.io.emit('cctv-source-update', updated);
    }
  }

  /**
   * Handle CCTV failure — trigger fail-safe policy
   */
  _handleCctvFailure(source, session) {
    if (!source.room_id) return;
    session.occupancyStatus = 'UNKNOWN';

    occupancyEngine.handleCameraFailure(source.room_id, {
      source: 'cctv',
      sourceName: source.name,
    });

    const db = getConnection();
    db.prepare('INSERT INTO events (type, room_id, message) VALUES (?, ?, ?)').run(
      'fail_safe',
      source.room_id,
      `[FAIL-SAFE] CCTV ${source.name} offline. Fail-safe applied.`
    );
  }

  /**
   * Handle CCTV recovery
   */
  _handleCctvRecovery(source, session) {
    session.occupancyStatus = 'RESUMING';

    const db = getConnection();
    db.prepare('INSERT INTO events (type, room_id, message) VALUES (?, ?, ?)').run(
      'camera',
      source.room_id,
      `[RECOVERY] CCTV ${source.name} reconnected. Resuming occupancy monitoring.`
    );

    if (this.io) {
      this.io.emit('event-new', {
        type: 'camera',
        room_id: source.room_id,
        message: `CCTV ${source.name} recovered. Resuming detection.`,
        timestamp: new Date().toISOString(),
      });
    }
  }

  /**
   * Sync CCTV sources — start monitors for newly added cameras
   */
  _syncCctvSources() {
    const db = getConnection();
    const sources = db.prepare('SELECT * FROM cctv_sources WHERE enabled = 1').all();

    for (const source of sources) {
      if (!this.cctvSessions.has(source.id)) {
        console.log(`[CTRL] New CCTV source detected, starting monitor: ${source.name}`);
        this._startCctvMonitor(source);
      }
    }

    // Stop monitors for disabled/deleted sources
    for (const [cctvId] of this.cctvSessions.entries()) {
      const found = sources.find(s => s.id === cctvId);
      if (!found) {
        const session = this.cctvSessions.get(cctvId);
        if (session?.intervalId) clearInterval(session.intervalId);
        this.cctvSessions.delete(cctvId);
        console.log(`[CTRL] Stopped monitor for removed CCTV ${cctvId}`);
      }
    }

    this.health.cctvMonitor = this.cctvSessions.size > 0 ? 'ONLINE' : 'IDLE';
  }

  /**
   * Accept detection result from client (webcam/CCTV frame processed in browser)
   * and feed it into the backend occupancy engine + automation
   */
  processClientDetection(roomId, detectionData) {
    if (this.settings.emergencyMode) {
      return { skipped: true, reason: 'EMERGENCY_MODE_ACTIVE' };
    }

    const result = occupancyEngine.processDetection(roomId, detectionData);

    // Update CCTV session occupancy status
    if (detectionData.cctvSourceId) {
      const session = this.cctvSessions.get(detectionData.cctvSourceId);
      if (session) {
        session.detectionStatus = 'ACTIVE';
        session.frameCount++;
        session.occupancyStatus = result?.state || 'PROCESSING';
      }
    }

    return result;
  }

  // ===================================================================
  // DEVICE HEALTH CHECK
  // ===================================================================

  /**
   * Periodically check real device health (ping connected devices)
   */
  async _checkDeviceHealth() {
    const devices = realDeviceService.getAll();
    if (devices.length === 0) return;

    for (const device of devices) {
      if (device.connection_type !== 'wifi') continue;
      if (!device.ip_address) continue;

      // Only check devices that claim to be connected
      if (device.control_status !== 'connected') continue;

      const net = require('net');
      const port = device.port || 80;
      const reachable = await new Promise(resolve => {
        const sock = new net.Socket();
        sock.setTimeout(3000);
        sock.on('connect', () => { sock.destroy(); resolve(true); });
        sock.on('error', () => { sock.destroy(); resolve(false); });
        sock.on('timeout', () => { sock.destroy(); resolve(false); });
        sock.connect(port, device.ip_address);
      });

      if (!reachable && device.control_status === 'connected') {
        const db = getConnection();
        db.prepare("UPDATE real_devices SET control_status = 'error', last_error = 'Health check failed' WHERE id = ?").run(device.id);
        const updated = db.prepare('SELECT * FROM real_devices WHERE id = ?').get(device.id);
        if (this.io) this.io.emit('real-device-update', updated);
        console.log(`[CTRL] Device ${device.name} health check FAILED`);
      }
    }
  }

  // ===================================================================
  // SYSTEM HEALTH
  // ===================================================================

  /**
   * Get current system health
   */
  getHealth() {
    return {
      ...this.health,
      cctvMonitorCount: this.cctvSessions.size,
      cctvSessions: Array.from(this.cctvSessions.values()).map(s => ({
        cctvId: s.cctvId,
        name: s.name,
        status: s.status,
        streamStatus: s.streamStatus,
        detectionStatus: s.detectionStatus,
        occupancyStatus: s.occupancyStatus,
        failCount: s.failCount,
        lastCheck: s.lastCheck,
        frameCount: s.frameCount,
      })),
      settings: this._getPublicSettings(),
      uptime: process.uptime(),
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * Broadcast health to all clients
   */
  _broadcastHealth() {
    if (this.io) {
      this.io.emit('system-health', this.getHealth());
    }
  }

  // ===================================================================
  // SETTINGS PERSISTENCE
  // ===================================================================

  _loadSettings() {
    const db = getConnection();
    const rows = db.prepare("SELECT key, value FROM settings WHERE key IN ('automation_enabled', 'emergency_mode')").all();
    for (const row of rows) {
      if (row.key === 'automation_enabled') {
        this.settings.automationEnabled = row.value !== 'false';
      }
      if (row.key === 'emergency_mode') {
        this.settings.emergencyMode = row.value === 'true';
      }
    }
  }

  _persistSetting(key, value) {
    const db = getConnection();
    db.prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)').run(key, value);
  }

  // ===================================================================
  // UTILITIES
  // ===================================================================

  _extractHost(urlStr) {
    if (!urlStr) return null;
    try {
      const u = new URL(urlStr);
      return u.hostname;
    } catch {
      return urlStr.replace(/^[a-z]+:\/\//, '').split(/[:/]/)[0];
    }
  }
}

module.exports = new BackgroundController();
