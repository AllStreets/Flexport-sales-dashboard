# Vessels Globe Overhaul — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task.

**Goal:** Remove the Team Intelligence page and replace the flat Leaflet vessel map with a dramatic ocean command globe using react-globe.gl, plus a live data panel.

**Architecture:** react-globe.gl (already installed, same lib as homepage GlobeView) for the 3D globe with vessel dots, animated trail arcs, disruption pulse rings, and port anchors. Right panel (320px) shows live event feed, stats, and container tracker. Entire Leaflet dependency dropped from VesselsPage.

**Tech Stack:** react-globe.gl, Three.js (transitive dep), React 19, react-icons/ri, existing `/api/vessels` + `/api/containers/*` backend routes.

---

### Task 1: Remove Team Intelligence Page

**Files:**
- Delete: `frontend/src/pages/TeamPage.jsx`
- Delete: `frontend/src/pages/TeamPage.css`
- Modify: `frontend/src/App.jsx`
- Modify: `frontend/src/components/Sidebar.jsx`

**Step 1: Delete the files**

```bash
rm frontend/src/pages/TeamPage.jsx
rm frontend/src/pages/TeamPage.css
```

**Step 2: Remove from App.jsx**

Find and remove these exact lines in `frontend/src/App.jsx`:

Line ~12: `import TeamPage from './pages/TeamPage';`

Lines ~131-135 (the Ctrl+Shift+T shortcut block):
```js
      // Ctrl+Shift+T — Navigate to Team
      if (e.ctrlKey && e.shiftKey && e.key === 'T') {
        e.preventDefault();
        navigate('/team');
      }
```

Line ~194: `<Route path="/team" element={<TeamPage />} />`

**Step 3: Remove from Sidebar.jsx**

In `frontend/src/components/Sidebar.jsx`, remove `RiTeamLine` from the import and remove this entry from the NAV_ITEMS array:
```js
{ to: '/team', Icon: RiTeamLine, label: 'Team' },
```

**Step 4: Verify build passes**

```bash
cd frontend && npm run build
```
Expected: `✓ built in X.XXs` with no errors.

**Step 5: Commit**

```bash
git add -A && git commit -m "feat: remove Team Intelligence page"
```

---

### Task 2: Cap Backend Vessel Count

**Files:**
- Modify: `backend/server.js` (lines ~1102 and ~1117)

**Step 1: Cap live AIS slice**

In `backend/server.js` line ~1102, change:
```js
return res.json({ source: 'live', vessels: vessels.slice(0, 500) });
```
to:
```js
return res.json({ source: 'live', vessels: vessels.slice(0, 100) });
```

**Step 2: Cap simulated vessel count**

In `backend/server.js` line ~1117, change:
```js
for (let i = 0; i < 60; i++) {
```
to:
```js
for (let i = 0; i < 40; i++) {
```

**Step 3: Commit**

```bash
git add backend/server.js && git commit -m "fix: cap vessel count to 100 live / 40 simulated for free AIS tier"
```

---

### Task 3: Build the Ocean Globe Component

**Files:**
- Create: `frontend/src/components/VesselsGlobe.jsx`

This is the core Three.js globe component. It receives `vessels` and `onVesselClick` as props.

**Full implementation:**

