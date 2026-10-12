import { generateJson, errorResponse } from "@/lib/gemini";
import { parseHHMM } from "@/lib/time";
import type { Window } from "@/lib/types";

const SCHEMA = {
  type: "object",
  properties: {
    windows: {
      type: "array",
      description: "Recurring daily load-shedding windows",
      items: {
        type: "object",
        properties: {
          start: { type: "string", description: "24h HH:MM" },
          end: { type: "string", description: "24h HH:MM; 00:00 for midnight" },
        },
        required: ["start", "end"],
      },
    },
    oneOff: {
      type: "array",
      description: "One-time shutdowns (maintenance) with a date",
      items: {
        type: "object",
        properties: {
          date: { type: "string" },
          start: { type: "string" },
          end: { type: "string" },
        },
        required: ["date", "start", "end"],
      },
    },
    area: { type: ["string", "null"], description: "Feeder / area / DISCO if mentioned" },
    summary: { type: "string", description: "One-line plain summary of the schedule" },
  },
  required: ["windows", "oneOff", "area", "summary"],
};

const SYSTEM = `You extract load-shedding schedules from Pakistani utility messages (LESCO, K-Electric, IESCO,
FESCO, MEPCO, PESCO, GEPCO, HESCO, QESCO), tweets, WhatsApp forwards, or users' own words in English, Urdu,
or Roman Urdu ("raat 10 se 12 bijli nahi hogi"). Convert all times to 24h HH:MM. "Raat" = night, "subah" = morning,
"dopahar" = afternoon, "shaam" = evening. Recurring daily load management goes in "windows";
dated maintenance shutdowns go in "oneOff". Never invent times that aren't stated.`;

export async function POST(req: Request) {
  try {
    const { text } = (await req.json()) as { text?: string };
    if (!text?.trim()) return Response.json({ error: "text required" }, { status: 400 });
    const out = await generateJson<{
      windows: { start: string; end: string }[];
      oneOff: { date: string; start: string; end: string }[];
      area: string | null;
      summary: string;
    }>({ system: SYSTEM, schema: SCHEMA, parts: [{ text }] });

    const windows: Window[] = out.windows
      .map((w) => ({ start: parseHHMM(w.start), end: parseHHMM(w.end) }))
      .filter((w): w is Window => w.start !== null && w.end !== null && w.start !== w.end)
      .map((w) => ({ start: w.start % 24, end: w.end % 24 }));

    return Response.json({ windows, oneOff: out.oneOff, area: out.area, summary: out.summary });
  } catch (e) {
    return errorResponse(e);
  }
}
