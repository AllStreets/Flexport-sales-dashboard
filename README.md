<p align="center">
  <img src="https://img.shields.io/badge/Flexport_SDR-v2.1.0-00D4FF?style=for-the-badge" alt="Version"/>&nbsp;<img src="https://img.shields.io/badge/React-19-61dafb?style=for-the-badge&logo=react&logoColor=white" alt="React"/>&nbsp;<img src="https://img.shields.io/badge/Vite-7-646cff?style=for-the-badge&logo=vite&logoColor=white" alt="Vite"/>&nbsp;<img src="https://img.shields.io/badge/Express-5-000000?style=for-the-badge&logo=express&logoColor=white" alt="Express"/>&nbsp;<img src="https://img.shields.io/badge/SQLite-3-003B57?style=for-the-badge&logo=sqlite&logoColor=white" alt="SQLite"/>&nbsp;<img src="https://img.shields.io/badge/OpenAI-GPT--5.4-412991?style=for-the-badge&logo=openai&logoColor=white" alt="OpenAI"/>&nbsp;<img src="https://img.shields.io/badge/License-MIT-22C55E?style=for-the-badge" alt="License"/>
</p>

<p align="center">
  <a href="https://github.com/AllStreets/Flexport-sales-dashboard">
    <img src="https://readme-typing-svg.demolab.com?font=JetBrains+Mono&weight=700&size=64&duration=1&pause=99999&color=00D4FF&center=true&vCenter=true&width=900&height=100&lines=F+L+E+X+P+O+R+T++S+D+R" alt="FLEXPORT SDR"/>
  </a>
</p>
<p align="center"><strong>Sales Intelligence Hub for Freight Forwarding</strong></p>
<p align="center"><em>One terminal for prospects, pipeline, live vessel and aircraft telemetry, macro data, port congestion, tariffs, and call assistance.</em></p>

---

## What this is

An SDR working freight forwarding has to triangulate across a dozen surfaces every morning: who to call, what their supply chain looks like, what just shifted in their lane, what the macro picture says, where the boats are stuck, what HS code their cargo falls under, whose container is sitting in a port congestion event. The information exists. It lives across a CRM, a half-dozen browser tabs, and a Bloomberg terminal you don't have a license for.

**Flexport SDR consolidates the surface.** A single dark-mode operator console pulls 250 ICP-scored prospects, a Kanban pipeline, FRED macro data, live AIS vessel positions, live ADS-B aircraft, NewsAPI trigger events, FX rates, USITC tariff tables, and an AI co-pilot for call prep, objection handling, and outreach sequencing. The globes are real — vessel positions stream over a WebSocket to AISstream, aircraft positions come from adsb.lol, port disruption rings flip color when NewsAPI signals raise them. The AI features run on GPT-5.4 (Agentic Outreach), GPT-4.1-mini (platform), and gpt-5.4-mini (verdicts and signal matching). The whole thing deploys on Vercel + Railway and works on a $5/month Railway box.

The product is the consolidation. The globes are how you see it move.

### At a glance

| Surface | Count |
|---|---|
| Prospect database (15 sectors, ICP-scored) | **250** |
| Pipeline stages (New → Researched → Called → Demo → Won/Lost) | **6** |
| Backend API endpoints | **59** |
| Live AIS vessels (with AISstream key) | up to **2,500** |
| Simulated vessels on great-circle routes (Ocean Freight) | **250** on **62** lanes |
| Live ADS-B cargo aircraft (with adsb.lol fallback to sim) | up to **500+** |
| Simulated aircraft on cargo + passenger routes (Air Freight) | **~200** on **67** routes |
| Simulated trucks on highway corridors (Land Freight) | **~520** on **145** corridors |
| FRED macro series (trade balance, imports, capital goods, fuel) | live |
| FX pairs with 1-day % change | **16** |
| Container tracking carriers via Terminal49 | **35+** |
| Trade route spot rates (FBX / SCFI / WCI / Drewry) | **20** |
| Frontend routes | **12** |

---

## Architecture

