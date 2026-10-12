import { generateJson, errorResponse } from "@/lib/gemini";

export interface ScreenReading {
  batteryPct: number | null;
  pvPowerW: number | null;
  loadPowerW: number | null;
  gridStatus: "on" | "off" | "unknown";
  batteryCapacityKwh: number | null;
  brand: string | null;
  confidence: "high" | "medium" | "low";
  notes: string;
}

const SCHEMA = {
  type: "object",
  properties: {
    batteryPct: { type: ["number", "null"], description: "Battery state of charge, 0-100" },
    pvPowerW: { type: ["number", "null"], description: "Current solar/PV input power in watts" },
    loadPowerW: { type: ["number", "null"], description: "Current home load / consumption in watts" },
    gridStatus: { type: "string", enum: ["on", "off", "unknown"] },
    batteryCapacityKwh: { type: ["number", "null"], description: "Battery capacity if shown (convert Ah×V to kWh)" },
    brand: { type: ["string", "null"], description: "Inverter or app brand if visible" },
    confidence: { type: "string", enum: ["high", "medium", "low"] },
    notes: { type: "string", description: "One short sentence on what was read or what was unclear" },
  },
  required: ["batteryPct", "pvPowerW", "loadPowerW", "gridStatus", "batteryCapacityKwh", "brand", "confidence", "notes"],
};

const SYSTEM = `You read screenshots of solar inverter apps and inverter LCD screens used in Pakistan
(Inverex, Growatt/ShinePhone, Solis, Knox, Fronus, Itel, Crown, SolarMan, SmartESS, WatchPower, Deye, etc.).
Extract the live readings. Convert kW to W. If a value is not visible, return null — never guess.
"Grid", "Utility", "AC input" or "WAPDA" at 0 V / 0 W / disconnected means gridStatus "off".`;

export async function POST(req: Request) {
  try {
    const { image, mimeType } = (await req.json()) as { image?: string; mimeType?: string };
    if (!image) return Response.json({ error: "image required" }, { status: 400 });
    const data = image.replace(/^data:[^;]+;base64,/, "");
    const reading = await generateJson<ScreenReading>({
      system: SYSTEM,
      schema: SCHEMA,
      parts: [
        { inlineData: { mimeType: mimeType || "image/png", data } },
        { text: "Read the live values from this inverter screen." },
      ],
    });
    return Response.json(reading);
  } catch (e) {
    return errorResponse(e);
  }
}
