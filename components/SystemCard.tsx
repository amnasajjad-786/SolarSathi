"use client";

import { Button, Card, NumberField, Toggle } from "./ui";
import type { Lang, Profile } from "@/lib/types";
import { CITIES } from "@/lib/demo-data";

export function SystemCard({ profile, onChange, onReset, lang }: {
  profile: Profile;
  onChange: (p: Partial<Profile>) => void;
  onReset: () => void;
  lang: Lang;
}) {
  const ur = lang === "ur";
  return (
    <Card icon="⚙️" title={ur ? "Mera solar system" : "My solar system"}>
      <div className="grid grid-cols-2 gap-3">
        <label className="col-span-2 block text-sm">
          <span className="mb-1 block text-stone-500">{ur ? "Shehar" : "City"}</span>
          <select
            value={profile.city}
            onChange={(e) => onChange({ city: e.target.value, ...CITIES[e.target.value] })}
            className="w-full rounded-xl border border-stone-200 bg-white px-3 py-2 outline-none focus:border-amber-400"
          >
            {Object.keys(CITIES).map((c) => (
              <option key={c}>{c}</option>
            ))}
          </select>
        </label>
        <NumberField label={ur ? "Panels" : "Solar panels"} value={profile.panelKw} step={0.5} suffix="kW" onChange={(v) => onChange({ panelKw: v })} />
        <NumberField label="Inverter" value={profile.inverterKw} step={0.5} suffix="kW" onChange={(v) => onChange({ inverterKw: v })} />
        <NumberField label={ur ? "Battery" : "Battery size"} value={profile.batteryKwh} step={0.1} suffix="kWh" onChange={(v) => onChange({ batteryKwh: v })} />
        <label className="block text-sm">
          <span className="mb-1 block text-stone-500">{ur ? "Battery type" : "Battery type"}</span>
          <select
            value={profile.batteryType}
            onChange={(e) => onChange({ batteryType: e.target.value as Profile["batteryType"] })}
            className="w-full rounded-xl border border-stone-200 bg-white px-3 py-2 outline-none focus:border-amber-400"
          >
            <option value="lithium">Lithium (LiFePO4)</option>
            <option value="lead-acid">Lead-acid / tubular</option>
          </select>
        </label>
      </div>
      <p className="mt-2 text-xs text-stone-500">
        {ur
          ? "Tip: 12V 200Ah tubular = 2.4 kWh, 48V 100Ah lithium = 4.8–5.1 kWh."
          : "Tip: 12V 200Ah tubular ≈ 2.4 kWh · 48V/51.2V 100Ah lithium ≈ 4.8–5.1 kWh."}
      </p>
      <div className="mt-3 flex items-center justify-between gap-3 rounded-xl bg-stone-50 p-3">
        <div className="text-sm">
          <div className="font-medium text-stone-700">{ur ? "WAPDA se battery charging" : "Charge battery from grid"}</div>
          <div className="text-xs text-stone-500">{ur ? "Inverter setting (SUB / utility charge)" : "Inverter setting (SUB / utility charge)"}</div>
        </div>
        <Toggle checked={profile.gridCharging} onChange={(v) => onChange({ gridCharging: v })} label="Grid charging" />
      </div>
      <div className="mt-3 text-right">
        <Button variant="ghost" onClick={onReset}>
          {ur ? "Demo ghar load karein" : "Reset to demo home"}
        </Button>
      </div>
    </Card>
  );
}

export interface Tomorrow {
  date: string;
  solarKwh: number;
  cloud: number;
  maxTemp: number;
  quality: "good" | "fair" | "poor";
}

export function ForecastCard({ t, city, source, lang }: { t: Tomorrow | null; city: string; source: string; lang: Lang }) {
  const ur = lang === "ur";
  if (!t) return null;
  const q = {
    good: { icon: "☀️", en: "Good solar day", ur: "Achi dhoop", tone: "text-emerald-700 bg-emerald-50" },
    fair: { icon: "⛅", en: "Partly cloudy", ur: "Kuch badal", tone: "text-amber-800 bg-amber-50" },
    poor: { icon: "☁️", en: "Poor solar day — save battery tonight", ur: "Badal — aaj raat battery bachayein", tone: "text-red-700 bg-red-50" },
  }[t.quality];
  return (
    <Card icon="🌤️" title={ur ? `Kal ka mausam · ${city}` : `Tomorrow in ${city}`}>
      <div className={`mb-3 rounded-xl px-3 py-2 text-sm font-medium ${q.tone}`}>
        {q.icon} {ur ? q.ur : q.en}
      </div>
      <div className="grid grid-cols-3 gap-2 text-center">
        <Stat label={ur ? "Solar" : "Solar"} value={`${t.solarKwh.toFixed(1)}`} unit="kWh" />
        <Stat label={ur ? "Badal" : "Clouds"} value={`${Math.round(t.cloud)}`} unit="%" />
        <Stat label={ur ? "Garmi" : "Max temp"} value={`${Math.round(t.maxTemp)}`} unit="°C" />
      </div>
      <p className="mt-2 text-xs text-stone-400">{source === "open-meteo" ? "Forecast: Open-Meteo" : ur ? "Offline andaza (saaf aasman)" : "Offline estimate (clear sky)"}</p>
    </Card>
  );
}

function Stat({ label, value, unit }: { label: string; value: string; unit: string }) {
  return (
    <div className="rounded-xl bg-stone-50 py-2">
      <div className="text-lg font-semibold text-stone-800">
        {value}
        <span className="ml-0.5 text-xs font-normal text-stone-500">{unit}</span>
      </div>
      <div className="text-xs text-stone-500">{label}</div>
    </div>
  );
}
