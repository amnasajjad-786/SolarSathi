import { simulate } from "../lib/simulate";
import { optimize } from "../lib/optimize";
import { demoProfile, fallbackWeather } from "../lib/demo-data";
import { fmtHour, fmtDuration } from "../lib/time";

// Plan check: 5 kWh lithium at 40%, 600 W constant, 8h night outage → usable 1.5 kWh (10% floor) → 2.5 h.
const r = simulate({
  profile: { panelKw: 0, batteryKwh: 5, batteryType: "lithium", inverterKw: 5, gridCharging: false },
  batteryPct: 40, startHour: 20, radiation: new Array(24).fill(0),
  appliances: [{ id: "x", name: "load", watts: 600, qty: 1, start: 0, end: 0, essential: true, shiftable: false, on: true }],
  outages: [{ start: 20, end: 4 }],
});
console.log("runOut after", r.runOutAt, "h (expect 2.5); dark", fmtDuration(r.darkMinutes), "(expect 5h 30m)");

const p = demoProfile();
const startHour = 20;
const rad = fallbackWeather("2026-10-12", startHour, 48 - startHour).map((w) => w.radiation);
const o = optimize({ profile: p, batteryPct: p.batteryPct, startHour, radiation: rad, appliances: p.appliances, outages: p.outages });
const v = (s: typeof o.base) => s.runOutAt === null ? `lasts, min ${s.minSoc.toFixed(0)}%` : `runs out ${fmtHour(startHour + s.runOutAt)}, dark ${fmtDuration(s.darkMinutes)}`;
console.log("demo base:", v(o.base), "| best:", v(o.best));
for (const a of o.actions) console.log(" ", a.kind, a.name, a.to ? `→ ${fmtHour(a.to.start)}` : "", `+${Math.round(a.gainMinutes)}m`, `${a.savedKwh.toFixed(2)}kWh`, `+${a.socGain.toFixed(1)}%`);
