// Sends a WhatsApp message through CallMeBot (free for personal use).
// Each user links their own number once and gets a personal API key:
// https://www.callmebot.com/blog/free-api-whatsapp-messages/
export async function POST(req: Request) {
  const { phone, apikey, text } = (await req.json()) as { phone?: string; apikey?: string; text?: string };
  const p = (phone ?? "").replace(/[^\d+]/g, "");
  if (!/^\+?\d{10,15}$/.test(p) || !apikey?.trim() || !text?.trim()) {
    return Response.json({ error: "bad_request", message: "Phone (with country code), API key and text are required." }, { status: 400 });
  }
  const url =
    `https://api.callmebot.com/whatsapp.php?phone=${encodeURIComponent(p.startsWith("+") ? p : `+${p}`)}` +
    `&text=${encodeURIComponent(text.slice(0, 1000))}&apikey=${encodeURIComponent(apikey.trim())}`;
  try {
    const r = await fetch(url, { signal: AbortSignal.timeout(20_000) });
    const body = await r.text();
    const ok = r.ok && !/error|invalid|not allowed/i.test(body);
    return Response.json(ok ? { ok: true } : { error: "send_failed", message: body.replace(/<[^>]+>/g, " ").trim().slice(0, 200) }, { status: ok ? 200 : 502 });
  } catch (e) {
    return Response.json({ error: "send_failed", message: (e as Error).message }, { status: 502 });
  }
}
