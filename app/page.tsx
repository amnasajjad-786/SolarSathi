"use client";

import { useEffect, useState } from "react";
import { Sidebar } from "@/components/Sidebar";
import { AppliancesView, BatteryView, DashboardView, ForecastView, OutagesView, PlanView } from "@/components/views";
import { useSolarModel } from "@/lib/useSolarModel";
import type { View } from "@/lib/alerts";

const VIEWS: View[] = ["dashboard", "battery", "outages", "appliances", "plan", "forecast"];

export default function Home() {
  const m = useSolarModel();
  const [view, setView] = useState<View>("dashboard");

  // Keep the current section in the URL hash so refresh/back work.
  useEffect(() => {
    const read = () => {
      const h = window.location.hash.slice(1) as View;
      setView(VIEWS.includes(h) ? h : "dashboard");
    };
    read();
    window.addEventListener("hashchange", read);
    return () => window.removeEventListener("hashchange", read);
  }, []);

  const go = (v: View) => {
    window.location.hash = v;
    setView(v);
    window.scrollTo({ top: 0 });
  };

  if (!m.ready) {
    return <div className="flex min-h-screen items-center justify-center text-sm text-slate-400">Loading SolarSaathi…</div>;
  }

  const critical = m.alerts.filter((a) => a.level === "critical").length;
  const warnings = m.alerts.filter((a) => a.level === "warning").length;

  return (
    <div className="min-h-screen">
      <Sidebar
        view={view}
        onNavigate={go}
        lang={m.lang}
        setLang={m.setLang}
        city={m.profile.city}
        badges={{
          dashboard: critical ? { count: critical, tone: "red" } : warnings ? { count: warnings, tone: "amber" } : undefined,
          plan: m.planActions.length && !m.applied ? { count: m.planActions.length, tone: "blue" } : undefined,
          outages: m.profile.outages.length === 0 ? { count: 1, tone: "amber" } : undefined,
        }}
      />
      <main className="lg:pl-64">
        <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-10 lg:py-10">
          {view === "dashboard" && <DashboardView m={m} go={go} />}
          {view === "battery" && <BatteryView m={m} go={go} />}
          {view === "outages" && <OutagesView m={m} go={go} />}
          {view === "appliances" && <AppliancesView m={m} go={go} />}
          {view === "plan" && <PlanView m={m} go={go} />}
          {view === "forecast" && <ForecastView m={m} go={go} />}
          <footer className="mt-12 text-center text-xs text-slate-400">SolarSaathi · Apni bijli, apna plan · Qubit Dynamics</footer>
        </div>
      </main>
    </div>
  );
}
