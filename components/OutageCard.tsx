"use client";

import { useState } from "react";
import { Badge, Button, Card, Spinner } from "./ui";
import type { Lang, Window } from "@/lib/types";
import { fmtWindow, parseHHMM, parseOutagesRegex, windowHours } from "@/lib/time";
import { SAMPLE_SMS } from "@/lib/demo-data";

export function OutageCard({ outages, onChange, lang }: { outages: Window[]; onChange: (w: Window[]) => void; lang: Lang }) {
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const [from, setFrom] = useState("22:00");
  const [to, setTo] = useState("00:00");
  const ur = lang === "ur";

  async function parse() {
    if (!text.trim()) return;
    setBusy(true);
    setNote(null);
    try {
      const r = await fetch("/api/parse-outage", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text }),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j.message);
      if (!j.windows.length) throw new Error("no times found");
      onChange(j.windows);
      const extra = j.oneOff?.length ? ` · ${ur ? "Maintenance" : "Also a one-off shutdown"}: ${j.oneOff.map((o: { date: string; start: string; end: string }) => `${o.date} ${o.start}–${o.end}`).join(", ")}` : "";
      setNote(`🤖 ${j.summary}${extra}`);
    } catch {
      const w = parseOutagesRegex(text);
      if (w.length) {
        onChange(w);
        setNote(ur ? "AI offline — basic reader se times nikale." : "AI offline — used the basic time reader.");
      } else {
        setNote(ur ? "Koi time nahi mila. Neeche khud add karein." : "Couldn't find any times — add them manually below.");
      }
    } finally {
      setBusy(false);
    }
  }

  const total = outages.reduce((s, w) => s + windowHours(w), 0);

  return (
    <Card
      icon="🔌"
      title={ur ? "Load-shedding schedule" : "Load-shedding schedule"}
      action={<Badge tone={total > 0 ? "red" : "green"}>{total > 0 ? `${total}h / ${ur ? "din" : "day"}` : ur ? "Koi nahi" : "None"}</Badge>}
    >
      <div className="mb-3 flex flex-wrap gap-2">
        {outages.length === 0 && <span className="text-sm text-stone-400">{ur ? "Abhi koi outage add nahi." : "No outages added yet."}</span>}
        {outages.map((w, i) => (
          <span key={i} className="inline-flex items-center gap-1 rounded-full bg-slate-100 py-1 pr-1 pl-3 text-sm text-slate-700">
            {fmtWindow(w)}
            <button
              aria-label="Remove"
              className="rounded-full px-1.5 text-slate-400 hover:bg-slate-200 hover:text-slate-700"
              onClick={() => onChange(outages.filter((_, j) => j !== i))}
            >
              ×
            </button>
          </span>
        ))}
      </div>

      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        rows={3}
        placeholder={ur ? "LESCO/K-Electric ka SMS, tweet ya apne alfaaz paste karein… e.g. \"raat 10 se 12 aur subah 3 se 5\"" : "Paste the LESCO / K-Electric SMS, a tweet, or just type it… e.g. \"10pm to 12am and 3 to 5 am\""}
        className="w-full rounded-xl border border-stone-200 p-3 text-sm outline-none focus:border-amber-400"
      />
      <div className="mt-2 flex flex-wrap items-center gap-2">
        <Button onClick={parse} disabled={busy || !text.trim()}>
          {busy ? <Spinner /> : "✨"} {ur ? "AI se parhein" : "Read with AI"}
        </Button>
        <Button variant="ghost" onClick={() => setText(SAMPLE_SMS)}>
          {ur ? "Sample SMS" : "Use sample SMS"}
        </Button>
      </div>
      {note && <p className="mt-2 text-sm text-stone-600">{note}</p>}

      <div className="mt-4 flex flex-wrap items-end gap-2 border-t border-stone-100 pt-3 text-sm">
        <label className="text-stone-500">
          {ur ? "Se" : "From"}
          <input type="time" value={from} onChange={(e) => setFrom(e.target.value)} className="ml-2 rounded-lg border border-stone-200 px-2 py-1" />
        </label>
        <label className="text-stone-500">
          {ur ? "Tak" : "To"}
          <input type="time" value={to} onChange={(e) => setTo(e.target.value)} className="ml-2 rounded-lg border border-stone-200 px-2 py-1" />
        </label>
        <Button
          variant="secondary"
          onClick={() => {
            const s = parseHHMM(from);
            const e = parseHHMM(to);
            if (s !== null && e !== null && s !== e) onChange([...outages, { start: s, end: e % 24 }]);
          }}
        >
          + {ur ? "Add" : "Add"}
        </Button>
      </div>
    </Card>
  );
}

