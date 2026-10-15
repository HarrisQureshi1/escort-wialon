import { WialonUnit, FuelTransaction } from '../types/wialon';
import baseCalibrations from '../data/calibrations.json';

const now = Date.now();
const hour = 3600 * 1000;

export const DEMO_ACCOUNT_NAME = 'TransEuro Logistics Fleet';
export const DEMO_USER_NAME = 'fleet.manager.eu';
export const DEMO_TOKEN_PRESET = '5dce19f2a89345c2bc7e4910ea82b49210984cfb72183e9102482319df981320ef491209';

export const INITIAL_MOCK_UNITS: WialonUnit[] = [
  {
    id: 600469230,
    nm: 'Volvo FH16 #600469230 - Long Haul',
    cls: 2,
    mu: 0,
    pos: {
      t: Math.floor(now / 1000) - 45,
      y: 52.3676,
      x: 4.9041,
      c: 88,
      s: 78,
      sc: 16,
    },
    lmsg: {
      t: Math.floor(now / 1000) - 45,
      p: {
        can_fls: 485.4,
        ignition: 1,
        pwr_ext: 24.2,
        battery: 4.1,
        speed: 78,
        engine_temp: 84,
        rpm: 1420,
      },
    },
    sens: {
      1: { id: 1, n: 'Main Tank Fuel Sensor', t: 'fuel level', m: 'l', p: 'can_fls' },
      2: { id: 2, n: 'Engine Ignition', t: 'ignition', m: '', p: 'ignition' },
      3: { id: 3, n: 'CAN Engine RPM', t: 'engine rpm', m: 'rpm', p: 'rpm' },
    },
    mileageKm: 342190,
    engineHours: 8420,
    state: 'moving',
    profile: {
      vin: 'YV2RT40A9HA832910',
      plate: 'NL-892-TX',
      model: 'Volvo FH16 750hp 6x4',
      driver: 'Lars van Dijk',
      deviceType: 'Teltonika FMB640',
      imei: '862094038192041',
    },
    fuel: {
      currentLevel: 485.4,
      maxCapacity: 600,
      percentage: 80.9,
      sensorType: 'Dual High-Precision FLS (CAN)',
      avgConsumptionLper100km: 29.4,
      totalConsumedLiters: 100580,
      levelHistory: [
        { timestamp: now - 5 * hour, level: 560, speed: 82 },
        { timestamp: now - 4 * hour, level: 535, speed: 79 },
        { timestamp: now - 3 * hour, level: 512, speed: 85 },
        { timestamp: now - 2 * hour, level: 498, speed: 0 },
        { timestamp: now - 1 * hour, level: 492, speed: 76 },
        { timestamp: now, level: 485.4, speed: 78 },
      ],
      recentTransactions: [
        {
          id: 'ft-401-1',
          type: 'Refuel',
          volumeLiters: 380,
          timestamp: now - 14 * hour,
          locationName: 'Shell Express A2, Utrecht',
          startLevelLiters: 195,
          endLevelLiters: 575,
          driver: 'Lars van Dijk',
          cost: 646.0,
        },
        {
          id: 'ft-401-2',
          type: 'Trip Consumption',
          volumeLiters: 89.6,
          timestamp: now - 28 * hour,
          locationName: 'Rotterdam Port to Utrecht',
          startLevelLiters: 284.6,
          endLevelLiters: 195.0,
          driver: 'Lars van Dijk',
        },
      ],
    },
  },
  {
    id: 1048202,
    nm: 'Scania R500 #402 - Reefer Cargo',
    cls: 2,
    mu: 0,
    pos: {
      t: Math.floor(now / 1000) - 120,
      y: 50.8503,
      x: 4.3517,
      c: 192,
      s: 0,
      sc: 14,
    },
    lmsg: {
      t: Math.floor(now / 1000) - 120,
      p: {
        can_fls: 142.0,
        ignition: 0,
        pwr_ext: 24.0,
        battery: 4.2,
        speed: 0,
        engine_temp: 32,
        cargo_temp: -18.4,
      },
    },
    sens: {
      1: { id: 1, n: 'FLS Fuel Level', t: 'fuel level', m: 'l', p: 'can_fls' },
      2: { id: 2, n: 'Reefer Unit Level', t: 'custom', m: 'l', p: 'reefer_fls' },
    },
    mileageKm: 218450,
    engineHours: 5120,
    state: 'parked',
    profile: {
      vin: 'YS2R4X20005491028',
      plate: 'BE-1-VTR-994',
      model: 'Scania R500 Super 4x2',
      driver: 'Marc Vermeulen',
      deviceType: 'Ruptela HCV5',
      imei: '358920192847102',
    },
    fuel: {
      currentLevel: 142.0,
      maxCapacity: 500,
      percentage: 28.4,
      sensorType: 'Ultrasonic Level Sensor (RS485)',
      avgConsumptionLper100km: 31.8,
      totalConsumedLiters: 69420,
      levelHistory: [
        { timestamp: now - 5 * hour, level: 240, speed: 75 },
        { timestamp: now - 4 * hour, level: 210, speed: 80 },
        { timestamp: now - 3 * hour, level: 178, speed: 65 },
        { timestamp: now - 2 * hour, level: 145, speed: 12 },
        { timestamp: now - 1 * hour, level: 142, speed: 0 },
        { timestamp: now, level: 142, speed: 0 },
      ],
      recentTransactions: [
        {
          id: 'ft-402-1',
          type: 'Refuel',
          volumeLiters: 310,
          timestamp: now - 36 * hour,
          locationName: 'TotalEnergies E19, Brussels',
          startLevelLiters: 95,
          endLevelLiters: 405,
          driver: 'Marc Vermeulen',
          cost: 533.2,
        },
      ],
    },
  },
  {
    id: 1048203,
    nm: 'Mercedes Actros 1845 #403',
    cls: 2,
    mu: 0,
    pos: {
      t: Math.floor(now / 1000) - 20,
      y: 51.2194,
      x: 4.4025,
      c: 240,
      s: 4,
      sc: 18,
    },
    lmsg: {
      t: Math.floor(now / 1000) - 20,
      p: {
        can_fls: 92.5,
        ignition: 1,
        pwr_ext: 24.4,
        battery: 4.15,
        speed: 4,
        engine_temp: 78,
        rpm: 620,
      },
    },
    sens: {
      1: { id: 1, n: 'Fuel Level Sensor', t: 'fuel level', m: 'l', p: 'can_fls' },
      2: { id: 2, n: 'Ignition Sensor', t: 'ignition', m: '', p: 'ignition' },
    },
    mileageKm: 412080,
    engineHours: 9810,
    state: 'idling',
    profile: {
      vin: 'WDB9634031L849102',
      plate: 'DE-K-AC-403',
      model: 'Mercedes-Benz Actros 1845 LS',
      driver: 'Stefan Schneider',
      deviceType: 'Teltonika FMB640',
      imei: '862094038192055',
    },
    fuel: {
      currentLevel: 92.5,
      maxCapacity: 550,
      percentage: 16.8, // Low Fuel!
      sensorType: 'Capacitive Fuel Sensor (Omnicomm)',
      avgConsumptionLper100km: 28.9,
      totalConsumedLiters: 119090,
      levelHistory: [
        { timestamp: now - 5 * hour, level: 210, speed: 82 },
        { timestamp: now - 4 * hour, level: 180, speed: 78 },
        { timestamp: now - 3 * hour, level: 152, speed: 80 },
        { timestamp: now - 2 * hour, level: 122, speed: 60 },
        { timestamp: now - 1 * hour, level: 95, speed: 10 },
        { timestamp: now, level: 92.5, speed: 4 },
      ],
      recentTransactions: [
        {
          id: 'ft-403-1',
          type: 'Refuel',
          volumeLiters: 420,
          timestamp: now - 22 * hour,
          locationName: 'Aral Autohof, Aachen',
          startLevelLiters: 80,
          endLevelLiters: 500,
          driver: 'Stefan Schneider',
          cost: 722.4,
        },
      ],
    },
  },
  {
    id: 1048204,
    nm: 'MAN TGX 18.510 #404 - Express Cargo',
    cls: 2,
    mu: 0,
    pos: {
      t: Math.floor(now / 1000) - 15,
      y: 53.5511,
      x: 9.9937,
      c: 320,
      s: 84,
      sc: 19,
    },
    lmsg: {
      t: Math.floor(now / 1000) - 15,
      p: {
        can_fls: 395.0,
        ignition: 1,
        pwr_ext: 24.3,
        battery: 4.2,
        speed: 84,
        engine_temp: 86,
        rpm: 1350,
      },
    },
    sens: {
      1: { id: 1, n: 'FLS Level', t: 'fuel level', m: 'l', p: 'can_fls' },
      2: { id: 2, n: 'Flow Meter Total', t: 'fuel flow', m: 'l/h', p: 'ffs_total' },
    },
    mileageKm: 189420,
    engineHours: 4230,
    state: 'moving',
    profile: {
      vin: 'WMA06XZZ5MP019284',
      plate: 'DE-HH-TG-404',
      model: 'MAN TGX 18.510 EfficientLine',
      driver: 'Jan Kowalski',
      deviceType: 'Teltonika FMC650',
      imei: '862094038192088',
    },
    fuel: {
      currentLevel: 395.0,
      maxCapacity: 490,
      percentage: 80.6,
      sensorType: 'Direct CAN FMS Standard',
      avgConsumptionLper100km: 27.6,
      totalConsumedLiters: 52280,
      levelHistory: [
        { timestamp: now - 5 * hour, level: 460, speed: 85 },
        { timestamp: now - 4 * hour, level: 442, speed: 82 },
        { timestamp: now - 3 * hour, level: 425, speed: 84 },
        { timestamp: now - 2 * hour, level: 410, speed: 80 },
        { timestamp: now - 1 * hour, level: 402, speed: 82 },
        { timestamp: now, level: 395.0, speed: 84 },
      ],
      recentTransactions: [
        {
          id: 'ft-404-1',
          type: 'Refuel',
          volumeLiters: 345,
          timestamp: now - 8 * hour,
          locationName: 'Circle K Hamburg Süd',
          startLevelLiters: 125,
          endLevelLiters: 470,
          driver: 'Jan Kowalski',
          cost: 586.5,
        },
      ],
    },
  },
  {
    id: 1048205,
    nm: 'DAF XF 480 #405 - Intermodal',
    cls: 2,
    mu: 0,
    pos: {
      t: Math.floor(now / 1000) - 1800,
      y: 51.4416,
      x: 6.7623,
      c: 0,
      s: 0,
      sc: 11,
    },
    lmsg: {
      t: Math.floor(now / 1000) - 1800,
      p: {
        can_fls: 215.0,
        ignition: 0,
        pwr_ext: 23.9,
        battery: 4.05,
        speed: 0,
        drain_alert: 1,
      },
    },
    sens: {
      1: { id: 1, n: 'FLS Level', t: 'fuel level', m: 'l', p: 'can_fls' },
      2: { id: 2, n: 'Theft / Drain Alarm', t: 'alarm', m: '', p: 'drain_alert' },
    },
    mileageKm: 276900,
    engineHours: 6490,
    state: 'parked',
    profile: {
      vin: 'XLRTE48MS0E819201',
      plate: 'NL-418-BK',
      model: 'DAF XF 480 FT Super Space Cab',
      driver: 'Pieter Smits',
      deviceType: 'Galileosky 7x',
      imei: '862094038192099',
    },
    fuel: {
      currentLevel: 215.0,
      maxCapacity: 520,
      percentage: 41.3,
      sensorType: 'Capacitive Fuel Sensor (Siensor)',
      avgConsumptionLper100km: 30.1,
      totalConsumedLiters: 83340,
      levelHistory: [
        { timestamp: now - 5 * hour, level: 310, speed: 78 },
        { timestamp: now - 4 * hour, level: 275, speed: 0 },
        { timestamp: now - 3 * hour, level: 215, speed: 0 }, // sharp drop!
        { timestamp: now - 2 * hour, level: 215, speed: 0 },
        { timestamp: now - 1 * hour, level: 215, speed: 0 },
        { timestamp: now, level: 215, speed: 0 },
      ],
      recentTransactions: [
        {
          id: 'ft-405-drain',
          type: 'Drain',
          volumeLiters: 60.0,
          timestamp: now - 3.5 * hour,
          locationName: 'Duisburg Industrial Terminal (Suspicious Drop)',
          startLevelLiters: 275.0,
          endLevelLiters: 215.0,
          driver: 'Pieter Smits',
        },
      ],
    },
  },
  {
    id: 1048206,
    nm: 'Iveco S-Way 460 #406 - LNG Hybrid',
    cls: 2,
    mu: 0,
    pos: {
      t: Math.floor(now / 1000) - 30,
      y: 48.8566,
      x: 2.3522,
      c: 145,
      s: 62,
      sc: 15,
    },
    lmsg: {
      t: Math.floor(now / 1000) - 30,
      p: {
        can_fls: 310.8,
        ignition: 1,
        pwr_ext: 24.1,
        battery: 4.18,
        speed: 62,
        engine_temp: 82,
        lng_pressure: 14.8,
      },
    },
    sens: {
      1: { id: 1, n: 'LNG Pressure Sensor', t: 'fuel level', m: 'bar', p: 'lng_pressure' },
      2: { id: 2, n: 'Diesel Reserve Tank', t: 'fuel level', m: 'l', p: 'can_fls' },
    },
    mileageKm: 98400,
    engineHours: 2150,
    state: 'moving',
    profile: {
      vin: 'WJM42CY0006192841',
      plate: 'FR-781-PQ',
      model: 'Iveco S-Way Natural Power 460',
      driver: 'Julien Moreau',
      deviceType: 'Teltonika FMC650',
      imei: '862094038192111',
    },
    fuel: {
      currentLevel: 310.8,
      maxCapacity: 400,
      percentage: 77.7,
      sensorType: 'OEM Electronic CAN Telemetry',
      avgConsumptionLper100km: 24.2,
      totalConsumedLiters: 23810,
      levelHistory: [
        { timestamp: now - 5 * hour, level: 360, speed: 70 },
        { timestamp: now - 4 * hour, level: 345, speed: 65 },
        { timestamp: now - 3 * hour, level: 332, speed: 72 },
        { timestamp: now - 2 * hour, level: 325, speed: 50 },
        { timestamp: now - 1 * hour, level: 318, speed: 60 },
        { timestamp: now, level: 310.8, speed: 62 },
      ],
      recentTransactions: [
        {
          id: 'ft-406-1',
          type: 'Refuel',
          volumeLiters: 195,
          timestamp: now - 18 * hour,
          locationName: 'AS 24 Station Paris Sud',
          startLevelLiters: 175,
          endLevelLiters: 370,
          driver: 'Julien Moreau',
          cost: 321.75,
        },
      ],
    },
  },
  {
    id: 1048207,
    nm: 'Mercedes Sprinter #201 - City Courier',
    cls: 2,
    mu: 0,
    pos: {
      t: Math.floor(now / 1000) - 10,
      y: 52.52,
      x: 13.405,
      c: 12,
      s: 38,
      sc: 17,
    },
    lmsg: {
      t: Math.floor(now / 1000) - 10,
      p: {
        can_fls: 64.2,
        ignition: 1,
        pwr_ext: 12.6,
        battery: 4.12,
        speed: 38,
        engine_temp: 88,
      },
    },
    sens: {
      1: { id: 1, n: 'OBD Fuel Level', t: 'fuel level', m: 'l', p: 'can_fls' },
      2: { id: 2, n: 'Ignition Status', t: 'ignition', m: '', p: 'ignition' },
    },
    mileageKm: 84320,
    engineHours: 1980,
    state: 'moving',
    profile: {
      vin: 'WDB9066331S819204',
      plate: 'DE-B-EX-201',
      model: 'Mercedes-Benz Sprinter 316 CDI',
      driver: 'Fatima Al-Mansoor',
      deviceType: 'Teltonika FMB003 OBD',
      imei: '862094038192134',
    },
    fuel: {
      currentLevel: 64.2,
      maxCapacity: 75,
      percentage: 85.6,
      sensorType: 'OBD-II CAN Bus PID 0x2F',
      avgConsumptionLper100km: 9.8,
      totalConsumedLiters: 8260,
      levelHistory: [
        { timestamp: now - 5 * hour, level: 72, speed: 42 },
        { timestamp: now - 4 * hour, level: 70, speed: 35 },
        { timestamp: now - 3 * hour, level: 68, speed: 40 },
        { timestamp: now - 2 * hour, level: 66, speed: 30 },
        { timestamp: now - 1 * hour, level: 65, speed: 45 },
        { timestamp: now, level: 64.2, speed: 38 },
      ],
      recentTransactions: [
        {
          id: 'ft-201-1',
          type: 'Refuel',
          volumeLiters: 58.5,
          timestamp: now - 7 * hour,
          locationName: 'Aral Berlin Alexanderplatz',
          startLevelLiters: 15.0,
          endLevelLiters: 73.5,
          driver: 'Fatima Al-Mansoor',
          cost: 104.71,
        },
      ],
    },
  },
  {
    id: 1048208,
    nm: 'Ford Transit Custom #202 - Maintenance Van',
    cls: 2,
    mu: 0,
    pos: {
      t: Math.floor(now / 1000) - 7200,
      y: 50.1109,
      x: 8.6821,
      c: 0,
      s: 0,
      sc: 0,
    },
    lmsg: {
      t: Math.floor(now / 1000) - 7200,
      p: {
        can_fls: 18.2,
        ignition: 0,
        pwr_ext: 12.1,
        battery: 3.95,
        speed: 0,
      },
    },
    sens: {
      1: { id: 1, n: 'OBD Fuel Level', t: 'fuel level', m: 'l', p: 'can_fls' },
    },
    mileageKm: 62400,
    engineHours: 1420,
    state: 'offline',
    profile: {
      vin: 'WF0YXXTTGYL819203',
      plate: 'DE-F-TR-202',
      model: 'Ford Transit Custom 2.0 EcoBlue',
      driver: 'Lucas Richter',
      deviceType: 'Teltonika FMB920',
      imei: '862094038192167',
    },
    fuel: {
      currentLevel: 18.2,
      maxCapacity: 70,
      percentage: 26.0,
      sensorType: 'OBD-II CAN Fuel Level',
      avgConsumptionLper100km: 8.7,
      totalConsumedLiters: 5430,
      levelHistory: [
        { timestamp: now - 5 * hour, level: 25, speed: 0 },
        { timestamp: now - 4 * hour, level: 22, speed: 45 },
        { timestamp: now - 3 * hour, level: 19, speed: 50 },
        { timestamp: now - 2 * hour, level: 18.2, speed: 0 },
        { timestamp: now - 1 * hour, level: 18.2, speed: 0 },
        { timestamp: now, level: 18.2, speed: 0 },
      ],
      recentTransactions: [],
    },
  },
];

