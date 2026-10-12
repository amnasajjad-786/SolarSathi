"use client";

import { useState } from "react";
import { Badge, Button, Card, Spinner, Toggle } from "./ui";
import type { Appliance, Lang } from "@/lib/types";
import { fmtWindow, parseHHMM, toHHMM } from "@/lib/time";
import { uid } from "@/lib/demo-data";

export function ApplianceList({ appliances, onChange, lang }: {
  appliances: Appliance[];
  onChange: (a: Appliance[]) => void;
  lang: Lang;
}) {
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [editing, setEditing] = useState<string | null>(null);
  const ur = lang === "ur";

  const update = (id: string, patch: Partial<Appliance>) => onChange(appliances.map((a) => (a.id === id ? { ...a, ...patch } : a)));

  async function addWithAi() {
    setBusy(true);
    setErr(null);
    try {
      const r = await fetch("/api/appliances", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text }),
      });
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

  const totalW = appliances.filter((a) => a.on).reduce((s, a) => s + a.watts * a.qty, 0);

  return (
    <Card icon="🏠" title={ur ? "Ghar ke appliances (what-if)" : "Your appliances (what-if)"} action={<Badge>{(totalW / 1000).toFixed(2)} kW max</Badge>}>
      <p className="mb-3 text-sm text-stone-500">
        {ur ? "Kisi bhi cheez ko on/off karein — battery ka hisaab foran update hoga." : "Flip anything on or off — the battery forecast updates instantly."}
      </p>
      <ul className="divide-y divide-stone-100">
        {appliances.map((a) => (
          <li key={a.id} className="py-2.5">
            <div className="flex items-center gap-3">
              <Toggle checked={a.on} onChange={(v) => update(a.id, { on: v })} label={a.name} />
              <button className="min-w-0 flex-1 text-left" onClick={() => setEditing(editing === a.id ? null : a.id)}>
                <div className={`truncate text-sm font-medium ${a.on ? "text-stone-800" : "text-stone-400 line-through"}`}>
                  {a.qty > 1 ? `${a.qty}× ` : ""}
                  {a.name}
                </div>
                <div className="flex flex-wrap items-center gap-1.5 text-xs text-stone-500">
                  <span>{a.watts * a.qty} W</span>
                  <span>·</span>
                  <span>{fmtWindow(a)}</span>
                  {a.essential && <Badge tone="blue">{ur ? "zaroori" : "essential"}</Badge>}
                  {a.shiftable && <Badge tone="amber">{ur ? "waqt badal sakte" : "can shift"}</Badge>}
                  {a.outageFactor === 0 && <Badge tone="red">{ur ? "load-shedding mein band" : "off during outages"}</Badge>}
                  {a.outageFactor !== undefined && a.outageFactor > 0 && a.outageFactor < 1 && <Badge tone="green">{ur ? "outage mein eco" : "eco during outages"}</Badge>}
                </div>
              </button>
              <button aria-label="Delete" className="px-2 text-stone-300 hover:text-red-500" onClick={() => onChange(appliances.filter((x) => x.id !== a.id))}>
                ×
              </button>
            </div>
            {editing === a.id && (
              <div className="mt-2 grid grid-cols-2 gap-2 rounded-xl bg-stone-50 p-3 text-sm sm:grid-cols-4">
                <label className="text-stone-500">
                  Watts
                  <input type="number" value={a.watts} onChange={(e) => update(a.id, { watts: Number(e.target.value) })} className="mt-1 w-full rounded-lg border border-stone-200 px-2 py-1" />
                </label>
                <label className="text-stone-500">
                  Qty
                  <input type="number" value={a.qty} min={1} onChange={(e) => update(a.id, { qty: Math.max(1, Number(e.target.value)) })} className="mt-1 w-full rounded-lg border border-stone-200 px-2 py-1" />
                </label>
                <label className="text-stone-500">
                  {ur ? "Se" : "From"}
                  <input type="time" value={toHHMM(a.start)} onChange={(e) => update(a.id, { start: parseHHMM(e.target.value) ?? a.start })} className="mt-1 w-full rounded-lg border border-stone-200 px-2 py-1" />
                </label>
                <label className="text-stone-500">
                  {ur ? "Tak" : "To"}
                  <input type="time" value={toHHMM(a.end)} onChange={(e) => update(a.id, { end: (parseHHMM(e.target.value) ?? a.end) % 24 })} className="mt-1 w-full rounded-lg border border-stone-200 px-2 py-1" />
                </label>
                <label className="col-span-1 flex items-center gap-2 text-stone-600">
                  <input type="checkbox" checked={a.essential} onChange={(e) => update(a.id, { essential: e.target.checked })} /> {ur ? "Zaroori" : "Essential"}
                </label>
                <label className="col-span-1 flex items-center gap-2 text-stone-600">
                  <input type="checkbox" checked={a.shiftable} onChange={(e) => update(a.id, { shiftable: e.target.checked })} /> {ur ? "Waqt badal sakte" : "Can shift"}
                </label>
              </div>
            )}
          </li>
        ))}
      </ul>

      <div className="mt-3 border-t border-stone-100 pt-3">
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={2}
          placeholder={ur ? "Apne alfaaz mein likhein: \"2 AC 1.5 ton raat ko, 5 pankhay, pani ki motor subah\"" : "Describe in your own words: \"two 1.5 ton ACs at night, 5 fans, water motor in the morning\""}
          className="w-full rounded-xl border border-stone-200 p-3 text-sm outline-none focus:border-amber-400"
        />
        <Button className="mt-2" onClick={addWithAi} disabled={busy || !text.trim()}>
          {busy ? <Spinner /> : "✨"} {ur ? "AI se add karein" : "Add with AI"}
        </Button>
        {err && <p className="mt-2 text-sm text-red-600">{err}</p>}
      </div>
    </Card>
  );
}
