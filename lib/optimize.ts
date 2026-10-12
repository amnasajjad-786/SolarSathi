import type { Appliance, Window } from "./types";
import { simulate, isOutage, type SimInput, type SimResult } from "./simulate";
import { inWindow, windowHours } from "./time";

const AC_RE = /\b(ac|a\.c|air ?con\w*|split)\b/i;
const ECO_FACTOR = 0.55; // inverter AC at 26–27°C draws roughly half of full-cool power

export interface Action {
  kind: "shift" | "reduce" | "cut" | "setting";
  id: string;
  name: string;
  watts: number;
  from?: Window;
  to?: Window;
  gainMinutes: number; // fewer minutes in the dark
  savedKwh: number; // less energy pulled from the battery during outages
  socGain: number; // higher lowest-battery point, in % points
}

export interface OptimizeResult {
  base: SimResult;
  best: SimResult;
  appliances: Appliance[];
  gridCharging: boolean;
  actions: Action[];
}

/** Radiation for each hour of day, taken from its first occurrence in the forecast horizon. */
function radiationByHour(input: SimInput): number[] {
  const out = new Array(24).fill(0);
  const seen = new Array(24).fill(false);
  input.radiation.forEach((r, i) => {
    const h = (input.startHour + i) % 24;
    if (!seen[h]) {
      out[h] = r;
      seen[h] = true;
    }
  });
  return out;
}

function better(a: SimResult, b: SimResult): boolean {
  return (
    a.darkMinutes < b.darkMinutes - 1 ||
    a.minSoc > b.minSoc + 0.5 ||
    a.outageDrawKwh < b.outageDrawKwh - 0.05
  );
}

function diff(prev: SimResult, next: SimResult) {
  return {
    gainMinutes: Math.max(0, prev.darkMinutes - next.darkMinutes),
    savedKwh: Math.max(0, prev.outageDrawKwh - next.outageDrawKwh),
    socGain: Math.max(0, next.minSoc - prev.minSoc),
  };
}

export function optimize(input: SimInput): OptimizeResult {
  const base = simulate(input);
  let apps: Appliance[] = input.appliances.map((a) => ({ ...a, cutDuringOutage: false }));
  let gridCharging = input.profile.gridCharging;
  let cur = simulate({ ...input, appliances: apps });
  const actions: Action[] = [];
  const rad = radiationByHour(input);
  const run = (a: Appliance[], gc = gridCharging) =>
    simulate({ ...input, appliances: a, profile: { ...input.profile, gridCharging: gc } });

  // 1. Shift flexible loads (pump, washing machine, iron…) into the sunniest outage-free hours.
  const shiftables = apps
    .filter((a) => a.on && a.shiftable && windowHours(a) <= 6)
    .sort((a, b) => b.watts * b.qty - a.watts * a.qty);
  for (const a of shiftables) {
    const dur = windowHours(a);
    let bestStart = -1;
    let bestScore = -Infinity;
    for (let s = 7; s + dur <= 18; s++) {
      let score = 0;
      for (let h = s; h < s + dur; h += 0.25) {
        score += rad[Math.floor(h) % 24];
        if (isOutage(input.outages, h)) score -= 2000; // avoid running on battery
      }
      if (score > bestScore) {
        bestScore = score;
        bestStart = s;
      }
    }
    if (bestStart < 0 || Math.abs(bestStart - a.start) < 0.01) continue;
    const to: Window = { start: bestStart, end: (bestStart + dur) % 24 };
    const trial = apps.map((x) => (x.id === a.id ? { ...x, ...to } : x));
    const res = run(trial);
    const usesBattery = cur.steps.some((st) => !st.grid && inWindow(st.hod, a));
    if (better(res, cur) || usesBattery) {
      actions.push({ kind: "shift", id: a.id, name: a.name, watts: a.watts * a.qty, from: { start: a.start, end: a.end }, to, ...diff(cur, res) });
      apps = trial;
      cur = res;
    }
  }

  const usedInOutage = (a: Appliance) => cur.steps.some((st) => !st.grid && inWindow(st.hod, a));
  const outageKw = (a: Appliance) => a.watts * a.qty * (a.outageFactor ?? 1);
  const apply = (id: string, patch: Partial<Appliance>) => apps.map((x) => (x.id === id ? { ...x, ...patch } : x));

  // 2. Free fix first: let WAPDA top up the battery before the outage.
  if (cur.runOutAt !== null && !gridCharging) {
    const res = run(apps, true);
    if (better(res, cur)) {
      actions.push({ kind: "setting", id: "grid-charging", name: "Grid charging", watts: 0, ...diff(cur, res) });
      gridCharging = true;
      cur = res;
    }
  }

  // 3. Switch off non-cooling extras (TV, geyser, microwave…) during outages, biggest first.
  while (cur.runOutAt !== null) {
    const cand = apps
      .filter((a) => a.on && !a.essential && !AC_RE.test(a.name) && outageKw(a) > 0 && usedInOutage(a))
      .sort((a, b) => outageKw(b) - outageKw(a))[0];
    if (!cand) break;
    const trial = apply(cand.id, { outageFactor: 0 });
    const res = run(trial);
    actions.push({ kind: "cut", id: cand.id, name: cand.name, watts: cand.watts * cand.qty, ...diff(cur, res) });
    apps = trial;
    cur = res;
  }

  // 4. Keep people cool: AC eco mode (26–27°C) during outages, and only switch it off if that still isn't enough.
  for (const a of apps.filter((x) => x.on && AC_RE.test(x.name) && usedInOutage(x))) {
    if (cur.runOutAt === null) break;
    const eco = run(apply(a.id, { outageFactor: ECO_FACTOR }));
    if (eco.runOutAt === null) {
      actions.push({ kind: "reduce", id: a.id, name: a.name, watts: a.watts * a.qty * (1 - ECO_FACTOR), ...diff(cur, eco) });
      apps = apply(a.id, { outageFactor: ECO_FACTOR });
      cur = eco;
    } else {
      const trial = apply(a.id, { outageFactor: 0 });
      const res = run(trial);
      actions.push({ kind: "cut", id: a.id, name: a.name, watts: a.watts * a.qty, ...diff(cur, res) });
      apps = trial;
      cur = res;
    }
  }

  return { base, best: cur, appliances: apps, gridCharging, actions };
}
