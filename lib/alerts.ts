import type { OptimizeResult } from "./optimize";
import { activeLoadKw, minSocPct, type SimResult } from "./simulate";
import type { Lang, Profile } from "./types";
import { fmtDuration, fmtHour, inWindow } from "./time";

export type AlertLevel = "critical" | "warning" | "info" | "good";
export type View = "dashboard" | "battery" | "outages" | "appliances" | "plan" | "forecast";

export interface Alert {
  id: string;
  level: AlertLevel;
  title: string;
  detail: string;
  action?: { label: string; view: View };
}

export interface NextOutage {
  active: boolean; // load-shedding right now
  startsIn: number; // hours from now (0 if active)
  start: number; // hour of day
  end: number; // hour of day when power returns
}

/** Find the current or next outage from the simulation steps (already aligned to "now"). */
export function nextOutage(sim: SimResult, startHour: number, minuteNow: number): NextOutage | null {
  const nowT = minuteNow / 60;
  const steps = sim.steps.filter((s) => s.t + 0.25 > nowT);
  const i = steps.findIndex((s) => !s.grid);
  if (i < 0) return null;
  const startT = Math.max(nowT, steps[i].t);
  const back = steps.slice(i).find((s) => s.grid);
  const endT = back ? back.t : sim.horizonH;
  return {
    active: startT <= nowT + 1e-6,
    startsIn: startT - nowT,
    start: (startHour + startT) % 24,
    end: (startHour + endT) % 24,
  };
}

/** Hours the battery can run the house right now if the grid goes off. */
export function backupHours(p: Profile, hodNow: number): { hours: number; loadKw: number } {
  const loadKw = activeLoadKw(p.appliances, hodNow, false);
  const usable = (Math.max(0, p.batteryPct - minSocPct(p.batteryType)) / 100) * p.batteryKwh;
  return { hours: loadKw > 0 ? usable / loadKw : Infinity, loadKw };
}

