# ☀️ SolarSaathi — "Will my battery last tonight?"

**SolarSaathi** is an AI energy assistant for Pakistani homes with solar panels and batteries. It answers one
question every evening: *"Will my battery last through tonight's load-shedding?"* Upload a screenshot of your
inverter app and paste your LESCO / K-Electric SMS — the AI reads your battery level and outage times, checks
tomorrow's weather and your appliances, and gives you a simple plan in English or Roman Urdu: run the water
motor at noon on free sunshine, put the AC in eco mode during the outage, turn on grid charging. Critical alerts
can be sent to WhatsApp. Your battery lasts the night, and no solar goes to waste. *Apni bijli, apna plan.*

Hackathon theme: **Power. Water. Heat.** — Team Qubit Dynamics.

## What it does

| Step | How |
|---|---|
| 📷 Read the inverter | Upload a screenshot of *any* inverter app (Inverex, Growatt, SmartESS, Solis, Knox…). **Gemini vision** reads battery %, PV watts, load and grid status. |
| 🔌 Read the schedule | Paste the LESCO / K-Electric SMS, a tweet, or type "raat 10 se 12". **Gemini** extracts the outage windows (regex fallback offline). |
| 🏠 Describe the home | "Two 1.5 ton ACs at night, 5 fans, water motor in the morning" → **Gemini** builds the appliance list with realistic Pakistani wattages. |
| 🌤️ Forecast | Open-Meteo hourly solar radiation, cloud cover and temperature for now → end of tomorrow. |
| 🧮 Simulate | A 15-minute battery simulation (`lib/simulate.ts`) — solar in, loads out, grid on/off, safe floor (lithium 10%, lead-acid 50%), inverter overload. |
| 🎯 Optimize | `lib/optimize.ts`: shift flexible loads (pump, iron, washing) into sunniest hours → enable grid pre-charge → switch off extras only during outages → AC eco mode (26–27°C) before ever cutting cooling. Every action has a measured gain. |
| 🤖 Coach | **Gemini** turns the facts into a short plan in English or Roman Urdu — it may only use numbers the simulation produced. |
| 📍 Location | Search any Pakistani city/town (Open-Meteo geocoding) or use the phone's GPS. |
| 💬 WhatsApp alerts | Users enter only their number; critical alerts (battery will die, inverter overload) are sent from SolarSaathi's own WhatsApp Business number (Meta Cloud API). |
| 🔁 What-if | Flip any appliance on/off and the verdict and chart update instantly. "Apply plan" shows the green line. |

**Why this split?** Code does the physics (reliable numbers), AI does what code can't: reading messy screenshots,
SMS text and Roman Urdu, and explaining the plan like a person would.

## Run it

```bash
cp .env.example .env.local   # add GEMINI_API_KEY
npm install
npm run dev                  # http://localhost:3000
```

If one model hits its free quota (429) or hangs, the server falls back to the next model in `GEMINI_MODELS`
and caches identical requests for 30 minutes.

Without a key the app still works: the simulation, optimizer, chart, weather and regex schedule reader run
offline; AI cards show "offline mode".

Engine sanity check: `npx tsx scripts/check-engine.ts`

## WhatsApp alerts setup (one time, by the team)

1. developers.facebook.com → **Create app** → type *Business* → add the **WhatsApp** product.
2. *WhatsApp → API Setup*: copy the **Phone number ID** of the free test sender number.
3. In test mode, add up to **5 recipient numbers** (your testers) under "To" and verify each with the code Meta sends.
4. Permanent token: business.facebook.com → *Settings → Users → System users* → add an admin system user →
   **Generate token** for the app with `whatsapp_business_messaging` + `whatsapp_business_management`.
5. Set `WHATSAPP_TOKEN`, `WHATSAPP_PHONE_NUMBER_ID`, `WHATSAPP_TEMPLATE=hello_world` in `.env.local` / Vercel.
6. For real alert text to any user: create a *Utility* template `battery_alert` with body
   `SolarSaathi alert: {{1}}`, get it approved, set `WHATSAPP_TEMPLATE=battery_alert`, and complete business
   verification to message numbers beyond the test list.

## Deploy

Push to GitHub → import in Vercel → add `GEMINI_API_KEY` env var → deploy.

## User testing log (rule: ≥ 3 real people)

| # | Who (role, city, system) | What they said | What we changed |
|---|---|---|---|
| 1 | | | |
| 2 | | | |
| 3 | | | |

## Roadmap

Direct inverter cloud APIs (Growatt/SolarMan) · WhatsApp alerts before each outage · net-metering bill estimate ·
auto-fetch DISCO schedules by feeder · Urdu script UI.
