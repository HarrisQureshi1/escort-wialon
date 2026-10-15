import baseCalibrations from '../data/calibrations.json';

export interface CalibrationPoint {
  x: number; // raw telemetry value (e.g. io_270)
  a?: number; // slope coefficient (ΔY / ΔX)
  b?: number; // displacement / intercept
  y?: number; // calibrated volume in litres
}

export interface VehicleCalibration {
  unitId: number | string;
  unitName?: string;
  sensorIndex?: string; // index in sens, e.g. "3" for #600469230, "2" for other unit
  sensorId?: number;
  sensorName?: string;
  sensorType?: string; // e.g. "fuel level"
  measurementUnit?: string; // e.g. "l"
  param?: string; // e.g. "io_270"
  maxCapacity?: number;
  description?: string;
  flags?: number;
  calcParams?: string;
  validationType?: number;
  validationSensor?: number;
  tbl: CalibrationPoint[];
  allFuelSensors?: any[];
}

// In-memory runtime cache merging base calibrations and live Wialon tbl objects
let dynamicCalibrations: Record<string, VehicleCalibration> = {
  ...(baseCalibrations as unknown as Record<string, VehicleCalibration>),
};

/**
 * Retrieve the calibration profile for a specific vehicle by unit ID.
 */
export function getVehicleCalibration(unitId: number | string): VehicleCalibration | undefined {
  const key = String(unitId);
  return dynamicCalibrations[key];
}

/**
 * Retrieve all registered vehicle calibrations.
 */
export function getAllVehicleCalibrations(): Record<string, VehicleCalibration> {
  return { ...dynamicCalibrations };
}

/**
 * Extract all sensor details and calibration tables for all units that have a sensor with "t": "fuel level".
 * This inspects each unit individually, correctly mapping the specific sensor index (e.g. index 3 for #600469230, index 2 for other units).
 */
export function extractFuelSensorsFromRawUnits(rawUnits: any[]): Record<string, VehicleCalibration> {
  const result: Record<string, VehicleCalibration> = {};
  if (!Array.isArray(rawUnits)) return result;

  for (const unit of rawUnits) {
    if (!unit || !unit.sens) continue;
    const sensObj = unit.sens;
    const unitFuelSensors: any[] = [];

    // Loop through individual unit's sens mapping
    for (const [sensIdx, sensor] of Object.entries(sensObj)) {
      if (!sensor || typeof sensor !== 'object') continue;
      const sType = String((sensor as any).t || '').trim().toLowerCase();

      // Look for sensor where "t" is "fuel level"
      if (sType === 'fuel level') {
        const s = sensor as any;
        const tblArray: any[] = Array.isArray(s.tbl) ? s.tbl : [];

        const cleanTbl: CalibrationPoint[] = tblArray.map((pt: any) => ({
          x: Number(pt.x ?? 0),
          a: pt.a !== undefined ? Number(pt.a) : undefined,
          b: pt.b !== undefined ? Number(pt.b) : undefined,
          y: pt.y !== undefined ? Number(pt.y) : undefined,
        }));
        cleanTbl.sort((p1, p2) => p1.x - p2.x);

        let maxCap = 600;
        if (cleanTbl.length > 0) {
          const highestY = Math.max(
            ...cleanTbl.map((pt) => {
              if (pt.y !== undefined) return Number(pt.y);
              if (pt.a !== undefined && pt.b !== undefined && pt.x !== undefined) {
                return Number(pt.a) * Number(pt.x) + Number(pt.b);
              }
              return 0;
            })
          );
          if (highestY > 0) {
            maxCap = Math.round(highestY);
          }
        }

        const fuelSensDetail = {
          sensorIndex: String(sensIdx),
          sensorId: s.id !== undefined ? Number(s.id) : undefined,
          sensorName: s.n || 'Fuel Level',
          sensorType: s.t || 'fuel level',
          description: s.d || 'Fuel level sensor',
          measurementUnit: s.m || 'l',
          param: s.p || 'io_270',
          flags: s.f,
          calcParams: s.c,
          validationType: s.vt,
          validationSensor: s.vs,
          maxCapacity: maxCap,
          tbl: cleanTbl,
        };

        unitFuelSensors.push(fuelSensDetail);
      }
    }

    if (unitFuelSensors.length > 0) {
      // Primary fuel sensor (first with t: "fuel level")
      const primary = unitFuelSensors[0];
      const entry: VehicleCalibration = {
        unitId: unit.id,
        unitName: unit.nm || `Unit #${unit.id}`,
        sensorIndex: primary.sensorIndex,
        sensorId: primary.sensorId,
        sensorName: primary.sensorName,
        sensorType: primary.sensorType,
        measurementUnit: primary.measurementUnit,
        param: primary.param,
        description: primary.description,
        flags: primary.flags,
        calcParams: primary.calcParams,
        validationType: primary.validationType,
        validationSensor: primary.validationSensor,
        maxCapacity: primary.maxCapacity,
        tbl: primary.tbl,
        allFuelSensors: unitFuelSensors,
      };

      result[String(unit.id)] = entry;
      dynamicCalibrations[String(unit.id)] = entry;
    }
  }

  return result;
}

