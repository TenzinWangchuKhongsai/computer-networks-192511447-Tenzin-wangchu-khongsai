import { useEffect, useState } from 'react';
import { Wifi, Smartphone, Monitor, Tablet, Globe, RefreshCw, Copy, CheckCircle2, Info, Signal } from 'lucide-react';

interface NetworkInfo {
  port: number;
  frontendPort: number;
  addresses: { name: string; address: string }[];
  primaryAddress: string;
  timestamp: string;
}

export default function NetworkAccess() {
  const [networkInfo, setNetworkInfo] = useState<NetworkInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);

  const fetchNetworkInfo = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/network-info');
      if (!res.ok) throw new Error('Failed to fetch network info');
      const data = await res.json();
      setNetworkInfo(data);
    } catch (err: any) {
      setError(err.message || 'Could not load network information');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchNetworkInfo(); }, []);

  const copy = (text: string, key: string) => {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(key);
      setTimeout(() => setCopied(null), 2000);
    });
  };

  const dashUrl = networkInfo
    ? `http://${networkInfo.primaryAddress}:${networkInfo.frontendPort}`
    : null;
  const apiUrl = networkInfo
    ? `http://${networkInfo.primaryAddress}:${networkInfo.port}`
    : null;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold text-slate-900">Network Access</h1>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-blue-100 text-blue-800 border border-blue-200">
              Cross-Device
            </span>
          </div>
          <p className="text-slate-500 text-sm mt-0.5">
            Access this Smart Office controller from phones, tablets, and computers on your local network
          </p>
        </div>
        <button
          onClick={fetchNetworkInfo}
          disabled={loading}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-semibold shadow-xs transition-colors"
        >
          <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
          Refresh
        </button>
      </div>

      {error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-xl text-red-800 text-sm">
          <strong>Error:</strong> {error}
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-16">
          <RefreshCw size={32} className="animate-spin text-blue-500" />
        </div>
      ) : networkInfo ? (
        <>
          {/* Primary Access Card */}
          <div className="bg-gradient-to-br from-blue-600 to-indigo-700 rounded-2xl p-6 text-white shadow-lg">
            <div className="flex items-center gap-2 mb-3">
              <Signal size={20} className="text-blue-200" />
              <span className="text-xs font-bold text-blue-200 uppercase tracking-wider">
                Primary LAN Dashboard URL
              </span>
            </div>
            <p className="text-2xl font-mono font-bold mb-1 break-all">{dashUrl}</p>
            <p className="text-blue-200 text-sm mb-5">
              Open this URL on any device connected to the same Wi-Fi or LAN network
            </p>
            <div className="flex flex-wrap gap-3">
              <button
                onClick={() => dashUrl && window.open(dashUrl, '_blank')}
                className="flex items-center gap-2 px-4 py-2 bg-white/20 hover:bg-white/30 rounded-lg text-sm font-bold transition-colors"
              >
                <Globe size={16} />
                Open in New Tab
              </button>
              <button
                onClick={() => dashUrl && copy(dashUrl, 'lan')}
                className="flex items-center gap-2 px-4 py-2 bg-white/20 hover:bg-white/30 rounded-lg text-sm font-bold transition-colors"
              >
                {copied === 'lan' ? (
                  <><CheckCircle2 size={16} />Copied!</>
                ) : (
                  <><Copy size={16} />Copy URL</>
                )}
              </button>
            </div>
          </div>

          {/* Metrics Row */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-xs">
              <p className="text-xs font-medium text-slate-500">LAN IP Address</p>
              <p className="text-lg font-bold font-mono text-slate-900 mt-0.5">
                {networkInfo.primaryAddress}
              </p>
            </div>
            <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-xs">
              <p className="text-xs font-medium text-slate-500">Backend API Port</p>
              <p className="text-lg font-bold font-mono text-slate-900 mt-0.5">{networkInfo.port}</p>
            </div>
            <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-xs">
              <p className="text-xs font-medium text-slate-500">Frontend Port</p>
              <p className="text-lg font-bold font-mono text-slate-900 mt-0.5">{networkInfo.frontendPort}</p>
            </div>
            <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-xs">
              <p className="text-xs font-medium text-slate-500">Interfaces Detected</p>
              <p className="text-lg font-bold font-mono text-slate-900 mt-0.5">
                {networkInfo.addresses.length}
              </p>
            </div>
          </div>

          {/* URL Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {dashUrl && (
              <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-xs">
                <p className="text-xs font-bold text-slate-600 mb-2">Dashboard URL</p>
                <div className="flex items-center gap-2">
                  <code className="text-sm font-mono text-slate-900 bg-slate-50 border border-slate-200 px-2.5 py-1.5 rounded-lg flex-1 truncate">
                    {dashUrl}
                  </code>
                  <button onClick={() => copy(dashUrl, 'dash')} className="text-slate-400 hover:text-slate-800 flex-shrink-0">
                    {copied === 'dash' ? <CheckCircle2 size={16} className="text-emerald-600" /> : <Copy size={16} />}
                  </button>
                </div>
              </div>
            )}
            {apiUrl && (
              <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-xs">
                <p className="text-xs font-bold text-slate-600 mb-2">Backend API URL</p>
                <div className="flex items-center gap-2">
                  <code className="text-sm font-mono text-slate-900 bg-slate-50 border border-slate-200 px-2.5 py-1.5 rounded-lg flex-1 truncate">
                    {apiUrl}/api
                  </code>
                  <button onClick={() => copy(`${apiUrl}/api`, 'api')} className="text-slate-400 hover:text-slate-800 flex-shrink-0">
                    {copied === 'api' ? <CheckCircle2 size={16} className="text-emerald-600" /> : <Copy size={16} />}
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Network Interfaces */}
          <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs">
            <div className="flex items-center gap-2 mb-4 pb-3 border-b border-slate-100">
              <Wifi size={16} className="text-blue-600" />
              <h3 className="text-sm font-bold text-slate-900">Detected Network Interfaces</h3>
              <span className="ml-auto text-xs text-slate-500">
                {networkInfo.addresses.length} interface(s)
              </span>
            </div>
            {networkInfo.addresses.length === 0 ? (
              <p className="text-sm text-slate-500 text-center py-6">
                No external network interfaces found. Connect to Wi-Fi or Ethernet first.
              </p>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {networkInfo.addresses.map((addr, i) => (
                  <div
                    key={i}
                    className={`p-3.5 rounded-xl border transition-all ${
                      addr.address === networkInfo.primaryAddress
                        ? 'bg-blue-50 border-blue-200'
                        : 'bg-slate-50 border-slate-200'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-xs font-bold text-slate-700 truncate">{addr.name}</span>
                      {addr.address === networkInfo.primaryAddress && (
                        <span className="text-[10px] font-extrabold text-blue-700 bg-blue-100 px-1.5 py-0.5 rounded-full">
                          PRIMARY
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2 mb-2">
                      <code className="text-sm font-mono font-bold text-slate-900">{addr.address}</code>
                      <button
                        onClick={() => copy(addr.address, `addr-${i}`)}
                        className="text-slate-400 hover:text-slate-700 ml-auto"
                      >
                        {copied === `addr-${i}` ? (
                          <CheckCircle2 size={13} className="text-emerald-600" />
                        ) : (
                          <Copy size={13} />
                        )}
                      </button>
                    </div>
                    <a
                      href={`http://${addr.address}:${networkInfo.frontendPort}`}
                      target="_blank"
                      rel="noreferrer"
                      className="text-[11px] text-blue-600 hover:underline font-medium"
                    >
                      Open Dashboard on this IP →
                    </a>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Device Connection Guide */}
          <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs">
            <div className="flex items-center gap-2 mb-5 pb-3 border-b border-slate-100">
              <Info size={16} className="text-indigo-600" />
              <h3 className="text-sm font-bold text-slate-900">How to Connect From Any Device</h3>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
              {[
                {
                  icon: <Smartphone size={22} className="text-blue-600" />,
                  bg: 'bg-blue-50 border-blue-100',
                  title: 'Android / iPhone',
                  emoji: '📱',
                  steps: [
                    'Connect device to the same Wi-Fi network as this PC',
                    'Open Chrome (Android) or Safari (iPhone/iPad)',
                    `Navigate to: ${dashUrl}`,
                    'Tap "Add to Home Screen" to install as a PWA app',
                  ],
                },
                {
                  icon: <Tablet size={22} className="text-indigo-600" />,
                  bg: 'bg-indigo-50 border-indigo-100',
                  title: 'Tablet / iPad',
                  emoji: '📟',
                  steps: [
                    'Join the same Wi-Fi network',
                    'Open any modern browser',
                    'Type the LAN URL shown above',
                    'Use landscape orientation for best view',
                  ],
                },
                {
                  icon: <Monitor size={22} className="text-emerald-600" />,
                  bg: 'bg-emerald-50 border-emerald-100',
                  title: 'Another PC / Mac',
                  emoji: '💻',
                  steps: [
                    'Connect to the same local network',
                    'Open any modern browser (Chrome, Firefox, Edge)',
                    'Enter the dashboard LAN URL',
                    'Full dashboard features work over the network',
                  ],
                },
              ].map((item, i) => (
                <div key={i} className="flex gap-3">
                  <div
                    className={`w-11 h-11 rounded-xl border flex items-center justify-center flex-shrink-0 ${item.bg}`}
                  >
                    {item.icon}
                  </div>
                  <div>
                    <p className="text-xs font-bold text-slate-900 mb-2">
                      {item.emoji} {item.title}
                    </p>
                    <ol className="text-xs text-slate-600 space-y-1.5">
                      {item.steps.map((step, si) => (
                        <li key={si} className="flex gap-2">
                          <span className="font-bold text-slate-400 flex-shrink-0 w-3">{si + 1}.</span>
                          <span>{step}</span>
                        </li>
                      ))}
                    </ol>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Firewall Note */}
          <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl">
            <div className="flex items-start gap-3">
              <Info size={18} className="text-amber-600 flex-shrink-0 mt-0.5" />
              <div className="text-xs text-amber-900">
                <p className="font-bold mb-1">Windows Firewall Notice</p>
                <p>
                  If other devices on your network cannot reach the dashboard, you may need to allow Node.js
                  through Windows Firewall. Go to{' '}
                  <strong>Windows Security → Firewall & network protection → Allow an app through firewall</strong>{' '}
                  and enable <code className="bg-amber-100 px-1 rounded">node.exe</code> for private networks.
                  Backend runs on port <strong>{networkInfo.port}</strong>, frontend on port{' '}
                  <strong>{networkInfo.frontendPort}</strong>.
                </p>
              </div>
            </div>
          </div>
        </>
      ) : null}
    </div>
  );
}