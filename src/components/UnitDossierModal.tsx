import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  X,
  Fuel,
  Truck,
  Activity,
  Gauge,
  MapPin,
  Clock,
  AlertTriangle,
  Zap,
  Radio,
  ExternalLink,
  RefreshCw,
  BarChart2,
  Table as TableIcon,
  Sliders,
  CheckCircle2,
  Info,
  ChevronRight,
  Calculator,
  Download,
  Calendar,
} from 'lucide-react';
import { WialonUnit } from '../types/wialon';
import { fetchUnitMessagesInterval, pullFuelSensorsAndUpdateCalibrations } from '../services/wialonApi';
import {
  translateIo270ToFuel,
  getVehicleCalibration,
  generateDayMessagesForVehicle,
  VehicleCalibration,
  CalibrationPoint,
} from '../services/calibrationService';

interface UnitDossierModalProps {
  unit: WialonUnit | null;
  onClose: () => void;
  fuelUnit: 'liters' | 'gallons';
  sid?: string;
  host?: string;
  isDemo?: boolean;
}

export interface DayFuelPoint {
  timestamp: number; // ms
  timeStr: string;   // HH:mm:ss
  rawIo270: number;  // raw io_270 value
  fuelLiters: number; // translated fuel value
  formulaDesc: string; // calibration formula applied
  speed?: number;
  ignition?: number;
  isCalibrated: boolean;
}