```
                          +-----------+
                          |    SDR    |
                          +-----+-----+
                                |
+===============================|=================================+
|                      FLEXPORT SDR FRONTEND                      |
|                                                                 |
|   Home  Air  Land  Ocean  Market  Trade  Pilot  CRM  Settings   |
|     |    |     |      |       |      |      |     |       |     |
|     +----+-----+------+-------+------+------+-----+-------+     |
|                                |                                |
|                  React 19 + Vite 7 + Router v7                  |
|         (Three.js / react-globe.gl  ·  @dnd-kit  ·  Recharts)   |
+================================|================================+
                                 |  HTTP + SSE (pilot stream)
                                 v
+================================|================================+
|                       EXPRESS 5 BACKEND                         |
|                                                                 |
|   +-------------+   +-------------+   +-------------+           |
|   |  Prospects  |   |  Pipeline   |   | Performance |           |
|   |  Service    |   |  Service    |   |  Service    |           |
|   +------+------+   +------+------+   +------+------+           |
|          |                 |                 |                  |
|          +--------+--------+--------+--------+                  |
|                   |                 |                           |
|              +----+-----+      +----+-----+                     |
|              |  SQLite  |      | OpenAI   |                     |
|              | flexport |      | router   |                     |
|              |   .db    |      | (5.4 /   |                     |
|              | (WAL OFF)|      |  4.1mini)|                     |
|              +----------+      +----+-----+                     |
|                                     |                           |
|   +---------------------------------+--------------------+      |
|   |     Live data adapters (graceful fallback)           |      |
|   +-----+------+--------+-------+--------+----------+----+      |
|         |      |        |       |        |          |           |
|     AISstream  ADS-B   NewsAPI  FRED    Serper   Terminal49     |
|       (WS)    (adsb     (RSS   (macro)  (web    (container      |
|               .lol)    signals)         enrich)   tracking)     |
+=================================================================+
```

Two services, deployed independently. Frontend on Vercel, backend on Railway. SQLite database (`flexport.db`) is seeded on every cold start — Railway redeploys do not break the catalog, they regenerate it.

---

## Pages

| Route | Page | What's on it |
|---|---|---|
| `/` | **Home** | Interactive 3D globe with shipping lanes and port disruption rings (color-flips from signal feed), prospect arcs, signal ticker, Today's Playbook (priority follow-ups), Hot Prospects panel, Signal Feed with AI outreach matching, inline tariff widget |
| `/flights` | **Air Freight** | Live ADS-B globe — animated aircraft sprites with great-circle arc trails, dark atmosphere, night texture. Right panel: fleet overview, departure/destination feed, route stats. `?mode=sim` forces simulated. |
| `/land` | **Land Freight** | 145 global highway corridors with side-profile truck sprites (silver / orange-for-tank). Y-flip on westward heading so wheels face the viewer. Right panel: fleet overview, carrier watch, hot corridors, live event feed. |
| `/vessels` | **Ocean Freight** | Live AIS globe — animated route arcs, vessel-type coloring (Container / Tanker / Bulk), port disruption rings. Right panel: fleet overview, live event feed, container tracker (Terminal49), vessel detail. Header badge: `LIVE AIS` / `LIVE (CACHED)` / `AIS DOWN` / `SIMULATED`. |
| `/trade` | **Trade Intelligence** | Bloomberg-style macro terminal — FRED live tiles, 20-route container spot rates, port congestion table, live FX rates with 1-day delta, USITC tariff tables, route optimizer, §301 actions, trade policy calendar, earnings trigger monitor. |
| `/account/:id` | **Account 360** | Full prospect deep-dive — animated supply chain diagram with US port routing, streaming AI analysis, signal timeline, decision makers, call prep sheet, objection handler, outreach sequence builder, mutual action plan, call intelligence parser (auto-populates from Live Call notes). |
| `/market` | **Market Map** | Zoomable radial SVG graph of 250 prospects across 15 sectors with live pipeline stage colors, sector intelligence panel, TAM estimates, Flexport product recommendations, signal timeline per company. |
| `/research` | **Research** | Saved AI analyses — list view, search, favorites, delete. Persists every Account 360 analysis run. |
| `/pilot` | **Agentic Outreach** | Pilot module — daily market briefings (gpt-5.4 over FBX/SCFI/WCI/Drewry), prospect dossier builder with freight-fit scoring, 3-touch outreach sequence (email + LinkedIn + cold call opener), customer-update drafts, SDR playbook hooks. History persists in `localStorage`. |
| `/tariff` | **Tariff Calculator** | Landed-cost modeling — origin country, HS code lookup, cargo value, weight, Ocean FCL vs Air mode. §301 + reciprocal tariff breakdown, SDR angle generator. |
| `/performance` | **Sales CRM** | 365-day activity heatmap, quota rings (calls / emails / demos / LinkedIn / pipeline), activity funnel, win-loss chart and logger, follow-up radar, pipeline velocity, recent activity feed. |
| `/settings` | **Settings** | Profile, quota targets, notifications, Live Call config, appearance (user-configurable accent color), AI model picker, API key status, data export, keyboard shortcuts, server health (pings backend `/api/settings/health`). |