/**
 * Sync extracted calibrations with server to persist to calibrations.json
 */
export async function syncCalibrationsWithServer(calibrations: Record<string, VehicleCalibration>): Promise<boolean> {
  try {
    const res = await fetch('/api/calibrations/save', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ calibrations }),
    });
    if (res.ok) {
      const data = await res.json();
      console.log(`[CalibrationService] Successfully synced ${data.count} calibrations to calibrations.json`);
      return true;
    }
  } catch (err) {
    console.warn('[CalibrationService] Could not sync calibrations to server:', err);
  }
  return false;
}

/**
 * Fetch fresh calibrations.json from server on initialization
 */
export async function loadCalibrationsFromServer(): Promise<Record<string, VehicleCalibration>> {
  try {
    const res = await fetch('/api/calibrations');
    if (res.ok) {
      const data = await res.json();
      if (data && typeof data === 'object') {
        dynamicCalibrations = { ...dynamicCalibrations, ...data };
        return dynamicCalibrations;
      }
    }
  } catch (err) {
    console.warn('[CalibrationService] Could not load calibrations from server:', err);
  }
  return dynamicCalibrations;
}

/**
 * Dynamically register or update a unit's calibration table from Wialon `sens` object.
 * When `core/search_items` returns a unit whose fuel sensor has a `tbl` object,
 * this function records it for subsequent message translation.
 */
export function registerUnitCalibration(
  unitId: number | string,
  unitName: string,
  sensObj?: Record<string, any>
): void {
  if (!sensObj || typeof sensObj !== 'object') return;

  const key = String(unitId);

  // Look for sensor with "t": "fuel level" or "Fuel Level" or param "io_270" with a tbl object
  for (const [sensIdx, sensor] of Object.entries(sensObj)) {
    if (!sensor || typeof sensor !== 'object') continue;
    const type = String(sensor.t || '').trim().toLowerCase();
    const name = String(sensor.n || '').trim().toLowerCase();
    const param = String(sensor.p || '').trim().toLowerCase();

    const isFuelSensor =
      type === 'fuel level' ||
      name === 'fuel level' ||
      param === 'io_270' ||
      name.includes('fuel');

    if (isFuelSensor && Array.isArray(sensor.tbl) && sensor.tbl.length > 0) {
      const cleanTbl: CalibrationPoint[] = sensor.tbl.map((pt: any) => ({
        x: Number(pt.x ?? 0),
        a: pt.a !== undefined ? Number(pt.a) : undefined,
        b: pt.b !== undefined ? Number(pt.b) : undefined,
        y: pt.y !== undefined ? Number(pt.y) : undefined,
      }));

      // Sort points ascending by x
      cleanTbl.sort((p1, p2) => p1.x - p2.x);

      dynamicCalibrations[key] = {
        unitId,
        unitName: unitName || `Unit #${unitId}`,
        sensorIndex: String(sensIdx),
        sensorId: sensor.id !== undefined ? Number(sensor.id) : undefined,
        sensorName: sensor.n || 'Fuel Level',
        sensorType: sensor.t || 'fuel level',
        measurementUnit: sensor.m || 'l',
        param: sensor.p || 'io_270',
        description: sensor.d || `Wialon sensor #${sensor.id || sensIdx}`,
        flags: sensor.f,
        calcParams: sensor.c,
        validationType: sensor.vt,
        validationSensor: sensor.vs,
        tbl: cleanTbl,
      };
      break;
    }
  }
}

