export interface WialonUser {
  id: number;
  nm: string;
  cls?: number;
  prp?: Record<string, any>;
}

export interface WialonSession {
  token: string;
  host: string;
  sid: string;
  accountName: string;
  userName: string;
  userId: number;
  lastLoginTime: number;
  status: 'connected' | 'refreshing' | 'error' | 'disconnected';
  lastError?: string;
  refreshCount: number;
  nextRefreshIn: number;
  isDemo: boolean;
}

export interface SessionHistoryEntry {
  id: string;
  timestamp: number;
  sid: string;
  latencyMs: number;
  status: 'success' | 'failed';
  error?: string;
}

export interface WialonSensor {
  id: number;
  n: string; // name
  t: string; // type (e.g., "fuel level", "ignition", "engine hours")
  d?: string; // description
  m?: string; // measurement unit (e.g., "l", "km/h", "V")
  p?: string; // parameter in message (e.g., "pwr_ext", "adc1", "can_fuel")
  tbl?: Array<{ x: number; a: number; b: number }>; // calibration table
}

export interface FuelTransaction {
  id: string;
  type: 'Refuel' | 'Drain' | 'Trip Consumption';
  volumeLiters: number;
  timestamp: number;
  locationName: string;
  startLevelLiters: number;
  endLevelLiters: number;
  driver?: string;
  cost?: number;
}

export interface WialonUnit {
  id: number;
  nm: string;
  cls?: number;
  mu: number; // 0 = metric (km, L), 1 = US (mi, gal), 2 = imperial
  pos?: {
    t: number;
    y: number; // latitude
    x: number; // longitude
    c: number; // course
    s: number; // speed
    sc?: number; // satellites
  };
  lmsg?: {
    t: number;
    p?: Record<string, any>;
  };
  sens?: Record<string, WialonSensor>;
  cfl?: number;
  cnm?: number;
  cmsg?: number;
  // Enhanced calculated fuel telemetry
  fuel: {
    currentLevel: number | null; // in litres or null if not available
    maxCapacity?: number | null;
    percentage?: number | null;
    sensorType?: string;
    avgConsumptionLper100km?: number | null;
    totalConsumedLiters?: number | null;
    recentTransactions: FuelTransaction[];
    levelHistory: Array<{ timestamp: number; level: number; speed: number }>;
    calcSensorId?: number;
    calcSensorName?: string;
    calcSensorUnit?: string;
    calcSensorFormat?: string;
    calcEndpoint?: string;
  };
  profile: {
    vin?: string;
    plate?: string;
    model?: string;
    driver?: string;
    deviceType?: string;
    imei?: string;
  };
  state: 'moving' | 'idling' | 'parked' | 'offline';
  mileageKm: number | null;
  engineHours: number | null;
}
