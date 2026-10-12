"use client";

import type { ReactNode } from "react";
import type { SolarModel } from "@/lib/useSolarModel";
import type { View } from "@/lib/alerts";
import { backupHours, nextOutage } from "@/lib/alerts";
import { actionText, verdict } from "@/lib/plan-text";
import type { Action } from "@/lib/optimize";
import type { Profile } from "@/lib/types";
import { fmtDuration, fmtHour } from "@/lib/time";
import { Badge, Button, Card, Spinner, StatTile } from "./ui";
import { AlertList } from "./AlertList";
import { BatteryChart, SolarChart } from "./BatteryChart";
import { ScreenshotUpload } from "./ScreenshotUpload";
import { WhatsAppCard } from "./WhatsAppAlerts";
import { OutageTimeline } from "./OutageTimeline";
import { ApplianceAiAdd, ApplianceEditor, OutageEditor, SystemForm } from "./editors";
import { IconBattery, IconChevron, IconClock, IconPlugOff, IconSparkles, IconSun } from "./icons";
import type { ScreenReading } from "@/app/api/read-screen/route";

type Props = { m: SolarModel; go: (v: View) => void };

export function PageHeader({ title, subtitle, right }: { title: string; subtitle: string; right?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-slate-900">{title}</h1>
        <p className="mt-1 text-sm text-slate-500">{subtitle}</p>
      </div>
      {right}
    </div>
  );
}

function applyReading(m: SolarModel) {
  return (r: ScreenReading) => {
    const patch: Partial<Profile> = {};
    if (r.batteryPct !== null) patch.batteryPct = Math.max(0, Math.min(100, r.batteryPct));
    if (r.batteryCapacityKwh && r.batteryCapacityKwh > 0.5) patch.batteryKwh = Math.round(r.batteryCapacityKwh * 10) / 10;
    m.update(patch);
  };
}

/* ======================= Dashboard ======================= */

