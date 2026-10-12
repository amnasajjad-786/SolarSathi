"use client";

import { useRef, useState } from "react";
import { Button, Spinner } from "./ui";
import type { ScreenReading } from "@/app/api/read-screen/route";

/** Upload a photo/screenshot of the inverter app → Gemini reads battery %, solar, load, grid status. */
export function ScreenshotUpload({ onReading, lang }: { onReading: (r: ScreenReading) => void; lang: "en" | "ur" }) {
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [preview, setPreview] = useState<string | null>(null);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  async function send(dataUrl: string) {
    setPreview(dataUrl);
    setBusy(true);
    setMsg(null);
    try {
      const r = await fetch("/api/read-screen", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ image: dataUrl, mimeType: "image/jpeg" }),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j.message || "Could not read screenshot");
      const reading = j as ScreenReading;
      onReading(reading);
      const bits = [
        reading.batteryPct !== null && `🔋 ${reading.batteryPct}%`,
        reading.pvPowerW !== null && `☀️ ${reading.pvPowerW} W`,
        reading.loadPowerW !== null && `🏠 ${reading.loadPowerW} W`,
        reading.gridStatus !== "unknown" && `⚡ grid ${reading.gridStatus}`,
      ].filter(Boolean);
      setMsg({ ok: reading.batteryPct !== null, text: `${bits.join("  ·  ") || "No values found"} — ${reading.notes}` });
    } catch (e) {
      setMsg({
        ok: false,
        text: (lang === "ur" ? "Screenshot nahi parh saka. Battery % khud likh dein. " : "Couldn't read it — type your battery % instead. ") + (e as Error).message,
      });
    } finally {
      setBusy(false);
    }
  }

  async function onFile(f: File | undefined) {
    if (!f) return;
    send(await downscale(f));
  }

  return (
    <div>
      <div className="flex flex-wrap gap-2">
        <Button onClick={() => input.current?.click()} disabled={busy}>
          {busy ? <Spinner /> : "📷"} {lang === "ur" ? "Inverter screenshot se parhein" : "Read from inverter screenshot"}
        </Button>
        <Button variant="ghost" onClick={() => send(sampleScreenshot())} disabled={busy}>
          {lang === "ur" ? "Sample try karein" : "Try a sample"}
        </Button>
      </div>
      <input ref={input} type="file" accept="image/*" className="hidden" onChange={(e) => onFile(e.target.files?.[0])} />
      {(preview || msg) && (
        <div className="mt-3 flex items-start gap-3">
          {preview && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={preview} alt="Inverter screenshot" className="h-20 w-auto rounded-lg border border-stone-200 object-cover" />
          )}
          {msg && <p className={`text-sm ${msg.ok ? "text-emerald-700" : "text-red-600"}`}>{msg.text}</p>}
        </div>
      )}
    </div>
  );
}

async function downscale(file: File, max = 1280): Promise<string> {
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((res, rej) => {
      const i = new Image();
      i.onload = () => res(i);
      i.onerror = rej;
      i.src = url;
    });
    const s = Math.min(1, max / Math.max(img.width, img.height));
    const c = document.createElement("canvas");
    c.width = Math.round(img.width * s);
    c.height = Math.round(img.height * s);
    c.getContext("2d")!.drawImage(img, 0, 0, c.width, c.height);
    return c.toDataURL("image/jpeg", 0.85);
  } finally {
    URL.revokeObjectURL(url);
  }
}

/** Draws a generic inverter-app screen so the AI reader can be demoed without a real screenshot. */
function sampleScreenshot(): string {
  const c = document.createElement("canvas");
  c.width = 540;
  c.height = 960;
  const g = c.getContext("2d")!;
  g.fillStyle = "#0f172a";
  g.fillRect(0, 0, 540, 960);
  g.fillStyle = "#e2e8f0";
  g.font = "bold 30px sans-serif";
  g.fillText("SmartESS  ·  My Plant", 32, 70);
  g.font = "20px sans-serif";
  g.fillStyle = "#94a3b8";
  g.fillText("Hybrid Inverter 6.2KW  ·  Online", 32, 108);
  const tile = (x: number, y: number, label: string, value: string, color: string) => {
    g.fillStyle = "#1e293b";
    g.beginPath();
    g.roundRect(x, y, 220, 170, 22);
    g.fill();
    g.fillStyle = "#94a3b8";
    g.font = "22px sans-serif";
    g.fillText(label, x + 22, y + 46);
    g.fillStyle = color;
    g.font = "bold 46px sans-serif";
    g.fillText(value, x + 22, y + 120);
  };
  tile(32, 160, "PV Power", "0 W", "#fbbf24");
  tile(288, 160, "Battery SOC", "58%", "#34d399");
  tile(32, 360, "Load", "1.84 kW", "#60a5fa");
  tile(288, 360, "Grid", "0 V", "#f87171");
  g.fillStyle = "#94a3b8";
  g.font = "22px sans-serif";
  g.fillText("Battery: 51.2V 100Ah  LiFePO4  ·  Discharging", 32, 590);
  g.fillText("Utility: Disconnected", 32, 630);
  g.fillText("Today PV: 21.4 kWh", 32, 670);
  return c.toDataURL("image/jpeg", 0.9);
}
