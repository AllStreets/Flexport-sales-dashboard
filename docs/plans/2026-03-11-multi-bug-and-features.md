# Multi-Bug & Feature Sprint — 2026-03-11

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Fix 11 groups of bugs and features across the Flexport SDR Intelligence Hub, executed in priority order.

**Architecture:** React 19 + Vite 7 frontend (Vercel), Express 5 + SQLite backend (Railway). Globe pages use react-globe.gl + Three.js custom layers. All pages share a design system of `#060b18` bg, `#00d4ff` accent, Space Grotesk + JetBrains Mono fonts.

**Tech Stack:** React 19, Vite 7, react-globe.gl, Three.js, Express 5, SQLite, Web Speech API (for microphone feature), react-icons/ri

---

## PRIORITY ORDER

1. Settings scrolling (CSS bug — 5 min)
2. Air Freight ADS-B deployment fix (backend bug — must push)
3. Account 360 Call Parser visibility + wiring (UI bug — must push)
4. Sidebar reorder (simple — push)
5. Land Freight truck sprite direction (sprite math fix — push)
6. Air Freight: darker colors + simulated plane animation (visual — push)
7. Ocean Freight: animated sim vessels along ocean routes (feature — push)
8. Market Map: fix company sector categorization via web research (data — push)
9. Market Map: node layout + Bangladesh name + signal timeline (UI — push)
10. Live Call: microphone AI listening button (new feature — push)
11. Final audit + README update (last — push)

---

## Task 1: Settings Page Scrolling Fix

**Files:**
- Modify: `frontend/src/pages/SettingsPage.css`

**Problem:** The settings-content area has no overflow-y, so long sections cannot be scrolled.

**Step 1: Read the CSS to identify the container**

The `.settings-content` div is the right pane. It needs `overflow-y: auto` and `height: calc(100vh - 52px)`.

**Step 2: Edit SettingsPage.css**

Find the `.settings-content` rule and add:
```css
.settings-content {
  flex: 1;
  min-width: 0;
  padding: 28px 32px;
  display: flex;
  flex-direction: column;
  gap: 20px;
  max-width: 760px;
  overflow-y: auto;             /* ADD */
  height: calc(100vh - 52px);  /* ADD */
}
```

Also ensure `.settings-page` itself allows vertical overflow:
```css
.settings-page {
  display: flex;
  gap: 0;
  min-height: calc(100vh - 52px);
  font-family: 'Space Grotesk', sans-serif;
  overflow: hidden;  /* ADD — clips to viewport, children handle their own scroll */
}
```

**Step 3: Commit**
```bash
git add frontend/src/pages/SettingsPage.css
git commit -m "fix: settings page content area scrollable"
```

---

## Task 2: Air Freight — ADS-B Live Data on Railway Deployment

**Files:**
- Modify: `backend/server.js` (flights endpoint, ~line 1486)

**Root Cause Analysis:**
OpenSky Network blocks unauthenticated requests from cloud datacenter IPs (Railway uses AWS/GCP ranges). Even with credentials, their OAuth flow may reject server-to-server calls from datacenter ranges. On localhost, your residential IP is allowed.

