import { useAppStore } from '../store/appStore';
import { toggleDevice } from '../services/api';
import { Lightbulb, Fan, Snowflake, Zap } from 'lucide-react';
import type { Device } from '../types';

export default function Devices() {
  const { rooms } = useAppStore();

  const allDevices: (Device & { roomName: string; roomMode: string })[] = rooms.flatMap(room =>
    (room.devices || []).map(d => ({ ...d, roomName: room.name, roomMode: room.mode }))
  );

  const activeCount = allDevices.filter(d => d.status).length;
  const totalPower = allDevices.filter(d => d.status).reduce((sum, d) => sum + d.power_rating, 0);

  const deviceGroups: Record<string, typeof allDevices> = {
    light: allDevices.filter(d => d.type === 'light'),
    fan: allDevices.filter(d => d.type === 'fan'),
    cooling: allDevices.filter(d => d.type === 'cooling'),
  };

  const deviceMeta: Record<string, { icon: any; color: string; label: string }> = {
    light: { icon: Lightbulb, color: 'text-amber-500', label: 'Lighting Systems (100W)' },
    fan: { icon: Fan, color: 'text-cyan-600', label: 'Ventilation Fans (75W)' },
    cooling: { icon: Snowflake, color: 'text-blue-600', label: 'Cooling / HVAC Units (1000W)' },
  };

  const handleToggle = async (deviceId: number) => {
    try {
      await toggleDevice(deviceId);
    } catch (err) {
      console.error('Failed to toggle device:', err);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Virtual Device Inventory</h1>
        <p className="text-slate-500 text-sm mt-0.5">Control and monitor all 60 virtual actuators and equipment</p>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="px-4 py-3 bg-white rounded-xl border border-slate-200 shadow-2xs">
          <p className="text-xs font-medium text-slate-500">Total Virtual Devices</p>
          <p className="text-2xl font-extrabold text-slate-900 mt-0.5">{allDevices.length}</p>
        </div>
        <div className="px-4 py-3 bg-emerald-50/70 rounded-xl border border-emerald-200 shadow-2xs">
          <p className="text-xs font-bold text-emerald-800">Active Devices (ON)</p>
          <p className="text-2xl font-extrabold text-emerald-700 mt-0.5">{activeCount}</p>
        </div>
        <div className="px-4 py-3 bg-blue-50/70 rounded-xl border border-blue-200 shadow-2xs">
          <p className="text-xs font-bold text-blue-800">Active Power Consumption</p>
          <p className="text-2xl font-extrabold text-blue-700 font-mono mt-0.5">{(totalPower / 1000).toFixed(2)} kW</p>
        </div>
      </div>

      {/* Device Groups */}
      {Object.entries(deviceGroups).map(([type, devices]) => {
        const meta = deviceMeta[type];
        const Icon = meta.icon;
        const active = devices.filter(d => d.status).length;

        return (
          <div key={type} className="bg-white rounded-xl border border-slate-200 p-5 shadow-2xs">
            <div className="flex items-center justify-between mb-4 pb-3 border-b border-slate-100">
              <div className="flex items-center gap-3">
                <Icon size={20} className={meta.color} />
                <h3 className="text-sm font-bold text-slate-900">{meta.label}</h3>
                <span className="text-xs font-semibold text-slate-500">({active} of {devices.length} ON)</span>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              {devices.map(device => (
                <div key={device.id} className={`flex items-center justify-between p-3.5 rounded-lg border transition-all ${
                  device.status
                    ? 'bg-slate-50 border-slate-300 shadow-2xs'
                    : 'bg-white border-slate-200'
                }`}>
                  <div>
                    <p className="text-sm font-bold text-slate-900">{device.roomName}</p>
                    <p className="text-xs text-slate-500 font-medium">{device.power_rating}W rated power</p>
                  </div>
                  <button
                    onClick={() => handleToggle(device.id)}
                    className={`relative w-11 h-6 rounded-full transition-all duration-300 ${
                      device.status ? 'bg-emerald-600' : 'bg-slate-300'
                    }`}
                  >
                    <span className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow-xs transition-transform duration-300 ${
                      device.status ? 'translate-x-5' : 'translate-x-0'
                    }`} />
                  </button>
                </div>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}
