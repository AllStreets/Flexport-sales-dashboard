# Land Freight Page — Design Document

**Date:** 2026-03-10
**Status:** Approved

---

## Goal

Build a Land Freight globe page that is visually and functionally equivalent to the Ocean Freight and Air Freight pages, displaying 315+ simulated trucks (regular + tank) on global highway corridors with real-time sprite animation, route arcs, port data, border crossing rings, and a right-side intelligence panel.

---

## Architecture

### New files

| File | Role |
|---|---|
| `frontend/src/pages/LandFreightPage.jsx` | Page wrapper — header, error boundaries, data fetch (trucks + ports), resize observer |
| `frontend/src/components/LandGlobe.jsx` | Globe — topology texture, truck sprites, arcs, border rings, port rings, hub labels, moon, RAF animation loop |
| `frontend/src/components/LGPanel.jsx` | Right panel — Fleet Overview, Carrier Watch, Hot Corridors, Event Feed |
| `frontend/src/pages/LandFreightPage.css` | Layout + panel styles (mirrors FlightsPage.css pattern) |

### Modified files

| File | Change |
|---|---|
| `backend/server.js` | Add `GET /api/trucks` endpoint — 315+ simulated trucks |
| `frontend/src/App.jsx` | Register `/land` route → `<LandFreightPage />` |
| `frontend/src/components/Sidebar.jsx` | Add nav entry: `/land` → RiTruckLine → "Land Freight" |

---

## Globe (LandGlobe.jsx)

### Texture
`earth-topology.png` from `//unpkg.com/three-globe/example/img/earth-topology.png`
Terrain relief (green valleys, brown mountains, white peaks). Unused by all three existing globes.
Same atmosphere: `rgba(0,180,255,0.25)`, altitude `0.25`.

### Truck colors
| Type | Color | Hex |
|---|---|---|
| Regular (dry van, flatbed, general cargo) | Bright yellow | `rgba(250,204,21,0.9)` / `#facc15` |
| Tank (fuel, chemical, liquid bulk) | Lime/chartreuse | `rgba(163,230,53,0.9)` / `#a3e635` |

These are unused by Ocean (cyan, orange, violet) and Air (rose, violet), and distinct from port status colors (green #10b981, amber #f59e0b, red #ef4444).

### Truck sprites
Canvas-drawn, top-down silhouettes:
- **Regular**: rectangular cab + long trailer, narrow sides for wheel suggestion, glow halo in truck color
- **Tank**: rectangular cab + rounded oval/cylinder tank body, glow halo in lime color
- Heading rotation matches truck direction of travel

### Route arcs
- Full src→dst arcs, dim at origin (`0.05` opacity), bright at destination (truck color at `0.6` opacity)
- Arc color matches truck type (yellow or lime)
- Progress-phased for visual variety

### Real-time sprite animation
Same RAF loop + gcFlightPoint SLERP as FlightsGlobe:
- `t = (progress + elapsed / 86400) % 1`
- Sprites move continuously every frame along great-circle paths
- Sprite map cleared on each `/api/trucks` refresh

### Border crossing rings (5 key checkpoints)
| Location | Lat/Lng | Color | Reason |
|---|---|---|---|
| Laredo / Nuevo Laredo | 27.5, -99.5 | `#10b981` green | World's busiest land port (~13k trucks/day), clear |
| Dover / Calais | 51.1, 1.8 | `#f59e0b` amber | Channel Tunnel, post-Brexit customs delays |
| Brest-Terespol (EU-Belarus) | 52.1, 23.7 | `#ef4444` red | Sanctions, border effectively closed to cargo |
| Khorgos (China-Kazakhstan) | 44.2, 80.2 | `#f59e0b` amber | Belt & Road dry port, growing volume |
| Wagah (India-Pakistan) | 31.6, 74.6 | `#ef4444` red | Geopolitical closure, extremely limited traffic |

### Ports
Fetched from `/api/globe-data`. Displayed with same green/amber/red rings and labels as Ocean/Air pages.
Port status colors: Clear `#10b981`, Congested `#f59e0b`, Disruption `#ef4444`.

### Hub / distribution center labels
Memphis TN, Louisville KY, Chicago IL, Dallas TX, Los Angeles CA, Rotterdam NL, Frankfurt DE, Dubai UAE, Chengdu CN, Singapore SG, São Paulo BR

### Moon + orbit
Identical canvas moon texture and circular orbit as all other globe pages.

### Legend
Regular truck (yellow), Tank truck (lime), Distribution Hub, Port Clear, Port Congested, Port Disruption, Border Crossing

---

## Panel (LGPanel.jsx)

### Section 1: Fleet Overview (LGStats)
- Total trucks
- Regular count (yellow)
- Tank count (lime)
- Avg speed strip (mph / km/h)

### Section 2: Carrier Watch (LGCarrierWatch)
Top 6 carriers by truck count with percentage bar chart:
JB Hunt, Werner, Schneider, XPO, DB Schenker, DHL Freight

### Section 3: Hot Corridors (LGHotCorridors)
Top 5 routes ranked by truck count: `Origin → Destination · N trucks`

### Section 4: Event Feed (LGEventFeed)
Scrolling live feed — trucks approaching border crossing, approaching distribution hub, in transit (with origin→destination). Cycles every 3.5s. Click truck in feed → globe focuses + shows detail panel.

---

## Backend `/api/trucks`

### Response shape
```json
{
  "trucks": [
    {
      "id": "TRK001",
      "callsign": "JBHT-0042",
      "carrier": "JB Hunt",
      "type": "regular",
      "srcLat": 34.0, "srcLng": -118.2,
      "dstLat": 32.8, "dstLng": -96.8,
      "origin": "Los Angeles", "destination": "Dallas",
      "progress": 0.34,
      "lat": 33.1, "lng": -107.2,
      "heading": 92,
      "velocity": 65
    }
  ],
  "source": "simulated"
}
```

### Route corridors (79 total, ~315+ trucks)
Coverage: North America 38 routes, Europe 18, Asia 15, Middle East 5, SE Asia/Australia/Africa 3.
~70% regular trucks, ~30% tank trucks (tank concentrated on energy/chemical corridors: Gulf Coast, Middle East, Rotterdam petrochemical).

### Simulation
- Same gcFlightPoint SLERP as `/api/flights` and `/api/vessels`
- Cache skipped for simulated data — fresh positions on every request
- Velocity: regular 60–75 mph, tank 50–65 mph
- Heading computed from gcFlightPoint derivative (t vs t+0.001)

---

## Header

- Icon: `RiTruckLine` from react-icons/ri
- Title: `LAND FREIGHT`
- Truck count badge
- Refresh button
- Border alert badges (Laredo green, Dover amber, Brest red) — same pattern as Air Freight airspace badges

---

## Color Reference (full Land Freight page palette)

| Element | Color |
|---|---|
| Regular trucks | `#facc15` yellow |
| Tank trucks | `#a3e635` lime |
| Port — Clear | `#10b981` green |
| Port — Congested | `#f59e0b` amber |
| Port — Disruption | `#ef4444` red |
| Border clear | `#10b981` green ring |
| Border congested | `#f59e0b` amber ring |
| Border disrupted | `#ef4444` red ring |
| Accent / UI | `#00d4ff` (app-wide) |
