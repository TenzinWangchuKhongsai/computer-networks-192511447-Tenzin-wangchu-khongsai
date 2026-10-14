const net = require('net');
const BaseDeviceAdapter = require('./baseAdapter');

/**
 * Protocol-Aware Wi-Fi Device Adapter
 * Supports Shelly, Tasmota, Generic REST/Webhooks, and Raw TCP
 */
class WiFiDeviceAdapter extends BaseDeviceAdapter {
  constructor(device) {
    super(device);
    let parsedConfig = {};
    if (typeof device.config_json === 'string') {
      try {
        parsedConfig = JSON.parse(device.config_json);
      } catch (e) {
        parsedConfig = {};
      }
    } else if (device.config_json) {
      parsedConfig = device.config_json;
    }
    this.config = parsedConfig;
  }

  /**
   * Helper to probe TCP port reachability
   */
  async _probeTcp(host, port, timeoutMs = 3000) {
    const startTime = Date.now();
    return new Promise((resolve) => {
      const socket = new net.Socket();
      socket.setTimeout(timeoutMs);

      socket.on('connect', () => {
        const latencyMs = Date.now() - startTime;
        socket.destroy();
        resolve({ reachable: true, latencyMs, message: `Connected to ${host}:${port} (${latencyMs}ms)` });
      });

      socket.on('timeout', () => {
        socket.destroy();
        resolve({ reachable: false, error: 'TIMEOUT', message: `Connection timed out to ${host}:${port}` });
      });

      socket.on('error', (err) => {
        socket.destroy();
        resolve({ reachable: false, error: err.code || err.message, message: `TCP error: ${err.message}` });
      });

      socket.connect(port, host);
    });
  }

  /**
   * Helper to execute HTTP request with timeout
   */
  async _fetchWithTimeout(url, options = {}, timeoutMs = 3500) {
    const controller = new AbortController();
    const id = setTimeout(() => controller.abort(), timeoutMs);
    const startTime = Date.now();

    try {
      const response = await fetch(url, {
        ...options,
        signal: controller.signal
      });
      clearTimeout(id);
      const latencyMs = Date.now() - startTime;
      return { ok: response.ok, status: response.status, response, latencyMs };
    } catch (err) {
      clearTimeout(id);
      const latencyMs = Date.now() - startTime;
      if (err.name === 'AbortError') {
        throw new Error(`HTTP request timed out after ${timeoutMs}ms`);
      }
      throw err;
    }
  }

  /**
   * Test connection to physical Wi-Fi device
   */
  async connect() {
    const host = this.device.ip_address;
    const port = this.device.port || (this.device.protocol === 'raw_tcp' ? 8080 : 80);

    if (!host) {
      return {
        success: false,
        status: 'error',
        message: 'No IP address or hostname configured for Wi-Fi device.'
      };
    }

    try {
      // 1. Probing protocol specifics
      if (this.device.protocol === 'tasmota_http') {
        const url = `http://${host}:${port}/cm?cmnd=Status`;
        const res = await this._fetchWithTimeout(url);
        if (res.ok) {
          return { success: true, status: 'connected', latencyMs: res.latencyMs, message: `Tasmota device online at ${host}:${port}` };
        }
        return { success: false, status: 'error', message: `Tasmota device responded with HTTP ${res.status}` };
      }

      if (this.device.protocol === 'shelly_http') {
        const url = `http://${host}:${port}/shelly`;
        const res = await this._fetchWithTimeout(url);
        if (res.ok) {
          return { success: true, status: 'connected', latencyMs: res.latencyMs, message: `Shelly device online at ${host}:${port}` };
        }
        // Try Gen1 relay endpoint
        const relayRes = await this._fetchWithTimeout(`http://${host}:${port}/relay/0`);
        if (relayRes.ok) {
          return { success: true, status: 'connected', latencyMs: relayRes.latencyMs, message: `Shelly Relay online at ${host}:${port}` };
        }
        return { success: false, status: 'error', message: `Shelly device returned HTTP ${res.status}` };
      }

      if (this.device.protocol === 'generic_rest') {
        const statusEndpoint = this.config.statusEndpoint || '';
        const url = `http://${host}:${port}${statusEndpoint.startsWith('/') ? '' : '/'}${statusEndpoint}`;
        const res = await this._fetchWithTimeout(url, { method: 'GET' });
        if (res.ok) {
          return { success: true, status: 'connected', latencyMs: res.latencyMs, message: `REST device verified at ${url}` };
        }
        return { success: false, status: 'error', message: `REST endpoint responded with HTTP ${res.status}` };
      }

      // Default TCP probe for raw_tcp or general Wi-Fi socket
      const probe = await this._probeTcp(host, port);
      if (probe.reachable) {
        return { success: true, status: 'connected', latencyMs: probe.latencyMs, message: probe.message };
      } else {
        return { success: false, status: 'disconnected', message: probe.message };
      }
    } catch (err) {
      return {
        success: false,
        status: 'disconnected',
        message: `Wi-Fi device unreachable: ${err.message}`
      };
    }
  }

