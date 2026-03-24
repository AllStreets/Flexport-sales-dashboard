# Chicago Explorer — Design Specification
**Date:** 2026-03-23
**Status:** Approved for implementation

---

## Overview

A publicly-accessible Chicago city intelligence app built for someone moving to Streeterville in late May 2026. The app gives a new Chicago resident a living, breathing window into the city — real transit data, buzzing places, neighborhood identity, events, sports, and weather — presented with the same visual quality and "aliveness" as the Flexport SDR Intelligence Hub.

**Home base:** Streeterville, one block from Navy Pier.
**Audience:** New residents, visitors, anyone who wants to feel plugged into Chicago.

---

## Architecture

### Monorepo Layout
```
/Users/connorevans/Downloads/chicago-explorer/
├── frontend/          # React 19 + Vite 7
│   ├── src/
│   │   ├── pages/
│   │   ├── components/
│   │   ├── hooks/
│   │   └── styles/
│   └── vercel.json    # SPA rewrite rules
└── backend/           # Express 5 + SQLite
    ├── server.js
    ├── routes/
    └── data/
```

### Stack
- **Frontend:** React 19 + Vite 7, React Router v7
- **3D Map:** Mapbox GL JS + Deck.gl (extruded buildings, custom data layers)
- **Backend:** Express 5 + SQLite (favorites, cached API responses, user notes)
- **Icons:** `react-icons/ri` exclusively — no emojis anywhere
- **Deploy:** Frontend → Vercel, Backend → Railway

### Design System (matches Flexport)
- Background: `#060b18`
- Accent: `#00d4ff`
- Fonts: Space Grotesk (UI/headings), JetBrains Mono (numbers/data)
- No emojis anywhere in the codebase

### Git Remote
`https://github.com/AllStreets/chicago-explore.git`

---

## Data Sources & APIs

| Source | What it powers | Tier | Notes |
|--------|---------------|------|-------|
| **CTA Train Tracker API** | Live L train positions, arrival estimates, service alerts | Free | Key requested at transitchicago.com. Base URL: `http://lapi.transitchicago.com/api/1.0/`. Always append `outputType=JSON` — default response is XML. |
| **Divvy GBFS Feed** | Bike station availability on Transit page | Free, no key | Static JSON feeds at `https://gbfs.divvybikes.com/gbfs/en/station_status.json` and `station_information.json` — no API key required |
| **Yelp Fusion API** | Restaurant/bar ratings, buzz scores, cuisine filters | Free (500/day) | Cache responses in SQLite with a 6-hour TTL to stay within the daily cap across Food, Nightlife, and Home pages |
| **Chicago Data Portal** | Business licenses, health inspections, permits, authentic city data | Free | Socrata API, no key required for public datasets |
| **Ticketmaster Discovery API** | Events calendar — concerts, festivals, pop-ups | Free tier | |
| **OpenWeatherMap API** | Current conditions, forecast, lake wind/temp | Free tier | |
| **Mapbox** | 3D city map tiles, geocoding | Pay-as-you-go | Token must be URL-restricted to Vercel deployment domain before going public. Configure a usage alert in the Mapbox dashboard to guard against traffic spikes. |
| **Claude API (Anthropic)** | Streaming AI briefings (Neighborhoods + Explore pages) | Pay-as-you-go | |

**Live sports scores** (Sports page ticker): Use the free ESPN unofficial JSON API (`site.api.espn.com/apis/site/v2/sports/...`). No key required. Marked as Phase 2.

**Nightlife check-in density**: No reliable free real-time check-in API exists (Foursquare removed free check-in data). This feature is cut — replace with Yelp review velocity ("buzz score") as the activity signal, which is already available via Yelp Fusion.

All external API calls are proxied through the Express backend to keep keys server-side.

---

## Environment Variables

### Backend (Railway)
```
CTA_API_KEY=           # from transitchicago.com registration
YELP_API_KEY=          # from Yelp Fusion developer portal
TICKETMASTER_API_KEY=  # from developer.ticketmaster.com
OPENWEATHER_API_KEY=   # from openweathermap.org
ANTHROPIC_API_KEY=     # from console.anthropic.com
FRONTEND_URL=          # Vercel deployment URL (for CORS)
```

