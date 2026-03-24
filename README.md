# Flexport SDR Intelligence Hub

A full-stack sales intelligence platform built for Flexport SDRs. Combines live prospect data, AI-generated insights, global trade intelligence, live AIS vessel tracking, port disruption monitoring, tariff analysis, pipeline management, and live call assistance into a single dark-mode terminal interface.

![React](https://img.shields.io/badge/React-19-61dafb?logo=react&logoColor=white) ![Vite](https://img.shields.io/badge/Vite-7-646cff?logo=vite&logoColor=white) ![Express](https://img.shields.io/badge/Express-5-black?logo=express) ![SQLite](https://img.shields.io/badge/SQLite-3-003b57?logo=sqlite) ![OpenAI](https://img.shields.io/badge/OpenAI-GPT--4.1--mini-412991?logo=openai)

---

## Pages

| Route | Page | Description |
|---|---|---|
| `/` | Home | Interactive 3D globe with live shipping lanes and port disruption rings, signal ticker, Today's Playbook (priority follow-up list), Hot Prospects panel, Signal Feed with AI outreach matching |
| `/flights` | Air Freight | Live ADS-B globe — real aircraft via OpenSky Network OAuth2 (falls back to 200+ simulated planes on 40 global routes). Animated plane sprites with rose/violet coloring, great-circle arc trails, per-plane random cycle speeds (45–240s). Dark atmosphere, night texture. Right panel: Fleet Overview, departure/destination feed, route stats. |
| `/land` | Land Freight | Simulated land freight globe — 340 trucks on 85 global highway corridors. Truck sprites (side-profile canvas, silver for regular / orange for tank) with Y-flip for westward heading so wheels are always viewer-facing. Right panel: Fleet Overview, Carrier Watch, Hot Corridors, Live Event Feed. |
| `/vessels` | Ocean Freight | Live AIS vessel tracking globe — 200 real vessels (AISstream) or 250 simulated vessels on 62 great-circle trade routes. Animated route arcs, vessel type coloring (Container/Tanker/Bulk), port disruption rings. Right panel: Fleet Overview, live event feed, container tracker (Terminal49), vessel detail. Live/simulated badge. |
| `/trade` | Trade Intelligence Terminal | Bloomberg-style macro terminal — FRED live data, 20-route container spot rates, port congestion table, live FX rates, tariff tables, route optimizer, §301 actions, trade policy calendar, earnings trigger event monitor |
| `/account/:id` | Account 360 | Full prospect deep-dive — animated supply chain diagram with correct US port routing, streaming AI analysis, signal timeline, decision makers, call prep sheet, objection handler, outreach sequence builder, mutual action plan modal, call intelligence parser (always visible; auto-populates from Live Call notes) |
| `/performance` | SDR Performance | 365-day activity heatmap, quota attainment rings (calls, emails, demos, LinkedIn, pipeline), activity funnel, win/loss chart and logger, follow-up radar, pipeline velocity, recent activity feed |
| `/market` | Market Map | Zoomable radial SVG node graph of 250 prospects across 15 sectors (apparel, beauty, electronics, CPG, outdoor, accessories, home-goods, furniture, health, footwear, activewear, jewelry, home-textiles, pet, baby) with live pipeline stage colors, sector intelligence panel, TAM estimates, Flexport product recommendations, signal timeline per company |
| `/tariff` | Tariff Calculator | Landed cost modeling — origin country, product HS code, cargo value, weight, Ocean FCL vs Air mode; §301 + reciprocal tariff breakdown, SDR angle generator, HS code lookup |
| `/settings` | Settings | Profile, quota targets (calls, emails, demos, LinkedIn, pipeline), notifications, Live Call (mic auto-start, AI prediction frequency), appearance (accent color, density), AI model selection, API key status, data export, keyboard shortcuts reference, platform pages reference, server health |

---

## Global Modals & Keyboard Shortcuts

| Shortcut | Feature | Description |
|---|---|---|
| `Ctrl+Shift+L` | Live Call Mode | Prospect search, call timer, AI talk track, real-time objection handler, call notes that auto-populate Account 360's Call Intelligence Parser |
| `Ctrl+Shift+P` | Pipeline Kanban | Drag-and-drop deal board across 6 stages (New → Researched → Called → Demo Booked → Closed Won/Lost) with inline deal value |
| `Ctrl+Shift+B` | Battle Cards | Competitive intelligence for C.H. Robinson, Forto, DHL Global Forwarding, Expeditors International |
| `Ctrl+/` | Sidebar | Toggle collapsed/expanded |
| `Escape` | — | Close topmost open modal |

---

## Tech Stack

**Frontend** — React 19, Vite 7, React Router v7, Recharts, Three.js / react-globe.gl, @dnd-kit (Kanban drag-and-drop), react-icons/ri

**Backend** — Express 5, SQLite3, OpenAI GPT-4.1-mini (all AI features), FRED API (Federal Reserve macro data), NewsAPI (signal feed + trigger events), exchangerate-api.com + frankfurter.app (live FX rates with 1-day % change), Serper API (prospect enrichment), AISstream WebSocket (live AIS vessel positions), Terminal49 API (container tracking)

---

## Project Structure

```
.
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   │   ├── GlobeView.jsx               # Home page globe — shipping lanes, port rings, prospect arcs
│   │   │   ├── VesselsGlobe.jsx            # Ocean Freight globe — live AIS, animated great-circle routes
│   │   │   ├── VGPanel.jsx                 # Ocean Freight right panel — fleet stats, event feed, container tracker
│   │   │   ├── FlightsGlobe.jsx            # Air Freight globe — live ADS-B / simulated planes, arc trails
│   │   │   ├── FGPanel.jsx                 # Air Freight right panel
│   │   │   ├── LandGlobe.jsx               # Land Freight globe — 340 truck sprites on 85 highway corridors
│   │   │   ├── LGPanel.jsx                 # Land Freight right panel — carrier watch, hot corridors, event feed
│   │   │   ├── LiveCallModal.jsx           # Live call assistant — timer, talk track, objection AI, mic AI listener, notes
│   │   │   ├── PipelineKanban.jsx          # Drag-and-drop deal board (@dnd-kit)
│   │   │   ├── BattleCardsModal.jsx        # Competitive intelligence overlay
│   │   │   ├── OutreachSequenceModal.jsx   # AI multi-touch outreach sequence builder
│   │   │   ├── PortStatusBar.jsx           # Sticky header with port ticker + global action buttons
│   │   │   ├── Sidebar.jsx                 # Collapsible nav sidebar (Home/Air/Land/Ocean/Market/Trade/Research)
│   │   │   ├── AnalysisPanel.jsx           # Inline AI analysis on Home
│   │   │   ├── SignalFeed.jsx              # Live supply chain signals with AI outreach match
│   │   │   ├── SignalTicker.jsx            # Scrolling signal ticker (hourly refresh)
│   │   │   ├── TariffCalculator.jsx        # Inline tariff widget on Home
│   │   │   ├── ICPBadge.jsx               # Color-coded ICP score badge
│   │   │   └── ProspectSearch.jsx          # Filters + AI natural language search
│   │   ├── pages/
│   │   │   ├── HomePage.jsx / .css
│   │   │   ├── FlightsPage.jsx / .css      # Air Freight page
│   │   │   ├── LandFreightPage.jsx / .css  # Land Freight page
│   │   │   ├── VesselsPage.jsx / .css      # Ocean Freight page
│   │   │   ├── TradePage.jsx / .css
│   │   │   ├── Account360Page.jsx / .css
│   │   │   ├── PerformancePage.jsx / .css
│   │   │   ├── MarketMapPage.jsx / .css
│   │   │   ├── TariffCalculatorPage.jsx / .css
│   │   │   └── SettingsPage.jsx / .css
│   │   ├── App.jsx                         # Route layout, global modals, keyboard shortcuts
│   │   └── main.jsx
│   ├── vercel.json                         # SPA rewrite rules for client-side routing
│   └── vite.config.js
│
├── backend/
│   ├── services/
│   │   ├── prospectsService.js             # Prospect CRUD + sector aggregation
│   │   ├── pipelineService.js              # Pipeline stage management
│   │   ├── performanceService.js           # SDR activity tracking + KPIs
│   │   ├── flexportAnalyzer.js             # OpenAI analysis generation
│   │   ├── claudeSynthesizer.js            # Sequence + objection AI
│   │   ├── fredService.js                  # FRED macro data fetching + cache
│   │   ├── tradeIntelligenceService.js     # Trade data aggregation
│   │   ├── signalsService.js               # NewsAPI signal scoring + urgency rating
│   │   ├── portCongestionService.js        # Dynamic port congestion (signals-driven + baseline)
│   │   ├── dataAggregator.js               # NewsAPI + Serper prospect enrichment
│   │   ├── usitcService.js                 # HS code tariff lookup
│   │   └── database.js                     # Saved analyses CRUD
│   ├── data/
│   │   └── seedProspects.js                # 250-prospect database seed script (15 sectors)
│   ├── initDb.js                           # Schema creation + safe ALTER TABLE migrations
│   └── server.js                           # All API routes, AISstream WebSocket client, static data
│
└── DEPLOYMENT.md
```

---

## Local Development

### Prerequisites

- Node.js 20+
- OpenAI API key (required — powers all AI features)
- FRED API key (optional — macro charts fall back to cached data)
- NewsAPI key (optional — signal feed falls back to static signals)
- ExchangeRate API key (optional — FX rates fall back to static values)
- AISstream API key (optional — Ocean Command shows 250 simulated vessels without it)
- Terminal49 API key (optional — container tracker on Ocean Command requires it)

### 1. Clone and install

```bash
git clone https://github.com/AllStreets/Flexport-sales-dashboard.git
cd Flexport-sales-dashboard
```

```bash
# Backend
cd backend && npm install && cp .env.example .env
# Edit .env — add OPENAI_API_KEY at minimum
```

```bash
# Frontend
cd ../frontend && npm install
```

### 2. Initialize and seed the database

```bash
cd backend
node initDb.js
node data/seedProspects.js
```

### 3. Start both servers

```bash
# Terminal 1 — backend on http://localhost:5001
cd backend && npm run dev
```

```bash
# Terminal 2 — frontend on http://localhost:3001
cd frontend && npm run dev
```

---

## API Routes

| Method | Route | Description |
|---|---|---|
| GET | `/api/prospects` | List prospects — `sector`, `icp_min`, `lane`, `search`, `limit` filters |
| GET | `/api/prospects/:id` | Single prospect |
| GET | `/api/prospects/sectors` | Sector summary with counts and avg ICP |
| GET | `/api/market-map` | Prospects grouped by sector with pipeline stage |
| GET | `/api/globe-data` | Shipping lanes + dynamic port congestion for Home globe |
| GET | `/api/vessels` | Live AIS vessels (AISstream, ≥100 vessels) or 250 simulated vessels on 62 trade routes. `?mode=sim` forces simulated. |
| GET | `/api/flights` | Live ADS-B aircraft (OpenSky Network OAuth2) or 200+ simulated planes on 40 routes. `?mode=sim` forces simulated. |
| GET | `/api/opensky-token` | Proxies an OpenSky OAuth2 bearer token to the browser (bypasses datacenter IP restrictions) |
| GET | `/api/trucks` | 340 simulated trucks on 85 global highway corridors (4 trucks/lane) |
| GET | `/api/account360/:id` | Full account — prospect + NewsAPI signal timeline |
| GET | `/api/hot-prospects` | Top 8 by opportunity score (ICP + pipeline stage bonus) |
| GET | `/api/followup-radar` | Overdue contacts sorted by ICP score (`?days=N`) |
| GET | `/api/pipeline-velocity` | Avg days per stage + stuck deal count (`?stale_days=N`) |
| GET | `/api/pipeline` | Full pipeline across all stages |
| GET | `/api/pipeline/count` | Deal count for header badge |
| POST | `/api/pipeline` | Add deal |
| PUT | `/api/pipeline/:id` | Update stage, value, or notes |
| DELETE | `/api/pipeline/:id` | Remove deal |
| POST | `/api/analyze` | AI prospect analysis — profile, pain points, outreach angle, value props, decision makers |
| POST | `/api/call-prep` | AI call prep — opening hook, discovery questions, objection responses, CTA |
| POST | `/api/call-intelligence` | AI call notes parser — pain points, signals, objections, next steps, sentiment, deal probability |
| POST | `/api/call-predict` | AI mic listener prediction — suggested next response, predicted objection, tone recommendation |
| POST | `/api/objection` | AI objection handler — counter + follow-up question |
| POST | `/api/map-plan` | AI mutual action plan — milestone timeline + 90-day success criteria |
| POST | `/api/generate-sequence` | AI 4-touch outreach sequence (email + LinkedIn + call) |
| POST | `/api/semantic-search` | AI natural language prospect search |
| POST | `/api/signal-match` | AI maps a signal to affected sectors and Flexport talking points |
| POST | `/api/analyses` | Persist an AI analysis |
| GET | `/api/analyses` | List saved analyses |
| DELETE | `/api/analyses/:id` | Delete a saved analysis |
| PUT | `/api/analyses/:id/favorite` | Toggle favorite |
| GET | `/api/battle-cards` | Competitive intelligence cards |
| GET | `/api/trade-intelligence` | FRED macro data — trade balance, imports, capital goods, diesel, Brent crude |
| GET | `/api/signals` | Scored trade signals from NewsAPI |
| GET | `/api/trigger-events` | Supply chain trigger events from NewsAPI (30-min cache) |
| GET | `/api/fx-rates` | Live FX rates + 1-day % change (15 currency pairs) |
| GET | `/api/performance` | SDR KPIs — calls, emails, demos, pipeline value, quota % (`?retention_days=N`) |
| POST | `/api/performance/activity` | Log an SDR activity |
| GET | `/api/win-loss` | Win/loss log |
| POST | `/api/win-loss` | Add win/loss record |
| POST | `/api/route-optimize` | Transit benchmark — Flexport vs industry time + cost |
| GET | `/api/hs-lookup` | HS code tariff data (`?q=HS_CODE`) |
| POST | `/api/containers/track` | Container or B/L tracking via Terminal49 (35+ carriers) |

---

## Environment Variables

### Backend (`backend/.env`)

```
OPENAI_API_KEY=sk-...                      # Required — all AI features (GPT-4.1-mini)
FRED_API_KEY=your_fred_key                 # Optional — FRED macro data charts
NEWS_API_KEY=your_newsapi_key              # Optional — live signal feed + trigger events
SERPER_API_KEY=your_serper_key             # Optional — prospect web enrichment
EXCHANGE_RATE_API_KEY=your_key             # Optional — live FX rates
AISSTREAM_API_KEY=your_key                 # Optional — live AIS vessel positions (Ocean Freight)
TERMINAL49_API_KEY=your_key                # Optional — container tracking (Ocean Freight)
OPENSKY_CLIENT_ID=your_client_id           # Optional — live ADS-B flights (Air Freight)
OPENSKY_CLIENT_SECRET=your_client_secret   # Optional — live ADS-B flights (Air Freight)
FRONTEND_URL=https://your-app.vercel.app   # Required for production CORS
PORT=5001
```

### Frontend (`frontend/.env`)

```
VITE_API_URL=http://localhost:5001
```

---

## Design System

| Token | Value |
|---|---|
| Background | `#060b18` |
| Accent | `#00d4ff` (user-configurable in Settings → Appearance) |
| Heading / UI font | Space Grotesk |
| Numbers / code font | JetBrains Mono |
| Icon library | Remix Icons (`react-icons/ri`) |

**Pipeline stage colors** — `new` #2563eb · `researched` #6366f1 · `called` #8b5cf6 · `demo_booked` #10b981 · `closed_won` #f59e0b · `closed_lost` #475569

**Opportunity score** = `icp_score` + stage bonus (demo_booked +20, called +15, researched +10, new +5)
