"use client";

import { useState } from "react";
import { Badge, Button, NumberField, Spinner, Toggle } from "./ui";
import { IconSparkles } from "./icons";
import type { Appliance, Lang, Profile, Window } from "@/lib/types";
import { fmtWindow, parseHHMM, parseOutagesRegex, toHHMM, windowHours } from "@/lib/time";
import { CITIES, SAMPLE_SMS, uid } from "@/lib/demo-data";

const input = "rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-amber-400 focus:ring-2 focus:ring-amber-100";

/* ---------------- Load-shedding ---------------- */

export function OutageEditor({ outages, onChange, lang }: { outages: Window[]; onChange: (w: Window[]) => void; lang: Lang }) {
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<{ ok: boolean; text: string } | null>(null);
  const [from, setFrom] = useState("22:00");
  const [to, setTo] = useState("00:00");
  const ur = lang === "ur";

  async function parse() {
    if (!text.trim()) return;
    setBusy(true);
    setNote(null);
    try {
      const r = await fetch("/api/parse-outage", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ text }) });
      const j = await r.json();
      if (!r.ok) throw new Error(j.message);
      if (!j.windows.length) throw new Error("no times found");
      onChange(j.windows);
      const extra = j.oneOff?.length
        ? ` ${ur ? "Maintenance" : "Also a one-off shutdown"}: ${j.oneOff.map((o: { date: string; start: string; end: string }) => `${o.date} ${o.start}–${o.end}`).join(", ")}.`
        : "";
      setNote({ ok: true, text: `${j.summary}${extra}` });
      setText("");
    } catch {
      const w = parseOutagesRegex(text);
      if (w.length) {
        onChange(w);
        setNote({ ok: true, text: ur ? "AI offline — basic reader se times nikale." : "AI offline — used the basic time reader." });
      } else {
        setNote({ ok: false, text: ur ? "Koi time nahi mila. Neeche khud add karein." : "Couldn't find any times — add them manually below." });
      }
    } finally {
      setBusy(false);
    }
  }

  const total = outages.reduce((s, w) => s + windowHours(w), 0);

  return (
    <div className="space-y-6">
      <div>
        <div className="mb-2 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-slate-800">{ur ? "Aap ke outage times" : "Your daily outage windows"}</h3>
          <Badge tone={total > 0 ? "red" : "green"}>{total > 0 ? `${total}h ${ur ? "rozana" : "per day"}` : ur ? "Koi nahi" : "None"}</Badge>
        </div>
        <div className="flex flex-wrap gap-2">
          {outages.length === 0 && <span className="text-sm text-slate-400">{ur ? "Abhi koi outage add nahi." : "No outages added yet."}</span>}
          {outages.map((w, i) => (
            <span key={i} className="inline-flex items-center gap-1 rounded-full bg-slate-800 py-1 pr-1 pl-3 text-[13px] font-medium text-white">
              {fmtWindow(w)}
              <button aria-label="Remove" className="rounded-full px-1.5 text-slate-400 hover:bg-white/10 hover:text-white" onClick={() => onChange(outages.filter((_, j) => j !== i))}>
                ×
              </button>
            </span>
          ))}
        </div>
      </div>

      <div>
        <h3 className="mb-1 text-sm font-semibold text-slate-800">{ur ? "SMS paste karein — AI parhega" : "Paste the SMS — AI reads it"}</h3>
        <p className="mb-2 text-[13px] text-slate-500">
          {ur ? "LESCO / K-Electric / IESCO ka SMS, tweet, ya apne alfaaz (\"raat 10 se 12\")." : "LESCO / K-Electric / IESCO SMS, a tweet, or your own words (\"raat 10 se 12\")."}
        </p>
        <textarea value={text} onChange={(e) => setText(e.target.value)} rows={4} placeholder={SAMPLE_SMS} className={`w-full ${input}`} />
        <div className="mt-2 flex flex-wrap gap-2">
          <Button onClick={parse} disabled={busy || !text.trim()}>
            {busy ? <Spinner /> : <IconSparkles size={16} />} {ur ? "AI se parhein" : "Read with AI"}
          </Button>
          <Button variant="ghost" onClick={() => setText(SAMPLE_SMS)}>
            {ur ? "Sample SMS" : "Use sample SMS"}
          </Button>
        </div>
        {note && <p className={`mt-2 text-[13px] ${note.ok ? "text-emerald-700" : "text-red-600"}`}>{note.text}</p>}
      </div>

      <div>
        <h3 className="mb-2 text-sm font-semibold text-slate-800">{ur ? "Ya khud add karein" : "Or add one manually"}</h3>
        <div className="flex flex-wrap items-end gap-2">
          <label className="text-[13px] text-slate-600">
            <span className="mb-1 block">{ur ? "Se" : "From"}</span>
            <input type="time" value={from} onChange={(e) => setFrom(e.target.value)} className={input} />
          </label>
          <label className="text-[13px] text-slate-600">
            <span className="mb-1 block">{ur ? "Tak" : "To"}</span>
            <input type="time" value={to} onChange={(e) => setTo(e.target.value)} className={input} />
          </label>
          <Button
            variant="secondary"
            onClick={() => {
              const s = parseHHMM(from);
              const e = parseHHMM(to);
              if (s !== null && e !== null && s !== e) onChange([...outages, { start: s, end: e % 24 }]);
            }}
          >
            + {ur ? "Add" : "Add window"}
          </Button>
        </div>
      </div>
    </div>
  );
}

