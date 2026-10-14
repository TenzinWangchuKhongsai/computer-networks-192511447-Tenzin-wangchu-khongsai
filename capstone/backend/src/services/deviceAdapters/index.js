const WiFiDeviceAdapter = require('./wifiAdapter');
const BluetoothDeviceAdapter = require('./bluetoothAdapter');

/**
 * Creates the appropriate hardware adapter for a real device
 * @param {object} device
 * @returns {WiFiDeviceAdapter | BluetoothDeviceAdapter}
 */
function createDeviceAdapter(device) {
  if (device.connection_type === 'bluetooth') {
    return new BluetoothDeviceAdapter(device);
  }
  return new WiFiDeviceAdapter(device);
}

module.exports = {
  createDeviceAdapter,
  WiFiDeviceAdapter,
  BluetoothDeviceAdapter
};
