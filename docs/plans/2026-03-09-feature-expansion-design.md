# Feature Expansion Design — 2026-03-09

## Overview

Five new features added to the Flexport SDR Intelligence Hub. Goal: visually alive,
live-data-driven, AI-heavy features that impress a head of sales + SDR team audience.

---

## Feature 1 — Live Vessel Tracker (`/vessels`)

### What it is
A new full-page AIS map where real cargo ships animate along shipping routes in real
time. More operational and grounded than the home globe.

### APIs
- **aisstream.io** — free real-time WebSocket AIS stream (GitHub OAuth signup)
  - env: `AISSTREAM_API_KEY`
  - Backend proxies the WebSocket: `aisstream.io → Express WS relay → browser`
  - Fields: MMSI, vessel name, lat/lon, SOG, COG, heading, destination, ETA
  - Fallback: ~50 simulated vessels following existing globe-data shipping lane coords
- **Terminal49** — free container tracking REST API (email signup, no CC)
  - env: `TERMINAL49_API_KEY`
  - Track by container number, Bill of Lading, or booking number
  - 34+ major carriers (Maersk, MSC, COSCO, CMA CGM, Evergreen, Hapag-Lloyd, etc.)
  - Webhooks for milestone updates; backend stores state and pushes to frontend

### Visual
- react-leaflet dark tile map (`#060b18` palette, dark Carto/Stamen tiles)
- Vessel icons colored by type: container = `#00d4ff`, tanker = amber, bulk = violet
- Smooth position interpolation between AIS updates
- Click vessel → side panel: name, flag, type, origin → destination, ETA, speed,
  and any watched containers aboard
- Disruption zone overlays (Hormuz, Red Sea) matching port congestion data
- "My Prospects' Lanes" toggle highlights routes relevant to SDR's pipeline

### Container Intelligence tab (within the page)
- Search by container number or Bill of Lading → Terminal49 lookup
- Animated milestone timeline: Empty Out → Full In → Vessel Loaded → Departed →
  In Transit (pulsing dot) → Arrived → Discharged → Available for Pickup
- "Watch List" — pins containers, persists to localStorage, updates on page visit
- If a watched container is aboard a clicked vessel, it highlights on the map

### Nav
- Sidebar entry: "Vessels" with `RiShipLine` icon, between Trade and Account
- Route: `/vessels`

---

## Feature 2 — AI Prospect Research Scanner (`/research`)

### What it is
A new page. Enter any company name (or pick from the 136 prospects) → AI agent fires
Serper + NewsAPI in parallel → streams a structured intelligence brief via OpenAI.

### Backend
- New route: `POST /api/research`
- Fires Serper + NewsAPI in parallel for the company name
- Passes results to OpenAI with a structured prompt, streams response
- Caches last 20 results in memory (1-hour TTL)

### Output brief (streamed, same aesthetic as Account 360)
1. Company snapshot — revenue, employees, HQ, primary trade lanes, est. freight spend
2. Recent signals — last 30 days of news, funding, exec changes, hiring spikes
3. Freight profile — likely forwarder, lane mix, known pain points
4. Why contact this week — 2–3 AI-generated, signal-grounded reasons
5. Opening hook — one killer first sentence for cold call or email

### UX
- Full-width terminal aesthetic
- Left panel: text input + scan history (last 10, saveable)
- Right panel: streaming output with section headers (same `<StreamingText>` pattern)
- "Save to Account" button — if company exists in DB, appends brief to Account 360
- Keyboard shortcut: `Ctrl+Shift+R`

### Nav
- Sidebar entry: "Research" with `RiSearchEyeLine` icon
- Route: `/research`

---

## Feature 3 — Team Leaderboard (`/team`)

### What it is
A new manager-facing page showing SDR team performance as animated quota rings,
ranked feed, and AI coaching insights per rep.

### Data
- Seeds 5 fictional teammates into the existing performance/activity tables
- "You" row is always highlighted
- AI coaching: OpenAI call with each rep's metrics → one actionable insight per rep

### Visual
- Top row: 4–6 animated quota attainment rings (same ring component as Performance,
  smaller, side-by-side)
- Ranked leaderboard table: Rep, Calls, Demos, Pipeline $, Quota %, 7-day trend arrow
- Right panel: pulsing "AI Coach" feed — one insight card per rep, refreshes on load
- Same `#060b18` dark terminal aesthetic

