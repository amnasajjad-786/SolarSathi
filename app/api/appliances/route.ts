import { generateJson, errorResponse } from "@/lib/gemini";
import { parseHHMM } from "@/lib/time";

const SCHEMA = {
  type: "object",
  properties: {
    appliances: {
      type: "array",
      items: {
        type: "object",
        properties: {
          name: { type: "string" },
          watts: { type: "number", description: "Typical running watts per unit" },
          qty: { type: "integer" },
          start: { type: "string", description: "Usual daily start, 24h HH:MM" },
          end: { type: "string", description: "Usual daily end, 24h HH:MM; same as start if it runs all day" },
          essential: { type: "boolean" },
          shiftable: { type: "boolean" },
        },
        required: ["name", "watts", "qty", "start", "end", "essential", "shiftable"],
      },
    },
  },
  required: ["appliances"],
};

const SYSTEM = `You turn a Pakistani household's description of its appliances (English, Urdu or Roman Urdu)
into a load list. Use realistic running watts for appliances sold in Pakistan:
inverter AC 1.5 ton ≈ 1200-1400 W (non-inverter ≈ 1800-2000 W), 1 ton ≈ 900 W, ceiling fan 75-90 W (DC fan 30-35 W),
LED bulb 12 W, tube light 20 W, fridge ≈ 150 W average, deep freezer ≈ 200 W, LED TV 80-120 W,
water pump/motor 0.5 HP 375 W, 1 HP 750 W, washing machine 400-500 W, iron 1000 W, microwave 1200 W,
electric geyser 2000 W, room cooler 150-200 W, laptop 60 W, WiFi router 12 W, UPS-backed PC 250 W.
Use the user's stated timings, otherwise typical Pakistani usage (e.g. AC at night 22:00-03:00).
essential = fridge, lights, fans, router, medical devices. shiftable = can be run at any time of day
(water pump, washing machine, iron, dishwasher, EV/bike charging) — never the AC, fridge, lights or fans.`;

export async function POST(req: Request) {
  try {
    const { text } = (await req.json()) as { text?: string };
    if (!text?.trim()) return Response.json({ error: "text required" }, { status: 400 });
    const out = await generateJson<{
      appliances: { name: string; watts: number; qty: number; start: string; end: string; essential: boolean; shiftable: boolean }[];
    }>({ system: SYSTEM, schema: SCHEMA, parts: [{ text }] });

    const appliances = out.appliances.map((a) => ({
      name: a.name,
      watts: Math.max(1, Math.round(a.watts)),
      qty: Math.max(1, Math.round(a.qty)),
      start: (parseHHMM(a.start) ?? 0) % 24,
      end: (parseHHMM(a.end) ?? 0) % 24,
      essential: a.essential,
      shiftable: a.shiftable,
    }));
    return Response.json({ appliances });
  } catch (e) {
    return errorResponse(e);
  }
}
