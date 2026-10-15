import { WialonSession, WialonUnit, FuelTransaction, WialonSensor } from '../types/wialon';
import { DEMO_ACCOUNT_NAME, DEMO_USER_NAME, INITIAL_MOCK_UNITS } from './mockData';
import {
  registerUnitCalibration,
  extractFuelSensorsFromRawUnits,
  syncCalibrationsWithServer,
} from './calibrationService';

export const WIALON_ERROR_MESSAGES: Record<number, string> = {
  1: 'Invalid session ID (Session expired or invalid)',
  2: 'Invalid service name requested',
  3: 'Invalid result returned by Wialon service',
  4: 'Invalid input parameters or invalid token length',
  5: 'Error performing request on Wialon remote server',
  6: 'Unknown server error',
  7: 'Access denied: Token lacks necessary permissions',
  8: 'Invalid user or token: Token user not found in Wialon system',
  9: 'Wialon authorization server error',
  10: 'Cannot execute service with current credentials',
  11: 'Exceeded limit of concurrent requests',
  14: 'Selected billing plan does not allow this operation',
  1001: 'No telemetry messages found for requested interval',
  1003: 'Only one request of this type is allowed at a time',
};

export function getWialonErrorText(errorCode?: number, defaultMsg?: string): string {
  if (defaultMsg === 'WRONG_TOKEN_LENGTH') {
    return 'Invalid token length: Wialon API tokens are typically 64 or 72 hexadecimal characters.';
  }
  if (defaultMsg === 'WRONG_TOKEN') {
    return 'Invalid API token: The token could not be verified on this Wialon server.';
  }
  if (errorCode && WIALON_ERROR_MESSAGES[errorCode]) {
    return WIALON_ERROR_MESSAGES[errorCode];
  }
  return defaultMsg || (errorCode ? `Wialon API Error code ${errorCode}` : 'Unknown API error');
}

/**
 * Helper to sanitize Wialon host
 */
export function cleanWialonHost(host?: string): string {
  if (!host || typeof host !== 'string') return 'hst-api.wialon.com';
  let cleaned = host.trim().replace(/^https?:\/\//i, '').replace(/\/.*$/, '');
  return cleaned || 'hst-api.wialon.com';
}

/**
 * Call Wialon Remote API via local server proxy (same-origin, bypasses browser CORS)
 */
async function callWialonViaProxy(
  svc: string,
  params: any,
  sid?: string,
  host: string = 'hst-api.wialon.com'
): Promise<any> {
  const response = await fetch('/api/wialon', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      svc,
      params,
      sid,
      host,
    }),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(
      errorData.reason || errorData.message || `HTTP ${response.status} connecting to Wialon gateway`
    );
  }

  return response.json();
}

/**
 * Call Wialon Remote API directly via JSONP (direct browser request without CORS restrictions)
 */
function callWialonViaJsonp(
  svc: string,
  params: any,
  sid?: string,
  host: string = 'hst-api.wialon.com',
  timeoutMs: number = 12000
): Promise<any> {
  return new Promise((resolve, reject) => {
    if (typeof window === 'undefined' || typeof document === 'undefined') {
      return reject(new Error('JSONP is only supported in browser environment'));
    }

    const targetHost = cleanWialonHost(host);
    const paramsStr = typeof params === 'string' ? params : JSON.stringify(params ?? {});
    const cbId = `wialon_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;

    const script = document.createElement('script');
    let url = `https://${targetHost}/wialon/ajax.html?svc=${encodeURIComponent(svc)}&params=${encodeURIComponent(paramsStr)}`;
    if (sid) {
      url += `&sid=${encodeURIComponent(sid)}`;
    }
    url += `&callback=${cbId}`;

    let timer: any = null;

    const cleanup = () => {
      if (timer) clearTimeout(timer);
      delete (window as any)[cbId];
      if (script.parentNode) {
        script.parentNode.removeChild(script);
      }
    };

    (window as any)[cbId] = (data: any) => {
      cleanup();
      resolve(data);
    };

    script.onerror = () => {
      cleanup();
      reject(new Error(`JSONP script failed to load for svc=${svc}`));
    };

    timer = setTimeout(() => {
      cleanup();
      reject(new Error(`JSONP request timed out for svc=${svc}`));
    }, timeoutMs);

    script.src = url;
    document.head.appendChild(script);
  });
}

