import { useState } from 'react';
import { useAppStore } from '../store/appStore';
import {
  createRealDevice, deleteRealDevice, testRealDeviceConnection,
  toggleRealDevice, setRealDevicePower, setRealDeviceMode
} from '../services/api';
import type { RealDevice, RealDeviceType, ConnectionType, DeviceProtocol } from '../types';
import {
  Wifi, Bluetooth, Power, Plus, Trash2, CheckCircle2, XCircle, AlertTriangle,
  HelpCircle, RefreshCw, Sliders, Zap, Lightbulb, Fan, Snowflake, Radio, Clock, ShieldCheck
} from 'lucide-react';

export default function RealDevices() {
  const { rooms, realDevices, deviceCommands, updateRealDevice, removeRealDevice, addNotification } = useAppStore();

  const [showAddModal, setShowAddModal] = useState(false);
  const [testingConnection, setTestingConnection] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; status: string; latencyMs?: number; message?: string } | null>(null);
  const [bleScanning, setBleScanning] = useState(false);
  const [bleStatusMsg, setBleStatusMsg] = useState<string | null>(null);

  // Form state for adding device
  const [formData, setFormData] = useState({
    name: '',
    room_id: rooms[0]?.id || 1,
    type: 'light' as RealDeviceType,
    connection_type: 'wifi' as ConnectionType,
    protocol: 'shelly_http' as DeviceProtocol,
    ip_address: '',
    port: 80,
    bluetooth_identifier: '',
    rated_power_watts: 40,
    control_mode: 'auto' as 'auto' | 'manual',
    config_json: ''
  });

  const activeCount = realDevices.filter(d => d.state === 'ON').length;
  const totalPowerWatts = realDevices
    .filter(d => d.state === 'ON')
    .reduce((sum, d) => sum + (d.rated_power_watts || 0), 0);
  const totalEstimatedEnergyKWH = realDevices.reduce((sum, d) => {
    const seconds = d.total_runtime_seconds || 0;
    const watts = d.rated_power_watts || 0;
    return sum + ((watts * seconds) / (3600 * 1000));
  }, 0);

  const handleTestConnection = async () => {
    setTestingConnection(true);
    setTestResult(null);
    try {
      const res = await testRealDeviceConnection(formData);
      setTestResult(res);
    } catch (err: any) {
      setTestResult({
        success: false,
        status: 'error',
        message: err.response?.data?.error || err.message
      });
    } finally {
      setTestingConnection(false);
    }
  };

  const handleSaveDevice = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim()) return;

    try {
      await createRealDevice(formData);
      setShowAddModal(false);
      setTestResult(null);
      setFormData({
        name: '',
        room_id: rooms[0]?.id || 1,
        type: 'light',
        connection_type: 'wifi',
        protocol: 'shelly_http',
        ip_address: '',
        port: 80,
        bluetooth_identifier: '',
        rated_power_watts: 40,
        control_mode: 'auto',
        config_json: ''
      });
      addNotification({
        id: 'dev-' + Date.now(),
        type: 'success',
        message: `Real device '${formData.name}' registered successfully.`,
        timestamp: Date.now()
      });
    } catch (err: any) {
      alert(`Failed to save device: ${err.response?.data?.error || err.message}`);
    }
  };

  const handleDeleteDevice = async (id: number, name: string) => {
    if (!confirm(`Are you sure you want to remove '${name}'?`)) return;
    try {
      await deleteRealDevice(id);
      removeRealDevice(id);
    } catch (err: any) {
      alert(`Delete failed: ${err.message}`);
    }
  };

  const handleToggle = async (id: number) => {
    try {
      await toggleRealDevice(id);
    } catch (err: any) {
      console.error('Toggle error:', err);
    }
  };

  const handleModeChange = async (id: number, newMode: 'auto' | 'manual') => {
    try {
      const updated = await setRealDeviceMode(id, newMode);
      updateRealDevice(updated);
    } catch (err: any) {
      console.error('Mode change error:', err);
    }
  };

  // Web Bluetooth Browser API integration
  const handleWebBluetoothScan = async () => {
    setBleScanning(true);
    setBleStatusMsg(null);
    try {
      const nav: any = navigator;
      if (!nav.bluetooth) {
        setBleStatusMsg('Web Bluetooth is not supported in this browser. Please use Google Chrome or Microsoft Edge.');
        return;
      }
      const device = await nav.bluetooth.requestDevice({
        acceptAllDevices: true,
        optionalServices: ['battery_service', 'generic_access']
      });
      setBleStatusMsg(`Discovered Bluetooth device: ${device.name || device.id}. Ready to register as real device.`);
      setFormData(prev => ({
        ...prev,
        connection_type: 'bluetooth',
        protocol: 'ble_gatt',
        name: device.name || 'BLE Device',
        bluetooth_identifier: device.name || device.id
      }));
      setShowAddModal(true);
    } catch (err: any) {
      if (err.name === 'NotFoundError') {
        setBleStatusMsg('Bluetooth scan cancelled or no device selected.');
      } else {
        setBleStatusMsg(`Bluetooth error: ${err.message}`);
      }
    } finally {
      setBleScanning(false);
    }
  };

  const getDeviceIcon = (type: RealDeviceType) => {
    switch (type) {
      case 'light': return Lightbulb;
      case 'fan': return Fan;
      case 'ac': return Snowflake;
      default: return Radio;
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold text-slate-900">Physical IoT Devices</h1>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-blue-100 text-blue-800 border border-blue-200">
              Real Hardware Layer
            </span>
          </div>
          <p className="text-slate-500 text-sm mt-0.5">
            Registered physical smart equipment controlled via Wi-Fi and Bluetooth adapters
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={handleWebBluetoothScan}
            disabled={bleScanning}
            className="flex items-center gap-2 px-3.5 py-2 rounded-lg bg-indigo-50 border border-indigo-200 text-indigo-700 hover:bg-indigo-100 text-sm font-semibold transition-colors"
          >
            <Bluetooth size={16} className={bleScanning ? 'animate-spin' : ''} />
            {bleScanning ? 'Scanning BLE...' : 'Scan Bluetooth (Web BLE)'}
          </button>

          <button
            onClick={() => {
              setShowAddModal(true);
              setTestResult(null);
            }}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold shadow-xs transition-colors"
          >
            <Plus size={16} />
            + Add Real Device
          </button>
        </div>
      </div>

      {bleStatusMsg && (
        <div className="p-3.5 rounded-xl bg-indigo-50 border border-indigo-200 text-indigo-900 text-xs flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Bluetooth size={16} className="text-indigo-600 flex-shrink-0" />
            <span>{bleStatusMsg}</span>
          </div>
          <button onClick={() => setBleStatusMsg(null)} className="text-indigo-600 font-bold hover:underline">
            Dismiss
          </button>
        </div>
      )}

      {/* Real Hardware Metrics */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="px-4 py-3 bg-white rounded-xl border border-slate-200 shadow-2xs">
          <p className="text-xs font-medium text-slate-500">Registered Real Devices</p>
          <p className="text-2xl font-extrabold text-slate-900 mt-0.5">{realDevices.length}</p>
          <p className="text-[11px] text-slate-500 mt-1">Physical endpoints in database</p>
        </div>

        <div className="px-4 py-3 bg-emerald-50/70 rounded-xl border border-emerald-200 shadow-2xs">
          <p className="text-xs font-bold text-emerald-800">Physical Devices Active (ON)</p>
          <p className="text-2xl font-extrabold text-emerald-700 mt-0.5">{activeCount}</p>
          <p className="text-[11px] text-emerald-700 mt-1">Confirmed energized state</p>
        </div>

        <div className="px-4 py-3 bg-amber-50/70 rounded-xl border border-amber-200 shadow-2xs">
          <p className="text-xs font-bold text-amber-800">Real Estimated Power</p>
          <p className="text-2xl font-extrabold text-amber-800 font-mono mt-0.5">
            {totalPowerWatts} <span className="text-sm font-bold">W</span>
          </p>
          <p className="text-[11px] text-amber-700 mt-1">Σ(Active real rated wattage)</p>
        </div>

        <div className="px-4 py-3 bg-purple-50/70 rounded-xl border border-purple-200 shadow-2xs">
          <p className="text-xs font-bold text-purple-800">Estimated Real Energy</p>
          <p className="text-2xl font-extrabold text-purple-800 font-mono mt-0.5">
            {totalEstimatedEnergyKWH.toFixed(4)} <span className="text-sm font-bold">kWh</span>
          </p>
          <p className="text-[11px] text-purple-700 mt-1">Operating time × rated power</p>
        </div>
      </div>

      {/* Device List */}
      <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-2xs">
        <div className="flex items-center justify-between mb-4 pb-3 border-b border-slate-100">
          <div>
            <h3 className="text-sm font-bold text-slate-900">Physical Hardware Inventory</h3>
            <p className="text-xs text-slate-500">Distinct from simulation actuators. Supports manual test & auto occupancy triggers.</p>
          </div>
          <span className="text-xs font-semibold text-slate-500">
            {realDevices.length} devices configured
          </span>
        </div>

        {realDevices.length === 0 ? (
          <div className="text-center py-12 px-4">
            <Radio size={40} className="mx-auto text-slate-400 mb-3" />
            <h4 className="text-base font-bold text-slate-800">No Real Devices Registered Yet</h4>
            <p className="text-sm text-slate-500 max-w-md mx-auto mt-1 mb-4">
              Add your physical Wi-Fi smart plugs, relays (Shelly, Tasmota, REST) or Bluetooth equipment to connect real hardware.
            </p>
            <button
              onClick={() => setShowAddModal(true)}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold shadow-xs"
            >
              <Plus size={16} />
              + Add First Device
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {realDevices.map(dev => {
              const Icon = getDeviceIcon(dev.type);
              const room = rooms.find(r => r.id === dev.room_id);
              const runtimeSecs = dev.total_runtime_seconds || 0;
              const runtimeHours = (runtimeSecs / 3600).toFixed(2);
              const estKwh = ((dev.rated_power_watts * runtimeSecs) / (3600 * 1000)).toFixed(4);

              return (
                <div
                  key={dev.id}
                  className={`p-4 rounded-xl border transition-all ${
                    dev.state === 'ON'
                      ? 'bg-blue-50/40 border-blue-200 shadow-2xs'
                      : 'bg-white border-slate-200 shadow-2xs'
                  }`}
                >
                  {/* Card Header */}
                  <div className="flex items-start justify-between gap-2 mb-3">
                    <div className="flex items-center gap-2.5">
                      <div className={`p-2 rounded-lg ${
                        dev.state === 'ON' ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-600'
                      }`}>
                        <Icon size={18} />
                      </div>
                      <div>
                        <h4 className="text-sm font-bold text-slate-900 leading-tight">{dev.name}</h4>
                        <p className="text-xs text-slate-500 font-medium">{room ? room.name : 'Unassigned Room'}</p>
                      </div>
                    </div>

                    <button
                      onClick={() => handleDeleteDevice(dev.id, dev.name)}
                      className="text-slate-400 hover:text-red-600 p-1 rounded transition-colors"
                      title="Delete Device"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>

                  {/* Status & Connection Badges */}
                  <div className="flex flex-wrap gap-1.5 mb-3 text-[11px] font-semibold">
                    {/* Connection Status */}
                    {dev.control_status === 'connected' && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-emerald-100 text-emerald-800 border border-emerald-200">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span> Connected
                      </span>
                    )}
                    {dev.control_status === 'disconnected' && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 border border-slate-200">
                        <span className="w-1.5 h-1.5 rounded-full bg-slate-400"></span> Disconnected
                      </span>
                    )}
                    {dev.control_status === 'error' && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-red-100 text-red-800 border border-red-200">
                        <span className="w-1.5 h-1.5 rounded-full bg-red-500"></span> Error
                      </span>
                    )}
                    {dev.control_status === 'unknown' && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-amber-100 text-amber-800 border border-amber-200">
                        <span className="w-1.5 h-1.5 rounded-full bg-amber-500"></span> Unknown
                      </span>
                    )}

                    {/* Protocol */}
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 border border-slate-200">
                      {dev.connection_type === 'wifi' ? <Wifi size={12} /> : <Bluetooth size={12} />}
                      {dev.protocol.replace('_', ' ').toUpperCase()}
                    </span>

                    {/* Rated Watts */}
                    <span className="inline-flex items-center px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 border border-slate-200 font-mono">
                      {dev.rated_power_watts} W Rated
                    </span>
                  </div>

                  {/* Device Address */}
                  <p className="text-xs text-slate-500 truncate mb-3">
                    <span className="font-semibold text-slate-700">Endpoint:</span>{' '}
                    {dev.connection_type === 'wifi'
                      ? `${dev.ip_address || '0.0.0.0'}:${dev.port || 80}`
                      : (dev.bluetooth_identifier || 'Bluetooth UUID')
                    }
                  </p>

                  {/* Energy Stats */}
                  <div className="bg-slate-50 rounded-lg p-2.5 mb-3 border border-slate-200 text-xs space-y-1">
                    <div className="flex justify-between text-slate-600">
                      <span>Total Runtime:</span>
                      <span className="font-semibold font-mono text-slate-900">{runtimeHours} hrs ({runtimeSecs}s)</span>
                    </div>
                    <div className="flex justify-between text-slate-600">
                      <span>Estimated Energy:</span>
                      <span className="font-bold font-mono text-purple-700">{estKwh} kWh</span>
                    </div>
                  </div>

                  {/* Mode & Manual Controls */}
                  <div className="pt-2 border-t border-slate-200 flex items-center justify-between">
                    {/* Auto / Manual Mode Toggle */}
                    <div className="flex items-center gap-1 bg-slate-100 p-0.5 rounded-lg border border-slate-200">
                      <button
                        onClick={() => handleModeChange(dev.id, 'auto')}
                        className={`px-2 py-1 text-xs font-bold rounded-md transition-colors ${
                          dev.control_mode === 'auto'
                            ? 'bg-blue-600 text-white shadow-xs'
                            : 'text-slate-600 hover:text-slate-900'
                        }`}
                      >
                        AUTO
                      </button>
                      <button
                        onClick={() => handleModeChange(dev.id, 'manual')}
                        className={`px-2 py-1 text-xs font-bold rounded-md transition-colors ${
                          dev.control_mode === 'manual'
                            ? 'bg-amber-600 text-white shadow-xs'
                            : 'text-slate-600 hover:text-slate-900'
                        }`}
                      >
                        MANUAL
                      </button>
                    </div>

                    {/* Manual ON / OFF Toggle Switch */}
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-slate-600">
                        {dev.state}
                      </span>
                      <button
                        onClick={() => handleToggle(dev.id)}
                        className={`relative w-12 h-6 rounded-full transition-all duration-300 ${
                          dev.state === 'ON' ? 'bg-emerald-600' : 'bg-slate-300'
                        }`}
                      >
                        <span className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow-xs transition-transform duration-300 ${
                          dev.state === 'ON' ? 'translate-x-6' : 'translate-x-0'
                        }`} />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Command Queue Audit Log (Phase 13) */}
      <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-2xs">
        <div className="flex items-center justify-between mb-4 pb-3 border-b border-slate-100">
          <div>
            <h3 className="text-sm font-bold text-slate-900">Device Command Execution Queue</h3>
            <p className="text-xs text-slate-500">Live hardware command status, deduplication protection, and retry audit trail</p>
          </div>
          <span className="text-xs font-semibold text-slate-500">
            {deviceCommands.length} recent commands
          </span>
        </div>

        {deviceCommands.length === 0 ? (
          <p className="text-xs text-slate-400 py-4 text-center">No commands queued or executed yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-bold">
                <tr>
                  <th className="py-2.5 px-3">Command ID</th>
                  <th className="py-2.5 px-3">Device</th>
                  <th className="py-2.5 px-3">Command</th>
                  <th className="py-2.5 px-3">Status</th>
                  <th className="py-2.5 px-3">Attempts</th>
                  <th className="py-2.5 px-3">Timestamp</th>
                  <th className="py-2.5 px-3">Result / Error</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {deviceCommands.slice(0, 15).map(cmd => (
                  <tr key={cmd.id} className="hover:bg-slate-50/50">
                    <td className="py-2 px-3 font-mono text-slate-500">{cmd.id}</td>
                    <td className="py-2 px-3 font-bold text-slate-800">{cmd.device_name || `Device #${cmd.device_id}`}</td>
                    <td className="py-2 px-3 font-mono font-bold text-blue-700">{cmd.command}</td>
                    <td className="py-2 px-3">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold ${
                        cmd.status === 'SUCCESS' ? 'bg-emerald-100 text-emerald-800' :
                        cmd.status === 'FAILED' ? 'bg-red-100 text-red-800' :
                        cmd.status === 'SENT' ? 'bg-blue-100 text-blue-800' :
                        'bg-slate-100 text-slate-700'
                      }`}>
                        {cmd.status}
                      </span>
                    </td>
                    <td className="py-2 px-3 font-mono text-slate-600">{cmd.attempts}</td>
                    <td className="py-2 px-3 text-slate-500">
                      {new Date(cmd.created_at).toLocaleTimeString()}
                    </td>
                    <td className="py-2 px-3 text-slate-500 max-w-xs truncate">
                      {cmd.error ? (
                        <span className="text-red-600 font-medium">{cmd.error}</span>
                      ) : (
                        <span className="text-emerald-700 font-medium">Acknowledge OK</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Add Device Modal (Phase 10) */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-xl border border-slate-200 animate-scale-in max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-4">
              <h3 className="text-base font-bold text-slate-900">Add Real Physical IoT Device</h3>
              <button
                onClick={() => setShowAddModal(false)}
                className="text-slate-400 hover:text-slate-700 text-lg font-bold"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveDevice} className="space-y-4 text-xs">
              <div>
                <label className="block font-bold text-slate-700 mb-1">Device Name</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Office Light Relay 1"
                  value={formData.name}
                  onChange={e => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm focus:ring-2 focus:ring-blue-500 outline-hidden"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Device Type</label>
                  <select
                    value={formData.type}
                    onChange={e => setFormData({ ...formData, type: e.target.value as RealDeviceType })}
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm"
                  >
                    <option value="light">Light</option>
                    <option value="fan">Fan</option>
                    <option value="ac">Air Conditioner (AC)</option>
                    <option value="smart_plug">Smart Plug</option>
                    <option value="other">Other Actuator</option>
                  </select>
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">Assigned Room</label>
                  <select
                    value={formData.room_id}
                    onChange={e => setFormData({ ...formData, room_id: parseInt(e.target.value) })}
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm"
                  >
                    {rooms.map(r => (
                      <option key={r.id} value={r.id}>{r.name}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Connection Medium</label>
                  <select
                    value={formData.connection_type}
                    onChange={e => {
                      const ct = e.target.value as ConnectionType;
                      setFormData({
                        ...formData,
                        connection_type: ct,
                        protocol: ct === 'bluetooth' ? 'ble_gatt' : 'shelly_http'
                      });
                    }}
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm"
                  >
                    <option value="wifi">Wi-Fi (LAN / REST / Socket)</option>
                    <option value="bluetooth">Bluetooth (BLE / GATT)</option>
                  </select>
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">Device Protocol</label>
                  <select
                    value={formData.protocol}
                    onChange={e => setFormData({ ...formData, protocol: e.target.value as DeviceProtocol })}
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm"
                  >
                    {formData.connection_type === 'wifi' ? (
                      <>
                        <option value="shelly_http">Shelly HTTP API</option>
                        <option value="tasmota_http">Tasmota HTTP API</option>
                        <option value="generic_rest">Generic REST / Webhook</option>
                        <option value="raw_tcp">Raw TCP Socket</option>
                      </>
                    ) : (
                      <>
                        <option value="ble_gatt">BLE GATT Service</option>
                      </>
                    )}
                  </select>
                </div>
              </div>

              {formData.connection_type === 'wifi' ? (
                <div className="grid grid-cols-3 gap-3">
                  <div className="col-span-2">
                    <label className="block font-bold text-slate-700 mb-1">IP Address / Host</label>
                    <input
                      type="text"
                      placeholder="192.168.1.120"
                      value={formData.ip_address}
                      onChange={e => setFormData({ ...formData, ip_address: e.target.value })}
                      className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm"
                    />
                  </div>
                  <div>
                    <label className="block font-bold text-slate-700 mb-1">Port</label>
                    <input
                      type="number"
                      value={formData.port}
                      onChange={e => setFormData({ ...formData, port: parseInt(e.target.value) || 80 })}
                      className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm"
                    />
                  </div>
                </div>
              ) : (
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Bluetooth Device Name or Service UUID</label>
                  <input
                    type="text"
                    placeholder="e.g. SmartLight_BLE_01 or 0000ffe0-0000-1000-8000-00805f9b34fb"
                    value={formData.bluetooth_identifier}
                    onChange={e => setFormData({ ...formData, bluetooth_identifier: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm"
                  />
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Rated Power (Watts)</label>
                  <input
                    type="number"
                    min="1"
                    max="10000"
                    value={formData.rated_power_watts}
                    onChange={e => setFormData({ ...formData, rated_power_watts: parseFloat(e.target.value) || 40 })}
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm"
                  />
                  <p className="text-[10px] text-slate-500 mt-0.5">Used for Real Estimated Energy</p>
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">Initial Control Mode</label>
                  <select
                    value={formData.control_mode}
                    onChange={e => setFormData({ ...formData, control_mode: e.target.value as 'auto' | 'manual' })}
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm"
                  >
                    <option value="auto">AUTO (Occupancy Driven)</option>
                    <option value="manual">MANUAL (User Toggle Only)</option>
                  </select>
                </div>
              </div>

              {/* TEST CONNECTION Button & Feedback */}
              <div className="pt-2">
                <button
                  type="button"
                  onClick={handleTestConnection}
                  disabled={testingConnection}
                  className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold border border-slate-300 transition-colors"
                >
                  <RefreshCw size={14} className={testingConnection ? 'animate-spin' : ''} />
                  {testingConnection ? 'Probing Device Connection...' : 'TEST CONNECTION'}
                </button>

                {testResult && (
                  <div className={`mt-2 p-2.5 rounded-lg border text-xs flex items-start gap-2 ${
                    testResult.success
                      ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
                      : 'bg-red-50 border-red-200 text-red-900'
                  }`}>
                    {testResult.success ? (
                      <CheckCircle2 size={16} className="text-emerald-600 mt-0.5 flex-shrink-0" />
                    ) : (
                      <XCircle size={16} className="text-red-600 mt-0.5 flex-shrink-0" />
                    )}
                    <div>
                      <p className="font-bold">
                        {testResult.success ? `Connected (${testResult.latencyMs}ms)` : 'Connection Failed'}
                      </p>
                      <p className="text-[11px] opacity-90">{testResult.message}</p>
                    </div>
                  </div>
                )}
              </div>

              {/* Modal Footer */}
              <div className="pt-3 border-t border-slate-200 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2 rounded-lg border border-slate-300 text-slate-700 hover:bg-slate-100 font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-bold shadow-xs"
                >
                  SAVE DEVICE
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
