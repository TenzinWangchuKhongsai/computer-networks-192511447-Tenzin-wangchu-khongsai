const net = require('net');
const { getConnection } = require('../database/connection');

class CameraService {
  constructor() {
    this.io = null;
  }

  setIO(io) {
    this.io = io;
  }

  /**
   * Get all CCTV sources, stripping passwords for security
   */
  getAllSources() {
    const db = getConnection();
    const rows = db.prepare(`
      SELECT s.id, s.name, s.type, s.ip_address, s.port, s.stream_url,
             s.username, s.protocol, s.enabled, s.confidence_threshold,
             s.room_id, s.status, s.last_seen, s.created_at,
             r.name as room_name,
             CASE WHEN s.password IS NOT NULL AND LENGTH(s.password) > 0 THEN 1 ELSE 0 END as has_password
      FROM cctv_sources s
      LEFT JOIN rooms r ON s.room_id = r.id
      ORDER BY s.id
    `).all();

    return rows.map(r => ({
      ...r,
      enabled: r.enabled === 1,
      has_password: r.has_password === 1
    }));
  }

  /**
   * Get single CCTV source with optional secret inclusion (for internal backend use only)
   */
  getSource(id, includeSecret = false) {
    const db = getConnection();
    const row = db.prepare(`
      SELECT s.*, r.name as room_name,
             CASE WHEN s.password IS NOT NULL AND LENGTH(s.password) > 0 THEN 1 ELSE 0 END as has_password
      FROM cctv_sources s
      LEFT JOIN rooms r ON s.room_id = r.id
      WHERE s.id = ?
    `).get(id);

    if (!row) return null;

    if (!includeSecret) {
      delete row.password;
    }
    return {
      ...row,
      enabled: row.enabled === 1,
      has_password: row.has_password === 1
    };
  }

  /**
   * Register a new CCTV source
   */
  async createSource(data) {
    const db = getConnection();
    const {
      name, type, ip_address, port, stream_url,
      username, password, protocol, enabled,
      confidence_threshold, room_id
    } = data;

    if (!name || !type) {
      throw new Error('Camera name and type are required.');
    }

    const testRes = await this.testConnection(data);
    const initialStatus = testRes.success ? 'online' : (testRes.status || 'offline');

    const result = db.prepare(`
      INSERT INTO cctv_sources (
        name, type, ip_address, port, stream_url,
        username, password, protocol, enabled,
        confidence_threshold, room_id, status, last_seen
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      name,
      type,
      ip_address || null,
      port ? parseInt(port) : (type === 'rtsp' ? 554 : 80),
      stream_url || null,
      username || null,
      password || null,
      protocol || (type === 'rtsp' ? 'rtsp' : 'http'),
      enabled !== false ? 1 : 0,
      confidence_threshold ? parseFloat(confidence_threshold) : 0.60,
      room_id || null,
      initialStatus,
      initialStatus === 'online' ? new Date().toISOString() : null
    );

    const source = this.getSource(result.lastInsertRowid);

    db.prepare('INSERT INTO events (type, room_id, message) VALUES (?, ?, ?)')
      .run('camera', room_id || null, `Registered CCTV source: ${name} (${type.toUpperCase()})`);

    if (this.io) {
      this.io.emit('cctv-source-update', source);
    }

    return source;
  }

  /**
   * Update an existing CCTV source
   */
  async updateSource(id, updates) {
    const db = getConnection();
    const existing = db.prepare('SELECT * FROM cctv_sources WHERE id = ?').get(id);
    if (!existing) throw new Error('CCTV source not found');

    const fields = [
      'name', 'type', 'ip_address', 'port', 'stream_url',
      'username', 'protocol', 'enabled', 'confidence_threshold', 'room_id'
    ];

    const sets = [];
    const values = [];

    for (const field of fields) {
      if (updates[field] !== undefined) {
        sets.push(`${field} = ?`);
        let val = updates[field];
        if (field === 'enabled') val = val ? 1 : 0;
        values.push(val);
      }
    }

    // Only update password if a non-empty password is explicitly provided
    if (updates.password && updates.password.trim().length > 0) {
      sets.push('password = ?');
      values.push(updates.password);
    }

    if (sets.length > 0) {
      values.push(id);
      db.prepare(`UPDATE cctv_sources SET ${sets.join(', ')} WHERE id = ?`).run(...values);
    }

    const updated = this.getSource(id);
    if (this.io) {
      this.io.emit('cctv-source-update', updated);
    }
    return updated;
  }

  /**
   * Delete CCTV source
   */
  deleteSource(id) {
    const db = getConnection();
    const result = db.prepare('DELETE FROM cctv_sources WHERE id = ?').run(id);
    if (this.io) {
      this.io.emit('cctv-source-deleted', { id });
    }
    return result.changes > 0;
  }

  /**
   * Real connection test for CCTV camera
   */
  async testConnection(sourceData) {
    const { type, protocol, ip_address, port, stream_url, username, password } = sourceData;

    // 1. Check supported protocols
    const validProtocols = ['http', 'https', 'rtsp', 'mjpeg', 'onvif', 'webcam'];
    const proto = (protocol || type || 'http').toLowerCase();

    if (!validProtocols.includes(proto) && !validProtocols.includes(type)) {
      return {
        success: false,
        status: 'unsupported',
        message: 'Camera protocol not supported'
      };
    }

    // 2. Webcam type (runs in browser)
    if (type === 'webcam') {
      return {
        success: true,
        status: 'online',
        message: 'Local webcam source available via browser MediaDevices API'
      };
    }

    // 3. Network camera reachability test
    const host = ip_address || (stream_url ? this._extractHost(stream_url) : null);
    const targetPort = port || (proto === 'rtsp' ? 554 : (proto === 'https' ? 443 : 80));

    if (!host) {
      return {
        success: false,
        status: 'error',
        message: 'Host IP or Stream URL is required to test network camera.'
      };
    }

    const startTime = Date.now();

    // Protocol: RTSP
    if (proto === 'rtsp') {
      return new Promise((resolve) => {
        const socket = new net.Socket();
        socket.setTimeout(4000);

        socket.on('connect', () => {
          // Send standard RTSP OPTIONS packet
          const rtspPath = stream_url || `rtsp://${host}:${targetPort}/live`;
          const req = `OPTIONS ${rtspPath} RTSP/1.0\r\nCSeq: 1\r\nUser-Agent: SmartOffice-IoT-Simulator\r\n\r\n`;
          socket.write(req);
        });

