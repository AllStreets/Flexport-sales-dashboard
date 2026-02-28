# Flexport SDR Intelligence Hub v2 — Design Document
**Date:** 2026-02-27
**Status:** Approved

---

## Overview

Expand the existing single-page SDR Intelligence Hub into a multi-page application with a collapsible sidebar, four new full pages, and a suite of enhanced features across all views. The guiding aesthetic principle is "living and breathing" — data moves, pulses, streams, and responds. The design language stays consistent: `#060b18` background, glass-card surfaces, `--accent: #00d4ff`, Space Grotesk headings, JetBrains Mono for numbers.

---

## Architecture

### Navigation
- Add `react-router-dom` for URL-based routing
- Collapsible sidebar: 60px (icon-only) / 220px (icon + label), toggled by hamburger in PortStatusBar
- PortStatusBar spans full width at top; sidebar below it on the left; page content fills remaining space
- Sidebar routes: Home (`/`) · Trade Intelligence (`/trade`) · Account 360 (`/account/:id`) · SDR Dashboard (`/performance`) · Market Map (`/market`)
- Active route highlighted with `--accent` left border and glow

### New Frontend Dependencies
- `react-router-dom` — routing only; no other heavy additions

### New Backend Endpoints
| Method | Route | Purpose |
|--------|-------|---------|
| GET | `/api/trade-intelligence` | Multiple FRED series + derived metrics in one call |
| GET | `/api/account360/:id` | Aggregated prospect deep-dive (news + analysis + signals) |
| GET | `/api/performance` | SDR activity + pipeline metrics from DB |
| POST | `/api/performance/activity` | Log a call/email/demo activity |
| GET | `/api/market-map` | Sector breakdown with prospect counts + ICP averages |
| POST | `/api/call-prep` | AI-generated call prep sheet for a prospect |
| POST | `/api/objection` | AI objection counter-response |
| POST | `/api/map-plan` | AI mutual action plan generator |
| GET | `/api/win-loss` | Fetch win/loss records |
| POST | `/api/win-loss` | Log a win or loss |
| GET | `/api/hs-lookup` | HS code → tariff rate lookup |
| POST | `/api/route-optimize` | Origin + destination → route comparison |
| POST | `/api/first-line` | AI personalized cold email opening line |

### New DB Tables
```sql
CREATE TABLE sdr_activities (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  type TEXT NOT NULL,           -- 'call' | 'email' | 'demo' | 'linkedin'
  prospect_id INTEGER,
  company_name TEXT,
  date TEXT NOT NULL,           -- ISO date
  notes TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE win_loss (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  company_name TEXT NOT NULL,
  outcome TEXT NOT NULL,        -- 'won' | 'lost'
  stage_reached TEXT,
  competitor TEXT,
  reason TEXT,
  deal_value INTEGER,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

---

## Page Designs

### 1. Home Page (Enhanced)

**Globe enhancements:**
- Disrupted/congested ports emit pulsing red/amber ring animations (`ringsData` with propagation speed and max radius)
- Tiny white particle dots travel along shipping lane arcs via `customLayerData` + animated position interpolation
- Overlay toggle button (top-right of globe): Standard → Tariff Risk Heatmap → Disruption Risk Heatmap (uses `hexPolygonsData` colored by risk score)

**Signal Ticker:**
- Horizontal auto-scrolling ticker bar below PortStatusBar (above globe)
- Reuters-style: amber text on dark background, `JetBrains Mono`, urgency score badges
- Each signal item has a "→ Outreach" pill that opens OutreachSequenceModal pre-filled with the signal

**AnalysisPanel enhancements:**
- ICP score: animated radial SVG gauge (arc sweeps to score value on load, color-coded red/amber/green)
- AI analysis text streams in token-by-token (chunked response simulation with `setInterval`)
- "→ Outreach" action per signal in feed

**TariffCalculator upgrade:**
- HS code text input field above sliders
- Static lookup table of 20+ common HS codes → rate mapping
- Display matched HS code description when found

---

### 2. Trade Intelligence (`/trade`) — Bloomberg Terminal Aesthetic

**Layout:** Dense 12-column CSS grid. All numbers JetBrains Mono. Standard Bloomberg color palette: `#00d4ff` for headers, `#10b981` positive, `#ef4444` negative, `#f59e0b` alerts.

**Top row — 4 macro stat tiles:**
Each tile shows: label, current value (large mono), MoM delta with arrow, 12-month sparkline (Recharts AreaChart, no axes).
- US Trade Balance (BOPGSTB)
- Total Imports — Goods & Services (IMPGS)
- Capital Goods Imports (AITGICS)
- Consumer Goods Imports (AITGIGS)

**Main row:**
- Left (50%): Multi-series Recharts AreaChart — Trade Balance vs Total Imports vs Capital Goods, last 24 months, animated on mount, custom tooltip
- Center (25%): Commodity flow table — rows for Electronics / Apparel / Capital Goods / Consumer Goods — columns: Current ($B), MoM Δ, YoY Δ, Trend arrow, FRED series ID
- Right (25%): Bloomberg-style compact signal feed (same API, denser layout: urgency dot + headline + source + age)

