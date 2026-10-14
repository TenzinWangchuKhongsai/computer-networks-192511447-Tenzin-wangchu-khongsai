import { useEffect, useState, useCallback } from 'react';
import { Activity, CheckCircle2, RefreshCw, ShieldAlert, PowerOff, Zap, ZapOff, Camera, Cpu, Database, Server, Wifi, Radio, BarChart3, XCircle, ChevronDown, ChevronUp, Info } from 'lucide-react';

interface CctvSession { cctvId: number; name: string; status: string; streamStatus: string; detectionStatus: string; occupancyStatus: string; failCount: number; lastCheck: string | null; frameCount: number; }
interface SHealth { backend: string; database: string; cctvMonitor: string; detectionWorker: string; occupancyEngine: string; automationEngine: string; commandQueue: string; deviceManager: string; energyService: string; websocket: string; cctvMonitorCount: number; cctvSessions: CctvSession[]; settings: { automationEnabled: boolean; emergencyMode: boolean; emergencyModeSetAt?: string | null; }; uptime: number; timestamp: string; }

const sc = (s: string) => { const u=(s||'').toUpperCase(); if(['ONLINE','RUNNING','ACTIVE'].includes(u)) return 'text-emerald-600 bg-emerald-50 border-emerald-200'; if(u==='IDLE') return 'text-blue-600 bg-blue-50 border-blue-200'; if(u==='DEGRADED') return 'text-amber-600 bg-amber-50 border-amber-200'; if(['OFFLINE','ERROR','FAILED'].includes(u)) return 'text-red-600 bg-red-50 border-red-200'; return 'text-slate-600 bg-slate-50 border-slate-200'; };
const sd = (s: string) => { const u=(s||'').toUpperCase(); if(['ONLINE','RUNNING','ACTIVE'].includes(u)) return 'bg-emerald-500'; if(u==='IDLE') return 'bg-blue-400'; if(u==='DEGRADED') return 'bg-amber-500 animate-pulse'; if(['OFFLINE','ERROR'].includes(u)) return 'bg-red-500 animate-pulse'; return 'bg-slate-400'; };
const fu = (s: number) => `${Math.floor(s/3600)}h ${Math.floor((s%3600)/60)}m ${Math.floor(s%60)}s`;
const SI: Record<string,any> = { backend:Server, database:Database, cctvMonitor:Camera, detectionWorker:Cpu, occupancyEngine:Activity, automationEngine:Zap, commandQueue:Radio, deviceManager:Wifi, energyService:BarChart3, websocket:Activity };
const SL: Record<string,string> = { backend:'Backend Server', database:'SQLite DB', cctvMonitor:'CCTV Monitor', detectionWorker:'Detection Worker', occupancyEngine:'Occupancy Engine', automationEngine:'Automation Engine', commandQueue:'Command Queue', deviceManager:'Device Manager', energyService:'Energy Service', websocket:'WebSocket' };

