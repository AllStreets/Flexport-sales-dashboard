# Flexport SDR Intelligence Hub

A full-stack sales intelligence dashboard built for Flexport SDRs. Combines live prospect data, AI-generated insights, trade intelligence, and pipeline management into a single dark-mode terminal aesthetic.

![Stack](https://img.shields.io/badge/React-19-61dafb?logo=react&logoColor=white) ![Stack](https://img.shields.io/badge/Vite-7-646cff?logo=vite&logoColor=white) ![Stack](https://img.shields.io/badge/Express-5-black?logo=express) ![Stack](https://img.shields.io/badge/SQLite-3-003b57?logo=sqlite)

---

## Pages

| Route | Page | Description |
|---|---|---|
| `/` | Home | Interactive 3D globe, live signal ticker, ICP gauge, AI streaming analysis |
| `/trade` | Trade Intelligence | Bloomberg terminal — macro indicators, tariff heatmap, HS code lookup |
| `/account/:id` | Account 360 | Supply chain diagram, AI call prep, objection handler, mutual action plan |
| `/performance` | SDR Dashboard | Activity heatmap, conversion funnel, quota ring, win/loss tracker |
| `/market` | Market Map | Radial node graph of prospects by sector with AI sector intelligence |

---

## Tech Stack

**Frontend** — React 19, Vite 7, React Router v7, Recharts, Three.js (globe), react-icons/ri

**Backend** — Express 5, SQLite3 (better-sqlite3), Anthropic Claude API (streaming), FRED API

---

## Project Structure

```
.
├── frontend/               # React + Vite app
│   ├── src/
│   │   ├── components/     # 14 shared components
│   │   ├── pages/          # 5 page components
│   │   ├── App.jsx
│   │   └── main.jsx
│   ├── vercel.json         # SPA routing config
│   └── vite.config.js
│
├── backend/                # Express API server
│   ├── services/           # 11 service modules
│   ├── data/               # Seed data + JSON fixtures
│   ├── initDb.js           # Schema migration
│   ├── server.js           # Route definitions
│   └── flexport.db         # SQLite database (gitignored)
│
└── docs/plans/             # Design + implementation docs (v2)
```

---

## Local Development

### Prerequisites

- Node.js 20+
- Anthropic API key (for AI features)
- FRED API key (optional — for macro charts)

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
# Fill in CLAUDE_API_KEY and optionally FRED_API_KEY in .env
```

```bash
# Frontend
cd ../frontend
npm install
cp .env.example .env
# VITE_API_URL defaults to http://localhost:5000
```

### 2. Initialize and seed the database

```bash
cd backend
node initDb.js
node data/seedProspects.js
```

### 3. Start both servers

```bash
# Terminal 1 — backend
cd backend
npm start
# Runs on http://localhost:5000

# Terminal 2 — frontend
cd frontend
npm run dev
# Runs on http://localhost:3000
```

---

## API Routes

| Method | Route | Description |
|---|---|---|
| GET | `/api/prospects` | List prospects with filters (`icp_min`, `sector`, `stage`) |
| GET | `/api/prospects/:id` | Single prospect with full data |
| GET | `/api/prospects/sectors` | Sector summary counts |
| GET | `/api/market-map` | Prospects grouped by sector for node graph |
| POST | `/api/analyze` | Claude AI analysis (streaming SSE) |
| POST | `/api/call-prep` | AI-generated call prep brief |
| POST | `/api/map-plan` | AI-generated mutual action plan |
| POST | `/api/objection` | AI objection handler |
| GET | `/api/trade-intelligence` | Macro trade data + tariff signals |
| GET | `/api/signals` | Live freight + market signals feed |
| GET | `/api/performance` | SDR KPIs summary |
| POST | `/api/performance/activity` | Log an activity |
| GET | `/api/win-loss` | Win/loss records |
| POST | `/api/win-loss` | Add win/loss record |
| GET/POST/PUT/DELETE | `/api/pipeline` | Pipeline CRUD |
| POST | `/api/generate-sequence` | AI outreach sequence generator |

---

## Environment Variables

### Backend (`backend/.env`)

```
CLAUDE_API_KEY=your_anthropic_api_key
FRED_API_KEY=your_fred_api_key        # optional
NEWSAPI_KEY=your_newsapi_key          # optional
PORT=5000
FRONTEND_URL=http://localhost:3000    # override in production
```

### Frontend (`frontend/.env`)

```
VITE_API_URL=http://localhost:5000
```

---

## Design System

- Background: `#060b18` (deep navy)
- Accent: `#00d4ff` (cyan)
- Fonts: Space Grotesk (UI text), JetBrains Mono (numbers/code)
- Icons: Remix Icons via `react-icons/ri`