/**
 * Execute an API call to Wialon Remote API with automatic failover:
 * 1. Fast local proxy (/api/wialon) avoiding browser CORS restrictions
 * 2. Direct JSONP script request if proxy is unavailable
 * 3. Direct fetch as fallback
 */
export async function callWialonApi(
  svc: string,
  params: any,
  sid?: string,
  host: string = 'hst-api.wialon.com'
): Promise<any> {
  const targetHost = cleanWialonHost(host);
  const paramsStr = typeof params === 'string' ? params : JSON.stringify(params ?? {});
  let data: any = null;
  let lastError: any = null;

  // Primary: Call via same-origin proxy (immune to browser CORS blocks and payload size limits)
  try {
    data = await callWialonViaProxy(svc, params, sid, targetHost);
  } catch (proxyErr: any) {
    console.warn(`[Wialon Proxy attempt failed for svc=${svc}]:`, proxyErr.message);
    lastError = proxyErr;

    // Secondary: If in browser and URL length is within standard limits, try direct JSONP
    const estimatedLen = paramsStr.length + 150;
    if (typeof window !== 'undefined' && estimatedLen < 3500) {
      try {
        data = await callWialonViaJsonp(svc, params, sid, targetHost);
      } catch (jsonpErr: any) {
        console.warn(`[Wialon JSONP attempt failed for svc=${svc}]:`, jsonpErr.message);
        lastError = jsonpErr;
      }
    }

    // Tertiary: Direct POST fetch
    if (!data) {
      try {
        const formBody = new URLSearchParams();
        formBody.set('svc', svc);
        formBody.set('params', paramsStr);
        if (sid) formBody.set('sid', sid);

        const response = await fetch(`https://${targetHost}/wialon/ajax.html`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            Accept: 'application/json',
          },
          body: formBody.toString(),
        });
        if (response.ok) {
          data = await response.json();
        }
      } catch (directErr: any) {
        // Direct fetch failed (likely browser CORS)
      }
    }
  }

  if (!data) {
    throw lastError || new Error(`Unable to communicate with Wialon API for service '${svc}'`);
  }

  if (typeof data.error === 'number' && data.error !== 0) {
    const detailedMsg = getWialonErrorText(data.error, data.reason);
    const err = new Error(detailedMsg);
    (err as any).wialonError = data.error;
    (err as any).reason = data.reason;
    throw err;
  }

  return data;
}

/**
 * Authenticate with Wialon using token/login
 */
export async function loginWithToken(token: string, host: string = 'hst-api.wialon.com'): Promise<{
  sid: string;
  accountName: string;
  userName: string;
  userId: number;
  user: any;
  classes?: any;
}> {
  const trimmedToken = token.trim();
  const loginData = await callWialonApi('token/login', { token: trimmedToken }, undefined, host);

  const sid = loginData.eid;
  if (!sid) {
    throw new Error('Wialon did not return a session ID (eid).');
  }

  const user = loginData.user || {};
  const userName = user.nm || loginData.au || 'Fleet User';
  const userId = user.id || 0;

  let accountName = user.nm || loginData.au || 'Wialon Fleet';

  // Attempt to fetch the primary resource / account name
  try {
    const resourceSearch = await callWialonApi(
      'core/search_items',
      {
        spec: {
          itemsType: 'avl_resource',
          propName: 'sys_name',
          propValueMask: '*',
          sortType: 'sys_name',
        },
        force: 1,
        flags: 1, // base data
        from: 0,
        to: 10,
      },
      sid,
      host
    );

    if (resourceSearch?.items && resourceSearch.items.length > 0) {
      const firstResource = resourceSearch.items[0];
      if (firstResource?.nm) {
        accountName = firstResource.nm;
      }
    }
  } catch (resourceErr) {
    console.warn('Could not query avl_resource account name, falling back to user name:', resourceErr);
  }

  return {
    sid,
    accountName,
    userName,
    userId,
    user,
    classes: loginData.classes,
  };
}

