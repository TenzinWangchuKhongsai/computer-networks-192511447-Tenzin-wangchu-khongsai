import axios from 'axios';
import type {
  Room, Device, Sensor, AutomationRule, EnergySummary, SystemEvent,
  SimulationStatus, Settings, RoomEnergy, PowerByType, EnergyRecord,
  RealDevice, CCTVSource, DeviceCommand, OccupancyState, UnifiedEnergySummary
} from '../types';

const API_BASE = '/api';

const api = axios.create({
  baseURL: API_BASE,
  headers: { 'Content-Type': 'application/json' },
});

// ========== Rooms ==========
export const fetchRooms = () => api.get<Room[]>('/rooms').then(r => r.data);
export const fetchRoom = (id: number) => api.get<Room>(`/rooms/${id}`).then(r => r.data);
export const setOccupancy = (id: number, occupied: boolean) =>
  api.post<Room>(`/rooms/${id}/occupancy`, { occupied }).then(r => r.data);
export const setBulkOccupancy = (occupied: boolean, roomIds?: number[], all?: boolean) =>
  api.post<{ message: string; count: number }>('/rooms/occupancy/bulk', { occupied, roomIds, all }).then(r => r.data);
export const setRoomMode = (id: number, mode: 'auto' | 'manual') =>
  api.put(`/rooms/${id}/mode`, { mode }).then(r => r.data);
export const updateRoomSensor = (id: number, type: string, value: number) =>
  api.put(`/rooms/${id}/sensor`, { type, value }).then(r => r.data);

// ========== Devices ==========
export const fetchDevices = (roomId?: number) =>
  api.get<Device[]>('/devices', { params: roomId ? { roomId } : {} }).then(r => r.data);
export const toggleDevice = (id: number) =>
  api.post<Device>(`/devices/${id}/toggle`).then(r => r.data);
export const setDeviceStatus = (id: number, status: boolean) =>
  api.post<Device>(`/devices/${id}/set`, { status }).then(r => r.data);

// ========== Sensors ==========
export const fetchSensors = (roomId?: number) =>
  api.get<Sensor[]>('/sensors', { params: roomId ? { roomId } : {} }).then(r => r.data);
export const updateSensor = (id: number, value: number) =>
  api.put<Sensor>(`/sensors/${id}`, { value }).then(r => r.data);

// ========== Automation ==========
export const fetchAutomationRules = () =>
  api.get<AutomationRule[]>('/automation/rules').then(r => r.data);
export const updateAutomationRule = (id: number, updates: { enabled?: boolean; threshold?: number }) =>
  api.put<AutomationRule>(`/automation/rules/${id}`, updates).then(r => r.data);

// ========== Energy ==========
export const fetchEnergySummary = () =>
  api.get<EnergySummary>('/energy/summary').then(r => r.data);
export const fetchEnergyByRoom = () =>
  api.get<RoomEnergy[]>('/energy/by-room').then(r => r.data);
export const fetchEnergyByDevice = () =>
  api.get<PowerByType[]>('/energy/by-device').then(r => r.data);
export const fetchEnergyRecords = (limit = 100, roomId?: number) =>
  api.get<EnergyRecord[]>('/energy/records', { params: { limit, ...(roomId ? { roomId } : {}) } }).then(r => r.data);
export const fetchEnergyTrend = () =>
  api.get('/energy/trend').then(r => r.data);

// ========== Events ==========
export const fetchEvents = (limit = 100, type?: string, roomId?: number) =>
  api.get<SystemEvent[]>('/events', { params: { limit, ...(type ? { type } : {}), ...(roomId ? { roomId } : {}) } }).then(r => r.data);
export const setBulkDevices = async (
  roomIds: number[] | 'all',
  deviceTypes: string[] | 'all',
  status: boolean,
  setManualMode: boolean = true
) => {
  const res = await fetch(`${API_BASE}/devices/bulk`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ roomIds, deviceTypes, status, setManualMode }),
  });
  if (!res.ok) throw new Error('Failed to update devices in bulk');
  return res.json();
};
export const clearEvents = () => api.delete('/events').then(r => r.data);

// ========== Simulation ==========
export const fetchSimulationStatus = () =>
  api.get<SimulationStatus>('/simulation/status').then(r => r.data);
export const startSimulation = () =>
  api.post<SimulationStatus>('/simulation/start').then(r => r.data);
export const pauseSimulation = () =>
  api.post<SimulationStatus>('/simulation/pause').then(r => r.data);
export const resetSimulation = () =>
  api.post<SimulationStatus>('/simulation/reset').then(r => r.data);
export const stepSimulation = () =>
  api.post<SimulationStatus>('/simulation/step').then(r => r.data);
