"use client";

import { useEffect, useMemo, useState } from "react";
import { BatteryChart } from "@/components/BatteryChart";
import { ScreenshotUpload } from "@/components/ScreenshotUpload";
import { OutageCard } from "@/components/OutageCard";
import { ApplianceList } from "@/components/ApplianceList";
import { PlanCard } from "@/components/PlanCard";
import { ForecastCard, SystemCard, type Tomorrow } from "@/components/SystemCard";
import { Card } from "@/components/ui";
import { optimize, type Action } from "@/lib/optimize";
import { minSocPct, type SimResult } from "@/lib/simulate";
import { verdict } from "@/lib/plan-text";
import { demoProfile, fallbackWeather } from "@/lib/demo-data";
import { fmtDuration, fmtHour, fmtWindow, nowInPakistan } from "@/lib/time";
import type { Appliance, HourWeather, Lang, Profile } from "@/lib/types";

const STORE = "solarsaathi.profile.v1";
const LANG_STORE = "solarsaathi.lang";

interface Applied {
  prev: { appliances: Appliance[]; gridCharging: boolean };
  actions: Action[];
  facts: Record<string, unknown>;
}

export default function Home() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [lang, setLang] = useState<Lang>("en");
  const [weather, setWeather] = useState<{ source: string; hours: HourWeather[] } | null>(null);
  const [clock, setClock] = useState(() => nowInPakistan());
  const [applied, setApplied] = useState<Applied | null>(null);

  // Load saved profile (client only).
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

  const radiation = useMemo(() => {
    const key = `${clock.date}T${String(startHour).padStart(2, "0")}:00`;
    const hrs = weather?.hours ?? [];
    const i = hrs.findIndex((h) => h.time === key);
    const src = i >= 0 && hrs.length - i >= horizon ? hrs.slice(i, i + horizon) : fallbackWeather(clock.date, startHour, horizon);
    return src;
  }, [weather, clock.date, startHour, horizon]);

  const tomorrow: Tomorrow | null = useMemo(() => {
    if (!profile) return null;
    const date = radiation.find((h) => h.time.slice(0, 10) > clock.date)?.time.slice(0, 10);
    const day = radiation.filter((h) => h.time.startsWith(date ?? "x"));
    if (!day.length) return null;
    const sunHours = day.filter((h) => {
      const hr = Number(h.time.slice(11, 13));
      return hr >= 8 && hr <= 16;
    });
    const radSum = day.reduce((s, h) => s + h.radiation, 0);
    const ratio = radSum / 5700; // ≈ clear-sky daily Wh/m² for Pakistan in this season
    return {
      date: date!,
      solarKwh: (profile.panelKw * radSum * 0.75) / 1000,
      cloud: sunHours.reduce((s, h) => s + h.cloud, 0) / Math.max(1, sunHours.length),
      maxTemp: Math.max(...day.map((h) => h.temp)),
      quality: ratio >= 0.8 ? "good" : ratio >= 0.5 ? "fair" : "poor",
    };
  }, [radiation, clock.date, profile]);

  const opt = useMemo(() => {
    if (!profile) return null;
    return optimize({
      profile,
      batteryPct: profile.batteryPct,
      startHour,
      radiation: radiation.map((h) => h.radiation),
      appliances: profile.appliances,
      outages: profile.outages,
    });
  }, [profile, startHour, radiation]);

  const facts = useMemo(() => {
    if (!profile || !opt) return {};
    return buildFacts(profile, opt.base, opt.best, opt.actions, startHour, clock.minute, tomorrow);
  }, [profile, opt, startHour, clock.minute, tomorrow]);

  if (!profile || !opt) {
    return <div className="flex min-h-screen items-center justify-center text-stone-400">Loading…</div>;
  }

  const set = (p: Partial<Profile>) => {
    setApplied(null);
    setProfile((cur) => ({ ...cur!, ...p }));
  };
  const ur = lang === "ur";
  const vNow = verdict(opt.base, startHour, lang);
  const vPlan = opt.actions.length ? verdict(opt.best, startHour, lang) : null;
  const floor = minSocPct(profile.batteryType);

  return (
    <main className="mx-auto max-w-6xl px-4 pt-4 pb-16 sm:px-6">
      <header className="mb-5 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-amber-400 text-xl shadow-sm">☀️</div>
          <div>
            <h1 className="text-lg leading-tight font-bold text-stone-900">SolarSaathi</h1>
            <p className="text-xs text-stone-500">
              {profile.city} · {fmtHour(startHour + clock.minute / 60)} PKT
            </p>
          </div>
        </div>
        <div className="flex shrink-0 rounded-xl bg-stone-100 p-1 text-xs sm:text-sm" role="group" aria-label="Language">
          {(["en", "ur"] as const).map((l) => (
            <button
              key={l}
              onClick={() => setLang(l)}
              className={`rounded-lg px-3 py-1 font-medium ${lang === l ? "bg-white text-stone-900 shadow-sm" : "text-stone-500"}`}
            >
              {l === "en" ? "English" : "Roman Urdu"}
            </button>
          ))}
        </div>
      </header>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1.35fr_1fr]">
        <div className="min-w-0 space-y-4">
          {/* Verdict */}
          <section
            className={`rounded-2xl p-5 shadow-sm ${vNow.ok ? "bg-emerald-600 text-white" : "bg-stone-900 text-white"}`}
            aria-live="polite"
          >
            <p className="text-xs font-medium tracking-wide uppercase opacity-70">
              {ur ? "Aaj raat aur kal" : "Tonight & tomorrow"} · 🔋 {Math.round(profile.batteryPct)}%
            </p>
            <h2 className="mt-1 text-2xl leading-tight font-bold sm:text-3xl">{vNow.title}</h2>
            <p className="mt-1 text-sm opacity-85">{vNow.detail}</p>
            {vPlan && !applied && (
              <div className="mt-4 rounded-xl bg-white/10 p-3 text-sm">
                <span className="font-semibold text-emerald-300">{ur ? "AI plan ke saath: " : "With the AI plan: "}</span>
                {vPlan.title.replace(" ✅", "")} — {vPlan.detail}
              </div>
            )}
            {opt.base.overloadAt !== null && (
              <p className="mt-3 rounded-xl bg-red-500/20 p-2 text-sm">
                ⚠️ {ur ? "Overload" : "Overload"}: {(opt.base.peakOutageLoadKw).toFixed(1)} kW &gt; {profile.inverterKw} kW inverter at {fmtHour(startHour + opt.base.overloadAt)}
              </p>
            )}
          </section>

          <Card icon="📈" title={ur ? "Battery ka andaza (agle 24–48 ghante)" : "Battery forecast (now → end of tomorrow)"}>
            <BatteryChart now={opt.base} plan={opt.actions.length ? opt.best : null} startHour={startHour} floorPct={floor} lang={lang} />
            <p className="mt-2 text-xs text-stone-400">
              {ur ? `Dotted line = ${floor}% (battery ki safe hadd)` : `Dotted line = ${floor}% safe floor for ${profile.batteryType} batteries`}
            </p>
          </Card>

          <PlanCard
            actions={applied ? applied.actions : opt.actions}
            facts={applied ? applied.facts : facts}
            lang={lang}
            applied={Boolean(applied)}
            onApply={() => {
              const snap: Applied = {
                prev: { appliances: profile.appliances, gridCharging: profile.gridCharging },
                actions: opt.actions,
                facts,
              };
              setProfile({ ...profile, appliances: opt.appliances, gridCharging: opt.gridCharging });
              setApplied(snap);
            }}
            onUndo={() => {
              if (!applied) return;
              setProfile({ ...profile, ...applied.prev });
              setApplied(null);
            }}
          />
        </div>

        <div className="min-w-0 space-y-4">
          <Card icon="🔋" title={ur ? "Abhi battery kitni hai?" : "Battery right now"}>
            <div className="mb-3 flex items-center gap-3">
              <input
                type="range"
                min={0}
                max={100}
                value={profile.batteryPct}
                onChange={(e) => set({ batteryPct: Number(e.target.value) })}
                className="flex-1 accent-amber-500"
                aria-label="Battery percent"
              />
              <span className="w-14 text-right text-xl font-bold text-stone-800">{Math.round(profile.batteryPct)}%</span>
            </div>
            <ScreenshotUpload
              lang={lang}
              onReading={(r) => {
                const patch: Partial<Profile> = {};
                if (r.batteryPct !== null) patch.batteryPct = Math.max(0, Math.min(100, r.batteryPct));
                if (r.batteryCapacityKwh && r.batteryCapacityKwh > 0.5) patch.batteryKwh = Math.round(r.batteryCapacityKwh * 10) / 10;
                set(patch);
              }}
            />
          </Card>

          <OutageCard outages={profile.outages} onChange={(outages) => set({ outages })} lang={lang} />

          <ForecastCard t={tomorrow} city={profile.city} source={weather?.source ?? "fallback"} lang={lang} />

          <ApplianceList appliances={profile.appliances} onChange={(appliances) => set({ appliances })} lang={lang} />

          <SystemCard
            profile={profile}
            onChange={set}
            onReset={() => {
              setApplied(null);
              setProfile(demoProfile());
            }}
            lang={lang}
          />
        </div>
      </div>

      <footer className="mt-10 text-center text-xs text-stone-400">
        SolarSaathi · Apni bijli, apna plan · Qubit Dynamics
      </footer>
    </main>
  );
}

function buildFacts(
  p: Profile,
  base: SimResult,
  best: SimResult,
  actions: Action[],
  startHour: number,
  minute: number,
  tomorrow: Tomorrow | null,
) {
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
    timeNow: fmtHour(startHour + minute / 60),
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
