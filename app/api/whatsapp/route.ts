// Sends WhatsApp alerts from SolarSaathi's own business number via the
// WhatsApp Business Cloud API (Meta). Users only give their phone number.
//
// Env:
//   WHATSAPP_TOKEN            permanent System User access token
//   WHATSAPP_PHONE_NUMBER_ID  sender phone number ID from the Meta app dashboard
//   WHATSAPP_TEMPLATE         optional approved template name (e.g. "battery_alert", one {{1}} body param);
//                             "hello_world" works in test mode. Needed to message users who
//                             haven't chatted with the bot in the last 24 hours.
//   WHATSAPP_TEMPLATE_LANG    template language code (default "en")
//   WHATSAPP_API_VERSION      Graph API version (default "v23.0")


export async function GET() {
  return Response.json({ configured: Boolean(process.env.WHATSAPP_TOKEN && process.env.WHATSAPP_PHONE_NUMBER_ID) });
}

export async function POST(req: Request) {
  const token = process.env.WHATSAPP_TOKEN;
  const phoneId = process.env.WHATSAPP_PHONE_NUMBER_ID;
  if (!token || !phoneId) {
    return Response.json({ error: "not_configured", message: "WhatsApp alerts aren't set up on the server yet." }, { status: 503 });
  }

  const { phone, text } = (await req.json()) as { phone?: string; text?: string };
  const to = normalizePk(phone ?? "");
  if (!to || !text?.trim()) {
    return Response.json({ error: "bad_request", message: "Enter a valid mobile number, e.g. 0300 1234567 or +92 300 1234567." }, { status: 400 });
  }

  const version = process.env.WHATSAPP_API_VERSION || "v23.0";
  const url = `https://graph.facebook.com/${version}/${phoneId}/messages`;
  const send = (body: object) =>
    fetch(url, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ messaging_product: "whatsapp", to, ...body }),
      signal: AbortSignal.timeout(20_000),
    }).then(async (r) => ({ ok: r.ok, j: await r.json().catch(() => ({})) }));

  const template = process.env.WHATSAPP_TEMPLATE;
  const lang = process.env.WHATSAPP_TEMPLATE_LANG || (template === "hello_world" ? "en_US" : "en");
  const templateBody = () => ({
    type: "template",
    template: {
      name: template,
      language: { code: lang },
      // Template parameters can't contain newlines or long whitespace runs.
      ...(template !== "hello_world" && {
        components: [{ type: "body", parameters: [{ type: "text", text: text.replace(/\s*\n+\s*/g, " · ").slice(0, 1000) }] }],
      }),
    },
  });

  try {
    // Free-form text is only delivered inside the 24h customer-service window (Meta accepts it, then
    // fails it asynchronously), so business-initiated alerts go out as the approved template when one is set.
    const res = await send(template ? templateBody() : { type: "text", text: { body: text.slice(0, 4000), preview_url: false } });
    if (!res.ok) {
      const e = res.j?.error;
      return Response.json({ error: "send_failed", message: e?.error_user_msg || e?.message || "WhatsApp send failed" }, { status: 502 });
    }
    return Response.json({ ok: true });
  } catch (e) {
    return Response.json({ error: "send_failed", message: (e as Error).message }, { status: 502 });
  }
}

/** "0300-1234567" / "300 1234567" / "+92 300 1234567" → "923001234567". Other countries: pass with + and code. */
function normalizePk(raw: string): string | null {
  let d = raw.replace(/[^\d+]/g, "");
  if (d.startsWith("+")) d = d.slice(1);
  else if (d.startsWith("00")) d = d.slice(2);
  else if (d.startsWith("0")) d = `92${d.slice(1)}`;
  else if (/^3\d{9}$/.test(d)) d = `92${d}`;
  return /^\d{10,15}$/.test(d) ? d : null;
}