export const setSimulationSpeed = (speed: number) =>
  api.put<SimulationStatus>('/simulation/speed', { speed }).then(r => r.data);
export const setAutoSimulation = (enabled: boolean) =>
  api.put<SimulationStatus>('/simulation/auto', { enabled }).then(r => r.data);

// ========== Settings ==========
export const fetchSettings = () =>
  api.get<Settings>('/settings').then(r => r.data);
export const updateSettings = (updates: Settings) =>
  api.put<Settings>('/settings', updates).then(r => r.data);

// ========== Health ==========
export const checkHealth = () =>
  api.get('/health').then(r => r.data);

// ========== Real Devices API ==========
export const fetchRealDevices = (roomId?: number) =>
  api.get<RealDevice[]>('/real-devices', { params: { roomId } }).then(r => r.data);

export const fetchRealDevice = (id: number) =>
  api.get<RealDevice>(`/real-devices/${id}`).then(r => r.data);

export const createRealDevice = (data: Partial<RealDevice>) =>
  api.post<RealDevice>('/real-devices', data).then(r => r.data);

export const updateRealDevice = (id: number, data: Partial<RealDevice>) =>
  api.put<RealDevice>(`/real-devices/${id}`, data).then(r => r.data);

export const deleteRealDevice = (id: number) =>
  api.delete<{ success: boolean }>(`/real-devices/${id}`).then(r => r.data);

export const testRealDeviceConnection = (data: Partial<RealDevice>) =>
  api.post<{ success: boolean; status: string; latencyMs?: number; message?: string }>('/real-devices/test-connection', data).then(r => r.data);

export const toggleRealDevice = (id: number) =>
  api.post<any>(`/real-devices/${id}/toggle`).then(r => r.data);

export const setRealDevicePower = (id: number, status: boolean) =>
  api.post<any>(`/real-devices/${id}/set`, { status }).then(r => r.data);

export const setRealDeviceMode = (id: number, mode: 'auto' | 'manual') =>
  api.put<RealDevice>(`/real-devices/${id}/mode`, { mode }).then(r => r.data);

export const fetchRecentCommands = (limit: number = 50) =>
  api.get<DeviceCommand[]>('/real-devices/commands/recent', { params: { limit } }).then(r => r.data);

export const fetchRealDeviceStats = () =>
  api.get<any>('/real-devices/stats').then(r => r.data);

// ========== CCTV API ==========
export const fetchCctvSources = () =>
  api.get<CCTVSource[]>('/cctv').then(r => r.data);

export const fetchCctvSource = (id: number) =>
  api.get<CCTVSource>(`/cctv/${id}`).then(r => r.data);

export const createCctvSource = (data: Partial<CCTVSource>) =>
  api.post<CCTVSource>('/cctv', data).then(r => r.data);

export const updateCctvSource = (id: number, data: Partial<CCTVSource>) =>
  api.put<CCTVSource>(`/cctv/${id}`, data).then(r => r.data);

export const deleteCctvSource = (id: number) =>
  api.delete<{ success: boolean }>(`/cctv/${id}`).then(r => r.data);

export const testCctvConnection = (data: Partial<CCTVSource>) =>
  api.post<{ success: boolean; status: string; latencyMs?: number; message?: string }>('/cctv/test-connection', data).then(r => r.data);

export const testExistingCctv = (id: number) =>
  api.post<{ success: boolean; status: string; latencyMs?: number; message?: string }>(`/cctv/${id}/test`).then(r => r.data);

// ========== Occupancy Engine API ==========
export const fetchOccupancyStates = () =>
  api.get<OccupancyState[]>('/occupancy').then(r => r.data);

export const fetchFailSafeSettings = () =>
  api.get<{ policy: 'turn_off' | 'keep_state'; bufferOn: number; bufferOff: number }>('/occupancy/settings/failsafe').then(r => r.data);

export const updateFailSafeSettings = (settings: { policy?: 'turn_off' | 'keep_state'; bufferOn?: number; bufferOff?: number }) =>
  api.put('/occupancy/settings/failsafe', settings).then(r => r.data);

export const postOccupancyDetection = (roomId: number, detection: {
  source: 'webcam' | 'cctv' | 'simulation';
  cctvSourceId?: number;
  sourceName?: string;
  personDetected: boolean;
  confidence?: number;
  personCount?: number;
}) =>
  api.post(`/occupancy/${roomId}/detection`, detection).then(r => r.data);

export const reportCameraFailure = (roomId: number, failure: { source: string; sourceName?: string }) =>
  api.post(`/occupancy/${roomId}/failure`, failure).then(r => r.data);

// ========== Unified Energy API ==========
export const fetchUnifiedEnergy = () =>
  api.get<UnifiedEnergySummary>('/energy/unified').then(r => r.data);

export default api;