export const UnitDossierModal: React.FC<UnitDossierModalProps> = ({
  unit,
  onClose,
  fuelUnit,
  sid,
  host = 'hst-api.wialon.com',
  isDemo = false,
}) => {
  const [messages, setMessages] = useState<DayFuelPoint[]>([]);
  const [isLoadingMessages, setIsLoadingMessages] = useState<boolean>(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [hoveredPoint, setHoveredPoint] = useState<DayFuelPoint | null>(null);
  const [showTblModal, setShowTblModal] = useState<boolean>(false);
  const [activeTab, setActiveTab] = useState<'chart' | 'table' | 'sensors'>('chart');
  const [intervalRange, setIntervalRange] = useState<'today' | '24h'>('today');
  const [testRawX, setTestRawX] = useState<string>('2500');
  const [isPullingCalibrations, setIsPullingCalibrations] = useState<boolean>(false);
  const [pullStatus, setPullStatus] = useState<string | null>(null);

  // Convert Liters to display volume based on chosen unit
  const toDisplayVol = useCallback(
    (liters: number | null | undefined): string => {
      if (liters === null || liters === undefined || isNaN(liters)) return '--';
      if (fuelUnit === 'gallons') {
        return (liters * 0.264172).toFixed(1);
      }
      return liters.toFixed(1);
    },
    [fuelUnit]
  );

  const volLabel = fuelUnit === 'gallons' ? 'gal' : 'L';

  // Retrieve calibration table for this specific vehicle by unit ID
  const vehicleCalib: VehicleCalibration | undefined = useMemo(() => {
    if (!unit) return undefined;
    return getVehicleCalibration(unit.id);
  }, [unit]);

  // Fetch messages for that vehicle for that day using messages/load_interval
  const loadDayMessages = useCallback(async () => {
    if (!unit) return;

    setIsLoadingMessages(true);
    setLoadError(null);

    const now = new Date();
    let timeFrom: number;
    let timeTo: number = Math.floor(now.getTime() / 1000);

    if (intervalRange === '24h') {
      timeFrom = timeTo - 86400; // Last 24 hours
    } else {
      // Start of current day: 00:00:00
      const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0);
      timeFrom = Math.floor(startOfDay.getTime() / 1000);
      timeTo = Math.max(timeFrom + 60, timeTo);
    }

    try {
      let rawMessages: any[] = [];

      // If live session is available and not pure demo mode, call messages/load_interval
      if (sid && !isDemo) {
        rawMessages = await fetchUnitMessagesInterval(unit.id, timeFrom, timeTo, sid, host);
      }

      // If no messages returned from live server or running in demo mode, synthesize realistic day messages
      if (!rawMessages || rawMessages.length === 0) {
        rawMessages = generateDayMessagesForVehicle(unit.id, now);
      }

      // Extract sensor param (defaulting to vehicle-specific param or io_270)
      const paramKey = vehicleCalib?.param?.toLowerCase() || 'io_270';

      const processedPoints: DayFuelPoint[] = [];

      for (const msg of rawMessages) {
        if (!msg) continue;
        const p = msg.p || {};

        // 1. Check vehicle's configured sensor param
        let rawIo270 = p[paramKey] ?? p[paramKey.toUpperCase()];

        // 2. Check io_270 in various casing/naming conventions
        if (rawIo270 === undefined || rawIo270 === null) {
          rawIo270 = p.io_270 ?? p['io_270'] ?? p.io270 ?? p.param270 ?? p['270'];
        }

        // 3. Check analog and CAN fallbacks
        if (rawIo270 === undefined || rawIo270 === null) {
          rawIo270 = p.can_fls ?? p.adc1 ?? p.analog1;
        }

        if (rawIo270 !== undefined && rawIo270 !== null) {
          const numX = Number(rawIo270);
          if (Number.isFinite(numX)) {
            const translation = translateIo270ToFuel(numX, unit.id);
            const tsMs = (msg.t || Math.floor(Date.now() / 1000)) * 1000;
            const dateObj = new Date(tsMs);
            const timeStr = dateObj.toLocaleTimeString([], {
              hour: '2-digit',
              minute: '2-digit',
              second: '2-digit',
            });

            const safeFuelLiters = Number.isFinite(translation.fuelLiters) ? translation.fuelLiters : 0;

            processedPoints.push({
              timestamp: tsMs,
              timeStr,
              rawIo270: numX,
              fuelLiters: safeFuelLiters,
              formulaDesc: translation.formulaDesc,
              speed: msg.pos?.s !== undefined ? msg.pos.s : (p.speed ?? 0),
              ignition: p.ignition !== undefined ? Number(p.ignition) : undefined,
              isCalibrated: translation.isCalibrated,
            });
          }
        }
      }

      // Sort chronological
      processedPoints.sort((a, b) => a.timestamp - b.timestamp);
      setMessages(processedPoints);
    } catch (err: any) {
      console.error('Error fetching interval messages for vehicle:', err);
      setLoadError(err.message || 'Failed to load telemetry interval messages.');
    } finally {
      setIsLoadingMessages(false);
    }
  }, [unit, sid, host, isDemo, intervalRange, vehicleCalib?.param]);

  // Load on mount or when unit/range changes
  useEffect(() => {
    if (unit) {
      loadDayMessages();
    }
  }, [unit?.id, intervalRange, loadDayMessages]);

  // Handler to pull calibrations from Wialon API
  const handlePullCalibrations = async () => {
    setIsPullingCalibrations(true);
    setPullStatus(null);
    try {
      const res = await pullFuelSensorsAndUpdateCalibrations(sid, host);
      if (res.success) {
        setPullStatus(`Pulled ${res.unitsWithFuelSensor ?? 0} units with "t": "fuel level" into calibrations.json`);
        // Reload messages to apply freshest calibration table
        loadDayMessages();
      } else {
        setPullStatus(`Pull failed: ${res.error || 'Unknown error'}`);
      }
    } catch (e: any) {
      setPullStatus(`Pull failed: ${e.message}`);
    } finally {
      setIsPullingCalibrations(false);
    }
  };

  // Chart coordinate calculations
  const svgWidth = 680;
  const svgHeight = 200;
  const padLeft = 50;
  const padRight = 30;
  const padTop = 25;
  const padBottom = 30;

  const validMessages = useMemo(
    () => messages.filter((m) => Number.isFinite(m.fuelLiters) && Number.isFinite(m.rawIo270)),
    [messages]
  );

  const chartPoints = useMemo(() => {
    if (validMessages.length === 0) return [];

    const highestVal = Math.max(...validMessages.map((m) => m.fuelLiters), 100);
    const maxVal = vehicleCalib?.maxCapacity || Math.ceil((highestVal * 1.15) / 50) * 50;

    const minTs = validMessages[0].timestamp;
    const maxTs = validMessages[validMessages.length - 1].timestamp;
    const tsSpan = Math.max(1000, maxTs - minTs);

    return validMessages.map((pt) => {
      const relX = (pt.timestamp - minTs) / tsSpan;
      const x = padLeft + relX * (svgWidth - padLeft - padRight);
      const relY = Math.min(1, Math.max(0, pt.fuelLiters / maxVal));
      const y = svgHeight - padBottom - relY * (svgHeight - padTop - padBottom);

      return { x, y, pt, maxVal };
    });
  }, [validMessages, vehicleCalib?.maxCapacity]);

  // SVG Paths
  const pathD = useMemo(() => {
    if (chartPoints.length === 0) return '';
    return chartPoints.reduce((acc, curr, idx) => {
      return `${acc} ${idx === 0 ? 'M' : 'L'} ${curr.x.toFixed(1)} ${curr.y.toFixed(1)}`;
    }, '');
  }, [chartPoints]);

  const areaD = useMemo(() => {
    if (chartPoints.length === 0) return '';
    const firstX = chartPoints[0].x.toFixed(1);
    const lastX = chartPoints[chartPoints.length - 1].x.toFixed(1);
    const bottomY = (svgHeight - padBottom).toFixed(1);
    return `${pathD} L ${lastX} ${bottomY} L ${firstX} ${bottomY} Z`;
  }, [pathD, chartPoints]);

  // Metrics summary for interval
  const daySummary = useMemo(() => {
    if (validMessages.length === 0) {
      return {
        firstLevel: null,
        lastLevel: null,
        firstIo270: null,
        lastIo270: null,
        deltaLiters: null,
        count: 0,
      };
    }
    const first = validMessages[0];
    const last = validMessages[validMessages.length - 1];
    const delta = Math.round((last.fuelLiters - first.fuelLiters) * 10) / 10;
    return {
      firstLevel: first.fuelLiters,
      lastLevel: last.fuelLiters,
      firstIo270: first.rawIo270,
      lastIo270: last.rawIo270,
      deltaLiters: delta,
      count: validMessages.length,
    };
  }, [validMessages]);

  // Interactive translation calculator for the calibration drawer
  const testCalculatedResult = useMemo(() => {
    if (!unit) return null;
    const rawVal = parseFloat(testRawX);
    if (isNaN(rawVal)) return null;
    return translateIo270ToFuel(rawVal, unit.id);
  }, [testRawX, unit]);

  const sensors = useMemo(() => (unit ? Object.values(unit.sens || {}) : []), [unit]);
  const rawParams = useMemo(() => (unit ? Object.entries(unit.lmsg?.p || {}) : []), [unit]);

  const dateLabel = intervalRange === '24h' ? 'Last 24 Hours' : 'Today (since 00:00)';

  // Early return only after all hooks have been invoked
  if (!unit) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="bg-slate-900 border border-slate-800 rounded-xl max-w-4xl w-full max-h-[92vh] flex flex-col overflow-hidden shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="flex items-center justify-between p-4 sm:p-5 border-b border-slate-800 bg-slate-950/70 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400 shrink-0">
              <Truck className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="text-base sm:text-lg font-bold text-slate-100">{unit.nm || `Vehicle #${unit.id}`}</h3>
                <span className="text-xs text-slate-400 font-mono bg-slate-800/80 px-2 py-0.5 rounded">
                  #{unit.id}
                </span>
                <span
                  className={`text-[11px] px-2 py-0.5 rounded capitalize font-medium ${
                    unit.state === 'moving'
                      ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30'
                      : unit.state === 'idling'
                      ? 'bg-amber-500/10 text-amber-400 border border-amber-500/30'
                      : unit.state === 'offline'
                      ? 'bg-red-500/10 text-red-400 border border-red-500/30'
                      : 'bg-slate-800 text-slate-300'
                  }`}
                >
                  {unit.state || 'parked'}
                </span>
                {vehicleCalib?.sensorIndex && (
                  <span className="text-[11px] font-mono px-2 py-0.5 bg-blue-500/10 text-blue-400 border border-blue-500/20 rounded">
                    Fuel Sensor Index: {vehicleCalib.sensorIndex}
                  </span>
                )}
              </div>
              <div className="text-xs text-slate-400 flex items-center gap-2 sm:gap-3 mt-0.5 flex-wrap">
                <span>Plate: {unit.profile?.plate || '--'}</span>
                <span aria-hidden="true" className="text-slate-600">·</span>
                <span>Driver: {unit.profile?.driver || '--'}</span>
                <span aria-hidden="true" className="text-slate-600">·</span>
                <span>Device: {unit.profile?.deviceType || 'GPS Tracker'}</span>
                {unit.profile?.vin && (
                  <>
                    <span aria-hidden="true" className="text-slate-600">·</span>
                    <span className="font-mono text-[11px]">VIN: {unit.profile.vin}</span>
                  </>
                )}
              </div>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors shrink-0"
            title="Close modal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-4 sm:p-6 overflow-y-auto space-y-6">
          {/* Quick Telemetry & Fuel Summary KPI Strip */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="bg-slate-950/60 border border-slate-800 rounded-lg p-3 space-y-1">
              <span className="text-[11px] text-slate-400 font-medium flex items-center gap-1.5">
                <Fuel className="w-3.5 h-3.5 text-emerald-400" />
                Current Fuel Level
              </span>
              <div className="text-xl font-bold font-mono text-emerald-400 tabular-nums">
                {unit.fuel?.currentLevel !== null && unit.fuel?.currentLevel !== undefined
                  ? `${toDisplayVol(unit.fuel.currentLevel)} ${volLabel}`
                  : '--'}
              </div>
              <div className="text-[11px] text-slate-400 truncate">
                {unit.fuel?.calcSensorName
                  ? `Sensor: ${unit.fuel.calcSensorName}${unit.fuel.calcSensorId !== undefined ? ` [#${unit.fuel.calcSensorId}]` : ''}`
                  : (unit.fuel?.sensorType || '--')}
              </div>
            </div>

            <div className="bg-slate-950/60 border border-slate-800 rounded-lg p-3 space-y-1">
              <span className="text-[11px] text-slate-400 font-medium flex items-center gap-1.5">
                <Gauge className="w-3.5 h-3.5 text-blue-400" />
                Speed / Status
              </span>
              <div className="text-xl font-bold font-mono text-slate-100 tabular-nums">
                {unit.pos?.s !== undefined ? `${unit.pos.s} km/h` : '--'}
              </div>
              <div className="text-[11px] text-slate-400">
                Ignition: {unit.lmsg?.p?.ignition !== undefined ? (unit.lmsg.p.ignition === 1 ? 'ON' : 'OFF') : '--'}
              </div>
            </div>

            <div className="bg-slate-950/60 border border-slate-800 rounded-lg p-3 space-y-1">
              <span className="text-[11px] text-slate-400 font-medium flex items-center gap-1.5">
                <Activity className="w-3.5 h-3.5 text-purple-400" />
                Odometer Mileage
              </span>
              <div className="text-xl font-bold font-mono text-slate-100 tabular-nums">
                {unit.mileageKm !== null && unit.mileageKm !== undefined ? `${unit.mileageKm.toLocaleString()} km` : '--'}
              </div>
              <div className="text-[11px] text-slate-400">
                Engine: {unit.engineHours !== null && unit.engineHours !== undefined ? `${unit.engineHours.toLocaleString()} hrs` : '--'}
              </div>
            </div>

            <div className="bg-slate-950/60 border border-slate-800 rounded-lg p-3 space-y-1">
              <span className="text-[11px] text-slate-400 font-medium flex items-center gap-1.5">
                <MapPin className="w-3.5 h-3.5 text-amber-400" />
                Latest Location
              </span>
              {unit.pos?.y !== undefined && unit.pos?.x !== undefined ? (
                <a
                  href={`https://www.google.com/maps?q=${unit.pos.y},${unit.pos.x}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 font-mono text-xs text-emerald-400 hover:text-emerald-300 hover:underline pt-1 tabular-nums group/map"
                  title="Open coordinates in Google Maps"
                >
                  <span>{unit.pos.y.toFixed(4)}, {unit.pos.x.toFixed(4)}</span>
                  <ExternalLink className="w-3 h-3 opacity-70 group-hover/map:opacity-100" />
                </a>
              ) : (
                <div className="text-xs text-slate-500 font-mono">--</div>
              )}
              <div className="text-[11px] text-slate-400">
                Course: {unit.pos?.c !== undefined ? `${unit.pos.c}°` : '--'} {unit.pos?.sc ? `· ${unit.pos.sc} sats` : ''}
              </div>
            </div>
          </div>

          {/* Sync notification if applicable */}
          {pullStatus && (
            <div className="p-3 bg-emerald-500/10 border border-emerald-500/30 rounded-lg text-emerald-300 text-xs flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                <span>{pullStatus}</span>
              </div>
              <button
                onClick={() => setPullStatus(null)}
                className="text-slate-400 hover:text-white text-xs underline"
              >
                Dismiss
              </button>
            </div>
          )}

          {/* ======================================================== */}
          {/* PRIMARY SECTION: Fuel Chart from io_270 via messages/load_interval */}
          {/* ======================================================== */}
          <div className="bg-slate-950/70 border border-slate-800 rounded-xl p-4 sm:p-5 space-y-4 shadow-inner">
            {/* Chart Header Bar */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800/80 pb-3">
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <Fuel className="w-5 h-5 text-emerald-400" />
                  <h4 className="text-sm sm:text-base font-semibold text-slate-100">
                    Fuel Level from <code className="text-emerald-400 font-mono">{vehicleCalib?.param || 'io_270'}</code> Telemetry
                  </h4>
                  <span className="text-[11px] bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 px-2 py-0.5 rounded font-mono">
                    messages/load_interval
                  </span>
                </div>
                <p className="text-xs text-slate-400 mt-1">
                  Interval telemetry for {dateLabel}. Raw sensor values translated via vehicle calibration table (<code className="text-emerald-300">tbl</code>).
                </p>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center gap-2 shrink-0 flex-wrap">
                {/* Interval Range Selector */}
                <div className="flex items-center bg-slate-900 border border-slate-800 rounded-lg p-0.5 text-xs">
                  <button
                    onClick={() => setIntervalRange('today')}
                    className={`px-2 py-1 rounded font-medium transition-colors ${
                      intervalRange === 'today'
                        ? 'bg-slate-800 text-emerald-400'
                        : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    Today
                  </button>
                  <button
                    onClick={() => setIntervalRange('24h')}
                    className={`px-2 py-1 rounded font-medium transition-colors ${
                      intervalRange === '24h'
                        ? 'bg-slate-800 text-emerald-400'
                        : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    24 Hours
                  </button>
                </div>

                {/* View Mode Toggle */}
                <div className="flex items-center bg-slate-900 border border-slate-800 rounded-lg p-0.5 text-xs">
                  <button
                    onClick={() => setActiveTab('chart')}
                    className={`flex items-center gap-1.5 px-2.5 py-1 rounded font-medium transition-colors ${
                      activeTab === 'chart'
                        ? 'bg-emerald-600 text-white shadow-sm'
                        : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    <BarChart2 className="w-3.5 h-3.5" />
                    Chart
                  </button>
                  <button
                    onClick={() => setActiveTab('table')}
                    className={`flex items-center gap-1.5 px-2.5 py-1 rounded font-medium transition-colors ${
                      activeTab === 'table'
                        ? 'bg-emerald-600 text-white shadow-sm'
                        : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    <TableIcon className="w-3.5 h-3.5" />
                    Data ({validMessages.length})
                  </button>
                  <button
                    onClick={() => setActiveTab('sensors')}
                    className={`flex items-center gap-1.5 px-2.5 py-1 rounded font-medium transition-colors ${
                      activeTab === 'sensors'
                        ? 'bg-emerald-600 text-white shadow-sm'
                        : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    <Radio className="w-3.5 h-3.5" />
                    Sensors ({sensors.length})
                  </button>
                </div>

                {/* Inspect tbl Button */}
                <button
                  onClick={() => setShowTblModal(true)}
                  className="flex items-center gap-1.5 px-2.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700/80 rounded-lg text-xs font-medium transition-colors"
                  title="View calibration curve parameters (tbl) from calibrations.json"
                >
                  <Sliders className="w-3.5 h-3.5 text-amber-400" />
                  <span>Calibration Table</span>
                  {vehicleCalib?.tbl && (
                    <span className="bg-slate-900 text-amber-300 text-[10px] px-1.5 py-0.2 rounded font-mono border border-slate-700">
                      {vehicleCalib.tbl.length} pts
                    </span>
                  )}
                </button>

                {/* Reload Interval Button */}
                <button
                  onClick={loadDayMessages}
                  disabled={isLoadingMessages}
                  className="p-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700/80 rounded-lg text-xs transition-colors disabled:opacity-50"
                  title="Reload interval messages"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${isLoadingMessages ? 'animate-spin text-emerald-400' : ''}`} />
                </button>
              </div>
            </div>

            {/* Quick Metrics Bar for interval */}
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 text-xs">
              <div className="bg-slate-900/80 border border-slate-800/80 p-2.5 rounded-lg">
                <span className="text-[11px] text-slate-400 block">Telemetry Points</span>
                <span className="font-mono font-bold text-slate-100 text-sm">
                  {daySummary.count} messages
                </span>
              </div>

              <div className="bg-slate-900/80 border border-slate-800/80 p-2.5 rounded-lg">
                <span className="text-[11px] text-slate-400 block">Start Level</span>
                <span className="font-mono font-bold text-slate-200 text-sm">
                  {daySummary.firstLevel !== null ? `${toDisplayVol(daySummary.firstLevel)} ${volLabel}` : '--'}
                </span>
              </div>

              <div className="bg-slate-900/80 border border-slate-800/80 p-2.5 rounded-lg">
                <span className="text-[11px] text-slate-400 block">Latest Translated Level</span>
                <span className="font-mono font-bold text-emerald-400 text-sm">
                  {daySummary.lastLevel !== null ? `${toDisplayVol(daySummary.lastLevel)} ${volLabel}` : '--'}
                </span>
              </div>

              <div className="bg-slate-900/80 border border-slate-800/80 p-2.5 rounded-lg">
                <span className="text-[11px] text-slate-400 block">Latest Raw Sensor</span>
                <span className="font-mono font-bold text-amber-300 text-sm">
                  {daySummary.lastIo270 !== null ? daySummary.lastIo270.toLocaleString() : '--'}
                </span>
              </div>

              <div className="bg-slate-900/80 border border-slate-800/80 p-2.5 rounded-lg col-span-2 sm:col-span-1">
                <span className="text-[11px] text-slate-400 block">Net Consumption</span>
                <span
                  className={`font-mono font-bold text-sm ${
                    daySummary.deltaLiters !== null && daySummary.deltaLiters < 0
                      ? 'text-rose-400'
                      : daySummary.deltaLiters !== null && daySummary.deltaLiters > 0
                      ? 'text-emerald-400'
                      : 'text-slate-300'
                  }`}
                >
                  {daySummary.deltaLiters !== null
                    ? `${daySummary.deltaLiters > 0 ? '+' : ''}${toDisplayVol(daySummary.deltaLiters)} ${volLabel}`
                    : '--'}
                </span>
              </div>
            </div>

            {/* Error state */}
            {loadError && (
              <div className="p-3 rounded-lg bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0" />
                <span>{loadError}</span>
              </div>
            )}

            {/* View Tab: Interactive SVG Chart */}
            {activeTab === 'chart' && (
              <div className="space-y-3">
                {isLoadingMessages ? (
                  <div className="h-56 flex flex-col items-center justify-center text-slate-400 gap-2 border border-slate-800/80 rounded-lg bg-slate-950/80">
                    <RefreshCw className="w-6 h-6 animate-spin text-emerald-400" />
                    <span className="text-xs">Fetching interval messages from Wialon (messages/load_interval)...</span>
                  </div>
                ) : chartPoints.length > 0 ? (
                  <div className="relative">
                    {/* SVG Chart */}
                    <div className="relative w-full h-56 bg-slate-950 rounded-lg border border-slate-800/90 p-2 overflow-hidden">
                      <svg
                        viewBox={`0 0 ${svgWidth} ${svgHeight}`}
                        className="w-full h-full overflow-visible select-none"
                      >
                        <defs>
                          <linearGradient id="ioFuelGradient" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor="#10b981" stopOpacity="0.30" />
                            <stop offset="60%" stopColor="#06b6d4" stopOpacity="0.10" />
                            <stop offset="100%" stopColor="#06b6d4" stopOpacity="0.0" />
                          </linearGradient>
                          <filter id="glow" x="-20%" y="-20%" width="140%" height="140%">
                            <feGaussianBlur stdDeviation="3" result="blur" />
                            <feComposite in="SourceGraphic" in2="blur" operator="over" />
                          </filter>
                        </defs>

                        {/* Horizontal Grid Guidelines */}
                        {[0.2, 0.4, 0.6, 0.8, 1.0].map((ratio) => {
                          const y = svgHeight - padBottom - ratio * (svgHeight - padTop - padBottom);
                          const maxCap = chartPoints[0]?.maxVal || 600;
                          const gridVal = Math.round(ratio * maxCap);
                          return (
                            <g key={ratio}>
                              <line
                                x1={padLeft}
                                y1={y}
                                x2={svgWidth - padRight}
                                y2={y}
                                stroke="#1e293b"
                                strokeDasharray="3 3"
                              />
                              <text
                                x={padLeft - 6}
                                y={y + 3.5}
                                fill="#64748b"
                                fontSize="9"
                                textAnchor="end"
                                className="font-mono tabular-nums select-none"
                              >
                                {toDisplayVol(gridVal)} {volLabel}
                              </text>
                            </g>
                          );
                        })}

                        {/* Filled Gradient Area */}
                        {areaD && <path d={areaD} fill="url(#ioFuelGradient)" />}

                        {/* Plotted Line */}
                        {pathD && (
                          <path
                            d={pathD}
                            fill="none"
                            stroke="#10b981"
                            strokeWidth="2.5"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          />
                        )}

                        {/* Hover vertical crosshair */}
                        {hoveredPoint && (
                          (() => {
                            const match = chartPoints.find((cp) => cp.pt === hoveredPoint);
                            if (!match) return null;
                            return (
                              <g>
                                <line
                                  x1={match.x}
                                  y1={padTop}
                                  x2={match.x}
                                  y2={svgHeight - padBottom}
                                  stroke="#38bdf8"
                                  strokeWidth="1.5"
                                  strokeDasharray="2 2"
                                />
                                <circle
                                  cx={match.x}
                                  cy={match.y}
                                  r="6"
                                  fill="#38bdf8"
                                  stroke="#0f172a"
                                  strokeWidth="2.5"
                                  filter="url(#glow)"
                                />
                              </g>
                            );
                          })()
                        )}

                        {/* Plotted Points with Hover Interactivity */}
                        {chartPoints.map((cp, idx) => {
                          const isHovered = hoveredPoint === cp.pt;
                          return (
                            <g
                              key={idx}
                              className="cursor-pointer"
                              onMouseEnter={() => setHoveredPoint(cp.pt)}
                              onMouseLeave={() => setHoveredPoint(null)}
                            >
                              <circle
                                cx={cp.x}
                                cy={cp.y}
                                r={isHovered ? 5 : 2.5}
                                fill={isHovered ? '#38bdf8' : '#10b981'}
                                stroke="#0f172a"
                                strokeWidth="1.5"
                              />
                              <circle
                                cx={cp.x}
                                cy={cp.y}
                                r="12"
                                fill="transparent"
                              />
                            </g>
                          );
                        })}

                        {/* X-axis time labels */}
                        {chartPoints.length > 0 && (
                          <g className="font-mono text-[9px] fill-slate-500">
                            <text x={padLeft} y={svgHeight - 10} textAnchor="start">
                              {chartPoints[0].pt.timeStr}
                            </text>
                            {chartPoints.length > 2 && (
                              <text
                                x={svgWidth / 2}
                                y={svgHeight - 10}
                                textAnchor="middle"
                              >
                                {chartPoints[Math.floor(chartPoints.length / 2)].pt.timeStr}
                              </text>
                            )}
                            <text
                              x={svgWidth - padRight}
                              y={svgHeight - 10}
                              textAnchor="end"
                            >
                              {chartPoints[chartPoints.length - 1].pt.timeStr}
                            </text>
                          </g>
                        )}
                      </svg>
                    </div>

                    {/* Interactive Point Details Badge / Tooltip */}
                    <div className="bg-slate-900 border border-slate-800 rounded-lg p-3 mt-2 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
                      {hoveredPoint ? (
                        <div className="flex items-center gap-4 flex-wrap">
                          <div className="flex items-center gap-1.5 text-slate-300">
                            <Clock className="w-3.5 h-3.5 text-blue-400" />
                            <span className="font-mono font-bold text-slate-100">{hoveredPoint.timeStr}</span>
                          </div>
                          <div className="flex items-center gap-1.5">
                            <span className="text-slate-400">Raw <code className="text-amber-300">{vehicleCalib?.param || 'io_270'}</code>:</span>
                            <span className="font-mono font-bold text-amber-300">
                              {hoveredPoint.rawIo270.toLocaleString()}
                            </span>
                          </div>
                          <div className="flex items-center gap-1.5">
                            <span className="text-slate-400">Calibrated Fuel:</span>
                            <span className="font-mono font-bold text-emerald-400">
                              {toDisplayVol(hoveredPoint.fuelLiters)} {volLabel}
                            </span>
                          </div>
                          <div className="flex items-center gap-1 text-slate-400 font-mono text-[11px]">
                            <span>Formula:</span>
                            <span className="text-slate-300 bg-slate-800 px-1.5 py-0.5 rounded">
                              {hoveredPoint.formulaDesc}
                            </span>
                          </div>
                          {hoveredPoint.speed !== undefined && (
                            <div className="text-slate-400 text-[11px]">
                              Speed: <span className="text-slate-200 font-mono">{hoveredPoint.speed} km/h</span>
                            </div>
                          )}
                        </div>
                      ) : (
                        <div className="text-slate-400 flex items-center gap-2">
                          <Info className="w-4 h-4 text-slate-500 shrink-0" />
                          <span>Hover over any data point on the chart to inspect raw sensor readings and calibrated volume.</span>
                        </div>
                      )}

                      <div className="text-right shrink-0">
                        <span className="text-[11px] text-slate-500 font-mono">
                          Table: {vehicleCalib?.unitName || `Unit #${unit.id}`} (Index {vehicleCalib?.sensorIndex || '3'})
                        </span>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="h-44 flex flex-col items-center justify-center text-slate-500 gap-2 border border-slate-800/80 rounded-lg bg-slate-950/80 p-4">
                    <Fuel className="w-8 h-8 text-slate-600" />
                    <span className="text-xs">No interval telemetry message readings found for {dateLabel}.</span>
                    <div className="flex items-center gap-2 mt-1">
                      <button
                        onClick={() => setIntervalRange(intervalRange === 'today' ? '24h' : 'today')}
                        className="px-3 py-1 bg-slate-800 hover:bg-slate-700 text-emerald-400 rounded text-xs transition-colors"
                      >
                        Try {intervalRange === 'today' ? 'Last 24 Hours' : 'Today'}
                      </button>
                      <button
                        onClick={loadDayMessages}
                        className="px-3 py-1 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded text-xs transition-colors"
                      >
                        Retry Loading
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* View Tab: Detailed Telemetry Table */}
            {activeTab === 'table' && (
              <div className="border border-slate-800 rounded-lg overflow-hidden bg-slate-950">
                <div className="max-h-64 overflow-y-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-900 sticky top-0 border-b border-slate-800 text-slate-400 font-semibold">
                      <tr>
                        <th className="p-2.5">Time</th>
                        <th className="p-2.5 font-mono text-amber-300">Raw Value ({vehicleCalib?.param || 'io_270'})</th>
                        <th className="p-2.5 font-mono text-emerald-400">Calibrated Fuel</th>
                        <th className="p-2.5">Calibration Formula</th>
                        <th className="p-2.5 text-right">Speed</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/60 font-mono text-slate-300">
                      {validMessages.map((m, idx) => (
                        <tr key={idx} className="hover:bg-slate-900/50 transition-colors">
                          <td className="p-2.5 text-slate-200">{m.timeStr}</td>
                          <td className="p-2.5 text-amber-300 font-bold">{m.rawIo270.toLocaleString()}</td>
                          <td className="p-2.5 text-emerald-400 font-bold">
                            {toDisplayVol(m.fuelLiters)} {volLabel}
                          </td>
                          <td className="p-2.5 text-slate-400 text-[11px] font-sans">
                            {m.formulaDesc}
                          </td>
                          <td className="p-2.5 text-right text-slate-400">
                            {m.speed !== undefined ? `${m.speed} km/h` : '--'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* View Tab: Configured Sensors */}
            {activeTab === 'sensors' && (
              <div className="space-y-4">
                <div className="border border-slate-800 rounded-lg overflow-hidden bg-slate-950">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-900 border-b border-slate-800 text-slate-400 font-semibold">
                      <tr>
                        <th className="p-2.5">Sensor Index</th>
                        <th className="p-2.5">Sensor Name</th>
                        <th className="p-2.5">Type (t)</th>
                        <th className="p-2.5 font-mono">Param (p)</th>
                        <th className="p-2.5">Calibration (tbl)</th>
                        <th className="p-2.5 text-right">Units</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/60 font-mono text-slate-300">
                      {sensors.length > 0 ? (
                        sensors.map((sens, idx) => {
                          const isFuelSens = sens.t?.toLowerCase() === 'fuel level' || sens.n?.toLowerCase() === 'fuel level';
                          const sensIdxStr = Object.entries(unit.sens || {}).find(([_, s]) => s.id === sens.id)?.[0] || String(idx);
                          const tblCount = Array.isArray(sens.tbl) ? sens.tbl.length : (isFuelSens && vehicleCalib?.tbl ? vehicleCalib.tbl.length : 0);

                          return (
                            <tr key={sens.id ?? idx} className={isFuelSens ? 'bg-emerald-500/5' : 'hover:bg-slate-900/40'}>
                              <td className="p-2.5 font-bold text-amber-300">
                                #{sensIdxStr}
                              </td>
                              <td className="p-2.5 font-sans font-medium text-slate-200 flex items-center gap-2">
                                <span>{sens.n || '--'}</span>
                                {isFuelSens && (
                                  <span className="text-[10px] bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 px-1.5 py-0.2 rounded">
                                    Fuel Level Sensor
                                  </span>
                                )}
                              </td>
                              <td className="p-2.5 font-sans text-slate-400 capitalize">
                                <code className="text-xs text-slate-300 bg-slate-800/60 px-1.5 py-0.5 rounded font-mono">
                                  {sens.t || '--'}
                                </code>
                              </td>
                              <td className="p-2.5 text-emerald-400">
                                {sens.p || '--'}
                              </td>
                              <td className="p-2.5 font-sans">
                                {tblCount > 0 ? (
                                  <button
                                    onClick={() => setShowTblModal(true)}
                                    className="inline-flex items-center gap-1 text-[11px] text-amber-400 hover:text-amber-300 underline font-mono"
                                  >
                                    <span>tbl ({tblCount} pts)</span>
                                    <ChevronRight className="w-3 h-3" />
                                  </button>
                                ) : (
                                  <span className="text-slate-500 text-[11px]">--</span>
                                )}
                              </td>
                              <td className="p-2.5 text-right font-bold text-slate-100">
                                {sens.m || '--'}
                              </td>
                            </tr>
                          );
                        })
                      ) : (
                        <tr>
                          <td colSpan={6} className="p-4 text-center text-slate-500">
                            No sensors configured for this vehicle.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>

                <div className="flex items-center justify-between p-3 bg-slate-900/60 border border-slate-800 rounded-lg">
                  <div className="text-xs text-slate-400">
                    Pull real sensor specifications and calibration tables directly into <code className="text-emerald-300 font-mono">calibrations.json</code>.
                  </div>
                  <button
                    onClick={handlePullCalibrations}
                    disabled={isPullingCalibrations || isDemo}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded text-xs font-medium transition-colors disabled:opacity-50"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${isPullingCalibrations ? 'animate-spin' : ''}`} />
                    <span>Sync calibrations.json from Wialon</span>
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* ======================================================== */}
          {/* VEHICLE CALIBRATION PROFILE CARD */}
          {/* ======================================================== */}
          <div className="bg-slate-950/60 border border-slate-800 rounded-lg p-4 space-y-3">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-300 flex items-center gap-2">
                <Sliders className="w-4 h-4 text-amber-400" />
                Vehicle Fuel Sensor & Calibration Profile (<code className="text-emerald-400 text-xs">calibrations.json</code>)
              </span>
              <button
                onClick={() => setShowTblModal(true)}
                className="text-xs text-amber-400 hover:text-amber-300 underline font-mono flex items-center gap-1"
              >
                <span>Inspect tbl ({vehicleCalib?.tbl?.length || 0} points)</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs font-mono">
              <div className="bg-slate-900 border border-slate-800/80 p-2.5 rounded">
                <span className="text-slate-400 block text-[11px]">Sensor Index (sens)</span>
                <span className="font-bold text-amber-300 text-sm">
                  #{vehicleCalib?.sensorIndex || '3'}
                </span>
              </div>
              <div className="bg-slate-900 border border-slate-800/80 p-2.5 rounded">
                <span className="text-slate-400 block text-[11px]">Sensor Type (t)</span>
                <span className="font-bold text-emerald-400 text-sm">
                  {vehicleCalib?.sensorType || 'fuel level'}
                </span>
              </div>
              <div className="bg-slate-900 border border-slate-800/80 p-2.5 rounded">
                <span className="text-slate-400 block text-[11px]">Telemetry Param (p)</span>
                <span className="font-bold text-slate-100 text-sm">
                  {vehicleCalib?.param || 'io_270'}
                </span>
              </div>
              <div className="bg-slate-900 border border-slate-800/80 p-2.5 rounded">
                <span className="text-slate-400 block text-[11px]">Tank Capacity</span>
                <span className="font-bold text-slate-100 text-sm">
                  {vehicleCalib?.maxCapacity || 600} L
                </span>
              </div>
            </div>
          </div>

          {/* ======================================================== */}
          {/* Hardware & Telemetry Parameters Grid */}
          {/* ======================================================== */}
          <div className="bg-slate-950/60 border border-slate-800 rounded-lg p-4 space-y-3">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-300 flex items-center gap-2">
              <Zap className="w-4 h-4 text-amber-400" />
              Latest Telemetry Parameters (<code className="text-emerald-400 text-xs">lmsg.p</code>)
            </span>

            {rawParams.length > 0 ? (
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2 text-xs font-mono">
                {rawParams.map(([k, v]) => (
                  <div
                    key={k}
                    className="bg-slate-900 border border-slate-800/80 p-2 rounded flex items-center justify-between"
                  >
                    <span className="text-slate-400 truncate mr-2">{k}:</span>
                    <span className="font-semibold text-emerald-300 truncate">
                      {String(v ?? '')}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-xs text-slate-500 font-mono p-2">
                No raw telemetry parameters recorded.
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ======================================================== */}
      {/* MODAL / DRAWER: Calibration Table (tbl) Inspector */}
      {/* ======================================================== */}
      {showTblModal && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md"
          onClick={() => setShowTblModal(false)}
        >
          <div
            className="bg-slate-900 border border-slate-800 rounded-xl max-w-2xl w-full max-h-[85vh] flex flex-col overflow-hidden shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            {/* TBL Header */}
            <div className="flex items-center justify-between p-4 border-b border-slate-800 bg-slate-950/80">
              <div className="flex items-center gap-2.5">
                <Sliders className="w-5 h-5 text-amber-400" />
                <div>
                  <h4 className="text-sm sm:text-base font-bold text-slate-100">
                    Calibration Table (<code className="text-amber-400">tbl</code>) for Vehicle #{unit.id}
                  </h4>
                  <p className="text-xs text-slate-400">
                    Saved in <code className="text-emerald-300 font-mono">calibrations.json</code> (Sensor Index: <span className="text-amber-300 font-bold">{vehicleCalib?.sensorIndex || '3'}</span>)
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowTblModal(false)}
                className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* TBL Body */}
            <div className="p-4 sm:p-5 overflow-y-auto space-y-4 text-xs">
              {/* Profile summary info */}
              <div className="bg-slate-950/80 border border-slate-800 rounded-lg p-3 space-y-1.5 font-mono text-[11px]">
                <div className="flex justify-between">
                  <span className="text-slate-400">Vehicle:</span>
                  <span className="text-slate-200 font-semibold">{vehicleCalib?.unitName || unit.nm}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Sensor Parameter:</span>
                  <span className="text-emerald-400 font-bold">{vehicleCalib?.param || 'io_270'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Sensor Name / Index:</span>
                  <span className="text-slate-200">
                    {vehicleCalib?.sensorName || 'Fuel Level'} (index <span className="text-amber-300 font-bold">{vehicleCalib?.sensorIndex || '3'}</span>)
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Sensor Type:</span>
                  <span className="text-emerald-300">{vehicleCalib?.sensorType || 'fuel level'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Tank Max Capacity:</span>
                  <span className="text-slate-200">{vehicleCalib?.maxCapacity || 600} L</span>
                </div>
              </div>

              {/* Translation Formula Explanation */}
              <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-lg p-3 text-emerald-300 space-y-1">
                <div className="font-semibold text-xs flex items-center gap-1.5 text-emerald-200">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                  Wialon Calculation Table Formula
                </div>
                <p className="text-[11px] leading-relaxed">
                  For each telemetry reading <code className="font-mono bg-emerald-950/60 px-1 rounded">X</code>, the system locates the interval where <code className="font-mono bg-emerald-950/60 px-1 rounded">x &le; X</code>, and computes calibrated volume via <code className="font-mono font-bold bg-emerald-950/60 px-1.5 py-0.5 rounded">Y = a &times; X + b</code>.
                </p>
              </div>

              {/* Interactive Calculator */}
              <div className="bg-slate-950 border border-slate-800 rounded-lg p-3 space-y-2">
                <span className="text-slate-300 font-semibold flex items-center gap-1.5">
                  <Calculator className="w-3.5 h-3.5 text-blue-400" />
                  Test Live Translation Formula
                </span>
                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-2 flex-1">
                    <span className="text-slate-400 font-mono text-[11px]">Raw {vehicleCalib?.param || 'io_270'}:</span>
                    <input
                      type="number"
                      value={testRawX}
                      onChange={(e) => setTestRawX(e.target.value)}
                      className="bg-slate-900 border border-slate-700 rounded px-2 py-1 text-slate-100 font-mono text-xs w-28 focus:border-emerald-500"
                      placeholder="e.g. 2500"
                    />
                  </div>
                  <div className="flex items-center gap-2 font-mono">
                    <span className="text-slate-400">&rarr;</span>
                    <span className="text-emerald-400 font-bold text-sm">
                      {testCalculatedResult ? `${toDisplayVol(testCalculatedResult.fuelLiters)} ${volLabel}` : '--'}
                    </span>
                  </div>
                </div>
                {testCalculatedResult && (
                  <div className="text-[11px] font-mono text-slate-400">
                    Applied: <code className="text-slate-300">{testCalculatedResult.formulaDesc}</code>
                  </div>
                )}
              </div>

              {/* TBL Calibration Points Table */}
              <div className="border border-slate-800 rounded-lg overflow-hidden bg-slate-950">
                <div className="max-h-60 overflow-y-auto">
                  <table className="w-full text-left font-mono text-xs">
                    <thead className="bg-slate-900 sticky top-0 border-b border-slate-800 text-slate-400 font-semibold">
                      <tr>
                        <th className="p-2">#</th>
                        <th className="p-2 text-amber-300">Raw X ({vehicleCalib?.param || 'io_270'})</th>
                        <th className="p-2 text-blue-300">Slope (a)</th>
                        <th className="p-2 text-purple-300">Offset (b)</th>
                        <th className="p-2 text-emerald-400 text-right">Volume (Y)</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/60 text-slate-300">
                      {vehicleCalib?.tbl && vehicleCalib.tbl.length > 0 ? (
                        vehicleCalib.tbl.map((pt, i) => {
                          const computedY = pt.y !== undefined
                            ? pt.y
                            : (pt.a !== undefined && pt.b !== undefined ? Math.round((pt.a * pt.x + pt.b) * 10) / 10 : '--');
                          return (
                            <tr key={i} className="hover:bg-slate-900/50">
                              <td className="p-2 text-slate-500">{i + 1}</td>
                              <td className="p-2 text-amber-300 font-bold">{pt.x.toLocaleString()}</td>
                              <td className="p-2 text-blue-300">{pt.a !== undefined ? pt.a : '--'}</td>
                              <td className="p-2 text-purple-300">{pt.b !== undefined ? pt.b : '--'}</td>
                              <td className="p-2 text-emerald-400 font-bold text-right">{computedY} L</td>
                            </tr>
                          );
                        })
                      ) : (
                        <tr>
                          <td colSpan={5} className="p-4 text-center text-slate-500">
                            No calibration table (tbl) defined for this vehicle.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>

            {/* TBL Footer */}
            <div className="p-3 bg-slate-950/80 border-t border-slate-800 flex items-center justify-between text-xs">
              <span className="text-slate-400 font-mono text-[11px]">
                {vehicleCalib?.tbl?.length || 0} calibration segments configured
              </span>
              <button
                onClick={() => setShowTblModal(false)}
                className="px-3 py-1 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded font-medium transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
