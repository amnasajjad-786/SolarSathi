# ☀️ SolarSaathi — "Will my battery last tonight?"

AI planner for Pakistani homes with solar + battery. It combines **your battery %**, **your load-shedding
schedule**, **tomorrow's weather** and **your appliances**, then tells you exactly what to move, turn down or
switch off so the battery lasts through every outage.

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
| 🔁 What-if | Flip any appliance on/off and the verdict and chart update instantly. "Apply plan" shows the green line. |

**Why this split?** Code does the physics (reliable numbers), AI does what code can't: reading messy screenshots,
SMS text and Roman Urdu, and explaining the plan like a person would.

## Run it

```bash
cp .env.example .env.local   # add GEMINI_API_KEY
npm install
npm run dev                  # http://localhost:3000
```

Without a key the app still works: the simulation, optimizer, chart, weather and regex schedule reader run
offline; AI cards show "offline mode".

Engine sanity check: `npx tsx scripts/check-engine.ts`

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
