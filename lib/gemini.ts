import { createHash } from "node:crypto";
import { GoogleGenAI, type Part } from "@google/genai";

/**
 * Models tried in order. Each model has its own free-tier quota, so when one is
 * exhausted (429) or unavailable (404/503) we fall back to the next and skip the
 * exhausted one until its cooldown passes. Override with GEMINI_MODELS="a,b,c".
 */
const MODELS = (process.env.GEMINI_MODELS || process.env.GEMINI_MODEL || "gemini-3.8-flash,gemini-3.5-flash-lite,gemini-flash-lite-latest,gemini-3.1-flash-lite,gemini-3.7-flash")
  .split(",")
  .map((m) => m.trim())
  .filter(Boolean);

const COOLDOWN_MS = 60_000;
const CALL_TIMEOUT_MS = 20_000; // a hung model is treated like an unavailable one
const CACHE_TTL_MS = 30 * 60_000;
const CACHE_MAX = 200;

const cooldownUntil = new Map<string, number>();
const cache = new Map<string, { at: number; value: unknown }>();
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

export class QuotaError extends Error {
  constructor(public retryAfterS: number) {
    super("All Gemini models are over their free quota right now.");
  }
}

function statusOf(e: unknown): number | undefined {
  const s = (e as { status?: number })?.status;
  if (typeof s === "number") return s;
  const m = /"code":\s*(\d{3})/.exec(e instanceof Error ? e.message : String(e));
  return m ? Number(m[1]) : undefined;
}

function isTimeout(e: unknown): boolean {
  const n = (e as { name?: string })?.name;
  return n === "TimeoutError" || n === "AbortError" || /aborted|timed? ?out/i.test(e instanceof Error ? e.message : "");
}

function retryDelayMs(e: unknown): number {
  const m = /retryDelay"?:\s*"?(\d+(?:\.\d+)?)s/.exec(e instanceof Error ? e.message : String(e));
  return m ? Math.ceil(Number(m[1]) * 1000) : COOLDOWN_MS;
}

/** One structured Gemini call: text and/or image parts in, JSON matching `schema` out. */
export async function generateJson<T>(opts: {
  system: string;
  parts: Part[];
  schema: object;
  temperature?: number;
}): Promise<T> {
  const key = createHash("sha256").update(JSON.stringify([opts.system, opts.parts, opts.schema, opts.temperature])).digest("hex");
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < CACHE_TTL_MS) return hit.value as T;

  const now = Date.now();
  const ready = MODELS.filter((m) => (cooldownUntil.get(m) ?? 0) <= now);
  // If everything is cooling down, still try the one that recovers soonest.
  const order = ready.length ? ready : [...MODELS].sort((a, b) => (cooldownUntil.get(a) ?? 0) - (cooldownUntil.get(b) ?? 0)).slice(0, 1);

  let lastErr: unknown;
  for (const model of order) {
    try {
      const res = await ai().models.generateContent({
        model,
        contents: [{ role: "user", parts: opts.parts }],
        config: {
          systemInstruction: opts.system,
          responseMimeType: "application/json",
          responseJsonSchema: opts.schema,
          temperature: opts.temperature ?? 0.2,
          abortSignal: AbortSignal.timeout(CALL_TIMEOUT_MS),
        },
      });
      const text = res.text;
      if (!text) throw new Error("Empty response from Gemini");
      const value = JSON.parse(text) as T;
      cache.set(key, { at: Date.now(), value });
      if (cache.size > CACHE_MAX) cache.delete(cache.keys().next().value!);
      return value;
    } catch (e) {
      if (e instanceof NoKeyError) throw e;
      lastErr = e;
      const s = isTimeout(e) ? 504 : statusOf(e);
      if (s === 504 || s === 429 || s === 404 || s === 503 || s === 500) {
        cooldownUntil.set(model, Date.now() + (s === 404 ? 24 * 3600_000 : retryDelayMs(e)));
        console.warn(`[gemini] ${model} → ${s}, trying next model`);
        continue;
      }
      throw e;
    }
  }
  if (statusOf(lastErr) === 429) {
    const soonest = Math.min(...MODELS.map((m) => cooldownUntil.get(m) ?? 0));
    throw new QuotaError(Math.max(1, Math.round((soonest - Date.now()) / 1000)));
  }
  throw lastErr;
}

/** Shared error → HTTP response mapping for API routes. */
export function errorResponse(e: unknown): Response {
  if (e instanceof NoKeyError) {
    return Response.json({ error: "no_key", message: "AI is offline (no GEMINI_API_KEY)." }, { status: 503 });
  }
  if (e instanceof QuotaError) {
    return Response.json(
      { error: "quota", message: `AI is busy (free quota reached) — try again in ~${e.retryAfterS}s.` },
      { status: 429, headers: { "Retry-After": String(e.retryAfterS) } },
    );
  }
  console.error(e);
  const message = e instanceof Error ? e.message : "Unknown error";
  return Response.json({ error: "ai_failed", message }, { status: 502 });
}