export function DashboardView({ m, go }: Props) {
  const { profile: p, opt, lang, startHour, clock } = m;
  const ur = lang === "ur";
  const nowHod = startHour + clock.minute / 60;
  const v = verdict(opt.base, startHour, lang);
  const vPlan = opt.actions.length ? verdict(opt.best, startHour, lang) : null;
  const nx = nextOutage(opt.base, startHour, clock.minute);
  const bk = backupHours(p, nowHod);

  return (
    <>
      <PageHeader
        title={ur ? "Dashboard" : "Dashboard"}
        subtitle={`${p.city} · ${fmtHour(nowHod)} PKT · ${ur ? "Aaj raat aur kal ka andaza" : "Forecast for tonight and tomorrow"}`}
      />

      {/* Status banner */}
      <section className={`mb-6 overflow-hidden rounded-2xl ${v.ok ? "bg-emerald-600" : "bg-slate-900"} text-white`} aria-live="polite">
        <div className="flex flex-col gap-5 p-6 md:flex-row md:items-center md:justify-between">
          <div className="min-w-0">
            <p className="text-xs font-semibold tracking-wider text-white/60 uppercase">{ur ? "Battery ka faisla" : "Battery verdict"}</p>
            <h2 className="mt-1 text-2xl font-semibold sm:text-3xl">{v.title}</h2>
            <p className="mt-1 text-sm text-white/75">{v.detail}</p>
            {vPlan && !m.applied && (
              <p className="mt-3 inline-flex items-center gap-2 rounded-lg bg-white/10 px-3 py-1.5 text-sm">
                <IconSparkles size={15} className="text-amber-300" />
                <span>
                  <b className="font-semibold">{ur ? "AI plan ke saath:" : "With the AI plan:"}</b> {vPlan.title.replace(/ [✅⚠️]+$/u, "")}
                </span>
              </p>
            )}
          </div>
          <div className="flex shrink-0 flex-wrap gap-2">
            {opt.actions.length > 0 && !m.applied && (
              <Button onClick={m.applyPlan}>{ur ? "Plan apply karein" : "Apply AI plan"}</Button>
            )}
            <Button variant="secondary" onClick={() => go("plan")} className="border-white/20 bg-white/10 text-white hover:bg-white/20">
              {ur ? "Plan dekhein" : "View plan"} <IconChevron size={16} />
            </Button>
          </div>
        </div>
      </section>

      {/* KPIs */}
      <div className="mb-6 grid grid-cols-2 gap-4 xl:grid-cols-4">
        <StatTile
          label={ur ? "Battery abhi" : "Battery now"}
          value={Math.round(p.batteryPct)}
          unit="%"
          icon={<IconBattery size={17} />}
          tone={p.batteryPct < 30 ? "red" : p.batteryPct < 60 ? "amber" : "green"}
          hint={`${((p.batteryPct / 100) * p.batteryKwh).toFixed(1)} / ${p.batteryKwh} kWh`}
        />
        <StatTile
          label={ur ? "Agli load-shedding" : "Next load-shedding"}
          value={!nx ? "—" : nx.active ? (ur ? "Abhi" : "Now") : fmtDuration(nx.startsIn * 60)}
          icon={<IconPlugOff size={17} />}
          tone={nx && (nx.active || nx.startsIn < 2) ? "red" : "slate"}
          hint={nx ? `${fmtHour(nx.start)} – ${fmtHour(nx.end)}` : ur ? "Schedule add karein" : "No schedule added"}
        />
        <StatTile
          label={ur ? "Backup (abhi ke load par)" : "Backup at current load"}
          value={Number.isFinite(bk.hours) ? fmtDuration(bk.hours * 60) : "∞"}
          icon={<IconClock size={17} />}
          tone={bk.hours < 2 ? "red" : bk.hours < 4 ? "amber" : "green"}
          hint={`${(bk.loadKw * 1000).toFixed(0)} W ${ur ? "load" : "running now"}`}
        />
        <StatTile
          label={ur ? "Kal ka solar" : "Tomorrow's solar"}
          value={m.tomorrow ? m.tomorrow.solarKwh.toFixed(1) : "—"}
          unit="kWh"
          icon={<IconSun size={17} />}
          tone={m.tomorrow?.quality === "poor" ? "red" : m.tomorrow?.quality === "fair" ? "amber" : "green"}
          hint={m.tomorrow ? `${qualityLabel(m.tomorrow.quality, ur)} · ${Math.round(m.tomorrow.maxTemp)}°C` : ""}
        />
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
        <div className="min-w-0 space-y-6">
          <Card
            title={ur ? "Alerts" : "Alerts"}
            subtitle={ur ? "Sab se zaroori pehle" : "Most urgent first"}
            action={<Badge tone={m.alerts.some((a) => a.level === "critical") ? "red" : "slate"}>{m.alerts.length}</Badge>}
          >
            <AlertList alerts={m.alerts} lang={lang} onNavigate={go} />
          </Card>
          <Card
            title={ur ? "WhatsApp alerts" : "WhatsApp alerts"}
            subtitle={ur ? "Battery khatre mein ho to WhatsApp par message" : "Get a WhatsApp message when your battery is at risk"}
            action={p.whatsapp?.auto ? <Badge tone="green">{ur ? "On" : "Active"}</Badge> : <Badge>{ur ? "Off" : "Off"}</Badge>}
          >
            <WhatsAppCard profile={p} onChange={m.update} alerts={m.alerts} lang={lang} />
          </Card>
          <Card title={ur ? "Battery ka andaza" : "Battery forecast"} subtitle={ur ? "Abhi se kal raat tak" : "Now until the end of tomorrow"}>
            <BatteryChart now={opt.base} plan={opt.actions.length ? opt.best : null} startHour={startHour} floorPct={m.floor} lang={lang} />
          </Card>
        </div>

        <div className="min-w-0 space-y-6">
          <Card title={ur ? "Screenshot se battery update" : "Update from inverter screenshot"} subtitle={ur ? "AI aap ki inverter app parhta hai" : "AI reads your inverter app for you"}>
            <ScreenshotUpload lang={lang} compact onReading={applyReading(m)} />
          </Card>
          <Card
            title={ur ? "Aaj ki load-shedding" : "Today's load-shedding"}
            action={
              <Button variant="ghost" size="sm" onClick={() => go("outages")}>
                {ur ? "Edit" : "Edit"} <IconChevron size={15} />
              </Button>
            }
          >
            <div className="pt-4">
              <OutageTimeline outages={p.outages} nowHour={nowHod} lang={lang} />
            </div>
          </Card>
          <Card
            title={ur ? "AI plan — pehle qadam" : "AI plan — top steps"}
            action={
              m.ai.busy ? (
                <Badge tone="amber">
                  <Spinner /> {ur ? "soch raha" : "thinking"}
                </Badge>
              ) : m.ai.plan ? (
                <Badge tone="green">Gemini</Badge>
              ) : null
            }
          >
            <PlanSteps m={m} limit={3} />
            {m.planActions.length > 3 && (
              <Button variant="ghost" size="sm" className="mt-3" onClick={() => go("plan")}>
                {ur ? `Tamam ${m.planActions.length} qadam` : `All ${m.planActions.length} steps`} <IconChevron size={15} />
              </Button>
            )}
          </Card>
        </div>
      </div>
    </>
  );
}