/**
 * Translate a raw `io_270` reading into fuel volume (Litres) using the vehicle's calibration table.
 * Follows the official Wialon calculation table algorithm:
 * Y = a * X + b for the interval containing X,
 * or piecewise linear interpolation if only (x, y) coordinates are provided.
 */
export function translateIo270ToFuel(
  rawIo270: number | null | undefined,
  unitId: number | string
): {
  fuelLiters: number;
  formulaDesc: string;
  matchedPoint?: CalibrationPoint;
  isCalibrated: boolean;
} {
  if (rawIo270 === null || rawIo270 === undefined || isNaN(rawIo270)) {
    return {
      fuelLiters: 0,
      formulaDesc: 'No io_270 telemetry',
      isCalibrated: false,
    };
  }

  const rawX = Number(rawIo270);
  const calib = getVehicleCalibration(unitId);

  // Fallback: If no calibration table exists for this vehicle, use standard linear estimate
  if (!calib || !calib.tbl || calib.tbl.length === 0) {
    // Default fallback: 0.075 L/unit (e.g. 2000 -> 150 L)
    const fallbackLiters = Math.max(0, Math.round(rawX * 0.075 * 10) / 10);
    return {
      fuelLiters: fallbackLiters,
      formulaDesc: `Uncalibrated fallback: 0.075 × ${rawX}`,
      isCalibrated: false,
    };
  }

  const tbl = [...calib.tbl].sort((p1, p2) => p1.x - p2.x);

  // 1. Locate the interval: find the entry with the highest x <= rawX
  let matchedIndex = 0;
  for (let i = 0; i < tbl.length; i++) {
    if (rawX >= tbl[i].x) {
      matchedIndex = i;
    } else {
      break;
    }
  }

  const point = tbl[matchedIndex];

  // 2. Wialon standard calculation equation: Y = a * X + b
  if (point.a !== undefined && point.b !== undefined) {
    const calcY = point.a * rawX + point.b;
    const clampedY = Math.max(0, Math.round(calcY * 10) / 10);
    return {
      fuelLiters: clampedY,
      formulaDesc: `Y = ${point.a} × ${rawX} + ${point.b}`,
      matchedPoint: point,
      isCalibrated: true,
    };
  }

  // 3. Piecewise linear interpolation between (x_i, y_i) and (x_{i+1}, y_{i+1})
  if (point.y !== undefined) {
    if (rawX <= tbl[0].x) {
      const y0 = Math.max(0, Math.round((tbl[0].y ?? 0) * 10) / 10);
      return {
        fuelLiters: y0,
        formulaDesc: `Min bound (x=${tbl[0].x}) -> ${y0} L`,
        matchedPoint: tbl[0],
        isCalibrated: true,
      };
    }

    const lastIdx = tbl.length - 1;
    if (rawX >= tbl[lastIdx].x) {
      const yLast = Math.max(0, Math.round((tbl[lastIdx].y ?? 0) * 10) / 10);
      return {
        fuelLiters: yLast,
        formulaDesc: `Max bound (x=${tbl[lastIdx].x}) -> ${yLast} L`,
        matchedPoint: tbl[lastIdx],
        isCalibrated: true,
      };
    }

    // Between matchedIndex and matchedIndex + 1
    const nextPoint = tbl[matchedIndex + 1];
    if (nextPoint && nextPoint.y !== undefined && nextPoint.x > point.x) {
      const slope = (nextPoint.y - point.y) / (nextPoint.x - point.x);
      const interpolatedY = point.y + slope * (rawX - point.x);
      const clampedY = Math.max(0, Math.round(interpolatedY * 10) / 10);
      return {
        fuelLiters: clampedY,
        formulaDesc: `Interpolated (${point.x}..${nextPoint.x}) -> ${clampedY} L`,
        matchedPoint: point,
        isCalibrated: true,
      };
    }

    const simpleY = Math.max(0, Math.round(point.y * 10) / 10);
    return {
      fuelLiters: simpleY,
      formulaDesc: `Step value -> ${simpleY} L`,
      matchedPoint: point,
      isCalibrated: true,
    };
  }

  // 4. Default proportional calculation
  const simpleY = Math.max(0, Math.round(rawX * 0.075 * 10) / 10);
  return {
    fuelLiters: simpleY,
    formulaDesc: `Proportional estimate: ${simpleY} L`,
    matchedPoint: point,
    isCalibrated: true,
  };
}