---

## Data sources

Every live source falls back to static data when the API key is missing. The app is fully functional with only `OPENAI_API_KEY` set — every other key upgrades a surface.

| Source | Surface | Without key | With key |
|---|---|---|---|
| **AISstream** (WebSocket) | Ocean Freight globe | 250 simulated vessels on 62 lanes (`source: simulated`) | Up to 2,500 live AIS positions; DB cache restores on reboot; `LIVE AIS` / `LIVE (CACHED)` / `AIS DOWN` badge reflects WS state |
| **adsb.lol** (multi-type query) | Air Freight globe | ~200 simulated planes on 67 routes | Live cargo aircraft positions with multi-type fallback |
| **OpenAI** GPT-5.4 / 4.1-mini / 5.4-mini | All AI features | App boots; AI features 500 | Account analysis, call prep, objection handler, signal-prospect matcher, outreach sequence, call-intelligence parser, mic listener prediction, mutual action plan, market briefings |
| **FRED** | Trade Intelligence tiles | Cached values, `—` if stale | Live trade balance, imports, capital goods, diesel, Brent |
| **NewsAPI** | Signal feed, trigger events, port congestion | Static signal set | Hourly signal refresh; port rings flip on real-time disruption news |
| **Serper** | Prospect web enrichment | Static company data | Live web search on prospect lookups |
| **exchangerate-api.com + frankfurter.app** | FX Rates panel | Static values, `REF` badge | Live rates + 1-day % change for 16 pairs |
| **Terminal49** | Container Tracker (Ocean Freight) | 503 on tracker submit | Live container/B-L tracking across 35+ carriers |
| **USITC HTS** (local) | Tariff Calculator | Bundled HS code table | (same — no key required) |

---

## Tech stack

**Frontend** — React 19 · Vite 7 · React Router v7 · Recharts · Three.js / react-globe.gl · @dnd-kit (Kanban) · react-icons/ri

**Backend** — Express 5 · SQLite 3 (busy-timeout configured; no WAL — ephemeral on Railway) · `ws` (AISstream client) · axios · OpenAI SDK

**AI models** —
- `gpt-5.4` — Agentic Outreach (market briefings, prospect dossiers, customer updates) via SSE
- `gpt-4.1-mini` — Account analysis, call prep, objection handler, sequence generator, signal matching
- `gpt-5.4-mini` — Lightweight tasks: semantic search, signal scoring

**Live data feeds** — AISstream WebSocket · adsb.lol REST · FRED REST · NewsAPI REST · Serper REST · exchangerate-api.com + frankfurter.app · Terminal49 REST

---

## Keyboard shortcuts

| Shortcut | Action |
|---|---|
| `Ctrl+Shift+L` | Live Call — prospect search, call timer, talk track, real-time objection AI, notes that auto-populate Account 360 call intelligence |
| `Ctrl+Shift+P` | Pipeline Kanban — drag-and-drop deal board across 6 stages with inline deal value |
| `Ctrl+Shift+Q` | Quick Research — instant prospect lookup overlay |
| `Ctrl+Shift+E` | Email Composer — AI-drafted outreach with trigger context |
| `Ctrl+/` | Toggle sidebar |
| `Escape` | Close topmost modal |

