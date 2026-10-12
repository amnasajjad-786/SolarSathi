"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { optimize, type Action, type OptimizeResult } from "./optimize";
import { minSocPct, type SimResult } from "./simulate";
import { demoProfile, fallbackWeather } from "./demo-data";
import { fmtDuration, fmtHour, fmtWindow, nowInPakistan } from "./time";
import { buildAlerts, type Alert } from "./alerts";
import type { Appliance, HourWeather, Lang, Profile } from "./types";
import type { AiPlan } from "@/app/api/plan/route";

const STORE = "solarsaathi.profile.v1";
const LANG_STORE = "solarsaathi.lang";

export interface Tomorrow {
  date: string;
  solarKwh: number;
  cloud: number;
  maxTemp: number;
  quality: "good" | "fair" | "poor";
}

export interface Applied {
  prev: { appliances: Appliance[]; gridCharging: boolean };
  actions: Action[];
  facts: Record<string, unknown>;
}

/** All app state + derived simulation, shared by every view. */
export function useSolarModel() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [lang, setLang] = useState<Lang>("en");
  const [weather, setWeather] = useState<{ source: string; hours: HourWeather[] } | null>(null);
  const [clock, setClock] = useState(() => nowInPakistan());
  const [applied, setApplied] = useState<Applied | null>(null);

  useEffect(() => {
    let p: Profile = demoProfile();
    try {
      const raw = localStorage.getItem(STORE);
      if (raw) p = { ...p, ...JSON.parse(raw) };
      const l = localStorage.getItem(LANG_STORE);
      if (l === "en" || l === "ur") setLang(l);
    } catch {}
    setProfile(p);
    const id = setInterval(() => setClock(nowInPakistan()), 60_000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    if (!profile) return;
    try {
      localStorage.setItem(STORE, JSON.stringify(profile));
    } catch {}
  }, [profile]);

  useEffect(() => {
    try {
      localStorage.setItem(LANG_STORE, lang);
    } catch {}
  }, [lang]);

  const lat = profile?.lat;
  const lon = profile?.lon;
  useEffect(() => {
    if (lat === undefined || lon === undefined) return;
    let cancelled = false;
    fetch(`/api/weather?lat=${lat}&lon=${lon}`)
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((j) => !cancelled && setWeather(j))
      .catch(() => !cancelled && setWeather({ source: "fallback", hours: [] }));
    return () => {
      cancelled = true;
    };
  }, [lat, lon]);

  const startHour = clock.hour;
  const horizon = 48 - startHour; // now → end of tomorrow

  const hours = useMemo(() => {
    const key = `${clock.date}T${String(startHour).padStart(2, "0")}:00`;
    const hrs = weather?.hours ?? [];
    const i = hrs.findIndex((h) => h.time === key);
    return i >= 0 && hrs.length - i >= horizon ? hrs.slice(i, i + horizon) : fallbackWeather(clock.date, startHour, horizon);
  }, [weather, clock.date, startHour, horizon]);

  const tomorrow: Tomorrow | null = useMemo(() => {
    if (!profile) return null;
    const date = hours.find((h) => h.time.slice(0, 10) > clock.date)?.time.slice(0, 10);
    const day = hours.filter((h) => h.time.startsWith(date ?? "x"));
    if (!day.length) return null;
    const sun = day.filter((h) => {
      const hr = Number(h.time.slice(11, 13));
      return hr >= 8 && hr <= 16;
    });
    const radSum = day.reduce((s, h) => s + h.radiation, 0);
    const ratio = radSum / 5700; // ≈ clear-sky daily Wh/m² for Pakistan in this season
    return {
      date: date!,
      solarKwh: (profile.panelKw * radSum * 0.75) / 1000,
      cloud: sun.reduce((s, h) => s + h.cloud, 0) / Math.max(1, sun.length),
      maxTemp: Math.max(...day.map((h) => h.temp)),
      quality: ratio >= 0.8 ? "good" : ratio >= 0.5 ? "fair" : "poor",
    };
  }, [hours, clock.date, profile]);

  const opt: OptimizeResult | null = useMemo(() => {
    if (!profile) return null;
    return optimize({
      profile,
      batteryPct: profile.batteryPct,
      startHour,
      radiation: hours.map((h) => h.radiation),
      appliances: profile.appliances,
      outages: profile.outages,
    });
  }, [profile, startHour, hours]);

  const facts = useMemo(() => {
    if (!profile || !opt) return {};
    // Hour granularity only: a per-minute timestamp would re-trigger Gemini every minute.
    return buildFacts(profile, opt.base, opt.best, opt.actions, startHour, tomorrow);
  }, [profile, opt, startHour, tomorrow]);

  const alerts: Alert[] = useMemo(() => {
    if (!profile || !opt) return [];
    return buildAlerts({ profile, opt, startHour, minute: clock.minute, tomorrow, lang });
  }, [profile, opt, startHour, clock.minute, tomorrow, lang]);

  const planActions = applied ? applied.actions : (opt?.actions ?? []);
  const planFacts = applied ? applied.facts : facts;
  const ai = useAiPlan(planFacts, lang, planActions.length > 0);

  const update = (p: Partial<Profile>) => {
    setApplied(null);
    setProfile((cur) => (cur ? { ...cur, ...p } : cur));
  };

  const applyPlan = () => {
    if (!profile || !opt) return;
    setApplied({ prev: { appliances: profile.appliances, gridCharging: profile.gridCharging }, actions: opt.actions, facts });
    setProfile({ ...profile, appliances: opt.appliances, gridCharging: opt.gridCharging });
  };

  const undoPlan = () => {
    if (!profile || !applied) return;
    setProfile({ ...profile, ...applied.prev });
    setApplied(null);
  };

  const reset = () => {
    setApplied(null);
    setProfile(demoProfile());
  };

  return {
    ready: Boolean(profile && opt),
    profile: profile!,
    opt: opt!,
    lang,
    setLang,
    clock,
    startHour,
    hours,
    weatherSource: weather?.source ?? "fallback",
    tomorrow,
    alerts,
    facts,
    applied,
    planActions,
    ai,
    floor: profile ? minSocPct(profile.batteryType) : 10,
    update,
    applyPlan,
    undoPlan,
    reset,
  };
}

