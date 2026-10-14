import { useState, useEffect } from 'react';
import { X, Zap, Cpu, Wind, Monitor, LayoutGrid, ToggleRight } from 'lucide-react';
import { setBulkDevices } from '../services/api';
import { useAppStore } from '../store/appStore';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  initialRoomIds?: number[] | 'all';
}

export default function BulkDeviceModal({ isOpen, onClose, initialRoomIds = 'all' }: Props) {
  const { rooms } = useAppStore();
  const [targetRoomsMode, setTargetRoomsMode] = useState<'all' | 'selected'>(
    initialRoomIds === 'all' ? 'all' : 'selected'
  );
  const [selectedRoomIds, setSelectedRoomIds] = useState<number[]>(
    Array.isArray(initialRoomIds) ? initialRoomIds : []
  );

  const [targetApplianceMode, setTargetApplianceMode] = useState<'all' | 'selected'>('all');
  const [selectedAppliances, setSelectedAppliances] = useState<string[]>(['light', 'fan', 'cooling']);
  const [actionStatus, setActionStatus] = useState<boolean>(true);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setTargetRoomsMode(initialRoomIds === 'all' ? 'all' : 'selected');
      setSelectedRoomIds(Array.isArray(initialRoomIds) ? initialRoomIds : []);
    }
  }, [isOpen, initialRoomIds]);

  if (!isOpen) return null;

  const toggleRoom = (id: number) => {
    setSelectedRoomIds(prev => 
      prev.includes(id) ? prev.filter(r => r !== id) : [...prev, id]
    );
  };

  const toggleAppliance = (type: string) => {
    setSelectedAppliances(prev => 
      prev.includes(type) ? prev.filter(t => t !== type) : [...prev, type]
    );
  };

  const handleApply = async () => {
    const finalRoomIds = targetRoomsMode === 'all' ? 'all' : selectedRoomIds;
    const finalDeviceTypes = targetApplianceMode === 'all' ? 'all' : selectedAppliances;

    if (targetRoomsMode === 'selected' && selectedRoomIds.length === 0) return;
    if (targetApplianceMode === 'selected' && selectedAppliances.length === 0) return;

    setLoading(true);
    try {
      await setBulkDevices(finalRoomIds, finalDeviceTypes, actionStatus, false);
      onClose();
    } catch (err) {
      console.error('Failed to configure devices in bulk:', err);
    }
    setLoading(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm animate-fade-in">
      <div className="bg-white rounded-2xl w-full max-w-2xl shadow-xl overflow-hidden border border-slate-200 flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-blue-100 rounded-xl flex items-center justify-center text-blue-700 shadow-2xs">
              <Zap size={20} />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-900 leading-tight">Bulk Device Configuration</h2>
              <p className="text-xs text-slate-500 font-medium">Turn appliances ON or OFF across multiple entered rooms</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors">
            <X size={20} />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-8 scrollbar-thin">
          
          {/* Section 1: Target Rooms */}
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <LayoutGrid size={18} className="text-slate-600" />
              <h3 className="text-sm font-bold text-slate-900">1. Select Target Rooms</h3>
            </div>
            
            <div className="grid grid-cols-2 gap-3">
              <button 
                onClick={() => setTargetRoomsMode('all')}
                className={`p-4 rounded-xl border text-left transition-all ${
                  targetRoomsMode === 'all' ? 'bg-blue-50 border-blue-600 shadow-2xs' : 'bg-white border-slate-200 hover:border-blue-300'
                }`}
              >
                <p className={`text-sm font-bold ${targetRoomsMode === 'all' ? 'text-blue-800' : 'text-slate-700'}`}>All Entered Rooms</p>
                <p className="text-xs text-slate-500 mt-1">Apply to every room currently occupied.</p>
              </button>
              <button 
                onClick={() => setTargetRoomsMode('selected')}
                className={`p-4 rounded-xl border text-left transition-all ${
                  targetRoomsMode === 'selected' ? 'bg-blue-50 border-blue-600 shadow-2xs' : 'bg-white border-slate-200 hover:border-blue-300'
                }`}
              >
                <p className={`text-sm font-bold ${targetRoomsMode === 'selected' ? 'text-blue-800' : 'text-slate-700'}`}>Specific Rooms</p>
                <p className="text-xs text-slate-500 mt-1">Manually pick rooms from a list.</p>
              </button>
            </div>

            {targetRoomsMode === 'selected' && (
              <div className="mt-4 p-4 rounded-xl bg-slate-50 border border-slate-200 max-h-48 overflow-y-auto scrollbar-thin grid grid-cols-2 sm:grid-cols-3 gap-2">
                {rooms.map(room => (
                  <label key={room.id} className="flex items-center gap-2 p-2 rounded-lg hover:bg-slate-100 cursor-pointer">
                    <input 
                      type="checkbox"
                      checked={selectedRoomIds.includes(room.id)}
                      onChange={() => toggleRoom(room.id)}
                      className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-600"
                    />
                    <span className="text-xs font-bold text-slate-700">{room.name}</span>
                  </label>
                ))}
              </div>
            )}
          </div>

          {/* Section 2: Target Appliances */}
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <Monitor size={18} className="text-slate-600" />
              <h3 className="text-sm font-bold text-slate-900">2. Select Appliances</h3>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <button 
                onClick={() => setTargetApplianceMode('all')}
                className={`p-4 rounded-xl border text-left transition-all ${
                  targetApplianceMode === 'all' ? 'bg-amber-50 border-amber-500 shadow-2xs' : 'bg-white border-slate-200 hover:border-amber-300'
                }`}
              >
                <p className={`text-sm font-bold ${targetApplianceMode === 'all' ? 'text-amber-800' : 'text-slate-700'}`}>All Appliances</p>
                <p className="text-xs text-slate-500 mt-1">Lights, Fans, and HVAC systems.</p>
              </button>
              <button 
                onClick={() => setTargetApplianceMode('selected')}
                className={`p-4 rounded-xl border text-left transition-all ${
                  targetApplianceMode === 'selected' ? 'bg-amber-50 border-amber-500 shadow-2xs' : 'bg-white border-slate-200 hover:border-amber-300'
                }`}
              >
                <p className={`text-sm font-bold ${targetApplianceMode === 'selected' ? 'text-amber-800' : 'text-slate-700'}`}>Specific Appliances</p>
                <p className="text-xs text-slate-500 mt-1">Choose which device types to configure.</p>
              </button>
            </div>

            {targetApplianceMode === 'selected' && (
              <div className="mt-4 flex gap-3">
                {[
                  { id: 'light', label: 'Lights', icon: Zap, color: 'text-amber-600', bg: 'bg-amber-100' },
                  { id: 'fan', label: 'Fans', icon: Wind, color: 'text-cyan-600', bg: 'bg-cyan-100' },
                  { id: 'cooling', label: 'HVAC', icon: Cpu, color: 'text-blue-600', bg: 'bg-blue-100' },
                ].map(app => {
                  const Icon = app.icon;
                  const isSelected = selectedAppliances.includes(app.id);
                  return (
                    <button
                      key={app.id}
                      onClick={() => toggleAppliance(app.id)}
                      className={`flex-1 flex flex-col items-center justify-center p-4 rounded-xl border transition-all ${
                        isSelected ? 'border-slate-800 bg-slate-50 shadow-2xs' : 'border-slate-200 bg-white hover:bg-slate-50'
                      }`}
                    >
                      <div className={`w-10 h-10 rounded-lg flex items-center justify-center mb-2 ${isSelected ? app.bg : 'bg-slate-100'}`}>
                        <Icon size={20} className={isSelected ? app.color : 'text-slate-400'} />
                      </div>
                      <span className={`text-xs font-bold ${isSelected ? 'text-slate-900' : 'text-slate-500'}`}>{app.label}</span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* Section 3: Action Setup */}
          <div className="space-y-4 pb-4">
            <div className="flex items-center gap-2">
              <ToggleRight size={18} className="text-slate-600" />
              <h3 className="text-sm font-bold text-slate-900">3. Action Configuration</h3>
            </div>
            
            <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-bold text-slate-900">Device State</p>
                  <p className="text-xs text-slate-500">Should the selected devices be turned ON or OFF?</p>
                </div>
                <div className="flex bg-slate-100 rounded-lg p-1">
                  <button onClick={() => setActionStatus(true)} className={`px-4 py-1.5 rounded-md text-xs font-bold transition-all ${actionStatus ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>Turn ON</button>
                  <button onClick={() => setActionStatus(false)} className={`px-4 py-1.5 rounded-md text-xs font-bold transition-all ${!actionStatus ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>Turn OFF</button>
                </div>
              </div>
            </div>
          </div>

        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-100 bg-white flex justify-end gap-3">
          <button onClick={onClose} className="px-5 py-2.5 rounded-xl text-sm font-bold text-slate-600 hover:bg-slate-100 transition-colors">
            Cancel
          </button>
          <button 
            onClick={handleApply}
            disabled={
              loading ||
              (targetRoomsMode === 'selected' && selectedRoomIds.length === 0) ||
              (targetApplianceMode === 'selected' && selectedAppliances.length === 0)
            }
            className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-sm font-bold shadow-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            {loading ? 'Applying...' : `Apply Bulk Configuration`}
          </button>
        </div>
      </div>
    </div>
  );
}
