import type { Appliance, HourWeather, Profile } from "./types";

export const CITIES: Record<string, { lat: number; lon: number }> = {
  Lahore: { lat: 31.5497, lon: 74.3436 },
  Karachi: { lat: 24.8607, lon: 67.0011 },
  Islamabad: { lat: 33.6844, lon: 73.0479 },
  Rawalpindi: { lat: 33.5651, lon: 73.0169 },
  Faisalabad: { lat: 31.4504, lon: 73.135 },
  Multan: { lat: 30.1575, lon: 71.5249 },
  Peshawar: { lat: 34.0151, lon: 71.5249 },
  Quetta: { lat: 30.1798, lon: 66.975 },
  Hyderabad: { lat: 25.396, lon: 68.3578 },
  Gujranwala: { lat: 32.1877, lon: 74.1945 },
  Sialkot: { lat: 32.4945, lon: 74.5229 },
};

let n = 0;
export const uid = () => `a${Date.now().toString(36)}${(n++).toString(36)}`;

const app = (p: Omit<Appliance, "id" | "on">): Appliance => ({ id: uid(), on: true, ...p });

export function demoAppliances(): Appliance[] {
  return [
    app({ name: "Fridge", watts: 150, qty: 1, start: 0, end: 0, essential: true, shiftable: false }),
    app({ name: "LED lights", watts: 12, qty: 8, start: 18, end: 0, essential: true, shiftable: false }),
    app({ name: "Ceiling fans", watts: 80, qty: 4, start: 0, end: 0, essential: true, shiftable: false }),
    app({ name: "WiFi router", watts: 12, qty: 1, start: 0, end: 0, essential: true, shiftable: false }),
    app({ name: "1.5 ton inverter AC", watts: 1300, qty: 1, start: 22, end: 2, essential: false, shiftable: false }),
    app({ name: "LED TV", watts: 100, qty: 1, start: 19, end: 23, essential: false, shiftable: false }),
    app({ name: "Water pump (1 HP)", watts: 750, qty: 1, start: 21, end: 22, essential: false, shiftable: true }),
    app({ name: "Washing machine", watts: 500, qty: 1, start: 20, end: 21, essential: false, shiftable: true }),
    app({ name: "Electric iron", watts: 1000, qty: 1, start: 21, end: 22, essential: false, shiftable: true }),
  ];
}

export function demoProfile(): Profile {
  return {
    city: "Lahore",
    ...CITIES.Lahore,
    panelKw: 5,
    batteryKwh: 5,
    batteryType: "lithium",
    inverterKw: 6,
    gridCharging: false,
    batteryPct: 62,
    appliances: demoAppliances(),
    outages: [
      { start: 21, end: 23 },
      { start: 1, end: 5 },
    ],
  };
}

export const SAMPLE_SMS =
  "LESCO: Dear customer, load management schedule for 11kV Model Town feeder: 9:00 PM to 11:00 PM and 1:00 AM to 5:00 AM. Shutdown on 13-10 from 10 AM till 1 PM for maintenance.";

/** Clear-sky-ish curve used when the weather API is unreachable. */
export function fallbackWeather(startDate: string, startHour: number, hours: number): HourWeather[] {
  const out: HourWeather[] = [];
  const base = new Date(`${startDate}T00:00:00Z`);
  for (let i = 0; i < hours; i++) {
    const abs = startHour + i;
    const d = new Date(base.getTime() + Math.floor(abs / 24) * 86400000);
    const h = abs % 24;
    const sun = Math.max(0, Math.sin(((h - 6) / 12) * Math.PI));
    out.push({
      time: `${d.toISOString().slice(0, 10)}T${String(h).padStart(2, "0")}:00`,
      radiation: Math.round(750 * sun),
      cloud: 10,
      temp: Math.round(26 + 8 * sun),
    });
  }
  return out;
}