---

## API surface

59 endpoints across the backend. Grouped:

| Group | Endpoints | Highlights |
|---|---|---|
| **Prospects & Market** | 6 | `/api/prospects` (filter by sector, ICP min, lane, search, limit) · `/api/prospects/:id` · `/api/prospects/sectors` · `/api/market-map` · `/api/hot-prospects` (top 8 by composite score) · `/api/followup-radar` |
| **Pipeline** | 5 | `GET/POST/PUT/DELETE /api/pipeline` · `/api/pipeline/velocity` · `/api/pipeline/count` |
| **Performance** | 3 | `/api/performance` (KPIs, retention-windowed) · `/api/performance/activity` · `/api/win-loss` |
| **Live Globes** | 4 | `/api/vessels?mode=sim` · `/api/flights?mode=sim` · `/api/trucks` · `/api/globe-data` (lanes + dynamic port congestion) |
| **Trade Intelligence** | 6 | `/api/trade-intelligence` (FRED) · `/api/signals` · `/api/trigger-events` · `/api/fx-rates` · `/api/rate-history` · `/api/route-optimize` |
| **AI** | 12 | `/api/analyze` (streaming) · `/api/call-prep` · `/api/call-intelligence` · `/api/call-predict` (mic listener) · `/api/objection` · `/api/map-plan` · `/api/generate-sequence` · `/api/semantic-search` · `/api/signal-match` · `/api/first-line` · `/api/compose-email` |
| **Pilot (Agentic Outreach)** | 7 | `/api/pilot-stream` (SSE) · `/api/pilot-agent` · `/api/pilot-daily-brief` · `/api/pilot-signal-prospects` · `/api/pilot-qualify` · `/api/pilot-variants` · `/api/pilot-reply` |
| **Account 360** | 2 | `/api/account360/:id` (prospect + signal timeline) · `/api/team` |
| **Persistence** | 4 | `/api/analyses` (CRUD) · `/api/analyses/:id/favorite` |
| **Containers** | 2 | `/api/containers/track` (Terminal49 submit) · `/api/containers/:requestId` (poll) |
| **Tariffs** | 2 | `/api/hs-lookup` · `/api/trade-data/:commodity` |
| **Misc** | 6 | `/api/battle-cards` · `/api/settings/health` (env + AIS WS state + cache size) · others |

---

## Quickstart

```bash
git clone https://github.com/AllStreets/Flexport-sales-dashboard.git
cd Flexport-sales-dashboard

# Backend — http://localhost:5001
cd backend
npm install
cp .env.example .env          # add OPENAI_API_KEY at minimum
node initDb.js                # create schema (idempotent ALTER TABLE migrations)
node data/seedProspects.js    # seed 250 prospects across 15 sectors
npm run dev

# Frontend — http://localhost:5174
cd ../frontend
npm install
npm run dev
```

`backend/.env`:
```
OPENAI_API_KEY=sk-...                    # Required — all AI features
FRED_API_KEY=...                         # Optional — Trade Intelligence macro tiles
NEWSAPI_KEY=...                          # Optional — signals + trigger events + port congestion
SERPER_API_KEY=...                       # Optional — prospect web enrichment
EXCHANGE_RATE_API_KEY=...                # Optional — live FX rates
AISSTREAM_API_KEY=...                    # Optional — Ocean Freight live vessels
TERMINAL49_API_KEY=...                   # Optional — container tracking
FRONTEND_URL=https://<your>.vercel.app   # Production CORS allowlist
PORT=5001
```

`frontend/.env`:
```
VITE_API_URL=http://localhost:5001
```

---

## Design system

| Token | Value |
|---|---|
| Background | `#060b18` (navy, not black) |
| Accent | `#00d4ff` (user-configurable in Settings → Appearance) |
| Heading / UI font | Space Grotesk |
| Numbers / code font | JetBrains Mono |
| Icon library | Remix Icons (`react-icons/ri`) |

