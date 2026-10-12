"use client";

import { useEffect, useState } from "react";
import { Badge, Button, Spinner, Toggle } from "./ui";
import type { Alert } from "@/lib/alerts";
import type { Lang, Profile } from "@/lib/types";

const SENT_STORE = "solarsaathi.wa.sent";

export async function sendWhatsApp(wa: NonNullable<Profile["whatsapp"]>, text: string) {
  const r = await fetch("/api/whatsapp", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ phone: wa.phone, apikey: wa.apikey, text }),
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
    if (!wa?.auto || !wa.phone || !wa.apikey) return;
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
    sendWhatsApp(wa, todo.map((a) => alertMessage(a, profile!.city)).join("\n\n")).catch(() => {});
  }, [profile, alerts, date]);
}

export function WhatsAppCard({ profile, onChange, alerts, lang }: {
  profile: Profile;
  onChange: (p: Partial<Profile>) => void;
  alerts: Alert[];
  lang: Lang;
}) {
  const ur = lang === "ur";
  const wa = profile.whatsapp ?? { phone: "", apikey: "", auto: false };
  const [phone, setPhone] = useState(wa.phone);
  const [apikey, setApikey] = useState(wa.apikey);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const linked = Boolean(wa.phone && wa.apikey);
  const input = "w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-amber-400 focus:ring-2 focus:ring-amber-100";

  async function saveAndTest() {
    const next = { phone: phone.trim(), apikey: apikey.trim(), auto: true };
    onChange({ whatsapp: next });
    setBusy(true);
    setMsg(null);
    try {
      const top = alerts.find((a) => a.level === "critical");
      await sendWhatsApp(
        next,
        top ? alertMessage(top, profile.city) : `✅ SolarSaathi (${profile.city}): WhatsApp alerts are on. We'll message you when your battery is at risk.`,
      );
      setMsg({ ok: true, text: ur ? "Test message bhej diya — WhatsApp check karein." : "Test message sent — check WhatsApp." });
    } catch (e) {
      setMsg({ ok: false, text: (e as Error).message });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      {!linked && (
        <ol className="mb-4 space-y-1.5 rounded-xl bg-emerald-50/60 p-3.5 text-[13px] text-slate-700">
          <li>
            1. {ur ? "CallMeBot ka number apne contacts mein save karein (link par diya hai)." : "Save the CallMeBot number in your contacts (shown on their page)."}{" "}
            <a className="font-medium text-emerald-700 underline" href="https://www.callmebot.com/blog/free-api-whatsapp-messages/" target="_blank" rel="noreferrer">
              callmebot.com
            </a>
          </li>
          <li>2. {ur ? "Us number ko WhatsApp karein:" : "Send it this WhatsApp message:"} <code className="rounded bg-white px-1">I allow callmebot to send me messages</code></li>
          <li>3. {ur ? "Jo API key milay woh neeche likhein." : "Paste the API key you receive below."}</li>
        </ol>
      )}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <label className="text-[13px] font-medium text-slate-600">
          {ur ? "WhatsApp number" : "WhatsApp number"}
          <input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+92 300 1234567" inputMode="tel" className={`mt-1.5 ${input}`} />
        </label>
        <label className="text-[13px] font-medium text-slate-600">
          CallMeBot API key
          <input value={apikey} onChange={(e) => setApikey(e.target.value)} placeholder="123456" className={`mt-1.5 ${input}`} />
        </label>
      </div>
      <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
        <Button onClick={saveAndTest} disabled={busy || !phone.trim() || !apikey.trim()}>
          {busy ? <Spinner /> : "💬"} {ur ? "Save aur test bhejein" : "Save & send test"}
        </Button>
        {linked && (
          <label className="flex items-center gap-2 text-[13px] text-slate-700">
            <Toggle checked={wa.auto} onChange={(v) => onChange({ whatsapp: { ...wa, auto: v } })} label="Auto alerts" />
            {ur ? "Critical alerts khud bhejein" : "Auto-send critical alerts"}
            {wa.auto && <Badge tone="green">{ur ? "On" : "On"}</Badge>}
          </label>
        )}
      </div>
      {msg && <p className={`mt-2 text-[13px] ${msg.ok ? "text-emerald-700" : "text-red-600"}`}>{msg.text}</p>}
    </div>
  );
}