/**
 * In core/search_items, find the index of the sensor whose name is "Fuel Level"
 * for an individual vehicle.
 * All units will not have fuel sensor at the same index:
 * Each vehicle's `sens` object is evaluated independently.
 * E.g., unit #600469230 has fuel sensor at index 3, other unit has it at index 2.
 *
 * Returns { index: string, sensorId?: number, sensorName: string } or null if this unit lacks a "Fuel Level" sensor.
 */
export function findFuelLevelSensorIndex(sens?: any): {
  index: string;
  sensorId?: number;
  sensorName: string;
} | null {
  if (!sens) return null;

  // 1. If sens is an object (standard Wialon format: { "1": { n: "...", ... }, "3": { ... } })
  if (typeof sens === 'object' && !Array.isArray(sens)) {
    // Pass 1: exact match on n: "Fuel Level" (case-insensitive and trimmed)
    for (const [key, sensor] of Object.entries(sens)) {
      if (sensor && typeof sensor === 'object') {
        const name = typeof (sensor as any).n === 'string' ? (sensor as any).n.trim() : '';
        if (name.toLowerCase() === 'fuel level') {
          return {
            index: key, // e.g., "3" for #600469230, "2" for other unit
            sensorId: (sensor as any).id !== undefined ? Number((sensor as any).id) : undefined,
            sensorName: (sensor as any).n || 'Fuel Level',
          };
        }
      }
    }

    // Pass 2: startsWith "Fuel Level"
    for (const [key, sensor] of Object.entries(sens)) {
      if (sensor && typeof sensor === 'object') {
        const name = typeof (sensor as any).n === 'string' ? (sensor as any).n.trim() : '';
        if (name.toLowerCase().startsWith('fuel level')) {
          return {
            index: key,
            sensorId: (sensor as any).id !== undefined ? Number((sensor as any).id) : undefined,
            sensorName: (sensor as any).n || 'Fuel Level',
          };
        }
      }
    }

    // Pass 3: includes "fuel level"
    for (const [key, sensor] of Object.entries(sens)) {
      if (sensor && typeof sensor === 'object') {
        const name = typeof (sensor as any).n === 'string' ? (sensor as any).n.trim() : '';
        if (name.toLowerCase().includes('fuel level')) {
          return {
            index: key,
            sensorId: (sensor as any).id !== undefined ? Number((sensor as any).id) : undefined,
            sensorName: (sensor as any).n || 'Fuel Level',
          };
        }
      }
    }

    // Pass 4: type t === "fuel level"
    for (const [key, sensor] of Object.entries(sens)) {
      if (sensor && typeof sensor === 'object') {
        const type = typeof (sensor as any).t === 'string' ? (sensor as any).t.trim().toLowerCase() : '';
        if (type === 'fuel level') {
          return {
            index: key,
            sensorId: (sensor as any).id !== undefined ? Number((sensor as any).id) : undefined,
            sensorName: (sensor as any).n || 'Fuel Level',
          };
        }
      }
    }
  }

  // 2. If sens is an array:
  if (Array.isArray(sens)) {
    for (let i = 0; i < sens.length; i++) {
      const sensor = sens[i];
      if (sensor && typeof sensor === 'object') {
        const name = typeof sensor.n === 'string' ? sensor.n.trim() : '';
        if (name.toLowerCase().includes('fuel level') || sensor.t === 'fuel level') {
          const sid = sensor.id !== undefined ? String(sensor.id) : String(i);
          return {
            index: sid,
            sensorId: sensor.id !== undefined ? Number(sensor.id) : undefined,
            sensorName: sensor.n || 'Fuel Level',
          };
        }
      }
    }
  }

  return null;
}

/**
 * Call Wialon unit/calc_last for an array of unit IDs to obtain calculated sensor readings.
 * Endpoint: svc=unit/calc_last&params={"itemIds":[<long>]}
 */
