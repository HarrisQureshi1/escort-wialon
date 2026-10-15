import React, { useState, useEffect, useRef, useCallback } from 'react';
import { TopNav } from './components/TopNav';
import { TokenAuthInterface } from './components/TokenAuthInterface';
import { UnitsTableInterface } from './components/UnitsTableInterface';
import { UnitDossierModal } from './components/UnitDossierModal';
import {
  WialonSession,
  WialonUnit,
  SessionHistoryEntry,
} from './types/wialon';
import {
  loginWithToken,
  fetchUnitsFromWialon,
  generateDemoSessionId,
  getWialonErrorText,
} from './services/wialonApi';
import {
  DEMO_ACCOUNT_NAME,
  DEMO_USER_NAME,
  DEMO_TOKEN_PRESET,
  INITIAL_MOCK_UNITS,
} from './services/mockData';
import { loadCalibrationsFromServer } from './services/calibrationService';

const STORAGE_KEY_TOKEN = 'wialon_token';
const STORAGE_KEY_HOST = 'wialon_host';
const STORAGE_KEY_IS_DEMO = 'wialon_is_demo';

export default function App() {
  const [activeTab, setActiveTab] = useState<'auth' | 'units'>('auth');
  const [storedToken, setStoredToken] = useState<string>('');
  const [serverHost, setServerHost] = useState<string>('hst-api.wialon.com');
  const [session, setSession] = useState<WialonSession | null>(null);
  const [units, setUnits] = useState<WialonUnit[]>([]);
  const [history, setHistory] = useState<SessionHistoryEntry[]>([]);
  const [selectedUnit, setSelectedUnit] = useState<WialonUnit | null>(null);

  const [isConnecting, setIsConnecting] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isLoadingUnits, setIsLoadingUnits] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);

  const sessionRef = useRef<WialonSession | null>(null);
  sessionRef.current = session;

  // Sync document title to requested requirement: "Fuel Transactions for [account name fetched from the API]"
  useEffect(() => {
    const accountTitle = session?.accountName || '--';
    document.title = `Fuel Transactions for ${accountTitle}`;
  }, [session?.accountName]);

  // Load stored credentials and calibrations on mount
  useEffect(() => {
    loadCalibrationsFromServer().catch((e) => console.warn('Could not load calibrations:', e));
    const savedToken = localStorage.getItem(STORAGE_KEY_TOKEN);
    const savedHost = localStorage.getItem(STORAGE_KEY_HOST) || 'hst-api.wialon.com';
    const isDemo = localStorage.getItem(STORAGE_KEY_IS_DEMO) === 'true';

    if (savedToken) {
      setStoredToken(savedToken);
      setServerHost(savedHost);
      handleAuthenticate(savedToken, savedHost, isDemo);
    } else {
      setActiveTab('auth');
    }
  }, []);

  // Central Authentication Function
  const handleAuthenticate = async (
    token: string,
    host: string = 'hst-api.wialon.com',
    isDemo: boolean = false
  ) => {
    setIsConnecting(true);
    setAuthError(null);
    const startTime = Date.now();

    try {
      let newSid: string;
      let accountName: string;
      let userName: string;
      let userId: number;
      let loadedUnits: WialonUnit[] = [];

      if (isDemo) {
        // Explicit demo request only
        await new Promise((resolve) => setTimeout(resolve, 500));
        newSid = generateDemoSessionId();
        accountName = DEMO_ACCOUNT_NAME;
        userName = DEMO_USER_NAME;
        userId = 98402;
        loadedUnits = [...INITIAL_MOCK_UNITS];
      } else {
        // Live Wialon Remote API direct call
        const loginRes = await loginWithToken(token, host);
        newSid = loginRes.sid;
        accountName = loginRes.accountName;
        userName = loginRes.userName;
        userId = loginRes.userId;

        // Fetch Units directly from API (no dummy fallback)
        try {
          loadedUnits = await fetchUnitsFromWialon(newSid, host);
        } catch (unitErr: any) {
          console.warn('Units query error from Wialon API:', unitErr);
          loadedUnits = [];
        }
      }

      const latencyMs = Date.now() - startTime;
      const historyEntry: SessionHistoryEntry = {
        id: `sid-${Date.now()}`,
        timestamp: Date.now(),
        sid: newSid,
        latencyMs,
        status: 'success',
      };

      const newSession: WialonSession = {
        token,
        host,
        sid: newSid,
        accountName,
        userName,
        userId,
        lastLoginTime: Date.now(),
        status: 'connected',
        refreshCount: 1,
        nextRefreshIn: 25,
        isDemo: isDemo || token === DEMO_TOKEN_PRESET,
      };

      setSession(newSession);
      setUnits(loadedUnits);
      setHistory((prev) => [historyEntry, ...prev.slice(0, 19)]);
      setStoredToken(token);
      setServerHost(host);

      localStorage.setItem(STORAGE_KEY_TOKEN, token);
      localStorage.setItem(STORAGE_KEY_HOST, host);
      localStorage.setItem(STORAGE_KEY_IS_DEMO, String(newSession.isDemo));

      // Switch to units view if first connection
      setActiveTab('units');
    } catch (err: any) {
      console.error('Authentication failure:', err);
      setAuthError(err.message || 'Failed to authenticate with Wialon API');
      setActiveTab('auth');
    } finally {
      setIsConnecting(false);
    }
  };

  // Background 25-Second Session ID Generator & Renewal Function
  const generateNewSessionId = useCallback(async () => {
    const curSession = sessionRef.current;
    if (!curSession || !curSession.token) return;

    setIsRefreshing(true);
    const startTime = Date.now();

    try {
      let freshSid: string;

      if (curSession.isDemo) {
        await new Promise((resolve) => setTimeout(resolve, 250));
        freshSid = generateDemoSessionId();

        // Slightly jitter speed/fuel in demo mode to showcase live changes
        setUnits((prev) =>
          prev.map((u) => {
            if (u.state === 'moving') {
              const speedDelta = Math.floor(Math.random() * 5) - 2;
              const newSpeed = Math.max(40, Math.min(95, (u.pos?.s || 70) + speedDelta));
              const newFuel = u.fuel.currentLevel !== null
                ? Math.max(10, Math.round((u.fuel.currentLevel - 0.1) * 10) / 10)
                : null;
              return {
                ...u,
                pos: u.pos ? { ...u.pos, s: newSpeed, t: Math.floor(Date.now() / 1000) } : undefined,
                lmsg: { ...u.lmsg, t: Math.floor(Date.now() / 1000), p: { ...u.lmsg?.p, speed: newSpeed } },
                fuel: {
                  ...u.fuel,
                  currentLevel: newFuel,
                },
              };
            }
            return u;
          })
        );
      } else {
        const loginRes = await loginWithToken(curSession.token, curSession.host);
        freshSid = loginRes.sid;
        // Re-fetch units from Wialon API
        fetchUnitsFromWialon(freshSid, curSession.host)
          .then((freshUnits) => setUnits(freshUnits))
          .catch((err) => console.warn('Background units update error:', err));
      }

      const latencyMs = Date.now() - startTime;
      const historyEntry: SessionHistoryEntry = {
        id: `sid-${Date.now()}`,
        timestamp: Date.now(),
        sid: freshSid,
        latencyMs,
        status: 'success',
      };

      setSession((prev) => {
        if (!prev) return null;
        return {
          ...prev,
          sid: freshSid,
          refreshCount: prev.refreshCount + 1,
          nextRefreshIn: 25,
          lastLoginTime: Date.now(),
        };
      });

      setHistory((prev) => [historyEntry, ...prev.slice(0, 19)]);
    } catch (err: any) {
      console.error('Session regeneration error:', err);
      const latencyMs = Date.now() - startTime;
      const historyEntry: SessionHistoryEntry = {
        id: `sid-${Date.now()}`,
        timestamp: Date.now(),
        sid: curSession.sid,
        latencyMs,
        status: 'failed',
        error: err.message,
      };
      setHistory((prev) => [historyEntry, ...prev.slice(0, 19)]);
    } finally {
      setIsRefreshing(false);
    }
  }, []);

  // Background 25-Second Interval Ticker
  useEffect(() => {
    if (!session) return;

    const timer = setInterval(() => {
      setSession((prev) => {
        if (!prev) return null;
        if (prev.nextRefreshIn <= 1) {
          // Trigger background renewal
          generateNewSessionId();
          return { ...prev, nextRefreshIn: 25 };
        }
        return { ...prev, nextRefreshIn: prev.nextRefreshIn - 1 };
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [session?.sid, generateNewSessionId]);

  // Clear Token and Disconnect
  const handleClearToken = () => {
    localStorage.removeItem(STORAGE_KEY_TOKEN);
    localStorage.removeItem(STORAGE_KEY_HOST);
    localStorage.removeItem(STORAGE_KEY_IS_DEMO);
    setSession(null);
    setStoredToken('');
    setUnits([]);
    setHistory([]);
    setActiveTab('auth');
  };

  // Refresh units manually
  const handleRefreshUnits = async () => {
    if (!session) return;
    setIsLoadingUnits(true);
    try {
      if (session.isDemo) {
        await new Promise((resolve) => setTimeout(resolve, 500));
        setUnits([...INITIAL_MOCK_UNITS]);
      } else {
        const freshUnits = await fetchUnitsFromWialon(session.sid, session.host);
        setUnits(freshUnits);
      }
    } catch (err) {
      console.error('Error refreshing units:', err);
    } finally {
      setIsLoadingUnits(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0b0f17] text-slate-100 flex flex-col selection:bg-emerald-500/30 selection:text-emerald-200">
      {/* Top Bar adhering to Top Bar Contract */}
      <TopNav
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        session={session}
        onManualRefresh={generateNewSessionId}
        isRefreshing={isRefreshing}
      />

      {/* Main Workspace Viewport */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 lg:p-8 space-y-6">
        {activeTab === 'auth' ? (
          <TokenAuthInterface
            session={session}
            storedToken={storedToken}
            serverHost={serverHost}
            onSaveToken={handleAuthenticate}
            onClearToken={handleClearToken}
            onTriggerRefresh={generateNewSessionId}
            isConnecting={isConnecting}
            isRefreshing={isRefreshing}
            history={history}
            error={authError}
          />
        ) : (
          <UnitsTableInterface
            units={units}
            isLoading={isLoadingUnits}
            onRefresh={handleRefreshUnits}
            onSelectUnit={(unit) => setSelectedUnit(unit)}
            accountName={session?.accountName || 'Fleet Account'}
          />
        )}
      </main>

      {/* Unit Telemetry & Fuel Dossier Modal */}
      {selectedUnit && (
        <UnitDossierModal
          unit={selectedUnit}
          onClose={() => setSelectedUnit(null)}
          fuelUnit="liters"
          sid={session?.sid}
          host={session?.host}
          isDemo={session?.isDemo ?? true}
        />
      )}
    </div>
  );
}
