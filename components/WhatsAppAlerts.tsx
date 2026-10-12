"use client";

import { useEffect, useState } from "react";
import { Badge, Button, Spinner, Toggle } from "./ui";
import type { Alert } from "@/lib/alerts";
import type { Lang, Profile } from "@/lib/types";

const SENT_STORE = "solarsaathi.wa.sent";

export async function sendWhatsApp(phone: string, text: string) {
  const r = await fetch("/api/whatsapp", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ phone, text }),
  });
  const j = await r.json();
  if (!r.ok) throw new Error(j.message || "Send failed");
}

export function alertMessage(a: Alert, city: string) {
  return `⚠️ SolarSaathi (${city})\n${a.title}\n${a.detail}\n\nOpen SolarSaathi for your plan.`;
}

/** Auto-send each critical alert to WhatsApp at most once per day. */
export function useWhatsAppAutoSend(profile: Profile | null, alerts: Alert[], date: string) {
  useEffect(() => {
    const wa = profile?.whatsapp;
    if (!wa?.auto || !wa.phone) return;
    let sent: string[] = [];
    try {
      sent = JSON.parse(localStorage.getItem(SENT_STORE) || "[]");
    } catch {}
    const todo = alerts.filter((a) => a.level === "critical" && !sent.includes(`${date}:${a.id}`));
    if (!todo.length) return;
    const next = [...sent.filter((s) => s.startsWith(date)), ...todo.map((a) => `${date}:${a.id}`)];
    try {
      localStorage.setItem(SENT_STORE, JSON.stringify(next));
    } catch {}
    sendWhatsApp(wa.phone, todo.map((a) => alertMessage(a, profile!.city)).join("\n\n")).catch(() => {});
  }, [profile, alerts, date]);
}

/** Users only enter their number; the server sends from SolarSaathi's WhatsApp Business number. */
export function WhatsAppCard({ profile, onChange, alerts, lang }: {
  profile: Profile;
  onChange: (p: Partial<Profile>) => void;
  alerts: Alert[];
  lang: Lang;
}) {
  const ur = lang === "ur";
  const wa = profile.whatsapp;
  const [phone, setPhone] = useState(wa?.phone ?? "");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [configured, setConfigured] = useState<boolean | null>(null);

  useEffect(() => {
    fetch("/api/whatsapp")
      .then((r) => r.json())
      .then((j) => setConfigured(Boolean(j.configured)))
      .catch(() => setConfigured(false));
  }, []);

  async function saveAndTest() {
    const number = phone.trim();
    setBusy(true);
    setMsg(null);
    try {
      const top = alerts.find((a) => a.level === "critical");
      await sendWhatsApp(
        number,
        top ? alertMessage(top, profile.city) : `✅ SolarSaathi (${profile.city}): WhatsApp alerts are on. We'll message you when your battery is at risk.`,
      );
      onChange({ whatsapp: { phone: number, auto: true } });
      setMsg({ ok: true, text: ur ? "Message bhej diya — WhatsApp check karein." : "Sent — check your WhatsApp." });
    } catch (e) {
      setMsg({ ok: false, text: (e as Error).message });
    } finally {
      setBusy(false);
    }
  }

  if (configured === false) {
    return (
      <p className="text-sm text-slate-500">
        {ur ? "WhatsApp alerts jald aa rahe hain." : "WhatsApp alerts are coming soon."}
      </p>
    );
  }

  return (
    <div>
      <label className="text-[13px] font-medium text-slate-600">
        {ur ? "Apna WhatsApp number" : "Your WhatsApp number"}
        <div className="mt-1.5 flex gap-2">
          <input
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="0300 1234567"
            inputMode="tel"
            autoComplete="tel"
            className="min-w-0 flex-1 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-amber-400 focus:ring-2 focus:ring-amber-100"
          />
          <Button onClick={saveAndTest} disabled={busy || phone.trim().length < 10 || configured === null}>
            {busy ? <Spinner /> : "💬"} {wa?.phone ? (ur ? "Update" : "Update") : ur ? "Alerts ON karein" : "Turn on alerts"}
          </Button>
        </div>
      </label>
      <p className="mt-2 text-xs text-slate-500">
        {ur
          ? "Hum aap ko ek test message bhejein ge. Sirf zaroori (critical) alerts, din mein ek dafa."
          : "We'll send a test message now. Only critical alerts, at most once a day each."}
      </p>
      {wa?.phone && (
        <label className="mt-3 flex items-center gap-2 text-[13px] text-slate-700">
          <Toggle checked={wa.auto} onChange={(v) => onChange({ whatsapp: { ...wa, auto: v } })} label="Auto alerts" />
          {ur ? "Critical alerts khud bhejein" : "Auto-send critical alerts"}
          {wa.auto && <Badge tone="green">{wa.phone}</Badge>}
        </label>
      )}
      {msg && <p className={`mt-2 text-[13px] ${msg.ok ? "text-emerald-700" : "text-red-600"}`}>{msg.text}</p>}
    </div>
  );
}