export async function fetchCalcLastForUnits(
  itemIds: number[],
  sid: string,
  host: string = 'hst-api.wialon.com'
): Promise<Map<number, any>> {
  const resultMap = new Map<number, any>();
  if (!itemIds || itemIds.length === 0) return resultMap;

  // Chunk in batches of 25
  const chunkSize = 25;
  const chunks: number[][] = [];
  for (let i = 0; i < itemIds.length; i += chunkSize) {
    chunks.push(itemIds.slice(i, i + chunkSize));
  }

  const results = await Promise.allSettled(
    chunks.map((chunk) =>
      callWialonApi('unit/calc_last', { itemIds: chunk.map(Number) }, sid, host)
    )
  );

  const missingUnitIds: number[] = [];

  for (let i = 0; i < results.length; i++) {
    const res = results[i];
    const chunk = chunks[i];

    if (res.status === 'fulfilled' && res.value) {
      const data = res.value;

      if (Array.isArray(data)) {
        data.forEach((item, idx) => {
          if (!item) return;
          const uId = item?.i !== undefined
            ? Number(item.i)
            : (item?.id !== undefined
                ? Number(item.id)
                : (item?.uid !== undefined
                    ? Number(item.uid)
                    : (chunk[idx] !== undefined ? Number(chunk[idx]) : undefined)));
          if (uId !== undefined && !isNaN(uId)) {
            resultMap.set(uId, item);
            resultMap.set(String(uId) as any, item);
          }
        });
      } else if (typeof data === 'object') {
        if (Array.isArray((data as any).items)) {
          (data as any).items.forEach((item: any, idx: number) => {
            if (!item) return;
            const uId = item?.i !== undefined
              ? Number(item.i)
              : (item?.id !== undefined
                  ? Number(item.id)
                  : (chunk[idx] !== undefined ? Number(chunk[idx]) : undefined));
            if (uId !== undefined && !isNaN(uId)) {
              resultMap.set(uId, item);
              resultMap.set(String(uId) as any, item);
            }
          });
        } else if ((data as any).sensors) {
          // Direct single-unit response
          const uId = Number(chunk[0]);
          resultMap.set(uId, data);
          resultMap.set(String(uId) as any, data);
        } else {
          for (const [key, val] of Object.entries(data)) {
            const uId = Number((val as any)?.i ?? (val as any)?.id ?? key);
            if (!isNaN(uId)) {
              resultMap.set(uId, val);
              resultMap.set(String(uId) as any, val);
            }
          }
        }
      }

      // Check which units from this chunk were not populated
      for (const id of chunk) {
        if (!resultMap.has(id) && !resultMap.has(String(id) as any)) {
          missingUnitIds.push(id);
        }
      }
    } else {
      // Chunk failed; queue all units in chunk for individual query
      missingUnitIds.push(...chunk);
    }
  }

  // Fallback: Query missing units individually so no vehicle is left behind
  if (missingUnitIds.length > 0) {
    const indivResults = await Promise.allSettled(
      missingUnitIds.map((id) =>
        callWialonApi('unit/calc_last', { itemIds: [Number(id)] }, sid, host)
      )
    );

    indivResults.forEach((res, idx) => {
      const uId = Number(missingUnitIds[idx]);
      if (res.status === 'fulfilled' && res.value) {
        const d = res.value;
        const item = Array.isArray(d) ? d[0] : (d?.items?.[0] || d?.[String(uId)] || d?.[uId] || d);
        if (item) {
          resultMap.set(uId, item);
          resultMap.set(String(uId) as any, item);
        }
      }
    });
  }

  return resultMap;
}

/**
 * Extract fuel level for each vehicle individually:
 * 1. Inspects THIS vehicle's sens dictionary to find the index where "n": "Fuel Level".
 *    E.g., for unit #600469230 index is 3, for other unit index is 2.
 * 2. Looks up THAT specific index in THIS vehicle's unit/calc_last sensors dictionary.
 * 3. Does not share or assume sensor indexes across vehicles.
 * 4. Extracts fuel volume from "format" or "value" in litres.
 * 5. Returns null (renders '--') if not available.
 */