```jsx
// frontend/src/components/VesselsGlobe.jsx
import { useEffect, useRef, useMemo, useCallback } from 'react';
import Globe from 'react-globe.gl';
import * as THREE from 'three';

const DISRUPTION_ZONES = [
  { lat: 26.5, lng: 56.5, label: 'Strait of Hormuz', color: '#ef4444', maxRadius: 5, propagationSpeed: 3, repeatPeriod: 700 },
  { lat: 13.5, lng: 43.5, label: 'Red Sea / Bab-el-Mandeb', color: '#f59e0b', maxRadius: 4, propagationSpeed: 2, repeatPeriod: 900 },
  { lat: 31.5, lng: 32.3, label: 'Suez Canal', color: '#f59e0b', maxRadius: 3, propagationSpeed: 1.8, repeatPeriod: 1100 },
];

const MAJOR_PORTS = [
  { lat: 31.2, lng: 121.5, name: 'Shanghai' },
  { lat: 1.35, lng: 103.8, name: 'Singapore' },
  { lat: 51.9, lng: 4.5,   name: 'Rotterdam' },
  { lat: 33.7, lng: -118.2, name: 'Los Angeles' },
  { lat: 22.3, lng: 114.2, name: 'Hong Kong' },
  { lat: 53.5, lng: 10.0,  name: 'Hamburg' },
  { lat: 25.2, lng: 55.3,  name: 'Dubai (Jebel Ali)' },
  { lat: 35.4, lng: 139.6, name: 'Tokyo / Yokohama' },
];

function vesselColor(type = '') {
  if (type.includes('Tanker')) return 'rgba(245,158,11,0.9)';
  if (type.includes('Bulk'))   return 'rgba(167,139,250,0.9)';
  return 'rgba(0,212,255,0.9)';
}

// Given a vessel's current position + COG + SOG, compute N ghost positions trailing behind it
function trailArcs(vessel, steps = 4) {
  if (!vessel.cog && !vessel.sog) return [];
  const sogKm = (vessel.sog || 14) * 1.852; // knots → km/h
  const cog = (vessel.cog || 0) * Math.PI / 180;
  const R = 6371; // Earth radius km
  const arcs = [];
  // step = 2 hours of travel
  for (let i = 1; i <= steps; i++) {
    const dist = (sogKm * 2 * i) / R;
    const lat1 = vessel.lat * Math.PI / 180;
    const lng1 = vessel.lng * Math.PI / 180;
    const lat2 = Math.asin(Math.sin(lat1) * Math.cos(dist) + Math.cos(lat1) * Math.sin(dist) * Math.cos(cog + Math.PI));
    const lng2 = lng1 + Math.atan2(Math.sin(cog + Math.PI) * Math.sin(dist) * Math.cos(lat1), Math.cos(dist) - Math.sin(lat1) * Math.sin(lat2));
    const opacity = (steps - i + 1) / steps * 0.35;
    const color = vesselColor(vessel.type).replace(/[\d.]+\)$/, `${opacity})`);
    arcs.push({
      startLat: vessel.lat, startLng: vessel.lng,
      endLat: lat2 * 180 / Math.PI, endLng: lng2 * 180 / Math.PI,
      color: [color, 'rgba(0,0,0,0)'],
      mmsi: vessel.mmsi, trailStep: i
    });
  }
  return arcs;
}

export default function VesselsGlobe({ vessels = [], onVesselClick, width, height }) {
  const globeRef = useRef(null);

  // Build canvas globe texture — deep ocean focused, no external URLs
  const globeTexture = useMemo(() => {
    const c = document.createElement('canvas');
    c.width = 2048; c.height = 1024;
    const ctx = c.getContext('2d');

    // Deep ocean base
    const oceanGrad = ctx.createLinearGradient(0, 0, 0, 1024);
    oceanGrad.addColorStop(0, '#020810');
    oceanGrad.addColorStop(0.5, '#03111e');
    oceanGrad.addColorStop(1, '#020810');
    ctx.fillStyle = oceanGrad;
    ctx.fillRect(0, 0, 2048, 1024);

    // Ocean depth variation — darker in deep zones
    [[1024, 512, 400, '#010a15', 0.6], [400, 350, 250, '#010c18', 0.4],
     [1500, 600, 300, '#010c18', 0.35], [700, 150, 180, '#010b16', 0.3]].forEach(([x, y, r, col, a]) => {
      const g = ctx.createRadialGradient(x, y, 0, x, y, r);
      g.addColorStop(0, col + Math.round(a * 255).toString(16).padStart(2, '0'));
      g.addColorStop(1, 'transparent');
      ctx.fillStyle = g; ctx.fillRect(0, 0, 2048, 1024);
    });

    // Land masses — flat muted grey-green
    ctx.fillStyle = '#0d1c18';
    const LAND = [
      // North America
      { x: 180, y: 180, w: 220, h: 280 },
      // South America
      { x: 260, y: 440, w: 120, h: 240 },
      // Europe
      { x: 820, y: 140, w: 120, h: 140 },
      // Africa
      { x: 860, y: 310, w: 160, h: 300 },
      // Asia
      { x: 960, y: 100, w: 480, h: 280 },
      // Australia
      { x: 1360, y: 540, w: 180, h: 160 },
      // Greenland
      { x: 320, y: 60, w: 120, h: 120 },
    ];
    LAND.forEach(({ x, y, w, h }) => {
      ctx.beginPath();
      ctx.ellipse(x + w / 2, y + h / 2, w / 2, h / 2, 0, 0, Math.PI * 2);
      ctx.fill();
    });

    // Coastline shimmer — faint cyan edge on land
    ctx.strokeStyle = 'rgba(0,212,255,0.07)';
    ctx.lineWidth = 2;
    LAND.forEach(({ x, y, w, h }) => {
      ctx.beginPath();
      ctx.ellipse(x + w / 2, y + h / 2, w / 2 + 3, h / 2 + 3, 0, 0, Math.PI * 2);
      ctx.stroke();
    });

    // Latitude grid lines — very faint
    ctx.strokeStyle = 'rgba(0,212,255,0.03)';
    ctx.lineWidth = 1;
    for (let lat = -80; lat <= 80; lat += 20) {
      const y = (90 - lat) / 180 * 1024;
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(2048, y); ctx.stroke();
    }
    for (let lng = -180; lng <= 180; lng += 30) {
      const x = (lng + 180) / 360 * 2048;
      ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, 1024); ctx.stroke();
    }

    return c.toDataURL();
  }, []);

  // Custom atmosphere shader — deeper blue glow than homepage
  useEffect(() => {
    let frame;
    const timer = setTimeout(() => {
      const g = globeRef.current;
      if (!g?.scene) return;
      const scene = g.scene();

      const glowGeom = new THREE.SphereGeometry(105, 32, 32);
      const glowMat = new THREE.ShaderMaterial({
        uniforms: { c: { value: 0.22 }, p: { value: 4.5 } },
        vertexShader: `varying vec3 vNormal; void main() { vNormal = normalize(normalMatrix * normal); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
        fragmentShader: `uniform float c; uniform float p; varying vec3 vNormal; void main() { float i = pow(c - dot(vNormal, vec3(0.0,0.0,1.0)), p); gl_FragColor = vec4(0.0,0.6,1.0,max(0.0,i)); }`,
        side: THREE.FrontSide, blending: THREE.AdditiveBlending, transparent: true, depthWrite: false,
      });
      const glowMesh = new THREE.Mesh(glowGeom, glowMat);
      scene.add(glowMesh);

      // Inner ocean shimmer ring
      const ringGeom = new THREE.TorusGeometry(102, 0.6, 8, 64);
      const ringMat = new THREE.MeshBasicMaterial({ color: 0x004466, transparent: true, opacity: 0.4 });
      const ringMesh = new THREE.Mesh(ringGeom, ringMat);
      ringMesh.rotation.x = Math.PI / 2;
      scene.add(ringMesh);

      const animRing = () => {
        ringMesh.rotation.z += 0.001;
        frame = requestAnimationFrame(animRing);
      };
      animRing();

      return () => {
        if (frame) cancelAnimationFrame(frame);
        scene.remove(glowMesh); scene.remove(ringMesh);
        glowGeom.dispose(); glowMat.dispose(); ringGeom.dispose(); ringMat.dispose();
      };
    }, 600);
    return () => clearTimeout(timer);
  }, []);

  // Auto-rotate, stop on interact
  useEffect(() => {
    const g = globeRef.current;
    if (!g) return;
    const controls = g.controls();
    controls.autoRotate = true;
    controls.autoRotateSpeed = 0.3;
    controls.enableDamping = true;
    controls.dampingFactor = 0.08;
  }, []);

  const vesselPoints = useMemo(() => vessels.map(v => ({
    ...v,
    lat: v.lat, lng: v.lng,
    color: vesselColor(v.type),
    size: 0.35,
  })), [vessels]);

  const trailData = useMemo(() =>
    vessels.flatMap(v => trailArcs(v, 3)), [vessels]);

  const handleVesselClick = useCallback((point) => {
    const g = globeRef.current;
    if (g) {
      g.controls().autoRotate = false;
      g.pointOfView({ lat: point.lat, lng: point.lng, altitude: 1.2 }, 800);
    }
    onVesselClick?.(point);
  }, [onVesselClick]);

  const portLabel = useCallback((p) =>
    `<div style="color:#00d4ff;font-size:10px;font-family:'JetBrains Mono',monospace;background:rgba(6,11,24,0.85);padding:2px 6px;border-radius:4px;border:1px solid rgba(0,212,255,0.2)">${p.name}</div>`, []);

  const vesselLabel = useCallback((v) =>
    `<div style="color:#e2e8f0;font-size:11px;background:rgba(6,11,24,0.9);padding:4px 8px;border-radius:6px;border:1px solid rgba(0,212,255,0.25);font-family:'JetBrains Mono',monospace"><strong>${v.name || 'MMSI ' + v.mmsi}</strong><br/>${v.type || 'Unknown'} · ${(v.sog || 0).toFixed(1)} kn</div>`, []);

  return (
    <Globe
      ref={globeRef}
      width={width}
      height={height}
      globeImageUrl={globeTexture}
      backgroundColor="rgba(0,0,0,0)"
      atmosphereColor="rgba(0,140,255,0.18)"
      atmosphereAltitude={0.22}
      // Vessel points
      pointsData={vesselPoints}
      pointLat="lat"
      pointLng="lng"
      pointColor="color"
      pointAltitude={0.008}
      pointRadius="size"
      pointLabel={vesselLabel}
      onPointClick={handleVesselClick}
      // Trail arcs
      arcsData={trailData}
      arcColor="color"
      arcDashLength={0.3}
      arcDashGap={0.15}
      arcDashAnimateTime={2000}
      arcStroke={0.3}
      arcAltitudeAutoScale={0.2}
      // Disruption rings
      ringsData={DISRUPTION_ZONES}
      ringColor="color"
      ringMaxRadius="maxRadius"
      ringPropagationSpeed="propagationSpeed"
      ringRepeatPeriod="repeatPeriod"
      // Port labels
      labelsData={MAJOR_PORTS}
      labelLat="lat"
      labelLng="lng"
      labelText="name"
      labelSize={0.4}
      labelDotRadius={0.3}
      labelColor={() => 'rgba(0,212,255,0.7)'}
      labelResolution={2}
      labelLabel={portLabel}
    />
  );
}
```

**Step 2: Verify the component has no syntax errors**

```bash
cd frontend && node --input-type=module <<'EOF'
import '/Users/connorevans/Downloads/Flexport-sales-dashboard/frontend/src/components/VesselsGlobe.jsx'
EOF
```
(This will likely fail due to JSX but that's fine — just check for obvious typos by reading the file back.)

**Step 3: Commit**

```bash
git add frontend/src/components/VesselsGlobe.jsx
git commit -m "feat: add VesselsGlobe component — ocean canvas globe with vessel points, trails, disruption rings"
```

---

### Task 4: Build the Right Panel Components

**Files:**
- Create: `frontend/src/components/VGPanel.jsx`

This contains three sub-sections: stats strip, live event feed, and container tracker.

```jsx
// frontend/src/components/VGPanel.jsx
import { useState, useEffect, useRef } from 'react';
import { RiShipLine, RiRefreshLine, RiAlertLine, RiRadarLine } from 'react-icons/ri';

