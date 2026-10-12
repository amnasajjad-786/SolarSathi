"use client";

import { useState, type ReactNode } from "react";
import type { View } from "@/lib/alerts";
import type { Lang } from "@/lib/types";
import { IconBattery, IconDashboard, IconHome, IconMenu, IconPlugOff, IconSparkles, IconSunCloud, IconX } from "./icons";

export const NAV: { view: View; en: string; ur: string; icon: ReactNode; hint: { en: string; ur: string } }[] = [
  { view: "dashboard", en: "Dashboard", ur: "Dashboard", icon: <IconDashboard />, hint: { en: "Alerts & overview", ur: "Alerts aur khulasa" } },
  { view: "battery", en: "Battery & Inverter", ur: "Battery aur Inverter", icon: <IconBattery />, hint: { en: "Screenshot reader, system", ur: "Screenshot, system" } },
  { view: "outages", en: "Load-shedding", ur: "Load-shedding", icon: <IconPlugOff />, hint: { en: "Your outage schedule", ur: "Outage ka schedule" } },
  { view: "appliances", en: "Appliances", ur: "Appliances", icon: <IconHome />, hint: { en: "What's running at home", ur: "Ghar mein kya chal raha" } },
  { view: "plan", en: "AI Plan", ur: "AI Plan", icon: <IconSparkles />, hint: { en: "What to do tonight", ur: "Aaj raat kya karein" } },
  { view: "forecast", en: "Solar Forecast", ur: "Solar Forecast", icon: <IconSunCloud />, hint: { en: "Tomorrow's sun & heat", ur: "Kal ki dhoop aur garmi" } },
];

export function Sidebar({ view, onNavigate, lang, setLang, city, badges }: {
  view: View;
  onNavigate: (v: View) => void;
  lang: Lang;
  setLang: (l: Lang) => void;
  city: string;
  badges: Partial<Record<View, { count: number; tone: "red" | "amber" | "blue" }>>;
}) {
  const [open, setOpen] = useState(false);
  const go = (v: View) => {
    onNavigate(v);
    setOpen(false);
  };

  const panel = (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-3 px-5 pt-6 pb-8">
        <Logo />
        <div>
          <div className="text-[15px] font-semibold text-white">SolarSaathi</div>
          <div className="text-xs text-slate-400">{city} · Pakistan</div>
        </div>
      </div>
      <nav className="flex-1 space-y-1 px-3" aria-label="Main">
        {NAV.map((n) => {
          const active = n.view === view;
          const b = badges[n.view];
          return (
            <button
              key={n.view}
              onClick={() => go(n.view)}
              aria-current={active ? "page" : undefined}
              className={`group flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition ${
                active ? "bg-white/10 text-white" : "text-slate-400 hover:bg-white/5 hover:text-slate-100"
              }`}
            >
              <span className={active ? "text-amber-400" : "text-slate-500 group-hover:text-slate-300"}>{n.icon}</span>
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-medium">{lang === "ur" ? n.ur : n.en}</span>
                <span className="block truncate text-xs text-slate-500">{n.hint[lang]}</span>
              </span>
              {b && b.count > 0 && (
                <span
                  className={`flex h-5 min-w-5 items-center justify-center rounded-full px-1.5 text-[11px] font-semibold ${
                    b.tone === "red" ? "bg-red-500 text-white" : b.tone === "amber" ? "bg-amber-400 text-slate-900" : "bg-sky-500 text-white"
                  }`}
                >
                  {b.count}
                </span>
              )}
            </button>
          );
        })}
      </nav>
      <div className="border-t border-white/10 p-4">
        <div className="mb-2 text-xs font-medium text-slate-500">{lang === "ur" ? "Zaban" : "Language"}</div>
        <div className="flex rounded-xl bg-white/5 p-1 text-[13px]" role="group" aria-label="Language">
          {(["en", "ur"] as const).map((l) => (
            <button
              key={l}
              onClick={() => setLang(l)}
              className={`flex-1 rounded-lg px-2 py-1.5 font-medium transition ${lang === l ? "bg-white text-slate-900" : "text-slate-400 hover:text-white"}`}
            >
              {l === "en" ? "English" : "Roman Urdu"}
            </button>
          ))}
        </div>
      </div>
    </div>
  );

  return (
    <>
      {/* Desktop */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 bg-slate-900 lg:block">{panel}</aside>

      {/* Mobile top bar */}
      <div className="sticky top-0 z-30 flex items-center justify-between border-b border-slate-200 bg-white/90 px-4 py-3 backdrop-blur lg:hidden">
        <div className="flex items-center gap-2.5">
          <Logo small />
          <span className="text-[15px] font-semibold text-slate-900">SolarSaathi</span>
        </div>
        <button onClick={() => setOpen(true)} aria-label="Open menu" className="rounded-lg p-2 text-slate-700 hover:bg-slate-100">
          <IconMenu size={22} />
        </button>
      </div>

      {/* Mobile drawer */}
      {open && (
        <div className="fixed inset-0 z-40 lg:hidden" role="dialog" aria-modal="true">
          <div className="absolute inset-0 bg-slate-900/50" onClick={() => setOpen(false)} />
          <div className="absolute inset-y-0 left-0 w-72 max-w-[85vw] bg-slate-900 shadow-xl">
            <button onClick={() => setOpen(false)} aria-label="Close menu" className="absolute top-5 right-4 rounded-lg p-1.5 text-slate-400 hover:bg-white/10">
              <IconX />
            </button>
            {panel}
          </div>
        </div>
      )}
    </>
  );
}

function Logo({ small }: { small?: boolean }) {
  const s = small ? "h-8 w-8" : "h-10 w-10";
  return (
    <span className={`flex ${s} items-center justify-center rounded-xl bg-gradient-to-br from-amber-300 to-amber-500 text-slate-900 shadow-sm`}>
      <svg width={small ? 18 : 22} height={small ? 18 : 22} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" aria-hidden>
        <circle cx="12" cy="12" r="4" />
        <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
      </svg>
    </span>
  );
}
