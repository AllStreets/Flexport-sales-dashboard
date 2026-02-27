# Flexport SDR Intelligence Hub

An AI-powered sales intelligence platform built for Flexport SDRs. Search and profile 45 high-ICP import/export prospects, run GPT-4 company analysis, track a drag-and-drop pipeline, monitor real-time supply chain signals, and generate personalized outreach sequences — all in one dark-themed dashboard.

---

## Features

- **3D Interactive Globe** — Live shipping lane arcs and port congestion hotspots. Click any prospect to highlight their import origin routes. Click the globe to go fullscreen.
- **45-Prospect Database** — Pre-seeded with ICP-scored importers across e-commerce, apparel, electronics, food & bev, industrial, beauty, and home goods.
- **GPT-4 Company Analysis** — One-click AI analysis generating supply chain pain points, decision maker profiles, ICP breakdown, and Flexport value prop mapping.
- **Drag-and-Drop Pipeline Kanban** — Move prospects across New → Researched → Called → Demo Booked → Closed Won/Lost with live DB persistence.
- **Supply Chain Signal Feed** — NewsAPI headlines scored 1–10 for urgency by GPT-4, with ACT NOW / MONITOR / POSITIVE classification.
- **FRED Trade Data Charts** — Live US import charts (Capital Goods, Consumer Goods, Trade Balance, Total Imports) pulled from the St. Louis Fed API.
- **Tariff ROI Calculator** — Sector-specific tariff rate slider showing potential Flexport savings.
- **Outreach Sequence Generator** — GPT-4 generates a 4-touch email/LinkedIn/call sequence tailored to the prospect's supply chain situation.
- **Competitor Battle Cards** — C.H. Robinson, Forto, DHL Global Forwarding, and Convoy — with talk tracks and trigger phrases.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React 19, Vite 7, Tailwind 4 |
| 3D Globe | react-globe.gl, three.js |
| Charts | Recharts |
| Drag & Drop | @dnd-kit/core, @dnd-kit/sortable |
| Backend | Node.js, Express 5 |
| Database | SQLite 3 (5-table schema) |
| AI | OpenAI GPT-4-turbo |
| News | NewsAPI |
| Search Context | Serper API |
| Trade Data | FRED API (St. Louis Fed) |

---

## Local Development

### Prerequisites

- Node.js 18+
- API keys for: OpenAI, NewsAPI, Serper, FRED

### Backend

```bash
cd backend
cp .env.example .env
# Fill in your API keys in .env
npm install
npm run init-db   # creates the 5-table SQLite schema
npm run seed      # loads 45 prospects
npm run dev       # starts on port 5001
```

### Frontend

```bash
cd frontend
cp .env.example .env
# Set VITE_API_URL=http://localhost:5001
npm install
npm run dev       # starts on port 5173 (or next available)
```

Open `http://localhost:5173` (or whichever port Vite picks).

---

## Project Structure

```
Flexport-sales-dashboard/
├── backend/
│   ├── server.js                      # Express app, 15 API endpoints
│   ├── initDb.js                      # Creates 5 SQLite tables
│   ├── data/
│   │   └── seedProspects.js           # 45-prospect seed (idempotent)
│   ├── services/
│   │   ├── prospectsService.js        # Prospect queries + filtering
│   │   ├── flexportAnalyzer.js        # GPT-4 analysis
│   │   ├── signalsService.js          # NewsAPI + urgency scoring
│   │   ├── fredService.js             # FRED trade data + 7-day cache
│   │   ├── pipelineService.js         # Pipeline CRUD
│   │   ├── database.js                # Analyses CRUD
│   │   └── dataAggregator.js          # News + search context aggregation
│   ├── tests/
│   │   └── api.test.js                # 7 API tests (Jest + Supertest)
│   ├── .env.example
│   └── package.json
├── frontend/
│   ├── src/
│   │   ├── App.jsx                    # Root layout + state
│   │   ├── components/
│   │   │   ├── GlobeView.jsx/css      # 3D globe with arc lanes
│   │   │   ├── ProspectSearch.jsx/css # Search + sector/ICP filters
│   │   │   ├── AnalysisPanel.jsx/css  # AI analysis display
│   │   │   ├── PipelineKanban.jsx/css # Drag-and-drop pipeline
│   │   │   ├── SignalFeed.jsx/css     # Supply chain news feed
│   │   │   ├── TradeDataCharts.jsx/css# FRED line charts
│   │   │   ├── TariffCalculator.jsx/css # ROI calculator
│   │   │   ├── OutreachSequenceModal.jsx/css
│   │   │   ├── BattleCardsModal.jsx/css
│   │   │   ├── PortStatusBar.jsx/css  # Sticky header
│   │   │   └── ICPBadge.jsx           # ICP score chip
│   │   └── index.css                  # Design system + particles
│   ├── vercel.json
│   ├── .env.example
│   └── package.json
└── README.md
```

---

## API Endpoints

| Method | Endpoint | Description |
|---|---|---|
| GET | `/api/prospects` | List prospects (filter: `sector`, `icp_min`, `lane`, `search`) |
| GET | `/api/prospects/sectors` | Sector list with counts |
| GET | `/api/prospects/:id` | Single prospect |
| GET | `/api/globe-data` | Shipping lanes + port status |
| POST | `/api/analyze` | GPT-4 company analysis |
| GET | `/api/analyses` | Saved analyses |
| POST | `/api/analyses` | Save an analysis |
| DELETE | `/api/analyses/:id` | Delete analysis |
| PUT | `/api/analyses/:id/favorite` | Toggle favorite |
| GET | `/api/signals` | Supply chain signals (1-hr cache) |
| GET | `/api/trade-data/:commodity` | FRED data (`electronics`, `apparel`, `trade_balance`, `total_imports`) |
| GET | `/api/pipeline` | Pipeline grouped by stage |
| POST | `/api/pipeline` | Add prospect to pipeline |
| PUT | `/api/pipeline/:id` | Update stage |
| DELETE | `/api/pipeline/:id` | Remove from pipeline |
| POST | `/api/generate-sequence` | GPT-4 outreach sequence |
| GET | `/api/battle-cards` | Competitor battle cards |

---

## Environment Variables

### Backend

```env
OPENAI_API_KEY=        # platform.openai.com
NEWS_API_KEY=          # newsapi.org
SERPER_API_KEY=        # serper.dev
FRED_API_KEY=          # fred.stlouisfed.org/docs/api
FRONTEND_URL=          # your Vercel URL (for CORS)
PORT=5001
```

### Frontend

```env
VITE_API_URL=          # your Railway backend URL
```

---

## Deployment

**Backend → Railway**

1. New Project → Deploy from GitHub → set Root Directory: `backend`
2. Add all 5 backend environment variables (do **not** set PORT — Railway injects it)
3. Generate domain → copy the URL

**Frontend → Vercel**

1. New Project → Import from GitHub → set Root Directory: `frontend`
2. Add `VITE_API_URL` = your Railway URL
3. Deploy → copy Vercel URL

**After both are live:** set `FRONTEND_URL` in Railway to your Vercel URL and redeploy.

> The start script automatically initializes the database and seeds 45 prospects on every deploy.

---

## Running Tests

```bash
cd backend
npm test
# 7 tests: Prospects API (4) + Pipeline API (3)
```