// Individual fuel sensor index mappings per vehicle (each vehicle has fuel sensor at an individual index)
const VEHICLE_SENSOR_CONFIGS: Array<{
  fuelIndex: string | null;
  sensorId: number | null;
  sensors: Record<string, any>;
}> = [
  {
    // Unit 0 (Volvo FH16): Fuel Level at index "3"
    fuelIndex: '3',
    sensorId: 3,
    sensors: {
      '1': { id: 1, n: 'CAN Speed', t: 'speed', m: 'km/h', p: 'speed' },
      '2': { id: 2, n: 'Engine Ignition', t: 'ignition', m: '', p: 'ignition' },
      '3': { id: 3, n: 'Fuel Level', t: 'fuel level', m: 'l', p: 'can_fls' },
    },
  },
  {
    // Unit 1 (Scania R500): Fuel Level at index "2"
    fuelIndex: '2',
    sensorId: 2,
    sensors: {
      '1': { id: 1, n: 'Engine Ignition', t: 'ignition', m: '', p: 'ignition' },
      '2': { id: 2, n: 'Fuel Level', t: 'fuel level', m: 'l', p: 'can_fls' },
    },
  },
  {
    // Unit 2 (Mercedes Actros): Fuel Level at index "7"
    fuelIndex: '7',
    sensorId: 7,
    sensors: {
      '1': { id: 1, n: 'Odometer Mileage', t: 'mileage', m: 'km', p: 'mileage' },
      '2': { id: 2, n: 'Battery Voltage', t: 'voltage', m: 'V', p: 'battery' },
      '7': { id: 7, n: 'Fuel Level', t: 'fuel level', m: 'l', p: 'can_fls' },
    },
  },
  {
    // Unit 3 (MAN TGX): Fuel Level at index "2"
    fuelIndex: '2',
    sensorId: 2,
    sensors: {
      '1': { id: 1, n: 'Engine Ignition', t: 'ignition', m: '', p: 'ignition' },
      '2': { id: 2, n: 'Fuel Level', t: 'fuel level', m: 'l', p: 'can_fls' },
    },
  },
  {
    // Unit 4 (DAF XF): Fuel Level at index "5"
    fuelIndex: '5',
    sensorId: 5,
    sensors: {
      '1': { id: 1, n: 'Vehicle Speed', t: 'speed', m: 'km/h', p: 'speed' },
      '2': { id: 2, n: 'Engine Temp', t: 'temperature', m: '°C', p: 'engine_temp' },
      '5': { id: 5, n: 'Fuel Level', t: 'fuel level', m: 'l', p: 'can_fls' },
    },
  },
  {
    // Unit 5 (Renault T High): Fuel Level at index "8"
    fuelIndex: '8',
    sensorId: 8,
    sensors: {
      '1': { id: 1, n: 'Engine Ignition', t: 'ignition', m: '', p: 'ignition' },
      '8': { id: 8, n: 'Fuel Level', t: 'fuel level', m: 'l', p: 'can_fls' },
    },
  },
  {
    // Unit 6 (Iveco S-Way): Fuel Level at index "4"
    fuelIndex: '4',
    sensorId: 4,
    sensors: {
      '1': { id: 1, n: 'Engine Ignition', t: 'ignition', m: '', p: 'ignition' },
      '2': { id: 2, n: 'CAN Speed', t: 'speed', m: 'km/h', p: 'speed' },
      '4': { id: 4, n: 'Fuel Level', t: 'fuel level', m: 'l', p: 'can_fls' },
    },
  },
  {
    // Unit 7 (Ford Transit): NO "Fuel Level" sensor configured (demonstrates '--' display)
    fuelIndex: null,
    sensorId: null,
    sensors: {
      '1': { id: 1, n: 'Engine Ignition', t: 'ignition', m: '', p: 'ignition' },
      '2': { id: 2, n: 'Odometer Mileage', t: 'mileage', m: 'km', p: 'mileage' },
    },
  },
];

