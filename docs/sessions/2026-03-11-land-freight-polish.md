# Session Handoff — 2026-03-11 Land Freight Polish

## What Was Done

### 1. Land Freight Page — Full Visual Overhaul
The page existed from the previous session but had several issues (yellow everywhere, bad texture, no opening animation, no equatorial ring). All fixed.

**Files changed:** `LandGlobe.jsx`, `LandFreightPage.css`, `LGPanel.jsx`, `LandFreightPage.jsx`

#### Texture
- **Before:** `earth-topology.png` (grayscale height map — looked terrible)
- **After:** `earth-night.jpg` (city lights — visually matches the homepage and makes sense for land freight since trucks go where cities are)

#### Colors — all yellow removed
- **Regular trucks:** `#facc15` yellow → `rgba(203,213,225,0.9)` silver/slate
- **Tank trucks:** `#a3e635` lime → `rgba(251,146,60,0.9)` orange-400
- **All CSS accents:** yellow `#facc15` → cyan `#00d4ff` throughout panel, badges, feed pulse, etc.
- **Panel stat colors:** Regular=`#cbd5e1` (silver), Tank=`#fb923c` (orange)

#### Globe Architecture Refactor
Rewrote `LandGlobe.jsx` to match the Ocean Freight / Air Freight pattern:
- `useEffect + setTimeout(600)` for Three.js scene setup (was using `onGlobeReady` callback)
- **Atmosphere glow shader** — same as other globes
- **Equatorial ring** — `TorusGeometry(102, 0.5, 8, 64)`, color `0x004466`, opacity 0.4, slow Z rotation
- **Moon** — upgraded from 128x128 simple canvas to the full 512x512 detailed canvas used by Ocean/Air Freight
- **autoRotate** — separate `useEffect` with `autoRotateSpeed: 0.3`, `dampingFactor: 0.08`
- **RAF loop** — unified: ring rotation + moon orbit + sprite animation in one loop
- Proper cleanup with `try/catch/finally` and `shouldAnimate` flag

### 2. Truck Sprite Redesign

**Before:** Portrait canvas (40x88), top-down bird's-eye view, basic rectangles. Scale `(2.2, 4.8, 1)`.

**After:** Landscape canvas (80x38), full side-profile silhouette. Scale `(5, 2.4, 1)`.

#### Side-profile details (truck faces RIGHT on canvas):
- **Exhaust stack:** chrome pipe rising above cab roof
- **Cab:** curved/rounded body, windshield, driver side window, door divider line, running board step, chrome front bumper, side mirror arm
- **Coupling:** narrow neck between cab and trailer
- **Regular trailer:** box body with vertical panel ribs and tail lights (red)
- **Tank trailer:** elliptical cylinder with hoop bands, end cap, highlight sheen
- **Wheels:** 3 circles per truck — front steer axle + rear tandem — with rim highlights

#### Rotation formula — CRITICAL
For a landscape side-profile canvas (cab at RIGHT = faces +X direction):
```js
sprite.material.rotation = Math.PI / 2 - heading * Math.PI / 180;
```
This is applied in **two places** in `LandGlobe.jsx`:
1. In `customThreeObjectUpdate` (initial placement from API data)
2. In the RAF animate loop (real-time SLERP animation)

**DO NOT use** `-(heading * PI/180)` — that's correct for portrait top-down sprites, but for landscape it makes trucks appear perpendicular to the route arcs.

### 3. SIMULATED Source Badge
Added to `LandFreightPage.jsx` header, same position as Ocean/Air Freight pages.
- Uses `RiWifiLine` icon
- Static display only (no toggle — no live truck data source exists)
- CSS class `lg-source-badge` — styled same as `.vg-source-badge.simulated` on other pages

---

## Current State — All Commits Pushed

| Commit | Description |
|--------|-------------|
| `3290c62` | feat: add SIMULATED source badge to Land Freight header |
| `74f9f02` | fix: truck sprite rotation — PI/2 - heading*PI/180 for landscape canvas |
| `999a286` | fix: Land Freight — night texture, silver/orange trucks, equatorial ring, autoRotate |
| `5a8e187` | feat: Land Freight page — topology globe, 340 animated trucks, full panel |

---

## Key Architecture Notes

### LandGlobe.jsx structure
```
Constants: REGULAR_COLOR, TANK_COLOR, HOME_POV, DISTRIBUTION_HUBS, BORDER_CROSSINGS
Functions:
  portStatusColor(status)
  gcPoint(lat1,lng1,lat2,lng2,t)    — great-circle SLERP, same as FlightsGlobe
  setSpritePos(sprite,lat,lng,alt,globeRadius)
  makeTruckCanvas(colorStr, isTank) — 80x38 landscape canvas, cached in _truckTexCache
  makeTruckSprite(truck)            — creates Sprite with scale (5, 2.4, 1)

Component: LandGlobe({ trucks, ports, onTruckClick, focusTarget, width, height })
  threeRefs: { frame, shouldAnimate, glowMesh/Geom/Mat, ringMesh/Geom/Mat, moonMesh/Geom/Mat/Tex, sprites: Map }
  useEffect([trucks])     — clears sprite map on data refresh
  useEffect([])           — scene setup: glow + ring + moon + RAF loop (600ms delay)
  useEffect([])           — autoRotate controls (600ms delay)
  useEffect([focusTarget]) — pointOfView zoom
  arcs, allLabels, allRings — useMemo
```

### LGPanel.jsx structure
```
Components:
  LGStats({ trucks })           — Total/Regular/Tank/AvgMph grid
  LGCarrierWatch({ trucks })    — Top 6 carriers by count, bar chart
  LGHotCorridors({ trucks })    — Top 5 origin→destination routes
  LGEventFeed({ trucks, selectedTruck, onClear, onFeedTruckClick })
    — 3.5s interval random event, click-to-focus, detail view when truck selected
```

### Vehicle color palette (across all pages — don't reuse)
| Color | Used by |
|-------|---------|
| `rgba(0,212,255,0.9)` cyan | Container ships, hub labels |
| `rgba(249,115,22,0.9)` orange | Tanker ships |
| `rgba(167,139,250,0.9)` violet | Bulk ships, passenger planes |
| `rgba(251,113,133,0.9)` rose | Cargo planes |
| `rgba(203,213,225,0.9)` silver | Regular trucks |
| `rgba(251,146,60,0.9)` orange-400 | Tank trucks |
| `#10b981` green | Port clear |
| `#f59e0b` amber | Port congested |
| `#ef4444` red | Disruption |

---

## What's Next (No Pending Tasks)
The Land Freight page is complete. No outstanding work items from this session.