export function buildAlerts(args: {
  profile: Profile;
  opt: OptimizeResult;
  startHour: number;
  minute: number;
  tomorrow: { solarKwh: number; quality: "good" | "fair" | "poor"; maxTemp: number } | null;
  lang: Lang;
}): Alert[] {
  const { profile: p, opt, startHour, minute, tomorrow, lang } = args;
  const ur = lang === "ur";
  const at = (t: number) => fmtHour(startHour + t);
  const out: Alert[] = [];
  const base = opt.base;

  if (p.outages.length === 0) {
    out.push({
      id: "no-schedule",
      level: "info",
      title: ur ? "Load-shedding schedule add karein" : "Add your load-shedding schedule",
      detail: ur ? "SMS paste karein — AI times nikal lega." : "Paste your DISCO's SMS and the AI will read the times.",
      action: { label: ur ? "Schedule add karein" : "Add schedule", view: "outages" },
    });
  }

  if (base.runOutAt !== null) {
    const gap = base.powerBackAt !== null ? base.powerBackAt - base.runOutAt : null;
    out.push({
      id: "runout",
      level: "critical",
      title: ur ? `Battery ${at(base.runOutAt)} par khatam ho jaye gi` : `Battery runs out at ${at(base.runOutAt)}`,
      detail:
        (gap !== null
          ? ur
            ? `Bijli aane se ${fmtDuration(gap * 60)} pehle. `
            : `${fmtDuration(gap * 60)} before power returns. `
          : "") +
        (opt.best.runOutAt === null
          ? ur
            ? `AI plan ke ${opt.actions.length} qadam se poori raat chalay gi.`
            : `${opt.actions.length} changes in the AI plan keep you powered all night.`
          : ur
            ? "AI plan se andhera kam hoga, lekin battery choti hai."
            : "The AI plan shortens the blackout, but the battery is undersized for this schedule."),
      action: { label: ur ? "AI plan dekhein" : "See AI plan", view: "plan" },
    });
  }

  if (base.overloadAt !== null) {
    out.push({
      id: "overload",
      level: "critical",
      title: ur ? "Inverter overload ka khatra" : "Inverter overload risk",
      detail: ur
        ? `${at(base.overloadAt)} par ${base.peakOutageLoadKw.toFixed(1)} kW load, inverter sirf ${p.inverterKw} kW.`
        : `${base.peakOutageLoadKw.toFixed(1)} kW load at ${at(base.overloadAt)} on a ${p.inverterKw} kW inverter — it may trip.`,
      action: { label: ur ? "Appliances dekhein" : "Review appliances", view: "appliances" },
    });
  }

  const nx = nextOutage(base, startHour, minute);
  if (nx) {
    const soon = nx.active || nx.startsIn <= 2;
    if (soon) {
      out.push({
        id: "outage-soon",
        level: "warning",
        title: nx.active
          ? ur
            ? `Load-shedding jaari — ${fmtHour(nx.end)} tak`
            : `Load-shedding now — until ${fmtHour(nx.end)}`
          : ur
            ? `Load-shedding ${fmtDuration(nx.startsIn * 60)} mein`
            : `Load-shedding in ${fmtDuration(nx.startsIn * 60)}`,
        detail: nx.active
          ? ur
            ? "Heavy appliances (iron, motor, microwave) abhi na chalayein."
            : "Avoid heavy loads (iron, motor, microwave) until the grid is back."
          : ur
            ? `${fmtHour(nx.start)} se pehle motor chala lein aur battery charge rakhein.`
            : `Run the water motor and charge phones before ${fmtHour(nx.start)}.`,
        action: { label: ur ? "Schedule" : "View schedule", view: "outages" },
      });
    }
  }

  if (tomorrow?.quality === "poor") {
    out.push({
      id: "cloudy",
      level: "warning",
      title: ur ? "Kal badal — solar kam" : "Cloudy tomorrow — low solar",
      detail: ur
        ? `Sirf ~${tomorrow.solarKwh.toFixed(1)} kWh ka andaza. Aaj raat battery bacha kar rakhein.`
        : `Only ~${tomorrow.solarKwh.toFixed(1)} kWh expected, so the battery won't fully refill. Go easy tonight.`,
      action: { label: ur ? "Forecast" : "Forecast", view: "forecast" },
    });
  }

  if (tomorrow && tomorrow.maxTemp >= 38) {
    out.push({
      id: "heat",
      level: "warning",
      title: ur ? `Shadeed garmi: ${Math.round(tomorrow.maxTemp)}°C` : `Heat alert: ${Math.round(tomorrow.maxTemp)}°C tomorrow`,
      detail: ur
        ? "Outage se pehle kamray thanday kar lein; parday band rakhein."
        : "Pre-cool rooms on solar before the outage and keep curtains closed in the afternoon.",
    });
  }

  const shifts = opt.actions.filter((a) => a.kind === "shift");
  if (shifts.length) {
    out.push({
      id: "shift",
      level: "info",
      title: ur ? `${shifts.length} cheezein dopahar ko chalayein` : `Move ${shifts.length} load${shifts.length > 1 ? "s" : ""} to sunny hours`,
      detail: shifts.map((a) => `${a.name} → ${fmtHour(a.to!.start)}`).join(" · "),
      action: { label: ur ? "Plan" : "See plan", view: "plan" },
    });
  } else if (base.unusedSolarKwh >= 1.5) {
    out.push({
      id: "unused",
      level: "info",
      title: ur ? `${base.unusedSolarKwh.toFixed(1)} kWh solar zaya` : `${base.unusedSolarKwh.toFixed(1)} kWh of solar going unused`,
      detail: ur
        ? "Pani ki tanki, kapray dhona ya iron 11–2 baje ke darmiyan karein."
        : "Fill the water tank, do laundry or ironing between 11 AM and 2 PM.",
      action: { label: ur ? "Appliances" : "Appliances", view: "appliances" },
    });
  }

  if (!p.gridCharging && opt.gridCharging) {
    out.push({
      id: "gridcharge",
      level: "info",
      title: ur ? "Grid charging ON karein" : "Turn on grid charging",
      detail: ur ? "Outage se pehle WAPDA se battery full karein." : "Let WAPDA top up the battery between outages.",
      action: { label: ur ? "Battery settings" : "Battery settings", view: "battery" },
    });
  }

  if (base.runOutAt === null && p.outages.length > 0) {
    out.push({
      id: "ok",
      level: "good",
      title: ur ? "Battery har outage mein chalay gi" : "Battery covers every outage",
      detail: ur
        ? `Sab se kam ${Math.round(base.minSoc)}% (${at(base.minSocAt)}).`
        : `Lowest point ${Math.round(base.minSoc)}% at ${at(base.minSocAt)}.`,
    });
  }

  const rank: Record<AlertLevel, number> = { critical: 0, warning: 1, info: 2, good: 3 };
  return out.sort((a, b) => rank[a.level] - rank[b.level]);
}

export function isOutageNow(p: Profile, hod: number) {
  return p.outages.some((w) => inWindow(hod, w));
}
