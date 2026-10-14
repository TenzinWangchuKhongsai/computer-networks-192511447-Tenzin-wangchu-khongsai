import { NavLink } from 'react-router-dom';
import { useAppStore } from '../../store/appStore';
import {
  LayoutDashboard, Activity, DoorOpen, Cpu, Power, Zap, BarChart3,
  Bell, SlidersHorizontal, Info, ChevronLeft, ChevronRight, Building2, Camera,
  Radio, Layers, ShieldCheck, Wifi, HeartPulse
} from 'lucide-react';


const navItems = [
  { to: '/', icon: LayoutDashboard, label: 'Overview' },
  { to: '/camera', icon: Camera, label: 'Live Camera & CCTV' },
  { to: '/real-devices', icon: Radio, label: 'Real Devices' },
  { to: '/network', icon: Wifi, label: 'Network Access' },
  { to: '/system-health', icon: HeartPulse, label: 'System Health' },
  { to: '/monitoring', icon: Activity, label: 'Live Monitoring' },
  { to: '/rooms', icon: DoorOpen, label: 'Rooms' },
  { to: '/sensors', icon: Cpu, label: 'Sensors' },
  { to: '/devices', icon: Power, label: 'Devices' },
  { to: '/automation', icon: Zap, label: 'Automation' },
  { to: '/energy', icon: BarChart3, label: 'Energy Analytics' },
  { to: '/architecture', icon: Layers, label: 'Architecture' },
  { to: '/test-mode', icon: ShieldCheck, label: 'IoT Test Mode' },
  { to: '/events', icon: Bell, label: 'Events & Alerts' },
  { to: '/simulation', icon: SlidersHorizontal, label: 'Simulation Control' },
  { to: '/about', icon: Info, label: 'About' },
];

export default function Sidebar() {
  const { sidebarCollapsed, toggleSidebar } = useAppStore();

  return (
    <aside className={`fixed left-0 top-0 h-full bg-white border-r border-slate-200 z-40 transition-all duration-300 flex flex-col shadow-sm ${sidebarCollapsed ? 'w-[68px]' : 'w-[260px]'}`}>
      {/* Logo */}
      <div className="h-16 flex items-center px-4 border-b border-slate-200">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-blue-600 to-indigo-600 flex items-center justify-center flex-shrink-0 shadow-sm">
            <Building2 size={20} className="text-white" />
          </div>
          {!sidebarCollapsed && (
            <div className="animate-fade-in min-w-0">
              <h1 className="text-sm font-bold text-slate-900 leading-tight">SmartOffice</h1>
              <p className="text-[11px] text-slate-500 font-medium leading-tight">IoT Simulation Platform</p>
            </div>
          )}
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 py-4 px-3 overflow-y-auto scrollbar-thin">
        <div className="space-y-1">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 group
                ${isActive
                  ? 'bg-blue-50 text-blue-700 font-semibold border border-blue-100/80 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100/80'
                }`
              }
            >
              <item.icon size={18} className="flex-shrink-0" />
              {!sidebarCollapsed && (
                <span className="animate-fade-in truncate">{item.label}</span>
              )}
            </NavLink>
          ))}
        </div>
      </nav>

      {/* Collapse toggle */}
      <div className="p-3 border-t border-slate-200">
        <button
          onClick={toggleSidebar}
          className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-slate-500 hover:text-slate-900 hover:bg-slate-100 transition-colors text-sm"
        >
          {sidebarCollapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
          {!sidebarCollapsed && <span>Collapse</span>}
        </button>
      </div>
    </aside>
  );
}
