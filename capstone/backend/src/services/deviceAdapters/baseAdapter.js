/**
 * Base Device Adapter Interface
 * All physical device adapters (Wi-Fi, Bluetooth) must implement these methods.
 */
class BaseDeviceAdapter {
  constructor(device) {
    this.device = device;
  }

  /**
   * Test or establish connection to device
   * @returns {Promise<{ success: boolean, status: string, latencyMs?: number, message?: string }>}
   */
  async connect() {
    throw new Error('Method connect() must be implemented.');
  }

  /**
   * Disconnect from device
   */
  async disconnect() {
    throw new Error('Method disconnect() must be implemented.');
  }

  /**
   * Fetch current hardware status from device
   * @returns {Promise<{ state: 'ON' | 'OFF', reachable: boolean, details?: any }>}
   */
  async getStatus() {
    throw new Error('Method getStatus() must be implemented.');
  }

  /**
   * Turn device ON
   * @returns {Promise<{ success: boolean, state: 'ON', message?: string }>}
   */
  async turnOn() {
    throw new Error('Method turnOn() must be implemented.');
  }

  /**
   * Turn device OFF
   * @returns {Promise<{ success: boolean, state: 'OFF', message?: string }>}
   */
  async turnOff() {
    throw new Error('Method turnOff() must be implemented.');
  }

  /**
   * Send custom raw command
   * @param {string} command 
   * @param {any} payload 
   */
  async sendCommand(command, payload) {
    throw new Error('Method sendCommand() must be implemented.');
  }
}

module.exports = BaseDeviceAdapter;