**Pipeline stage colors**

`new` `#2563eb` · `researched` `#6366f1` · `called` `#8b5cf6` · `demo_booked` `#10b981` · `closed_won` `#f59e0b` · `closed_lost` `#475569`

**Opportunity score**

```
composite = icp_score + stage_bonus
            (demo_booked +20 · called +15 · researched +10 · new +5)
```

---

## Project layout

```
flexport-sales-dashboard/
├── frontend/                React 19 + Vite 7 SPA          → Vercel
│   ├── src/
│   │   ├── components/      Globes, panels, modals, nav
│   │   ├── pages/           One component per route (12)
│   │   ├── App.jsx          Layout, global modals, shortcuts
│   │   └── main.jsx
│   ├── vercel.json          SPA rewrite for client-side routing
│   └── vite.config.js       Dev server pinned to :5174
│
├── backend/                 Express 5 API + SQLite         → Railway
│   ├── services/            Domain logic (15 services)
│   ├── routes/              /api/pilot-* endpoints
│   ├── data/                Seed data + static catalogs
│   ├── initDb.js            Schema + idempotent migrations
│   └── server.js            All other routes + AISstream WS client
│
├── cron/                    Scheduled jobs (inbox poll, daily brief)
├── docs/                    Architectural notes
├── DEPLOYMENT.md            Vercel + Railway deploy guide
├── LICENSE                  MIT
└── README.md
```

### Frontend — components

| Group | Files | Purpose |
|---|---|---|
| **Globes** | `GlobeView`, `VesselsGlobe`, `FlightsGlobe`, `LandGlobe` | Home / Ocean / Air / Land 3D scenes |
| **Right panels** | `VGPanel`, `FGPanel`, `LGPanel` | Fleet · event feed · trackers per globe |
| **Modals** | `LiveCallModal`, `QuickResearchModal`, `EmailComposerModal`, `OutreachSequenceModal` | Call assistant, prospect lookup, AI outreach |
| **Pipeline** | `PipelineKanban` | Drag-and-drop deal board (`@dnd-kit`) |
| **Signals** | `SignalFeed`, `SignalTicker` | Live supply chain signals + AI outreach matching |
| **Chrome** | `PortStatusBar`, `Sidebar` | Sticky header ticker, collapsible nav |
| **Inline widgets** | `TariffCalculator`, `AnalysisPanel`, `TradeDataCharts` | Home tariff widget, inline AI, Trade charts |
| **Primitives** | `ICPBadge`, `ProspectSearch`, `SaveAnalysisButton` | Score chip, NL search, analysis persister |

Pages (one file each, `src/pages/`):
`HomePage`, `FlightsPage`, `LandFreightPage`, `VesselsPage`, `TradePage`, `Account360Page`, `PerformancePage`, `MarketMapPage`, `TariffCalculatorPage`, `ResearchPage`, `PilotPage`, `SettingsPage`.

### Backend — services

| Domain | Service | Purpose |
|---|---|---|
| **CRM** | `prospectsService` | Prospect CRUD + sector aggregation |
| | `pipelineService` | Pipeline stage management |
| | `performanceService` | SDR activity tracking + KPIs |
| | `database` | Saved analyses CRUD |
| **AI** | `agentService` | Agentic Outreach orchestration |
| | `flexportAnalyzer` | Account 360 streaming analysis |
| | `claudeSynthesizer` | Sequence + objection generation |
| | `emailGenerator` | Email + sequence generation |
| | `gmailService` | Gmail outbox draft creation |
| **Market data** | `fredService` | FRED macro data + cache |
| | `tradeIntelligenceService` | FBX / SCFI / WCI / Drewry aggregation |
| | `signalsService` | NewsAPI signal scoring + urgency |
| | `portCongestionService` | Dynamic port status from signals + baseline |
| | `dataAggregator` | NewsAPI + Serper prospect enrichment |
| | `usitcService` | HS code tariff lookup (USITC HTS bundled) |

