import type { Appliance, Profile, Window } from "./types";
import { inWindow } from "./time";

export const STEP_H = 0.25; // 15-minute resolution
const PANEL_DERATE = 0.75; // heat, dust, wiring and inverter losses typical of Pakistani rooftops
const CHARGE_EFF = 0.92;
const GRID_CHARGE_C = 0.15; // grid charging rate as a fraction of capacity per hour

export function minSocPct(type: Profile["batteryType"]): number {
  return type === "lithium" ? 10 : 50; // lead-acid dies early if drained below ~50%
}

export interface SimInput {
  profile: Pick<Profile, "panelKw" | "batteryKwh" | "batteryType" | "inverterKw" | "gridCharging">;
  batteryPct: number;
  startHour: number; // local hour of day at t=0
  radiation: number[]; // W/m² per hour starting at startHour
  appliances: Appliance[];
  outages: Window[];
}

export interface SimStep {
  t: number; // hours since start
  hod: number; // hour of day
  soc: number; // %
  solarKw: number;
  loadKw: number;
  grid: boolean;
  unmetKw: number;
}

export interface SimResult {
  steps: SimStep[];
  horizonH: number;
  runOutAt: number | null; // hours since start when battery first hits its floor during an outage
  powerBackAt: number | null; // when grid returns after that run-out
  darkMinutes: number; // total minutes the house is without power
  minSoc: number;
  minSocAt: number;
  endSoc: number;
  outageDrawKwh: number; // energy pulled from battery during outages
  unusedSolarKwh: number; // solar that had nowhere to go
  solarKwh: number;
  overloadAt: number | null; // outage load above inverter rating
  peakOutageLoadKw: number;
}

export function activeLoadKw(apps: Appliance[], hod: number, grid: boolean): number {
  let w = 0;
  for (const a of apps) {
    if (!a.on) continue;
    const f = grid ? 1 : (a.outageFactor ?? 1);
    if (f > 0 && inWindow(hod, a)) w += a.watts * a.qty * f;
  }
  return w / 1000;
}

export function isOutage(outages: Window[], hod: number): boolean {
  return outages.some((w) => inWindow(hod, w));
}

export function simulate(input: SimInput): SimResult {
  const { profile, startHour, radiation, appliances, outages } = input;
  const cap = Math.max(0.1, profile.batteryKwh);
  const floorE = (cap * minSocPct(profile.batteryType)) / 100;
  let e = (cap * Math.min(100, Math.max(0, input.batteryPct))) / 100;
  const horizonH = radiation.length;
  const n = Math.round(horizonH / STEP_H);

  const steps: SimStep[] = [];
  let runOutAt: number | null = null;
  let powerBackAt: number | null = null;
  let darkSteps = 0;
  let minE = e;
  let minAt = 0;
  let outageDraw = 0;
  let unused = 0;
  let solarTotal = 0;
  let overloadAt: number | null = null;
  let peakOutageLoad = 0;

  for (let i = 0; i < n; i++) {
    const t = i * STEP_H;
    const hod = (startHour + t) % 24;
    const rad = radiation[Math.min(radiation.length - 1, Math.floor(t))] ?? 0;
    const solarKw = Math.min(profile.panelKw * (rad / 1000) * PANEL_DERATE, profile.inverterKw || Infinity);
    const grid = !isOutage(outages, hod);
    const loadKw = activeLoadKw(appliances, hod, grid);
    let unmetKw = 0;
    solarTotal += solarKw * STEP_H;

    if (grid) {
      if (runOutAt !== null && powerBackAt === null) powerBackAt = t;
      const surplus = Math.max(0, solarKw - loadKw) * STEP_H;
      const room = (cap - e) / CHARGE_EFF;
      const fromSolar = Math.min(surplus, room);
      e += fromSolar * CHARGE_EFF;
      unused += surplus - fromSolar;
      if (profile.gridCharging && e < cap) {
        e = Math.min(cap, e + cap * GRID_CHARGE_C * STEP_H * CHARGE_EFF);
      }
    } else {
      peakOutageLoad = Math.max(peakOutageLoad, loadKw);
      if (overloadAt === null && profile.inverterKw > 0 && loadKw > profile.inverterKw) overloadAt = t;
      const net = solarKw - loadKw;
      if (net >= 0) {
        const room = (cap - e) / CHARGE_EFF;
        const put = Math.min(net * STEP_H, room);
        e += put * CHARGE_EFF;
        unused += net * STEP_H - put;
      } else {
        const need = -net * STEP_H;
        const avail = Math.max(0, e - floorE);
        if (need <= avail + 1e-9) {
          e -= need;
          outageDraw += need;
        } else {
          e = floorE;
          outageDraw += avail;
          unmetKw = (need - avail) / STEP_H;
          darkSteps += (need - avail) / need;
          if (runOutAt === null) runOutAt = t + (avail / need) * STEP_H;
        }
      }
    }

    if (e < minE - 1e-9) {
      minE = e;
      minAt = t;
    }
    steps.push({ t, hod, soc: (e / cap) * 100, solarKw, loadKw, grid, unmetKw });
  }

  return {
    steps,
    horizonH,
    runOutAt,
    powerBackAt,
    darkMinutes: darkSteps * STEP_H * 60,
    minSoc: (minE / cap) * 100,
    minSocAt: minAt,
    endSoc: (e / cap) * 100,
    outageDrawKwh: outageDraw,
    unusedSolarKwh: unused,
    solarKwh: solarTotal,
    overloadAt,
    peakOutageLoadKw: peakOutageLoad,
  };
}