const API = import.meta.env.VITE_API_URL || 'http://localhost:5000';

const CONTAINER_MILESTONES = [
  'empty_out','full_in','vessel_loaded','vessel_departed',
  'vessel_arrived','discharged','available','full_out','empty_returned'
];
const MILESTONE_LABELS = {
  empty_out:'Empty Picked Up', full_in:'Full Gate-In', vessel_loaded:'Loaded on Vessel',
  vessel_departed:'Vessel Departed', vessel_arrived:'Vessel Arrived',
  discharged:'Discharged', available:'Available for Pickup',
  full_out:'Full Gate-Out', empty_returned:'Empty Returned',
};

function generateEvent(vessel) {
  if (!vessel) return null;
  const DISRUPTION_ZONES = [
    { lat: 26.5, lng: 56.5, label: 'Strait of Hormuz', r: 4, warn: true },
    { lat: 13.5, lng: 43.5, label: 'Red Sea / Bab-el-Mandeb', r: 3.5, warn: true },
    { lat: 31.5, lng: 32.3, label: 'Suez Canal', r: 2, warn: false },
  ];
  const deg = (a, b) => Math.sqrt((a.lat - b.lat) ** 2 + (a.lng - b.lng) ** 2);
  const zone = DISRUPTION_ZONES.find(z => deg(z, vessel) < z.r);
  const name = vessel.name || `MMSI ${vessel.mmsi}`;
  const spd = (vessel.sog || 0).toFixed(1);
  if (zone) return { name, detail: zone.label, speed: spd, warn: zone.warn, ts: Date.now() };
  if ((vessel.sog || 0) < 0.5) return { name, detail: 'At anchor', speed: spd, warn: false, ts: Date.now() };
  return { name, detail: `${vessel.type || 'Vessel'} in transit`, speed: spd, warn: false, ts: Date.now() };
}