export function getFuelLevelFromCalcLast(
  rawUnit: any,
  calcUnit?: any
): {
  currentLevel: number | null;
  sensorId?: number;
  sensorName?: string;
  format?: string;
} {
  const sensObj = rawUnit?.sens || rawUnit?.sensors;
  const fuelSensor = findFuelLevelSensorIndex(sensObj);
  if (!fuelSensor) {
    // This individual vehicle has no sensor with "n": "Fuel Level" in core/search_items sens
    return { currentLevel: null };
  }

  if (!calcUnit || typeof calcUnit !== 'object') {
    return {
      currentLevel: null,
      sensorId: fuelSensor.sensorId,
      sensorName: fuelSensor.sensorName,
    };
  }

  // Look up THIS vehicle's specific fuel sensor index in unit/calc_last sensors
  const targetIndex = fuelSensor.index;
  const targetIndexNum = Number(targetIndex);
  const targetIndexStr = String(targetIndex);
  const sensorId = fuelSensor.sensorId;
  const sensorIdNum = sensorId !== undefined ? Number(sensorId) : undefined;
  const sensorIdStr = sensorId !== undefined ? String(sensorId) : undefined;

  const sensorsContainer =
    calcUnit.sensors ||
    calcUnit.sens ||
    (calcUnit && !calcUnit.i && !calcUnit.id && !calcUnit.pos ? calcUnit : undefined);

  if (!sensorsContainer || typeof sensorsContainer !== 'object') {
    return {
      currentLevel: null,
      sensorId: fuelSensor.sensorId,
      sensorName: fuelSensor.sensorName,
    };
  }

  let sensorReading: any = undefined;

  // Direct key lookup in sensors dictionary
  if (sensorsContainer[targetIndexStr] !== undefined) {
    sensorReading = sensorsContainer[targetIndexStr];
  } else if (!isNaN(targetIndexNum) && sensorsContainer[targetIndexNum] !== undefined) {
    sensorReading = sensorsContainer[targetIndexNum];
  } else if (sensorIdStr && sensorsContainer[sensorIdStr] !== undefined) {
    sensorReading = sensorsContainer[sensorIdStr];
  } else if (sensorIdNum !== undefined && sensorsContainer[sensorIdNum] !== undefined) {
    sensorReading = sensorsContainer[sensorIdNum];
  }

  // If sensorsContainer is an Array
  if (sensorReading === undefined && Array.isArray(sensorsContainer)) {
    if (!isNaN(targetIndexNum) && sensorsContainer[targetIndexNum] !== undefined) {
      sensorReading = sensorsContainer[targetIndexNum];
    } else if (!isNaN(targetIndexNum) && targetIndexNum > 0 && sensorsContainer[targetIndexNum - 1] !== undefined) {
      sensorReading = sensorsContainer[targetIndexNum - 1];
    } else {
      const found = sensorsContainer.find((s: any) => {
        if (!s || typeof s !== 'object') return false;
        const sid = s.id !== undefined ? String(s.id) : (s.i !== undefined ? String(s.i) : undefined);
        return sid === targetIndexStr || sid === sensorIdStr;
      });
      if (found) sensorReading = found;
    }
  }

  if (sensorReading === undefined || sensorReading === null) {
    return {
      currentLevel: null,
      sensorId: fuelSensor.sensorId,
      sensorName: fuelSensor.sensorName,
    };
  }

  let level: number | null = null;
  let formatStr: string | undefined = undefined;

  if (typeof sensorReading === 'object') {
    // 1. Format: extract string (e.g. "450.20 l" or { value: "450.20 l" })
    if (typeof sensorReading.format === 'string') {
      formatStr = sensorReading.format.trim();
    } else if (typeof sensorReading.format === 'object' && sensorReading.format !== null) {
      const fv = sensorReading.format.value ?? sensorReading.format.v;
      if (fv !== undefined && fv !== null) formatStr = String(fv).trim();
    } else if (typeof sensorReading.f === 'string') {
      formatStr = sensorReading.f.trim();
    } else if (typeof sensorReading.f === 'object' && sensorReading.f !== null) {
      const fv = sensorReading.f.value ?? sensorReading.f.v;
      if (fv !== undefined && fv !== null) formatStr = String(fv).trim();
    }

    // 2. Value: extract numeric value
    let rawVal = sensorReading.value !== undefined ? sensorReading.value : sensorReading.v;
    if (typeof rawVal === 'object' && rawVal !== null) {
      rawVal = rawVal.value ?? rawVal.v;
    }

    if (rawVal !== undefined && rawVal !== null && rawVal !== '---') {
      const cleanedStr = String(rawVal).replace(',', '.').trim();
      const num = Number(cleanedStr);
      if (!isNaN(num) && num !== -348201.3876 && num >= 0) {
        level = Math.round(num * 10) / 10;
      }
    }

    // 3. Fallback: parse numeric float from format string if value is missing/non-numeric
    if (level === null && formatStr && formatStr !== '---') {
      const normalizedFormat = formatStr.replace(',', '.');
      const match = normalizedFormat.match(/([0-9]+(?:\.[0-9]+)?)/);
      if (match) {
        level = Math.round(parseFloat(match[1]) * 10) / 10;
      }
    }
  } else if (typeof sensorReading === 'number') {
    if (!isNaN(sensorReading) && sensorReading !== -348201.3876 && sensorReading >= 0) {
      level = Math.round(sensorReading * 10) / 10;
    }
  } else if (typeof sensorReading === 'string' && sensorReading !== '---') {
    const cleaned = sensorReading.replace(',', '.').trim();
    const parsed = parseFloat(cleaned);
    if (!isNaN(parsed) && parsed !== -348201.3876 && parsed >= 0) {
      level = Math.round(parsed * 10) / 10;
    }
    formatStr = sensorReading;
  }

  return {
    currentLevel: level,
    sensorId: fuelSensor.sensorId,
    sensorName: fuelSensor.sensorName,
    format: formatStr || (level !== null ? `${level} l` : undefined),
  };
}