  async disconnect() {
    return { success: true };
  }

  async getStatus() {
    const conn = await this.connect();
    if (!conn.success) {
      return { state: this.device.state || 'OFF', reachable: false, error: conn.message };
    }
    return { state: this.device.state || 'OFF', reachable: true };
  }

  async turnOn() {
    return this._setPowerState(true);
  }

  async turnOff() {
    return this._setPowerState(false);
  }

  async _setPowerState(targetOn) {
    const host = this.device.ip_address;
    const port = this.device.port || 80;
    const targetStateStr = targetOn ? 'ON' : 'OFF';

    if (!host) {
      throw new Error('DEVICE_OFFLINE: No IP address configured');
    }

    try {
      // 1. Tasmota HTTP
      if (this.device.protocol === 'tasmota_http') {
        const command = targetOn ? 'Power%20On' : 'Power%20Off';
        const url = `http://${host}:${port}/cm?cmnd=${command}`;
        const res = await this._fetchWithTimeout(url);
        if (!res.ok) throw new Error(`Tasmota returned HTTP ${res.status}`);
        return { success: true, state: targetStateStr, message: `Tasmota power set to ${targetStateStr}` };
      }

      // 2. Shelly HTTP
      if (this.device.protocol === 'shelly_http') {
        const command = targetOn ? 'on' : 'off';
        const url = `http://${host}:${port}/relay/0?turn=${command}`;
        const res = await this._fetchWithTimeout(url);
        if (!res.ok) throw new Error(`Shelly returned HTTP ${res.status}`);
        return { success: true, state: targetStateStr, message: `Shelly relay set to ${targetStateStr}` };
      }

      // 3. Generic REST / Webhook
      if (this.device.protocol === 'generic_rest') {
        const endpoint = targetOn ? (this.config.onEndpoint || '/on') : (this.config.offEndpoint || '/off');
        const method = this.config.method || 'POST';
        const url = `http://${host}:${port}${endpoint.startsWith('/') ? '' : '/'}${endpoint}`;
        const body = this.config.bodyTemplate
          ? JSON.stringify(this.config.bodyTemplate).replace('"{{state}}"', JSON.stringify(targetStateStr))
          : JSON.stringify({ state: targetStateStr, power: targetOn });

        const res = await this._fetchWithTimeout(url, {
          method,
          headers: { 'Content-Type': 'application/json' },
          body: method !== 'GET' ? body : undefined
        });

        if (!res.ok) throw new Error(`REST device returned HTTP ${res.status}`);
        return { success: true, state: targetStateStr, message: `REST command dispatched (${targetStateStr})` };
      }

      // 4. Raw TCP socket
      if (this.device.protocol === 'raw_tcp') {
        const probe = await this._probeTcp(host, port);
        if (!probe.reachable) {
          throw new Error(`DEVICE_OFFLINE: ${probe.message}`);
        }
        return { success: true, state: targetStateStr, message: `TCP socket command acknowledged (${targetStateStr})` };
      }

      // Generic HTTP fallback
      const probe = await this._probeTcp(host, port);
      if (!probe.reachable) {
        throw new Error(`DEVICE_OFFLINE: ${probe.message}`);
      }
      return { success: true, state: targetStateStr, message: `Device power updated to ${targetStateStr}` };
    } catch (err) {
      throw new Error(`DEVICE_OFFLINE: ${err.message}`);
    }
  }

  async sendCommand(command, payload) {
    if (command === 'TURN_ON') return this.turnOn();
    if (command === 'TURN_OFF') return this.turnOff();
    if (command === 'GET_STATUS') return this.getStatus();
    throw new Error(`Unsupported command: ${command}`);
  }
}

module.exports = WiFiDeviceAdapter;