function VGStats({ vessels }) {
  const ctr = vessels.filter(v => v.type?.includes('Container') || (!v.type?.includes('Tanker') && !v.type?.includes('Bulk'))).length;
  const tnk = vessels.filter(v => v.type?.includes('Tanker')).length;
  const blk = vessels.filter(v => v.type?.includes('Bulk')).length;
  const ZONES = [
    { lat: 26.5, lng: 56.5, r: 4 },
    { lat: 13.5, lng: 43.5, r: 3.5 },
    { lat: 31.5, lng: 32.3, r: 2 },
  ];
  const deg = (a, b) => Math.sqrt((a.lat - b.lat) ** 2 + (a.lng - b.lng) ** 2);
  const alerts = vessels.filter(v => ZONES.some(z => deg(z, v) < z.r)).length;

  return (
    <div className="vg-stats">
      <div className="vg-stats-label">FLEET OVERVIEW</div>
      <div className="vg-stats-grid">
        <div className="vg-stat"><span className="vg-stat-val" style={{ color: '#00d4ff' }}>{vessels.length}</span><span className="vg-stat-key">TOTAL</span></div>
        <div className="vg-stat"><span className="vg-stat-val" style={{ color: '#00d4ff' }}>{ctr}</span><span className="vg-stat-key">CONTAINER</span></div>
        <div className="vg-stat"><span className="vg-stat-val" style={{ color: '#f59e0b' }}>{tnk}</span><span className="vg-stat-key">TANKER</span></div>
        <div className="vg-stat"><span className="vg-stat-val" style={{ color: '#a78bfa' }}>{blk}</span><span className="vg-stat-key">BULK</span></div>
      </div>
      {alerts > 0 && (
        <div className="vg-alert-strip">
          <RiAlertLine size={11} />
          <span>{alerts} vessel{alerts !== 1 ? 's' : ''} in disruption zone{alerts !== 1 ? 's' : ''}</span>
        </div>
      )}
    </div>
  );
}

