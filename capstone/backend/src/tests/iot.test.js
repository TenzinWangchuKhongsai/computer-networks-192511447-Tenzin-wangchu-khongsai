const test = require('node:test');
const assert = require('node:assert');
const { initializeDatabase } = require('../database/init');
const realDeviceService = require('../services/realDeviceService');
const cameraService = require('../services/cameraService');
const occupancyEngine = require('../services/occupancyEngine');
const commandQueue = require('../services/commandQueue');
const realEnergyService = require('../services/realEnergyService');
const energyEngine = require('../services/energyEngine');
const deviceService = require('../services/deviceService');
const simulationEngine = require('../services/simulationEngine');

// Initialize database before running tests
initializeDatabase();

test('TEST 1: Existing simulation still works', () => {
  const status = simulationEngine.getStatus();
  assert.ok(status, 'Simulation engine status must exist');
  assert.strictEqual(typeof status.speed, 'number');
  assert.strictEqual(typeof status.autoSimulation, 'boolean');

  const summary = energyEngine.getSummary();
  assert.ok(summary.currentPowerKW >= 0, 'Virtual simulated power must be non-negative');
});

test('TEST 5 & 18: CCTV source registration, security, and connection test', async () => {
  // Test password is never returned
  const created = await cameraService.createSource({
    name: 'Test Entrance CCTV',
    type: 'rtsp',
    ip_address: '127.0.0.1',
    port: 554,
    protocol: 'rtsp',
    username: 'admin',
    password: 'SuperSecretPassword123!',
    room_id: 1
  });

  assert.ok(created.id, 'CCTV source must have ID');
  assert.strictEqual(created.name, 'Test Entrance CCTV');
  // TEST 18: password must NOT be in returned source
  assert.strictEqual(created.password, undefined, 'Password must not be returned');
  assert.strictEqual(created.has_password, true, 'has_password indicator must be true');

  // Unsupported protocol check
  const badProtoRes = await cameraService.testConnection({
    type: 'unsupported_camera_protocol',
    protocol: 'xyz_unknown',
    ip_address: '1.2.3.4'
  });
  assert.strictEqual(badProtoRes.status, 'unsupported');
  assert.strictEqual(badProtoRes.message, 'Camera protocol not supported');

  // Clean up
  cameraService.deleteSource(created.id);
});

test('TEST 7 & 8 & 13: Real device registration and offline error detection', async () => {
  const dev = await realDeviceService.create({
    name: 'Test Smart Plug 01',
    room_id: 1,
    type: 'smart_plug',
    connection_type: 'wifi',
    protocol: 'shelly_http',
    ip_address: '192.0.2.1', // Reserved TEST-NET IP (unreachable)
    port: 80,
    rated_power_watts: 60,
    control_mode: 'auto'
  });

  assert.ok(dev.id, 'Device must be created');
  assert.strictEqual(dev.state, 'OFF');

  // TEST 13: Disconnected device does not generate fake SUCCESS
  const cmdRes = await commandQueue.enqueue(dev.id, 'TURN_ON');
  assert.strictEqual(cmdRes.success, false, 'Command to offline device must fail');
  assert.strictEqual(cmdRes.status, 'FAILED', 'Status must be FAILED');
  assert.ok(cmdRes.error.includes('DEVICE_OFFLINE') || cmdRes.error.includes('timed out') || cmdRes.error.includes('unreachable'), 'Must report accurate offline reason');

  realDeviceService.delete(dev.id);
});

test('TEST 15: Duplicate device commands are prevented', async () => {
  const dev = await realDeviceService.create({
    name: 'Duplicate Test Lamp',
    room_id: 2,
    type: 'light',
    connection_type: 'wifi',
    protocol: 'raw_tcp',
    ip_address: '127.0.0.1',
    port: 8080,
    rated_power_watts: 40,
    control_mode: 'auto'
  });

  // Manually mock device state to ON and connected
  const { getConnection } = require('../database/connection');
  getConnection().prepare("UPDATE real_devices SET state = 'ON', control_status = 'connected' WHERE id = ?").run(dev.id);

  // Attempt duplicate TURN_ON
  const dupRes = await commandQueue.enqueue(dev.id, 'TURN_ON');
  assert.strictEqual(dupRes.skipped, true, 'Duplicate command must be skipped');
  assert.strictEqual(dupRes.reason, 'DUPLICATE_PREVENTED', 'Reason must be DUPLICATE_PREVENTED');

  realDeviceService.delete(dev.id);
});