**Bottom row:**
- Left (50%): Full HS Code Tariff Calculator — text input for HS code, product description search, current US tariff rate, Section 301 surcharge indicator, Flexport duty deferral savings
- Right (50%): Route Optimizer — origin port selector + destination port selector → compare: Flexport estimated transit / Industry avg transit / Cost delta / Risk score. Static intelligent estimates.

---

### 3. Account 360 (`/account/:id`)

Navigated to by clicking any prospect from Home, Pipeline, or Market Map.

**Header:**
- Company name (large, Space Grotesk), ICP badge, sector pill, estimated revenue, HQ location
- Animated slide-in on mount

**Supply Chain Flow Diagram:**
- SVG/CSS animated diagram: source country flags as nodes → animated dashed lines (stroke-dashoffset animation) → port nodes → US warehouse node
- Line thickness proportional to import volume weight
- Clicking a source node highlights its lane

**Three-column body:**
- Left: AI analysis streamed token-by-token. Pain points as animated list items (staggered slide-in). Flexport value props with icon chips.
- Center: Signal timeline — vertical timeline, each event is a news item with date, source badge, urgency color, and "→ Outreach" pill
- Right: Decision maker cards (title + concerns). "Generate Call Prep" button opens modal with AI-generated brief.

**Footer action bar (sticky):**
- Outreach Sequence · Call Prep Sheet · Mutual Action Plan · Add to Pipeline
- Consistent with existing button styles

**Objection Handler panel (collapsible, right edge):**
- Drawer that slides in from right
- Text input: "Enter an objection you heard..."
- AI response streams in within ~2 seconds
- Common objections as quick-fill chips

---

### 4. SDR Performance Dashboard (`/performance`)

**Top metrics bar — 4 KPI tiles:**
- Calls This Week · Emails Sent · Demos Booked · Pipeline Value (sum of researched+ deals)
- Numbers animate with count-up effect on mount

**Left panel — Activity Heatmap:**
- GitHub contribution-style 52×7 grid of day squares
- Color intensity = number of activities logged that day
- Hover tooltip shows date + activity count + breakdown by type
- Legend: lighter = fewer, `--accent` = most active

**Center panel — Conversion Funnel:**
- Animated SVG waterfall/funnel: Prospects in DB → Contacted → Responded → Demo Booked → Closed Won
- Each stage bar animates width from 0 on mount
- Conversion % displayed between each step

**Right panel — Quota Attainment:**
- Animated ring gauge (SVG stroke-dashoffset), fills to attainment %
- Below ring: weekly breakdown table (Mon–Fri, calls/emails/demos per day)
- "Log Activity" button opens quick-log modal

**Bottom — Win/Loss Tracker:**
- Left: log form (company, outcome, stage reached, competitor, reason, deal value)
- Right: grouped bar chart (wins vs losses by month) + scrollable table of recent records

---

### 5. Market Map (`/market`)

**Left panel (30%) — Sector Explorer:**
- Vertical list of sector cards: Electronics · Apparel · CPG · Furniture · E-Commerce · Industrial · Food & Bev · Pharma
- Each card shows prospect count + avg ICP score
- Clicking a sector selects it and animates the center panel

**Center panel (45%) — Node Graph:**
- When sector selected: animated node graph fans out from center sector node
- Sub-segment nodes (e.g. Electronics → Consumer Electronics · Semiconductors · Industrial Equipment)
- Prospect nodes sized by ICP score, colored by pipeline stage (not in pipeline = blue, researched = purple, demo = green)
- Clicking a prospect node navigates to Account 360

**Right panel (25%) — Sector Intelligence:**
- TAM estimate for selected sector
- Avg freight spend estimate
- Which Flexport products are most relevant (chips)
- Top 3 prospects ranked by ICP score with quick-action buttons
- "Best time to call" signal if any urgent news in that sector

---

## Cross-Cutting Feature Additions

### Features Added to Existing Components
| Feature | Where |
|---------|-------|
| Signal → Outreach button | SignalFeed cards + ticker |
| Animated ICP radial gauge | AnalysisPanel |
| Streaming AI text | AnalysisPanel + Account 360 |
| HS code lookup | TariffCalculator |
| Pulsing port rings | GlobeView |
| Lane particle dots | GlobeView |
| Globe overlay toggle | GlobeView |
| Signal ticker | Below PortStatusBar on Home |
| AI first-line generator | AnalysisPanel actions bar |
| Call prep sheet modal | AnalysisPanel + Account 360 |
| Objection handler | Account 360 + Home sidebar panel |
| Mutual action plan | Account 360 footer bar |

---

## Design Tokens (unchanged)
```css
--bg:      #060b18
--surface: rgba(255,255,255,0.04)
--border:  rgba(255,255,255,0.08)
--primary: #2563EB
--accent:  #00d4ff
--success: #10b981
--warning: #f59e0b
--danger:  #ef4444
--text:    #f1f5f9
--text-2:  #94a3b8
--mono:    'JetBrains Mono'
--head:    'Space Grotesk'
```

Bloomberg additions (Trade Intelligence page only):
```css
--bb-bg:     #0a0e1a   /* slightly different dark */
--bb-border: #1a2744
--bb-amber:  #ff9f0a
--bb-green:  #00c176
--bb-red:    #ff3b3b
```