function VGEventFeed({ vessels, selectedVessel, onClear }) {
  const [events, setEvents] = useState([]);
  const timerRef = useRef(null);

  useEffect(() => {
    if (selectedVessel) return;
    if (vessels.length === 0) return;
    const push = () => {
      const v = vessels[Math.floor(Math.random() * vessels.length)];
      const ev = generateEvent(v);
      if (!ev) return;
      setEvents(prev => [ev, ...prev].slice(0, 8));
    };
    push();
    timerRef.current = setInterval(push, 3000);
    return () => clearInterval(timerRef.current);
  }, [vessels, selectedVessel]);

  if (selectedVessel) {
    return (
      <div className="vg-feed">
        <div className="vg-feed-label">
          VESSEL DETAIL
          <button className="vg-feed-clear" onClick={onClear}>✕ CLOSE</button>
        </div>
        <div className="vg-vessel-detail">
          <div className="vg-vd-name">{selectedVessel.name || `MMSI ${selectedVessel.mmsi}`}</div>
          <div className="vg-vd-row"><span>Type</span><span>{selectedVessel.type || '—'}</span></div>
          <div className="vg-vd-row"><span>MMSI</span><span>{selectedVessel.mmsi}</span></div>
          <div className="vg-vd-row"><span>Speed</span><span>{(selectedVessel.sog || 0).toFixed(1)} kn</span></div>
          <div className="vg-vd-row"><span>Course</span><span>{selectedVessel.cog?.toFixed(0) ?? '—'}°</span></div>
          <div className="vg-vd-row"><span>Destination</span><span>{selectedVessel.destination || '—'}</span></div>
          <div className="vg-vd-row"><span>Callsign</span><span>{selectedVessel.callsign || '—'}</span></div>
          {selectedVessel.simulated && <div className="vg-vd-sim">Simulated — connect AISSTREAM_API_KEY for live data</div>}
        </div>
      </div>
    );
  }

  return (
    <div className="vg-feed">
      <div className="vg-feed-label">LIVE EVENT FEED <span className="vg-feed-pulse" /></div>
      <div className="vg-feed-list">
        {events.map((ev, i) => (
          <div key={ev.ts + i} className="vg-feed-card" style={{ animationDelay: `${i * 0.05}s` }}>
            <div className="vg-feed-card-top">
              <span className="vg-feed-vessel">{ev.name}</span>
              {ev.warn && <span className="vg-feed-warn"><RiAlertLine size={9} /> WARN</span>}
            </div>
            <div className="vg-feed-card-detail">{ev.detail} · {ev.speed} kn</div>
          </div>
        ))}
        {events.length === 0 && <div className="vg-feed-empty"><RiRadarLine size={22} /><span>Scanning...</span></div>}
      </div>
    </div>
  );
}

function VGContainerTracker() {
  const [input, setInput] = useState('');
  const [inputType, setInputType] = useState('container_number');
  const [trackData, setTrackData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const submit = async () => {
    if (!input.trim()) return;
    setError(''); setTrackData(null); setLoading(true);
    try {
      const r = await fetch(`${API}/api/containers/track`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ number: input.trim(), type: inputType }),
      });
      const d = await r.json();
      if (d.error) { setError(typeof d.error === 'string' ? d.error : 'Tracking failed'); }
      else setTrackData(d);
    } catch (e) { setError(e.message); }
    setLoading(false);
  };

  const events = trackData?.included?.filter(i => i.type === 'event') || [];
  const eventKeys = new Set(events.map(e => e.attributes?.event));

  return (
    <div className="vg-ctr">
      <div className="vg-feed-label">CONTAINER TRACKER</div>
      <div className="vg-ctr-row">
        <select className="vg-ctr-sel" value={inputType} onChange={e => setInputType(e.target.value)}>
          <option value="container_number">Container #</option>
          <option value="bill_of_lading">Bill of Lading</option>
        </select>
        <input className="vg-ctr-input" placeholder="MSCU1234567" value={input}
          onChange={e => setInput(e.target.value)} onKeyDown={e => e.key === 'Enter' && submit()} />
        <button className="vg-ctr-btn" onClick={submit} disabled={!input || loading}>
          {loading ? <RiRefreshLine className="vg-spin" size={11} /> : 'TRACK'}
        </button>
      </div>
      {error && <div className="vg-ctr-error">{error}</div>}
      {trackData && (
        <div className="vg-ctr-timeline">
          {CONTAINER_MILESTONES.map((m, i) => {
            const done = eventKeys.has(m);
            const isActive = done && !CONTAINER_MILESTONES.slice(i + 1).some(n => eventKeys.has(n));
            return (
              <div key={m} className={`vg-ms${done ? ' done' : ''}${isActive ? ' active' : ''}`}>
                <div className="vg-ms-dot" />
                {i < CONTAINER_MILESTONES.length - 1 && <div className="vg-ms-line" />}
                <div className="vg-ms-label">{MILESTONE_LABELS[m]}</div>
              </div>
            );
          })}
        </div>
      )}
      {!trackData && !loading && (
        <div className="vg-ctr-hint">Track by container # or B/L across 35+ carriers</div>
      )}
    </div>
  );
}

