"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ReferenceArea,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { SimResult } from "@/lib/simulate";
import type { HourWeather, Lang } from "@/lib/types";
import { fmtHour } from "@/lib/time";

// Categorical slots from the validated reference palette (blue, orange).
const PLAN = "#2a78d6";
const NOW = "#eb6834";
const OUTAGE = "#94a3b8";
const SOLAR = "#eda100";
const AXIS = { fontSize: 11, fill: "#64748b" };

function hourTicks(startHour: number, horizon: number) {
  const ticks: number[] = [];
  for (let t = (3 - (startHour % 3)) % 3; t <= horizon; t += 3) ticks.push(t);
  return ticks;
}
const tickLabel = (startHour: number) => (t: number) => fmtHour(startHour + t).replace(":00", "");

/** Battery state of charge over time: current usage vs AI plan, outages shaded. */
export function BatteryChart({ now, plan, startHour, floorPct, lang, height = 260 }: {
  now: SimResult;
  plan: SimResult | null;
  startHour: number;
  floorPct: number;
  lang: Lang;
  height?: number;
}) {
  const ur = lang === "ur";
  const data = now.steps.map((s, i) => ({
    t: s.t,
    now: round(s.soc),
    plan: plan ? round(plan.steps[i]?.soc ?? 0) : undefined,
  }));
  const spans: { a: number; b: number }[] = [];
  for (const s of now.steps) {
    const last = spans[spans.length - 1];
    if (!s.grid) {
      if (last && Math.abs(last.b - s.t) < 1e-6) last.b = s.t + 0.25;
      else spans.push({ a: s.t, b: s.t + 0.25 });
    }
  }
  const L = ur
    ? { now: "Abhi ki usage", plan: "AI plan ke saath", out: "Load-shedding", floor: "Safe hadd" }
    : { now: "Current usage", plan: "With AI plan", out: "Load-shedding", floor: "Safe floor" };

  return (
    <div>
      <div className="mb-3 flex flex-wrap gap-x-5 gap-y-1 text-[13px] text-slate-600">
        <LegendItem color={NOW} label={L.now} />
        {plan && <LegendItem color={PLAN} label={L.plan} />}
        <LegendItem color={OUTAGE} label={L.out} square />
        <LegendItem color="#94a3b8" label={`${L.floor} (${floorPct}%)`} dashed />
      </div>
      <div style={{ height }} className="w-full">
        <ResponsiveContainer>
          <LineChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: -16 }}>
            <CartesianGrid vertical={false} stroke="#eef2f6" />
            {spans.map((s, i) => (
              <ReferenceArea key={i} x1={s.a} x2={s.b} fill={OUTAGE} fillOpacity={0.16} strokeOpacity={0} />
            ))}
            <XAxis dataKey="t" type="number" domain={[0, now.horizonH]} ticks={hourTicks(startHour, now.horizonH)} tickFormatter={tickLabel(startHour)} tick={AXIS} axisLine={false} tickLine={false} />
            <YAxis domain={[0, 100]} ticks={[0, 25, 50, 75, 100]} tickFormatter={(v) => `${v}%`} tick={AXIS} axisLine={false} tickLine={false} />
            <ReferenceLine y={floorPct} stroke="#94a3b8" strokeDasharray="4 4" />
            <Line dataKey="now" name="now" type="monotone" stroke={NOW} strokeWidth={2} dot={false} activeDot={{ r: 4, strokeWidth: 2, stroke: "#fff" }} isAnimationActive={false} />
            {plan && <Line dataKey="plan" name="plan" type="monotone" stroke={PLAN} strokeWidth={2} dot={false} activeDot={{ r: 4, strokeWidth: 2, stroke: "#fff" }} isAnimationActive={false} />}
            <Tooltip
              cursor={{ stroke: "#cbd5e1" }}
              labelFormatter={(t) => fmtHour(startHour + Number(t))}
              formatter={(v, name) => [`${v}%`, name === "now" ? L.now : L.plan]}
              contentStyle={{ borderRadius: 12, border: "1px solid #e2e8f0", fontSize: 12, color: "#0f172a" }}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

/** Expected solar output per hour (single series, its own axis). */
export function SolarChart({ hours, panelKw, startHour, lang, height = 180 }: {
  hours: HourWeather[];
  panelKw: number;
  startHour: number;
  lang: Lang;
  height?: number;
}) {
  const data = hours.map((h, i) => ({ t: i + 0.5, kw: round((panelKw * h.radiation * 0.75) / 1000, 2), cloud: Math.round(h.cloud), temp: Math.round(h.temp) }));
  return (
    <div style={{ height }} className="w-full">
      <ResponsiveContainer>
        <BarChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: -16 }} barCategoryGap={2}>
          <CartesianGrid vertical={false} stroke="#eef2f6" />
          <XAxis dataKey="t" type="number" domain={[0, hours.length]} ticks={hourTicks(startHour, hours.length)} tickFormatter={tickLabel(startHour)} tick={AXIS} axisLine={false} tickLine={false} />
          <YAxis tickFormatter={(v) => `${v}`} unit=" kW" tick={AXIS} axisLine={false} tickLine={false} width={64} />
          <Bar dataKey="kw" fill={SOLAR} radius={[4, 4, 0, 0]} isAnimationActive={false} />
          <Tooltip
            cursor={{ fill: "#f1f5f9" }}
            labelFormatter={(t) => fmtHour(startHour + Number(t) - 0.5)}
            formatter={(v, _n, item) => {
              const p = (item as { payload?: { cloud: number; temp: number } }).payload;
              return [`${v} kW · ☁ ${p?.cloud}% · ${p?.temp}°C`, lang === "ur" ? "Solar" : "Solar"];
            }}
            contentStyle={{ borderRadius: 12, border: "1px solid #e2e8f0", fontSize: 12, color: "#0f172a" }}
          />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

function LegendItem({ color, label, square, dashed }: { color: string; label: string; square?: boolean; dashed?: boolean }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      {square ? (
        <span className="h-3 w-3 rounded-sm" style={{ background: color, opacity: 0.35 }} />
      ) : dashed ? (
        <span className="w-4 border-t-2 border-dashed" style={{ borderColor: color }} />
      ) : (
        <span className="h-0.5 w-4 rounded" style={{ background: color }} />
      )}
      {label}
    </span>
  );
}

function round(n: number, d = 1) {
  const f = 10 ** d;
  return Math.round(n * f) / f;
}
