import { useEffect, useRef, useState, useCallback } from 'react';
import { useAppStore } from '../store/appStore';
import {
  setOccupancy, postOccupancyDetection, reportCameraFailure,
  fetchCctvSources, createCctvSource, deleteCctvSource, testCctvConnection,
  updateFailSafeSettings
} from '../services/api';
import { detectPersons, drawBoundingBoxes, loadCocoModel } from '../services/cocoDetection';
import type { DetectionResult, CameraLogEvent, OccupancySource, CCTVSource } from '../types';
import {
  Camera, CameraOff, RefreshCw, FlipHorizontal, Maximize, Play, AlertTriangle,
  Lightbulb, ShieldCheck, Cpu, Sliders, Activity, Info, Users, UserX, Zap,
  DoorOpen, Video, Plus, CheckCircle2, XCircle, Trash2, Eye, EyeOff
} from 'lucide-react';

export default function LiveCamera() {
  const {
    rooms,
    occupancySource,
    setOccupancySource,
    cameraState,
    updateCameraState,
    cameraSettings,
    updateCameraSettings,
    cameraLogs,
    addCameraLog,
    cctvSources,
    setCctvSources,
    updateCctvSource,
    removeCctvSource,
    failsafePolicy,
    setFailsafePolicy,
    addNotification
  } = useAppStore();

  // Refs for Video & Canvas
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const cctvImgRef = useRef<HTMLImageElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const animFrameId = useRef<number | null>(null);
  const lastDetectionTimeRef = useRef<number>(0);

  // Local state
  const [deviceList, setDeviceList] = useState<MediaDeviceInfo[]>([]);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [videoResolution, setVideoResolution] = useState<{ width: number; height: number }>({ width: 0, height: 0 });
  const [showSettings, setShowSettings] = useState(false);
  const [showCctvModal, setShowCctvModal] = useState(false);
  const [testingCctv, setTestingCctv] = useState(false);
  const [cctvTestResult, setCctvTestResult] = useState<{ success: boolean; status: string; latencyMs?: number; message?: string } | null>(null);

  // CCTV Form State
  const [cctvForm, setCctvForm] = useState({
    name: '',
    type: 'rtsp' as 'rtsp' | 'http_snapshot' | 'mjpeg' | 'onvif',
    ip_address: '',
    port: 554,
    stream_url: '',
    username: '',
    password: '',
    protocol: 'rtsp',
    confidence_threshold: 0.60,
    room_id: rooms[0]?.id || 1
  });

  // Selected Room
  const targetRoom = rooms.find(r => r.id === cameraState.selectedRoomId) || rooms[0] || {
    id: 1, name: 'Room 01', occupancy: 0, temperature: 24, light_level: 80
  };

  // Selected CCTV Source
  const selectedCctv = cctvSources.find(c => c.id === cameraState.selectedCctvId) || cctvSources[0];

  // Enumerate camera devices
  const fetchCameraDevices = useCallback(async () => {
    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.enumerateDevices) return;
      const devices = await navigator.mediaDevices.enumerateDevices();
      const videoDevices = devices.filter(d => d.kind === 'videoinput');
      setDeviceList(videoDevices);
      updateCameraState({
        devices: videoDevices.map(d => ({ deviceId: d.deviceId, label: d.label || `Camera ${d.deviceId.slice(0, 5)}...` }))
      });
      if (videoDevices.length > 0 && !cameraState.selectedDeviceId) {
        updateCameraState({ selectedDeviceId: videoDevices[0].deviceId });
      }
    } catch (err) {
      console.warn('Failed to enumerate media devices:', err);
    }
  }, [cameraState.selectedDeviceId, updateCameraState]);

  useEffect(() => {
    fetchCameraDevices();
    fetchCctvSources().then(res => setCctvSources(res)).catch(() => {});
  }, [fetchCameraDevices, setCctvSources]);

  // Handle Model pre-loading
  useEffect(() => {
    let mounted = true;
    updateCameraState({ modelStatus: 'loading' });
    loadCocoModel()
      .then(() => {
        if (mounted) updateCameraState({ modelStatus: 'ready' });
      })
      .catch((err) => {
        console.error('Model initialization error:', err);
        if (mounted) {
          updateCameraState({
            modelStatus: 'error',
            errorMessage: 'Real COCO-SSD detection model could not be loaded. Check internet connection.'
          });
        }
      });
    return () => {
      mounted = false;
    };
  }, [updateCameraState]);

  // Safe camera stop function
  const stopCameraStream = useCallback(() => {
    if (animFrameId.current) {
      cancelAnimationFrame(animFrameId.current);
      animFrameId.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }

    updateCameraState({
      active: false,
      status: 'stopped',
      peopleCount: 0,
      maxConfidence: 0,
      lightStatus: false,
      consecutivePositiveFrames: 0,
      consecutiveNegativeFrames: 0,
    });

    // Notify backend of stream stoppage and invoke fail-safe
    if (occupancySource !== 'simulation' && targetRoom?.id) {
      reportCameraFailure(targetRoom.id, {
        source: occupancySource,
        sourceName: occupancySource === 'cctv' ? selectedCctv?.name : 'Webcam'
      }).catch(() => {});
    }

    addCameraLog({
      timestamp: new Date().toLocaleTimeString(),
      type: 'camera_stopped',
      message: 'Camera stream halted. Centralized Fail-Safe behavior evaluated (Devices safely secured).',
      lightState: false,
      peopleCount: 0,
    });
  }, [addCameraLog, occupancySource, targetRoom?.id, updateCameraState, selectedCctv?.name]);

  // Start Camera Stream
  const startCameraStream = useCallback(async (deviceIdToUse?: string) => {
    updateCameraState({ status: 'requesting', errorMessage: undefined });
    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error('Camera access API (getUserMedia) is not supported in this browser.');
      }

      const selectedId = deviceIdToUse || cameraState.selectedDeviceId;
      const constraints: MediaStreamConstraints = {
        video: selectedId ? { deviceId: { exact: selectedId } } : { facingMode: 'user' },
        audio: false,
      };

      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      streamRef.current = stream;

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
        setVideoResolution({
          width: videoRef.current.videoWidth || 640,
          height: videoRef.current.videoHeight || 480,
        });
      }

      updateCameraState({
        active: true,
        status: 'live',
        selectedDeviceId: selectedId || '',
      });

      addCameraLog({
        timestamp: new Date().toLocaleTimeString(),
        type: 'camera_started',
        message: 'Local webcam stream online. Human detection pipeline active.',
      });

      fetchCameraDevices();
    } catch (err: any) {
      console.error('Camera access error:', err);
      let msg = 'Failed to access camera stream.';
      let newStatus: 'denied' | 'error' = 'error';

      if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
        msg = 'CAMERA ACCESS DENIED. Please allow camera permissions in your browser.';
        newStatus = 'denied';
      } else if (err.name === 'NotFoundError' || err.name === 'DevicesNotFoundError') {
        msg = 'NO CAMERA AVAILABLE. No webcam found on this system.';
      } else if (err.name === 'NotReadableError' || err.name === 'TrackStartError') {
        msg = 'CAMERA IN USE. The webcam is currently being used by another application.';
      }

      updateCameraState({
        active: false,
        status: newStatus,
        errorMessage: msg,
      });

      // Report failure to backend occupancy engine
      if (targetRoom?.id) {
        reportCameraFailure(targetRoom.id, { source: 'webcam', sourceName: 'Webcam' }).catch(() => {});
      }

      addCameraLog({
        timestamp: new Date().toLocaleTimeString(),
        type: 'error',
        message: msg,
      });
    }
  }, [addCameraLog, cameraState.selectedDeviceId, fetchCameraDevices, targetRoom?.id, updateCameraState]);

  // Main Detection Loop
  useEffect(() => {
    if (!cameraState.active || cameraState.status !== 'live') return;

    let isRunning = true;
    let localPosCount = cameraState.consecutivePositiveFrames;
    let localNegCount = cameraState.consecutiveNegativeFrames;
    let currentLightState = cameraState.lightStatus;

    const runFrame = async (timestamp: number) => {
      if (!isRunning) return;

      const video = videoRef.current;
      const canvas = canvasRef.current;

      // Throttle detection to ~180ms intervals
      if (video && video.readyState >= 2 && timestamp - lastDetectionTimeRef.current >= 180) {
        lastDetectionTimeRef.current = timestamp;

        try {
          const minConf = cameraSettings.minConfidence;
          const detections: DetectionResult[] = await detectPersons(video, minConf);

          if (canvas) {
            drawBoundingBoxes(canvas, video, detections, cameraState.mirrored);
          }

          const count = detections.length;
          const maxConf = count > 0 ? Math.max(...detections.map(d => d.score)) : 0;
          const hasPerson = count > 0;

          if (hasPerson) {
            localPosCount += 1;
            localNegCount = 0;
          } else {
            localNegCount += 1;
            localPosCount = 0;
          }

          let nextLightState = currentLightState;

          // Transition to OCCUPIED after frameBufferOn positive detections
          if (localPosCount >= cameraSettings.frameBufferOn && !currentLightState) {
            nextLightState = true;
            currentLightState = true;

            addCameraLog({
              timestamp: new Date().toLocaleTimeString(),
              type: 'person_entered',
              message: `Human detected (${count} ${count === 1 ? 'person' : 'people'}, ${Math.round(maxConf * 100)}% conf). Occupancy transitioned to OCCUPIED.`,
              peopleCount: count,
              confidence: maxConf,
              lightState: true,
            });

            // Synchronize with centralized Backend Occupancy Engine
            if (targetRoom?.id && occupancySource !== 'simulation') {
              postOccupancyDetection(targetRoom.id, {
                source: occupancySource === 'cctv' ? 'cctv' : 'webcam',
                cctvSourceId: selectedCctv?.id,
                sourceName: occupancySource === 'cctv' ? selectedCctv?.name : 'Webcam',
                personDetected: true,
                confidence: maxConf,
                personCount: count
              }).catch(() => {});
            }
          }
          // Transition to VACANT after frameBufferOff negative detections
          else if (localNegCount >= cameraSettings.frameBufferOff && currentLightState) {
            nextLightState = false;
            currentLightState = false;

            addCameraLog({
              timestamp: new Date().toLocaleTimeString(),
              type: 'person_left',
              message: 'No human detected for stability window. Occupancy transitioned to VACANT.',
              peopleCount: 0,
              confidence: 0,
              lightState: false,
            });

            // Synchronize with centralized Backend Occupancy Engine
            if (targetRoom?.id && occupancySource !== 'simulation') {
              postOccupancyDetection(targetRoom.id, {
                source: occupancySource === 'cctv' ? 'cctv' : 'webcam',
                cctvSourceId: selectedCctv?.id,
                sourceName: occupancySource === 'cctv' ? selectedCctv?.name : 'Webcam',
                personDetected: false,
                confidence: 0,
                personCount: 0
              }).catch(() => {});
            }
          }

          updateCameraState({
            peopleCount: count,
            maxConfidence: maxConf,
            lightStatus: nextLightState,
            consecutivePositiveFrames: localPosCount,
            consecutiveNegativeFrames: localNegCount,
          });

        } catch (err: any) {
          console.error('Detection loop error:', err);
        }
      }

      if (isRunning) {
        animFrameId.current = requestAnimationFrame(runFrame);
      }
    };

    animFrameId.current = requestAnimationFrame(runFrame);

    return () => {
      isRunning = false;
      if (animFrameId.current) {
        cancelAnimationFrame(animFrameId.current);
      }
    };
  }, [
    cameraState.active,
    cameraState.status,
    cameraState.mirrored,
    cameraState.consecutivePositiveFrames,
    cameraState.consecutiveNegativeFrames,
    cameraState.lightStatus,
    cameraSettings.minConfidence,
    cameraSettings.frameBufferOn,
    cameraSettings.frameBufferOff,
    addCameraLog,
    occupancySource,
    selectedCctv?.id,
    selectedCctv?.name,
    targetRoom?.id,
    updateCameraState,
  ]);

  // Handle Fail-Safe Policy Switch
  const handleFailSafeToggle = async (policy: 'turn_off' | 'keep_state') => {
    try {
      await updateFailSafeSettings({ policy });
      setFailsafePolicy(policy);
      addNotification({
        id: 'fs-' + Date.now(),
        type: 'info',
        message: `Camera fail-safe behavior updated: ${policy === 'turn_off' ? 'Turn Devices OFF' : 'Keep Current State'}`,
        timestamp: Date.now()
      });
    } catch (err: any) {
      console.error('Failed to update fail-safe setting:', err);
    }
  };

  // Test CCTV Source Connection
  const handleTestCctv = async () => {
    setTestingCctv(true);
    setCctvTestResult(null);
    try {
      const res = await testCctvConnection(cctvForm);
      setCctvTestResult(res);
    } catch (err: any) {
      setCctvTestResult({
        success: false,
        status: 'error',
        message: err.response?.data?.error || err.message
      });
    } finally {
      setTestingCctv(false);
    }
  };

  // Save CCTV Source
  const handleSaveCctv = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const created = await createCctvSource(cctvForm);
      updateCctvSource(created);
      setShowCctvModal(false);
      setCctvTestResult(null);
      setCctvForm({
        name: '',
        type: 'rtsp',
        ip_address: '',
        port: 554,
        stream_url: '',
        username: '',
        password: '',
        protocol: 'rtsp',
        confidence_threshold: 0.60,
        room_id: rooms[0]?.id || 1
      });
      addNotification({
        id: 'cctv-' + Date.now(),
        type: 'success',
        message: `CCTV Camera '${created.name}' registered.`,
        timestamp: Date.now()
      });
    } catch (err: any) {
      alert(`Failed to save CCTV: ${err.response?.data?.error || err.message}`);
    }
  };

  const handleDeleteCctv = async (id: number, name: string) => {
    if (!confirm(`Delete CCTV source '${name}'?`)) return;
    try {
      await deleteCctvSource(id);
      removeCctvSource(id);
    } catch (err: any) {
      alert(`Delete failed: ${err.message}`);
    }
  };

  return (
    <div className="space-y-6">
      {/* Page Title & Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Live Camera & CCTV Detection</h1>
          <p className="text-slate-500 text-sm mt-0.5">
            Real-time human detection driving room occupancy states and automated IoT commands
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowCctvModal(true)}
            className="flex items-center gap-2 px-3 py-2 rounded-lg bg-white border border-slate-300 text-slate-700 hover:bg-slate-50 text-xs font-bold transition-colors"
          >
            <Plus size={14} />
            + Configure CCTV
          </button>
        </div>
      </div>

      {/* 3-WAY OCCUPANCY SOURCE SWITCHER (Phase 17) */}
      <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-2xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider block">
              Occupancy Decision Input Source (Phase 17)
            </span>
            <p className="text-sm font-semibold text-slate-800">
              Select which live pipeline controls the office occupancy engine
            </p>
          </div>

          <div className="inline-flex rounded-xl p-1 bg-slate-100 border border-slate-200">
            <button
              onClick={() => setOccupancySource('simulation')}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition-all ${
                occupancySource === 'simulation'
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Cpu size={14} />
              Simulation Engine
            </button>

            <button
              onClick={() => setOccupancySource('camera')}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition-all ${
                occupancySource === 'camera' || occupancySource === 'webcam'
                  ? 'bg-emerald-600 text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Camera size={14} />
              Laptop Webcam (Local)
            </button>

            <button
              onClick={() => setOccupancySource('cctv')}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition-all ${
                occupancySource === 'cctv'
                  ? 'bg-indigo-600 text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Video size={14} />
              Network CCTV / IP Camera
            </button>
          </div>
        </div>

        {/* Informative source description */}
        <div className="mt-3 pt-3 border-t border-slate-100 flex flex-wrap items-center justify-between gap-2 text-xs">
          <div className="flex items-center gap-2 text-slate-600">
            <Info size={14} className="text-blue-600" />
            <span>
              Active Source:{' '}
              <strong className="text-slate-900">
                {occupancySource === 'simulation' ? 'Software Virtual Simulation (Sensors & Schedule)' :
                 occupancySource === 'cctv' ? 'Network CCTV IP Camera (Backend Gateway / Gateway RTSP)' :
                 'Local Laptop Webcam (In-Browser COCO-SSD)'}
              </strong>
            </span>
          </div>

          {/* Privacy Notice Badge (Phase 18) */}
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-slate-100 text-slate-700 font-medium text-[11px]">
            <ShieldCheck size={13} className="text-emerald-600" />
            <span>Local In-Browser Inference • No Video Upload • Zero Footprint</span>
          </div>
        </div>
      </div>

      {/* Target Room & Fail-Safe Selector */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Room Binding */}
        <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-2xs flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-lg bg-blue-50 text-blue-700">
              <DoorOpen size={20} />
            </div>
            <div>
              <p className="text-xs font-bold text-slate-500 uppercase">Controlled Target Room</p>
              <p className="text-sm font-bold text-slate-900">{targetRoom.name}</p>
            </div>
          </div>

          <select
            value={cameraState.selectedRoomId}
            onChange={(e) => updateCameraState({ selectedRoomId: parseInt(e.target.value) })}
            className="px-3 py-1.5 rounded-lg border border-slate-300 text-xs font-semibold"
          >
            {rooms.map(r => (
              <option key={r.id} value={r.id}>{r.name} (Floor {r.floor})</option>
            ))}
          </select>
        </div>

        {/* Safety / Fail-Safe Behavior Widget (Phase 12) */}
        <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-2xs flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className={`p-2.5 rounded-lg ${
              failsafePolicy === 'turn_off' ? 'bg-amber-50 text-amber-700' : 'bg-slate-100 text-slate-700'
            }`}>
              <AlertTriangle size={20} />
            </div>
            <div>
              <p className="text-xs font-bold text-slate-500 uppercase">Camera Failure Fail-Safe Policy (Phase 12)</p>
              <p className="text-xs font-medium text-slate-600">
                Action when stream disconnects: <strong className="text-slate-900">{failsafePolicy === 'turn_off' ? 'Turn Devices OFF (Safe Default)' : 'Keep Current State'}</strong>
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1 bg-slate-100 p-0.5 rounded-lg border border-slate-200 text-xs">
            <button
              onClick={() => handleFailSafeToggle('turn_off')}
              className={`px-2.5 py-1 rounded-md font-bold transition-colors ${
                failsafePolicy === 'turn_off'
                  ? 'bg-amber-600 text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Turn OFF
            </button>
            <button
              onClick={() => handleFailSafeToggle('keep_state')}
              className={`px-2.5 py-1 rounded-md font-bold transition-colors ${
                failsafePolicy === 'keep_state'
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Keep State
            </button>
          </div>
        </div>
      </div>

      {/* Main View Area: Video Stream / CCTV Viewer / Simulation Panel */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: Video & Detection Canvas Viewport */}
        <div className="lg:col-span-2 space-y-4">
          <div className="bg-slate-900 rounded-2xl overflow-hidden border border-slate-800 shadow-md relative aspect-video flex items-center justify-center">
            {/* Live Video Element for Webcam */}
            <video
              ref={videoRef}
              playsInline
              muted
              className={`w-full h-full object-cover ${cameraState.mirrored ? 'scale-x-[-1]' : ''} ${
                cameraState.active ? 'block' : 'hidden'
              }`}
            />

            {/* Bounding Box Overlay Canvas */}
            <canvas
              ref={canvasRef}
              className={`absolute inset-0 w-full h-full pointer-events-none ${
                cameraState.active ? 'block' : 'hidden'
              }`}
            />

            {/* Placeholder when Camera is stopped or simulation active */}
            {!cameraState.active && (
              <div className="text-center p-8 max-w-sm">
                <div className="w-16 h-16 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center mx-auto mb-4 text-slate-400">
                  {occupancySource === 'cctv' ? <Video size={28} /> : <Camera size={28} />}
                </div>
                <h3 className="text-base font-bold text-white mb-1">
                  {occupancySource === 'cctv' ? 'Network CCTV Viewport' :
                   occupancySource === 'simulation' ? 'Simulation Mode Active' :
                   'Local Webcam Offline'}
                </h3>
                <p className="text-xs text-slate-400 mb-4">
                  {occupancySource === 'simulation'
                    ? 'Occupancy transitions are governed by the simulation clock and virtual sensor schedule.'
                    : occupancySource === 'cctv'
                    ? (selectedCctv ? `Ready to connect CCTV stream: ${selectedCctv.name}` : 'No CCTV sources registered yet. Add one via Configure CCTV.')
                    : 'Click "Start Camera" to access your webcam and begin live human detection.'}
                </p>

                {occupancySource !== 'simulation' && (
                  <button
                    onClick={() => startCameraStream()}
                    disabled={cameraState.status === 'requesting'}
                    className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold shadow-md transition-colors"
                  >
                    <Play size={14} />
                    {cameraState.status === 'requesting' ? 'Requesting Stream...' : 'Start Camera Stream'}
                  </button>
                )}
              </div>
            )}

            {/* Live HUD Overlay */}
            {cameraState.active && (
              <div className="absolute top-3 left-3 right-3 flex items-center justify-between pointer-events-none text-xs">
                <div className="flex items-center gap-2 bg-slate-900/80 backdrop-blur-md px-3 py-1.5 rounded-lg border border-slate-700/80 text-white font-mono">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
                  <span className="font-bold">LIVE STREAM</span>
                  <span className="text-slate-400">•</span>
                  <span>{videoResolution.width}×{videoResolution.height}</span>
                </div>

                <div className="flex items-center gap-2 bg-slate-900/80 backdrop-blur-md px-3 py-1.5 rounded-lg border border-slate-700/80 text-white font-mono">
                  <span className="font-bold text-emerald-400">{cameraState.peopleCount} PERSON DETECTED</span>
                  <span className="text-slate-400">({Math.round(cameraState.maxConfidence * 100)}%)</span>
                </div>
              </div>
            )}
          </div>

          {/* Camera Controls Bar */}
          <div className="bg-white rounded-xl border border-slate-200 p-3.5 shadow-2xs flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              {cameraState.active ? (
                <button
                  onClick={stopCameraStream}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-red-600 hover:bg-red-700 text-white text-xs font-bold transition-colors"
                >
                  <CameraOff size={14} />
                  Stop Camera
                </button>
              ) : (
                <button
                  onClick={() => startCameraStream()}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold transition-colors"
                >
                  <Play size={14} />
                  Start Camera
                </button>
              )}

              <button
                onClick={() => updateCameraState({ mirrored: !cameraState.mirrored })}
                className="flex items-center gap-1.5 px-3 py-2 rounded-lg border border-slate-200 text-slate-700 hover:bg-slate-50 text-xs font-semibold"
                title="Flip Video Mirror"
              >
                <FlipHorizontal size={14} />
                Mirror
              </button>
            </div>

            {/* Webcam Device Selector */}
            <div className="flex items-center gap-2 text-xs">
              <span className="font-bold text-slate-500">Camera Device:</span>
              <select
                value={cameraState.selectedDeviceId}
                onChange={(e) => {
                  updateCameraState({ selectedDeviceId: e.target.value });
                  if (cameraState.active) startCameraStream(e.target.value);
                }}
                className="px-2.5 py-1.5 rounded-lg border border-slate-300 text-xs font-semibold max-w-xs"
              >
                {deviceList.map(d => (
                  <option key={d.deviceId} value={d.deviceId}>{d.label || 'Default Camera'}</option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Right: State Diagnostics & CCTV Sources List */}
        <div className="space-y-4">
          {/* Real-time Occupancy & IoT Actuator Status */}
          <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-2xs space-y-3">
            <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider">
              Occupancy Pipeline State (Phase 4 & 5)
            </h3>

            <div className={`p-4 rounded-xl border flex items-center justify-between ${
              targetRoom.occupancy
                ? 'bg-emerald-50 border-emerald-200 text-emerald-950'
                : 'bg-slate-50 border-slate-200 text-slate-800'
            }`}>
              <div className="flex items-center gap-3">
                <div className={`p-2.5 rounded-full ${
                  targetRoom.occupancy ? 'bg-emerald-600 text-white' : 'bg-slate-200 text-slate-600'
                }`}>
                  {targetRoom.occupancy ? <Users size={20} /> : <UserX size={20} />}
                </div>
                <div>
                  <p className="text-xs font-bold text-slate-500 uppercase">Room Occupancy State</p>
                  <p className="text-lg font-extrabold">
                    {targetRoom.occupancy ? '🟢 OCCUPIED' : '⚪ VACANT'}
                  </p>
                </div>
              </div>
            </div>

            {/* Stability Buffer Visualizer (Phase 4) */}
            <div className="p-3 bg-slate-50 rounded-lg border border-slate-200 text-xs space-y-2">
              <div className="flex justify-between text-slate-600 font-semibold">
                <span>Stability Verification:</span>
                <span>
                  {cameraState.peopleCount > 0
                    ? `${cameraState.consecutivePositiveFrames} / ${cameraSettings.frameBufferOn} frames (Trigger ON)`
                    : `${cameraState.consecutiveNegativeFrames} / ${cameraSettings.frameBufferOff} frames (Trigger OFF)`
                  }
                </span>
              </div>
              <div className="w-full h-2 rounded-full bg-slate-200 overflow-hidden">
                <div
                  className={`h-full transition-all duration-300 ${
                    cameraState.peopleCount > 0 ? 'bg-emerald-500' : 'bg-slate-400'
                  }`}
                  style={{
                    width: `${
                      cameraState.peopleCount > 0
                        ? Math.min(100, (cameraState.consecutivePositiveFrames / cameraSettings.frameBufferOn) * 100)
                        : Math.min(100, (cameraState.consecutiveNegativeFrames / cameraSettings.frameBufferOff) * 100)
                    }%`
                  }}
                />
              </div>
              <p className="text-[10px] text-slate-400">
                Prevents flicker: 3 positive detections confirm presence; 5 negative frames confirm exit.
              </p>
            </div>
          </div>

          {/* Network CCTV Cameras List (Phase 2 & 3) */}
          <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-2xs space-y-3">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                Network CCTV / IP Cameras
              </h3>
              <span className="text-[11px] font-bold text-blue-600">{cctvSources.length} registered</span>
            </div>

            {cctvSources.length === 0 ? (
              <p className="text-xs text-slate-400 py-2 text-center">
                No IP cameras configured. Click "+ Configure CCTV" to add RTSP / HTTP feeds.
              </p>
            ) : (
              <div className="space-y-2">
                {cctvSources.map(cam => (
                  <div
                    key={cam.id}
                    className={`p-3 rounded-lg border text-xs flex items-center justify-between ${
                      cameraState.selectedCctvId === cam.id
                        ? 'bg-indigo-50/70 border-indigo-200'
                        : 'bg-white border-slate-200'
                    }`}
                  >
                    <div>
                      <div className="flex items-center gap-1.5 font-bold text-slate-900">
                        <Video size={13} className="text-indigo-600" />
                        <span>{cam.name}</span>
                        <span className="text-[10px] px-1.5 py-0.2 rounded bg-slate-100 text-slate-600 font-mono">
                          {cam.protocol.toUpperCase()}
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-500 mt-0.5">
                        {cam.ip_address}:{cam.port} • {cam.room_name || 'Room'}
                      </p>
                    </div>

                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => {
                          updateCameraState({ selectedCctvId: cam.id });
                          setOccupancySource('cctv');
                        }}
                        className={`px-2 py-1 rounded text-[11px] font-bold ${
                          cameraState.selectedCctvId === cam.id && occupancySource === 'cctv'
                            ? 'bg-indigo-600 text-white'
                            : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                        }`}
                      >
                        {cameraState.selectedCctvId === cam.id && occupancySource === 'cctv' ? 'Selected' : 'Use'}
                      </button>
                      <button
                        onClick={() => handleDeleteCctv(cam.id, cam.name)}
                        className="text-slate-400 hover:text-red-600 p-1"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Detection & Occupancy Event Log */}
      <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-2xs">
        <div className="flex items-center justify-between mb-3 pb-2 border-b border-slate-100">
          <div>
            <h3 className="text-sm font-bold text-slate-900">Detection & Occupancy Event Audit Log</h3>
            <p className="text-xs text-slate-500">Every human detection transition and automated command trigger</p>
          </div>
          <span className="text-xs font-semibold text-slate-500">{cameraLogs.length} events logged</span>
        </div>

        <div className="overflow-x-auto max-h-60 overflow-y-auto">
          <table className="w-full text-xs text-left">
            <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-bold sticky top-0">
              <tr>
                <th className="py-2 px-3">Timestamp</th>
                <th className="py-2 px-3">Event Type</th>
                <th className="py-2 px-3">Details / Message</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-mono">
              {cameraLogs.map(log => (
                <tr key={log.id} className="hover:bg-slate-50/50">
                  <td className="py-1.5 px-3 text-slate-500 whitespace-nowrap">{log.timestamp}</td>
                  <td className="py-1.5 px-3">
                    <span className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-bold ${
                      log.type === 'person_entered' ? 'bg-emerald-100 text-emerald-800' :
                      log.type === 'person_left' ? 'bg-slate-100 text-slate-700' :
                      log.type === 'error' ? 'bg-red-100 text-red-800' :
                      'bg-blue-100 text-blue-800'
                    }`}>
                      {log.type.replace('_', ' ').toUpperCase()}
                    </span>
                  </td>
                  <td className="py-1.5 px-3 text-slate-800 font-sans">{log.message}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* CCTV Configuration Modal (Phase 3) */}
      {showCctvModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-xl border border-slate-200 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-4">
              <h3 className="text-base font-bold text-slate-900">Add Network CCTV / IP Camera Source</h3>
              <button
                onClick={() => setShowCctvModal(false)}
                className="text-slate-400 hover:text-slate-700 text-lg font-bold"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveCctv} className="space-y-3.5 text-xs">
              <div>
                <label className="block font-bold text-slate-700 mb-1">Camera Name</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. CCTV-01 East Hallway"
                  value={cctvForm.name}
                  onChange={e => setCctvForm({ ...cctvForm, name: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Camera Type</label>
                  <select
                    value={cctvForm.type}
                    onChange={e => {
                      const t = e.target.value as any;
                      setCctvForm({
                        ...cctvForm,
                        type: t,
                        protocol: t === 'rtsp' ? 'rtsp' : 'http',
                        port: t === 'rtsp' ? 554 : 80
                      });
                    }}
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm"
                  >
                    <option value="rtsp">RTSP Stream (Port 554)</option>
                    <option value="http_snapshot">HTTP JPEG Snapshot</option>
                    <option value="mjpeg">HTTP / MJPEG Stream</option>
                    <option value="onvif">ONVIF Compatible</option>
                  </select>
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">Assigned Room</label>
                  <select
                    value={cctvForm.room_id}
                    onChange={e => setCctvForm({ ...cctvForm, room_id: parseInt(e.target.value) })}
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm"
                  >
                    {rooms.map(r => (
                      <option key={r.id} value={r.id}>{r.name}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div className="col-span-2">
                  <label className="block font-bold text-slate-700 mb-1">IP Address / Hostname</label>
                  <input
                    type="text"
                    required
                    placeholder="192.168.1.50"
                    value={cctvForm.ip_address}
                    onChange={e => setCctvForm({ ...cctvForm, ip_address: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Port</label>
                  <input
                    type="number"
                    value={cctvForm.port}
                    onChange={e => setCctvForm({ ...cctvForm, port: parseInt(e.target.value) || 554 })}
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm"
                  />
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Stream URL / Path (Optional)</label>
                <input
                  type="text"
                  placeholder="rtsp://192.168.1.50:554/live/ch0 or /snapshot.jpg"
                  value={cctvForm.stream_url}
                  onChange={e => setCctvForm({ ...cctvForm, stream_url: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Camera Username</label>
                  <input
                    type="text"
                    placeholder="admin"
                    value={cctvForm.username}
                    onChange={e => setCctvForm({ ...cctvForm, username: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">Camera Password</label>
                  <input
                    type="password"
                    placeholder="••••••••"
                    value={cctvForm.password}
                    onChange={e => setCctvForm({ ...cctvForm, password: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm"
                  />
                </div>
              </div>

              <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-200 text-[11px] text-slate-500">
                <ShieldCheck size={14} className="inline text-emerald-600 mr-1" />
                Security Guard: Camera passwords are stored exclusively on backend SQLite and are never sent back to the browser or logged in plain text.
              </div>

              {/* TEST CONNECTION Button (Phase 3) */}
              <div className="pt-2">
                <button
                  type="button"
                  onClick={handleTestCctv}
                  disabled={testingCctv}
                  className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold border border-slate-300 transition-colors"
                >
                  <RefreshCw size={14} className={testingCctv ? 'animate-spin' : ''} />
                  {testingCctv ? 'Testing Connection to IP Camera...' : 'TEST CONNECTION'}
                </button>

                {cctvTestResult && (
                  <div className={`mt-2 p-2.5 rounded-lg border text-xs flex items-start gap-2 ${
                    cctvTestResult.success
                      ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
                      : 'bg-red-50 border-red-200 text-red-900'
                  }`}>
                    {cctvTestResult.success ? (
                      <CheckCircle2 size={16} className="text-emerald-600 mt-0.5 flex-shrink-0" />
                    ) : (
                      <XCircle size={16} className="text-red-600 mt-0.5 flex-shrink-0" />
                    )}
                    <div>
                      <p className="font-bold">
                        {cctvTestResult.success ? `Connected (${cctvTestResult.latencyMs}ms)` : 'Connection Failed'}
                      </p>
                      <p className="text-[11px] opacity-90">{cctvTestResult.message}</p>
                    </div>
                  </div>
                )}
              </div>

              <div className="pt-3 border-t border-slate-200 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowCctvModal(false)}
                  className="px-4 py-2 rounded-lg border border-slate-300 text-slate-700 hover:bg-slate-100 font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-bold shadow-xs"
                >
                  SAVE CCTV CAMERA
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
