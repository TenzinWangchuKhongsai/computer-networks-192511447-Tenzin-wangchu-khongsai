import { create } from 'zustand';
import type {
  Room, Device, Sensor, EnergySummary, SimulationStatus, SystemEvent, AutomationRule, Settings,
  OccupancySource, CameraState, CameraSettings, CameraLogEvent,
  RealDevice, CCTVSource, DeviceCommand, OccupancyState, UnifiedEnergySummary
} from '../types';

interface AppState {
  // Data
  rooms: Room[];
  devices: Device[];
  sensors: Sensor[];
  energy: EnergySummary | null;
  simulation: SimulationStatus;
  events: SystemEvent[];
  automationRules: AutomationRule[];
  settings: Settings;

  // Real-World IoT Hardware State
  realDevices: RealDevice[];
  cctvSources: CCTVSource[];
  deviceCommands: DeviceCommand[];
  occupancyStates: OccupancyState[];
  unifiedEnergy: UnifiedEnergySummary | null;
  failsafePolicy: 'turn_off' | 'keep_state';

  // Camera & Occupancy Source State
  occupancySource: OccupancySource;
  cameraState: CameraState;
  cameraSettings: CameraSettings;
  cameraLogs: CameraLogEvent[];

  // UI State
  connected: boolean;
  loading: boolean;
  sidebarCollapsed: boolean;
  notifications: Notification[];

  // Actions
  setRooms: (rooms: Room[]) => void;
  updateRoom: (roomId: number, updates: Partial<Room> | Room) => void;
  setDevices: (devices: Device[]) => void;
  updateRoomDevices: (roomId: number, devices: Device[]) => void;
  setSensors: (sensors: Sensor[]) => void;
  setEnergy: (energy: EnergySummary) => void;
  setSimulation: (simulation: SimulationStatus) => void;
  setEvents: (events: SystemEvent[]) => void;
  addEvent: (event: SystemEvent) => void;
  setAutomationRules: (rules: AutomationRule[]) => void;
  setSettings: (settings: Settings) => void;
  setConnected: (connected: boolean) => void;
  setLoading: (loading: boolean) => void;
  toggleSidebar: () => void;
  addNotification: (notification: Notification) => void;
  removeNotification: (id: string) => void;

  // Real IoT Actions
  setRealDevices: (devices: RealDevice[]) => void;
  updateRealDevice: (device: RealDevice) => void;
  removeRealDevice: (id: number) => void;
  setCctvSources: (sources: CCTVSource[]) => void;
  updateCctvSource: (source: CCTVSource) => void;
  removeCctvSource: (id: number) => void;
  setDeviceCommands: (commands: DeviceCommand[]) => void;
  addDeviceCommand: (command: DeviceCommand) => void;
  updateDeviceCommand: (id: string, updates: Partial<DeviceCommand>) => void;
  setOccupancyStates: (states: OccupancyState[]) => void;
  updateOccupancyState: (roomId: number, updates: Partial<OccupancyState>) => void;
  setUnifiedEnergy: (energy: UnifiedEnergySummary) => void;
  setFailsafePolicy: (policy: 'turn_off' | 'keep_state') => void;

  // Camera Actions
  setOccupancySource: (source: OccupancySource) => void;
  updateCameraState: (updates: Partial<CameraState>) => void;
  updateCameraSettings: (settings: Partial<CameraSettings>) => void;
  addCameraLog: (log: Omit<CameraLogEvent, 'id'>) => void;

  // Bulk state update
  setFullState: (state: {
    rooms?: Room[];
    devices?: Device[];
    sensors?: Sensor[];
    energy?: EnergySummary;
    simulation?: SimulationStatus;
    realDevices?: RealDevice[];
    cctvSources?: CCTVSource[];
    unifiedEnergy?: UnifiedEnergySummary;
  }) => void;
}

interface Notification {
  id: string;
  type: 'success' | 'error' | 'info' | 'warning';
  message: string;
  timestamp: number;
}