function qualityLabel(q: "good" | "fair" | "poor", ur: boolean) {
  return { good: ur ? "Achi dhoop" : "Sunny", fair: ur ? "Kuch badal" : "Partly cloudy", poor: ur ? "Badal" : "Cloudy" }[q];
}

/* ======================= Plan steps (shared) ======================= */

const KIND: Record<Action["kind"], { en: string; ur: string; tone: "amber" | "blue" | "red" | "slate" }> = {
  shift: { en: "Move", ur: "Waqt badlein", tone: "amber" },
  reduce: { en: "Eco", ur: "Eco", tone: "blue" },
  cut: { en: "Switch off", ur: "Band", tone: "red" },
  setting: { en: "Setting", ur: "Setting", tone: "slate" },
};

function PlanSteps({ m, limit }: { m: SolarModel; limit?: number }) {
  const { lang, planActions: actions } = m;
  const ur = lang === "ur";
  if (actions.length === 0) {
    return <p className="text-sm text-slate-600">{ur ? "Sab theek hai — aaj raat koi tabdeeli zaroori nahi." : "You're in good shape — no changes needed tonight."}</p>;
  }
  const ai = m.ai.plan?.steps?.length === actions.length ? m.ai.plan.steps : null;
  const steps = actions.map((a, i) => ({ a, ...(ai ? ai[i] : { ...actionText(a, lang), impact: "" }) }));
  const shown = limit ? steps.slice(0, limit) : steps;
  return (
    <ol className="space-y-3">
      {shown.map(({ a, title, detail, impact }, i) => (
        <li key={i} className="flex gap-3">
          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-slate-900 text-xs font-semibold text-white">{i + 1}</span>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-sm font-semibold text-slate-900">{title}</span>
              <Badge tone={KIND[a.kind].tone}>{KIND[a.kind][lang]}</Badge>
            </div>
            <p className="mt-0.5 text-[13px] leading-relaxed text-slate-600">{detail}</p>
            {(impact || a.gainMinutes >= 1) && (
              <p className="mt-1 text-xs font-semibold text-emerald-700">{impact || `+${fmtDuration(a.gainMinutes)} backup`}</p>
            )}
          </div>
        </li>
      ))}
    </ol>
  );
}

/* ======================= Battery & Inverter ======================= */

export function BatteryView({ m }: Props) {
  const { profile: p, lang } = m;
  const ur = lang === "ur";
  return (
    <>
      <PageHeader
        title={ur ? "Battery aur Inverter" : "Battery & Inverter"}
        subtitle={ur ? "Screenshot upload karein ya battery % khud set karein" : "Upload a screenshot of your inverter app, or set the battery % yourself"}
      />
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
        <div className="min-w-0 space-y-6">
          <Card title={ur ? "Inverter screenshot upload" : "Upload inverter screenshot"} subtitle={ur ? "Gemini vision battery %, solar, load aur grid parhta hai" : "Gemini vision reads battery %, solar, load and grid status"}>
            <ScreenshotUpload lang={lang} onReading={applyReading(m)} />
            <ol className="mt-5 grid gap-3 text-[13px] text-slate-600 sm:grid-cols-3">
              {(ur
                ? ["Apni inverter app kholein", "Screenshot lein (ya screen ki photo)", "Yahan upload karein — bas!"]
                : ["Open your inverter app", "Take a screenshot (or photo of the LCD)", "Upload it here — that's it"]
              ).map((s, i) => (
                <li key={i} className="flex items-center gap-2 rounded-xl bg-slate-50 p-3">
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-amber-100 text-xs font-semibold text-amber-800">{i + 1}</span>
                  {s}
                </li>
              ))}
            </ol>
          </Card>
          <Card title={ur ? "Ya battery % khud set karein" : "Or set battery % manually"}>
            <div className="flex items-center gap-4">
              <input
                type="range"
                min={0}
                max={100}
                value={p.batteryPct}
                onChange={(e) => m.update({ batteryPct: Number(e.target.value) })}
                className="flex-1 accent-amber-500"
                aria-label="Battery percent"
              />
              <span className="w-16 text-right text-2xl font-semibold text-slate-900 tabular-nums">{Math.round(p.batteryPct)}%</span>
            </div>
          </Card>
        </div>
        <Card title={ur ? "Mera solar system" : "My solar system"} subtitle={ur ? "Ek dafa set karein" : "Set once — saved on this device"}>
          <SystemForm profile={p} onChange={m.update} onReset={m.reset} lang={lang} />
        </Card>
      </div>
    </>
  );
}