/**
 * Fetch all units for the given session ID.
 * 1. Calls core/search_items with flag 4096 to get sensors (sens).
 * 2. Finds the index of sensor where "n": "Fuel Level".
 * 3. Calls unit/calc_last to fetch real calculated fuel level for that index.
 */
export async function fetchUnitsFromWialon(
  sid: string,
  host: string = 'hst-api.wialon.com'
): Promise<WialonUnit[]> {
  // Flags: 1 (base) + 2 (props) + 8 (flds) + 16 (image) + 1024 (pos/lmsg) + 4096 (sens) + 8192 (counters) + 131072 (fuel)
  const flags = 1 + 2 + 8 + 16 + 1024 + 4096 + 8192 + 131072; // = 144243

  const data = await callWialonApi(
    'core/search_items',
    {
      spec: {
        itemsType: 'avl_unit',
        propName: 'sys_name',
        propValueMask: '*',
        sortType: 'sys_name',
      },
      force: 1,
      flags,
      from: 0,
      to: 0, // all items
    },
    sid,
    host
  );

  const rawUnits: any[] = data.items || [];
  if (rawUnits.length === 0) return [];

  // 1. Extract all sensor details and calibration tables for each unit having a sensor called "t": "fuel level"
  // Each vehicle's fuel sensor index is determined individually (e.g. index 3 for #600469230, index 2 for other units)
  const fuelCalibrations = extractFuelSensorsFromRawUnits(rawUnits);
  if (Object.keys(fuelCalibrations).length > 0) {
    syncCalibrationsWithServer(fuelCalibrations).catch((err) =>
      console.warn('Could not sync calibrations with server:', err)
    );
  }

  // Also register individual units
  rawUnits.forEach((u) => {
    registerUnitCalibration(u.id, u.nm, u.sens);
  });

  // Query unit/calc_last for all unit IDs
  const calcLastMap = await fetchCalcLastForUnits(
    rawUnits.map((u) => u.id),
    sid,
    host
  );

  return rawUnits.map((u) => transformRawWialonUnit(u, calcLastMap.get(u.id)));
}

