# Vessels Globe Overhaul — Design

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace the flat Leaflet vessel map with a Three.js ocean command globe + live data panel, and remove the Team Intelligence page entirely.

**Architecture:** Three.js canvas globe (reusing patterns from GlobeView.jsx) rendered full-bleed on the left, collapsible right panel hosting live event feed, stats, and container tracker. Vessel dots, trail arcs, and disruption zone pulse rings are rendered as Three.js objects on the globe surface.

**Tech Stack:** Three.js (already installed), React 19, react-icons/ri, existing backend `/api/vessels` + `/api/containers/*`

---

## Remove Team Page

- Delete `frontend/src/pages/TeamPage.jsx`
- Delete `frontend/src/pages/TeamPage.css`
- Remove `/team` route from `frontend/src/App.jsx`
- Remove Team entry from `frontend/src/components/Sidebar.jsx`

---

## Backend Fix: Cap Vessel Count

- In `backend/server.js` line 1102: change `slice(0, 500)` → `slice(0, 100)`
- Simulated fallback: reduce from 60 → 40 vessels

---

## Globe Design

**Ocean-focused canvas texture (512×512):**
- Deep ocean base: radial gradient `#03080f` → `#051428` → `#040d1e`
- Land masses: flat fill `#0d1c18` (muted grey-green), no detail needed
- Coastline shimmer: 1px cyan `rgba(0,212,255,0.15)` path traces on continent edges
- Ocean depth variation: subtle darker patches in Pacific/Atlantic center
- No external texture URLs (CORS-safe, synchronous canvas only)

**Globe sphere:**
- Radius 1.8 (slightly larger than homepage)
- `roughness: 0.85`, `metalness: 0.0`
- Atmosphere: large transparent sphere with additive blending, `#001a2e` tint, edge glow
- Scanline overlay: PlaneGeometry texture in screenspace at 4% opacity

**Vessel dots:**
- Plotted using `latLngToVector3()` helper (convert lat/lng → 3D point on sphere)
- `SphereGeometry(0.012)` per vessel, `MeshBasicMaterial` + custom color
- Colors: container `#00d4ff`, tanker `#f59e0b`, bulk `#a78bfa`
- Pulsing scale animation: each dot oscillates between 1.0–1.6 scale at 0.5Hz
- On hover: scale to 2.0, show tooltip

**Vessel trail arcs:**
- Each vessel: generate 4 ghost positions behind it along reverse heading
- Render as `TubeGeometry` along a `CatmullRomCurve3`
- Material: `MeshBasicMaterial` same color as vessel dot, opacity 0.25 → 0 fade

**Disruption zones:**
- Hormuz, Red Sea/Bab-el-Mandeb, Suez Canal
- Three concentric rings per zone (RingGeometry projected onto sphere surface)
- Colors: Hormuz red `#ef4444`, Red Sea amber `#f59e0b`, Suez amber `#f59e0b`
- Expanding pulse animation: outer ring scales 1.0→2.5, opacity 0.4→0 over 2s loop

**Major port anchors:**
- Shanghai, Rotterdam, LA/LB, Singapore, Hamburg, Dubai
- Small white dot `#ffffff` opacity 0.6, fixed, no animation
- Label text sprite appears on globe hover near ports

**Globe interaction:**
- Auto-rotate Y-axis at 0.0008 rad/frame (stops on mousedown)
- Click on vessel dot: globe smoothly tilts+rotates to center vessel (TWEEN-style lerp)
- Vessel detail card replaces event feed in right panel on click

---

## Right Panel Layout (320px fixed)

```
┌─────────────────────────┐
│ STATS STRIP             │
│ 87 vessels  34 CTR      │
│ 28 TNK  25 BULK         │
│ 3 ACTIVE DISRUPTIONS    │
├─────────────────────────┤
│ LIVE EVENT FEED         │
│ ─────────────────────── │
│ MV EVER ACCORD          │
│ Strait of Hormuz · LIVE │
│ Speed 12.4kn ↗          │
│ ─────────────────────── │
│ OOCL EUROPE             │
│ Red Sea transit · WARN  │
│ Speed 0.2kn · Anchored  │
│ ─────────────────────── │
│ (new events push top    │
│  every 3s from data)    │
├─────────────────────────┤
│ CONTAINER TRACKER       │
│ [redesigned to match]   │
└─────────────────────────┘
```

**Live event feed:**
- Events generated from vessel data: vessels near disruption zones get WARN tag, fast vessels get transit tag
- New event card animates in from top every 3s (pick random vessel from live data)
- Max 8 visible, oldest fades out

**Stats strip:**
- Total, by-type counts update every 30s with vessel refresh
- Disruption alert count (vessels within disruption zone radius)

---

## Page Structure

```
<VesselsPage>
  <div.vg-header>   ← slim top bar: title + LIVE/SIM badge + vessel count
  <div.vg-body>
    <div.vg-globe-wrap>   ← Three.js canvas, full height
    <div.vg-panel>        ← 320px right panel
      <VGStats />
      <VGEventFeed />
      <VGContainerTracker />  ← redesigned ContainerTab
```

## CSS Patterns
- `.vg-` prefix for all new styles
- `flex: 1; min-height: 0; overflow: hidden` on page root
- Globe wrap: `flex: 1` takes remaining width after panel
- Panel: `flex-shrink: 0; overflow-y: auto`
- All animations via CSS `@keyframes` or Three.js render loop

---

## Files to Create/Modify

| Action | File |
|--------|------|
| DELETE | `frontend/src/pages/TeamPage.jsx` |
| DELETE | `frontend/src/pages/TeamPage.css` |
| MODIFY | `frontend/src/App.jsx` — remove team route + import |
| MODIFY | `frontend/src/components/Sidebar.jsx` — remove team entry |
| REWRITE | `frontend/src/pages/VesselsPage.jsx` — full globe implementation |
| REWRITE | `frontend/src/pages/VesselsPage.css` — all new `.vg-` styles |
| MODIFY | `backend/server.js` — cap vessel slice to 100, simulated to 40 |
