# Flexport SDR Intelligence Hub — Design Document

**Date**: 2026-02-27
**Author**: Connor Evans
**Status**: Approved — Ready for Implementation

---

## Overview

A full-scale sales intelligence platform built specifically for Flexport Inbound SDR workflows. Built on top of the existing Express + React codebase, expanded to match and exceed the vc-intelligence-hub in scope, with an interactive 3D globe as the visual centerpiece.

The tool is designed to be demoed live in a final-round Flexport interview — demonstrating deep product knowledge, sales domain expertise, and technical initiative.

---

## Core Concept

**"Mission control for global trade prospecting."**

Not a dashboard with colored cards — a living platform that mirrors Flexport's own value proposition: visibility into global supply chains. Every feature is grounded in what an actual Flexport SDR needs: who to call, why now, what to say, and how to track it.

---

## Tech Stack

### Frontend
- React 19.2.0 (existing)
- Vite 7 (existing)
- Tailwind CSS 4 (existing)
- **Globe.gl** (new) — Three.js-based WebGL globe
- **Recharts** (new) — Trade data charts
- **@dnd-kit** (new) — Drag-and-drop pipeline kanban

### Backend
- Node.js + Express 5 (existing)
- SQLite 3 (existing, expanded schema)
- Axios (existing)

### External APIs
- OpenAI GPT-4-turbo (existing) — AI analysis + outreach sequences
- NewsAPI (existing) — Supply chain urgency signals
- Serper API (existing) — Prospect research
- **FRED API** (new) — US import/export volume data by commodity
- **RapidAPI** (new) — Import records / trade intelligence

---

## Database Schema (5 Tables)

### 1. `prospects`
```sql
CREATE TABLE prospects (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  sector TEXT,                    -- e-commerce, DTC, CPG, apparel, electronics, etc.
  hq_location TEXT,               -- City, State
  estimated_revenue TEXT,         -- "$10M-$50M", "$50M-$200M", etc.
  employee_count TEXT,
  shipping_volume_estimate TEXT,  -- "Low", "Medium", "High", "Very High"
  import_origins TEXT,            -- JSON array: ["China", "Vietnam", "India"]
  primary_lanes TEXT,             -- JSON array: ["Asia-US West Coast", "Europe-US East"]
  icp_score INTEGER,              -- 1-100 Flexport ICP fit score
  likely_forwarder TEXT,          -- Estimated current freight forwarder
  website TEXT,
  description TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
)
```

### 2. `analyses`
```sql
CREATE TABLE analyses (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  prospect_id INTEGER REFERENCES prospects(id),
  company_name TEXT NOT NULL,
  profile TEXT,
  pain_points TEXT,               -- JSON array
  tech_maturity TEXT,
  outreach_angle TEXT,
  decision_makers TEXT,           -- JSON array of {title, concerns[]}
  icp_breakdown TEXT,             -- JSON: {fit_score, reasoning, key_signals}
  flexport_value_props TEXT,      -- JSON array of relevant Flexport features
  analysis_data TEXT,             -- Full JSON blob
  is_favorite BOOLEAN DEFAULT 0,
  timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
)
```

### 3. `pipeline`
```sql
CREATE TABLE pipeline (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  prospect_id INTEGER REFERENCES prospects(id),
  company_name TEXT NOT NULL,
  stage TEXT DEFAULT 'new',       -- new, researched, called, demo_booked, closed_won, closed_lost
  notes TEXT,
  next_action TEXT,
  next_action_date TEXT,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
)
```

### 4. `news_signals`
```sql
CREATE TABLE news_signals (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  headline TEXT NOT NULL,
  summary TEXT,
  url TEXT,
  source TEXT,
  published_at TEXT,
  urgency_score INTEGER,          -- 1-10 (10 = highest urgency for SDR)
  urgency_reason TEXT,            -- Why this is an urgency signal
  affected_lanes TEXT,            -- JSON array of affected shipping lanes
  affected_sectors TEXT,          -- JSON array of prospect sectors affected
  cached_at DATETIME DEFAULT CURRENT_TIMESTAMP
)
```

