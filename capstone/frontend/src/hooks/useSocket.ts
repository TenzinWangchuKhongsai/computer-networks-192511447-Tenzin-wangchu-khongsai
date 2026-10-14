import { useEffect, useRef } from 'react';
import { getSocket } from '../services/socket';
import { useAppStore } from '../store/appStore';
import type { Room, Device, SystemEvent, EnergySummary, SimulationStatus } from '../types';

export function useSocket() {
  const initialized = useRef(false);
  const {
    setConnected,
    setFullState,
    updateRoom,
    updateRoomDevices,
    setEnergy,
    setSimulation,
    addEvent,
  } = useAppStore();

  useEffect(() => {
    if (initialized.current) return;
    initialized.current = true;

    const socket = getSocket();

    socket.on('connect', () => {
      setConnected(true);
      socket.emit('request-state');
    });

    socket.on('disconnect', () => {
      setConnected(false);
    });

    // Full state update
    socket.on('full-state', (data: {
      rooms: Room[];
      devices: Device[];
      sensors: any[];
      energy: EnergySummary;
      simulation?: SimulationStatus;
      realDevices?: any[];
      cctvSources?: any[];
      unifiedEnergy?: any;
    }) => {
      setFullState({
        rooms: data.rooms,
        devices: data.devices,
        sensors: data.sensors,
        energy: data.energy,
        simulation: data.simulation,
        realDevices: data.realDevices,
        cctvSources: data.cctvSources,
        unifiedEnergy: data.unifiedEnergy
      });
    });

    // Individual updates
    socket.on('room-update', (data: { roomId: number; room?: Room; changes?: Partial<Room> }) => {
      if (data.room) {
        updateRoom(data.roomId, data.room);
      } else if (data.changes) {
        updateRoom(data.roomId, data.changes);
      }
    });

    socket.on('device-update', (data: { roomId: number; devices: Device[] }) => {
      updateRoomDevices(data.roomId, data.devices);
    });

    socket.on('sensor-update', (data: { roomId: number; type: string; value: number }) => {
      // Sensors are embedded in rooms, handled by room-update
    });

    socket.on('energy-update', (data: EnergySummary) => {
      setEnergy(data);
    });

    socket.on('simulation-status', (data: SimulationStatus) => {
      setSimulation(data);
    });

    socket.on('event-new', (data: SystemEvent) => {
      addEvent(data);
    });

    // Real-World IoT Socket Listeners
    socket.on('real-device-update', (device) => {
      useAppStore.getState().updateRealDevice(device);
    });

    socket.on('real-device-deleted', (data: { id: number }) => {
      useAppStore.getState().removeRealDevice(data.id);
    });

    socket.on('cctv-source-update', (source) => {
      useAppStore.getState().updateCctvSource(source);
    });

    socket.on('cctv-source-deleted', (data: { id: number }) => {
      useAppStore.getState().removeCctvSource(data.id);
    });

    socket.on('command-new', (command) => {
      useAppStore.getState().addDeviceCommand(command);
    });

    socket.on('command-update', (data: { id: string; status: any; attempts: number; completedAt?: string; error?: string }) => {
      useAppStore.getState().updateDeviceCommand(data.id, data);
    });

    socket.on('occupancy-update', (data: { roomId: number; state: any; source: any }) => {
      useAppStore.getState().updateOccupancyState(data.roomId, data);
    });

    return () => {
      // Don't disconnect on component unmount — keep socket alive
    };
  }, []);
}