export default function VGPanel({ vessels, selectedVessel, onClearVessel }) {
  return (
    <div className="vg-panel">
      <VGStats vessels={vessels} />
      <VGEventFeed vessels={vessels} selectedVessel={selectedVessel} onClear={onClearVessel} />
      <VGContainerTracker />
    </div>
  );
}
```

**Step 2: Commit**

```bash
git add frontend/src/components/VGPanel.jsx
git commit -m "feat: add VGPanel — stats strip, live event feed, vessel detail, container tracker"
```

---

### Task 5: Rewrite VesselsPage + CSS

**Files:**
- Rewrite: `frontend/src/pages/VesselsPage.jsx`
- Rewrite: `frontend/src/pages/VesselsPage.css`

**New VesselsPage.jsx:**

```jsx
// frontend/src/pages/VesselsPage.jsx
import { useState, useEffect, useRef } from 'react';
import { RiShipLine, RiRefreshLine, RiWifiLine } from 'react-icons/ri';
import VesselsGlobe from '../components/VesselsGlobe';
import VGPanel from '../components/VGPanel';
import './VesselsPage.css';

const API = import.meta.env.VITE_API_URL || 'http://localhost:5001';

export default function VesselsPage() {
  const [vessels, setVessels] = useState([]);
  const [source, setSource] = useState('');
  const [loading, setLoading] = useState(true);
  const [selectedVessel, setSelectedVessel] = useState(null);
  const wrapRef = useRef(null);
  const [dims, setDims] = useState({ w: 0, h: 0 });

  const fetchVessels = () => {
    setLoading(true);
    fetch(`${API}/api/vessels`)
      .then(r => r.json())
      .then(d => { setVessels(d.vessels || []); setSource(d.source); setLoading(false); })
      .catch(() => setLoading(false));
  };

  useEffect(() => {
    fetchVessels();
    const id = setInterval(fetchVessels, 30000);
    return () => clearInterval(id);
  }, []);

  // Measure the globe wrap area for Globe width/height
  useEffect(() => {
    const measure = () => {
      if (!wrapRef.current) return;
      const { offsetWidth, offsetHeight } = wrapRef.current;
      setDims({ w: offsetWidth, h: offsetHeight });
    };
    measure();
    const ro = new ResizeObserver(measure);
    if (wrapRef.current) ro.observe(wrapRef.current);
    return () => ro.disconnect();
  }, []);

  return (
    <div className="vg-page">
      <div className="vg-header">
        <RiShipLine size={15} className="vg-header-icon" />
        <span className="vg-header-title">OCEAN COMMAND</span>
        {source && (
          <span className={`vg-source-badge ${source}`}>
            <RiWifiLine size={9} /> {source === 'live' ? 'LIVE AIS' : 'SIMULATED'}
          </span>
        )}
        <span className="vg-vessel-count">{vessels.length} vessels tracked</span>
        <button className="vg-refresh-btn" onClick={fetchVessels} title="Refresh">
          <RiRefreshLine size={13} className={loading ? 'vg-spin' : ''} />
        </button>
        <div className="vg-disruption-badges">
          <span className="vg-dz-badge red">Hormuz</span>
          <span className="vg-dz-badge amber">Red Sea</span>
          <span className="vg-dz-badge amber">Suez</span>
        </div>
      </div>

      <div className="vg-body">
        <div className="vg-globe-wrap" ref={wrapRef}>
          {dims.w > 0 && (
            <VesselsGlobe
              vessels={vessels}
              onVesselClick={setSelectedVessel}
              width={dims.w}
              height={dims.h}
            />
          )}
          <div className="vg-legend">
            <span style={{ color: '#00d4ff' }}>■ Container</span>
            <span style={{ color: '#f59e0b' }}>■ Tanker</span>
            <span style={{ color: '#a78bfa' }}>■ Bulk Carrier</span>
            <span style={{ color: '#ef4444' }}>◎ Disruption Zone</span>
          </div>
          <div className="vg-scanline" />
        </div>
        <VGPanel
          vessels={vessels}
          selectedVessel={selectedVessel}
          onClearVessel={() => setSelectedVessel(null)}
        />
      </div>
    </div>
  );
}
```

**New VesselsPage.css:**

```css
/* frontend/src/pages/VesselsPage.css */
.vg-page { display: flex; flex-direction: column; flex: 1; min-height: 0; overflow: hidden; background: #060b18; }

/* Header */
.vg-header {
  display: flex; align-items: center; gap: 10px; padding: 10px 18px;
  border-bottom: 1px solid rgba(0,212,255,0.1); flex-shrink: 0;
  background: rgba(6,11,24,0.95);
}
.vg-header-icon { color: #00d4ff; }
.vg-header-title { font-family: 'JetBrains Mono', monospace; font-size: 12px; color: #e2e8f0; letter-spacing: 0.12em; font-weight: 700; }
.vg-source-badge {
  display: flex; align-items: center; gap: 4px;
  font-family: 'JetBrains Mono', monospace; font-size: 9px; letter-spacing: 0.1em;
  padding: 2px 8px; border-radius: 4px; font-weight: 700;
}
.vg-source-badge.live { background: rgba(16,185,129,0.12); color: #10b981; border: 1px solid rgba(16,185,129,0.3); }
.vg-source-badge.simulated { background: rgba(71,85,105,0.18); color: #64748b; border: 1px solid rgba(71,85,105,0.3); }
.vg-vessel-count { font-family: 'JetBrains Mono', monospace; font-size: 11px; color: #334155; }
.vg-refresh-btn { background: none; border: none; color: #334155; cursor: pointer; padding: 4px; transition: color 0.15s; }
.vg-refresh-btn:hover { color: #00d4ff; }
@keyframes vg-spin { to { transform: rotate(360deg); } }
.vg-spin { animation: vg-spin 1s linear infinite; }
.vg-disruption-badges { display: flex; gap: 5px; margin-left: auto; }
.vg-dz-badge {
  font-family: 'JetBrains Mono', monospace; font-size: 8px; letter-spacing: 0.08em;
  padding: 2px 7px; border-radius: 3px; font-weight: 700;
}
.vg-dz-badge.red { background: rgba(239,68,68,0.1); color: #ef4444; border: 1px solid rgba(239,68,68,0.25); }
.vg-dz-badge.amber { background: rgba(245,158,11,0.1); color: #f59e0b; border: 1px solid rgba(245,158,11,0.25); }

/* Body layout */
.vg-body { display: flex; flex: 1; min-height: 0; overflow: hidden; }
.vg-globe-wrap { flex: 1; min-width: 0; position: relative; overflow: hidden; background: #020810; }

/* Scanline overlay */
.vg-scanline {
  position: absolute; inset: 0; pointer-events: none; z-index: 2;
  background: repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(0,0,0,0.04) 2px, rgba(0,0,0,0.04) 4px);
}

/* Legend */
.vg-legend {
  position: absolute; bottom: 14px; left: 14px; z-index: 10;
  display: flex; flex-direction: column; gap: 4px;
  background: rgba(6,11,24,0.88); border: 1px solid rgba(255,255,255,0.07);
  border-radius: 8px; padding: 10px 14px; font-size: 11px;
  backdrop-filter: blur(8px);
}
.vg-legend span { color: #94a3b8; letter-spacing: 0.03em; }

/* Right panel */
.vg-panel {
  width: 310px; flex-shrink: 0; border-left: 1px solid rgba(0,212,255,0.08);
  display: flex; flex-direction: column; overflow-y: auto;
  background: rgba(6,11,24,0.97);
}

/* Stats */
.vg-stats { padding: 14px 16px; border-bottom: 1px solid rgba(255,255,255,0.05); flex-shrink: 0; }
.vg-stats-label { font-family: 'JetBrains Mono', monospace; font-size: 9px; color: #334155; letter-spacing: 0.1em; margin-bottom: 10px; }
.vg-stats-grid { display: grid; grid-template-columns: 1fr 1fr 1fr 1fr; gap: 6px; }
.vg-stat { display: flex; flex-direction: column; align-items: center; gap: 2px; background: rgba(255,255,255,0.02); border: 1px solid rgba(255,255,255,0.05); border-radius: 6px; padding: 8px 4px; }
.vg-stat-val { font-family: 'JetBrains Mono', monospace; font-size: 18px; font-weight: 700; line-height: 1; }
.vg-stat-key { font-family: 'JetBrains Mono', monospace; font-size: 7px; color: #334155; letter-spacing: 0.06em; }
.vg-alert-strip {
  display: flex; align-items: center; gap: 6px; margin-top: 8px; padding: 6px 10px;
  background: rgba(239,68,68,0.08); border: 1px solid rgba(239,68,68,0.2); border-radius: 6px;
  font-size: 10px; color: #ef4444; font-family: 'JetBrains Mono', monospace;
}

/* Feed */
.vg-feed { padding: 14px 16px; border-bottom: 1px solid rgba(255,255,255,0.05); flex: 1; min-height: 0; display: flex; flex-direction: column; }
.vg-feed-label {
  font-family: 'JetBrains Mono', monospace; font-size: 9px; color: #334155;
  letter-spacing: 0.1em; margin-bottom: 10px; display: flex; align-items: center; gap: 6px;
}
.vg-feed-clear { margin-left: auto; background: none; border: 1px solid rgba(255,255,255,0.08); border-radius: 4px; color: #475569; font-size: 8px; padding: 2px 6px; cursor: pointer; font-family: 'JetBrains Mono', monospace; letter-spacing: 0.05em; }
.vg-feed-clear:hover { color: #e2e8f0; border-color: rgba(255,255,255,0.2); }
.vg-feed-pulse { width: 5px; height: 5px; border-radius: 50%; background: #10b981; animation: vg-blink 1.4s ease-in-out infinite; display: inline-block; }
@keyframes vg-blink { 0%,100% { opacity: 1; } 50% { opacity: 0.2; } }
.vg-feed-list { display: flex; flex-direction: column; gap: 4px; overflow-y: auto; }
.vg-feed-card {
  padding: 8px 10px; background: rgba(255,255,255,0.02);
  border: 1px solid rgba(255,255,255,0.05); border-radius: 6px;
  animation: vg-slide-in 0.3s both; flex-shrink: 0;
}
@keyframes vg-slide-in { from { opacity: 0; transform: translateY(-6px); } to { opacity: 1; transform: translateY(0); } }
.vg-feed-card-top { display: flex; align-items: center; gap: 6px; margin-bottom: 3px; }
.vg-feed-vessel { font-size: 11px; font-weight: 600; color: #e2e8f0; font-family: 'JetBrains Mono', monospace; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; flex: 1; }
.vg-feed-warn { display: flex; align-items: center; gap: 3px; font-size: 8px; color: #ef4444; font-family: 'JetBrains Mono', monospace; flex-shrink: 0; }
.vg-feed-card-detail { font-size: 10px; color: #334155; }
.vg-feed-empty { display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 8px; color: #1e293b; padding: 20px; font-size: 11px; }

/* Vessel detail */
.vg-vessel-detail { display: flex; flex-direction: column; gap: 2px; }
.vg-vd-name { font-family: 'JetBrains Mono', monospace; font-size: 13px; font-weight: 700; color: #00d4ff; margin-bottom: 8px; }
.vg-vd-row { display: flex; justify-content: space-between; padding: 5px 0; border-bottom: 1px solid rgba(255,255,255,0.04); font-size: 11px; }
.vg-vd-row span:first-child { color: #334155; }
.vg-vd-row span:last-child { color: #94a3b8; font-family: 'JetBrains Mono', monospace; font-size: 10px; }
.vg-vd-sim { margin-top: 8px; font-size: 10px; color: #334155; font-style: italic; }

/* Container tracker */
.vg-ctr { padding: 14px 16px; flex-shrink: 0; }
.vg-ctr-row { display: flex; gap: 5px; margin-bottom: 8px; }
.vg-ctr-sel { background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.08); border-radius: 5px; color: #64748b; font-size: 10px; padding: 5px 6px; cursor: pointer; }
.vg-ctr-input { flex: 1; min-width: 0; background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.08); border-radius: 5px; color: #e2e8f0; font-size: 11px; padding: 5px 8px; font-family: 'JetBrains Mono', monospace; outline: none; }
.vg-ctr-input:focus { border-color: rgba(0,212,255,0.3); }
.vg-ctr-btn { padding: 5px 10px; background: rgba(0,212,255,0.1); border: 1px solid rgba(0,212,255,0.25); border-radius: 5px; color: #00d4ff; font-size: 9px; cursor: pointer; font-family: 'JetBrains Mono', monospace; letter-spacing: 0.05em; flex-shrink: 0; }
.vg-ctr-btn:disabled { opacity: 0.4; cursor: not-allowed; }
.vg-ctr-error { font-size: 10px; color: #ef4444; margin-bottom: 8px; }
.vg-ctr-hint { font-size: 10px; color: #1e293b; line-height: 1.5; }
.vg-ctr-timeline { display: flex; flex-direction: column; }
.vg-ms { display: flex; align-items: flex-start; gap: 10px; position: relative; padding-bottom: 14px; }
.vg-ms-dot { width: 8px; height: 8px; border-radius: 50%; flex-shrink: 0; margin-top: 3px; background: rgba(255,255,255,0.06); border: 1.5px solid rgba(255,255,255,0.1); transition: all 0.3s; }
.vg-ms.done .vg-ms-dot { background: #10b981; border-color: #10b981; box-shadow: 0 0 6px rgba(16,185,129,0.4); }
.vg-ms.active .vg-ms-dot { background: #00d4ff; border-color: #00d4ff; animation: vg-pulse-dot 1.5s ease-in-out infinite; }
@keyframes vg-pulse-dot { 0%,100% { box-shadow: 0 0 4px rgba(0,212,255,0.4); } 50% { box-shadow: 0 0 12px rgba(0,212,255,0.8); } }
.vg-ms-line { position: absolute; left: 3px; top: 14px; bottom: 0; width: 2px; background: rgba(255,255,255,0.05); }
.vg-ms.done .vg-ms-line { background: rgba(16,185,129,0.2); }
.vg-ms-label { font-size: 11px; color: #334155; padding-top: 1px; }
.vg-ms.done .vg-ms-label { color: #64748b; }
.vg-ms.active .vg-ms-label { color: #00d4ff; font-weight: 600; }
```

**Step 2: Verify build**

```bash
cd frontend && npm run build
```
Expected: `✓ built in X.XXs` with no errors.

**Step 3: Spot check locally**

```bash
cd frontend && npm run dev
```
Open http://localhost:3001/vessels — confirm:
- Globe renders (dark ocean globe with vessel dots)
- Right panel shows stats, event feed, container tracker
- Clicking a vessel dot shows vessel detail in panel
- Globe auto-rotates slowly

**Step 4: Commit**

```bash
git add frontend/src/pages/VesselsPage.jsx frontend/src/pages/VesselsPage.css
git commit -m "feat: vessels page — ocean command globe with live feed panel, container tracker"
```

---

### Task 6: Add new components to git + final build + push

**Step 1: Verify all files are staged/committed**

```bash
git status
```
Expected: clean working tree.

**Step 2: Final build verification**

```bash
cd frontend && npm run build 2>&1 | tail -10
```
Expected: `✓ built in X.XXs`

**Step 3: Push**

```bash
git push origin main
```
