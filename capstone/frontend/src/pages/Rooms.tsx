import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAppStore } from '../store/appStore';
import { setBulkOccupancy } from '../services/api';
import { ROOM_TYPE_LABELS, ROOM_TYPE_COLORS } from '../types';
import type { RoomType } from '../types';
import { Thermometer, Sun, Power, Users, UserMinus, CheckSquare, Square, Zap } from 'lucide-react';
import BulkDeviceModal from '../components/BulkDeviceModal';

export default function Rooms() {
  const { rooms } = useAppStore();
  const navigate = useNavigate();
  const [selectedRoomIds, setSelectedRoomIds] = useState<number[]>([]);
  const [multiSelectMode, setMultiSelectMode] = useState(false);
  const [loadingAction, setLoadingAction] = useState<string | null>(null);
  const [isBulkDeviceModalOpen, setIsBulkDeviceModalOpen] = useState(false);
  const [bulkDeviceRoomIds, setBulkDeviceRoomIds] = useState<number[] | 'all'>('all');

  const floor1 = rooms.filter(r => r.floor === 1);
  const floor2 = rooms.filter(r => r.floor === 2);

  const handleBulkOccupancy = async (occupied: boolean, all: boolean) => {
    setLoadingAction(all ? (occupied ? 'enter-all' : 'leave-all') : (occupied ? 'enter-selected' : 'leave-selected'));
    try {
      if (all) {
        await setBulkOccupancy(occupied, undefined, true);
      } else {
        if (selectedRoomIds.length === 0) return;
        await setBulkOccupancy(occupied, selectedRoomIds, false);
      }
      setSelectedRoomIds([]);
    } catch (err) {
      console.error('Failed to set bulk occupancy:', err);
    }
    setLoadingAction(null);
  };

  const toggleSelectRoom = (id: number, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setSelectedRoomIds(prev =>
      prev.includes(id) ? prev.filter(rId => rId !== id) : [...prev, id]
    );
  };

  const selectAllRooms = () => {
    if (selectedRoomIds.length === rooms.length) {
      setSelectedRoomIds([]);
    } else {
      setSelectedRoomIds(rooms.map(r => r.id));
    }
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Room Management</h1>
          <p className="text-slate-500 text-sm mt-0.5">Control room occupancy, monitor virtual sensors and device states</p>
        </div>

        {/* Global Bulk Control Actions */}
        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={() => handleBulkOccupancy(true, true)}
            disabled={loadingAction === 'enter-all'}
            className="flex items-center gap-1.5 px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-semibold shadow-xs transition-all disabled:opacity-50"
          >
            <Users size={14} />
            {loadingAction === 'enter-all' ? 'Entering All...' : 'Enter All Rooms'}
          </button>
          <button
            onClick={() => handleBulkOccupancy(false, true)}
            disabled={loadingAction === 'leave-all'}
            className="flex items-center gap-1.5 px-3.5 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-lg text-xs font-semibold shadow-xs transition-all disabled:opacity-50"
          >
            <UserMinus size={14} />
            {loadingAction === 'leave-all' ? 'Leaving All...' : 'Leave All Rooms'}
          </button>
          <button
            onClick={() => {
              setBulkDeviceRoomIds('all');
              setIsBulkDeviceModalOpen(true);
            }}
            className="flex items-center gap-1.5 px-3.5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-semibold shadow-xs transition-all"
          >
            <Zap size={14} />
            Configure Devices (Bulk)
          </button>
          <button
            onClick={() => {
              setMultiSelectMode(!multiSelectMode);
              if (multiSelectMode) setSelectedRoomIds([]);
            }}
            className={`flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-semibold transition-all border ${
              multiSelectMode
                ? 'bg-blue-50 text-blue-700 border-blue-300 shadow-xs'
                : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50'
            }`}
          >
            <CheckSquare size={14} />
            {multiSelectMode ? 'Cancel Multi-Select' : 'Select Multiple'}
          </button>
        </div>
      </div>

      {/* Multi-Select Action Toolbar */}
      {multiSelectMode && (
        <div className="bg-blue-50/80 border border-blue-200 rounded-xl p-4 flex flex-wrap items-center justify-between gap-3 animate-fade-in">
          <div className="flex items-center gap-3">
            <button
              onClick={selectAllRooms}
              className="flex items-center gap-1.5 text-xs font-semibold text-blue-700 hover:underline"
            >
              {selectedRoomIds.length === rooms.length ? <CheckSquare size={14} /> : <Square size={14} />}
              {selectedRoomIds.length === rooms.length ? 'Deselect All' : 'Select All 20 Rooms'}
            </button>
            <span className="text-xs font-medium text-slate-600">
              ({selectedRoomIds.length} rooms selected)
            </span>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => handleBulkOccupancy(true, false)}
              disabled={selectedRoomIds.length === 0 || loadingAction === 'enter-selected'}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 text-white rounded-md text-xs font-medium shadow-xs disabled:opacity-40"
            >
              <Users size={13} />
              Enter Selected ({selectedRoomIds.length})
            </button>
            <button
              onClick={() => handleBulkOccupancy(false, false)}
              disabled={selectedRoomIds.length === 0 || loadingAction === 'leave-selected'}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-rose-600 text-white rounded-md text-xs font-medium shadow-xs disabled:opacity-40"
            >
              <UserMinus size={13} />
              Leave Selected ({selectedRoomIds.length})
            </button>
          </div>
        </div>
      )}

      {/* Stats Summary Bar */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
        <div className="px-4 py-3 bg-white rounded-xl border border-slate-200 shadow-2xs">
          <p className="text-xs font-medium text-slate-500">Total Rooms</p>
          <p className="text-xl font-bold text-slate-900 mt-0.5">{rooms.length}</p>
        </div>
        <div className="px-4 py-3 bg-emerald-50/60 rounded-xl border border-emerald-200/80 shadow-2xs">
          <p className="text-xs font-semibold text-emerald-800">Occupied Rooms</p>
          <p className="text-xl font-bold text-emerald-700 mt-0.5">{rooms.filter(r => r.occupancy).length}</p>
        </div>
        <div className="px-4 py-3 bg-slate-100/70 rounded-xl border border-slate-200 shadow-2xs">
          <p className="text-xs font-medium text-slate-600">Empty Rooms</p>
          <p className="text-xl font-bold text-slate-700 mt-0.5">{rooms.filter(r => !r.occupancy).length}</p>
        </div>
        <div className="px-4 py-3 bg-blue-50/60 rounded-xl border border-blue-200/80 shadow-2xs">
          <p className="text-xs font-semibold text-blue-800">Total Power Draw</p>
          <p className="text-xl font-bold text-blue-700 mt-0.5 font-mono">
            {(rooms.reduce((sum, r) => sum + (r.currentPower || 0), 0) / 1000).toFixed(2)} kW
          </p>
        </div>
      </div>

      {/* Floor 1 */}
      <div>
        <h2 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3">Floor 1</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {floor1.map(room => (
            <RoomCard
              key={room.id}
              room={room}
              multiSelectMode={multiSelectMode}
              isSelected={selectedRoomIds.includes(room.id)}
              onToggleSelect={(e) => toggleSelectRoom(room.id, e)}
              onClick={() => navigate(`/rooms/${room.id}`)}
            />
          ))}
        </div>
      </div>

      {/* Floor 2 */}
      <div>
        <h2 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3">Floor 2</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {floor2.map(room => (
            <RoomCard
              key={room.id}
              room={room}
              multiSelectMode={multiSelectMode}
              isSelected={selectedRoomIds.includes(room.id)}
              onToggleSelect={(e) => toggleSelectRoom(room.id, e)}
              onClick={() => navigate(`/rooms/${room.id}`)}
            />
          ))}
        </div>
      </div>

      <BulkDeviceModal 
        isOpen={isBulkDeviceModalOpen}
        onClose={() => setIsBulkDeviceModalOpen(false)}
        initialRoomIds={bulkDeviceRoomIds}
      />
    </div>
  );
}

