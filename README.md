# Flexport SDR Intelligence Hub

A full-stack sales intelligence dashboard built for Flexport SDRs. Combines live prospect data, AI-generated insights, global trade intelligence, tariff analysis, and pipeline management into a single dark-mode terminal interface.

![React](https://img.shields.io/badge/React-19-61dafb?logo=react&logoColor=white) ![Vite](https://img.shields.io/badge/Vite-7-646cff?logo=vite&logoColor=white) ![Express](https://img.shields.io/badge/Express-5-black?logo=express) ![SQLite](https://img.shields.io/badge/SQLite-3-003b57?logo=sqlite) ![OpenAI](https://img.shields.io/badge/OpenAI-GPT--4.1--mini-412991?logo=openai)

---

## Pages

| Route | Page | Description |
|---|---|---|
| `/` | Home | Interactive 3D globe with live shipping lanes, signal ticker, ICP prospect search with AI natural language mode, AI streaming analysis, Hot Prospects panel |
| `/market` | Market Map | Zoomable radial SVG node graph of prospects by sector with live pipeline stage colors, sector intelligence panel, signal alerts |
| `/tariff` | Tariff Calculator | Landed cost calculator — origin country, product category (HS code), cargo value, weight, Ocean FCL vs Air Freight mode, §301 + reciprocal tariff breakdown, SDR angle generator, HS code lookup |
| `/performance` | SDR Dashboard | Activity heatmap, 7-day outreach cadence, follow-up radar, pipeline velocity, quota attainment ring, recent activity feed (today only · resets midnight EST), win/loss chart and logger, outreach stats with activity notes history |
| `/trade` | Trade Intelligence | Bloomberg-style macro terminal — FRED live data, container spot rates for 20 global routes, port congestion, live FX rates with 1-day % change, tariff tables, route optimizer, earnings & trigger event monitor |
| `/account/:id` | Account 360 | Full prospect deep-dive — supply chain diagram, streaming AI analysis, signal timeline, decision makers, call prep sheet, objection handler, outreach sequence builder, mutual action plan modal, call intelligence parser |

---

## Tech Stack

**Frontend** — React 19, Vite 7, React Router v7, Recharts, Three.js / react-globe.gl, @dnd-kit (drag-and-drop Kanban), react-icons/ri

**Backend** — Express 5, SQLite3, OpenAI GPT-4.1-mini (all AI features), FRED API (Federal Reserve macro data), NewsAPI (signal feed + trigger events), exchangerate-api.com + frankfurter.app (live FX rates with 1-day change), Serper API (prospect enrichment)

---

## Project Structure

```
.
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   │   ├── GlobeView.jsx               # Three.js globe with shipping lanes + port popups
│   │   │   ├── PipelineKanban.jsx          # Drag-and-drop deal board (@dnd-kit)
│   │   │   ├── PortStatusBar.jsx           # Sticky header with port congestion ticker
│   │   │   ├── Sidebar.jsx                 # Collapsible nav sidebar
│   │   │   ├── BattleCardsModal.jsx        # Competitive intelligence overlay
│   │   │   ├── OutreachSequenceModal.jsx   # AI multi-touch outreach sequence
│   │   │   ├── AnalysisPanel.jsx           # Inline AI analysis on Home
│   │   │   ├── SignalFeed.jsx              # Live supply chain signals + AI Match
│   │   │   ├── SignalTicker.jsx            # Scrolling signal ticker (hourly refresh)
│   │   │   ├── TariffCalculator.jsx        # Inline tariff widget on Home
│   │   │   ├── SaveAnalysisButton.jsx      # Persist AI analysis to DB
│   │   │   ├── ICPBadge.jsx
│   │   │   └── ProspectSearch.jsx          # Filters + AI natural language search mode
│   │   ├── pages/                          # 6 page components (each with paired .css)
│   │   │   ├── HomePage.jsx
│   │   │   ├── MarketMapPage.jsx
│   │   │   ├── TariffCalculatorPage.jsx
│   │   │   ├── PerformancePage.jsx
│   │   │   ├── TradePage.jsx
│   │   │   └── Account360Page.jsx
│   │   ├── App.jsx
│   │   └── main.jsx
│   ├── vercel.json                         # SPA rewrite rules for client-side routing
│   └── vite.config.js
│
├── backend/
│   ├── services/
│   │   ├── prospectsService.js             # Prospect CRUD + sector aggregation
│   │   ├── pipelineService.js              # Pipeline stage management
│   │   ├── performanceService.js           # SDR activity tracking + KPIs (Monday week boundary)
│   │   ├── flexportAnalyzer.js             # OpenAI streaming analysis
│   │   ├── claudeSynthesizer.js            # Sequence + objection AI generation
│   │   ├── fredService.js                  # FRED macro data fetching + cache
│   │   ├── tradeIntelligenceService.js     # Trade data aggregation
│   │   ├── signalsService.js               # NewsAPI signal scoring + urgency rating
│   │   ├── portCongestionService.js        # Port congestion data
│   │   ├── dataAggregator.js               # NewsAPI + Serper prospect enrichment
│   │   ├── usitcService.js                 # HS code tariff lookup
│   │   ├── emailGenerator.js               # Outreach email generation
│   │   └── database.js                     # Saved analyses CRUD
│   ├── data/
│   │   ├── seedProspects.js                # Database seed script
│   │   ├── companies.json                  # Prospect seed data
│   │   └── industryInsights.json           # Sector intelligence fixtures
│   ├── initDb.js                           # Schema creation + migration
│   ├── server.js                           # All API route definitions
│   └── flexport.db                         # SQLite database (gitignored)
│
├── MostRecentTest.md                       # Latest audit + API health check results
├── DEPLOYMENT.md
└── docs/plans/
```

---

## Local Development

### Prerequisites

- Node.js 20+
- OpenAI API key (required — powers all AI features)
- FRED API key (optional — macro charts fall back to cached data)
- NewsAPI key (optional — signal feed falls back to static signals)
- ExchangeRate API key (optional — FX rates fall back to static values)

### 1. Clone and install

```bash
git clone https://github.com/AllStreets/Flexport-sales-dashboard.git
cd Flexport-sales-dashboard
```

```bash
# Backend
cd backend
npm install
cp .env.example .env
# Edit .env — add OPENAI_API_KEY at minimum
```

```bash
# Frontend
cd ../frontend
npm install
# Optional: create .env with VITE_API_URL if backend is not on port 5001
```

### 2. Initialize and seed the database

```bash
cd backend
node initDb.js
node data/seedProspects.js
```

### 3. Start both servers

```bash
# Terminal 1 — backend (http://localhost:5001)
cd backend
npm run dev
```

```bash
# Terminal 2 — frontend (http://localhost:3000)
cd frontend
npm run dev
```

---

## API Routes

| Method | Route | Description |
|---|---|---|
| GET | `/api/prospects` | List prospects — supports `sector`, `icp_min`, `lane`, `search`, `limit` filters |
| GET | `/api/prospects/:id` | Single prospect with full enriched data |
| GET | `/api/prospects/sectors` | Sector summary with counts |
| GET | `/api/market-map` | Prospects grouped by sector with live pipeline stage |
| GET | `/api/globe-data` | Shipping lanes + port status for globe visualization |
| GET | `/api/account360/:id` | Full account data — prospect + NewsAPI signal timeline |
| GET | `/api/hot-prospects` | Top 8 opportunity-scored prospects (ICP score + stage bonus) |
| POST | `/api/analyze` | OpenAI streaming AI analysis (SSE) |
| POST | `/api/call-prep` | AI-generated call prep brief |
| POST | `/api/map-plan` | AI mutual action plan generator |
| POST | `/api/objection` | AI objection handler |
| POST | `/api/generate-sequence` | AI outreach sequence (multi-touch email + LinkedIn) |
| POST | `/api/semantic-search` | AI natural language prospect search — parses query to filters |
| POST | `/api/signal-match` | AI maps a signal to affected sectors, talking points, Flexport angle |
| POST | `/api/call-intelligence` | AI extracts pain points, objections, signals, next steps from call notes |
| GET | `/api/trade-intelligence` | FRED macro data — trade balance, imports, capital goods, diesel, Brent crude |
| GET | `/api/signals` | Scored trade signals from NewsAPI |
| GET | `/api/trigger-events` | Supply chain earnings + trigger events from NewsAPI (30-min cache) |
| GET | `/api/fx-rates` | Live FX rates from exchangerate-api.com + 1-day % change via frankfurter.app |
| GET | `/api/performance` | SDR KPI summary — calls, emails, demos, pipeline value, quota % |
| POST | `/api/performance/activity` | Log an SDR activity |
| GET | `/api/win-loss` | Win/loss records |
| POST | `/api/win-loss` | Add win/loss record |
| GET | `/api/pipeline` | Full pipeline with all stages |
| POST | `/api/pipeline` | Add deal to pipeline |
| PUT | `/api/pipeline/:id` | Update deal stage or notes |
| DELETE | `/api/pipeline/:id` | Remove deal from pipeline |
| POST | `/api/route-optimize` | Transit benchmark comparison for a shipping route |
| GET | `/api/followup-radar` | Prospects with no contact in 3+ days, sorted by ICP score |
| GET | `/api/pipeline-velocity` | Avg days per stage + stuck deal count |
| GET | `/api/hs-lookup` | HS code tariff data lookup (`?q=HS_CODE`) |
| POST | `/api/analyses` | Persist an AI analysis to the database |
| GET | `/api/saved-analyses` | List all saved analyses |

---

## Environment Variables

### Backend (`backend/.env`)

```
OPENAI_API_KEY=sk-...                       # Required — powers all AI features
FRED_API_KEY=your_fred_key                  # Optional — Federal Reserve macro data
NEWS_API_KEY=your_newsapi_key               # Optional — live signal feed + trigger events
SERPER_API_KEY=your_serper_key              # Optional — prospect web enrichment
EXCHANGE_RATE_API_KEY=your_key             # Optional — live FX rates (free at exchangerate-api.com)
PORT=5001                                   # Default port
FRONTEND_URL=http://localhost:3000          # Override with production Vercel URL
```

### Frontend (`frontend/.env`)

```
VITE_API_URL=http://localhost:5001          # Backend URL (defaults to localhost:5000)
```

---

## Design System

| Token | Value |
|---|---|
| Background | `#060b18` (deep navy) |
| Accent | `#00d4ff` (cyan) |
| Heading / UI font | Space Grotesk |
| Numbers / code font | JetBrains Mono |
| Icon library | Remix Icons (`react-icons/ri`) |

Stage colors — `new` #2563eb · `researched` #6366f1 · `called` #8b5cf6 · `demo_booked` #10b981 · `closed_won` #f59e0b · `closed_lost` #475569

Opportunity score = `icp_score + stage_bonus` (demo_booked +20, called +15, researched +10, new +5)
