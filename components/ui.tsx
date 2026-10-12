"use client";

import type { ReactNode } from "react";

export function Card({ title, subtitle, action, children, className = "", pad = true }: {
  title?: ReactNode;
  subtitle?: ReactNode;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
  pad?: boolean;
}) {
  return (
    <section className={`rounded-2xl border border-slate-200/80 bg-white shadow-[0_1px_2px_rgba(15,23,42,0.04)] ${className}`}>
      {(title || action) && (
        <header className="flex items-start justify-between gap-3 border-b border-slate-100 px-5 py-4">
          <div className="min-w-0">
            <h2 className="text-[15px] font-semibold text-slate-900">{title}</h2>
            {subtitle && <p className="mt-0.5 text-[13px] text-slate-500">{subtitle}</p>}
          </div>
          {action && <div className="shrink-0">{action}</div>}
        </header>
      )}
      <div className={pad ? "p-5" : ""}>{children}</div>
    </section>
  );
}

export function Button({ children, onClick, variant = "primary", disabled, type = "button", className = "", size = "md" }: {
  children: ReactNode;
  onClick?: () => void;
  variant?: "primary" | "secondary" | "ghost" | "dark";
  disabled?: boolean;
  type?: "button" | "submit";
  className?: string;
  size?: "sm" | "md";
}) {
  const styles = {
    primary: "bg-amber-500 text-slate-950 hover:bg-amber-400",
    secondary: "border border-slate-200 bg-white text-slate-700 hover:bg-slate-50",
    ghost: "text-slate-600 hover:bg-slate-100 hover:text-slate-900",
    dark: "bg-slate-900 text-white hover:bg-slate-800",
  }[variant];
  const sz = size === "sm" ? "px-2.5 py-1.5 text-[13px]" : "px-3.5 py-2 text-sm";
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={`inline-flex items-center justify-center gap-1.5 rounded-xl font-medium transition disabled:cursor-not-allowed disabled:opacity-50 ${sz} ${styles} ${className}`}
    >
      {children}
    </button>
  );
}

export function Toggle({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onChange(!checked)}
      className={`relative h-6 w-11 shrink-0 rounded-full transition ${checked ? "bg-amber-500" : "bg-slate-300"}`}
    >
      <span className={`absolute top-0.5 left-0.5 h-5 w-5 rounded-full bg-white shadow transition ${checked ? "translate-x-5" : ""}`} />
    </button>
  );
}

export function Badge({ children, tone = "slate" }: { children: ReactNode; tone?: "slate" | "green" | "amber" | "red" | "blue" }) {
  const t = {
    slate: "bg-slate-100 text-slate-600",
    green: "bg-emerald-50 text-emerald-700",
    amber: "bg-amber-50 text-amber-800",
    red: "bg-red-50 text-red-700",
    blue: "bg-sky-50 text-sky-700",
  }[tone];
  return <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium whitespace-nowrap ${t}`}>{children}</span>;
}

export function Spinner() {
  return <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" aria-hidden />;
}

export function NumberField({ label, value, onChange, step = 1, min = 0, suffix }: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  step?: number;
  min?: number;
  suffix?: string;
}) {
  return (
    <label className="block text-sm">
      <span className="mb-1.5 block text-[13px] font-medium text-slate-600">{label}</span>
      <div className="flex items-center rounded-xl border border-slate-200 bg-white focus-within:border-amber-400 focus-within:ring-2 focus-within:ring-amber-100">
        <input
          type="number"
          inputMode="decimal"
          value={Number.isFinite(value) ? value : ""}
          step={step}
          min={min}
          onChange={(e) => onChange(Number(e.target.value))}
          className="w-full min-w-0 rounded-xl bg-transparent px-3 py-2 outline-none"
        />
        {suffix && <span className="pr-3 text-slate-400">{suffix}</span>}
      </div>
    </label>
  );
}

/** KPI tile: label, one big value, one line of context. */
export function StatTile({ label, value, unit, hint, icon, tone = "slate" }: {
  label: string;
  value: ReactNode;
  unit?: string;
  hint?: ReactNode;
  icon?: ReactNode;
  tone?: "slate" | "red" | "amber" | "green";
}) {
  const ring = {
    slate: "bg-slate-100 text-slate-600",
    red: "bg-red-50 text-red-600",
    amber: "bg-amber-50 text-amber-600",
    green: "bg-emerald-50 text-emerald-600",
  }[tone];
  return (
    <div className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
      <div className="flex items-center justify-between gap-2">
        <span className="text-[13px] font-medium text-slate-500">{label}</span>
        {icon && <span className={`flex h-8 w-8 items-center justify-center rounded-lg ${ring}`}>{icon}</span>}
      </div>
      <div className="mt-2 text-2xl font-semibold tracking-tight text-slate-900 tabular-nums">
        {value}
        {unit && <span className="ml-1 text-sm font-medium text-slate-400">{unit}</span>}
      </div>
      {hint && <div className="mt-1 text-[13px] text-slate-500">{hint}</div>}
    </div>
  );
}
