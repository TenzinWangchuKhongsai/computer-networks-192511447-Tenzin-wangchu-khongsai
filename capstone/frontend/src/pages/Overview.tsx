import { useState } from 'react';
import { useAppStore } from '../store/appStore';
import { useNavigate } from 'react-router-dom';
import { setBulkOccupancy } from '../services/api';
import { DoorOpen, Power, Zap, TrendingDown, Thermometer, Sun, Users, UserMinus, Camera, Lightbulb, ShieldCheck, Cpu } from 'lucide-react';
import { ROOM_TYPE_LABELS, ROOM_TYPE_COLORS } from '../types';
import type { RoomType } from '../types';
import BulkDeviceModal from '../components/BulkDeviceModal';

export default function Overview() {
  const { rooms, energy, events, occupancySource, setOccupancySource, cameraState, cameraSettings } = useAppStore();
  const navigate = useNavigate();
  const [loadingAction, setLoadingAction] = useState<string | null>(null);
  const [isBulkDeviceModalOpen, setIsBulkDeviceModalOpen] = useState(false);

  const activeRooms = rooms.filter(r => r.occupancy).length;
  const totalDevicesOn = rooms.reduce((sum, r) => sum + (r.devices?.filter(d => d.status).length || 0), 0);
  const totalPower = energy?.currentPowerKW ?? 0;
  const savings = energy?.savingsPercent ?? 0;

  const recentEvents = events.slice(0, 8);

  const handleBulkOccupancy = async (occupied: boolean) => {
    setLoadingAction(occupied ? 'occupy-all' : 'vacate-all');
    try {
      await setBulkOccupancy(occupied, undefined, true);
    } catch (err) {
      console.error('Failed bulk occupancy:', err);
    }
    setLoadingAction(null);
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Facility Overview</h1>
          <p className="text-slate-500 text-sm mt-0.5">Real-time intelligent monitoring and automated building controls</p>
        </div>

        {/* Global Quick Actions */}
        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={() => handleBulkOccupancy(true)}
            disabled={loadingAction === 'occupy-all'}
            className="flex items-center gap-1.5 px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-semibold shadow-xs transition-all disabled:opacity-50"
          >
            <Users size={14} />
            {loadingAction === 'occupy-all' ? 'Processing...' : 'Enter All Rooms'}
          </button>
          <button
            onClick={() => handleBulkOccupancy(false)}
            disabled={loadingAction === 'vacate-all'}
            className="flex items-center gap-1.5 px-3.5 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-lg text-xs font-semibold shadow-xs transition-all disabled:opacity-50"
          >
            <UserMinus size={14} />
            {loadingAction === 'vacate-all' ? 'Processing...' : 'Leave All Rooms'}
          </button>
          <button
            onClick={() => setIsBulkDeviceModalOpen(true)}
            className="flex items-center gap-1.5 px-3.5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-semibold shadow-xs transition-all"
          >
            <Zap size={14} />
            Configure Devices (Bulk)
          </button>
        </div>
      </div>

      {/* Live Camera & Occupancy Source Control Banner */}
      <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white p-5 rounded-2xl border border-slate-800 shadow-md flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3.5">
          <div className="w-11 h-11 rounded-xl bg-blue-600/30 border border-blue-400/40 text-blue-400 flex items-center justify-center flex-shrink-0">
            <Camera size={22} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-blue-400 uppercase tracking-wider">OCCUPANCY INPUT SOURCE</span>
              <span className={`px-2 py-0.5 rounded text-[10px] font-extrabold uppercase font-mono ${
                occupancySource === 'camera' ? 'bg-emerald-500 text-white' : 'bg-indigo-500 text-white'
              }`}>
                {occupancySource === 'camera' ? '● LIVE CAMERA ACTIVE' : '● SIMULATION ACTIVE'}
              </span>
            </div>
            <p className="text-sm font-semibold text-slate-200 mt-0.5">
              {occupancySource === 'camera'
                ? `Laptop Webcam Occupancy Control (${cameraState.peopleCount} ${cameraState.peopleCount === 1 ? 'Person' : 'People'} Detected &bull; Light ${cameraState.lightStatus ? 'ON' : 'OFF'})`
                : 'Virtual Sensor Simulation Engine Driving Building Automation'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setOccupancySource('simulation')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
              occupancySource === 'simulation' ? 'bg-white text-slate-900' : 'bg-slate-800 text-slate-300 hover:text-white'
            }`}
          >
            <Cpu size={14} />
            Simulation
          </button>
          <button
            onClick={() => setOccupancySource('camera')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
              occupancySource === 'camera' ? 'bg-emerald-500 text-white' : 'bg-slate-800 text-slate-300 hover:text-white'
            }`}
          >
            <Camera size={14} />
            Live Camera
          </button>
          <button
            onClick={() => navigate('/camera')}
            className="px-3.5 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-xs font-bold shadow-sm transition-all ml-1"
          >
            Open Camera Tab &rarr;
          </button>
        </div>
      </div>

      {/* Metric Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard
          icon={DoorOpen}
          label="Active Rooms"
          value={`${activeRooms} / ${rooms.length}`}
          subtitle={`${rooms.length - activeRooms} empty`}
          color="cyan"
        />
        <MetricCard
          icon={Power}
          label="Devices ON"
          value={String(totalDevicesOn)}
          subtitle={`of ${rooms.length * 3} total`}
          color="emerald"
        />
        <MetricCard
          icon={Zap}
          label="Power Draw"
          value={`${totalPower} kW`}
          subtitle="Simulated consumption"
          color="amber"
        />
        <MetricCard
          icon={TrendingDown}
          label="Energy Saved"
          value={`${savings}%`}
          subtitle="vs. baseline usage"
          color="indigo"
        />
      </div>

      {/* Floor Plan + Recent Events */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Room Grid (Floor Plan) */}
        <div className="lg:col-span-2 bg-white rounded-xl border border-slate-200 p-5 shadow-2xs">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-bold text-slate-900">Office Floor Plan Overview</h3>
            <span className="text-xs font-semibold text-slate-500 bg-slate-100 px-2.5 py-1 rounded-md border border-slate-200">
              Floors 1 & 2
            </span>
          </div>

          {/* Floor 1 */}
          <div className="mb-5">
            <p className="text-xs font-bold text-slate-500 mb-2.5 uppercase tracking-wider">Floor 1</p>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-2.5">
              {rooms.filter(r => r.floor === 1).map(room => (
                <RoomTile key={room.id} room={room} onClick={() => navigate(`/rooms/${room.id}`)} />
              ))}
            </div>
          </div>

          {/* Floor 2 */}
          <div>
            <p className="text-xs font-bold text-slate-500 mb-2.5 uppercase tracking-wider">Floor 2</p>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-2.5">
              {rooms.filter(r => r.floor === 2).map(room => (
                <RoomTile key={room.id} room={room} onClick={() => navigate(`/rooms/${room.id}`)} />
              ))}
            </div>
          </div>
        </div>

        {/* Recent Events */}
        <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-2xs">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-bold text-slate-900">Live Activity Stream</h3>
            <button onClick={() => navigate('/events')} className="text-xs font-semibold text-blue-600 hover:text-blue-700">
              View All →
            </button>
          </div>
          <div className="space-y-2.5 max-h-[420px] overflow-y-auto scrollbar-thin pr-1">
            {recentEvents.length === 0 ? (
              <p className="text-slate-400 text-xs text-center py-10">No activity logged. Start the simulation to stream events.</p>
            ) : (
              recentEvents.map((event, i) => (
                <div key={event.id || i} className="flex gap-3 py-2 border-b border-slate-100 last:border-0">
                  <div className={`w-2 h-2 rounded-full mt-1.5 flex-shrink-0 ${
                    event.type === 'automation' ? 'bg-blue-600' :
                    event.type === 'occupancy' ? 'bg-emerald-500' :
                    event.type === 'device' ? 'bg-amber-500' :
                    'bg-slate-400'
                  }`} />
                  <div className="min-w-0">
                    <p className="text-xs font-medium text-slate-800 leading-relaxed truncate">{event.message}</p>
                    <p className="text-[10px] text-slate-400 font-mono mt-0.5">
                      {event.timestamp ? new Date(event.timestamp).toLocaleTimeString() : ''}
                    </p>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Real-World IoT Hardware Metrics Bar */}
      <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-2xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-3 pb-3 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-blue-600"></span>
            <h3 className="text-sm font-bold text-slate-900">Physical IoT Hardware Telemetry</h3>
            <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-blue-50 text-blue-700 border border-blue-200">
              REAL DEVICE LAYER
            </span>
          </div>
          <button
            onClick={() => navigate('/real-devices')}
            className="text-xs font-bold text-blue-600 hover:text-blue-700"
          >
            Manage Real Devices →
          </button>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
          <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-200">
            <span className="text-slate-500 font-medium block">Real Devices</span>
            <span className="text-lg font-bold text-slate-900">{useAppStore.getState().realDevices.length}</span>
            <span className="text-[10px] text-slate-400 block">Wi-Fi & Bluetooth</span>
          </div>

          <div className="p-2.5 rounded-lg bg-emerald-50 border border-emerald-200">
            <span className="text-emerald-800 font-bold block">Real Devices ON</span>
            <span className="text-lg font-bold text-emerald-700">
              {useAppStore.getState().realDevices.filter(d => d.state === 'ON').length}
            </span>
            <span className="text-[10px] text-emerald-700 block">Energized actuators</span>
          </div>

          <div className="p-2.5 rounded-lg bg-amber-50 border border-amber-200">
            <span className="text-amber-800 font-bold block">Real Power</span>
            <span className="text-lg font-bold text-amber-800 font-mono">
              {useAppStore.getState().realDevices
                .filter(d => d.state === 'ON')
                .reduce((s, d) => s + (d.rated_power_watts || 0), 0)} W
            </span>
            <span className="text-[10px] text-amber-700 block">Rated wattage sum</span>
          </div>

          <div className="p-2.5 rounded-lg bg-purple-50 border border-purple-200">
            <span className="text-purple-800 font-bold block">Estimated Energy</span>
            <span className="text-lg font-bold text-purple-800 font-mono">
              {(useAppStore.getState().realDevices.reduce((s, d) => {
                const secs = d.total_runtime_seconds || 0;
                return s + ((d.rated_power_watts * secs) / (3600 * 1000));
              }, 0)).toFixed(4)} kWh
            </span>
            <span className="text-[10px] text-purple-700 block">Runtime × Rated W</span>
          </div>
        </div>
      </div>

      {/* Room Status Table (Phase 15: ROOM | OCCUPANCY | CAMERA | DEVICES | CONNECTION | AUTOMATION | ENERGY) */}
      <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-2xs">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-sm font-bold text-slate-900">Live Dashboard & Room Telemetry</h3>
            <p className="text-xs text-slate-500">Live matrix with cameras, real devices, and automation states</p>
          </div>
          <span className="text-xs font-semibold text-slate-500">
            {rooms.length} Rooms Monitored
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-xs font-semibold text-slate-500 uppercase tracking-wider border-b border-slate-200 bg-slate-50/50">
                <th className="text-left py-2.5 px-3">Room</th>
                <th className="text-center py-2.5 px-3">Occupancy</th>
                <th className="text-center py-2.5 px-3">Camera / Vision</th>
                <th className="text-center py-2.5 px-3">Devices (Virtual + Real)</th>
                <th className="text-center py-2.5 px-3">Connection</th>
                <th className="text-center py-2.5 px-3">Automation</th>
                <th className="text-center py-2.5 px-3">Power / Energy</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {rooms.map(room => {
                const roomRealDevs = useAppStore.getState().realDevices.filter(d => d.room_id === room.id);
                const roomCctv = useAppStore.getState().cctvSources.find(c => c.room_id === room.id);
                const isSelectedInCamera = cameraState.selectedRoomId === room.id;
                const activeVirtual = room.devices?.filter(d => d.status).length || 0;
                const activeReal = roomRealDevs.filter(d => d.state === 'ON').length;
                const realPowerWatts = roomRealDevs.filter(d => d.state === 'ON').reduce((s, d) => s + d.rated_power_watts, 0);

                return (
                  <tr
                    key={room.id}
                    className="hover:bg-slate-50 cursor-pointer transition-colors"
                    onClick={() => navigate(`/rooms/${room.id}`)}
                  >
                    <td className="py-2.5 px-3 font-bold text-slate-900">
                      <div>{room.name}</div>
                      <div className="text-[10px] text-slate-400 font-normal">Floor {room.floor}</div>
                    </td>

                    <td className="py-2.5 px-3 text-center">
                      <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold ${
                        room.occupancy ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-500'
                      }`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${room.occupancy ? 'bg-emerald-600' : 'bg-slate-400'}`} />
                        {room.occupancy ? 'OCCUPIED' : 'VACANT'}
                      </span>
                    </td>

                    <td className="py-2.5 px-3 text-center text-xs">
                      {roomCctv ? (
                        <span className="font-semibold text-indigo-700">{roomCctv.name} (CCTV)</span>
                      ) : isSelectedInCamera ? (
                        <span className="font-semibold text-emerald-700">Laptop Webcam</span>
                      ) : (
                        <span className="text-slate-400">Simulation Sensor</span>
                      )}
                    </td>

                    <td className="py-2.5 px-3 text-center text-xs font-medium">
                      <span className="text-slate-800 font-bold">{activeVirtual} ON (Virt)</span>
                      {roomRealDevs.length > 0 && (
                        <span className="block text-[11px] text-blue-700 font-semibold">{activeReal} of {roomRealDevs.length} ON (Real)</span>
                      )}
                    </td>

                    <td className="py-2.5 px-3 text-center text-xs">
                      {roomRealDevs.length > 0 ? (
                        <span className="inline-block px-2 py-0.5 rounded bg-blue-50 text-blue-700 font-bold text-[10px]">
                          {roomRealDevs[0].connection_type === 'wifi' ? 'Wi-Fi' : 'Bluetooth'}
                        </span>
                      ) : (
                        <span className="text-slate-400 text-[11px]">Virtual Bus</span>
                      )}
                    </td>

                    <td className="py-2.5 px-3 text-center">
                      <span className={`px-2 py-0.5 rounded text-xs font-bold ${
                        room.mode === 'auto' ? 'bg-blue-100 text-blue-800' : 'bg-amber-100 text-amber-800'
                      }`}>
                        {room.mode.toUpperCase()}
                      </span>
                    </td>

                    <td className="py-2.5 px-3 text-center font-mono font-semibold text-slate-800 text-xs">
                      <div>{((room.currentPower || 0) / 1000).toFixed(2)} kW (Sim)</div>
                      {realPowerWatts > 0 && (
                        <div className="text-[10px] text-amber-700 font-bold">+{realPowerWatts} W (Real)</div>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
      
      <BulkDeviceModal 
        isOpen={isBulkDeviceModalOpen}
        onClose={() => setIsBulkDeviceModalOpen(false)}
        initialRoomIds="all"
      />
    </div>
  );
}

function MetricCard({ icon: Icon, label, value, subtitle, color }: {
  icon: any; label: string; value: string; subtitle: string; color: 'cyan' | 'emerald' | 'amber' | 'indigo';
}) {
  const colorMap = {
    cyan: 'bg-cyan-50/70 border-cyan-200/80 text-cyan-700',
    emerald: 'bg-emerald-50/70 border-emerald-200/80 text-emerald-700',
    amber: 'bg-amber-50/70 border-amber-200/80 text-amber-700',
    indigo: 'bg-indigo-50/70 border-indigo-200/80 text-indigo-700',
  };
  const iconColorMap = {
    cyan: 'bg-cyan-600 text-white',
    emerald: 'bg-emerald-600 text-white',
    amber: 'bg-amber-600 text-white',
    indigo: 'bg-indigo-600 text-white',
  };

  return (
    <div className={`border rounded-xl p-5 shadow-2xs transition-all hover:shadow-xs ${colorMap[color]}`}>
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs font-bold uppercase tracking-wider opacity-80">{label}</p>
          <p className="text-2xl font-extrabold text-slate-900 mt-1">{value}</p>
          <p className="text-xs font-medium text-slate-500 mt-1">{subtitle}</p>
        </div>
        <div className={`w-10 h-10 rounded-lg flex items-center justify-center shadow-xs ${iconColorMap[color]}`}>
          <Icon size={20} />
        </div>
      </div>
    </div>
  );
}

function RoomTile({ room, onClick }: { room: any; onClick: () => void }) {
  const typeColor = ROOM_TYPE_COLORS[room.type as RoomType] || '#2563eb';
  const devicesOn = room.devices?.filter((d: any) => d.status).length || 0;

  return (
    <button
      onClick={onClick}
      className={`relative p-3 rounded-lg border text-left transition-all duration-200 hover:shadow-sm ${
        room.occupancy
          ? 'bg-emerald-50/60 border-emerald-300 hover:border-emerald-400'
          : 'bg-white border-slate-200 hover:border-slate-300'
      }`}
    >
      <div className={`absolute top-2 right-2 w-2 h-2 rounded-full ${
        room.occupancy ? 'bg-emerald-600 animate-pulse' : 'bg-slate-300'
      }`} />

      <p className="text-xs font-bold text-slate-900">{room.name}</p>
      <p className="text-[10px] font-semibold mt-0.5" style={{ color: typeColor }}>
        {ROOM_TYPE_LABELS[room.type as RoomType] || room.type}
      </p>

      <div className="flex items-center gap-2 mt-2 text-[10px] text-slate-600 font-medium">
        <span className="flex items-center gap-0.5"><Thermometer size={10} className="text-orange-500" />{room.temperature}°</span>
        <span className="flex items-center gap-0.5"><Sun size={10} className="text-amber-500" />{room.light_level}%</span>
      </div>

      {devicesOn > 0 && (
        <div className="flex items-center gap-1 mt-1">
          <Power size={9} className="text-amber-600" />
          <span className="text-[10px] font-bold text-amber-700">{devicesOn} ON</span>
        </div>
      )}
    </button>
  );
}
