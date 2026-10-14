import { useAppStore } from '../store/appStore';
import {
  startSimulation, pauseSimulation, resetSimulation, stepSimulation,
  setSimulationSpeed, setAutoSimulation
} from '../services/api';
import { Play, Pause, RotateCcw, SkipForward, Gauge, Shuffle, Activity } from 'lucide-react';
import { useState } from 'react';

export default function SimulationControl() {
  const { simulation, setSimulation } = useAppStore();
  const [loading, setLoading] = useState<string | null>(null);

  const handleAction = async (action: string, fn: () => Promise<any>) => {
    setLoading(action);
    try {
      const status = await fn();
      setSimulation(status);
    } catch (err) {
      console.error(`Simulation ${action} failed:`, err);
    }
    setLoading(null);
  };

  const speeds = [0.5, 1, 2, 5, 10];

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Simulation Control Center</h1>
        <p className="text-slate-500 text-sm mt-0.5">Manage execution parameters, tick rate, step testing, and auto-simulation</p>
      </div>

      {/* Status Card */}
      <div className={`rounded-xl border p-6 transition-all shadow-2xs ${
        simulation.status === 'running'
          ? 'bg-emerald-50/80 border-emerald-200'
          : 'bg-white border-slate-200'
      }`}>
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3.5">
            <div className={`w-12 h-12 rounded-xl flex items-center justify-center shadow-xs ${
              simulation.status === 'running' ? 'bg-emerald-600 text-white' : 'bg-slate-100 text-slate-500 border border-slate-200'
            }`}>
              <Activity size={24} />
            </div>
            <div>
              <h3 className="text-lg font-bold text-slate-900">Simulation Engine State</h3>
              <div className="flex items-center gap-2 mt-0.5">
                <span className={`w-2.5 h-2.5 rounded-full ${
                  simulation.status === 'running' ? 'bg-emerald-600 animate-pulse' : 'bg-slate-400'
                }`} />
                <span className={`text-sm font-bold ${
                  simulation.status === 'running' ? 'text-emerald-800' : 'text-slate-500'
                }`}>
                  {simulation.status === 'running' ? 'RUNNING (LIVE)' : 'PAUSED'}
                </span>
              </div>
            </div>
          </div>
          <div className="text-right">
            <p className="text-xs font-semibold text-slate-500">Total Simulation Ticks</p>
            <p className="text-xl font-mono font-extrabold text-slate-900">{simulation.tickCount}</p>
          </div>
        </div>

        {/* Control Buttons */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <button
            onClick={() => handleAction('start', startSimulation)}
            disabled={simulation.status === 'running' || loading === 'start'}
            className="flex items-center justify-center gap-2 px-4 py-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold text-sm transition-all shadow-2xs disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <Play size={16} />
            Start
          </button>
          <button
            onClick={() => handleAction('pause', pauseSimulation)}
            disabled={simulation.status === 'paused' || loading === 'pause'}
            className="flex items-center justify-center gap-2 px-4 py-3 bg-amber-500 hover:bg-amber-600 text-white rounded-xl font-bold text-sm transition-all shadow-2xs disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <Pause size={16} />
            Pause
          </button>
          <button
            onClick={() => handleAction('step', stepSimulation)}
            disabled={simulation.status === 'running' || loading === 'step'}
            className="flex items-center justify-center gap-2 px-4 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold text-sm transition-all shadow-2xs disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <SkipForward size={16} />
            Step
          </button>
          <button
            onClick={() => handleAction('reset', resetSimulation)}
            disabled={loading === 'reset'}
            className="flex items-center justify-center gap-2 px-4 py-3 bg-rose-600 hover:bg-rose-700 text-white rounded-xl font-bold text-sm transition-all shadow-2xs disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <RotateCcw size={16} />
            Reset State
          </button>
        </div>
      </div>

      {/* Speed Control */}
      <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-2xs">
        <div className="flex items-center gap-2 mb-4">
          <Gauge size={18} className="text-slate-600" />
          <h3 className="text-sm font-bold text-slate-900">Simulation Speed Multiplier</h3>
          <span className="ml-auto text-sm font-mono font-bold text-blue-600">{simulation.speed}×</span>
        </div>
        <div className="flex gap-2">
          {speeds.map(speed => (
            <button
              key={speed}
              onClick={() => handleAction('speed', () => setSimulationSpeed(speed))}
              className={`flex-1 py-2.5 rounded-lg text-sm font-bold transition-all border ${
                simulation.speed === speed
                  ? 'bg-blue-600 text-white border-blue-600 shadow-xs'
                  : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
              }`}
            >
              {speed}×
            </button>
          ))}
        </div>
      </div>

      {/* Auto Simulation */}
      <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-2xs">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3.5">
            <div className={`w-10 h-10 rounded-lg flex items-center justify-center border shadow-xs ${
              simulation.autoSimulation ? 'bg-blue-600 text-white border-blue-600' : 'bg-slate-100 text-slate-500 border-slate-200'
            }`}>
              <Shuffle size={20} />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900">Auto-Simulation Dynamic Mode</h3>
              <p className="text-xs text-slate-500 font-medium">Automatically simulate room occupancy entries, temperature drift, and light shifts</p>
            </div>
          </div>
          <button
            onClick={() => handleAction('auto', () => setAutoSimulation(!simulation.autoSimulation))}
            className={`relative w-14 h-7 rounded-full transition-all duration-300 ${
              simulation.autoSimulation ? 'bg-blue-600' : 'bg-slate-300'
            }`}
          >
            <span className={`absolute top-0.5 left-0.5 w-6 h-6 rounded-full bg-white shadow-xs transition-transform duration-300 ${
              simulation.autoSimulation ? 'translate-x-7' : 'translate-x-0'
            }`} />
          </button>
        </div>
      </div>
    </div>
  );
}
