import React, { useState, useMemo } from 'react';
import {
  Truck,
  Search,
  Download,
  RefreshCw,
  Fuel,
  Gauge,
  MapPin,
  Clock,
  Activity,
  AlertCircle,
  ChevronRight,
  ChevronUp,
  ChevronDown,
  ExternalLink,
} from 'lucide-react';
import { WialonUnit } from '../types/wialon';

interface UnitsTableInterfaceProps {
  units: WialonUnit[];
  isLoading: boolean;
  onRefresh: () => void;
  onSelectUnit: (unit: WialonUnit) => void;
  accountName: string;
}

type SortField = 'nm' | 'state' | 'fuelLevel' | 'speed' | 'lastPing';

export const UnitsTableInterface: React.FC<UnitsTableInterfaceProps> = ({
  units,
  isLoading,
  onRefresh,
  onSelectUnit,
  accountName,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [stateFilter, setStateFilter] = useState<'all' | 'moving' | 'idling' | 'parked' | 'offline' | 'low-fuel'>('all');
  const [fuelUnit, setFuelUnit] = useState<'liters' | 'gallons'>('liters');
  const [sortField, setSortField] = useState<SortField>('nm');
  const [sortAsc, setSortAsc] = useState(true);

  // Conversion helpers (returns '--' if null or undefined)
  const toDisplayVol = (liters: number | null | undefined): string => {
    if (liters === null || liters === undefined) return '--';
    if (fuelUnit === 'gallons') {
      return (liters * 0.264172).toFixed(1);
    }
    return liters.toFixed(1);
  };
  const volLabel = fuelUnit === 'gallons' ? 'gal' : 'L';

  // KPI Calculations
  const totalFleetUnits = units.length;
  const movingCount = units.filter((u) => u.state === 'moving').length;
  const idlingCount = units.filter((u) => u.state === 'idling').length;
  const parkedCount = units.filter((u) => u.state === 'parked').length;
  const unitsWithFuel = units.filter((u) => u.fuel?.currentLevel !== null && u.fuel?.currentLevel !== undefined);
  const totalFuelLiters = unitsWithFuel.reduce((acc, u) => acc + (u.fuel?.currentLevel || 0), 0);

  // Filtered and sorted units
  const filteredUnits = useMemo(() => {
    return units
      .filter((u) => {
        // State Filter
        if (stateFilter === 'low-fuel') {
          if (u.fuel?.currentLevel === null || u.fuel?.currentLevel === undefined || u.fuel.currentLevel >= 50) {
            return false;
          }
        } else if (stateFilter !== 'all' && u.state !== stateFilter) {
          return false;
        }

        // Search Filter (name, plate, VIN, driver, id)
        if (searchQuery.trim()) {
          const q = searchQuery.toLowerCase();
          const matchName = (u.nm || '').toLowerCase().includes(q);
          const matchPlate = (u.profile?.plate || '').toLowerCase().includes(q);
          const matchVin = (u.profile?.vin || '').toLowerCase().includes(q);
          const matchDriver = (u.profile?.driver || '').toLowerCase().includes(q);
          const matchId = String(u.id).includes(q);
          if (!matchName && !matchPlate && !matchVin && !matchDriver && !matchId) {
            return false;
          }
        }

        return true;
      })
      .sort((a, b) => {
        let valA: any = 0;
        let valB: any = 0;

        switch (sortField) {
          case 'nm':
            valA = (a.nm || '').toLowerCase();
            valB = (b.nm || '').toLowerCase();
            break;
          case 'state':
            valA = a.state;
            valB = b.state;
            break;
          case 'fuelLevel':
            valA = a.fuel?.currentLevel ?? -1;
            valB = b.fuel?.currentLevel ?? -1;
            break;
          case 'speed':
            valA = a.pos?.s ?? -1;
            valB = b.pos?.s ?? -1;
            break;
          case 'lastPing':
            valA = a.lmsg?.t ?? 0;
            valB = b.lmsg?.t ?? 0;
            break;
        }

        if (valA < valB) return sortAsc ? -1 : 1;
        if (valA > valB) return sortAsc ? 1 : -1;
        return 0;
      });
  }, [units, searchQuery, stateFilter, sortField, sortAsc]);

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortAsc(!sortAsc);
    } else {
      setSortField(field);
      setSortAsc(true);
    }
  };

  const handleExportCSV = () => {
    if (units.length === 0) return;

    const headers = [
      'Unit ID',
      'Name',
      'License Plate',
      'VIN',
      'Driver',
      'State',
      'Speed (km/h)',
      `Fuel Level (${volLabel})`,
      'Latitude',
      'Longitude',
      'Google Maps URL',
      'Last Message Timestamp',
    ];

    const rows = filteredUnits.map((u) => [
      u.id,
      `"${(u.nm || '').replace(/"/g, '""')}"`,
      `"${(u.profile?.plate || '--').replace(/"/g, '""')}"`,
      `"${(u.profile?.vin || '--').replace(/"/g, '""')}"`,
      `"${(u.profile?.driver || '--').replace(/"/g, '""')}"`,
      u.state,
      u.pos?.s !== undefined ? u.pos.s : '--',
      toDisplayVol(u.fuel?.currentLevel),
      u.pos?.y !== undefined ? u.pos.y : '--',
      u.pos?.x !== undefined ? u.pos.x : '--',
      u.pos?.y !== undefined && u.pos?.x !== undefined ? `https://www.google.com/maps?q=${u.pos.y},${u.pos.x}` : '--',
      u.lmsg?.t ? new Date(u.lmsg.t * 1000).toISOString() : '--',
    ]);

    const csvContent = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `wialon_units_${accountName.replace(/\s+/g, '_')}_${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-6">
      {/* Fleet Telemetry KPI Ribbon */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-3.5 space-y-1">
          <span className="text-[11px] font-medium text-slate-400 flex items-center justify-between">
            <span>Fleet Units</span>
            <Truck className="w-3.5 h-3.5 text-slate-500" />
          </span>
          <div className="text-xl font-bold font-mono text-white tabular-nums">
            {totalFleetUnits}
          </div>
          <div className="text-[11px] text-slate-500">
            Registered in account
          </div>
        </div>

        <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-3.5 space-y-1">
          <span className="text-[11px] font-medium text-slate-400 flex items-center justify-between">
            <span>In Motion</span>
            <Gauge className="w-3.5 h-3.5 text-emerald-400" />
          </span>
          <div className="text-xl font-bold font-mono text-emerald-400 tabular-nums">
            {movingCount}
          </div>
          <div className="text-[11px] text-slate-500">
            Active speed &gt; 5 km/h
          </div>
        </div>

        <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-3.5 space-y-1">
          <span className="text-[11px] font-medium text-slate-400 flex items-center justify-between">
            <span>Idling Engine</span>
            <Clock className="w-3.5 h-3.5 text-amber-400" />
          </span>
          <div className="text-xl font-bold font-mono text-amber-400 tabular-nums">
            {idlingCount}
          </div>
          <div className="text-[11px] text-slate-500">
            Ignition on, stationary
          </div>
        </div>

        <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-3.5 space-y-1">
          <span className="text-[11px] font-medium text-slate-400 flex items-center justify-between">
            <span>Parked</span>
            <Activity className="w-3.5 h-3.5 text-blue-400" />
          </span>
          <div className="text-xl font-bold font-mono text-slate-200 tabular-nums">
            {parkedCount}
          </div>
          <div className="text-[11px] text-slate-500">
            Engine off
          </div>
        </div>

        <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-3.5 space-y-1">
          <span className="text-[11px] font-medium text-slate-400 flex items-center justify-between">
            <span>Total Fleet Fuel</span>
            <Fuel className="w-3.5 h-3.5 text-emerald-400" />
          </span>
          <div className="text-xl font-bold font-mono text-emerald-400 tabular-nums">
            {unitsWithFuel.length > 0 ? `${toDisplayVol(totalFuelLiters)} ${volLabel}` : '--'}
          </div>
          <div className="text-[11px] text-slate-500">
            {unitsWithFuel.length > 0 ? `Across ${unitsWithFuel.length} units with fuel data` : 'No fuel readings reported'}
          </div>
        </div>
      </div>

      {/* Action Toolbar & Filters */}
      <div className="bg-slate-900/40 border border-slate-800 rounded-xl p-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
        {/* Left: Search input */}
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 text-slate-500 absolute left-3 top-2.5" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by vehicle name, plate, VIN, driver, or ID..."
            className="w-full bg-slate-950 border border-slate-800 focus:border-emerald-500 rounded-lg pl-9 pr-3 py-2 text-xs text-slate-100 placeholder:text-slate-600 transition-colors"
          />
        </div>

        {/* Center: State filter tabs */}
        <div className="flex items-center gap-1 p-1 bg-slate-950/80 border border-slate-800/80 rounded-lg overflow-x-auto">
          {(
            [
              { key: 'all', label: 'All Units' },
              { key: 'moving', label: 'Moving' },
              { key: 'idling', label: 'Idling' },
              { key: 'parked', label: 'Parked' },
              { key: 'low-fuel', label: 'Low Fuel (<50L)' },
            ] as const
          ).map((tab) => (
            <button
              key={tab.key}
              onClick={() => setStateFilter(tab.key)}
              className={`px-2.5 py-1 text-xs font-medium rounded transition-colors whitespace-nowrap shrink-0 ${
                stateFilter === tab.key
                  ? 'bg-slate-800 text-emerald-400 shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Right: Controls (Fuel Unit, CSV, Refresh) */}
        <div className="flex items-center gap-2 shrink-0">
          {/* Unit Toggle: Liters / Gallons */}
          <div className="flex items-center bg-slate-950 border border-slate-800 rounded-lg p-0.5 text-xs">
            <button
              onClick={() => setFuelUnit('liters')}
              className={`px-2 py-1 rounded font-medium transition-colors ${
                fuelUnit === 'liters' ? 'bg-slate-800 text-emerald-400' : 'text-slate-500 hover:text-slate-300'
              }`}
            >
              Liters
            </button>
            <button
              onClick={() => setFuelUnit('gallons')}
              className={`px-2 py-1 rounded font-medium transition-colors ${
                fuelUnit === 'gallons' ? 'bg-slate-800 text-emerald-400' : 'text-slate-500 hover:text-slate-300'
              }`}
            >
              Gallons
            </button>
          </div>

          <button
            onClick={handleExportCSV}
            disabled={filteredUnits.length === 0}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 active:scale-95 border border-slate-700 rounded-lg transition-all disabled:opacity-50 whitespace-nowrap"
            title="Export filtered units table to CSV"
          >
            <Download className="w-3.5 h-3.5 text-slate-400" />
            <span className="hidden sm:inline">Export CSV</span>
          </button>

          <button
            onClick={onRefresh}
            disabled={isLoading}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 active:scale-95 border border-slate-700 rounded-lg transition-all disabled:opacity-50"
            title="Refresh units data from Wialon API"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin text-emerald-400' : ''}`} />
          </button>
        </div>
      </div>

      {/* Units Data Table */}
      <div className="bg-slate-900/30 border border-slate-800 rounded-xl overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead className="bg-slate-950/80 border-b border-slate-800 text-slate-400 font-semibold select-none">
              <tr>
                {/* Column 1: Unit & Profile */}
                <th
                  onClick={() => handleSort('nm')}
                  className="p-3.5 cursor-pointer hover:text-slate-200 transition-colors whitespace-nowrap"
                >
                  <div className="flex items-center gap-1.5">
                    <span>Unit & Profile</span>
                    {sortField === 'nm' && (
                      sortAsc ? <ChevronUp className="w-3.5 h-3.5 text-emerald-400" /> : <ChevronDown className="w-3.5 h-3.5 text-emerald-400" />
                    )}
                  </div>
                </th>

                {/* Column 2: Status & Speed */}
                <th
                  onClick={() => handleSort('state')}
                  className="p-3.5 cursor-pointer hover:text-slate-200 transition-colors whitespace-nowrap"
                >
                  <div className="flex items-center gap-1.5">
                    <span>Status & Speed</span>
                    {sortField === 'state' && (
                      sortAsc ? <ChevronUp className="w-3.5 h-3.5 text-emerald-400" /> : <ChevronDown className="w-3.5 h-3.5 text-emerald-400" />
                    )}
                  </div>
                </th>

                {/* Column 3: Fuel Level */}
                <th
                  onClick={() => handleSort('fuelLevel')}
                  className="p-3.5 cursor-pointer hover:text-slate-200 transition-colors whitespace-nowrap"
                >
                  <div className="flex items-center gap-1.5">
                    <span>Fuel Level ({volLabel})</span>
                    {sortField === 'fuelLevel' && (
                      sortAsc ? <ChevronUp className="w-3.5 h-3.5 text-emerald-400" /> : <ChevronDown className="w-3.5 h-3.5 text-emerald-400" />
                    )}
                  </div>
                </th>

                {/* Column 4: Latest Location */}
                <th className="p-3.5 whitespace-nowrap">
                  <span>Latest Location</span>
                </th>

                {/* Column 5: Last Ping */}
                <th
                  onClick={() => handleSort('lastPing')}
                  className="p-3.5 cursor-pointer hover:text-slate-200 transition-colors whitespace-nowrap"
                >
                  <div className="flex items-center gap-1.5">
                    <span>Last Ping</span>
                    {sortField === 'lastPing' && (
                      sortAsc ? <ChevronUp className="w-3.5 h-3.5 text-emerald-400" /> : <ChevronDown className="w-3.5 h-3.5 text-emerald-400" />
                    )}
                  </div>
                </th>

                {/* Column 6: Actions */}
                <th className="p-3.5 text-right whitespace-nowrap">
                  <span>Actions</span>
                </th>
              </tr>
            </thead>

            <tbody className="divide-y divide-slate-800/60">
              {filteredUnits.length > 0 ? (
                filteredUnits.map((unit) => {
                  const hasPing = unit.lmsg?.t !== undefined && unit.lmsg.t > 0;
                  const lastPingSeconds = hasPing
                    ? Math.max(0, Math.floor(Date.now() / 1000 - unit.lmsg!.t))
                    : null;

                  const hasPlate = Boolean(unit.profile?.plate);
                  const hasDriver = Boolean(unit.profile?.driver);

                  return (
                    <tr
                      key={unit.id}
                      onClick={() => onSelectUnit(unit)}
                      className="hover:bg-slate-800/40 cursor-pointer transition-colors group"
                    >
                      {/* Column 1: Unit & Profile (shows real values from API, or --) */}
                      <td className="p-3.5">
                        <div className="space-y-0.5">
                          <div className="font-semibold text-slate-100 group-hover:text-emerald-400 transition-colors">
                            {unit.nm || '--'}
                          </div>
                          <div className="text-[11px] text-slate-400 flex items-center gap-2">
                            <span className="font-mono text-slate-500">#{unit.id}</span>
                            {hasPlate && (
                              <>
                                <span aria-hidden="true">·</span>
                                <span className="text-slate-300">{unit.profile?.plate}</span>
                              </>
                            )}
                            {hasDriver && (
                              <>
                                <span aria-hidden="true">·</span>
                                <span>{unit.profile?.driver}</span>
                              </>
                            )}
                          </div>
                        </div>
                      </td>

                      {/* Column 2: Status & Speed (real values from API, or --) */}
                      <td className="p-3.5 whitespace-nowrap">
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <span
                              className={`px-2 py-0.5 rounded text-[11px] font-medium capitalize ${
                                unit.state === 'moving'
                                  ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                                  : unit.state === 'idling'
                                  ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                                  : unit.state === 'offline'
                                  ? 'bg-red-500/10 text-red-400 border border-red-500/20'
                                  : 'bg-slate-800 text-slate-300'
                              }`}
                            >
                              {unit.state}
                            </span>
                          </div>
                          <div className="text-[11px] font-mono text-slate-400 tabular-nums">
                            {unit.pos?.s !== undefined ? (
                              unit.state === 'moving' ? (
                                <span className="text-emerald-300 font-semibold">
                                  {unit.pos.s} km/h
                                </span>
                              ) : unit.state === 'idling' ? (
                                <span className="text-amber-300">0 km/h · Idle</span>
                              ) : (
                                <span>0 km/h</span>
                              )
                            ) : (
                              <span>--</span>
                            )}
                          </div>
                        </div>
                      </td>

                      {/* Column 3: Fuel Level (real litre value from API, or -- if not available) */}
                      <td className="p-3.5 whitespace-nowrap">
                        {unit.fuel.currentLevel !== null && unit.fuel.currentLevel !== undefined ? (
                          <span className="font-mono font-bold text-slate-100 text-sm tabular-nums">
                            {toDisplayVol(unit.fuel.currentLevel)} {volLabel}
                          </span>
                        ) : (
                          <span className="font-mono text-slate-500 text-sm">--</span>
                        )}
                      </td>

                      {/* Column 4: Latest Location (Google Maps link if coordinates available, or --) */}
                      <td className="p-3.5 whitespace-nowrap">
                        {unit.pos?.y !== undefined && unit.pos?.x !== undefined ? (
                          <div className="space-y-0.5">
                            <a
                              href={`https://www.google.com/maps?q=${unit.pos.y},${unit.pos.x}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              onClick={(e) => e.stopPropagation()}
                              className="inline-flex items-center gap-1.5 font-mono text-xs text-emerald-400 hover:text-emerald-300 hover:underline transition-colors tabular-nums group/link"
                              title="Open coordinates in Google Maps"
                            >
                              <MapPin className="w-3.5 h-3.5 shrink-0 text-emerald-400" />
                              <span>
                                {unit.pos.y.toFixed(4)}, {unit.pos.x.toFixed(4)}
                              </span>
                              <ExternalLink className="w-3 h-3 opacity-60 group-hover/link:opacity-100" />
                            </a>
                            <div className="text-[11px] text-slate-500 font-mono">
                              Course: {unit.pos.c !== undefined ? `${unit.pos.c}°` : '--'} {unit.pos.sc ? `· ${unit.pos.sc} sats` : ''}
                            </div>
                          </div>
                        ) : (
                          <span className="text-slate-500 font-mono text-sm">--</span>
                        )}
                      </td>

                      {/* Column 5: Last Ping (real time, or --) */}
                      <td className="p-3.5 font-mono text-[11px] text-slate-400 whitespace-nowrap tabular-nums">
                        {lastPingSeconds !== null ? (
                          lastPingSeconds < 60
                            ? `${lastPingSeconds}s ago`
                            : lastPingSeconds < 3600
                            ? `${Math.floor(lastPingSeconds / 60)}m ago`
                            : `${Math.floor(lastPingSeconds / 3600)}h ago`
                        ) : (
                          <span className="text-slate-500">--</span>
                        )}
                      </td>

                      {/* Column 6: Actions */}
                      <td className="p-3.5 text-right whitespace-nowrap">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            onSelectUnit(unit);
                          }}
                          className="px-2.5 py-1 text-[11px] font-medium text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 rounded transition-colors inline-flex items-center gap-1"
                        >
                          <span>Dossier</span>
                          <ChevronRight className="w-3 h-3 text-slate-400" />
                        </button>
                      </td>
                    </tr>
                  );
                })
              ) : (
                /* Empty state when no units match filter */
                <tr>
                  <td colSpan={6} className="p-12 text-center text-slate-500">
                    <Truck className="w-8 h-8 mx-auto text-slate-600 mb-2" />
                    <div className="text-sm font-semibold text-slate-300">
                      No units available
                    </div>
                    <div className="text-xs text-slate-500 mt-1">
                      Check that the stored API token has permissions to view units in this account.
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