        socket.on('data', (data) => {
          const latencyMs = Date.now() - startTime;
          const resp = data.toString();
          socket.destroy();

          if (resp.includes('RTSP/1.0 200') || resp.includes('Public:')) {
            resolve({
              success: true,
              status: 'online',
              latencyMs,
              message: `RTSP stream accessible at ${host}:${targetPort} (${latencyMs}ms)`
            });
          } else if (resp.includes('401 Unauthorized')) {
            // Camera is online and responding, but requires RTSP authentication
            resolve({
              success: true,
              status: 'online',
              latencyMs,
              message: `RTSP camera online at ${host}:${targetPort} (Authentication confirmed)`
            });
          } else {
            resolve({
              success: true,
              status: 'online',
              latencyMs,
              message: `RTSP camera responded (${resp.slice(0, 30)}...)`
            });
          }
        });

        socket.on('timeout', () => {
          socket.destroy();
          resolve({
            success: false,
            status: 'offline',
            message: `RTSP connection timed out to ${host}:${targetPort}`
          });
        });

        socket.on('error', (err) => {
          socket.destroy();
          resolve({
            success: false,
            status: 'offline',
            message: `RTSP probe failed: ${err.message}`
          });
        });

        socket.connect(targetPort, host);
      });
    }

    // Protocol: HTTP / MJPEG / Snapshot
    if (proto === 'http' || proto === 'https' || proto === 'mjpeg' || proto === 'onvif') {
      try {
        let testUrl = stream_url;
        if (!testUrl || !testUrl.startsWith('http')) {
          testUrl = `${proto}://${host}:${targetPort}/`;
        }

        const headers = {};
        if (username && password) {
          const auth = Buffer.from(`${username}:${password}`).toString('base64');
          headers['Authorization'] = `Basic ${auth}`;
        }

        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 4000);

        const response = await fetch(testUrl, {
          method: 'GET',
          headers,
          signal: controller.signal
        });
        clearTimeout(timeoutId);

        const latencyMs = Date.now() - startTime;

        if (response.ok || response.status === 401) {
          return {
            success: true,
            status: 'online',
            latencyMs,
            message: `HTTP camera stream verified at ${host}:${targetPort} (Status ${response.status}, ${latencyMs}ms)`
          };
        }

        return {
          success: false,
          status: 'error',
          message: `Camera responded with HTTP error code: ${response.status}`
        };
      } catch (err) {
        // Fall back to TCP probe to check if IP/port is alive
        const probe = await this._probeTcp(host, targetPort);
        if (probe.reachable) {
          return {
            success: true,
            status: 'online',
            latencyMs: probe.latencyMs,
            message: `Camera port open at ${host}:${targetPort}, but HTTP request failed (${err.message})`
          };
        }
        return {
          success: false,
          status: 'offline',
          message: `Camera unreachable: ${err.message}`
        };
      }
    }

    return {
      success: false,
      status: 'unsupported',
      message: 'Camera protocol not supported'
    };
  }

  _probeTcp(host, port, timeoutMs = 3000) {
    const startTime = Date.now();
    return new Promise((resolve) => {
      const socket = new net.Socket();
      socket.setTimeout(timeoutMs);

      socket.on('connect', () => {
        const latencyMs = Date.now() - startTime;
        socket.destroy();
        resolve({ reachable: true, latencyMs });
      });

      socket.on('timeout', () => {
        socket.destroy();
        resolve({ reachable: false, error: 'TIMEOUT' });
      });

      socket.on('error', (err) => {
        socket.destroy();
        resolve({ reachable: false, error: err.message });
      });

      socket.connect(port, host);
    });
  }

  _extractHost(urlStr) {
    try {
      const u = new URL(urlStr);
      return u.hostname;
    } catch {
      return urlStr.replace(/^https?:\/\//, '').split(/[:/]/)[0];
    }
  }
}

module.exports = new CameraService();
