import type { Window } from "./types";

export const TZ = "Asia/Karachi";

export function inWindow(hod: number, w: Window): boolean {
  const h = ((hod % 24) + 24) % 24;
  if (w.start === w.end) return true;
  if (w.start < w.end) return h >= w.start && h < w.end;
  return h >= w.start || h < w.end;
}

export function windowHours(w: Window): number {
  if (w.start === w.end) return 24;
  return w.start < w.end ? w.end - w.start : 24 - w.start + w.end;
}

/** 21.5 → "9:30 PM" */
export function fmtHour(hod: number): string {
  const h = ((hod % 24) + 24) % 24;
  let hr = Math.floor(h);
  let min = Math.round((h - hr) * 60);
  if (min === 60) {
    hr = (hr + 1) % 24;
    min = 0;
  }
  const ampm = hr < 12 ? "AM" : "PM";
  const h12 = hr % 12 === 0 ? 12 : hr % 12;
  return `${h12}:${String(min).padStart(2, "0")} ${ampm}`;
}

export function fmtWindow(w: Window): string {
  if (w.start === w.end) return "all day";
  return `${fmtHour(w.start)} – ${fmtHour(w.end)}`;
}

/** 95 → "1h 35m" */
export function fmtDuration(minutes: number): string {
  const m = Math.max(0, Math.round(minutes));
  const h = Math.floor(m / 60);
  const r = m % 60;
  if (h === 0) return `${r}m`;
  return r === 0 ? `${h}h` : `${h}h ${r}m`;
}

/** "21:30" → 21.5 */
export function parseHHMM(s: string): number | null {
  const m = /^(\d{1,2}):(\d{2})$/.exec(s.trim());
  if (!m) return null;
  const h = Number(m[1]);
  const min = Number(m[2]);
  if (h > 24 || min > 59) return null;
  return h + min / 60;
}

export function toHHMM(hod: number): string {
  const h = Math.floor(hod);
  const m = Math.round((hod - h) * 60);
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

/** Current date/hour in Pakistan, regardless of the device timezone. */
export function nowInPakistan(): { date: string; hour: number; minute: number } {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(new Date());
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "00";
  return {
    date: `${get("year")}-${get("month")}-${get("day")}`,
    hour: Number(get("hour")) % 24,
    minute: Number(get("minute")),
  };
}

/**
 * Offline fallback for load-shedding text: picks up ranges like
 * "10PM-12AM", "22:00 to 02:00", "9 am se 1 pm".
 */
export function parseOutagesRegex(text: string): Window[] {
  const re =
    /(\d{1,2})(?::|\.)?(\d{2})?\s*(am|pm|a\.m\.|p\.m\.)?\s*(?:-|–|—|to|till|until|se|tak)\s*(\d{1,2})(?::|\.)?(\d{2})?\s*(am|pm|a\.m\.|p\.m\.)?/gi;
  const out: Window[] = [];
  let m: RegExpExecArray | null;
  while ((m = re.exec(text))) {
    const ap2 = norm(m[6]);
    const ap1 = norm(m[3]) ?? ap2;
    const s = to24(Number(m[1]), Number(m[2] ?? 0), ap1);
    const e = to24(Number(m[4]), Number(m[5] ?? 0), ap2);
    if (s === null || e === null || s === e) continue;
    out.push({ start: s, end: e === 24 ? 0 : e });
  }
  return out;

  function norm(a?: string) {
    if (!a) return undefined;
    return a.toLowerCase().startsWith("p") ? "pm" : "am";
  }
  function to24(h: number, min: number, ap?: string): number | null {
    if (h > 24 || min > 59) return null;
    if (ap === "pm" && h < 12) h += 12;
    if (ap === "am" && h === 12) h = 0;
    return h + min / 60;
  }
}
