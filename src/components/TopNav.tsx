import React from 'react';
import { ShieldCheck, RefreshCw, Server, Fuel, KeyRound, Truck, Clock } from 'lucide-react';
import { WialonSession } from '../types/wialon';

interface TopNavProps {
  activeTab: 'auth' | 'units';
  setActiveTab: (tab: 'auth' | 'units') => void;
  session: WialonSession | null;
  onManualRefresh: () => void;
  isRefreshing: boolean;
}

export const TopNav: React.FC<TopNavProps> = ({
  activeTab,
  setActiveTab,
  session,
  onManualRefresh,
  isRefreshing,
}) => {
  const accountDisplayName = session?.accountName || '--';

  return (
    <header className="sticky top-0 z-40 bg-[#0e1420]/95 backdrop-blur-md border-b border-slate-800/80 px-4 lg:px-8 py-3.5 transition-colors">
      <div className="max-w-7xl mx-auto flex items-center justify-between gap-8">
        {/* Zone 1: Brand Wordmark with dynamically fetched account name */}
        <div className="flex items-center gap-3 shrink-0">
          <div className="w-9 h-9 rounded-lg bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
            <Fuel className="w-5 h-5" />
          </div>
          <div className="flex flex-col">
            <h1 className="text-base sm:text-lg font-bold text-slate-100 tracking-tight whitespace-nowrap">
              Fuel Transactions for {accountDisplayName}
            </h1>
          </div>
        </div>

        {/* Zone 2: Navigation Links (single line, clean typography) */}
        <nav className="flex items-center gap-1 sm:gap-2">
          <button
            onClick={() => setActiveTab('auth')}
            className={`flex items-center gap-2 px-3.5 py-1.5 text-xs sm:text-sm font-medium rounded-lg transition-colors whitespace-nowrap shrink-0 ${
              activeTab === 'auth'
                ? 'bg-slate-800 text-emerald-400 border border-slate-700 shadow-sm'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
            }`}
          >
            <KeyRound className="w-4 h-4" />
            <span>API Token & Session</span>
            {session && (
              <span className="hidden md:inline font-mono text-[11px] text-emerald-400/80 tabular-nums">
                ({session.nextRefreshIn}s)
              </span>
            )}
          </button>

          <button
            onClick={() => setActiveTab('units')}
            className={`flex items-center gap-2 px-3.5 py-1.5 text-xs sm:text-sm font-medium rounded-lg transition-colors whitespace-nowrap shrink-0 ${
              activeTab === 'units'
                ? 'bg-slate-800 text-emerald-400 border border-slate-700 shadow-sm'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
            }`}
          >
            <Truck className="w-4 h-4" />
            <span>Units & Fuel Table</span>
          </button>
        </nav>

        {/* Zone 3: Primary Action / Session State */}
        <div className="flex items-center gap-3 shrink-0">
          {session ? (
            <div className="flex items-center gap-2">
              <div className="hidden sm:flex items-center gap-2 px-2.5 py-1 rounded-md bg-slate-900 border border-slate-800 text-xs text-slate-300">
                <Clock className="w-3.5 h-3.5 text-emerald-400" />
                <span className="text-slate-400">Renews in:</span>
                <span className="font-mono text-emerald-400 font-semibold tabular-nums">
                  {session.nextRefreshIn}s
                </span>
              </div>
              <button
                onClick={onManualRefresh}
                disabled={isRefreshing}
                title="Regenerate Wialon Session ID immediately"
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-200 bg-slate-800 hover:bg-slate-700 active:scale-95 border border-slate-700 rounded-lg transition-all disabled:opacity-50 whitespace-nowrap shrink-0"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin text-emerald-400' : ''}`} />
                <span className="hidden sm:inline">Refresh SID</span>
              </button>
            </div>
          ) : (
            <button
              onClick={() => setActiveTab('auth')}
              className="px-3.5 py-1.5 text-xs font-medium text-slate-950 bg-emerald-400 hover:bg-emerald-300 rounded-lg transition-colors whitespace-nowrap shrink-0 shadow-sm"
            >
              Connect Token
            </button>
          )}
        </div>
      </div>
    </header>
  );
};
