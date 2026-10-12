import { generateJson, errorResponse } from "@/lib/gemini";

export interface PlanRequest {
  lang: "en" | "ur";
  facts: Record<string, unknown>; // computed by the simulation engine on the client
}

export interface AiPlan {
  headline: string;
  steps: { title: string; detail: string; impact: string }[];
  tip: string;
}

const SCHEMA = {
  type: "object",
  properties: {
    headline: { type: "string", description: "One sentence: will the battery last, and what changes with the plan" },
    steps: {
      type: "array",
      items: {
        type: "object",
        properties: {
          title: { type: "string", description: "Short imperative, max 8 words" },
          detail: { type: "string", description: "One or two plain sentences: when and why" },
          impact: { type: "string", description: "The measured gain from the facts, e.g. '+2h 6m backup'" },
        },
        required: ["title", "detail", "impact"],
      },
    },
    tip: { type: "string", description: "One extra practical tip based on tomorrow's weather and heat" },
  },
  required: ["headline", "steps", "tip"],
};

const SYSTEM = `You are SolarSaathi, an energy coach for Pakistani homes with solar + battery.
You receive FACTS computed by a physics simulation (battery state, forecast, load-shedding windows,
and a list of optimizer ACTIONS each with its measured gain). Write the household's plan for tonight and tomorrow.
Rules:
- One step per action, same order. Use ONLY numbers present in the facts; never invent savings.
- Be concrete about times (e.g. "tomorrow 12 PM") and appliances. Warm, direct, no jargon.
- If tomorrow is cloudy (low solar kWh / high cloud %), warn that the battery won't refill fully and to be careful tonight.
- The tip may mention filling the water tank during sun hours, pre-cooling rooms before an outage, or keeping
  fridge doors shut — whichever fits the facts.
- Language: if lang is "ur", write in simple Roman Urdu (Urdu in Latin script, as used on WhatsApp), keeping
  appliance names and times in English. Otherwise plain English.`;

export async function POST(req: Request) {
  try {
    const { lang, facts } = (await req.json()) as PlanRequest;
    const plan = await generateJson<AiPlan>({
      system: SYSTEM,
      schema: SCHEMA,
      temperature: 0.5,
      parts: [{ text: `lang: ${lang}\nFACTS:\n${JSON.stringify(facts, null, 1)}` }],
    });
    return Response.json(plan);
  } catch (e) {
    return errorResponse(e);
  }
}
