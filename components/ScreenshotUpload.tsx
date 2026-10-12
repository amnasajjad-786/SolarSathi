"use client";

import { useEffect, useRef, useState } from "react";
import { Button, Spinner } from "./ui";
import { IconCamera, IconSparkles, IconUpload } from "./icons";
import type { ScreenReading } from "@/app/api/read-screen/route";
import type { Lang } from "@/lib/types";

/**
 * Upload / drop / paste / photograph the inverter app screen → Gemini vision reads
 * battery %, solar, load and grid status, and the reading is applied to the profile.
 */
export function ScreenshotUpload({ onReading, lang, compact = false }: {
  onReading: (r: ScreenReading) => void;
  lang: Lang;
  compact?: boolean;
}) {
  const fileInput = useRef<HTMLInputElement>(null);
  const cameraInput = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [drag, setDrag] = useState(false);
  const [preview, setPreview] = useState<string | null>(null);
  const [reading, setReading] = useState<ScreenReading | null>(null);
  const [error, setError] = useState<string | null>(null);
  const ur = lang === "ur";

  async function send(dataUrl: string) {
    setPreview(dataUrl);
    setBusy(true);
    setError(null);
    setReading(null);
    try {
      const r = await fetch("/api/read-screen", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ image: dataUrl, mimeType: "image/jpeg" }),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j.message || "Could not read screenshot");
      setReading(j);
      onReading(j);
    } catch (e) {
      setError((ur ? "Screenshot nahi parh saka — battery % khud set karein. " : "Couldn't read that image — set the battery % manually. ") + (e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function onFile(f: File | undefined | null) {
    if (!f || !f.type.startsWith("image/")) return;
    send(await downscale(f));
  }

  // Ctrl+V a screenshot anywhere on the page.
  useEffect(() => {
    const onPaste = (e: ClipboardEvent) => {
      const item = Array.from(e.clipboardData?.items ?? []).find((i) => i.type.startsWith("image/"));
      if (item) {
        e.preventDefault();
        onFile(item.getAsFile());
      }
    };
    window.addEventListener("paste", onPaste);
    return () => window.removeEventListener("paste", onPaste);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div>
      <div
        role="button"
        tabIndex={0}
        onClick={() => !busy && fileInput.current?.click()}
        onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && fileInput.current?.click()}
        onDragOver={(e) => {
          e.preventDefault();
          setDrag(true);
        }}
        onDragLeave={() => setDrag(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDrag(false);
          onFile(e.dataTransfer.files?.[0]);
        }}
        className={`flex cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed text-center transition ${
          compact ? "px-4 py-6" : "px-6 py-10"
        } ${drag ? "border-amber-400 bg-amber-50" : "border-slate-200 bg-slate-50/60 hover:border-amber-300 hover:bg-amber-50/40"}`}
      >
        {busy ? (
          <>
            <span className="text-amber-600">
              <Spinner />
            </span>
            <p className="mt-3 text-sm font-medium text-slate-700">{ur ? "AI screenshot parh raha hai…" : "AI is reading your screenshot…"}</p>
          </>
        ) : (
          <>
            <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white text-amber-600 shadow-sm ring-1 ring-slate-200">
              <IconUpload size={22} />
            </span>
            <p className="mt-3 text-sm font-semibold text-slate-800">
              {ur ? "Inverter app ka screenshot yahan dalein" : "Drop your inverter app screenshot here"}
            </p>
            <p className="mt-1 text-[13px] text-slate-500">
              {ur ? "Click karein, drag karein, ya Ctrl+V se paste karein" : "Click to browse, drag & drop, or paste with Ctrl+V"}
            </p>
            <p className="mt-2 text-xs text-slate-400">Inverex · Growatt · SmartESS · Solis · Knox · Deye · SolarMan…</p>
          </>
        )}
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        <Button variant="secondary" size="sm" onClick={() => cameraInput.current?.click()} disabled={busy}>
          <IconCamera size={16} /> {ur ? "Inverter screen ki photo" : "Take a photo of the inverter"}
        </Button>
        <Button variant="ghost" size="sm" onClick={() => send(sampleScreenshot())} disabled={busy}>
          <IconSparkles size={16} /> {ur ? "Sample try karein" : "Try a sample screenshot"}
        </Button>
      </div>

      <input ref={fileInput} type="file" accept="image/*" className="hidden" onChange={(e) => onFile(e.target.files?.[0])} />
      <input ref={cameraInput} type="file" accept="image/*" capture="environment" className="hidden" onChange={(e) => onFile(e.target.files?.[0])} />

      {(reading || error) && (
        <div className="mt-4 flex gap-4 rounded-2xl border border-slate-200 bg-white p-4">
          {preview && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={preview} alt="Uploaded inverter screenshot" className="h-28 w-20 shrink-0 rounded-lg border border-slate-200 object-cover" />
          )}
          <div className="min-w-0 flex-1">
            {error ? (
              <p className="text-sm text-red-600">{error}</p>
            ) : (
              reading && (
                <>
                  <p className="flex items-center gap-1.5 text-[13px] font-semibold text-emerald-700">
                    <IconSparkles size={15} /> {ur ? "AI ne yeh parha (battery update ho gayi)" : "AI read these values (battery updated)"}
                  </p>
                  <dl className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1.5 text-sm sm:grid-cols-4">
                    <Reading label={ur ? "Battery" : "Battery"} value={reading.batteryPct !== null ? `${reading.batteryPct}%` : "—"} />
                    <Reading label="Solar" value={reading.pvPowerW !== null ? `${reading.pvPowerW} W` : "—"} />
                    <Reading label={ur ? "Load" : "Load"} value={reading.loadPowerW !== null ? `${reading.loadPowerW} W` : "—"} />
                    <Reading label="Grid" value={reading.gridStatus === "unknown" ? "—" : reading.gridStatus === "on" ? "On" : "Off"} />
                  </dl>
                  <p className="mt-2 text-[13px] text-slate-500">
                    {reading.brand ? `${reading.brand} · ` : ""}
                    {reading.notes}
                  </p>
                </>
              )
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function Reading({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs text-slate-500">{label}</dt>
      <dd className="font-semibold text-slate-900 tabular-nums">{value}</dd>
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
