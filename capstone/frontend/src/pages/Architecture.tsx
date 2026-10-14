import { useAppStore } from '../store/appStore';
import {
  Camera, Video, Cpu, Activity, Zap, Sliders, Wifi, Bluetooth,
  Power, BarChart3, ArrowDown, ArrowRight, ShieldCheck, CheckCircle2
} from 'lucide-react';

export default function Architecture() {
  const { occupancySource, cameraState, realDevices, rooms, unifiedEnergy } = useAppStore();

  const isSimActive = occupancySource === 'simulation';
  const isCctvActive = occupancySource === 'cctv';
  const isWebcamActive = occupancySource === 'camera' || occupancySource === 'webcam';

  const wifiDevices = realDevices.filter(d => d.connection_type === 'wifi');
  const bleDevices = realDevices.filter(d => d.connection_type === 'bluetooth');

  return (
    <div className="space-y-6 max-w-5xl">
      <div>
        <div className="flex items-center gap-2">
          <h1 className="text-2xl font-bold text-slate-900">System Architecture & IoT Pipeline</h1>
          <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-blue-100 text-blue-800 border border-blue-200">
            Phase 16 Architecture
          </span>
        </div>
        <p className="text-slate-500 text-sm mt-0.5">
          Dual-branch pipeline integrating software simulation sensors and real-world computer vision IoT actuation
        </p>
      </div>

      {/* Visual Pipeline Diagram */}
      <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-2xs space-y-6">
        <div className="flex items-center justify-between pb-3 border-b border-slate-100">
          <h3 className="text-sm font-bold text-slate-900">End-to-End Pipeline Visualization</h3>
          <span className="text-xs font-medium text-slate-500">Live active pipeline highlighted</span>
        </div>

        {/* Level 1: Input Layer (Simulation vs CCTV / Webcam) */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Branch A: Simulation Sensors */}
          <div className={`p-4 rounded-xl border transition-all ${
            isSimActive
              ? 'bg-blue-50/70 border-blue-300 ring-2 ring-blue-500/20 shadow-xs'
              : 'bg-slate-50 border-slate-200 opacity-60'
          }`}>
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2 font-bold text-slate-900 text-sm">
                <Cpu size={18} className="text-blue-600" />
                <span>Simulation Sensor Engine</span>
              </div>
              {isSimActive && (
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-600 text-white">
                  ACTIVE INPUT
                </span>
              )}
            </div>
            <p className="text-xs text-slate-600">
              Virtual occupancy, temperature, and ambient light sensors ticking across 20 rooms.
            </p>
          </div>

          {/* Branch B: CCTV & Webcam Vision */}
          <div className={`p-4 rounded-xl border transition-all ${
            !isSimActive
              ? 'bg-emerald-50/70 border-emerald-300 ring-2 ring-emerald-500/20 shadow-xs'
              : 'bg-slate-50 border-slate-200 opacity-60'
          }`}>
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2 font-bold text-slate-900 text-sm">
                {isCctvActive ? <Video size={18} className="text-emerald-600" /> : <Camera size={18} className="text-emerald-600" />}
                <span>CCTV / Webcam Vision Input</span>
              </div>
              {!isSimActive && (
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-600 text-white">
                  ACTIVE INPUT
                </span>
              )}
            </div>
            <p className="text-xs text-slate-600">
              Local webcam or RTSP/HTTP network camera streaming frames for computer vision.
            </p>
          </div>
        </div>

        {/* Down Arrow */}
        <div className="flex justify-around text-slate-300">
          <ArrowDown size={20} className={isSimActive ? 'text-blue-500' : 'text-slate-300'} />
          <ArrowDown size={20} className={!isSimActive ? 'text-emerald-500' : 'text-slate-300'} />
        </div>

        {/* Level 2: Human Detection Layer */}
        <div className="p-4 rounded-xl border border-slate-200 bg-slate-50 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-lg bg-emerald-100 text-emerald-800">
              <Activity size={20} />
            </div>
            <div>
              <h4 className="text-sm font-bold text-slate-900">COCO-SSD Human Detection Layer (Phase 4)</h4>
              <p className="text-xs text-slate-500">
                In-browser MobileNetV2 filtering strictly for <code className="text-xs font-bold text-emerald-700">class = person</code> with 3-frame positive / 5-frame negative stability buffering.
              </p>
            </div>
          </div>
          <span className="text-xs font-mono font-bold text-slate-700">
            {cameraState.peopleCount} Person(s)
          </span>
        </div>

        {/* Down Arrow */}
        <div className="flex justify-center text-slate-400">
          <ArrowDown size={20} />
        </div>

        {/* Level 3: Centralized Occupancy Engine */}
        <div className="p-4 rounded-xl border border-blue-200 bg-blue-50/50 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-lg bg-blue-600 text-white">
              <Zap size={20} />
            </div>
            <div>
              <h4 className="text-sm font-bold text-slate-900">Centralized Occupancy Engine (Phase 5)</h4>
              <p className="text-xs text-slate-600">
                Reconciles inputs from Simulation, Webcam, or CCTV into deterministic states: <strong className="text-slate-900">OCCUPIED</strong>, <strong className="text-slate-900">VACANT</strong>, or <strong className="text-slate-900">UNKNOWN</strong> (Fail-Safe).
              </p>
            </div>
          </div>
          <span className="px-2.5 py-1 rounded-lg bg-blue-100 text-blue-800 font-bold text-xs">
            Decision Hub
          </span>
        </div>

        {/* Down Arrow */}
        <div className="flex justify-center text-slate-400">
          <ArrowDown size={20} />
        </div>

        {/* Level 4: Automation Rules Engine */}
        <div className="p-4 rounded-xl border border-slate-200 bg-slate-50 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-lg bg-indigo-100 text-indigo-800">
              <Sliders size={20} />
            </div>
            <div>
              <h4 className="text-sm font-bold text-slate-900">Automation Rule Engine (Phase 6)</h4>
              <p className="text-xs text-slate-500">
                Evaluates condition matrices (Empty room shutdown, light threshold, high temperature) generating command dispatches.
              </p>
            </div>
          </div>
          <span className="text-xs font-semibold text-slate-500">
            Rule Priority Queue
          </span>
        </div>

        {/* Down Arrow */}
        <div className="flex justify-center text-slate-400">
          <ArrowDown size={20} />
        </div>

        {/* Level 5: Device Controller & Command Queue */}
        <div className="p-4 rounded-xl border border-amber-200 bg-amber-50/50 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-lg bg-amber-600 text-white">
              <Power size={20} />
            </div>
            <div>
              <h4 className="text-sm font-bold text-slate-900">Device Controller & Command Queue (Phase 7 & 13)</h4>
              <p className="text-xs text-slate-600">
                Deduplication check (suppresses repeat ON/OFF if state unchanged), retry with exponential backoff (max 3), and audit persistence.
              </p>
            </div>
          </div>
          <span className="text-xs font-bold text-amber-800">
            Deduplicated
          </span>
        </div>

        {/* Down Arrow splitting into Wi-Fi and Bluetooth */}
        <div className="flex justify-center text-slate-400">
          <ArrowDown size={20} />
        </div>

        {/* Level 6: Hardware Adapters (Wi-Fi vs Bluetooth) */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="p-4 rounded-xl border border-slate-200 bg-white shadow-2xs">
            <div className="flex items-center gap-2 mb-2 font-bold text-slate-900 text-xs">
              <Wifi size={16} className="text-blue-600" />
              <span>Wi-Fi Communication Adapter (Phase 8)</span>
            </div>
            <p className="text-xs text-slate-500 mb-2">
              Shelly HTTP, Tasmota HTTP, Generic REST webhooks, and raw TCP sockets.
            </p>
            <span className="text-[11px] font-bold text-blue-700">
              {wifiDevices.length} Connected Wi-Fi Devices
            </span>
          </div>

          <div className="p-4 rounded-xl border border-slate-200 bg-white shadow-2xs">
            <div className="flex items-center gap-2 mb-2 font-bold text-slate-900 text-xs">
              <Bluetooth size={16} className="text-indigo-600" />
              <span>Bluetooth Adapter (Phase 9)</span>
            </div>
            <p className="text-xs text-slate-500 mb-2">
              Web Bluetooth in Chromium browsers & OS Bluetooth subsystem probing.
            </p>
            <span className="text-[11px] font-bold text-indigo-700">
              {bleDevices.length} Connected Bluetooth Devices
            </span>
          </div>
        </div>

        {/* Down Arrow */}
        <div className="flex justify-center text-slate-400">
          <ArrowDown size={20} />
        </div>

        {/* Level 7: Real Physical Devices */}
        <div className="p-4 rounded-xl border border-emerald-200 bg-emerald-50/60 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-lg bg-emerald-600 text-white">
              <Power size={20} />
            </div>
            <div>
              <h4 className="text-sm font-bold text-slate-900">Physical Smart Devices (Phase 10 & 11)</h4>
              <p className="text-xs text-slate-600">
                Lights, Fans, Air Conditioners, and Smart Plugs executing physical power switching.
              </p>
            </div>
          </div>
          <span className="text-xs font-bold text-emerald-800">
            {realDevices.length} Real Devices Registered
          </span>
        </div>

        {/* Down Arrow */}
        <div className="flex justify-center text-slate-400">
          <ArrowDown size={20} />
        </div>

        {/* Level 8: Energy Monitoring */}
        <div className="p-4 rounded-xl border border-purple-200 bg-purple-50/60 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-lg bg-purple-600 text-white">
              <BarChart3 size={20} />
            </div>
            <div>
              <h4 className="text-sm font-bold text-slate-900">Energy Optimization & Monitoring (Phase 14)</h4>
              <p className="text-xs text-slate-600">
                Strict separation between <strong className="text-slate-900">Simulated Energy</strong> and <strong className="text-slate-900">Real Device Estimated Energy</strong> (power × operating runtime).
              </p>
            </div>
          </div>
          <span className="text-xs font-mono font-bold text-purple-800">
            {unifiedEnergy?.realDevices.estimatedEnergyKWH || '0.000'} kWh Real Estimated
          </span>
        </div>
      </div>
    </div>
  );
}