test('TEST 3 & 4 & 10 & 11 & 12: Occupancy Engine stability buffer & automation trigger', () => {
  const roomId = 3;

  // Initial state should be VACANT
  let st = occupancyEngine.getState(roomId);
  assert.ok(st, 'Occupancy state must exist');

  // Frame 1 positive detection
  occupancyEngine.processDetection(roomId, {
    source: 'cctv',
    sourceName: 'CCTV-01',
    personDetected: true,
    confidence: 0.95,
    personCount: 1
  });
  // Needs 3 frames to transition to OCCUPIED
  st = occupancyEngine.getState(roomId);
  assert.notStrictEqual(st.state, 'OCCUPIED', 'Should not transition on a single frame');

  // Frame 2 positive detection
  occupancyEngine.processDetection(roomId, {
    source: 'cctv',
    sourceName: 'CCTV-01',
    personDetected: true,
    confidence: 0.95,
    personCount: 1
  });

  // Frame 3 positive detection -> Triggers OCCUPIED
  const res3 = occupancyEngine.processDetection(roomId, {
    source: 'cctv',
    sourceName: 'CCTV-01',
    personDetected: true,
    confidence: 0.95,
    personCount: 1
  });
  assert.strictEqual(res3.state, 'OCCUPIED', '3 consecutive positive detections must set OCCUPIED');

  // Verify Virtual Device turned ON
  const light = deviceService.getByRoomAndType(roomId, 'light');
  assert.strictEqual(light.status, 1, 'Virtual Light must turn ON in auto mode when occupied');

  // Negative frames stability: 5 frames needed
  for (let i = 0; i < 4; i++) {
    const r = occupancyEngine.processDetection(roomId, {
      source: 'cctv',
      sourceName: 'CCTV-01',
      personDetected: false,
      confidence: 0,
      personCount: 0
    });
    assert.strictEqual(r.state, 'OCCUPIED', 'Must remain OCCUPIED until 5 negative frames elapsed');
  }

  // 5th negative frame -> Triggers VACANT
  const res5 = occupancyEngine.processDetection(roomId, {
    source: 'cctv',
    sourceName: 'CCTV-01',
    personDetected: false,
    confidence: 0,
    personCount: 0
  });
  assert.strictEqual(res5.state, 'VACANT', '5 negative frames must set VACANT');

  // Verify Virtual Devices turned OFF
  const allDevs = deviceService.getAll(roomId);
  assert.strictEqual(allDevs.every(d => d.status === 0), true, 'All devices must turn OFF when room is empty');
});

test('TEST 14: Camera failure produces UNKNOWN occupancy and applies Fail-Safe', () => {
  const roomId = 4;

  // Turn ON light first
  deviceService.setStatusByRoomAndType(roomId, 'light', true);

  // Trigger camera failure
  occupancyEngine.handleCameraFailure(roomId, { source: 'cctv', sourceName: 'CCTV-01' });

  const st = occupancyEngine.getState(roomId);
  assert.strictEqual(st.state, 'UNKNOWN', 'Camera failure must transition occupancy to UNKNOWN');

  // Check fail-safe action: default is 'turn_off'
  const light = deviceService.getByRoomAndType(roomId, 'light');
  assert.strictEqual(light.status, 0, 'Fail-safe must safely turn off devices to avoid runaway consumption');
});

test('TEST 17: Energy monitoring strictly distinguishes Simulated vs Real Estimated Energy', () => {
  const summary = realEnergyService.getSummary();

  assert.ok(summary.simulated, 'Simulated energy object must exist');
  assert.ok(summary.realDevices, 'Real devices energy object must exist');

  assert.strictEqual(typeof summary.simulated.powerKW, 'number');
  assert.strictEqual(typeof summary.simulated.savingsPercent, 'number');

  assert.strictEqual(typeof summary.realDevices.powerW, 'number');
  assert.strictEqual(typeof summary.realDevices.estimatedEnergyKWH, 'number');
  assert.strictEqual(summary.realDevices.calculationMethod, 'rated_power_watts × operating_time (ESTIMATED)');
});