### Frontend (Vercel)
```
VITE_MAPBOX_TOKEN=     # Mapbox public token, URL-restricted to Vercel domain
VITE_API_URL=          # Railway backend URL
```

---

## User Identity (My Chicago page)

This is a single-user personal app. The `/me` page uses an **anonymous device UUID** approach:
- On first load, the frontend generates a UUID and stores it in `localStorage` as `chicago_user_id`
- Every request to `/api/me/*` sends this UUID as the `X-User-ID` header
- SQLite schema includes a `user_id` column on all personal tables (favorites, bucket_list, visited_neighborhoods)
- No login, no auth — just a consistent device identity per browser session

This is sufficient for a personal tool. If shared-device use ever matters, a simple login can be layered on later.

---

## Pages (10 total)

### `/` — Home
**Visual centerpiece:** Full-screen 3D Mapbox GL map of Chicago with 3D extruded buildings, live CTA train dots moving on actual track geometry, and Lake Michigan shoreline. Centered on Streeterville.

**Floating intelligence feed** overlays the right ~30% of the screen without obscuring the full map height. Feed cards show:
- Live CTA arrivals (nearest stations to Streeterville)
- Buzzing places nearby (Yelp buzz score signal)
- Tonight's top event (Ticketmaster)
- Lake conditions strip (temp, wind, beach status)

Sidebar nav uses `react-icons/ri` icons, dark `#060b18` background, cyan accents.

### `/neighborhoods` — Neighborhoods
Per-neighborhood deep dive. For each Chicago neighborhood:
- Vibe profile (tags: family-friendly, nightlife-heavy, artsy, etc.)
- Best blocks highlight
- Population character
- Commute time from Streeterville
- Top spots (3-5 must-visit)
- AI-generated "move-in brief" (streaming, Claude API)

### `/transit` — Transit
Full CTA L map with live train positions on all lines (Red, Blue, Brown, Green, Orange, Pink, Purple, Yellow). Features:
- Real-time train dots from CTA Train Tracker API
- Service alerts banner
- Line-by-line status cards
- Divvy bike station availability (GBFS feed, no key required)
- Estimated arrival times from Streeterville

### `/food` — Food & Drink
Restaurant map with filter panel:
- Filter by neighborhood, cuisine type, price tier
- "Open now" live layer
- Buzz score from Yelp review velocity
- Chef-driven vs. hidden gems toggle
- Health inspection score overlay (Chicago Data Portal)

### `/nightlife` — Nightlife
Bars, clubs, rooftops, jazz clubs on the 3D map:
- Neighborhood scene profile cards: Wicker Park vs. River North vs. Wrigleyville
- Yelp buzz score as activity signal (replaces check-in density — no free API exists for that)
- Tonight's events surface from Yelp events + Ticketmaster

### `/sports` — Sports
All 6 Chicago teams: Cubs, White Sox, Bears, Bulls, Blackhawks, Fire.
- Season schedule with upcoming game countdown
- Venue maps pinned on city map
- Best bars to watch each team (by neighborhood)
- Live score ticker when games are in progress (ESPN unofficial API — Phase 2)
- Transit routing to each stadium from Streeterville

### `/events` — Events
Live event calendar:
- Concerts, festivals, markets, pop-ups from Ticketmaster + Chicago Data Portal
- Map pins by venue
- Filter by date range, category, neighborhood
- Featured events: Lollapalooza, Taste of Chicago, neighborhood block parties
- "This weekend" default view

### `/explore` — Explore
Tourist + discovery mode:
- Iconic landmarks pinned with info cards
- Architecture boat tour route overlay
- Hidden gems layer (curated)
- Seasonal guide (lake activities in summer, ice skating in winter)
- AI "new to Chicago" orientation briefing (streaming, Claude API)

### `/weather` — Weather & Lake
Chicago-specific weather intelligence:
- Current conditions + 7-day forecast (OpenWeatherMap)
- Lake Michigan conditions: temp, wave height, beach status
- Wind chill calculator (lake effect)
- "Is it actually nice today?" score (composite index)
- Seasonal survival guide for new residents