Live-stream clients (vessel WS, ADS-B fetcher, vessel cache persistence, signal scheduler) live directly in `server.js`. Data seeds live in `data/` — `seedProspects.js` (250 prospects · 15 sectors), `companies.json`, `industryInsights.json`.

---

## Engineering notes

A few non-obvious decisions worth knowing before you change them.

**AIS WebSocket resilience.** The `wss://stream.aisstream.io` connection has three layered failure modes: TCP-level zombie (NAT drops mid-flight), application-level pong timeout (server stops responding), and CONNECTING limbo (TLS handshake stalls with no `open`, no `error`, no `close`). All three are handled. A 30-second connect-timeout fires `_forceAisReconnect` if the socket can't transition to `OPEN`. A 30-second WS-ping heartbeat catches zombies. A 90-second message watchdog catches data stalls. Backoff goes 10s → 120s exponential, resets on every successful `open`. State is observable at `GET /api/settings/health`.

**Vessel cache survives reboots.** AIS positions are written to `vessel_cache` in SQLite every 5 minutes and on `SIGTERM`. On startup, `loadVesselCacheFromDb()` restores them all and stamps each with `ts: Date.now()` so they survive the 6-hour stale-purge until fresh AIS data replaces them. The vessels endpoint reports `LIVE (CACHED)` during the gap so the SDR knows the dashboard isn't fabricating positions.

**Stale-purge skips during AIS outages.** If `_aisLastMsgTs` is older than 10 minutes, the periodic cache cleanup is suspended. Otherwise a wedged WebSocket would let the 6-hour sweep wipe the DB-restored fleet 6 hours after restart and the page would silently flip to `SIMULATED`. The badge surfaces this as `AIS DOWN` (red) instead of pretending nothing happened.

**Port congestion is event-driven, not static.** `portCongestionService.js` cross-references the most recent NewsAPI signals against the port baseline. Hormuz / Red Sea / Suez badges flip color when real-world disruption news lands, not on a hardcoded schedule. The Home globe's port disruption rings render the same status.

**SQLite without WAL.** Railway's filesystem is ephemeral. WAL files outlive the main DB across redeploys and cause corrupted-header crashes on cold start. The backend explicitly does **not** set `journal_mode = WAL`. Instead it uses `db.configure('busyTimeout', 5000)` to handle write contention.

**OpenAI streaming via SSE.** Account 360 analysis, Pilot briefings, and Pilot dossiers all stream over `text/event-stream`. The frontend renders tokens as they arrive — there is no spinner-then-wall-of-text moment. Connection cleanup is wired through `AbortController` so navigating away mid-stream cancels the upstream request.

**Frontend ports.** Vite is pinned to `:5174` with `strictPort: true`. The backend default is `:5001`. Both are configurable via env, but pinning prevents the Vercel-vs-Railway URL confusion that broke deploys before.

---

## Design principles

**Live or honest.** Every data surface shows its source. `LIVE` / `LIVE (CACHED)` / `AIS DOWN` / `SIMULATED`. `LIVE` / `REF` on FX. A live-source badge on every globe. No silent fallback to fake data — the SDR knows when they're looking at sim and when they're not.

**Graceful with no keys.** The app boots and is usable with only `OPENAI_API_KEY`. Every other optional key upgrades a specific surface. Missing keys never crash a page — they downgrade a badge.

**Streaming everywhere it matters.** AI surfaces stream over SSE so the SDR can read while the model thinks. Globes refresh in place, not via page reload.

**Catalog as source of truth.** Prospects, sectors, and stages live in SQLite, seeded from a single file (`seedProspects.js`). Re-seeding is idempotent. The dashboard is a view over the catalog, not the other way around.

**Boring deploys.** Two services, two URLs, two env files. `npm run start` re-seeds on every cold start so Railway redeploys can't poison the database. The catalog is the deploy artifact.

---

## License

MIT. See [`LICENSE`](LICENSE). The codebase, the catalog, and the seeded prospect data are publicly redistributable. AI-generated outputs (Account 360 analyses, sequences, briefings) remain the property of the user account that generated them.

---

<p align="center"><sub>Built by <a href="https://github.com/AllStreets">Connor Evans</a></sub></p>