/* ======================= Load-shedding ======================= */

export function OutagesView({ m }: Props) {
  const { profile: p, lang, startHour, clock } = m;
  const ur = lang === "ur";
  return (
    <>
      <PageHeader title="Load-shedding" subtitle={ur ? "Apne feeder ka schedule — AI SMS se parh leta hai" : "Your feeder's schedule — the AI can read it straight from the SMS"} />
      <div className="space-y-6">
        <Card title={ur ? "24 ghante" : "Next 24 hours"}>
          <div className="pt-4">
            <OutageTimeline outages={p.outages} nowHour={startHour + clock.minute / 60} lang={lang} />
          </div>
        </Card>
        <Card title={ur ? "Schedule" : "Schedule"}>
          <OutageEditor outages={p.outages} onChange={(outages) => m.update({ outages })} lang={lang} />
        </Card>
      </div>
    </>
  );
}

/* ======================= Appliances ======================= */

export function AppliancesView({ m }: Props) {
  const { profile: p, lang } = m;
  const ur = lang === "ur";
  const totalW = p.appliances.filter((a) => a.on).reduce((s, a) => s + a.watts * a.qty, 0);
  return (
    <>
      <PageHeader
        title="Appliances"
        subtitle={ur ? "On/off karein — battery ka andaza foran badlay ga" : "Flip anything on or off — the battery forecast updates instantly"}
        right={<Badge>{(totalW / 1000).toFixed(2)} kW {ur ? "zyada se zyada" : "if all on"}</Badge>}
      />
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
        <Card title={ur ? "Ghar ke appliances" : "Your appliances"} subtitle={ur ? "Naam par click karein edit ke liye" : "Click a name to edit watts and timing"}>
          <ApplianceEditor appliances={p.appliances} onChange={(appliances) => m.update({ appliances })} lang={lang} />
        </Card>
        <Card title={ur ? "AI se add karein" : "Add with AI"} subtitle={ur ? "Apne alfaaz mein likhein" : "Describe them in your own words"}>
          <ApplianceAiAdd appliances={p.appliances} onChange={(appliances) => m.update({ appliances })} lang={lang} />
        </Card>
      </div>
    </>
  );
}

/* ======================= AI Plan ======================= */

