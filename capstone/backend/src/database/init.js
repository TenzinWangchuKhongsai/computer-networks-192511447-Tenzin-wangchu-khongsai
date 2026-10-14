const { getConnection } = require('./connection');

function initializeDatabase() {
  const db = getConnection();

  // Create tables
  db.exec(`
    CREATE TABLE IF NOT EXISTS rooms (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      type TEXT NOT NULL,
      floor INTEGER DEFAULT 1,
      occupancy INTEGER DEFAULT 0,
      temperature REAL DEFAULT 24.0,
      light_level REAL DEFAULT 50.0,
      mode TEXT DEFAULT 'auto',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS devices (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      room_id INTEGER NOT NULL,
      type TEXT NOT NULL,
      status INTEGER DEFAULT 0,
      power_rating REAL NOT NULL,
      FOREIGN KEY (room_id) REFERENCES rooms(id)
    );

    CREATE TABLE IF NOT EXISTS sensors (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      room_id INTEGER NOT NULL,
      type TEXT NOT NULL,
      value REAL DEFAULT 0,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (room_id) REFERENCES rooms(id)
    );

    CREATE TABLE IF NOT EXISTS automation_rules (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      description TEXT,
      enabled INTEGER DEFAULT 1,
      condition_type TEXT NOT NULL,
      threshold REAL,
      action_type TEXT NOT NULL,
      action_device TEXT,
      priority INTEGER DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS energy_records (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      room_id INTEGER NOT NULL,
      total_power REAL DEFAULT 0,
      energy_kwh REAL DEFAULT 0,
      baseline_kwh REAL DEFAULT 0,
      timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (room_id) REFERENCES rooms(id)
    );

    CREATE TABLE IF NOT EXISTS events (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      type TEXT NOT NULL,
      room_id INTEGER,
      message TEXT NOT NULL,
      timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS cctv_sources (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      type TEXT NOT NULL,
      ip_address TEXT,
      port INTEGER,
      stream_url TEXT,
      username TEXT,
      password TEXT,
      protocol TEXT DEFAULT 'http',
      enabled INTEGER DEFAULT 1,
      confidence_threshold REAL DEFAULT 0.60,
      room_id INTEGER,
      status TEXT DEFAULT 'unknown',
      last_seen DATETIME,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (room_id) REFERENCES rooms(id)
    );

    CREATE TABLE IF NOT EXISTS real_devices (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      room_id INTEGER,
      type TEXT NOT NULL,
      connection_type TEXT NOT NULL,
      protocol TEXT NOT NULL,
      ip_address TEXT,
      port INTEGER,
      bluetooth_identifier TEXT,
      config_json TEXT,
      rated_power_watts REAL DEFAULT 40.0,
      state TEXT DEFAULT 'OFF',
      control_mode TEXT DEFAULT 'auto',
      control_status TEXT DEFAULT 'unknown',
      last_seen DATETIME,
      last_error TEXT,
      total_runtime_seconds REAL DEFAULT 0,
      last_state_change DATETIME,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (room_id) REFERENCES rooms(id)
    );

    CREATE TABLE IF NOT EXISTS device_commands (
      id TEXT PRIMARY KEY,
      device_id INTEGER NOT NULL,
      command TEXT NOT NULL,
      status TEXT NOT NULL,
      attempts INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      completed_at DATETIME,
      error TEXT,
      FOREIGN KEY (device_id) REFERENCES real_devices(id)
    );

    CREATE TABLE IF NOT EXISTS occupancy_state (
      room_id INTEGER PRIMARY KEY,
      source TEXT DEFAULT 'simulation',
      cctv_source_id INTEGER,
      state TEXT DEFAULT 'UNKNOWN',
      last_detection_class TEXT,
      last_confidence REAL,
      consecutive_positive INTEGER DEFAULT 0,
      consecutive_negative INTEGER DEFAULT 0,
      fail_safe_action TEXT DEFAULT 'turn_off',
      last_change DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (room_id) REFERENCES rooms(id)
    );

    CREATE TABLE IF NOT EXISTS real_automation_rules (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      room_id INTEGER,
      real_device_id INTEGER,
      trigger_condition TEXT NOT NULL,
      action TEXT NOT NULL,
      enabled INTEGER DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (room_id) REFERENCES rooms(id),
      FOREIGN KEY (real_device_id) REFERENCES real_devices(id)
    );
  `);

  // Check if data already exists
  const roomCount = db.prepare('SELECT COUNT(*) as count FROM rooms').get();
  if (roomCount.count === 0) {
    seedData(db);
  }

  console.log('[DB] Database initialized successfully');
}

