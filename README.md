# Flexport SDR Intelligence Hub

A full-stack sales intelligence dashboard built for Flexport SDRs. Combines live prospect data, AI-generated insights, global trade intelligence, and pipeline management into a single dark-mode terminal interface.

![React](https://img.shields.io/badge/React-19-61dafb?logo=react&logoColor=white) ![Vite](https://img.shields.io/badge/Vite-7-646cff?logo=vite&logoColor=white) ![Express](https://img.shields.io/badge/Express-5-black?logo=express) ![SQLite](https://img.shields.io/badge/SQLite-3-003b57?logo=sqlite)

---

## Pages

| Route | Page | Description |
|---|---|---|
| `/` | Home | Interactive 3D globe with live shipping lanes, signal ticker, ICP gauge, AI streaming analysis, top prospects panel, pipeline KPI strip |
| `/trade` | Trade Intelligence Terminal | Bloomberg-style macro dashboard — FRED live data, container spot rates for all 20 global routes, port congestion, FX rates, tariff tables, route optimizer, supply chain cycle times |
| `/account/:id` | Account 360 | Full prospect deep-dive — supply chain diagram, streaming AI call prep, objection handler, AI outreach sequence builder, mutual action plan modal |
| `/performance` | SDR Dashboard | Activity heatmap, 7-day outreach cadence, conversion funnel, quota attainment ring, win/loss chart, follow-up radar, pipeline velocity, pipeline Kanban |
| `/market` | Market Map | Zoomable radial SVG node graph of prospects by sector with live pipeline stage colors, sector intelligence panel, signal alerts |

---

## Tech Stack

**Frontend** — React 19, Vite 7, React Router v7, Recharts, Three.js / react-globe.gl, @dnd-kit (drag-and-drop Kanban), react-icons/ri

**Backend** — Express 5, SQLite3, Anthropic Claude API (streaming SSE), FRED API (Federal Reserve macro data), NewsAPI (signal feed)

---

## Project Structure

```
.
├── frontend/
│   ├── src/
│   │   ├── components/         # 12 shared components
│   │   │   ├── GlobeView.jsx           # Three.js globe with shipping lanes + port popups
│   │   │   ├── PipelineKanban.jsx      # Drag-and-drop deal board (@dnd-kit)
│   │   │   ├── PortStatusBar.jsx       # Sticky header with port congestion ticker
│   │   │   ├── Sidebar.jsx             # Collapsible nav sidebar
│   │   │   ├── BattleCardsModal.jsx    # Competitive intelligence overlay
│   │   │   ├── OutreachSequenceModal.jsx
│   │   │   ├── AnalysisPanel.jsx
│   │   │   ├── SignalFeed.jsx
│   │   │   ├── SignalTicker.jsx
│   │   │   ├── TariffCalculator.jsx
│   │   │   ├── ICPBadge.jsx
│   │   │   └── ProspectSearch.jsx
│   │   ├── pages/              # 5 page components (each with paired .css)
│   │   ├── App.jsx
│   │   └── main.jsx
│   ├── vercel.json             # SPA rewrite rules for client-side routing
│   └── vite.config.js
│
├── backend/
│   ├── services/               # 13 service modules
│   │   ├── prospectsService.js         # Prospect CRUD + sector aggregation
│   │   ├── pipelineService.js          # Pipeline stage management
│   │   ├── performanceService.js       # SDR activity tracking + KPIs
│   │   ├── flexportAnalyzer.js         # Claude AI streaming analysis
│   │   ├── claudeSynthesizer.js        # Sequence + objection AI generation
│   │   ├── fredService.js              # FRED macro data fetching + cache
│   │   ├── tradeIntelligenceService.js # Trade data aggregation
│   │   ├── signalsService.js           # NewsAPI signal scoring
│   │   ├── portCongestionService.js    # Port congestion data
│   │   ├── dataAggregator.js           # Multi-source prospect enrichment
│   │   ├── usitcService.js             # HS code tariff lookup
│   │   ├── emailGenerator.js           # Outreach email generation
│   │   └── database.js                 # Saved analyses CRUD
│   ├── data/
│   │   ├── seedProspects.js            # Database seed script
│   │   ├── companies.json              # Prospect seed data
│   │   └── industryInsights.json       # Sector intelligence fixtures
│   ├── initDb.js               # Schema creation + migration
│   ├── server.js               # All API route definitions
│   └── flexport.db             # SQLite database (gitignored)
│
└── docs/plans/                 # Design + implementation planning docs
```

---

## Local Development

### Prerequisites

- Node.js 20+
- Anthropic API key (required — powers all AI features)
- FRED API key (optional — macro charts fall back to cached data)
- NewsAPI key (optional — signal feed falls back to static signals)

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
# Edit .env — add CLAUDE_API_KEY at minimum
```

```bash
# Frontend
cd ../frontend
npm install
# Optional: create .env with VITE_API_URL if backend is not on port 5000
```

### 2. Initialize and seed the database

```bash
cd backend
node initDb.js
node data/seedProspects.js
```

### 3. Start both servers

```bash
# Terminal 1 — backend (http://localhost:5000)
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
| GET | `/api/market-map` | Prospects grouped by sector with live pipeline stage (LEFT JOIN) |
| GET | `/api/globe-data` | Shipping lanes + port status for globe visualization |
| POST | `/api/analyze` | Claude AI streaming analysis (SSE) |
| POST | `/api/call-prep` | AI-generated call prep brief |
| POST | `/api/map-plan` | AI mutual action plan generator |
| POST | `/api/objection` | AI objection handler |
| POST | `/api/generate-sequence` | AI outreach sequence (multi-touch email + LinkedIn) |
| GET | `/api/trade-intelligence` | FRED macro data — trade balance, imports, capital goods, diesel, Brent crude |
| GET | `/api/signals` | Scored trade signals from NewsAPI |
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
| POST | `/api/save-analysis` | Persist an AI analysis to the database |
| GET | `/api/saved-analyses` | List all saved analyses |
| POST | `/api/hs-lookup` | HS code tariff data from USITC |

---

## Environment Variables

### Backend (`backend/.env`)

```
CLAUDE_API_KEY=sk-ant-...           # Required — Anthropic API key
FRED_API_KEY=your_fred_key          # Optional — Federal Reserve macro data
NEWSAPI_KEY=your_newsapi_key        # Optional — live trade signal feed
PORT=5000                           # Default port
FRONTEND_URL=http://localhost:3000  # Override with production Vercel URL
```

### Frontend (`frontend/.env`)

```
VITE_API_URL=http://localhost:5000  # Backend URL (defaults to localhost:5000)
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