### 5. `trade_data_cache`
```sql
CREATE TABLE trade_data_cache (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  series_id TEXT NOT NULL,        -- FRED series ID
  data_json TEXT NOT NULL,        -- Full FRED response
  expires_at DATETIME,
  cached_at DATETIME DEFAULT CURRENT_TIMESTAMP
)
```

---

## API Endpoints (15 Total)

### Prospect Management
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/prospects` | Paginated, filterable prospect list. Params: `sector`, `icp_min`, `lane`, `search`, `limit`, `offset` |
| GET | `/api/prospects/:id` | Single prospect with full metadata |
| GET | `/api/prospects/sectors` | List all sectors with counts |

### Intelligence
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/analyze` | Full AI intelligence report for a prospect |
| GET | `/api/analyses` | All saved analyses |
| DELETE | `/api/analyses/:id` | Delete saved analysis |
| PUT | `/api/analyses/:id/favorite` | Toggle favorite |

### Globe & Signals
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/globe-data` | Shipping lanes, port coords, disruption hotspots |
| GET | `/api/signals` | Supply chain urgency signals from NewsAPI |
| GET | `/api/trade-data/:commodity` | FRED import/export volume series |

### Pipeline
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/pipeline` | All pipeline entries by stage |
| POST | `/api/pipeline` | Add prospect to pipeline |
| PUT | `/api/pipeline/:id` | Update stage, notes, next action |
| DELETE | `/api/pipeline/:id` | Remove from pipeline |

