import { useAppStore } from '../store/appStore';
import { Users, Thermometer, Sun, Zap } from 'lucide-react';

export default function Sensors() {
  const { rooms } = useAppStore();

  const sensorTypes = [
    { key: 'occupancy', label: 'Occupancy Sensors', icon: Users, unit: '', color: 'emerald',
      getValue: (r: any) => r.occupancy ? 'Detected' : 'Not Detected',
      getRawValue: (r: any) => r.occupancy },
    { key: 'temperature', label: 'Temperature Sensors', icon: Thermometer, unit: '°C', color: 'orange',
      getValue: (r: any) => `${r.temperature}°C`,
      getRawValue: (r: any) => r.temperature },
    { key: 'light', label: 'Light Sensors', icon: Sun, unit: '%', color: 'amber',
      getValue: (r: any) => `${r.light_level}%`,
      getRawValue: (r: any) => r.light_level },
    { key: 'energy', label: 'Energy Sensors', icon: Zap, unit: 'kW', color: 'blue',
      getValue: (r: any) => `${((r.currentPower || 0) / 1000).toFixed(2)} kW`,
      getRawValue: (r: any) => (r.currentPower || 0) / 1000 },
  ];

  const colorClasses: Record<string, { bg: string; text: string; border: string }> = {
    emerald: { bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-200' },
    orange: { bg: 'bg-orange-50', text: 'text-orange-700', border: 'border-orange-200' },
    amber: { bg: 'bg-amber-50', text: 'text-amber-700', border: 'border-amber-200' },
    blue: { bg: 'bg-blue-50', text: 'text-blue-700', border: 'border-blue-200' },
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Virtual Sensor Telemetry</h1>
        <p className="text-slate-500 text-sm mt-0.5">Real-time status for 80 virtual IoT sensors across 20 monitored rooms</p>
      </div>

      {/* Sensor Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {sensorTypes.map(sensor => {
          const colors = colorClasses[sensor.color];
          const values = rooms.map(r => sensor.getRawValue(r));
          const numericValues = values.filter(v => typeof v === 'number') as number[];
          const avg = numericValues.length > 0 ? numericValues.reduce((a, b) => a + b, 0) / numericValues.length : 0;
          const activeCount = sensor.key === 'occupancy' ? rooms.filter(r => r.occupancy).length : numericValues.length;

          return (
            <div key={sensor.key} className={`${colors.bg} ${colors.border} border rounded-xl p-5 shadow-2xs`}>
              <div className="flex items-center gap-3 mb-3">
                <div className={`w-10 h-10 rounded-lg ${colors.bg} border ${colors.border} flex items-center justify-center`}>
                  <sensor.icon size={20} className={colors.text} />
                </div>
                <div>
                  <p className="text-sm font-bold text-slate-900">{sensor.label}</p>
                  <p className="text-xs font-medium text-slate-500">{rooms.length} sensors active</p>
                </div>
              </div>
              {sensor.key === 'occupancy' ? (
                <p className={`text-2xl font-extrabold ${colors.text}`}>{activeCount} / {rooms.length}</p>
              ) : (
                <p className={`text-2xl font-extrabold ${colors.text}`}>{avg.toFixed(1)}{sensor.unit}</p>
              )}
              <p className="text-xs text-slate-500 mt-1 font-medium">
                {sensor.key === 'occupancy' ? 'Rooms currently occupied' : 'Facility-wide average'}
              </p>
            </div>
          );
        })}
      </div>

      {/* Detailed Sensor Readings per Sensor Type */}
      {sensorTypes.map(sensor => {
        const colors = colorClasses[sensor.color];
        return (
          <div key={sensor.key} className="bg-white rounded-xl border border-slate-200 p-5 shadow-2xs">
            <div className="flex items-center gap-2 mb-4">
              <sensor.icon size={18} className={colors.text} />
              <h3 className="text-sm font-bold text-slate-900">{sensor.label} — Live Readings</h3>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-5 gap-3">
              {rooms.map(room => (
                <div key={room.id} className={`p-3 rounded-lg border ${colors.border} ${colors.bg}`}>
                  <p className="text-xs font-bold text-slate-800 mb-1">{room.name}</p>
                  <p className={`text-sm font-extrabold ${colors.text}`}>{sensor.getValue(room)}</p>
                </div>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}
