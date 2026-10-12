"use client";

import {
  Area,
  ComposedChart,
  Line,
  ReferenceArea,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { SimResult } from "@/lib/simulate";
import { fmtHour } from "@/lib/time";

export function BatteryChart({ now, plan, startHour, floorPct, lang }: {
  now: SimResult;
  plan: SimResult | null;
  startHour: number;
  floorPct: number;
  lang: "en" | "ur";
}) {
  const data = now.steps.map((s, i) => ({
    t: s.t,
    now: round(s.soc),
    plan: plan ? round(plan.steps[i]?.soc ?? 0) : undefined,
    solar: round(s.solarKw, 2),
  }));

  // Contiguous outage spans for shading.
  const spans: { a: number; b: number }[] = [];
  for (const s of now.steps) {
    const last = spans[spans.length - 1];
    if (!s.grid) {
      if (last && Math.abs(last.b - s.t) < 1e-6) last.b = s.t + 0.25;
      else spans.push({ a: s.t, b: s.t + 0.25 });
    }
  }
  const maxSolar = Math.max(1, ...data.map((d) => d.solar));
  const ticks: number[] = [];
  for (let t = (3 - (startHour % 3)) % 3; t <= now.horizonH; t += 3) ticks.push(t);

  const L = lang === "ur"
    ? { now: "Abhi ki usage", plan: "AI plan ke saath", solar: "Solar (kW)", out: "Load-shedding" }
    : { now: "Current usage", plan: "With AI plan", solar: "Solar (kW)", out: "Load-shedding" };

  return (
    <div>
      <div className="mb-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-stone-500">
        <Legend color="#ef4444" label={L.now} />
        {plan && <Legend color="#10b981" label={L.plan} />}
        <Legend color="#fcd34d" label={L.solar} square />
        <Legend color="#cbd5e1" label={L.out} square />
      </div>
      <div className="h-60 w-full sm:h-72">
        <ResponsiveContainer>
          <ComposedChart data={data} margin={{ top: 6, right: 4, bottom: 0, left: -18 }}>
            {spans.map((s, i) => (
              <ReferenceArea key={i} x1={s.a} x2={s.b} yAxisId="soc" fill="#94a3b8" fillOpacity={0.22} strokeOpacity={0} />
            ))}
            <XAxis
              dataKey="t"
              type="number"
              domain={[0, now.horizonH]}
              ticks={ticks}
              tickFormatter={(t: number) => fmtHour(startHour + t).replace(":00", "")}
              tick={{ fontSize: 11, fill: "#78716c" }}
              axisLine={false}
              tickLine={false}
            />
            <YAxis yAxisId="soc" domain={[0, 100]} ticks={[0, 25, 50, 75, 100]} unit="%" tick={{ fontSize: 11, fill: "#78716c" }} axisLine={false} tickLine={false} />
            <YAxis yAxisId="kw" orientation="right" domain={[0, maxSolar * 1.6]} hide />
            <ReferenceLine yAxisId="soc" y={floorPct} stroke="#a8a29e" strokeDasharray="4 4" />
            <Area yAxisId="kw" dataKey="solar" type="monotone" stroke="#f59e0b" strokeWidth={1} fill="#fcd34d" fillOpacity={0.45} isAnimationActive={false} />
            <Line yAxisId="soc" dataKey="now" type="monotone" stroke="#ef4444" strokeWidth={2.5} dot={false} isAnimationActive={false} />
            {plan && <Line yAxisId="soc" dataKey="plan" type="monotone" stroke="#10b981" strokeWidth={2.5} dot={false} isAnimationActive={false} />}
            <Tooltip
              labelFormatter={(t) => fmtHour(startHour + Number(t))}
              formatter={(v, name) => (name === "solar" ? [`${v} kW`, L.solar] : [`${v}%`, name === "now" ? L.now : L.plan])}
              contentStyle={{ borderRadius: 12, border: "1px solid #e7e5e4", fontSize: 12 }}
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

function Legend({ color, label, square }: { color: string; label: string; square?: boolean }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className={square ? "h-2.5 w-2.5 rounded-sm" : "h-0.5 w-4 rounded"} style={{ background: color }} />
      {label}
    </span>
  );
}

function round(n: number, d = 1) {
  const f = 10 ** d;
  return Math.round(n * f) / f;
}