/**
 * Generate synthetic messages for a vehicle across the current day.
 * Used for demo mode or when a live unit has 0 messages recorded yet for today.
 */
export function generateDayMessagesForVehicle(
  unitId: number | string,
  targetDate: Date = new Date()
): Array<{
  t: number;
  f: number;
  pos: { x: number; y: number; s: number; c: number };
  p: Record<string, any>;
}> {
  const startOfDay = new Date(targetDate.getFullYear(), targetDate.getMonth(), targetDate.getDate(), 0, 0, 0);
  const now = new Date();
  const endLimit = targetDate.toDateString() === now.toDateString() ? now : new Date(targetDate.getFullYear(), targetDate.getMonth(), targetDate.getDate(), 23, 59, 59);

  const startSec = Math.floor(startOfDay.getTime() / 1000);
  const endSec = Math.floor(endLimit.getTime() / 1000);
  const totalDurationSec = Math.max(3600, endSec - startSec);

  // Determine baseline io_270 range from calibration table
  const calib = getVehicleCalibration(unitId);
  const baseTbl = calib?.tbl || [
    { x: 0, a: 0.08, b: 0 },
    { x: 2500, a: 0.07, b: 15 },
    { x: 5000, a: 0.06, b: 40 },
  ];

  const maxRawX = baseTbl[baseTbl.length - 1]?.x || 5000;
  // Starting morning tank level: ~85% full
  let currentIo270 = Math.round(maxRawX * 0.85);

  const pointsCount = Math.min(60, Math.max(12, Math.floor(totalDurationSec / 900))); // Every ~15-30 min
  const stepSec = Math.floor(totalDurationSec / pointsCount);

  const messages: Array<{
    t: number;
    f: number;
    pos: { x: number; y: number; s: number; c: number };
    p: Record<string, any>;
  }> = [];

  for (let i = 0; i <= pointsCount; i++) {
    const t = startSec + i * stepSec;
    if (t > endSec) break;

    const hourOfDay = new Date(t * 1000).getHours();
    const isDriving = hourOfDay >= 7 && hourOfDay <= 18;
    const speed = isDriving ? 65 + Math.sin(i * 0.8) * 20 : 0;

    // Fuel consumption drops io_270 over time
    if (isDriving) {
      currentIo270 = Math.max(300, currentIo270 - Math.round(15 + Math.random() * 25));
    } else {
      // Small sensor noise ±3
      currentIo270 = Math.max(300, currentIo270 + Math.round((Math.random() - 0.5) * 4));
    }

    // Occasional refuel event around midday (12:00)
    if (hourOfDay === 12 && i % 4 === 0 && currentIo270 < maxRawX * 0.6) {
      currentIo270 = Math.min(maxRawX * 0.95, currentIo270 + Math.round(maxRawX * 0.4));
    }

    messages.push({
      t,
      f: 0x01,
      pos: {
        x: 4.9041 + (i * 0.02),
        y: 52.3676 + (i * 0.015),
        s: Math.round(Math.max(0, speed)),
        c: 88,
      },
      p: {
        io_270: currentIo270,
        ignition: isDriving ? 1 : 0,
        can_speed: Math.round(speed),
        battery: 24.2,
      },
    });
  }

  return messages;
}
