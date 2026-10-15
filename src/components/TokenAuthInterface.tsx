import React, { useState } from 'react';
import {
  KeyRound,
  ShieldCheck,
  Server,
  RefreshCw,
  Copy,
  Check,
  Eye,
  EyeOff,
  AlertCircle,
  Building,
  User,
  Hash,
  Activity,
  Trash2,
  ExternalLink,
  History,
  Sliders,
  Database,
  CheckCircle2,
} from 'lucide-react';
import { WialonSession, SessionHistoryEntry } from '../types/wialon';
import { pullFuelSensorsAndUpdateCalibrations } from '../services/wialonApi';
import { getAllVehicleCalibrations } from '../services/calibrationService';

interface TokenAuthInterfaceProps {
  session: WialonSession | null;
  storedToken: string;
  serverHost: string;
  onSaveToken: (token: string, host: string, isDemo?: boolean) => Promise<void>;
  onClearToken: () => void;
  onTriggerRefresh: () => Promise<void>;
  isConnecting: boolean;
  isRefreshing: boolean;
  history: SessionHistoryEntry[];
  error: string | null;
}

export const TokenAuthInterface: React.FC<TokenAuthInterfaceProps> = ({
  session,
  storedToken,
  serverHost,
  onSaveToken,
  onClearToken,
  onTriggerRefresh,
  isConnecting,
  isRefreshing,
  history,
  error,
}) => {
  const [tokenInput, setTokenInput] = useState(storedToken);
  const [hostInput, setHostInput] = useState(serverHost || 'hst-api.wialon.com');
  const [isCustomHost, setIsCustomHost] = useState(
    serverHost !== 'hst-api.wialon.com' && serverHost !== 'hst-api.wialon.us' && Boolean(serverHost)
  );
  const [showToken, setShowToken] = useState(false);
  const [copiedSid, setCopiedSid] = useState<string | null>(null);
  const [copiedToken, setCopiedToken] = useState(false);

  const handleCopy = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedSid(id);
    setTimeout(() => setCopiedSid(null), 2000);
  };

  const handleCopyToken = () => {
    if (!storedToken) return;
    navigator.clipboard.writeText(storedToken);
    setCopiedToken(true);
    setTimeout(() => setCopiedToken(false), 2000);
  };

  const [isPullingCalib, setIsPullingCalib] = useState(false);
  const [pullMessage, setPullMessage] = useState<string | null>(null);
  const [calibData, setCalibData] = useState<Record<string, any>>(getAllVehicleCalibrations());

  const handlePullCalibrations = async () => {
    setIsPullingCalib(true);
    setPullMessage(null);
    try {
      const activeSid = session?.sid;
      const res = await pullFuelSensorsAndUpdateCalibrations(
        activeSid,
        hostInput.trim(),
        tokenInput.trim() || storedToken
      );
      if (res.success) {
        setPullMessage(`Successfully pulled ${res.unitsWithFuelSensor ?? 0} units with "t": "fuel level" into calibrations.json`);
        setCalibData(res.calibrations || {});
      } else {
        setPullMessage(`Pull failed: ${res.error || 'Check token or session ID'}`);
      }
    } catch (err: any) {
      setPullMessage(`Pull error: ${err.message}`);
    } finally {
      setIsPullingCalib(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!tokenInput.trim()) return;
    await onSaveToken(tokenInput.trim(), hostInput.trim(), false);
  };

  // Progress for the 25-second background interval
  const secondsLeft = session ? session.nextRefreshIn : 25;
  const progressPercent = Math.max(0, Math.min(100, ((25 - secondsLeft) / 25) * 100));

  return (
    <div className="space-y-6">
      {/* Overview Intro Banner */}
      <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-5 sm:p-6 backdrop-blur-sm">
        <div className="space-y-1">
          <h2 className="text-lg font-semibold text-slate-100 flex items-center gap-2">
            <KeyRound className="w-5 h-5 text-emerald-400" />
            Wialon API Authentication & Automatic Session Management
          </h2>
          <p className="text-sm text-slate-400 max-w-3xl">
            Store your Wialon Remote API token to identify the account. The system maintains an active session in the background by renewing a fresh Session ID (SID) every 25 seconds via the <code className="text-emerald-300 font-mono text-xs bg-slate-800/80 px-1.5 py-0.5 rounded">token/login</code> gateway.
          </p>
        </div>
      </div>

      {/* Main Grid: Token Input Form + Account Card */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Token Form (5 cols on lg) */}
        <div className="lg:col-span-5 bg-slate-900/40 border border-slate-800 rounded-xl p-5 sm:p-6 flex flex-col justify-between">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="flex items-center justify-between">
              <label htmlFor="token" className="text-sm font-semibold text-slate-200 flex items-center gap-2">
                <KeyRound className="w-4 h-4 text-emerald-400" />
                API Token
              </label>
              <span className="text-xs text-slate-500 font-mono tabular-nums">
                {tokenInput.length} chars
              </span>
            </div>

            <div className="relative">
              <input
                id="token"
                type={showToken ? 'text' : 'password'}
                value={tokenInput}
                onChange={(e) => setTokenInput(e.target.value)}
                placeholder="Paste your 72-character Wialon API token..."
                required
                className="w-full bg-slate-950 border border-slate-800 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 rounded-lg px-3.5 py-2.5 pr-20 text-sm font-mono text-slate-100 placeholder:text-slate-600 transition-colors"
              />
              <div className="absolute right-2 top-2 flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => setShowToken(!showToken)}
                  className="p-1 text-slate-400 hover:text-slate-200 transition-colors"
                  title={showToken ? 'Hide token' : 'Show token'}
                >
                  {showToken ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
                <button
                  type="button"
                  onClick={async () => {
                    try {
                      const text = await navigator.clipboard.readText();
                      setTokenInput(text.trim());
                    } catch (_) {}
                  }}
                  className="px-1.5 py-0.5 text-[11px] font-medium text-slate-400 hover:text-slate-200 bg-slate-800 rounded transition-colors"
                  title="Paste from clipboard"
                >
                  Paste
                </button>
              </div>
            </div>

            {/* Server Host Selector */}
            <div className="space-y-2">
              <label className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
                <Server className="w-3.5 h-3.5 text-slate-400" />
                Wialon Gateway Host
              </label>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <button
                  type="button"
                  onClick={() => {
                    setHostInput('hst-api.wialon.com');
                    setIsCustomHost(false);
                  }}
                  className={`px-3 py-2 rounded-lg border text-left transition-colors truncate ${
                    hostInput === 'hst-api.wialon.com' && !isCustomHost
                      ? 'border-emerald-500/50 bg-emerald-500/10 text-emerald-300'
                      : 'border-slate-800 bg-slate-950/60 text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <div className="font-semibold text-[11px]">hst-api.wialon.com</div>
                  <div className="text-[10px] text-slate-500">Global Primary</div>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setHostInput('hst-api.wialon.us');
                    setIsCustomHost(false);
                  }}
                  className={`px-3 py-2 rounded-lg border text-left transition-colors truncate ${
                    hostInput === 'hst-api.wialon.us' && !isCustomHost
                      ? 'border-emerald-500/50 bg-emerald-500/10 text-emerald-300'
                      : 'border-slate-800 bg-slate-950/60 text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <div className="font-semibold text-[11px]">hst-api.wialon.us</div>
                  <div className="text-[10px] text-slate-500">North America</div>
                </button>
              </div>

              {isCustomHost && (
                <input
                  type="text"
                  value={hostInput}
                  onChange={(e) => setHostInput(e.target.value)}
                  placeholder="e.g. custom-wialon.yourdomain.com"
                  className="w-full mt-2 bg-slate-950 border border-slate-800 focus:border-emerald-500 rounded-lg px-3 py-2 text-xs font-mono text-slate-100"
                />
              )}
            </div>

            {error && (
              <div className="p-3 bg-red-950/40 border border-red-800/60 rounded-lg flex items-start gap-2 text-xs text-red-300">
                <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
                <div className="space-y-0.5">
                  <div className="font-semibold">Authentication Error</div>
                  <div>{error}</div>
                </div>
              </div>
            )}

            <div className="pt-2 flex items-center gap-3">
              <button
                type="submit"
                disabled={isConnecting || !tokenInput.trim()}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 text-xs font-semibold text-slate-950 bg-emerald-400 hover:bg-emerald-300 active:scale-98 disabled:opacity-50 disabled:hover:bg-emerald-400 rounded-lg transition-all shadow-sm"
              >
                {isConnecting ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin text-slate-950" />
                    <span>Connecting & Verifying...</span>
                  </>
                ) : (
                  <>
                    <ShieldCheck className="w-4 h-4 text-slate-950" />
                    <span>Store Token & Start Session</span>
                  </>
                )}
              </button>

              {session && (
                <button
                  type="button"
                  onClick={onClearToken}
                  title="Disconnect and clear token from local storage"
                  className="p-2.5 text-slate-400 hover:text-red-400 hover:bg-red-950/20 border border-slate-800 rounded-lg transition-colors"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              )}
            </div>
          </form>

          {/* Quick Info & Token Storage Note */}
          <div className="mt-6 pt-4 border-t border-slate-800/80 text-xs text-slate-500 space-y-1">
            <div className="flex items-center justify-between">
              <span>Token Persistence</span>
              <span className="font-medium text-slate-400">Browser localStorage</span>
            </div>
            <div className="flex items-center justify-between">
              <span>Background Renewal Cadence</span>
              <span className="font-medium text-emerald-400 font-mono tabular-nums">Strict 25 Seconds</span>
            </div>
          </div>
        </div>

        {/* Right Column: Account Information + Active SID Monitor (7 cols on lg) */}
        <div className="lg:col-span-7 space-y-6">
          {session ? (
            <div className="bg-slate-900/40 border border-slate-800 rounded-xl p-5 sm:p-6 space-y-6">
              {/* Account Identity Block */}
              <div>
                <span className="text-xs font-medium uppercase tracking-wider text-slate-500">
                  Authenticated Wialon Account
                </span>
                <div className="mt-1.5 flex flex-col sm:flex-row sm:items-baseline justify-between gap-2 pb-4 border-b border-slate-800">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400 shrink-0">
                      <Building className="w-5 h-5" />
                    </div>
                    <div>
                      <h3 className="text-xl font-bold text-white tracking-tight">
                        {session.accountName || '--'}
                      </h3>
                      <div className="flex items-center gap-2 text-xs text-slate-400 mt-0.5">
                        <span className="flex items-center gap-1">
                          <User className="w-3 h-3 text-slate-500" />
                          User: <strong className="text-slate-300">{session.userName || '--'}</strong>
                        </span>
                        <span aria-hidden="true">·</span>
                        <span className="flex items-center gap-1 font-mono">
                          ID: <strong className="text-slate-300">{session.userId ? session.userId : '--'}</strong>
                        </span>
                      </div>
                    </div>
                  </div>
                  <div className="text-xs text-slate-500 font-mono sm:text-right">
                    Server: <span className="text-slate-300">{session.host || '--'}</span>
                  </div>
                </div>
              </div>

              {/* Background 25-Second Session ID Generator Display */}
              <div className="bg-slate-950/80 border border-slate-800 rounded-lg p-4 space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <Activity className={`w-4 h-4 ${isRefreshing ? 'text-emerald-400 animate-spin' : 'text-emerald-400'}`} />
                    <span className="text-xs font-semibold uppercase tracking-wider text-slate-300">
                      Background Session ID (Auto-renewed every 25s)
                    </span>
                  </div>
                  <div className="flex items-center gap-2 text-xs">
                    <span className="text-slate-400">Next renewal in:</span>
                    <span className="font-mono text-emerald-400 font-bold tabular-nums">
                      {secondsLeft}s
                    </span>
                  </div>
                </div>

                {/* Progress Bar for the 25-second cycle */}
                <div className="w-full bg-slate-800 h-1.5 rounded-full overflow-hidden">
                  <div
                    className="bg-emerald-400 h-full transition-all duration-1000 ease-linear rounded-full"
                    style={{ width: `${progressPercent}%` }}
                  />
                </div>

                {/* Current Active Session ID (eid) Display */}
                <div className="flex items-center justify-between gap-3 bg-slate-900 border border-slate-800 rounded-lg p-2.5">
                  <div className="min-w-0 flex-1">
                    <div className="text-[10px] text-slate-500 uppercase font-mono tracking-wider">
                      Current SID (eid)
                    </div>
                    <div className="font-mono text-sm text-emerald-300 truncate select-all">
                      {session.sid}
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <button
                      type="button"
                      onClick={() => handleCopy(session.sid, 'current-sid')}
                      className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 rounded transition-colors"
                      title="Copy Session ID"
                    >
                      {copiedSid === 'current-sid' ? (
                        <>
                          <Check className="w-3.5 h-3.5 text-emerald-400" />
                          <span className="text-emerald-400">Copied</span>
                        </>
                      ) : (
                        <>
                          <Copy className="w-3.5 h-3.5" />
                          <span>Copy</span>
                        </>
                      )}
                    </button>
                    <button
                      type="button"
                      onClick={onTriggerRefresh}
                      disabled={isRefreshing}
                      className="p-1.5 text-slate-400 hover:text-emerald-400 hover:bg-slate-800 rounded transition-colors"
                      title="Generate new Session ID now"
                    >
                      <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin text-emerald-400' : ''}`} />
                    </button>
                  </div>
                </div>

                {/* Status summary metrics */}
                <div className="grid grid-cols-3 gap-2 pt-1 text-center">
                  <div className="bg-slate-900/50 border border-slate-800/80 rounded p-2">
                    <div className="text-[10px] text-slate-500 uppercase">Renewals</div>
                    <div className="font-mono text-sm font-semibold text-slate-200 tabular-nums">
                      {session.refreshCount}
                    </div>
                  </div>
                  <div className="bg-slate-900/50 border border-slate-800/80 rounded p-2">
                    <div className="text-[10px] text-slate-500 uppercase">Interval</div>
                    <div className="font-mono text-sm font-semibold text-emerald-400 tabular-nums">
                      25s
                    </div>
                  </div>
                  <div className="bg-slate-900/50 border border-slate-800/80 rounded p-2">
                    <div className="text-[10px] text-slate-500 uppercase">State</div>
                    <div className="text-xs font-semibold text-emerald-400 flex items-center justify-center gap-1 mt-0.5">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 inline-block" />
                      Active
                    </div>
                  </div>
                </div>
              </div>

              {/* Masked Stored Token Details */}
              <div className="flex items-center justify-between text-xs text-slate-400 bg-slate-950/40 p-3 rounded-lg border border-slate-800/60">
                <div className="flex items-center gap-2 truncate">
                  <KeyRound className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                  <span className="text-slate-500">Stored Token:</span>
                  <span className="font-mono text-slate-300 truncate">
                    {session.token.substring(0, 10)}...{session.token.substring(session.token.length - 8)}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={handleCopyToken}
                  className="text-slate-400 hover:text-slate-200 flex items-center gap-1 shrink-0 ml-2 text-[11px]"
                >
                  {copiedToken ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                  <span>{copiedToken ? 'Copied' : 'Copy Token'}</span>
                </button>
              </div>
            </div>
          ) : (
            /* Empty state when no token is active */
            <div className="bg-slate-900/20 border border-dashed border-slate-800 rounded-xl p-8 text-center space-y-4">
              <div className="w-12 h-12 rounded-full bg-slate-800/60 border border-slate-700 flex items-center justify-center text-slate-400 mx-auto">
                <KeyRound className="w-6 h-6" />
              </div>
              <div className="space-y-1">
                <h3 className="text-base font-semibold text-slate-200">No Active Wialon Token</h3>
                <p className="text-xs text-slate-400 max-w-md mx-auto">
                  Enter your Wialon API token in the left form to authenticate and identify your fleet account. Once connected, a background worker will maintain session validity by generating a new session ID every 25 seconds.
                </p>
              </div>
            </div>
          )}

          {/* Session ID Generation History Ledger */}
          {history.length > 0 && (
            <div className="bg-slate-900/40 border border-slate-800 rounded-xl p-5 space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-400 flex items-center gap-2">
                  <History className="w-3.5 h-3.5 text-slate-400" />
                  Recent Session Generations (25s Background Ticker)
                </h4>
                <span className="text-xs text-slate-500 font-mono tabular-nums">
                  Showing last {history.length}
                </span>
              </div>

              <div className="border border-slate-800 rounded-lg overflow-hidden divide-y divide-slate-800/60 text-xs font-mono">
                {history.slice(0, 5).map((entry, idx) => (
                  <div
                    key={entry.id}
                    className="flex items-center justify-between p-2.5 bg-slate-950/40 hover:bg-slate-950/80 transition-colors"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <span className="text-slate-500 text-[11px] shrink-0">
                        {new Date(entry.timestamp).toLocaleTimeString()}
                      </span>
                      <span className="text-slate-300 truncate max-w-[200px] sm:max-w-xs">
                        {entry.sid}
                      </span>
                      {idx === 0 && (
                        <span className="text-[10px] px-1.5 py-0.2 bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 rounded">
                          Current
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-3 shrink-0">
                      <span className="text-slate-500 text-[11px] tabular-nums">
                        {entry.latencyMs}ms
                      </span>
                      <button
                        type="button"
                        onClick={() => handleCopy(entry.sid, entry.id)}
                        className="p-1 text-slate-400 hover:text-slate-200 transition-colors"
                        title="Copy this Session ID"
                      >
                        {copiedSid === entry.id ? (
                          <Check className="w-3.5 h-3.5 text-emerald-400" />
                        ) : (
                          <Copy className="w-3.5 h-3.5" />
                        )}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Fuel Sensor Calibrations (calibrations.json) Management Card */}
          <div className="bg-slate-900/40 border border-slate-800 rounded-xl p-5 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-300 flex items-center gap-2">
                  <Sliders className="w-3.5 h-3.5 text-amber-400" />
                  Fuel Sensor Calibrations (<code className="text-emerald-400 font-mono text-xs">calibrations.json</code>)
                </h4>
                <p className="text-xs text-slate-400 mt-0.5">
                  Stores calibration curves (<code className="text-amber-300">tbl</code>) for all units having sensor <code className="text-emerald-300">"t": "fuel level"</code>.
                </p>
              </div>

              <button
                type="button"
                onClick={handlePullCalibrations}
                disabled={isPullingCalib || (!session && !tokenInput.trim() && !storedToken)}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-semibold transition-all disabled:opacity-50 shrink-0 shadow-sm"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isPullingCalib ? 'animate-spin' : ''}`} />
                <span>Pull from Wialon</span>
              </button>
            </div>

            {pullMessage && (
              <div
                className={`p-3 rounded-lg text-xs flex items-center gap-2 ${
                  pullMessage.includes('Successfully')
                    ? 'bg-emerald-500/10 border border-emerald-500/30 text-emerald-300'
                    : 'bg-rose-500/10 border border-rose-500/30 text-rose-300'
                }`}
              >
                {pullMessage.includes('Successfully') ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                ) : (
                  <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
                )}
                <span>{pullMessage}</span>
              </div>
            )}

            {/* List of calibrated units */}
            <div className="border border-slate-800 rounded-lg overflow-hidden bg-slate-950">
              <div className="max-h-48 overflow-y-auto divide-y divide-slate-800/60 font-mono text-xs">
                {Object.keys(calibData).length > 0 ? (
                  Object.values(calibData).map((c: any) => (
                    <div key={c.unitId} className="p-2.5 flex items-center justify-between hover:bg-slate-900/50">
                      <div>
                        <div className="font-sans font-medium text-slate-200">
                          {c.unitName || `Unit #${c.unitId}`}
                        </div>
                        <div className="text-[11px] text-slate-500 flex items-center gap-2 mt-0.5">
                          <span>Unit #{c.unitId}</span>
                          <span>·</span>
                          <span className="text-amber-300">Sensor Index: {c.sensorIndex || '3'}</span>
                          <span>·</span>
                          <span className="text-emerald-400">Param: {c.param || 'io_270'}</span>
                        </div>
                      </div>
                      <div className="text-right">
                        <span className="px-2 py-0.5 rounded bg-slate-900 text-amber-300 border border-slate-800 text-[11px]">
                          {c.tbl?.length || 0} tbl points
                        </span>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="p-4 text-center text-slate-500">
                    No unit calibrations loaded yet. Connect token or click &quot;Pull from Wialon&quot;.
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
