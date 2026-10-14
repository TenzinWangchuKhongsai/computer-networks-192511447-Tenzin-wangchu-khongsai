import { useEffect, useState } from 'react';
import { useAppStore } from '../store/appStore';
import { fetchEvents, clearEvents } from '../services/api';
import { Bell, Activity, Zap, Users, Power, Settings, Trash2 } from 'lucide-react';

export default function EventsAlerts() {
  const { events, setEvents } = useAppStore();
  const [filter, setFilter] = useState<string>('all');

  useEffect(() => {
    fetchEvents(200).then(setEvents).catch(console.error);
  }, []);

  const filteredEvents = filter === 'all'
    ? events
    : events.filter(e => e.type === filter);

  const handleClear = async () => {
    try {
      await clearEvents();
      setEvents([]);
    } catch (err) {
      console.error('Failed to clear events:', err);
    }
  };

  const typeIcons: Record<string, { icon: any; color: string }> = {
    automation: { icon: Zap, color: 'text-blue-600' },
    occupancy: { icon: Users, color: 'text-emerald-600' },
    device: { icon: Power, color: 'text-amber-600' },
    system: { icon: Settings, color: 'text-slate-500' },
    mode: { icon: Activity, color: 'text-cyan-600' },
    bulk_action: { icon: Users, color: 'text-indigo-600' },
  };

  const typeFilters = [
    { key: 'all', label: 'All Events' },
    { key: 'automation', label: 'Automation' },
    { key: 'occupancy', label: 'Occupancy' },
    { key: 'device', label: 'Device' },
    { key: 'system', label: 'System' },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Events & Telemetry Log</h1>
          <p className="text-slate-500 text-sm mt-0.5">Historical activity stream of system events, occupancy triggers, and automation decisions</p>
        </div>
        <button
          onClick={handleClear}
          className="flex items-center gap-2 px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs font-bold text-slate-700 hover:bg-slate-50 shadow-2xs transition-colors"
        >
          <Trash2 size={14} className="text-rose-600" />
          Clear Log
        </button>
      </div>

      {/* Filters */}
      <div className="flex gap-2 flex-wrap items-center">
        {typeFilters.map(f => (
          <button
            key={f.key}
            onClick={() => setFilter(f.key)}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all border ${
              filter === f.key
                ? 'bg-blue-50 text-blue-700 border-blue-300 shadow-2xs'
                : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
            }`}
          >
            {f.label}
          </button>
        ))}
        <span className="text-xs font-semibold text-slate-500 ml-2">
          ({filteredEvents.length} events listed)
        </span>
      </div>

      {/* Event Timeline */}
      <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-2xs">
        {filteredEvents.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-slate-400">
            <Bell size={36} className="mb-3 opacity-30" />
            <p className="text-sm font-semibold">No events recorded</p>
            <p className="text-xs mt-1">Events will appear live as simulation runs and actions occur</p>
          </div>
        ) : (
          <div className="space-y-1 max-h-[600px] overflow-y-auto scrollbar-thin">
            {filteredEvents.map((event, i) => {
              const iconConfig = typeIcons[event.type] || typeIcons.system;
              const Icon = iconConfig.icon;
              return (
                <div key={event.id || i} className="flex items-start gap-3.5 py-3 border-b border-slate-100 last:border-0 hover:bg-slate-50 px-2.5 rounded-lg transition-colors">
                  <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 bg-slate-100 border border-slate-200">
                    <Icon size={14} className={iconConfig.color} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-slate-900 leading-relaxed">{event.message}</p>
                    <div className="flex items-center gap-3 mt-1">
                      <span className="text-[11px] text-slate-400 font-mono">
                        {event.timestamp ? new Date(event.timestamp).toLocaleString() : ''}
                      </span>
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded ${
                        event.type === 'automation' ? 'bg-blue-100 text-blue-800' :
                        event.type === 'occupancy' ? 'bg-emerald-100 text-emerald-800' :
                        event.type === 'device' ? 'bg-amber-100 text-amber-800' :
                        'bg-slate-100 text-slate-600'
                      }`}>
                        {event.type}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