export const useAppStore = create<AppState>((set) => ({
  rooms: [],
  devices: [],
  sensors: [],
  energy: null,
  simulation: { status: 'paused', speed: 1, autoSimulation: false, tickCount: 0 },
  events: [],
  automationRules: [],
  settings: {},

  // Real-World IoT Hardware Initial State
  realDevices: [],
  cctvSources: [],
  deviceCommands: [],
  occupancyStates: [],
  unifiedEnergy: null,
  failsafePolicy: 'turn_off',

  // Default Camera & Occupancy Source State
  occupancySource: 'simulation',
  cameraState: {
    active: false,
    status: 'idle',
    selectedDeviceId: '',
    devices: [],
    peopleCount: 0,
    maxConfidence: 0,
    lightStatus: false,
    mirrored: true,
    modelStatus: 'unloaded',
    consecutivePositiveFrames: 0,
    consecutiveNegativeFrames: 0,
    selectedRoomId: 1, // Default Room 01
  },
  cameraSettings: {
    deviceId: '',
    minConfidence: 0.60, // Default 60%
    simulatedLightPower: 40, // Default 40 W
    frameBufferOn: 3, // 3 consecutive positive frames
    frameBufferOff: 5, // 5 consecutive negative frames
  },
  cameraLogs: [
    {
      id: 'init-1',
      timestamp: new Date().toLocaleTimeString(),
      type: 'source_changed',
      message: 'Occupancy input source set to Simulation Mode.',
    }
  ],

  connected: false,
  loading: true,
  sidebarCollapsed: false,
  notifications: [],

  setRooms: (rooms) => set((state) => ({
    rooms: rooms.map(r => ({
      ...r,
      devices: r.devices || state.devices.filter(d => d.room_id === r.id),
      sensors: r.sensors || state.sensors.filter(s => s.room_id === r.id),
    }))
  })),
  updateRoom: (roomId, updates) => set((state) => ({
    rooms: state.rooms.map(r => {
      if (r.id !== roomId) return r;
      const updatedDevices = updates.devices || r.devices || state.devices.filter(d => d.room_id === roomId);
      const updatedSensors = updates.sensors || r.sensors || state.sensors.filter(s => s.room_id === roomId);
      return {
        ...r,
        ...updates,
        devices: updatedDevices,
        sensors: updatedSensors,
      };
    })
  })),
  setDevices: (devices) => set({ devices }),
  updateRoomDevices: (roomId, devices) => set((state) => ({
    devices: [
      ...state.devices.filter(d => d.room_id !== roomId),
      ...devices
    ],
    rooms: state.rooms.map(r =>
      r.id === roomId ? { ...r, devices } : r
    )
  })),
  setSensors: (sensors) => set({ sensors }),
  setEnergy: (energy) => set({ energy }),
  setSimulation: (simulation) => set({ simulation }),
  setEvents: (events) => set({ events }),
  addEvent: (event) => set((state) => ({
    events: [event, ...state.events].slice(0, 200)
  })),
  setAutomationRules: (rules) => set({ automationRules: rules }),
  setSettings: (settings) => set({ settings }),
  setConnected: (connected) => set({ connected }),
  setLoading: (loading) => set({ loading }),
  toggleSidebar: () => set((state) => ({ sidebarCollapsed: !state.sidebarCollapsed })),
  addNotification: (notification) => set((state) => ({
    notifications: [...state.notifications, notification]
  })),
  removeNotification: (id) => set((state) => ({
    notifications: state.notifications.filter(n => n.id !== id)
  })),

  // Real IoT Actions
  setRealDevices: (devices) => set({ realDevices: devices }),
  updateRealDevice: (device) => set((state) => ({
    realDevices: state.realDevices.some(d => d.id === device.id)
      ? state.realDevices.map(d => d.id === device.id ? device : d)
      : [...state.realDevices, device]
  })),
  removeRealDevice: (id) => set((state) => ({
    realDevices: state.realDevices.filter(d => d.id !== id)
  })),

  setCctvSources: (sources) => set({ cctvSources: sources }),
  updateCctvSource: (source) => set((state) => ({
    cctvSources: state.cctvSources.some(s => s.id === source.id)
      ? state.cctvSources.map(s => s.id === source.id ? source : s)
      : [...state.cctvSources, source]
  })),
  removeCctvSource: (id) => set((state) => ({
    cctvSources: state.cctvSources.filter(s => s.id !== id)
  })),

  setDeviceCommands: (commands) => set({ deviceCommands: commands }),
  addDeviceCommand: (command) => set((state) => ({
    deviceCommands: [command, ...state.deviceCommands.filter(c => c.id !== command.id)].slice(0, 100)
  })),
  updateDeviceCommand: (id, updates) => set((state) => ({
    deviceCommands: state.deviceCommands.map(c => c.id === id ? { ...c, ...updates } : c)
  })),

  setOccupancyStates: (states) => set({ occupancyStates: states }),
  updateOccupancyState: (roomId, updates) => set((state) => ({
    occupancyStates: state.occupancyStates.map(o => o.room_id === roomId ? { ...o, ...updates } : o)
  })),

  setUnifiedEnergy: (energy) => set({ unifiedEnergy: energy }),
  setFailsafePolicy: (policy) => set({ failsafePolicy: policy }),

  // Camera State Actions
  setOccupancySource: (source) => set((state) => {
    let modeLabel = 'Simulation';
    if (source === 'webcam' || source === 'camera') modeLabel = 'Laptop Webcam';
    if (source === 'cctv') modeLabel = 'Network CCTV';

    const log: CameraLogEvent = {
      id: 'log-' + Date.now(),
      timestamp: new Date().toLocaleTimeString(),
      type: 'source_changed',
      message: `Occupancy input source switched to ${modeLabel} Mode.`,
    };
    return {
      occupancySource: source,
      cameraLogs: [log, ...state.cameraLogs].slice(0, 100)
    };
  }),
  updateCameraState: (updates) => set((state) => ({
    cameraState: { ...state.cameraState, ...updates }
  })),
  updateCameraSettings: (updates) => set((state) => ({
    cameraSettings: { ...state.cameraSettings, ...updates }
  })),
  addCameraLog: (log) => set((state) => ({
    cameraLogs: [
      { ...log, id: 'log-' + Date.now() },
      ...state.cameraLogs
    ].slice(0, 100)
  })),

  setFullState: (newState) => set((state) => {
    const devices = newState.devices || state.devices;
    const sensors = newState.sensors || state.sensors;
    const realDevices = newState.realDevices || state.realDevices;
    const cctvSources = newState.cctvSources || state.cctvSources;
    const unifiedEnergy = newState.unifiedEnergy || state.unifiedEnergy;

    const rooms = (newState.rooms || state.rooms).map(r => ({
      ...r,
      devices: r.devices || devices.filter(d => d.room_id === r.id),
      sensors: r.sensors || sensors.filter(s => s.room_id === r.id),
      realDevices: realDevices.filter(d => d.room_id === r.id),
    }));

    return {
      ...(newState.rooms ? { rooms } : {}),
      ...(newState.devices ? { devices } : {}),
      ...(newState.sensors ? { sensors } : {}),
      ...(newState.energy ? { energy: newState.energy } : {}),
      ...(newState.simulation ? { simulation: newState.simulation } : {}),
      ...(newState.realDevices ? { realDevices } : {}),
      ...(newState.cctvSources ? { cctvSources } : {}),
      ...(newState.unifiedEnergy ? { unifiedEnergy } : {}),
      loading: false,
    };
  }),
}));