// Configure sens object matching Wialon core/search_items where each vehicle has its OWN distinct fuel sensor index
INITIAL_MOCK_UNITS.forEach((u, idx) => {
  const config = VEHICLE_SENSOR_CONFIGS[idx % VEHICLE_SENSOR_CONFIGS.length];
  u.sens = { ...config.sensors };

  if (config.fuelIndex === null) {
    u.fuel.currentLevel = null;
    u.fuel.sensorType = '';
    u.fuel.calcSensorName = undefined;
    u.fuel.calcSensorId = undefined;
    u.fuel.calcSensorFormat = undefined;
  } else {
    const val = u.fuel.currentLevel;
    u.fuel.calcSensorId = config.sensorId ?? Number(config.fuelIndex);
    u.fuel.calcSensorName = 'Fuel Level';
    u.fuel.calcSensorUnit = 'l';
    u.fuel.calcSensorFormat = val !== null ? `${val} l` : undefined;

    // Attach calibration table (tbl) and io_270 parameter from calibrations.json
    const calib = (baseCalibrations as any)[String(u.id)] || (baseCalibrations as any)[String(idx + 1)];
    if (calib && calib.tbl && u.sens[config.fuelIndex]) {
      u.sens[config.fuelIndex].p = 'io_270';
      u.sens[config.fuelIndex].tbl = calib.tbl;
    }

    // Set io_270 telemetry in latest message
    if (u.lmsg?.p) {
      // Approximate inverse io_270 for mock telemetry ~ 2500 - 4500
      const approxIo270 = val !== null ? Math.round((val / 0.075)) : 3200;
      u.lmsg.p.io_270 = approxIo270;
    }
  }
});