export function PlanView({ m }: Props) {
  const { opt, lang, startHour } = m;
  const ur = lang === "ur";
  const before = verdict(opt.base, startHour, lang);
  const after = verdict(opt.best, startHour, lang);
  return (
    <>
      <PageHeader
        title={ur ? "Aap ka AI plan" : "Your AI plan"}
        subtitle={ur ? "Simulation numbers nikalta hai, Gemini samjhata hai" : "The simulation finds the fixes; Gemini explains them"}
        right={
          m.applied ? (
            <Button variant="secondary" onClick={m.undoPlan}>
              ↩ {ur ? "Wapas pehle jaisa" : "Undo plan"}
            </Button>
          ) : opt.actions.length > 0 ? (
            <Button onClick={m.applyPlan}>{ur ? "Plan apply karein" : "Apply this plan"}</Button>
          ) : null
        }
      />

      {!m.applied && opt.actions.length > 0 && (
        <div className="mb-6 grid grid-cols-1 gap-4 md:grid-cols-2">
          <div className="rounded-2xl border border-slate-200 bg-white p-5">
            <p className="text-xs font-semibold tracking-wider text-slate-500 uppercase">{ur ? "Abhi" : "Without plan"}</p>
            <p className="mt-1 text-lg font-semibold text-slate-900">{before.title}</p>
            <p className="text-[13px] text-slate-600">{before.detail}</p>
          </div>
          <div className="rounded-2xl border border-emerald-200 bg-emerald-50/50 p-5">
            <p className="text-xs font-semibold tracking-wider text-emerald-700 uppercase">{ur ? "Plan ke saath" : "With AI plan"}</p>
            <p className="mt-1 text-lg font-semibold text-slate-900">{after.title}</p>
            <p className="text-[13px] text-slate-600">{after.detail}</p>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <Card
          title={ur ? "Qadam ba qadam" : "Step by step"}
          action={
            m.ai.busy ? (
              <Badge tone="amber">
                <Spinner /> {ur ? "soch raha" : "thinking"}
              </Badge>
            ) : m.ai.plan ? (
              <Badge tone="green">Gemini</Badge>
            ) : m.ai.offline ? (
              <Badge>offline</Badge>
            ) : null
          }
        >
          {m.ai.plan?.headline && <p className="mb-4 text-[15px] leading-snug font-medium text-slate-900">{m.ai.plan.headline}</p>}
          <PlanSteps m={m} />
          {m.ai.plan?.tip && <p className="mt-5 rounded-xl bg-sky-50 p-3.5 text-[13px] leading-relaxed text-sky-900">💡 {m.ai.plan.tip}</p>}
        </Card>
        <Card title={ur ? "Battery: pehle vs baad" : "Battery: before vs after"}>
          <BatteryChart now={opt.base} plan={opt.actions.length ? opt.best : null} startHour={startHour} floorPct={m.floor} lang={lang} height={300} />
        </Card>
      </div>
    </>
  );
}

/* ======================= Forecast ======================= */

export function ForecastView({ m }: Props) {
  const { profile: p, lang, tomorrow: t, startHour } = m;
  const ur = lang === "ur";
  return (
    <>
      <PageHeader
        title={ur ? "Solar forecast" : "Solar forecast"}
        subtitle={`${p.city} · ${m.weatherSource === "open-meteo" ? "Open-Meteo" : ur ? "Offline andaza" : "Offline estimate"} · ${p.panelKw} kW ${ur ? "panels" : "of panels"}`}
      />
      <div className="mb-6 grid grid-cols-2 gap-4 xl:grid-cols-4">
        <StatTile label={ur ? "Kal ka solar" : "Tomorrow's solar"} value={t ? t.solarKwh.toFixed(1) : "—"} unit="kWh" icon={<IconSun size={17} />} tone={t?.quality === "poor" ? "red" : t?.quality === "fair" ? "amber" : "green"} hint={t ? qualityLabel(t.quality, ur) : ""} />
        <StatTile label={ur ? "Din mein badal" : "Daytime clouds"} value={t ? Math.round(t.cloud) : "—"} unit="%" />
        <StatTile label={ur ? "Zyada se zyada garmi" : "Max temperature"} value={t ? Math.round(t.maxTemp) : "—"} unit="°C" tone={t && t.maxTemp >= 38 ? "red" : "slate"} />
        <StatTile label={ur ? "Kal raat battery" : "Battery at end of tomorrow"} value={Math.round(m.opt.base.endSoc)} unit="%" />
      </div>
      <Card title={ur ? "Har ghante ka solar (kW)" : "Expected solar output per hour"} subtitle={ur ? "Bar par hover karein: badal aur temperature" : "Hover a bar for cloud cover and temperature"}>
        <SolarChart hours={m.hours} panelKw={p.panelKw} startHour={startHour} lang={lang} height={280} />
        <p className="mt-3 text-[13px] text-slate-500">
          {ur
            ? "Heavy kaam (motor, kapray, iron) sab se oonchi bars wale ghanton mein karein."
            : "Run heavy jobs (water motor, laundry, ironing) during the tallest bars — that power is free."}
        </p>
      </Card>
    </>
  );
}
