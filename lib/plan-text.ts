import type { Action } from "./optimize";
import type { SimResult } from "./simulate";
import type { Lang } from "./types";
import { fmtDuration, fmtHour, fmtWindow } from "./time";

export interface Verdict {
  ok: boolean;
  title: string;
  detail: string;
}

export function verdict(sim: SimResult, startHour: number, lang: Lang): Verdict {
  const at = (t: number) => fmtHour(startHour + t);
  if (sim.runOutAt === null) {
    return lang === "ur"
      ? {
          ok: true,
          title: "Battery poori outage chalay gi ✅",
          detail: `Sab se kam charge ${Math.round(sim.minSoc)}% hoga (${at(sim.minSocAt)} par).`,
        }
      : {
          ok: true,
          title: "Your battery will last ✅",
          detail: `Lowest point: ${Math.round(sim.minSoc)}% at ${at(sim.minSocAt)}.`,
        };
  }
  const gap = sim.powerBackAt !== null ? sim.powerBackAt - sim.runOutAt : null;
  return lang === "ur"
    ? {
        ok: false,
        title: `Battery ${at(sim.runOutAt)} par khatam ho jaye gi ⚠️`,
        detail:
          gap !== null
            ? `Bijli wapas aane se ${fmtDuration(gap * 60)} pehle. Kul ${fmtDuration(sim.darkMinutes)} andhera.`
            : `Kul ${fmtDuration(sim.darkMinutes)} andhera.`,
      }
    : {
        ok: false,
        title: `Battery runs out at ${at(sim.runOutAt)} ⚠️`,
        detail:
          gap !== null
            ? `That's ${fmtDuration(gap * 60)} before power comes back — ${fmtDuration(sim.darkMinutes)} without power in total.`
            : `${fmtDuration(sim.darkMinutes)} without power in total.`,
      };
}

export function actionText(a: Action, lang: Lang): { title: string; detail: string } {
  const gain = a.gainMinutes >= 1 ? fmtDuration(a.gainMinutes) : null;
  const kwh = a.savedKwh >= 0.05 ? `${a.savedKwh.toFixed(1)} kWh` : null;
  const impact = [gain && (lang === "ur" ? `+${gain} backup` : `+${gain} backup`), kwh && (lang === "ur" ? `${kwh} battery bachat` : `${kwh} battery saved`)]
    .filter(Boolean)
    .join(" · ");
  const sfx = impact ? ` (${impact})` : "";

  switch (a.kind) {
    case "shift":
      return lang === "ur"
        ? { title: `${a.name}: ${fmtHour(a.to!.start)} par chalayein`, detail: `${fmtWindow(a.from!)} ki jagah dhoop ke waqt ${fmtWindow(a.to!)} — muft solar par${sfx}.` }
        : { title: `Run ${a.name} at ${fmtHour(a.to!.start)}`, detail: `Move it from ${fmtWindow(a.from!)} to ${fmtWindow(a.to!)} so free sunshine powers it, not your battery${sfx}.` };
    case "reduce":
      return lang === "ur"
        ? { title: `${a.name}: 26–27°C eco mode`, detail: `Load-shedding ke dauran AC band na karein, sirf temperature barha dein${sfx}.` }
        : { title: `${a.name}: eco mode at 26–27°C`, detail: `During load-shedding, keep it on but raise the temperature and use fan-auto${sfx}.` };
    case "cut":
      return lang === "ur"
        ? { title: `${a.name}: load-shedding mein band`, detail: `Sirf bijli jaane par band rakhein; WAPDA aate hi chala sakte hain${sfx}.` }
        : { title: `Switch off ${a.name} during outages`, detail: `Only while the grid is down — turn it back on when WAPDA returns${sfx}.` };
    case "setting":
      return lang === "ur"
        ? { title: "Inverter mein grid charging ON karein", detail: `Outage se pehle WAPDA se battery full kar lein${sfx}.` }
        : { title: "Turn on grid charging in your inverter", detail: `Let WAPDA top up the battery before the next outage (SBU → SUB / "Utility charge")${sfx}.` };
  }
}
