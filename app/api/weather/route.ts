import type { HourWeather } from "@/lib/types";

// Open-Meteo: free, no API key. Hourly solar radiation, cloud cover and temperature in Pakistan time.
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const lat = Number(searchParams.get("lat"));
  const lon = Number(searchParams.get("lon"));
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
    return Response.json({ error: "lat/lon required" }, { status: 400 });
  }

  const url =
    `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}` +
    `&hourly=shortwave_radiation,cloud_cover,temperature_2m&timezone=Asia%2FKarachi&forecast_days=3`;

  try {
    const r = await fetch(url, { next: { revalidate: 1800 } });
    if (!r.ok) throw new Error(`Open-Meteo ${r.status}`);
    const j = await r.json();
    const h = j.hourly;
    const hours: HourWeather[] = h.time.map((time: string, i: number) => ({
      time,
      radiation: h.shortwave_radiation[i] ?? 0,
      cloud: h.cloud_cover[i] ?? 0,
      temp: h.temperature_2m[i] ?? 0,
    }));
    return Response.json({ source: "open-meteo", hours });
  } catch (e) {
    console.error(e);
    return Response.json({ error: "weather_unavailable" }, { status: 502 });
  }
}