### Backend
- No new routes — uses existing `/api/performance` with per-rep param
- New `/api/team` GET route returns seeded team data + AI coaching insights

### Nav
- Sidebar entry: "Team" with `RiTeamLine` icon
- Keyboard shortcut: `Ctrl+Shift+T`
- Route: `/team`

---

## Feature 4 — AI Email Composer (`Ctrl+Shift+E`)

### What it is
A global modal. One-click entry from anywhere, plus context-aware launch from
Account 360 pages and Signal Feed tiles.

### Flow
1. Select prospect (pre-filled when launched from context)
2. Select trigger: signal event, funding, tariff change, or free-text
3. Select tone: Direct / Consultative / Challenger
4. Generate → OpenAI streams 3 subject line variants + 150–200 word email + LinkedIn

### Visual
- Two-column modal
- Left: prospect card, trigger selector, tone toggle
- Right: streamed output, tab switcher between Email and LinkedIn variants
- Copy button per section, "Regenerate" re-runs same inputs
- JetBrains Mono output font, same dark terminal aesthetic

### Backend
- New route: `POST /api/compose-email`
- Reuses existing OpenAI setup in `flexportAnalyzer.js`

### Integration points
- `App.jsx` — global keyboard shortcut `Ctrl+Shift+E`, modal state
- `Account360Page.jsx` — "Compose Email" button pre-fills prospect
- `SignalFeed.jsx` — "Email" button on each signal tile pre-fills trigger

---

## Feature 5 — Animated Freight Rate Sparklines (Trade page)

### What it is
Replace static rate rows in the container rates table with mini inline sparklines
showing a 12-week trend behind each current rate.

### Visual
- Each row gains an 80×28px Recharts `<AreaChart>` sparkline
- Fill: `#00d4ff22`, line: `#00d4ff`
- Final data point = current live rate
- Up/down arrow + % change badge replaces static date column
- Rates trending up: red glow; down: green glow

### Data
- Current rates remain static as before
- Backend generates a plausible 12-week historical array per route using a seeded
  random walk around each current value (no new API needed)
- New route: `GET /api/rate-history` returns the historical arrays

---

## Feature 6 — Globe Enhancement (Homepage)

### Moon
- Small Three.js `SphereGeometry` (~2% of globe radius) added to GlobeView scene
- Slow tilted elliptical orbit, ~120s per revolution
- Grey rough material, lit from same directional light as globe (crescent shadow)
- No label, no click interaction — purely atmospheric

### Atmospheric glow
- Slightly larger sphere (105% globe size) with additive `ShaderMaterial`
- Fades from `#00d4ff08` at equator to transparent at poles
- Soft blue limb glow — subtle, not a halo

### Shipping lane arcs
- Animated `sin`-wave opacity pulse, each arc offset so they breathe independently
- Arcs near disruption zones (Hormuz, Red Sea) pulse red/amber instead of cyan

### Stars
- 10% density increase
- Slow drift rotation on the star field (~0.0001 rad/frame)

---

## New Environment Variables

```
AISSTREAM_API_KEY=      # aisstream.io — GitHub OAuth signup, free
TERMINAL49_API_KEY=     # terminal49.com — email signup, free, no CC
```

Add to `backend/.env.example`, `README.md` env table, `DEPLOYMENT.md` variables section.

---

## New Routes Summary

| Method | Route | Description |
|--------|-------|-------------|
| GET | `/api/vessels` | SSE stream of live vessel positions (proxied from aisstream.io) |
| GET | `/api/containers/:id` | Container status from Terminal49 |
| POST | `/api/containers/watch` | Add container to watch list |
| POST | `/api/research` | AI prospect research — Serper + NewsAPI + OpenAI stream |
| GET | `/api/team` | Team leaderboard data + AI coaching insights |
| POST | `/api/compose-email` | AI email composer — subject lines + email + LinkedIn |
| GET | `/api/rate-history` | 12-week historical rate arrays for sparklines |

---

## New Nav Pages

| Route | Title | Icon | Shortcut |
|-------|-------|------|----------|
| `/vessels` | Vessels | `RiShipLine` | — |
| `/research` | Research | `RiSearchEyeLine` | `Ctrl+Shift+R` |
| `/team` | Team | `RiTeamLine` | `Ctrl+Shift+T` |

## New Global Modals

| Shortcut | Feature |
|----------|---------|
| `Ctrl+Shift+E` | AI Email Composer |
| `Ctrl+Shift+T` | Team Leaderboard (also `/team` page) |
