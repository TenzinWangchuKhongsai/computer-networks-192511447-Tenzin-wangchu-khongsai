// ============================================
// Smart Office IoT Simulation - TypeScript Types
// ============================================

export interface Room {
  id: number;
  name: string;
  type: RoomType;
  floor: number;
  occupancy: number; // 0 or 1
  temperature: number;
  light_level: number;
  mode: 'auto' | 'manual';
  created_at: string;
  updated_at: string;
  devices?: Device[];
  sensors?: Sensor[];
  currentPower?: number;
}

export type RoomType =
  | 'conference'
  | 'private_office'
  | 'meeting'
  | 'open_workspace'
  | 'reception'
  | 'server_room'
  | 'break_room';

export interface Device {
  id: number;
  room_id: number;
  type: DeviceType;
  status: number; // 0 or 1
  power_rating: number;
  room_name?: string;
}

export type DeviceType = 'light' | 'fan' | 'cooling';

export interface Sensor {
  id: number;
  room_id: number;
  type: SensorType;
  value: number;
  updated_at: string;
  room_name?: string;
}

export type SensorType = 'occupancy' | 'temperature' | 'light' | 'energy';

export interface AutomationRule {
  id: number;
  name: string;
  description: string;
  enabled: number; // 0 or 1
  condition_type: string;
  threshold: number | null;
  action_type: string;
  action_device: string;
  priority: number;
}

export interface EnergyRecord {
  id: number;
  room_id: number;
  total_power: number;
  energy_kwh: number;
  baseline_kwh: number;
  timestamp: string;
}

export interface EnergySummary {
  currentPowerW: number;
  currentPowerKW: number;
  totalEnergyKWH: number;
  baselineEnergyKWH: number;
  savingsPercent: number;
  powerByType: PowerByType[];
}

export interface PowerByType {
  type: string;
  count: number;
  active_count: number;
  total_power: number;
}

export interface SystemEvent {
  id: number;
  type: string;
  room_id: number | null;
  message: string;
  timestamp: string;
  room_name?: string;
}

export interface SimulationStatus {
  status: 'running' | 'paused';
  speed: number;
  autoSimulation: boolean;
  tickCount: number;
}

export interface Settings {
  [key: string]: string;
}

export interface RoomEnergy {
  id: number;
  name: string;
  type: string;
  currentPower: number;
  totalEnergy: number;
  baseline: number;
}

export interface FullState {
  rooms: Room[];
  devices: Device[];
  sensors: Sensor[];
  energy: EnergySummary;
  simulation?: SimulationStatus;
}

// Room type display names
export const ROOM_TYPE_LABELS: Record<RoomType, string> = {
  conference: 'Conference Room',
  private_office: 'Private Office',
  meeting: 'Meeting Room',
  open_workspace: 'Open Workspace',
  reception: 'Reception',
  server_room: 'Server Room',
  break_room: 'Break Room',
};

// Room type colors for visual distinction
export const ROOM_TYPE_COLORS: Record<RoomType, string> = {
  conference: '#6366f1',
  private_office: '#06b6d4',
  meeting: '#8b5cf6',
  open_workspace: '#10b981',
  reception: '#f59e0b',
  server_room: '#ef4444',
  break_room: '#ec4899',
};

// ============================================
// Camera & Occupancy Detection Types
// ============================================

export type OccupancySource = 'simulation' | 'camera' | 'webcam' | 'cctv';

export type CameraStatus = 'idle' | 'requesting' | 'live' | 'stopped' | 'denied' | 'error';

export type ModelStatus = 'unloaded' | 'loading' | 'ready' | 'error';

export interface DetectionResult {
  class: string;
  score: number;
  bbox: [number, number, number, number]; // [x, y, width, height]
}

export interface CameraSettings {
  deviceId: string;
  minConfidence: number; // e.g. 0.60 for 60%
  simulatedLightPower: number; // e.g. 40 W
  frameBufferOn: number; // e.g. 3 consecutive frames
  frameBufferOff: number; // e.g. 5 consecutive frames
}

