"use client";

import type { Alert, AlertLevel, View } from "@/lib/alerts";
import type { Lang } from "@/lib/types";
import { IconAlert, IconCheck, IconChevron, IconInfo, IconOctagon } from "./icons";

const STYLE: Record<AlertLevel, { box: string; icon: string; label: { en: string; ur: string }; Icon: typeof IconInfo }> = {
  critical: { box: "border-red-200 bg-red-50/60", icon: "bg-red-100 text-red-600", label: { en: "Critical", ur: "Fori" }, Icon: IconOctagon },
  warning: { box: "border-amber-200 bg-amber-50/60", icon: "bg-amber-100 text-amber-700", label: { en: "Warning", ur: "Khabardar" }, Icon: IconAlert },
  info: { box: "border-sky-200 bg-sky-50/50", icon: "bg-sky-100 text-sky-700", label: { en: "Tip", ur: "Mashwara" }, Icon: IconInfo },
  good: { box: "border-emerald-200 bg-emerald-50/50", icon: "bg-emerald-100 text-emerald-700", label: { en: "All good", ur: "Theek" }, Icon: IconCheck },
};

export function AlertList({ alerts, lang, onNavigate, limit }: {
  alerts: Alert[];
  lang: Lang;
  onNavigate: (v: View) => void;
  limit?: number;
}) {
  const shown = limit ? alerts.slice(0, limit) : alerts;
  if (!shown.length) {
    return <p className="text-sm text-slate-500">{lang === "ur" ? "Koi alert nahi." : "No alerts right now."}</p>;
  }
  return (
    <ul className="space-y-2.5">
      {shown.map((a) => {
        const s = STYLE[a.level];
        return (
          <li key={a.id} className={`flex items-start gap-3 rounded-xl border p-3.5 ${s.box}`}>
            <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${s.icon}`}>
              <s.Icon size={18} />
            </span>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                <span className="text-sm font-semibold text-slate-900">{a.title}</span>
                <span className="text-[11px] font-semibold tracking-wide text-slate-500 uppercase">{s.label[lang]}</span>
              </div>
              <p className="mt-0.5 text-[13px] leading-relaxed text-slate-600">{a.detail}</p>
            </div>
            {a.action && (
              <button
                onClick={() => onNavigate(a.action!.view)}
                className="hidden shrink-0 items-center gap-0.5 self-center rounded-lg px-2 py-1 text-[13px] font-medium text-slate-700 hover:bg-white sm:inline-flex"
              >
                {a.action.label}
                <IconChevron size={15} />
              </button>
            )}
          </li>
        );
      })}
    </ul>
  );
}
