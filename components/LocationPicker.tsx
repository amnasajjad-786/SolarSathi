"use client";

import { useState } from "react";
import { Button, Spinner } from "./ui";
import type { Lang, Profile } from "@/lib/types";

interface Place {
  name: string;
  admin1?: string;
  latitude: number;
  longitude: number;
}

/** Search any town (Open-Meteo geocoding, free, no key) or use the device's GPS. */
export function LocationPicker({ profile, onChange, lang }: { profile: Profile; onChange: (p: Partial<Profile>) => void; lang: Lang }) {
  const [q, setQ] = useState("");
  const [results, setResults] = useState<Place[]>([]);
  const [busy, setBusy] = useState<"search" | "gps" | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const ur = lang === "ur";

  async function search() {
    if (q.trim().length < 2) return;
    setBusy("search");
    setErr(null);
    try {
      const r = await fetch(`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(q.trim())}&count=6&countryCode=PK&language=en`);
      const j = await r.json();
      const list: Place[] = j.results ?? [];
      setResults(list);
      if (!list.length) setErr(ur ? "Koi jagah nahi mili." : "No places found — try a nearby city.");
    } catch {
      setErr(ur ? "Search nahi ho saki." : "Search failed — check your connection.");
    } finally {
      setBusy(null);
    }
  }

  function useGps() {
    if (!navigator.geolocation) {
      setErr(ur ? "GPS available nahi." : "Location isn't available on this device.");
      return;
    }
    setBusy("gps");
    setErr(null);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        onChange({ city: ur ? "Meri location" : "My location", lat: +pos.coords.latitude.toFixed(4), lon: +pos.coords.longitude.toFixed(4) });
        setBusy(null);
      },
      () => {
        setErr(ur ? "Location ki ijazat nahi mili." : "Location permission was denied.");
        setBusy(null);
      },
      { timeout: 15000 },
    );
  }

  return (
    <div>
      <span className="mb-1.5 block text-[13px] font-medium text-slate-600">{ur ? "Location" : "Location"}</span>
      <div className="mb-2 flex items-center justify-between gap-2 rounded-xl bg-slate-50 px-3 py-2 text-sm">
        <span className="min-w-0 truncate font-medium text-slate-800">📍 {profile.city}</span>
        <span className="shrink-0 text-xs text-slate-500 tabular-nums">
          {profile.lat.toFixed(2)}, {profile.lon.toFixed(2)}
        </span>
      </div>
      <form
        className="flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          search();
        }}
      >
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder={ur ? "Shehar ya town likhein…" : "Search any city or town…"}
          className="min-w-0 flex-1 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-amber-400 focus:ring-2 focus:ring-amber-100"
        />
        <Button type="submit" variant="secondary" disabled={busy !== null}>
          {busy === "search" ? <Spinner /> : ur ? "Talash" : "Search"}
        </Button>
      </form>
      {results.length > 0 && (
        <ul className="mt-2 divide-y divide-slate-100 overflow-hidden rounded-xl border border-slate-200">
          {results.map((r, i) => (
            <li key={i}>
              <button
                className="flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-sm hover:bg-amber-50"
                onClick={() => {
                  onChange({ city: r.name, lat: +r.latitude.toFixed(4), lon: +r.longitude.toFixed(4) });
                  setResults([]);
                  setQ("");
                }}
              >
                <span className="font-medium text-slate-800">{r.name}</span>
                <span className="text-xs text-slate-500">{r.admin1}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
      <Button variant="ghost" size="sm" className="mt-2" onClick={useGps} disabled={busy !== null}>
        {busy === "gps" ? <Spinner /> : "🎯"} {ur ? "Meri mojooda location" : "Use my current location"}
      </Button>
      {err && <p className="mt-1 text-[13px] text-red-600">{err}</p>}
    </div>
  );
}