export interface CameraState {
  active: boolean;
  status: CameraStatus;
  errorMessage?: string;
  selectedDeviceId: string;
  devices: { deviceId: string; label: string }[];
  peopleCount: number;
  maxConfidence: number;
  lightStatus: boolean;
  mirrored: boolean;
  modelStatus: ModelStatus;
  consecutivePositiveFrames: number;
  consecutiveNegativeFrames: number;
  selectedRoomId: number;
  selectedCctvId?: number;
}

export interface CameraLogEvent {
  id: string;
  timestamp: string;
  type: 'person_entered' | 'person_left' | 'camera_started' | 'camera_stopped' | 'source_changed' | 'settings_changed' | 'error' | 'command_sent' | 'command_success' | 'command_failed' | 'fail_safe';
  message: string;
  peopleCount?: number;
  confidence?: number;
  lightState?: boolean;
}

// ============================================
// Real-World IoT Hardware Types
// ============================================

export type RealDeviceType = 'light' | 'fan' | 'ac' | 'smart_plug' | 'other';
export type ConnectionType = 'wifi' | 'bluetooth';
export type DeviceProtocol = 'tasmota_http' | 'shelly_http' | 'generic_rest' | 'raw_tcp' | 'ble_gatt';
export type DeviceControlStatus = 'connected' | 'disconnected' | 'error' | 'unknown';

export interface RealDevice {
  id: number;
  name: string;
  room_id: number | null;
  room_name?: string;
  type: RealDeviceType;
  connection_type: ConnectionType;
  protocol: DeviceProtocol;
  ip_address?: string | null;
  port?: number | null;
  bluetooth_identifier?: string | null;
  config_json?: string | null;
  rated_power_watts: number;
  state: 'ON' | 'OFF';
  control_mode: 'auto' | 'manual';
  control_status: DeviceControlStatus;
  last_seen?: string | null;
  last_error?: string | null;
  total_runtime_seconds: number;
  created_at: string;
}

export interface CCTVSource {
  id: number;
  name: string;
  type: 'webcam' | 'rtsp' | 'mjpeg' | 'http_snapshot' | 'onvif';
  ip_address?: string | null;
  port?: number | null;
  stream_url?: string | null;
  username?: string | null;
  protocol: string;
  enabled: boolean;
  confidence_threshold: number;
  room_id: number | null;
  room_name?: string;
  status: 'online' | 'offline' | 'error' | 'unknown' | 'unsupported';
  last_seen?: string | null;
  has_password?: boolean;
}

export interface DeviceCommand {
  id: string;
  device_id: number;
  device_name?: string;
  device_type?: string;
  room_id?: number;
  room_name?: string;
  command: string;
  status: 'PENDING' | 'SENT' | 'SUCCESS' | 'FAILED' | 'TIMEOUT';
  attempts: number;
  created_at: string;
  completed_at?: string | null;
  error?: string | null;
}

export interface OccupancyState {
  room_id: number;
  room_name?: string;
  source: 'simulation' | 'webcam' | 'cctv';
  cctv_source_id?: number | null;
  cctv_name?: string | null;
  state: 'OCCUPIED' | 'VACANT' | 'UNKNOWN';
  last_detection_class?: string | null;
  last_confidence?: number;
  consecutive_positive: number;
  consecutive_negative: number;
  fail_safe_action: 'turn_off' | 'keep_state';
  last_change: string;
}

export interface UnifiedEnergySummary {
  simulated: {
    powerW: number;
    powerKW: number;
    energyKWH: number;
    baselineKWH: number;
    savingsPercent: number;
    powerByType: PowerByType[];
  };
  realDevices: {
    deviceCount: number;
    activeCount: number;
    powerW: number;
    powerKW: number;
    estimatedEnergyKWH: number;
    powerByType: {
      type: string;
      count: number;
      activeCount: number;
      totalPowerWatts: number;
      estimatedEnergyKWH: number;
    }[];
    calculationMethod: string;
  };
}