/* ---------------- Appliances ---------------- */

export function ApplianceEditor({ appliances, onChange, lang }: { appliances: Appliance[]; onChange: (a: Appliance[]) => void; lang: Lang }) {
  const [editing, setEditing] = useState<string | null>(null);
  const ur = lang === "ur";
  const update = (id: string, patch: Partial<Appliance>) => onChange(appliances.map((a) => (a.id === id ? { ...a, ...patch } : a)));

  return (
    <div className="divide-y divide-slate-100">
      <div className="hidden grid-cols-[auto_1fr_90px_150px_24px] gap-4 px-1 pb-2 text-xs font-medium tracking-wide text-slate-500 uppercase sm:grid">
        <span className="w-11">{ur ? "On" : "On"}</span>
        <span>{ur ? "Appliance" : "Appliance"}</span>
        <span className="text-right">{ur ? "Watts" : "Power"}</span>
        <span>{ur ? "Waqt" : "Usual time"}</span>
        <span />
      </div>
      {appliances.map((a) => (
        <div key={a.id} className="py-3">
          <div className="grid grid-cols-[auto_1fr_24px] items-center gap-4 px-1 sm:grid-cols-[auto_1fr_90px_150px_24px]">
            <Toggle checked={a.on} onChange={(v) => update(a.id, { on: v })} label={a.name} />
            <button className="min-w-0 text-left" onClick={() => setEditing(editing === a.id ? null : a.id)}>
              <div className={`truncate text-sm font-medium ${a.on ? "text-slate-900" : "text-slate-400 line-through"}`}>
                {a.qty > 1 ? `${a.qty}× ` : ""}
                {a.name}
              </div>
              <div className="mt-0.5 flex flex-wrap gap-1">
                {a.essential && <Badge tone="blue">{ur ? "zaroori" : "essential"}</Badge>}
                {a.shiftable && <Badge tone="amber">{ur ? "waqt badal sakte" : "can shift"}</Badge>}
                {a.outageFactor === 0 && <Badge tone="red">{ur ? "outage mein band" : "off in outages"}</Badge>}
                {a.outageFactor !== undefined && a.outageFactor > 0 && a.outageFactor < 1 && <Badge tone="green">{ur ? "outage mein eco" : "eco in outages"}</Badge>}
                <span className="text-xs text-slate-500 sm:hidden">
                  {a.watts * a.qty} W · {fmtWindow(a)}
                </span>
              </div>
            </button>
            <span className="hidden text-right text-sm text-slate-700 tabular-nums sm:block">{a.watts * a.qty} W</span>
            <span className="hidden text-sm text-slate-600 sm:block">{fmtWindow(a)}</span>
            <button aria-label="Delete" className="text-slate-300 hover:text-red-500" onClick={() => onChange(appliances.filter((x) => x.id !== a.id))}>
              ×
            </button>
          </div>
          {editing === a.id && (
            <div className="mt-3 grid grid-cols-2 gap-3 rounded-xl bg-slate-50 p-3 text-[13px] sm:grid-cols-6">
              <label className="text-slate-600">
                Watts
                <input type="number" value={a.watts} onChange={(e) => update(a.id, { watts: Number(e.target.value) })} className={`mt-1 w-full ${input}`} />
              </label>
              <label className="text-slate-600">
                Qty
                <input type="number" min={1} value={a.qty} onChange={(e) => update(a.id, { qty: Math.max(1, Number(e.target.value)) })} className={`mt-1 w-full ${input}`} />
              </label>
              <label className="text-slate-600">
                {ur ? "Se" : "From"}
                <input type="time" value={toHHMM(a.start)} onChange={(e) => update(a.id, { start: parseHHMM(e.target.value) ?? a.start })} className={`mt-1 w-full ${input}`} />
              </label>
              <label className="text-slate-600">
                {ur ? "Tak" : "To"}
                <input type="time" value={toHHMM(a.end)} onChange={(e) => update(a.id, { end: (parseHHMM(e.target.value) ?? a.end) % 24 })} className={`mt-1 w-full ${input}`} />
              </label>
              <label className="flex items-center gap-2 self-end pb-2 text-slate-700">
                <input type="checkbox" checked={a.essential} onChange={(e) => update(a.id, { essential: e.target.checked })} /> {ur ? "Zaroori" : "Essential"}
              </label>
              <label className="flex items-center gap-2 self-end pb-2 text-slate-700">
                <input type="checkbox" checked={a.shiftable} onChange={(e) => update(a.id, { shiftable: e.target.checked })} /> {ur ? "Waqt badal sakte" : "Can shift"}
              </label>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

export function ApplianceAiAdd({ appliances, onChange, lang }: { appliances: Appliance[]; onChange: (a: Appliance[]) => void; lang: Lang }) {
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const ur = lang === "ur";

  async function add() {
    setBusy(true);
    setErr(null);
    try {
      const r = await fetch("/api/appliances", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ text }) });
      const j = await r.json();
      if (!r.ok) throw new Error(j.message);
      onChange([...appliances, ...j.appliances.map((a: Omit<Appliance, "id" | "on">) => ({ ...a, id: uid(), on: true }))]);
      setText("");
    } catch (e) {
      setErr((ur ? "AI se add nahi ho saka: " : "Couldn't add with AI: ") + (e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        rows={3}
        placeholder={ur ? "\"2 AC 1.5 ton raat ko, 5 pankhay, pani ki motor subah\"" : "\"two 1.5 ton ACs at night, 5 fans, water motor in the morning\""}
        className={`w-full ${input}`}
      />
      <Button className="mt-2" onClick={add} disabled={busy || !text.trim()}>
        {busy ? <Spinner /> : <IconSparkles size={16} />} {ur ? "AI se add karein" : "Add with AI"}
      </Button>
      {err && <p className="mt-2 text-[13px] text-red-600">{err}</p>}
    </div>
  );
}

/* ---------------- System ---------------- */

export function SystemForm({ profile, onChange, onReset, lang }: { profile: Profile; onChange: (p: Partial<Profile>) => void; onReset: () => void; lang: Lang }) {
  const ur = lang === "ur";
  return (
    <div>
      <div className="grid grid-cols-2 gap-4">
        <label className="col-span-2 block text-sm">
          <span className="mb-1.5 block text-[13px] font-medium text-slate-600">{ur ? "Shehar" : "City"}</span>
          <select value={profile.city} onChange={(e) => onChange({ city: e.target.value, ...CITIES[e.target.value] })} className={`w-full ${input}`}>
            {Object.keys(CITIES).map((c) => (
              <option key={c}>{c}</option>
            ))}
          </select>
        </label>
        <NumberField label={ur ? "Solar panels" : "Solar panels"} value={profile.panelKw} step={0.5} suffix="kW" onChange={(v) => onChange({ panelKw: v })} />
        <NumberField label="Inverter" value={profile.inverterKw} step={0.5} suffix="kW" onChange={(v) => onChange({ inverterKw: v })} />
        <NumberField label={ur ? "Battery size" : "Battery size"} value={profile.batteryKwh} step={0.1} suffix="kWh" onChange={(v) => onChange({ batteryKwh: v })} />
        <label className="block text-sm">
          <span className="mb-1.5 block text-[13px] font-medium text-slate-600">{ur ? "Battery type" : "Battery type"}</span>
          <select value={profile.batteryType} onChange={(e) => onChange({ batteryType: e.target.value as Profile["batteryType"] })} className={`w-full ${input}`}>
            <option value="lithium">Lithium (LiFePO4)</option>
            <option value="lead-acid">Lead-acid / tubular</option>
          </select>
        </label>
      </div>
      <p className="mt-3 text-xs text-slate-500">12V 200Ah tubular ≈ 2.4 kWh · 48V/51.2V 100Ah lithium ≈ 4.8–5.1 kWh</p>
      <div className="mt-4 flex items-center justify-between gap-3 rounded-xl border border-slate-200 p-3.5">
        <div>
          <div className="text-sm font-medium text-slate-800">{ur ? "WAPDA se battery charging" : "Charge battery from grid"}</div>
          <div className="text-xs text-slate-500">{ur ? "Inverter setting: SUB / utility charge" : "Inverter setting: SUB / utility charge"}</div>
        </div>
        <Toggle checked={profile.gridCharging} onChange={(v) => onChange({ gridCharging: v })} label="Grid charging" />
      </div>
      <div className="mt-4 text-right">
        <Button variant="ghost" size="sm" onClick={onReset}>
          {ur ? "Demo ghar load karein" : "Reset to demo home"}
        </Button>
      </div>
    </div>
  );
}
