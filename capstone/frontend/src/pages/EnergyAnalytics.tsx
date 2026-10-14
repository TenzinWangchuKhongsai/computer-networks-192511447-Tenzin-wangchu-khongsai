import { useEffect, useState } from 'react';
import { useAppStore } from '../store/appStore';
import { fetchEnergyByRoom, fetchEnergyByDevice, fetchEnergyRecords } from '../services/api';
import { BarChart, Bar, LineChart, Line, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { Zap, TrendingDown, Battery, BarChart3 } from 'lucide-react';
import type { RoomEnergy, PowerByType, EnergyRecord } from '../types';

const PIE_COLORS = ['#d97706', '#0284c7', '#4f46e5'];

export default function EnergyAnalytics() {
  const { energy } = useAppStore();
  const [byRoom, setByRoom] = useState<RoomEnergy[]>([]);
  const [byDevice, setByDevice] = useState<PowerByType[]>([]);
  const [records, setRecords] = useState<EnergyRecord[]>([]);

  useEffect(() => {
    const loadData = async () => {
      try {
        const [roomData, deviceData, recordData] = await Promise.all([
          fetchEnergyByRoom(),
          fetchEnergyByDevice(),
          fetchEnergyRecords(50),
        ]);
        setByRoom(roomData);
        setByDevice(deviceData);
        setRecords(recordData);
      } catch (err) {
        console.error('Failed to load energy data:', err);
      }
    };
    loadData();
    const interval = setInterval(loadData, 2000);
    return () => clearInterval(interval);
  }, []);

  const roomChartData = byRoom
    .map(r => ({
      name: r.name,
      power: Math.round(r.currentPower),
      energy: Math.round(r.totalEnergy * 1000) / 1000,
    }));

  const devicePieData = byDevice.map(d => ({
    name: d.type.charAt(0).toUpperCase() + d.type.slice(1),
    value: Math.round(d.total_power),
    active: d.active_count,
    total: d.count,
  }));

  const timelineData = records.slice(0, 30).reverse().map((r, i) => {
    const formattedTime = r.timestamp
      ? new Date(r.timestamp.endsWith('Z') ? r.timestamp : r.timestamp + 'Z').toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
      : `T${i}`;
    return {
      time: formattedTime,
      power: Math.round(r.total_power),
      energy: Math.round(r.energy_kwh * 1000) / 1000,
    };
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Energy Optimization Analytics</h1>
        <p className="text-slate-500 text-sm mt-0.5">Real-time telemetry and simulated energy savings analysis</p>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-amber-50/70 border border-amber-200 rounded-xl p-5 shadow-2xs">
          <div className="flex items-center gap-2 mb-2">
            <Zap size={16} className="text-amber-600" />
            <span className="text-xs font-bold text-amber-800 uppercase tracking-wider">Current Power</span>
          </div>
          <p className="text-2xl font-extrabold text-slate-900">{energy?.currentPowerKW ?? 0} kW</p>
        </div>
        <div className="bg-blue-50/70 border border-blue-200 rounded-xl p-5 shadow-2xs">
          <div className="flex items-center gap-2 mb-2">
            <Battery size={16} className="text-blue-600" />
            <span className="text-xs font-bold text-blue-800 uppercase tracking-wider">Total Energy</span>
          </div>
          <p className="text-2xl font-extrabold text-slate-900">{energy?.totalEnergyKWH?.toFixed(3) ?? 0} kWh</p>
        </div>
        <div className="bg-slate-100/80 border border-slate-200 rounded-xl p-5 shadow-2xs">
          <div className="flex items-center gap-2 mb-2">
            <BarChart3 size={16} className="text-slate-600" />
            <span className="text-xs font-bold text-slate-700 uppercase tracking-wider">Baseline Usage</span>
          </div>
          <p className="text-2xl font-extrabold text-slate-900">{energy?.baselineEnergyKWH?.toFixed(3) ?? 0} kWh</p>
        </div>
        <div className="bg-emerald-50/70 border border-emerald-200 rounded-xl p-5 shadow-2xs">
          <div className="flex items-center gap-2 mb-2">
            <TrendingDown size={16} className="text-emerald-600" />
            <span className="text-xs font-bold text-emerald-800 uppercase tracking-wider">Simulated Energy Saved</span>
          </div>
          <p className="text-2xl font-extrabold text-emerald-700">{energy?.savingsPercent ?? 0}%</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Power Over Time */}
        <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-2xs">
          <h3 className="text-sm font-bold text-slate-900 mb-4">Facility Power Consumption Timeline</h3>
          {timelineData.length > 0 ? (
            <ResponsiveContainer width="100%" height={250}>
              <LineChart data={timelineData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="time" stroke="#64748b" tick={{ fontSize: 10 }} />
                <YAxis stroke="#64748b" tick={{ fontSize: 10 }} />
                <Tooltip
                  contentStyle={{ backgroundColor: '#ffffff', border: '1px solid #cbd5e1', borderRadius: '8px', boxShadow: '0 2px 8px rgba(0,0,0,0.08)' }}
                />
                <Line type="monotone" dataKey="power" stroke="#2563eb" strokeWidth={2.5} dot={false} name="Power (W)" />
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex items-center justify-center h-[250px] text-slate-400 text-sm">
              Start simulation to generate real-time energy telemetry data
            </div>
          )}
        </div>

        {/* Device Type Breakdown */}
        <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-2xs">
          <h3 className="text-sm font-bold text-slate-900 mb-4">Power Breakdown by Equipment Category</h3>
          {devicePieData.some(d => d.value > 0) ? (
            <ResponsiveContainer width="100%" height={250}>
              <PieChart>
                <Pie
                  data={devicePieData}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={90}
                  paddingAngle={5}
                  dataKey="value"
                  label={({ name, value }) => `${name}: ${value}W`}
                >
                  {devicePieData.map((_, index) => (
                    <Cell key={`cell-${index}`} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex items-center justify-center h-[250px] text-slate-400 text-sm">
              No active power draw detected across equipment
            </div>
          )}
        </div>

        {/* Room-wise Consumption */}
        <div className="lg:col-span-2 bg-white rounded-xl border border-slate-200 p-5 shadow-2xs">
          <h3 className="text-sm font-bold text-slate-900 mb-4">Active Power Draw Per Room (Watts)</h3>
          {roomChartData.length > 0 ? (
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={roomChartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="name" stroke="#64748b" tick={{ fontSize: 10 }} angle={-45} textAnchor="end" height={60} />
                <YAxis stroke="#64748b" tick={{ fontSize: 10 }} />
                <Tooltip />
                <Legend />
                <Bar dataKey="power" fill="#2563eb" radius={[4, 4, 0, 0]} name="Active Power Draw (W)" />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex items-center justify-center h-[300px] text-slate-400 text-sm">
              No active power consumption. Turn on devices or run simulation.
            </div>
          )}
        </div>

        {/* Real Device Estimated Energy (Phase 14) */}
        <div className="lg:col-span-2 bg-white rounded-xl border border-slate-200 p-5 shadow-2xs space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-slate-100">
            <div>
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-purple-600"></span>
                <h3 className="text-sm font-bold text-slate-900">Physical IoT Hardware Energy Estimation (Phase 14)</h3>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-purple-100 text-purple-800 border border-purple-200">
                  REAL HARDWARE LAYER
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                Strict separation: Simulated Energy is simulated by the digital model; Real Hardware Energy is calculated based on rated wattage × operating time.
              </p>
            </div>
            <span className="text-xs font-mono font-bold text-purple-700 bg-purple-50 px-2.5 py-1 rounded-lg border border-purple-200">
              Total Real: {useAppStore.getState().realDevices.reduce((s, d) => s + ((d.rated_power_watts * (d.total_runtime_seconds || 0)) / (3600 * 1000)), 0).toFixed(4)} kWh
            </span>
          </div>

          {useAppStore.getState().realDevices.length === 0 ? (
            <p className="text-xs text-slate-400 py-4 text-center">
              No physical real devices configured yet. Register real smart switches or relays in the Real Devices section.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left">
                <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-bold">
                  <tr>
                    <th className="py-2.5 px-3">Device Name</th>
                    <th className="py-2.5 px-3">Assigned Room</th>
                    <th className="py-2.5 px-3">Rated Power</th>
                    <th className="py-2.5 px-3">State</th>
                    <th className="py-2.5 px-3">Total Runtime</th>
                    <th className="py-2.5 px-3">Calculation Method</th>
                    <th className="py-2.5 px-3">Estimated Energy</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-mono">
                  {useAppStore.getState().realDevices.map(d => {
                    const room = useAppStore.getState().rooms.find(r => r.id === d.room_id);
                    const secs = d.total_runtime_seconds || 0;
                    const hours = (secs / 3600).toFixed(2);
                    const kwh = ((d.rated_power_watts * secs) / (3600 * 1000)).toFixed(5);

                    return (
                      <tr key={d.id} className="hover:bg-slate-50/50">
                        <td className="py-2 px-3 font-sans font-bold text-slate-900">{d.name}</td>
                        <td className="py-2 px-3 font-sans text-slate-600">{room ? room.name : 'Unassigned'}</td>
                        <td className="py-2 px-3 text-slate-800">{d.rated_power_watts} W</td>
                        <td className="py-2 px-3">
                          <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                            d.state === 'ON' ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-700'
                          }`}>
                            {d.state}
                          </span>
                        </td>
                        <td className="py-2 px-3 text-slate-700">{hours} hrs ({secs}s)</td>
                        <td className="py-2 px-3 font-sans text-slate-500 text-[11px]">
                          {d.rated_power_watts}W × {secs}s / 3.6M
                        </td>
                        <td className="py-2 px-3 font-bold text-purple-700">
                          {kwh} kWh <span className="text-[10px] font-normal text-slate-400 font-sans">(Estimated)</span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          <div className="p-3 rounded-lg bg-slate-50 border border-slate-200 text-[11px] text-slate-600">
            <span className="font-bold text-slate-800">Energy Standard Compliance Note:</span> Real IoT devices without physical current transformer (CT) metering ICs calculate electrical consumption as <code className="font-mono text-purple-700">power (Watts) × operating time (seconds)</code>. It is explicitly labeled <strong className="text-slate-900">“Estimated Energy”</strong> to prevent misrepresenting simulated or uncalibrated power as certified grid measurements.
          </div>
        </div>
      </div>
    </div>
  );
}