### Outreach
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/generate-sequence` | AI multi-touch email+call outreach sequence |
| GET | `/api/battle-cards` | Competitive positioning cards |

---

## Feature Set

### 1. Interactive Globe (Hero Feature)
- **Library**: Globe.gl (Three.js WebGL)
- **Default state**: Slowly rotating Earth, major shipping lanes rendered as neon blue animated arcs
- **Shipping lanes shown**: Asia-US West Coast, China-Rotterdam, SE Asia-US East Coast, India-US, Europe-US East, etc.
- **Port disruption hotspots**: Pulsing dots at major ports (LA/Long Beach, Rotterdam, Shanghai, Singapore, Felixstowe). Color = health status (green=clear, amber=congestion, red=disruption). Data sourced from news signals.
- **Prospect selection mode**: When a prospect is selected, globe zooms to their HQ + highlights their estimated import origin countries. Animated arcs draw from origin countries → US port of entry, sized by estimated shipping volume.
- **Click interaction**: Click any port hotspot → sidebar panel with related news signals + urgency score
- **Performance**: Globe.gl handles WebGL efficiently; runs at 60fps on modern hardware

### 2. Prospect Intelligence Engine
- **Database**: 150+ Flexport ICP prospects
  - E-commerce brands: Allbirds, Gymshark, Casper, Away, Warby Parker, Glossier, Bombas, Everlane, Faherty, Cotopaxi, Ridge Wallet, Mejuri
  - DTC importers: Dollar Shave Club, Native, Function of Beauty, Brooklinen, Parachute, Buffy
  - CPG brands: Liquid Death, Oatly, Poppi, Olipop, Fishwife, Graza
  - Apparel: Vuori, Outdoor Voices, Marine Layer, Faherty, Cuyana
  - Electronics/Hardware: Anker, Peak Design, DJI-competing brands
  - Furniture/Home: Article, Floyd, Burrow, Interior Define
  - Mid-market importers: Various $10M-$200M revenue companies across sectors
- **ICP Scoring**: Algorithm scores 1-100 based on: sector fit, revenue range, international sourcing signals, growth indicators, tech maturity
- **AI Analysis** (updated prompts for Flexport context):
  - Company profile
  - Supply chain pain points specific to their business model
  - Tech/logistics maturity assessment
  - Flexport-specific outreach angle (references Flexport's actual value props: visibility, customs clearance speed, cost transparency)
  - Decision makers for freight decisions (VP Supply Chain, Head of Operations, CFO, Founder/CEO for SMBs)
  - Relevant Flexport features for this prospect

### 3. Supply Chain Signal Feed
- Real-time news pulled from NewsAPI filtered for supply chain, freight, logistics, tariff keywords
- Each article scored 1-10 for SDR urgency (AI-scored via OpenAI)
- Urgency reasons: "Port congestion on this prospect's likely lane", "Tariff increase affecting their sector", "Competitor freight forwarder outage", etc.
- Color-coded: red = act now, amber = monitor, green = positive signal (expansion = buying signal)
- Signals matched to prospects in database by sector + lane

### 4. FRED Trade Data Dashboard
- Charts using Recharts + FRED API data
- Visualizations:
  - US imports by commodity (electronics, apparel, furniture) — bar/line chart
  - Trade deficit trends — area chart
  - Tariff impact by HS code category
- Narrated context: "Electronics imports up 23% YoY — your apparel prospects are competing for the same shipping capacity"
- Refreshes weekly, cached in `trade_data_cache`

### 5. Tariff Impact Calculator
- Input: Prospect sector, estimated import volume
- Pulls relevant FRED tariff/trade data
- Calculates: estimated annual duty cost, potential savings via Flexport's bonded warehouse + customs expertise
- Output: "At $2M annual import volume, [Company] likely pays $340K/year in duties. Flexport's duty deferral program could save them $85K."

### 6. Pipeline Kanban
- 6 stages: New → Researched → Called → Demo Booked → Closed Won → Closed Lost
- Drag-and-drop cards between stages (@dnd-kit)
- Each card: company name, ICP score, last activity, next action + date
- Click card → full prospect view
- Stage counts in column headers
- Motivational metric: "You've moved X prospects to Demo Booked this week"

### 7. Competitive Battle Cards
- Static data (well-researched) for 4 competitors: C.H. Robinson, Forto, Convoy, DHL Global Forwarding
- Each card: their strengths, their weaknesses, how Flexport wins, trigger phrases to listen for, talk track
- Accessible via modal or sidebar — quick reference during a call

### 8. AI Outreach Sequence Builder
- Select a prospect → generates a 4-touch outreach sequence:
  - Touch 1: Cold email (personalized to their pain points)
  - Touch 2: LinkedIn connection message
  - Touch 3: Follow-up email with supply chain insight
  - Touch 4: Break-up email with ROI hook
- Each touch references specific Flexport value props and the prospect's identified pain points
- Export as text file or copy individual touches

### 9. ROI Calculator (Enhanced)
- Existing ROI calculator rewritten for Flexport value props:
  - Freight cost savings (vs benchmark rates)
  - Customs clearance time savings
  - Visibility/ops team hours saved
  - Duty deferral benefit
  - Shipment delay cost reduction
- Sliders: import volume, shipment frequency, current freight spend, customs delays per month

### 10. Port Status Bar
- Persistent bar at top of app (or collapsible)
- 8 major ports: LA/Long Beach, Shanghai, Rotterdam, Singapore, Hong Kong, Felixstowe, Hamburg, Savannah
- Status indicator per port: color dot + current congestion level
- Data sourced from news signals (AI-extracted) or static known data
- Click → relevant news and signal details

---

## UI Design System

### Color Palette
```
Background:      #060b18  (near-black blue)
Surface:         rgba(255,255,255,0.04)  (glassmorphism)
Border:          rgba(255,255,255,0.08)
Primary:         #2563EB  (Flexport blue)
Accent:          #00d4ff  (neon cyan — globe arcs)
Success/Positive: #10b981 (green)
Warning/Urgency: #f59e0b  (amber)
Danger/Disruption: #ef4444 (red)
Text primary:    #f1f5f9
Text secondary:  #94a3b8
Text muted:      #475569
```

### Typography
```
Display/Hero:    Space Grotesk, 700 weight
Headings:        Space Grotesk, 600 weight
Body:            Inter, 400/500 weight
Metrics/Numbers: JetBrains Mono (monospace)
```

### Motion & Animation
- Particle field background: 80 slowly drifting dots, CSS animation, zero JS overhead
- Card entrance: `opacity: 0 → 1` + `translateY(16px → 0)`, staggered 60ms delay per card
- Number counters: count up from 0 on mount (requestAnimationFrame)
- Globe arcs: draw animation on load + on prospect selection
- Disruption hotspots: `@keyframes pulse` in red/amber
- Pipeline drag: smooth spring physics via @dnd-kit
- Signal feed: new items fade in from top
- All transitions: `cubic-bezier(0.4, 0, 0.2, 1)`, 200-300ms

### Layout
```
Header (60px):   Port status bar + app title + pipeline button
Globe (55vh):    Full-width hero globe section
Below globe:     Two-column layout
  Left (60%):    Prospect search + intelligence panel
  Right (40%):   Signal feed + trade data mini-charts
