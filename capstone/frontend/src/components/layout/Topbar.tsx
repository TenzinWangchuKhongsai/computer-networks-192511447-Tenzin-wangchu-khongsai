import { useState, useEffect } from 'react';
import { useAppStore } from '../../store/appStore';
import { Wifi, WifiOff, Play, Pause, Gauge, Monitor, Calendar, Clock } from 'lucide-react';

export default function Topbar() {
  const { connected, simulation } = useAppStore();
  const [now, setNow] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => {
      setNow(new Date());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const speedLabels: Record<number, string> = { 0.5: '0.5×', 1: '1×', 2: '2×', 5: '5×', 10: '10×' };

  return (
    <header className="h-16 bg-white/90 backdrop-blur-xl border-b border-slate-200 flex items-center justify-between px-6 sticky top-0 z-30 shadow-xs">
      {/* Left — Title & Real Time Clock */}
      <div className="flex items-center gap-4">
        <h2 className="text-lg font-bold text-slate-900 tracking-tight">
          Smart Office Simulation
        </h2>

        {/* Real System Date & Time Display Badge */}
        <div className="hidden sm:flex items-center gap-2.5 px-3 py-1 bg-slate-100/90 border border-slate-200/80 rounded-lg text-slate-700 font-mono text-xs font-semibold shadow-2xs">
          <div className="flex items-center gap-1.5 text-blue-700">
            <Calendar size={13} className="text-blue-600" />
            <span>{now.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })}</span>
          </div>
          <div className="w-px h-3.5 bg-slate-300" />
          <div className="flex items-center gap-1.5 text-indigo-700">
            <Clock size={13} className="text-indigo-600" />
            <span>{now.toLocaleTimeString()}</span>
          </div>
        </div>
      </div>

      {/* Right — Status indicators */}
      <div className="flex items-center gap-4">
        {/* Connection status */}
        <div className="flex items-center gap-2 text-xs">
          {connected ? (
            <>
              <Wifi size={14} className="text-emerald-600" />
              <span className="text-emerald-700 font-semibold">System Online</span>
            </>
          ) : (
            <>
              <WifiOff size={14} className="text-red-500 animate-pulse" />
              <span className="text-red-600 font-semibold">Disconnected</span>
            </>
          )}
        </div>

        {/* Separator */}
        <div className="w-px h-5 bg-slate-200" />

        {/* Simulation status */}
        <div className="flex items-center gap-2">
          <div className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold ${
            simulation.status === 'running'
              ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
              : 'bg-slate-100 text-slate-600 border border-slate-200'
          }`}>
            {simulation.status === 'running' ? (
              <Play size={11} fill="currentColor" />
            ) : (
              <Pause size={11} />
            )}
            <span>{simulation.status === 'running' ? 'LIVE SIMULATION' : 'PAUSED'}</span>
          </div>
        </div>

        {/* Speed */}
        <div className="flex items-center gap-1.5 text-xs text-slate-500 font-medium">
          <Gauge size={14} className="text-slate-400" />
          <span className="font-mono text-slate-700 font-semibold">{speedLabels[simulation.speed] || `${simulation.speed}×`}</span>
        </div>

        {/* Separator */}
        <div className="w-px h-5 bg-slate-200" />

        {/* Profile */}
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-full bg-slate-100 border border-slate-200 flex items-center justify-center text-slate-600 shadow-xs">
            <Monitor size={15} />
          </div>
        </div>
      </div>
    </header>
  );
}