function seedData(db) {
  console.log('[DB] Seeding initial data...');

  // Seed rooms - 20 rooms across 2 floors with realistic initial occupancy
  const roomData = [
    // Floor 1
    { name: 'Room 01', type: 'conference', floor: 1, temperature: 24.5, light_level: 35, occupancy: 1 },
    { name: 'Room 02', type: 'private_office', floor: 1, temperature: 23.8, light_level: 70, occupancy: 1 },
    { name: 'Room 03', type: 'meeting', floor: 1, temperature: 25.0, light_level: 55, occupancy: 0 },
    { name: 'Room 04', type: 'open_workspace', floor: 1, temperature: 26.2, light_level: 80, occupancy: 1 },
    { name: 'Room 05', type: 'reception', floor: 1, temperature: 23.5, light_level: 75, occupancy: 1 },
    { name: 'Room 06', type: 'break_room', floor: 1, temperature: 24.0, light_level: 60, occupancy: 0 },
    { name: 'Room 07', type: 'private_office', floor: 1, temperature: 24.8, light_level: 45, occupancy: 0 },
    { name: 'Room 08', type: 'meeting', floor: 1, temperature: 25.2, light_level: 50, occupancy: 1 },
    { name: 'Room 09', type: 'open_workspace', floor: 1, temperature: 23.9, light_level: 85, occupancy: 1 },
    { name: 'Room 10', type: 'server_room', floor: 1, temperature: 20.0, light_level: 30, occupancy: 0 },
    // Floor 2
    { name: 'Room 11', type: 'conference', floor: 2, temperature: 26.5, light_level: 38, occupancy: 1 },
    { name: 'Room 12', type: 'private_office', floor: 2, temperature: 23.7, light_level: 65, occupancy: 0 },
    { name: 'Room 13', type: 'meeting', floor: 2, temperature: 25.5, light_level: 40, occupancy: 0 },
    { name: 'Room 14', type: 'open_workspace', floor: 2, temperature: 24.3, light_level: 90, occupancy: 1 },
    { name: 'Room 15', type: 'private_office', floor: 2, temperature: 23.6, light_level: 55, occupancy: 0 },
    { name: 'Room 16', type: 'break_room', floor: 2, temperature: 24.4, light_level: 68, occupancy: 1 },
    { name: 'Room 17', type: 'conference', floor: 2, temperature: 25.1, light_level: 72, occupancy: 0 },
    { name: 'Room 18', type: 'meeting', floor: 2, temperature: 24.6, light_level: 58, occupancy: 0 },
    { name: 'Room 19', type: 'open_workspace', floor: 2, temperature: 23.4, light_level: 82, occupancy: 1 },
    { name: 'Room 20', type: 'private_office', floor: 2, temperature: 24.7, light_level: 48, occupancy: 0 },
  ];

  const insertRoom = db.prepare(
    'INSERT INTO rooms (name, type, floor, occupancy, temperature, light_level, mode) VALUES (?, ?, ?, ?, ?, ?, ?)'
  );

  const insertDevice = db.prepare(
    'INSERT INTO devices (room_id, type, status, power_rating) VALUES (?, ?, ?, ?)'
  );

  const insertSensor = db.prepare(
    'INSERT INTO sensors (room_id, type, value) VALUES (?, ?, ?)'
  );

  const insertAll = db.transaction(() => {
    for (const room of roomData) {
      const result = insertRoom.run(
        room.name, room.type, room.floor, room.occupancy,
        room.temperature, room.light_level, 'auto'
      );
      const roomId = result.lastInsertRowid;

      // Active status based on occupancy and room type/temperature
      const lightStatus = room.occupancy && room.light_level < 60 ? 1 : (room.occupancy ? 1 : 0);
      const fanStatus = room.occupancy && room.temperature >= 25.0 ? 1 : 0;
      const coolingStatus = room.type === 'server_room' || (room.occupancy && room.temperature >= 26.0) ? 1 : 0;

      // Create 3 devices per room
      insertDevice.run(roomId, 'light', lightStatus, 100);    // 100W
      insertDevice.run(roomId, 'fan', fanStatus, 75);         // 75W
      insertDevice.run(roomId, 'cooling', coolingStatus, 1000);// 1000W

      // Create 4 sensors per room
      const roomPower = (lightStatus * 100) + (fanStatus * 75) + (coolingStatus * 1000);
      insertSensor.run(roomId, 'occupancy', room.occupancy);
      insertSensor.run(roomId, 'temperature', room.temperature);
      insertSensor.run(roomId, 'light', room.light_level);
      insertSensor.run(roomId, 'energy', Math.round(roomPower) / 1000);
    }
  });

  insertAll();

  // Seed automation rules
  const insertRule = db.prepare(
    'INSERT INTO automation_rules (name, description, enabled, condition_type, threshold, action_type, action_device, priority) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
  );

  const seedRules = db.transaction(() => {
    insertRule.run(
      'Empty Room Shutdown', 'Turn off all devices when room is empty',
      1, 'empty_room', null, 'turn_off', 'all', 10
    );
    insertRule.run(
      'Automatic Lighting', 'Turn on lights when occupied and light is low',
      1, 'low_light', 40, 'turn_on', 'light', 5
    );
    insertRule.run(
      'High Temperature Cooling', 'Turn on cooling when temperature exceeds threshold',
      1, 'high_temperature', 26, 'turn_on', 'cooling', 5
    );
    insertRule.run(
      'Automatic Fan Control', 'Turn on fan when temperature is moderately high',
      1, 'moderate_temperature', 25, 'turn_on', 'fan', 4
    );
    insertRule.run(
      'Comfortable Temperature', 'Turn off cooling when temperature is comfortable',
      1, 'comfortable_temperature', 24, 'turn_off', 'cooling', 3
    );
    insertRule.run(
      'Sufficient Light', 'Turn off lights when natural light is sufficient',
      1, 'high_light', 70, 'turn_off', 'light', 3
    );
  });

  seedRules();

  // Seed default settings - auto-start simulation & dynamic mode on boot
  const insertSetting = db.prepare(
    'INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)'
  );

  const seedSettings = db.transaction(() => {
    insertSetting.run('simulation_speed', '1');
    insertSetting.run('simulation_status', 'running');
    insertSetting.run('presentation_mode', 'false');
    insertSetting.run('auto_simulation', 'true');
    insertSetting.run('temperature_unit', 'celsius');
    insertSetting.run('energy_baseline_multiplier', '1.5');
    insertSetting.run('camera_failsafe_policy', 'turn_off');
    insertSetting.run('detection_confidence_threshold', '0.60');
    insertSetting.run('stability_buffer_on', '3');
    insertSetting.run('stability_buffer_off', '5');
    insertSetting.run('occupancy_source', 'simulation');
    insertSetting.run('automation_enabled', 'true');
    insertSetting.run('emergency_mode', 'false');
  });

  seedSettings();

  console.log('[DB] Seed data inserted: 20 rooms, 60 devices, 80 sensors, 6 rules');
}

function resetDatabase() {
  const db = getConnection();
  db.exec(`
    DELETE FROM real_automation_rules;
    DELETE FROM device_commands;
    DELETE FROM real_devices;
    DELETE FROM cctv_sources;
    DELETE FROM occupancy_state;
    DELETE FROM energy_records;
    DELETE FROM events;
    DELETE FROM sensors;
    DELETE FROM devices;
    DELETE FROM rooms;
    DELETE FROM automation_rules;
    DELETE FROM settings;
    DELETE FROM sqlite_sequence;
  `);
  seedData(db);
  console.log('[DB] Database reset complete');
}

module.exports = { initializeDatabase, resetDatabase };