Bottom drawer:   Pipeline kanban (toggle open/close)
Modals:          Battle cards, email sequences, compare, full analysis
```

### Glassmorphism Cards
```css
background: rgba(255, 255, 255, 0.04);
backdrop-filter: blur(20px);
border: 1px solid rgba(255, 255, 255, 0.08);
border-radius: 16px;
```

---

## Prospect Database Plan (150+ companies)

Categories and representative companies:

**E-commerce / DTC** (40 companies)
Allbirds, Gymshark, Away, Casper, Warby Parker, Glossier, Bombas, Everlane, Faherty, Cotopaxi, Ridge Wallet, Mejuri, Cuyana, Outdoor Voices, Marine Layer, Vuori, Patagonia-competitor brands, Thousand Fell, Rothy's, Quay Australia, Pura Vida, Public Goods, Koio, Veja-competing, Thursday Boot, Wolf & Shepherd, Atoms, Oliver Cabell

**CPG / Consumer Goods** (30 companies)
Liquid Death, Oatly, Poppi, Olipop, Fishwife, Graza, Haus, Acid League, Muddy Bites, Magic Spoon, Koia, Simple Mills, Hu Chocolate, Chomps, RX Bar-alts, Once Upon a Farm, Munk Pack

**Electronics / Hardware** (20 companies)
Anker-competing brands, Peak Design, DJI-US alts, Jackery, Govee, Wyze, Fossil Group alts, Tile-competing, Insta360-competing

**Furniture / Home** (20 companies)
Article, Floyd, Burrow, Interior Define, Parachute, Brooklinen, Buffy, Saatva, Purple-competing, Joybird, Medley, Campaign Furniture

**Beauty / Personal Care** (20 companies)
Function of Beauty, Native, Dollar Shave Club, Flamingo, Billie-competing, Malin+Goetz, Aesop-alts, Tatcha-alts, Glow Recipe, Hero Cosmetics

**Mid-Market Importers** (20+ companies)
Various $10M-$200M companies across sectors with high import dependency

Each record includes: name, sector, HQ, estimated revenue range, employee count, import origins (countries), primary shipping lanes, ICP score, likely current forwarder, description.

---

## Implementation Order

1. **Data layer**: Seed 150+ prospects into SQLite, set up all 5 tables
2. **Backend**: Implement all 15 API endpoints
3. **Globe**: Get Globe.gl rendering with shipping lanes + port hotspots
4. **Core intelligence**: Rewrite AI analysis prompts for Flexport context
5. **Signal feed**: NewsAPI integration with urgency scoring
6. **FRED trade data**: Charts + tariff calculator
7. **Pipeline kanban**: Drag-and-drop
8. **Outreach + battle cards**: AI sequences + static battle cards
9. **UI polish**: Particle background, glassmorphism, animations, responsive
10. **Deploy**: Frontend → Vercel, Backend → Railway

---

## Success Criteria

When demoed live in a Flexport interview, this tool should:
- Load with the globe already rotating and arcs animating
- Allow the interviewer to select any company and watch it come alive on the globe
- Show real supply chain urgency signals from this week's news
- Generate an AI outreach sequence in real-time for a prospect they name
- Demonstrate deep understanding of Flexport's ICP, value props, and sales motion
- Feel more polished and purposeful than anything they've seen from a candidate

---

*Built for Flexport Final Round Interview — February 2026*
