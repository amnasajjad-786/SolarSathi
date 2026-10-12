import { GoogleGenAI, type Part } from "@google/genai";

const MODEL = process.env.GEMINI_MODEL || "gemini-2.5-flash";

let client: GoogleGenAI | null = null;

export function hasGeminiKey(): boolean {
  return Boolean(process.env.GEMINI_API_KEY);
}

function ai(): GoogleGenAI {
  if (!process.env.GEMINI_API_KEY) throw new NoKeyError();
  client ??= new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
  return client;
}

export class NoKeyError extends Error {
  constructor() {
    super("GEMINI_API_KEY is not set");
  }
}

/** One structured Gemini call: text and/or image parts in, JSON matching `schema` out. */
export async function generateJson<T>(opts: {
  system: string;
  parts: Part[];
  schema: object;
  temperature?: number;
}): Promise<T> {
  const res = await ai().models.generateContent({
    model: MODEL,
    contents: [{ role: "user", parts: opts.parts }],
    config: {
      systemInstruction: opts.system,
      responseMimeType: "application/json",
      responseJsonSchema: opts.schema,
      temperature: opts.temperature ?? 0.2,
    },
  });
  const text = res.text;
  if (!text) throw new Error("Empty response from Gemini");
  return JSON.parse(text) as T;
}

/** Shared error → HTTP response mapping for API routes. */
export function errorResponse(e: unknown): Response {
  if (e instanceof NoKeyError) {
    return Response.json({ error: "no_key", message: "AI is offline (no GEMINI_API_KEY)." }, { status: 503 });
  }
  console.error(e);
  const message = e instanceof Error ? e.message : "Unknown error";
  return Response.json({ error: "ai_failed", message }, { status: 502 });
}