export default function SystemHealth() {
  const [health, setHealth] = useState<SHealth | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState('');
  const [res, setRes] = useState<{msg:string;ok:boolean}|null>(null);
  const [showCctv, setShowCctv] = useState(false);
  const [cfm, setCfm] = useState('');

  const load = useCallback(async () => {
    try { const r = await fetch('/api/system/health'); if(r.ok) setHealth(await r.json()); } finally { setLoading(false); }
  },[]);

  useEffect(() => { load(); const t=setInterval(load,8000); return ()=>clearInterval(t); },[load]);

  const api = async (url:string, method='POST', body?:object) => {
    const r = await fetch(url,{method,headers:{'Content-Type':'application/json'},body:body?JSON.stringify(body):undefined});
    if(!r.ok){const e=await r.json().catch(()=>({error:r.statusText}));throw new Error(e.error||'Failed');}
    return r.json();
  };

  const act = async (k:string, fn:()=>Promise<any>) => {
    setBusy(k); setRes(null);
    try { const r=await fn(); setRes({msg:r.summary||r.message||'Done.',ok:true}); await load(); }
    catch(e:any){setRes({msg:e.message,ok:false});}
    finally{setBusy('');setCfm('');}
  };

  const auto = health?.settings?.automationEnabled ?? true;
  const emg = health?.settings?.emergencyMode ?? false;
  const svcKeys = Object.keys(SL);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold text-slate-900">System Health</h1>
            {emg && <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-red-100 text-red-800 border border-red-300 animate-pulse">⚠ EMERGENCY</span>}
          </div>
          <p className="text-slate-500 text-sm mt-0.5">Background services status — automation runs independent of browser</p>
        </div>
        <button onClick={()=>{setLoading(true);load();}} className="flex items-center gap-2 px-3 py-2 bg-slate-100 hover:bg-slate-200 rounded-lg text-sm font-semibold text-slate-700 transition-colors">
          <RefreshCw size={14} className={loading?'animate-spin':''}/> Refresh
        </button>
      </div>

      {res && (
        <div className={`p-4 rounded-xl border flex items-start gap-3 ${res.ok?'bg-emerald-50 border-emerald-200':'bg-red-50 border-red-200'}`}>
          {res.ok?<CheckCircle2 size={18} className="text-emerald-600 flex-shrink-0"/>:<XCircle size={18} className="text-red-600 flex-shrink-0"/>}
          <p className={`text-sm ${res.ok?'text-emerald-900':'text-red-900'}`}>{res.msg}</p>
          <button onClick={()=>setRes(null)} className="ml-auto text-slate-400 hover:text-slate-700"><XCircle size={15}/></button>
        </div>
      )}

      {emg && (
        <div className="p-4 bg-red-50 border-2 border-red-300 rounded-xl flex items-center justify-between">
          <div className="flex items-center gap-3"><ShieldAlert size={22} className="text-red-600"/>
            <div><p className="font-bold text-red-900 text-sm">Emergency Mode Active — Automation Locked</p>
              {health?.settings?.emergencyModeSetAt&&<p className="text-xs text-red-700">Since: {new Date(health.settings.emergencyModeSetAt).toLocaleString()}</p>}
            </div>
          </div>
          <button onClick={()=>act('clr',()=>api('/api/controller/emergency','DELETE'))} disabled={!!busy}
            className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg text-sm font-bold">
            {busy==='clr'?<RefreshCw size={13} className="animate-spin"/>:'Clear Emergency'}
          </button>
        </div>
      )}

      {health && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {([['Controller','🟢 RUNNING','Browser-independent','text-emerald-700'],['Automation',auto?'🟢 ENABLED':'🟡 DISABLED',auto?'Commands active':'Paused',auto?'text-emerald-700':'text-amber-700'],['CCTV Monitors',`${health.cctvMonitorCount} camera(s)`,health.cctvMonitorCount>0?'Polling active':'None configured','text-slate-900'],['Uptime',fu(health.uptime),'Node.js process','text-slate-900 font-mono']] as const).map(([label,value,sub,cls],i)=>(
            <div key={i} className="bg-white rounded-xl border border-slate-200 p-4 shadow-xs">
              <p className="text-xs font-medium text-slate-500">{label}</p>
              <p className={`text-sm font-bold mt-0.5 ${cls}`}>{value}</p>
              <p className="text-[11px] text-slate-400 mt-1">{sub}</p>
            </div>
          ))}
        </div>
      )}

      {health && (
        <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs">
          <div className="flex items-center gap-2 mb-4 pb-3 border-b border-slate-100">
            <Activity size={16} className="text-blue-600"/>
            <h3 className="text-sm font-bold text-slate-900">Service Status</h3>
            <span className="ml-auto text-xs text-slate-400">{new Date(health.timestamp).toLocaleTimeString()}</span>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
            {svcKeys.map(key=>{const Icon=SI[key]||Activity;const status=(health as any)[key]||'UNKNOWN';return(
              <div key={key} className={`p-3 rounded-xl border ${sc(status)}`}>
                <div className="flex items-center gap-1.5 mb-1.5"><span className={`w-2 h-2 rounded-full ${sd(status)}`}/><Icon size={12}/></div>
                <p className="text-[11px] font-bold leading-tight">{SL[key]}</p>
                <p className="text-[10px] font-mono mt-0.5 opacity-80">{status}</p>
              </div>
            );})}
          </div>
        </div>
      )}

      {health && health.cctvSessions.length>0 && (
        <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs">
          <button onClick={()=>setShowCctv(!showCctv)} className="w-full flex items-center gap-2 text-left">
            <Camera size={16} className="text-blue-600"/>
            <h3 className="text-sm font-bold text-slate-900">CCTV Monitor Sessions ({health.cctvSessions.length})</h3>
            {showCctv?<ChevronUp size={14} className="ml-auto text-slate-400"/>:<ChevronDown size={14} className="ml-auto text-slate-400"/>}
          </button>
          {showCctv && (
            <div className="mt-4 space-y-3">
              {health.cctvSessions.map(s=>(
                <div key={s.cctvId} className="p-4 bg-slate-50 rounded-xl border border-slate-200">
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-sm font-bold">{s.name}</p>
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${sc(s.status)}`}>{s.status}</span>
                  </div>
                  <div className="grid grid-cols-4 gap-2 text-xs mb-2">
                    {([['Connection',s.status],['Stream',s.streamStatus],['Detection',s.detectionStatus],['Occupancy',s.occupancyStatus]] as const).map(([l,v])=>(
                      <div key={l}><p className="text-slate-500">{l}</p><p className="font-bold text-slate-800 truncate">{v}</p></div>
                    ))}
                  </div>
                  <div className="flex gap-4 text-[11px] text-slate-500">
                    <span>Failures: {s.failCount}</span><span>Frames reported: {s.frameCount}</span>
                    {s.lastCheck&&<span>Last check: {new Date(s.lastCheck).toLocaleTimeString()}</span>}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs">
        <div className="flex items-center gap-2 mb-4 pb-3 border-b border-slate-100">
          <Zap size={16} className="text-indigo-600"/>
          <h3 className="text-sm font-bold text-slate-900">Controller Actions</h3>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl">
            <p className="text-sm font-bold text-slate-900 mb-1">Automation Switch</p>
            <p className="text-xs text-slate-500 mb-3">{auto?'ON — CCTV detection triggers device commands automatically.':'OFF — detection runs but no device commands sent.'}</p>
            <button onClick={()=>act('auto',()=>api('/api/controller/automation','POST',{enabled:!auto}))} disabled={!!busy}
              className={`w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm font-bold border transition-colors ${auto?'bg-amber-100 hover:bg-amber-200 text-amber-900 border-amber-300':'bg-emerald-100 hover:bg-emerald-200 text-emerald-900 border-emerald-300'}`}>
              {busy==='auto'?<RefreshCw size={13} className="animate-spin"/>:(auto?<ZapOff size={13}/>:<Zap size={13}/>)}
              {auto?'Disable Automation':'Enable Automation'}
            </button>
          </div>

          <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl">
            <p className="text-sm font-bold text-slate-900 mb-1">Master Turn Off</p>
            <p className="text-xs text-slate-500 mb-3">Sends TURN_OFF to all registered devices. Reports exact results — no false "all off" on partial failure.</p>
            {cfm==='moff'?(
              <div className="flex gap-2">
                <button onClick={()=>act('moff',()=>api('/api/controller/turn-all-off','POST'))} disabled={!!busy} className="flex-1 px-3 py-2 bg-red-600 text-white rounded-lg text-xs font-bold">{busy==='moff'?<RefreshCw size={12} className="animate-spin mx-auto"/>:'Confirm OFF'}</button>
                <button onClick={()=>setCfm('')} className="px-3 py-2 bg-slate-200 rounded-lg text-xs font-bold">Cancel</button>
              </div>
            ):(
              <button onClick={()=>setCfm('moff')} className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-slate-200 hover:bg-slate-300 text-slate-800 rounded-lg text-sm font-bold border border-slate-300">
                <PowerOff size={13}/> Turn All OFF
              </button>
            )}
          </div>

          <div className={`p-4 rounded-xl border ${emg?'bg-red-50 border-red-200':'bg-slate-50 border-slate-200'}`}>
            <p className="text-sm font-bold text-slate-900 mb-1">Emergency Shutdown</p>
            <p className="text-xs text-slate-500 mb-3">Disables auto-ON commands, blocks automation until cleared. Sends OFF to every device immediately.</p>
            {emg?(
              <button onClick={()=>act('clr',()=>api('/api/controller/emergency','DELETE'))} disabled={!!busy} className="w-full px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-sm font-bold">{busy==='clr'?<RefreshCw size={13} className="animate-spin mx-auto"/>:'Clear Emergency Mode'}</button>
            ):cfm==='emg'?(
              <div className="flex gap-2">
                <button onClick={()=>act('emg',()=>api('/api/controller/emergency','POST'))} disabled={!!busy} className="flex-1 px-3 py-2 bg-red-600 text-white rounded-lg text-xs font-bold">{busy==='emg'?<RefreshCw size={12} className="animate-spin mx-auto"/>:'ACTIVATE'}</button>
                <button onClick={()=>setCfm('')} className="px-3 py-2 bg-slate-200 rounded-lg text-xs font-bold">Cancel</button>
              </div>
            ):(
              <button onClick={()=>setCfm('emg')} className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-red-100 hover:bg-red-200 text-red-800 rounded-lg text-sm font-bold border border-red-300">
                <ShieldAlert size={13}/> Emergency Shutdown
              </button>
            )}
          </div>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs">
        <div className="flex items-center gap-2 mb-4 pb-3 border-b border-slate-100"><Radio size={16} className="text-blue-600"/><h3 className="text-sm font-bold text-slate-900">Device Group Control</h3></div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {([{g:'all',l:'All Devices'},{g:'lights',l:'All Lights'},{g:'fans',l:'All Fans'},{g:'ac',l:'All AC'}] as const).map(({g,l})=>(
            <div key={g} className="p-3 bg-slate-50 border border-slate-200 rounded-xl">
              <p className="text-xs font-bold text-slate-700 mb-2">{l}</p>
              <div className="flex gap-1.5">
                <button onClick={()=>act(`g-${g}-1`,()=>api('/api/controller/group','POST',{group:g,turnOn:true}))} disabled={!!busy} className="flex-1 py-1.5 bg-emerald-100 hover:bg-emerald-200 text-emerald-800 rounded text-[11px] font-bold">{busy===`g-${g}-1`?'…':'ON'}</button>
                <button onClick={()=>act(`g-${g}-0`,()=>api('/api/controller/group','POST',{group:g,turnOn:false}))} disabled={!!busy} className="flex-1 py-1.5 bg-red-100 hover:bg-red-200 text-red-800 rounded text-[11px] font-bold">{busy===`g-${g}-0`?'…':'OFF'}</button>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="p-4 bg-blue-50 border border-blue-200 rounded-xl flex items-start gap-3">
        <Info size={17} className="text-blue-600 flex-shrink-0 mt-0.5"/>
        <p className="text-xs text-blue-900"><strong>Browser Independence:</strong> All automation, CCTV polling, occupancy tracking, and device commands run inside the Node.js backend process. Closing this tab or any client browser <strong>does not stop automation</strong>. Only stopping the backend server halts these services.</p>
      </div>
    </div>
  );
}