/**
 * Transform Wialon raw JSON unit item to enriched WialonUnit
 * using the index in sens where n === "Fuel Level" and its reading from unit/calc_last.
 */
function transformRawWialonUnit(raw: any, calcUnit?: any): WialonUnit {
  const pos = raw.pos || raw.lmsg?.pos;
  const lmsg = raw.lmsg || { t: Math.floor(Date.now() / 1000), p: {} };
  const params = lmsg.p || {};
  const sensors: Record<string, WialonSensor> = raw.sens || raw.sensors || {};

  // Fuel level logic: index where n === "Fuel Level" in sens -> unit/calc_last
  const fuelResult = getFuelLevelFromCalcLast(raw, calcUnit);
  const detectedFuelLevel = fuelResult.currentLevel;
  const calcSensorId = fuelResult.sensorId;
  const calcSensorName = fuelResult.sensorName;
  const calcSensorFormat = fuelResult.format;
  const sensorType = fuelResult.sensorName || 'Fuel Level';

  // Movement state
  const speed = pos?.s !== undefined ? pos.s : null;
  const ignition = params.ignition !== undefined ? Number(params.ignition) : (speed !== null && speed > 0 ? 1 : null);
  const msgAge = lmsg.t ? Math.floor(Date.now() / 1000) - lmsg.t : null;

  let state: 'moving' | 'idling' | 'parked' | 'offline' = 'parked';
  if (msgAge !== null && msgAge > 86400) {
    state = 'offline';
  } else if (speed !== null && speed > 5) {
    state = 'moving';
  } else if (ignition === 1 && (speed === null || speed <= 5)) {
    state = 'idling';
  } else {
    state = 'parked';
  }

  // Custom fields directly from Wialon API
  const customFields: Record<string, string> = {};
  if (raw.flds) {
    for (const key in raw.flds) {
      const f = raw.flds[key];
      if (f?.n && f?.v) customFields[f.n.toLowerCase()] = String(f.v);
    }
  }

  // Genuine counters from API
  const mileageKm = raw.cnm ? Math.round(raw.cnm / 1000) : null;
  const engineHours = raw.cfl ? Math.round(raw.cfl / 3600) : null;

  return {
    id: raw.id,
    nm: raw.nm || '',
    cls: raw.cls || 2,
    mu: raw.mu ?? 0,
    pos: pos
      ? {
          t: pos.t,
          y: pos.y,
          x: pos.x,
          c: pos.c || 0,
          s: pos.s || 0,
          sc: pos.sc,
        }
      : undefined,
    lmsg: {
      t: lmsg.t,
      p: params,
    },
    sens: sensors,
    cfl: raw.cfl,
    cnm: raw.cnm,
    cmsg: raw.cmsg,
    mileageKm,
    engineHours,
    state,
    profile: {
      vin: customFields.vin || customFields['vin code'] || '',
      plate: customFields.plate || customFields.registration || customFields['plate number'] || '',
      model: customFields.model || raw.prp?.model || '',
      driver: customFields.driver || customFields['driver name'] || '',
      deviceType: raw.hw || '',
      imei: raw.uid ? String(raw.uid) : '',
    },
    fuel: {
      currentLevel: detectedFuelLevel, // null if not available from API
      maxCapacity: null,
      percentage: null,
      sensorType: detectedFuelLevel !== null ? sensorType : '',
      avgConsumptionLper100km: null,
      totalConsumedLiters: null,
      recentTransactions: [],
      levelHistory: [],
      calcSensorId,
      calcSensorName,
      calcSensorUnit: 'l',
      calcSensorFormat,
    },
  };
}

/**
 * Generate a demo session ID with realistic hex format
 */
export function generateDemoSessionId(): string {
  const chars = '0123456789abcdef';
  let sid = '';
  for (let i = 0; i < 32; i++) {
    sid += chars[Math.floor(Math.random() * chars.length)];
  }
  return sid;
}

