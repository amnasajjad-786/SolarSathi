"use client";

import type { Lang, Window } from "@/lib/types";
import { fmtHour, inWindow } from "@/lib/time";

/** A 24-hour strip: grey = grid on, dark = load-shedding, amber line = now. */
export function OutageTimeline({ outages, nowHour, lang }: { outages: Window[]; nowHour: number; lang: Lang }) {
  const slots = Array.from({ length: 96 }, (_, i) => i / 4);
  return (
    <div>
      <div className="relative">
        <div className="flex h-9 overflow-hidden rounded-lg">
          {slots.map((h) => (
            <div key={h} className={`flex-1 ${outages.some((w) => inWindow(h, w)) ? "bg-slate-700" : "bg-emerald-100"}`} title={fmtHour(h)} />
          ))}
        </div>
        <div className="absolute -top-1 -bottom-1 w-0.5 rounded bg-amber-500" style={{ left: `${(nowHour / 24) * 100}%` }}>
          <span className="absolute -top-5 -translate-x-1/2 rounded bg-amber-500 px-1.5 py-0.5 text-[10px] font-semibold whitespace-nowrap text-slate-900">
            {lang === "ur" ? "Abhi" : "Now"}
          </span>
        </div>
      </div>
      <div className="mt-1.5 flex justify-between text-[11px] text-slate-500">
        {[0, 6, 12, 18, 24].map((h) => (
          <span key={h}>{h === 24 ? "12 AM" : fmtHour(h).replace(":00", "")}</span>
        ))}
      </div>
      <div className="mt-2 flex gap-4 text-xs text-slate-600">
        <span className="inline-flex items-center gap-1.5">
          <span className="h-3 w-3 rounded-sm bg-emerald-100 ring-1 ring-emerald-200" /> {lang === "ur" ? "Bijli hai" : "Grid on"}
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="h-3 w-3 rounded-sm bg-slate-700" /> {lang === "ur" ? "Load-shedding" : "Load-shedding"}
        </span>
      </div>
    </div>
  );
}
