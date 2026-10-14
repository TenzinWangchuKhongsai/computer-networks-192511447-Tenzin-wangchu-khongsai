import { Outlet } from 'react-router-dom';
import Sidebar from './Sidebar';
import Topbar from './Topbar';
import { useAppStore } from '../../store/appStore';
import { useSocket } from '../../hooks/useSocket';
import { useEffect } from 'react';
import {
  fetchRooms, fetchEvents, fetchAutomationRules, fetchSimulationStatus, fetchSettings,
  fetchRealDevices, fetchCctvSources, fetchOccupancyStates, fetchUnifiedEnergy, fetchFailSafeSettings, fetchRecentCommands
} from '../../services/api';

export default function AppShell() {
  const {
    sidebarCollapsed, setRooms, setEvents, setAutomationRules, setSimulation, setSettings, setLoading,
    setRealDevices, setCctvSources, setOccupancyStates, setUnifiedEnergy, setFailsafePolicy, setDeviceCommands
  } = useAppStore();

  // Initialize WebSocket connection
  useSocket();

  // Fetch initial data
  useEffect(() => {
    const loadInitialData = async () => {
      try {
        const [
          rooms, events, rules, simStatus, settings,
          realDevs, cctv, occStates, unifiedEnergy, failsafe, commands
        ] = await Promise.all([
          fetchRooms(),
          fetchEvents(200),
          fetchAutomationRules(),
          fetchSimulationStatus(),
          fetchSettings(),
          fetchRealDevices().catch(() => []),
          fetchCctvSources().catch(() => []),
          fetchOccupancyStates().catch(() => []),
          fetchUnifiedEnergy().catch(() => null),
          fetchFailSafeSettings().catch(() => ({ policy: 'turn_off' as const, bufferOn: 3, bufferOff: 5 })),
          fetchRecentCommands(50).catch(() => [])
        ]);

        setRooms(rooms);
        setEvents(events);
        setAutomationRules(rules);
        setSimulation(simStatus);
        setSettings(settings);
        if (realDevs) setRealDevices(realDevs);
        if (cctv) setCctvSources(cctv);
        if (occStates) setOccupancyStates(occStates);
        if (unifiedEnergy) setUnifiedEnergy(unifiedEnergy);
        if (failsafe?.policy) setFailsafePolicy(failsafe.policy);
        if (commands) setDeviceCommands(commands);
        setLoading(false);
      } catch (err) {
        console.error('Failed to load initial data:', err);
        setLoading(false);
      }
    };
    loadInitialData();
  }, []);

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <Sidebar />
      <div className={`transition-all duration-300 ${sidebarCollapsed ? 'ml-[68px]' : 'ml-[260px]'}`}>
        <Topbar />
        <main className="p-6 animate-fade-in max-w-7xl">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