export interface RawIntervalMessage {
  t: number;
  f?: number;
  pos?: {
    x: number;
    y: number;
    z?: number;
    s?: number;
    c?: number;
    sc?: number;
  };
  p?: Record<string, any>;
}

/**
 * Fetch messages for a vehicle for a specified interval using messages/load_interval.
 * Loads all telemetry messages (flagsMask 0xff00) containing raw parameters like io_270.
 */
export async function fetchUnitMessagesInterval(
  itemId: number,
  timeFrom: number,
  timeTo: number,
  sid: string,
  host: string = 'hst-api.wialon.com'
): Promise<RawIntervalMessage[]> {
  try {
    const res = await callWialonApi(
      'messages/load_interval',
      {
        itemId: Number(itemId),
        timeFrom: Math.floor(timeFrom),
        timeTo: Math.floor(timeTo),
        flags: 0x0000,
        flagsMask: 0xff00, // all data messages
        loadCount: 4294967295, // 0xffffffff (load all messages)
      },
      sid,
      host
    );

    if (res?.messages && Array.isArray(res.messages)) {
      return res.messages;
    }
  } catch (err: any) {
    console.warn(`messages/load_interval with flagsMask 0xff00 failed for unit #${itemId}:`, err.message);
  }

  // Fallback 1: basic flags (0, 0)
  try {
    const retryRes = await callWialonApi(
      'messages/load_interval',
      {
        itemId: Number(itemId),
        timeFrom: Math.floor(timeFrom),
        timeTo: Math.floor(timeTo),
        flags: 0,
        flagsMask: 0,
        loadCount: 10000,
      },
      sid,
      host
    );
    if (retryRes?.messages && Array.isArray(retryRes.messages)) {
      return retryRes.messages;
    }
  } catch (err2: any) {
    console.warn(`Fallback messages/load_interval failed for unit #${itemId}:`, err2.message);
  }

  return [];
}

/**
 * Explicitly pull all sensor details including calibration tables directly from Wialon
 * for each unit which has a sensor called "t": "fuel level".
 * Updates local cache and persists to calibrations.json via /api/calibrations/save.
 */
export async function pullFuelSensorsAndUpdateCalibrations(
  sid?: string,
  host: string = 'hst-api.wialon.com',
  token?: string
): Promise<{
  success: boolean;
  totalUnitsQueried?: number;
  unitsWithFuelSensor?: number;
  calibrations?: Record<string, any>;
  error?: string;
}> {
  try {
    let activeSid = sid;
    if (!activeSid && token) {
      const loginRes = await loginWithToken(token, host);
      activeSid = loginRes.sid;
    }

    if (!activeSid) {
      // If no active session, load local calibrations
      const res = await fetch('/api/calibrations');
      const data = await res.json();
      extractFuelSensorsFromRawUnits(Object.values(data || {}));
      return {
        success: true,
        unitsWithFuelSensor: Object.keys(data || {}).length,
        calibrations: data,
      };
    }

    // Direct call to Wialon Remote API
    const data = await callWialonApi(
      'core/search_items',
      {
        spec: {
          itemsType: 'avl_unit',
          propName: 'sys_name',
          propValueMask: '*',
          sortType: 'sys_name',
        },
        force: 1,
        flags: 1 + 2 + 8 + 1024 + 4096 + 8192 + 131072,
        from: 0,
        to: 0,
      },
      activeSid,
      host
    );

    const items: any[] = data?.items || [];
    const extracted = extractFuelSensorsFromRawUnits(items);
    await syncCalibrationsWithServer(extracted);

    return {
      success: true,
      totalUnitsQueried: items.length,
      unitsWithFuelSensor: Object.keys(extracted).length,
      calibrations: extracted,
    };
  } catch (err: any) {
    console.error('Error pulling fuel sensors from Wialon:', err);
    return {
      success: false,
      error: err.message || 'Failed to pull calibrations from Wialon',
    };
  }
}

