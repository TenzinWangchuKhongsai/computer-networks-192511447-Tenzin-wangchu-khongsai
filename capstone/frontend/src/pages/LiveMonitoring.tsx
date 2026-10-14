import { useAppStore } from '../store/appStore';
import { ROOM_TYPE_LABELS } from '../types';
import type { RoomType } from '../types';
import { Users, Thermometer, Sun, Zap, Activity } from 'lucide-react';

export default function LiveMonitoring() {
  const { rooms, energy, simulation, events } = useAppStore();
  const recentEvents = events.slice(0, 20);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Live Monitoring</h1>
          <p className="text-slate-500 text-sm mt-0.5">Real-time room status, sensor telemetries, and live event stream</p>
        </div>
        <div className={`flex items-center gap-2 px-3.5 py-1.5 rounded-full text-xs font-bold ${
          simulation.status === 'running'
            ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
            : 'bg-slate-100 text-slate-600 border border-slate-200'
        }`}>
          <span className={`w-2 h-2 rounded-full ${simulation.status === 'running' ? 'bg-emerald-600 animate-pulse' : 'bg-slate-400'}`} />
          {simulation.status === 'running' ? 'LIVE STREAMING' : 'PAUSED'}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: Room Status Grid */}
        <div className="lg:col-span-2 space-y-4">
          <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider">Live Sensor Array (20 Rooms)</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {rooms.map(room => (
              <div
                key={room.id}
                className={`p-4 rounded-xl border transition-all shadow-2xs ${
                  room.occupancy
                    ? 'bg-white border-emerald-300 ring-1 ring-emerald-200/50'
                    : 'bg-white border-slate-200'
                }`}
              >
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <span className="text-sm font-bold text-slate-900">{room.name}</span>
                    <span className="text-xs text-slate-500 font-medium ml-2">{ROOM_TYPE_LABELS[room.type as RoomType]}</span>
                  </div>
                  <span className={`w-2.5 h-2.5 rounded-full ${room.occupancy ? 'bg-emerald-500 animate-pulse' : 'bg-slate-300'}`} />
                </div>
                <div className="grid grid-cols-4 gap-2 text-center py-2 bg-slate-50 rounded-lg border border-slate-100">
                  <div>
                    <Users size={14} className={`mx-auto mb-1 ${room.occupancy ? 'text-emerald-600' : 'text-slate-400'}`} />
                    <p className="text-[10px] font-bold text-slate-700">{room.occupancy ? 'Yes' : 'No'}</p>
                  </div>
                  <div>
                    <Thermometer size={14} className="mx-auto mb-1 text-orange-500" />
                    <p className="text-[10px] font-bold text-slate-700">{room.temperature}°C</p>
                  </div>
                  <div>
                    <Sun size={14} className="mx-auto mb-1 text-amber-500" />
                    <p className="text-[10px] font-bold text-slate-700">{room.light_level}%</p>
                  </div>
                  <div>
                    <Zap size={14} className="mx-auto mb-1 text-blue-500" />
                    <p className="text-[10px] font-bold text-slate-700 font-mono">{((room.currentPower || 0) / 1000).toFixed(1)}kW</p>
                  </div>
                </div>
                {/* Device indicators */}
                <div className="flex gap-1.5 mt-2.5 pt-2 border-t border-slate-100">
                  {room.devices?.map(d => (
                    <span key={d.id} className={`text-[10px] font-semibold px-2 py-0.5 rounded ${
                      d.status ? 'bg-amber-100 text-amber-800 border border-amber-200' : 'bg-slate-100 text-slate-500'
                    }`}>
                      {d.type}
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Right: Event Stream & Energy */}
        <div className="space-y-4">
          <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider">Live Event Stream</h3>
          <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-2xs max-h-[480px] overflow-y-auto scrollbar-thin">
            {recentEvents.length === 0 ? (
              <p className="text-center text-slate-400 text-xs py-12">No events logged. Start the simulation to stream events.</p>
            ) : (
              <div className="space-y-2">
                {recentEvents.map((event, i) => (
                  <div key={event.id || i} className="flex gap-2.5 py-2 border-b border-slate-100 last:border-0">
                    <Activity size={13} className={`mt-0.5 flex-shrink-0 ${
                      event.type === 'automation' ? 'text-blue-600' :
                      event.type === 'occupancy' ? 'text-emerald-600' :
                      event.type === 'device' ? 'text-amber-600' : 'text-slate-400'
                    }`} />
                    <div>
                      <p className="text-xs font-medium text-slate-800">{event.message}</p>
                      <p className="text-[10px] text-slate-400 font-mono">
                        {event.timestamp ? new Date(event.timestamp).toLocaleTimeString() : ''}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Energy Summary */}
          <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-2xs">
            <h4 className="text-xs font-bold text-slate-500 mb-3 uppercase tracking-wider">Live Energy Telemetry</h4>
            <div className="space-y-2 text-xs">
              <div className="flex justify-between py-1 border-b border-slate-100">
                <span className="text-slate-600">Current Power</span>
                <span className="font-mono font-bold text-slate-900">{energy?.currentPowerKW ?? 0} kW</span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-100">
                <span className="text-slate-600">Total Energy</span>
                <span className="font-mono font-bold text-slate-900">{energy?.totalEnergyKWH?.toFixed(3) ?? 0} kWh</span>
              </div>
              <div className="flex justify-between py-1">
                <span className="text-slate-600">Simulated Energy Saved</span>
                <span className="font-mono font-bold text-emerald-600">{energy?.savingsPercent ?? 0}%</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