export type SolarModel = ReturnType<typeof useSolarModel>;

/** Debounced Gemini coaching for the current facts. Falls back to deterministic text when offline. */
function useAiPlan(facts: Record<string, unknown>, lang: Lang, enabled: boolean) {
  const key = JSON.stringify({ facts, lang });
  const [plan, setPlan] = useState<{ key: string; plan: AiPlan } | null>(null);
  const [busy, setBusy] = useState(false);
  const [offline, setOffline] = useState(false);
  const req = useRef(0);

  useEffect(() => {
    if (!enabled || plan?.key === key) return;
    const id = ++req.current;
    const timer = setTimeout(async () => {
      setBusy(true);
      try {
        const r = await fetch("/api/plan", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ lang, facts }),
        });
        const j = await r.json();
        if (id !== req.current) return;
        if (!r.ok) {
          setOffline(true);
          return;
        }
        setOffline(false);
        setPlan({ key, plan: j });
      } catch {
        if (id === req.current) setOffline(true);
      } finally {
        if (id === req.current) setBusy(false);
      }
    }, 900);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, enabled]);

  return { plan: plan?.key === key ? plan.plan : null, busy, offline };
}

function buildFacts(p: Profile, base: SimResult, best: SimResult, actions: Action[], startHour: number, tomorrow: Tomorrow | null) {
  const at = (t: number | null) => (t === null ? null : fmtHour(startHour + t));
  const sum = (s: SimResult) => ({
    batteryRunsOutAt: at(s.runOutAt),
    powerReturnsAt: at(s.powerBackAt),
    timeWithoutPower: fmtDuration(s.darkMinutes),
    lowestBatteryPct: Math.round(s.minSoc),
    lowestAt: at(s.minSocAt),
    batteryAtEndOfTomorrowPct: Math.round(s.endSoc),
    unusedSolarKwh: +s.unusedSolarKwh.toFixed(1),
  });
  return {
    city: p.city,
    timeNow: fmtHour(startHour),
    batteryNowPct: Math.round(p.batteryPct),
    battery: `${p.batteryKwh} kWh ${p.batteryType} (safe floor ${minSocPct(p.batteryType)}%)`,
    solarPanelsKw: p.panelKw,
    inverterKw: p.inverterKw,
    gridChargingEnabled: p.gridCharging,
    dailyLoadSheddingWindows: p.outages.map(fmtWindow),
    tomorrowWeather: tomorrow && {
      expectedSolarKwh: +tomorrow.solarKwh.toFixed(1),
      daytimeCloudPct: Math.round(tomorrow.cloud),
      maxTempC: Math.round(tomorrow.maxTemp),
      solarDay: tomorrow.quality,
    },
    inverterOverload: base.overloadAt !== null ? `${base.peakOutageLoadKw.toFixed(1)} kW load at ${at(base.overloadAt)}` : null,
    withoutPlan: sum(base),
    withPlan: sum(best),
    actions: actions.map((a) => ({
      kind: a.kind,
      appliance: a.name,
      watts: Math.round(a.watts),
      from: a.from && fmtWindow(a.from),
      to: a.to && fmtWindow(a.to),
      backupGained: a.gainMinutes >= 1 ? fmtDuration(a.gainMinutes) : null,
      batterySavedKwh: +a.savedKwh.toFixed(2),
    })),
  };
}