### `/me` — My Chicago
Personal layer (stored in SQLite via backend, keyed by device UUID):
- Saved places (favorites from any page)
- Bucket list (places to visit)
- Neighborhood exploration progress (% of neighborhoods visited)
- Streaks (weekly exploration)
- Streeterville home base as persistent anchor on all maps

---

## Sidebar Navigation

Fixed left sidebar matching Flexport's design. Icons from `react-icons/ri`:

| Page | Icon |
|------|------|
| Home | `RiMapPin2Line` |
| Neighborhoods | `RiBuilding2Line` |
| Transit | `RiTrainLine` |
| Food & Drink | `RiRestaurantLine` |
| Nightlife | `RiMoonLine` |
| Sports | `RiTrophyLine` |
| Events | `RiCalendarEventLine` |
| Explore | `RiCompassLine` |
| Weather & Lake | `RiWindyLine` |
| My Chicago | `RiUserHeartLine` |

---

## Backend API Routes

```
GET  /api/cta/arrivals?stop=:stopId     CTA live arrivals (stpid param, outputType=JSON)
GET  /api/cta/trains                    All active train positions
GET  /api/cta/alerts                    Service alerts
GET  /api/divvy/stations                Divvy GBFS station status + info
GET  /api/places?neighborhood=&type=    Yelp-powered places
GET  /api/events?date=&neighborhood=    Ticketmaster + city events
GET  /api/weather                       OpenWeatherMap current + forecast
GET  /api/lake                          Lake conditions composite
GET  /api/sports/schedule               All teams schedule (ESPN unofficial)
GET  /api/sports/scores                 Live scores (ESPN unofficial, Phase 2)
GET  /api/neighborhoods                 Neighborhood profiles
POST /api/me/favorites                  Save a place (requires X-User-ID header)
GET  /api/me/favorites                  Get saved places (requires X-User-ID header)
POST /api/me/bucket-list               Add to bucket list (requires X-User-ID header)
GET  /api/me/bucket-list               Get bucket list (requires X-User-ID header)
POST /api/me/visited                   Mark neighborhood visited (requires X-User-ID header)
GET  /api/me/visited                   Get visited neighborhoods (requires X-User-ID header)
POST /api/ai/explore-brief              Streaming AI orientation (SSE)
POST /api/ai/neighborhood-brief         Streaming AI move-in brief (SSE)
```

---

## AI Integration

Two streaming endpoints powered by Claude API:
1. **`/api/ai/explore-brief`** — "New to Chicago" orientation brief for the Explore page
2. **`/api/ai/neighborhood-brief`** — Move-in brief for each neighborhood on the Neighborhoods page

Streamed to frontend via `text/event-stream`, rendered with a typewriter effect matching the Flexport Account360 pattern.

---

## Phasing

### Phase 1 — Core (launch-ready)
- Scaffold: monorepo structure, design system, sidebar nav, Mapbox setup
- Home page with live 3D map + floating intelligence feed (CTA + Yelp + weather)
- Transit page with live CTA train data + Divvy bikes
- Food & Drink page
- Backend with CTA + Yelp + OpenWeather + Divvy proxies
- Vercel + Railway deploy with all Phase 1 env vars configured

### Phase 2 — Full build-out
- Neighborhoods, Nightlife, Sports, Events, Explore, Weather & Lake, My Chicago
- AI streaming endpoints (Claude API)
- Chicago Data Portal integration (health inspections)
- ESPN live scores
- Complete env var set on Railway

---

## Success Criteria

### Phase 1
1. Home page loads with live CTA train dots within 3 seconds
2. Home, Transit, and Food pages render without errors
3. Floating feed on Home updates in real-time (CTA arrivals, weather)
4. Food map filters work against live Yelp data
5. Deploys cleanly to Vercel + Railway with no hardcoded secrets
6. Mapbox token is URL-restricted to the Vercel domain

### Phase 2
7. All 10 pages render without errors
8. AI briefings stream and render cleanly on Neighborhoods + Explore pages
9. My Chicago favorites persist across sessions via device UUID
10. No emojis anywhere in the UI or codebase
