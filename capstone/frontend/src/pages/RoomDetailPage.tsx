import { useParams, useNavigate } from 'react-router-dom';
import { useAppStore } from '../store/appStore';
import { setOccupancy, toggleDevice, updateRoomSensor } from '../services/api';
import { ROOM_TYPE_LABELS } from '../types';
import type { RoomType, Device } from '../types';
import { ArrowLeft, Users, UserMinus, Lightbulb, Fan, Snowflake, Thermometer, Sun, Zap } from 'lucide-react';
import { useState } from 'react';

export default function RoomDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { rooms, updateRoom } = useAppStore();
  const room = rooms.find(r => r.id === Number(id));
  const [loading, setLoading] = useState<string | null>(null);

  if (!room) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-slate-500">
        <p className="text-lg mb-4 font-semibold">Room not found</p>
        <button onClick={() => navigate('/rooms')} className="text-blue-600 font-semibold hover:underline">← Back to Rooms</button>
      </div>
    );
  }

  const handleOccupancy = async (occupied: boolean) => {
    setLoading(occupied ? 'enter' : 'leave');
    try {
      const updated = await setOccupancy(room.id, occupied);
      updateRoom(room.id, updated);
    } catch (err) {
      console.error('Failed to update occupancy:', err);
    }
    setLoading(null);
  };

  const handleDeviceToggle = async (device: Device) => {
    setLoading(`device-${device.id}`);
    try {
      await toggleDevice(device.id);
    } catch (err) {
      console.error('Failed to toggle device:', err);
    }
    setLoading(null);
  };

  const handleSensorChange = async (type: string, value: number) => {
    try {
      await updateRoomSensor(room.id, type, value);
    } catch (err) {
      console.error('Failed to update sensor:', err);
    }
  };

  const deviceIcons: Record<string, any> = {
    light: Lightbulb,
    fan: Fan,
    cooling: Snowflake,
  };

  const deviceColors: Record<string, string> = {
    light: 'text-amber-500',
    fan: 'text-cyan-600',
    cooling: 'text-blue-600',
  };

  return (
    <div className="space-y-6 max-w-5xl">
      {/* Header */}
      <div className="flex items-center gap-4">
        <button onClick={() => navigate('/rooms')} className="p-2 rounded-lg hover:bg-slate-200 transition-colors text-slate-600">
          <ArrowLeft size={20} />
        </button>
        <div>
          <h1 className="text-2xl font-bold text-slate-900">{room.name}</h1>
          <p className="text-sm font-semibold text-blue-600">{ROOM_TYPE_LABELS[room.type as RoomType] || room.type} · Floor {room.floor}</p>
        </div>
        <div className="ml-auto flex items-center gap-3">
          {/* Occupancy status */}
          <div className={`px-4 py-2 rounded-lg text-sm font-bold border shadow-2xs ${
            room.occupancy
              ? 'bg-emerald-100 text-emerald-800 border-emerald-200'
              : 'bg-slate-100 text-slate-600 border-slate-200'
          }`}>
            {room.occupancy ? '● Occupied' : '○ Empty'}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left Column: Sensors & Occupancy */}
        <div className="space-y-4">
          {/* Occupancy Controls */}
          <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-2xs">
            <h3 className="text-sm font-bold text-slate-900 mb-4">Occupancy Controls</h3>
            <div className="flex gap-3">
              <button
                onClick={() => handleOccupancy(true)}
                disabled={!!room.occupancy || loading === 'enter'}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-bold text-sm transition-all shadow-2xs disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <Users size={16} />
                {loading === 'enter' ? 'Entering...' : 'Enter Room'}
              </button>
              <button
                onClick={() => handleOccupancy(false)}
                disabled={!room.occupancy || loading === 'leave'}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-rose-600 hover:bg-rose-700 text-white rounded-lg font-bold text-sm transition-all shadow-2xs disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <UserMinus size={16} />
                {loading === 'leave' ? 'Leaving...' : 'Leave Room'}
              </button>
            </div>
          </div>

          {/* Sensors */}
          <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-2xs">
            <h3 className="text-sm font-bold text-slate-900 mb-4">Virtual Sensors</h3>
            <div className="space-y-4">
              {/* Occupancy Sensor */}
              <div className="flex items-center justify-between py-2 border-b border-slate-100">
                <div className="flex items-center gap-3">
                  <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${room.occupancy ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-400'}`}>
                    <Users size={18} />
                  </div>
                  <div>
                    <p className="text-sm font-bold text-slate-900">Occupancy Sensor</p>
                    <p className="text-xs text-slate-500 font-medium">Motion detection</p>
                  </div>
                </div>
                <span className={`text-sm font-bold ${room.occupancy ? 'text-emerald-700' : 'text-slate-400'}`}>
                  {room.occupancy ? 'Detected' : 'Not Detected'}
                </span>
              </div>

              {/* Temperature Sensor */}
              <div className="py-2 border-b border-slate-100">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-lg bg-orange-100 text-orange-600 flex items-center justify-center">
                      <Thermometer size={18} />
                    </div>
                    <div>
                      <p className="text-sm font-bold text-slate-900">Temperature Sensor</p>
                      <p className="text-xs text-slate-500 font-medium">Ambient temperature</p>
                    </div>
                  </div>
                  <span className="text-sm font-bold text-orange-600">{room.temperature}°C</span>
                </div>
                <input
                  type="range"
                  min="15"
                  max="40"
                  step="0.5"
                  value={room.temperature}
                  onChange={(e) => handleSensorChange('temperature', parseFloat(e.target.value))}
                  className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-orange-500"
                />
                <div className="flex justify-between text-[10px] text-slate-400 font-medium mt-1">
                  <span>15°C</span><span>40°C</span>
                </div>
              </div>

              {/* Light Sensor */}
              <div className="py-2 border-b border-slate-100">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-lg bg-amber-100 text-amber-600 flex items-center justify-center">
                      <Sun size={18} />
                    </div>
                    <div>
                      <p className="text-sm font-bold text-slate-900">Light Sensor</p>
                      <p className="text-xs text-slate-500 font-medium">Ambient light level</p>
                    </div>
                  </div>
                  <span className="text-sm font-bold text-amber-600">{room.light_level}%</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="100"
                  step="1"
                  value={room.light_level}
                  onChange={(e) => handleSensorChange('light', parseInt(e.target.value))}
                  className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-amber-500"
                />
                <div className="flex justify-between text-[10px] text-slate-400 font-medium mt-1">
                  <span>0%</span><span>100%</span>
                </div>
              </div>

              {/* Energy Sensor */}
              <div className="flex items-center justify-between py-2">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-lg bg-blue-100 text-blue-600 flex items-center justify-center">
                    <Zap size={18} />
                  </div>
                  <div>
                    <p className="text-sm font-bold text-slate-900">Energy Sensor</p>
                    <p className="text-xs text-slate-500 font-medium">Current power draw</p>
                  </div>
                </div>
                <span className="text-sm font-bold font-mono text-blue-700">
                  {((room.currentPower || 0) / 1000).toFixed(2)} kW
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Right Column: Devices */}
        <div className="space-y-4">
          <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-2xs">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-bold text-slate-900">Device Controls</h3>
              <span className="text-xs px-2.5 py-1 rounded-md font-bold bg-blue-100 text-blue-800">
                Automated Control
              </span>
            </div>

            <div className="space-y-3">
              {room.devices?.map((device: Device) => {
                const Icon = deviceIcons[device.type] || Zap;
                const color = deviceColors[device.type] || 'text-slate-500';
                return (
                  <div key={device.id} className={`flex items-center justify-between p-4 rounded-xl border transition-all ${
                    device.status
                      ? 'bg-slate-50 border-slate-300 shadow-2xs'
                      : 'bg-white border-slate-200'
                  }`}>
                    <div className="flex items-center gap-3">
                      <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                        device.status ? 'bg-amber-100 text-amber-600' : 'bg-slate-100 text-slate-400'
                      }`}>
                        <Icon size={20} className={device.status ? color : 'text-slate-400'} />
                      </div>
                      <div>
                        <p className="text-sm font-bold text-slate-900 capitalize">{device.type}</p>
                        <p className="text-xs text-slate-500 font-medium">{device.power_rating}W rated power</p>
                      </div>
                    </div>

                    <div className="flex items-center gap-3">
                      <span className={`text-xs font-extrabold ${device.status ? 'text-emerald-700' : 'text-slate-400'}`}>
                        {device.status ? 'ON' : 'OFF'}
                      </span>
                      <button
                        onClick={() => handleDeviceToggle(device)}
                        disabled={loading === `device-${device.id}`}
                        className={`relative w-12 h-6 rounded-full transition-all duration-300 ${
                          device.status ? 'bg-emerald-600' : 'bg-slate-300'
                        }`}
                      >
                        <span className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow-sm transition-transform duration-300 ${
                          device.status ? 'translate-x-6' : 'translate-x-0'
                        }`} />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Power Summary */}
            <div className="mt-5 pt-4 border-t border-slate-100">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-slate-600">Current Power Draw</span>
                <span className="text-lg font-bold text-slate-900 font-mono">
                  {((room.currentPower || 0) / 1000).toFixed(2)} kW
                </span>
              </div>
              <div className="w-full bg-slate-100 rounded-full h-2.5 mt-2">
                <div
                  className="h-2.5 rounded-full bg-gradient-to-r from-blue-600 to-indigo-600 transition-all duration-500"
                  style={{ width: `${Math.min(100, ((room.currentPower || 0) / 1175) * 100)}%` }}
                />
              </div>
              <p className="text-[10px] text-slate-400 font-medium mt-1 text-right">Max Rating: 1.175 kW</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