**Fix Strategy:** Implement a **browser-side proxy approach**:
1. Backend exposes a `/api/opensky-token` endpoint that returns a short-lived OAuth token
2. Frontend fetches the token then calls OpenSky directly from the browser (user's residential/office IP)
3. Backend `/api/flights` still works as fallback sim when live fails
4. Add a `?debug=1` query param to `/api/flights` that returns the error reason in the response

**Step 1: Add token proxy endpoint to server.js**

After the existing `getOpenSkyToken()` function (~line 1419), add:
```js
// Token proxy: lets the browser call OpenSky directly using the user's IP
app.get('/api/opensky-token', async (req, res) => {
  try {
    const token = await getOpenSkyToken();
    if (!token) return res.status(503).json({ error: 'OpenSky credentials not configured' });
    res.json({ token, expires_in: 300 });
  } catch (e) {
    res.status(503).json({ error: e.message });
  }
});
```

**Step 2: Update /api/flights to log and return error reason**

In the `app.get('/api/flights', ...)` handler, update the catch block to store the error:
```js
// ~line 1504 area — inside the try block that calls OpenSky:
} catch (liveErr) {
  console.error('[flights] Live ADS-B failed:', liveErr?.response?.status, liveErr?.message);
  // Fall through to simulated data
  const debugInfo = req.query.debug ? { liveError: liveErr.message, status: liveErr?.response?.status } : undefined;
  const flights = buildSimFlights();
  return res.json({ flights, source: 'sim', ...(debugInfo && { debugInfo }) });
}
```

**Step 3: Update FlightsPage.jsx to attempt browser-side OpenSky fetch**

In `frontend/src/pages/FlightsPage.jsx`, add a new `fetchFlightsWithBrowserFallback` function:
```js
async function fetchFlightsWithBrowserFallback(API) {
  // First try our backend (works on localhost, may fail on Railway due to IP blocking)
  try {
    const r = await fetch(`${API}/api/flights`);
    const d = await r.json();
    if (d.source === 'live' && d.flights?.length > 0) return d;
  } catch (_) {}

  // If backend returned sim, try browser-side OpenSky using token from backend
  try {
    const tokenRes = await fetch(`${API}/api/opensky-token`);
    if (!tokenRes.ok) throw new Error('no token');
    const { token } = await tokenRes.json();
    // Fetch cargo callsigns from OpenSky using user's IP
    const osRes = await fetch('https://opensky-network.org/api/states/all', {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!osRes.ok) throw new Error(`OpenSky ${osRes.status}`);
    const data = await osRes.json();
    const states = (data?.states || []).filter(s =>
      s[5] != null && s[6] != null && !s[8]
    );
    if (states.length >= 20) {
      return { source: 'live_browser', flights: states.slice(0, 300).map(s => ({
        id: s[0], callsign: (s[1] || '').trim(), isCargo: true,
        lat: s[6], lng: s[5], altitude: (s[13] || 10000),
        velocity: s[9] ? Math.round(s[9] * 1.944) : 460,
        heading: s[10] || 0,
      })) };
    }
  } catch (_) {}

  // Final fallback: simulated
  const r = await fetch(`${API}/api/flights?mode=sim`);
  return r.json();
}
```

Then use this function in the `useEffect` that fetches flights in FlightsPage.jsx, replacing the plain `fetch(\`${API}/api/flights\`)` call.

**Step 4: Update FlightsPage header badge to show "LIVE (browser)" source**

The existing `source` state in FlightsPage will now also be `'live_browser'` — update the badge logic to show "LIVE" for both `'live'` and `'live_browser'`.

**Step 5: Add OPENSKY env vars to Railway**

In Railway dashboard → backend service → Variables:
- `OPENSKY_CLIENT_ID` = `allstreets-api-client`
- `OPENSKY_CLIENT_SECRET` = (your actual secret)

**Step 6: Commit and push**
```bash
git add backend/server.js frontend/src/pages/FlightsPage.jsx
git commit -m "fix: ADS-B live data via browser-side OpenSky fetch to bypass Railway IP blocks"
git push
```

---

## Task 3: Account 360 — Call Parser Notes Visibility & Wiring

**Files:**
- Modify: `frontend/src/pages/Account360Page.jsx`
- Verify: `frontend/src/App.jsx` (lastCallData prop threading)

**Current State:** The CI panel exists (lines 492-570) but starts collapsed (`callIntelOpen = false`). The live call data flow: `LiveCallModal.onEndCall → App.handleEndCall → lastCallData state → Account360Page.lastCallData prop`.

**Step 1: Read App.jsx routes section to verify lastCallData prop is passed**

Look for the `<Route path="/account/:id"` entry and confirm `lastCallData={lastCallData}` is passed as a prop. If it's missing, add it.

**Step 2: Make CI panel open by default and more prominent**

In Account360Page.jsx, change the initial state:
```js
// Line ~270: change default to true so the panel is visible
const [callIntelOpen, setCallIntelOpen] = useState(true);
```

**Step 3: Add a visual "Call Notes" label/section above the CI panel**

Add a visible header label above the `glass-card ci-panel` div:
```jsx
{/* Call Notes & Intelligence Parser */}
<div className="a360-section-divider">
  <RiFileTextLine size={14} />
  Call Notes
</div>
<div className="glass-card ci-panel">
  ...
```

And in Account360Page.css, add:
```css
.a360-section-divider {
  display: flex;
  align-items: center;
  gap: 8px;
  font-family: 'JetBrains Mono', monospace;
  font-size: 11px;
  font-weight: 600;
  color: #00d4ff;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  margin: 20px 0 8px;
}
```

**Step 4: Verify the live call notes → CI flow works end to end**

In Account360Page.jsx, confirm the `useEffect` that listens for `lastCallData` (lines 356-367):
- It watches `[lastCallData, id, data, analyzeCall]`
- If `lastCallData.prospectId === id`, it sets `callNotes`, opens CI panel, and calls `analyzeCall(notes)`
- This should work IF `lastCallData` is correctly threaded from App.jsx

Verify App.jsx passes it to the Route:
```jsx
<Route path="/account/:id" element={
  <Account360Page
    onAddToPipeline={handleAddToPipeline}
    onOpenOutreach={handleOpenOutreach}
    onStartLiveCall={handleStartLiveCall}
    lastCallData={lastCallData}   // ← must be present
    onEndCall={handleEndCall}
    onOpenEmailComposer={handleOpenEmailComposer}
  />
} />
```

**Step 5: Commit and push**
```bash
git add frontend/src/pages/Account360Page.jsx frontend/src/pages/Account360Page.css frontend/src/App.jsx
git commit -m "fix: account 360 call parser notes expanded by default and properly wired"
git push
```

---

## Task 4: Sidebar Reorder

**Files:**
- Modify: `frontend/src/components/Sidebar.jsx`

**Desired order (top to bottom):**
Home → Air Freight → Land Freight → Ocean Freight → Market Map → Trade Intelligence → Quick Research → SDR Dashboard → [bottom] Settings

**Step 1: Edit NAV array in Sidebar.jsx**

```js
const NAV = [
  { to: '/',            Icon: RiGlobalLine,          label: 'Home'               },
  { to: '/flights',     Icon: RiPlaneLine,            label: 'Air Freight'        },
  { to: '/land',        Icon: RiTruckLine,            label: 'Land Freight'       },
  { to: '/vessels',     Icon: RiShipLine,             label: 'Ocean Freight'      },
  { to: '/market',      Icon: RiRadarLine,            label: 'Market Map'         },
  { to: '/trade',       Icon: RiLineChartLine,        label: 'Trade Intelligence' },
  { to: '/research',    Icon: RiSearchEyeLine,        label: 'Quick Research'     },
  { to: '/performance', Icon: RiBarChartGroupedLine,  label: 'SDR Research'       },
];
```

Note: the user specified "SDR Research" as the label for the performance page.

**Step 2: Commit and push**
```bash
git add frontend/src/components/Sidebar.jsx
git commit -m "feat: reorder sidebar — Air, Land, Ocean, Market, Trade, Research, SDR"
git push
```

---

## Task 5: Land Freight — Truck Sprite Direction (Wheels Always Down)

**Files:**
- Modify: `frontend/src/components/LandGlobe.jsx`

**Problem:** When trucks travel westward (heading 181–359°), the sprite rotates ~180° causing the wheels (at bottom of canvas) to appear at the top — flipping "wheels into the sky." Fix: detect westward trucks and flip sprite.scale.y to -1 so wheels stay on the globe-surface side.

**Step 1: Update customThreeObjectUpdate in LandGlobe.jsx**

In `customThreeObjectUpdate` (line ~460-468):
```js
customThreeObjectUpdate={(sprite, truck, globeRadius) => {
  setSpritePos(sprite, truck.lat, truck.lng, 0.035, globeRadius);
  const h = ((truck.heading || 0) + 360) % 360;
  // Trucks going west (heading 90°–270°) need Y-flip so wheels stay on surface side
  const flipY = h > 90 && h <= 270;
  sprite.scale.set(5, flipY ? -2.4 : 2.4, 1);
  sprite.material.rotation = Math.PI / 2 - h * Math.PI / 180;
  threeRefs.current.sprites.set(truck.id, {
    sprite, srcLat: truck.srcLat, srcLng: truck.srcLng,
    dstLat: truck.dstLat, dstLng: truck.dstLng,
    progress0: truck.progress ?? 0, fetchTs: Date.now(), globeRadius,
  });
}}
```

**Step 2: Update the RAF animation loop (~line 332-339) to also apply the flip**

```js
for (const entry of refs.sprites.values()) {
  const { sprite, srcLat, srcLng, dstLat, dstLng, progress0, fetchTs, globeRadius } = entry;
  const elapsed = (now - fetchTs) / 1000;
  const t = (progress0 + elapsed / 86400) % 1;
  const pt = gcPoint(srcLat, srcLng, dstLat, dstLng, t);
  setSpritePos(sprite, pt.lat, pt.lng, 0.035, globeRadius);
  const h = ((pt.heading || 0) + 360) % 360;
  const flipY = h > 90 && h <= 270;
  sprite.scale.set(5, flipY ? -2.4 : 2.4, 1);
  sprite.material.rotation = Math.PI / 2 - h * Math.PI / 180;
}
```

**Step 3: Commit and push**
```bash
git add frontend/src/components/LandGlobe.jsx
git commit -m "fix: land freight trucks — flip Y scale for westward trucks so wheels face globe surface"
git push
```

---

## Task 6: Air Freight — Darker Globe Aesthetics + Animated Sim Planes

**Files:**
- Modify: `frontend/src/components/FlightsGlobe.jsx`
- Modify: `frontend/src/pages/FlightsPage.jsx` (minor, if globe texture override needed)

### Part A: Darker Colors & Wider Trails

**Step 1: Update color constants in FlightsGlobe.jsx (~line 43-46)**

Change from bright rose/violet to deeper, darker shades:
```js
const CARGO_COLOR = 'rgba(190,70,100,0.9)';   // deep rose (darker than 251,113,133)
const PAX_COLOR   = 'rgba(110,80,200,0.9)';   // deep violet (darker than 167,139,250)
const CARGO_DIM   = 'rgba(190,70,100,0.12)';  // wider trail — 0.12 vs old 0.07
const PAX_DIM     = 'rgba(110,80,200,0.12)';
```

**Step 2: Increase arc stroke width and trail**

In the Globe JSX props (~line 422-430):
```jsx
arcStroke={0.38}           // was 0.22
arcDashLength={0.65}       // was 0.55
arcDashGap={0.35}          // was 0.45
arcDashAnimateTime={4000}  // was 5000 (slightly faster)
```

**Step 3: Darken the globe by switching to earth-blue-marble texture**

The earth-day.jpg is too bright. Use earth-night.jpg instead (same as Land/Home pages, distinct from Ocean which uses blue-marble). Update the Globe JSX:
```jsx
globeImageUrl="//unpkg.com/three-globe/example/img/earth-night.jpg"
atmosphereColor="rgba(160,100,220,0.3)"   // purple-tinted atmosphere for air
atmosphereAltitude={0.22}
```

Note: this makes Air Freight use earth-night.jpg same as Land, but the purple atmosphere distinguishes it visually. If user prefers to keep earth-day.jpg, just tweak the atmosphere instead.

### Part B: Animated Sim Planes (30s–5min route cycles)

**Problem:** The current RAF loop uses `elapsed / 86400` (24-hour cycle) so planes appear stationary between API fetches. Need them to complete full routes in 30s–5min.

**Step 4: Change the time divisor in the RAF animation loop (~line 257-263)**

```js
// Each simulated flight gets a random cycle duration between 30s and 300s
// determined by its stable phase/seed, stored in the sprites map entry.
if (refs.sprites.size > 0) {
  const now = Date.now();
  for (const entry of refs.sprites.values()) {
    const { sprite, srcLat, srcLng, dstLat, dstLng, progress0, fetchTs, globeRadius, cycleSecs } = entry;
    const elapsed = (now - fetchTs) / 1000;
    const t = (progress0 + elapsed / cycleSecs) % 1;
    const pt = gcFlightPoint(srcLat, srcLng, dstLat, dstLng, t);
    setSpritePos(sprite, pt.lat, pt.lng, 0.04, globeRadius);
    sprite.material.rotation = -(pt.heading * Math.PI / 180);
  }
}
```

**Step 5: Pass cycleSecs when registering sprites in customThreeObjectUpdate (~line 404-419)**

```js
customThreeObjectUpdate={(sprite, f, globeRadius) => {
  if (f.srcLat && f.dstLat) {
    // Derive a stable cycle duration from the flight ID seed: 45–240 seconds
    const seed = parseInt(f.id.replace(/\D/g, '').slice(-4) || '100', 10);
    const cycleSecs = 45 + (seed % 196); // 45..240 seconds per route completion
    threeRefs.current.sprites.set(f.id, {
      sprite, srcLat: f.srcLat, srcLng: f.srcLng,
      dstLat: f.dstLat, dstLng: f.dstLng,
      progress0: f.progress ?? 0, fetchTs: Date.now(), globeRadius, cycleSecs,
    });
    setSpritePos(sprite, f.lat, f.lng, 0.04, globeRadius);
  } else {
    threeRefs.current.sprites.delete(f.id);
    setSpritePos(sprite, f.lat, f.lng, 0.04, globeRadius);
  }
  sprite.material.rotation = -((f.heading ?? 0) * Math.PI / 180);
}}
```

**Step 6: Commit and push**
```bash
git add frontend/src/components/FlightsGlobe.jsx
git commit -m "feat: air freight — darker colors, wider trails, animated sim planes (45-240s cycles)"
git push
```

---

## Task 7: Ocean Freight — Animated Sim Vessels Along Ocean Routes

**Files:**
- Modify: `frontend/src/components/VesselsGlobe.jsx`

**Problem:** VesselsGlobe has no sprite animation RAF — vessels sit static at their current simulated position. Need to add sprite animation similar to FlightsGlobe, with shorter 30s–5min cycles. Routes between major ocean ports are naturally ocean-only (great-circle between distant ports doesn't cross major landmasses).

**Step 1: Add sprites Map to threeRefs**

In the `threeRefs.current` initialization (~line 108-113):
```js
const threeRefs = useRef({
  frame: null, shouldAnimate: false,
  glowMesh: null, glowGeom: null, glowMat: null,
  ringMesh: null, ringGeom: null, ringMat: null,
  moonMesh: null, moonGeom: null, moonMat: null, moonTex: null,
  sprites: new Map(), // ← ADD
});
```

**Step 2: Clear sprites on new vessel data**

After the threeRefs declaration:
```js
useEffect(() => { threeRefs.current.sprites.clear(); }, [vessels]);
```

**Step 3: Add gcPoint function (same SLERP as Land/Air Freight)**

Copy `gcFlightPoint` from FlightsGlobe.jsx into VesselsGlobe.jsx — rename it `gcVesselPoint` or just `gcPoint`. Also add `setSpritePos` if not already there (copy from FlightsGlobe).

**Step 4: Add sprite animation to the RAF loop in VesselsGlobe.jsx (~line 203-214)**

```js
refs.shouldAnimate = true;
const animate = () => {
  if (!refs.shouldAnimate) return;
  try {
    if (refs.ringMesh) refs.ringMesh.rotation.z += 0.001;
    if (refs.moonMesh) {
      const t = Date.now() * 0.00008;
      refs.moonMesh.position.set(Math.cos(t) * 165, Math.sin(t * 0.28) * 28, Math.sin(t) * 165);
    }
    // Animate vessel sprites along their routes
    if (refs.sprites.size > 0) {
      const now = Date.now();
      for (const entry of refs.sprites.values()) {
        const { sprite, srcLat, srcLng, dstLat, dstLng, progress0, fetchTs, globeRadius, cycleSecs } = entry;
        const elapsed = (now - fetchTs) / 1000;
        const t = (progress0 + elapsed / cycleSecs) % 1;
        const pt = gcPoint(srcLat, srcLng, dstLat, dstLng, t);
        setSpritePos(sprite, pt.lat, pt.lng, 0.018, globeRadius);
        // Ships: bow at top of canvas, portrait sprite → heading rotates directly
        sprite.material.rotation = -(pt.heading * Math.PI / 180);
      }
    }
  } catch (_) {}
  refs.frame = requestAnimationFrame(animate);
};
animate();
```

**Step 5: Register sprites in customThreeObjectUpdate (add customLayer to VesselsGlobe)**

Currently VesselsGlobe uses `customLayerData` for vessel sprites. In `customThreeObjectUpdate`:
```js
customThreeObjectUpdate={(sprite, vessel, globeRadius) => {
  if (vessel.srcLat && vessel.dstLat) {
    const seed = parseInt(String(vessel.mmsi || vessel.id || '1000').slice(-4), 10) || 100;
    const cycleSecs = 60 + (seed % 240); // 60–300 seconds per full route
    threeRefs.current.sprites.set(vessel.mmsi || vessel.id, {
      sprite, srcLat: vessel.srcLat, srcLng: vessel.srcLng,
      dstLat: vessel.dstLat, dstLng: vessel.dstLng,
      progress0: vessel.progress ?? 0, fetchTs: Date.now(), globeRadius, cycleSecs,
    });
    setSpritePos(sprite, vessel.lat, vessel.lng, 0.018, globeRadius);
  } else {
    threeRefs.current.sprites.delete(vessel.mmsi || vessel.id);
    setSpritePos(sprite, vessel.lat, vessel.lng, 0.018, globeRadius);
  }
  sprite.material.rotation = -((vessel.heading ?? 0) * Math.PI / 180);
}}
```

**Step 6: Also clear sprites in cleanup**

In the return cleanup function of the Three.js useEffect:
```js
refs.sprites.clear(); // ← ADD to existing cleanup
```

**Step 7: Verify backend sim vessels have srcLat/srcLng/dstLat/dstLng/progress**

Check `/api/vessels` endpoint in server.js to confirm simulated vessels have these fields. If they do, the animation will work. If any field is missing, log a warning and skip that vessel.

**Step 8: Commit and push**
```bash
git add frontend/src/components/VesselsGlobe.jsx
git commit -m "feat: ocean freight — animate sim vessels along great-circle routes (60-300s cycles)"
git push
```

---

## Task 8: Market Map — Fix Company Sector Categorization

**Files:**
- Modify: `backend/server.js` (sector assignments for companies)
- Possibly: `frontend/src/pages/MarketMapPage.jsx` (sector labels)

**Step 1: Use WebSearch to identify correct sectors**

Research each company in the market map that may be miscategorized. Search for the top 20–30 companies visible in the market map and verify their actual industry/sector. Key ones to check:

Search queries to run:
- "Peloton industry sector freight forwarding"
- "Wayfair freight logistics sector"
- "Purple Innovation sector supply chain"
- "Solo Brands sector classification"
- "Hydrow fitness equipment imports sector"
- And others visible in the market map data

**Step 2: Read the backend prospect data to see which sector each company is assigned**

Look in `backend/server.js` for the `initDb` function and the prospect INSERT statements, or read the market-map route to see how sectors are assigned.

**Step 3: Update incorrect sector assignments**

For each misclassified company, update its `sector` field in the database seed / server.js to the correct industry. Common corrections might include:
- Fitness equipment companies → 'industrial' or create 'fitness' under 'cpg'
- Home goods companies → 'home-goods' (not 'cpg')
- Tech accessories → 'electronics' (not 'accessories')

**Step 4: Commit and push**
```bash
git add backend/server.js
git commit -m "fix: market map — correct sector classifications based on industry research"
git push
```

---

## Task 9: Market Map — Display Fixes (Node Layout, Bangladesh, Signal Timeline)

**Files:**
- Modify: `frontend/src/pages/MarketMapPage.jsx`
- Modify: `frontend/src/pages/MarketMapPage.css`

### Part A: Node Layout — Company Names & Circles Fit Within Box

**Step 1: Read the current node rendering code in MarketMapPage.jsx**

Find the SVG node rendering section and identify where company circles are drawn and where names are truncated or overflow.

**Step 2: Adjust node sizing and text truncation**

For company nodes:
- Ensure `r` (radius) is large enough to fit 2–3 char abbreviations
- Clip long company names to max 12 chars with ellipsis for the node label
- Scale font size by node radius (smaller nodes → smaller text)

### Part B: Bangladesh Country Name Display Fix

**Step 1: Find where country names are rendered in the company detail panel**

In MarketMapPage.jsx, look for where `import_origins` or country names are displayed. The Bangladesh text is likely being truncated because the container is too narrow.

**Step 2: Fix the truncation**

Either:
- Increase the container width for the country list
- Use `word-break: break-word` CSS on the country name element
- Or abbreviate Bangladesh to "BD" in the display while keeping the full name in tooltips

### Part C: Signal Timeline

**Step 1: Read the current signal timeline rendering in MarketMapPage.jsx**

Find the `SignalTimeline` or related component. It may be receiving empty data, or the API call for signals may not be connected.

**Step 2: Wire signal timeline to company selection**

When a company node is clicked:
1. Set `selectedCompany` state
2. Fetch signals for that company from `/api/signals` or use existing `data.news` from the market-map response
3. Render signals in chronological order in the signal timeline panel

**Step 3: Commit and push**
```bash
git add frontend/src/pages/MarketMapPage.jsx frontend/src/pages/MarketMapPage.css
git commit -m "fix: market map — node layout, Bangladesh name display, signal timeline wired"
git push
```

---

## Task 10: Live Call — Microphone AI Listening Button

**Files:**
- Modify: `frontend/src/components/LiveCallModal.jsx`
- Modify: `frontend/src/components/LiveCallModal.css`
- Modify: `backend/server.js` (add `/api/call-predict` endpoint)

**Architecture:** Use the browser's `SpeechRecognition` API (Web Speech API) for microphone input — no additional dependencies. Send transcript chunks to `/api/call-predict` (a new backend endpoint) every 15–30 seconds for AI prediction of what to say next. Display output below the objection handler.

### Part A: Backend endpoint

**Step 1: Add `/api/call-predict` to server.js**

```js
app.post('/api/call-predict', async (req, res) => {
  const { transcript, companyName, model = 'gpt-4.1-mini' } = req.body;
  if (!transcript?.trim()) return res.status(400).json({ error: 'transcript required' });
  if (!openai) return res.status(503).json({ error: 'AI not configured' });
  try {
    const completion = await openai.chat.completions.create({
      model,
      messages: [{
        role: 'system',
        content: `You are a real-time sales call coach for a Flexport SDR. Based on the live call transcript, predict what will happen in the next 15-30 seconds and suggest exactly what the SDR should say next. Be concise — 1-2 sentences max. Format: { "prediction": "...", "suggested_response": "...", "tone": "..." }`
      }, {
        role: 'user',
        content: `Company: ${companyName || 'Unknown'}\nLive transcript so far:\n${transcript.slice(-2000)}`
      }],
      response_format: { type: 'json_object' },
      max_tokens: 150,
    });
    res.json(JSON.parse(completion.choices[0].message.content));
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});
```

### Part B: Frontend microphone button

**Step 2: Add state and imports to LiveCallModal.jsx**

Add to imports:
```js
import { RiMicLine, RiMicOffLine } from 'react-icons/ri';
```

Add state:
```js
const [micActive, setMicActive] = useState(false);
const [micPrediction, setMicPrediction] = useState(null);
const [micTranscript, setMicTranscript] = useState('');
const recognitionRef = useRef(null);
const predictTimerRef = useRef(null);
```

**Step 3: Add microphone toggle function**

```js
const toggleMic = useCallback(() => {
  if (micActive) {
    // Stop listening
    recognitionRef.current?.stop();
    clearInterval(predictTimerRef.current);
    setMicActive(false);
    return;
  }
  // Start listening
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SpeechRecognition) {
    alert('Speech recognition not supported in this browser. Use Chrome.');
    return;
  }
  const recognition = new SpeechRecognition();
  recognition.continuous = true;
  recognition.interimResults = true;
  recognition.lang = 'en-US';
  recognitionRef.current = recognition;

  recognition.onresult = (event) => {
    const transcript = Array.from(event.results)
      .map(r => r[0].transcript)
      .join(' ');
    setMicTranscript(transcript);
  };

  recognition.onerror = () => { setMicActive(false); };
  recognition.start();
  setMicActive(true);

  // Send transcript to AI every 20 seconds
  predictTimerRef.current = setInterval(async () => {
    const currentTranscript = micTranscript;
    if (!currentTranscript.trim() || !prospect) return;
    try {
      const aiModel = localStorage.getItem('sdr_ai_model') || 'gpt-4.1-mini';
      const r = await fetch(`${API}/api/call-predict`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ transcript: currentTranscript, companyName: prospect?.name, model: aiModel }),
      });
      const data = await r.json();
      setMicPrediction(data);
    } catch (_) {}
  }, 20000);
}, [micActive, micTranscript, prospect]);

// Cleanup on modal close
useEffect(() => {
  if (!isOpen) {
    recognitionRef.current?.stop();
    clearInterval(predictTimerRef.current);
    setMicActive(false);
    setMicPrediction(null);
    setMicTranscript('');
  }
}, [isOpen]);
```

**Step 4: Add mic button next to "Generate Talk Track" button in the JSX**

In the center panel (`.lcm-talk-track`), next to the existing generate button:
```jsx
{!callPrep && (
  <div className="lcm-gen-row">
    <button className="lcm-gen-btn" onClick={generateCallPrep} disabled={callPrepLoading}>
      <RiFlashlightLine size={13} />
      {callPrepLoading ? 'Generating talk track...' : 'Generate Talk Track'}
    </button>
    <button
      className={`lcm-mic-btn ${micActive ? 'active' : ''}`}
      onClick={toggleMic}
      title={micActive ? 'Stop AI listening' : 'Start AI listening'}
    >
      {micActive ? <RiMicLine size={15} /> : <RiMicOffLine size={15} />}
    </button>
  </div>
)}
```

**Step 5: Add AI prediction output below objection handler section**

At the bottom of `.lcm-talk-track` panel, after the objection handler:
```jsx
{/* Live AI Predictions */}
{micActive && (
  <div className="lcm-mic-status">
    <RiMicLine size={11} className="lcm-mic-pulse" />
    Listening...
    {micTranscript && <span className="lcm-mic-transcript">{micTranscript.slice(-100)}</span>}
  </div>
)}
{micPrediction && (
  <div className="lcm-prediction-block">
    <div className="lcm-prediction-label">AI Prediction (next 15–30s)</div>
    {micPrediction.prediction && (
      <p className="lcm-prediction-text">{micPrediction.prediction}</p>
    )}
    {micPrediction.suggested_response && (
      <div className="lcm-prediction-response">
        <span className="lcm-prediction-say">Say: </span>
        "{micPrediction.suggested_response}"
      </div>
    )}
  </div>
)}
```

**Step 6: Add CSS for new elements**

In LiveCallModal.css:
```css
.lcm-gen-row {
  display: flex;
  gap: 8px;
  align-items: center;
}

.lcm-mic-btn {
  width: 34px;
  height: 34px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(255, 255, 255, 0.04);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 8px;
  color: #64748b;
  cursor: pointer;
  transition: all 0.15s;
  flex-shrink: 0;
}

.lcm-mic-btn.active {
  background: rgba(239, 68, 68, 0.12);
  border-color: rgba(239, 68, 68, 0.4);
  color: #ef4444;
  animation: mic-pulse 1.5s ease-in-out infinite;
}

@keyframes mic-pulse {
  0%, 100% { box-shadow: 0 0 0 0 rgba(239, 68, 68, 0.3); }
  50% { box-shadow: 0 0 0 6px rgba(239, 68, 68, 0); }
}

.lcm-mic-status {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 10px;
  color: #ef4444;
  font-family: 'JetBrains Mono', monospace;
  margin-top: 8px;
}

.lcm-mic-pulse {
  animation: mic-pulse-icon 1s ease-in-out infinite;
}

@keyframes mic-pulse-icon {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.4; }
}

.lcm-mic-transcript {
  color: #475569;
  font-size: 9px;
  max-width: 180px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.lcm-prediction-block {
  margin-top: 12px;
  padding: 10px 12px;
  background: rgba(0, 212, 255, 0.04);
  border: 1px solid rgba(0, 212, 255, 0.15);
  border-radius: 8px;
}

.lcm-prediction-label {
  font-family: 'JetBrains Mono', monospace;
  font-size: 9px;
  font-weight: 600;
  color: #00d4ff;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  margin-bottom: 6px;
}

.lcm-prediction-text {
  font-size: 11px;
  color: #94a3b8;
  line-height: 1.5;
  margin: 0 0 6px;
}

.lcm-prediction-response {
  font-size: 12px;
  color: #e2e8f0;
  line-height: 1.5;
}

.lcm-prediction-say {
  color: #00d4ff;
  font-weight: 600;
  font-family: 'JetBrains Mono', monospace;
  font-size: 10px;
}
```

**Step 7: Commit and push**
```bash
git add backend/server.js frontend/src/components/LiveCallModal.jsx frontend/src/components/LiveCallModal.css
git commit -m "feat: live call — microphone AI listening with real-time call predictions"
git push
```

---

## Task 11: Settings Page — Add New Settings for New Features

**Files:**
- Modify: `frontend/src/pages/SettingsPage.jsx`

**New settings to add:**
- Microphone AI sensitivity (prediction frequency: 15s / 20s / 30s)
- Microphone auto-start toggle (start listening when call begins)

**Step 1: Add to NotificationsSection or create a new "Live Call" section**

In the SECTIONS array, add:
```js
{ id: 'livecall', label: 'Live Call', Icon: RiPhoneLine, subtitle: 'Microphone and real-time AI settings' },
```

**Step 2: Add LiveCallSection component**

```jsx
function LiveCallSection() {
  const [micAutoStart, setMicAutoStart] = useSetting('sdr_mic_autostart', false);
  const [micFrequency, setMicFrequency] = useSetting('sdr_mic_frequency', '20');
  const [saved, setSaved] = useState(false);
  const flash = () => { setSaved(true); setTimeout(() => setSaved(false), 1500); };

  return (
    <>
      <SettingCard title="Microphone AI">
        <SettingRow label="Auto-start listening" description="Begin AI listening when a live call session starts" icon={RiMicLine}>
          <SettingToggle value={micAutoStart} onChange={v => { setMicAutoStart(v); flash(); }} />
        </SettingRow>
        <SettingRow label="Prediction frequency" description="How often AI analyzes the transcript and predicts next moves" icon={RiTimeLine}>
          <select className="setting-input setting-select" value={micFrequency} onChange={e => { setMicFrequency(e.target.value); flash(); }}>
            <option value="15">Every 15 seconds</option>
            <option value="20">Every 20 seconds (default)</option>
            <option value="30">Every 30 seconds</option>
          </select>
        </SettingRow>
      </SettingCard>
      <SavedFlash show={saved} />
    </>
  );
}
```

Also import `RiMicLine` at the top of SettingsPage.jsx.

**Step 3: Wire the frequency setting to LiveCallModal**

In LiveCallModal.jsx, read the setting:
```js
const micFrequencySecs = parseInt(localStorage.getItem('sdr_mic_frequency') || '20', 10) * 1000;
// Use micFrequencySecs instead of hardcoded 20000 in setInterval
```

**Step 4: Commit and push**
```bash
git add frontend/src/pages/SettingsPage.jsx frontend/src/components/LiveCallModal.jsx
git commit -m "feat: settings — live call mic frequency and auto-start options"
git push
```

---

## Task 12: Final Audit + README Update

**Step 1: Run the app and verify all pages load correctly**

```bash
cd frontend && npm run dev
```

Check each route:
- `/` — Homepage globe
- `/vessels` — Ocean Freight (animated vessels)
- `/flights` — Air Freight (darker globe, animated planes, ADS-B fix)
- `/land` — Land Freight (truck wheel orientation)
- `/trade` — Trade Intelligence
- `/account/1` — Account 360 (CI panel open, live call wiring)
- `/performance` — Performance page
- `/market` — Market Map (companies in correct sectors, layout)
- `/settings` — Scrollable, includes Live Call section

**Step 2: Verify data flows**

- HomePage prospects → MarketMapPage: check that companies appearing on home appear in market map
- LiveCallModal end → Account360Page CI panel: test the flow
- PerformancePage retention setting: check `?retention_days=N` is passed

**Step 3: Fix any issues found in audit**

Document and fix each issue found.

**Step 4: Update README.md**

Update with:
- New features: microphone AI, animated vessels/planes, ADS-B browser proxy
- Updated sidebar order
- New settings: Live Call section
- Deployment notes: OPENSKY env vars required on Railway

**Step 5: Delete stale docs from GitHub if any**

```bash
git ls-files docs/ | grep -v plans/
# Review and remove any outdated deployment docs
```

**Step 6: Final commit and push**
```bash
git add -A
git commit -m "chore: update README and remove stale docs after multi-feature sprint"
git push
```

---

## Summary of Files Modified

| File | Tasks |
|------|-------|
| `frontend/src/pages/SettingsPage.css` | Task 1 |
| `frontend/src/pages/SettingsPage.jsx` | Task 11 |
| `backend/server.js` | Tasks 2, 8, 10 |
| `frontend/src/pages/FlightsPage.jsx` | Task 2 |
| `frontend/src/pages/Account360Page.jsx` | Task 3 |
| `frontend/src/pages/Account360Page.css` | Task 3 |
| `frontend/src/App.jsx` | Task 3 (verify) |
| `frontend/src/components/Sidebar.jsx` | Task 4 |
| `frontend/src/components/LandGlobe.jsx` | Task 5 |
| `frontend/src/components/FlightsGlobe.jsx` | Task 6 |
| `frontend/src/components/VesselsGlobe.jsx` | Task 7 |
| `frontend/src/pages/MarketMapPage.jsx` | Tasks 8, 9 |
| `frontend/src/pages/MarketMapPage.css` | Task 9 |
| `frontend/src/components/LiveCallModal.jsx` | Task 10, 11 |
| `frontend/src/components/LiveCallModal.css` | Task 10 |
| `README.md` | Task 12 |
