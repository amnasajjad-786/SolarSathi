export type BatteryType = "lithium" | "lead-acid";
export type Lang = "en" | "ur";

/** A daily time window in local hours (0–24, fractional allowed). end < start wraps past midnight; start === end means all day. */
export interface Window {
  start: number;
  end: number;
}

export interface Appliance {
  id: string;
  name: string;
  watts: number; // per unit
  qty: number;
  start: number; // usual daily run window
  end: number;
  essential: boolean; // fridge, lights, router: never cut
  shiftable: boolean; // pump, washing machine, iron: can be moved to solar hours
  on: boolean; // what-if toggle
  outageFactor?: number; // set by optimizer: share of power used while grid is down (0 = off, 0.55 = AC eco mode)
}

export interface Profile {
  city: string;
  lat: number;
  lon: number;
  panelKw: number;
  batteryKwh: number;
  batteryType: BatteryType;
  inverterKw: number;
  gridCharging: boolean; // inverter charges battery from WAPDA when grid is on
  batteryPct: number;
  appliances: Appliance[];
  outages: Window[];
}

export interface HourWeather {
  time: string; // "YYYY-MM-DDTHH:00" in Asia/Karachi
  radiation: number; // W/m²
  cloud: number; // %
  temp: number; // °C
}