function RoomCard({ room, multiSelectMode, isSelected, onToggleSelect, onClick }: {
  room: any; multiSelectMode: boolean; isSelected: boolean; onToggleSelect: (e: React.MouseEvent) => void; onClick: () => void;
}) {
  const typeColor = ROOM_TYPE_COLORS[room.type as RoomType] || '#2563eb';
  const devicesOn = room.devices?.filter((d: any) => d.status).length || 0;
  const power = ((room.currentPower || 0) / 1000).toFixed(2);

  return (
    <div
      onClick={multiSelectMode ? onToggleSelect : onClick}
      className={`relative p-5 rounded-xl border text-left transition-all duration-200 cursor-pointer shadow-2xs hover:shadow-md ${
        isSelected
          ? 'bg-blue-50/90 border-blue-400 ring-2 ring-blue-400/30'
          : room.occupancy
          ? 'bg-white border-emerald-300 hover:border-emerald-400'
          : 'bg-white border-slate-200 hover:border-slate-300'
      }`}
    >
      {/* Checkbox or Status indicator */}
      <div className="absolute top-4 right-4 flex items-center gap-2">
        {multiSelectMode ? (
          <div className="text-blue-600">
            {isSelected ? <CheckSquare size={18} /> : <Square size={18} className="text-slate-400" />}
          </div>
        ) : (
          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold ${
            room.occupancy ? 'bg-emerald-100 text-emerald-800 border border-emerald-200' : 'bg-slate-100 text-slate-500 border border-slate-200'
          }`}>
            <span className={`w-1.5 h-1.5 rounded-full ${room.occupancy ? 'bg-emerald-600' : 'bg-slate-400'}`} />
            {room.occupancy ? 'Occupied' : 'Empty'}
          </span>
        )}
      </div>

      {/* Room name and type */}
      <div className="mb-3 pr-16">
        <h3 className="text-base font-bold text-slate-900 group-hover:text-blue-600 transition-colors">{room.name}</h3>
        <p className="text-xs font-semibold mt-0.5" style={{ color: typeColor }}>
          {ROOM_TYPE_LABELS[room.type as RoomType] || room.type}
        </p>
      </div>

      {/* Sensors */}
      <div className="grid grid-cols-2 gap-2 mb-3 pt-1 border-t border-slate-100">
        <div className="flex items-center gap-1.5 text-xs text-slate-600">
          <Thermometer size={13} className="text-orange-500" />
          <span>{room.temperature}°C</span>
        </div>
        <div className="flex items-center gap-1.5 text-xs text-slate-600">
          <Sun size={13} className="text-amber-500" />
          <span>{room.light_level}%</span>
        </div>
        <div className="flex items-center gap-1.5 text-xs text-slate-600">
          <Power size={13} className="text-blue-500" />
          <span>{devicesOn} ON</span>
        </div>
        <div className="flex items-center gap-1.5 text-xs text-slate-600 font-mono">
          <Zap size={13} className="text-emerald-500" />
          <span>{power} kW</span>
        </div>
      </div>

      {/* Footer bar */}
      <div className="flex items-center justify-between pt-2.5 border-t border-slate-100 text-xs">
        <span className="text-slate-400 text-[11px]">Floor {room.floor}</span>
        <span className="text-emerald-600 font-semibold text-[11px]">
          Smart Automated
        </span>
      </div>
    </div>
  );
}
