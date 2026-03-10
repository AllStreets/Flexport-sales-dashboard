# Feature Expansion Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add 6 new features — animated sparklines, globe moon/glow/arc-breathing, AI email composer, AI research scanner, team leaderboard, and live vessel tracker with container intelligence.

**Architecture:** New pages at `/vessels`, `/research`, `/team` added to React Router + Sidebar. New backend routes on Express. aisstream.io WebSocket proxied through Express as SSE. Terminal49 container tracking via REST. No new DB tables except `team_members`.

**Tech Stack:** React 19, Three.js (already installed), react-leaflet + leaflet (new), recharts (existing), Express 5, ws (new backend package), axios, OpenAI, aisstream.io WebSocket, Terminal49 REST API.

---

## Task 1: Install new dependencies + env vars

**Files:**
- Modify: `frontend/package.json` (via npm install)
- Modify: `backend/package.json` (via npm install)
- Modify: `backend/.env.example`
- Modify: `backend/.env`

**Step 1: Install frontend deps**
```bash
cd frontend && npm install react-leaflet leaflet
```

**Step 2: Install backend deps**
```bash
cd backend && npm install ws
```

**Step 3: Add to `backend/.env.example`**
Add these two lines after `MARINETRAFFIC_API_KEY=`:
```
AISSTREAM_API_KEY=
TERMINAL49_API_KEY=
```

**Step 4: Add same keys to `backend/.env` with your actual values**

**Step 5: Commit**
```bash
git add frontend/package.json frontend/package-lock.json backend/package.json backend/package-lock.json backend/.env.example
git commit -m "chore: add react-leaflet, leaflet, ws deps + aisstream/terminal49 env vars"
```

---

## Task 2: Backend — `/api/rate-history` (sparkline data)

**Files:**
- Modify: `backend/server.js` — add route before `app.listen`

**Step 1: Add route to `server.js`**

Find the line `app.get('/api/hs-lookup'` and add this route before it:

```js
// Freight rate 12-week history (seeded random walk for sparklines)
app.get('/api/rate-history', (req, res) => {
  const ROUTES = [
    { id: 'china-usw',  base: 2480 },
    { id: 'china-use',  base: 3350 },
    { id: 'me-europe',  base: 2650 },
    { id: 'vietnam-usw',base: 2190 },
    { id: 'india-use',  base: 1820 },
    { id: 'europe-use', base: 1240 },
    { id: 'latam-use',  base: 1680 },
    { id: 'se-asia-usw',base: 2050 },
  ];
  function randomWalk(base, weeks = 12, seed = 42) {
    let v = base * 0.78;
    const out = [];
    let rng = seed;
    for (let i = 0; i < weeks; i++) {
      rng = (rng * 1664525 + 1013904223) & 0xffffffff;
      const delta = ((rng >>> 0) / 0xffffffff - 0.5) * base * 0.06;
      v = Math.max(base * 0.6, Math.min(base * 1.05, v + delta));
      out.push(Math.round(v));
    }
    out[weeks - 1] = base; // last point is always current rate
    return out;
  }
  const history = {};
  ROUTES.forEach(r => { history[r.id] = randomWalk(r.base, 12, r.base); });
  res.json(history);
});
```

**Step 2: Verify**
```bash
curl http://localhost:5001/api/rate-history
```
Expected: JSON object with 8 route keys, each an array of 12 numbers ending at the base rate.

**Step 3: Commit**
```bash
git add backend/server.js
git commit -m "feat: add /api/rate-history endpoint for sparkline data"
```

---

## Task 3: Frontend — Freight rate sparklines in TradePage

**Files:**
- Modify: `frontend/src/pages/TradePage.jsx`
- Modify: `frontend/src/pages/TradePage.css`

**Step 1: Add rateHistory state and fetch in TradePage.jsx**

At the top of the `TradePage` component, find the existing state declarations and add:
```jsx
const [rateHistory, setRateHistory] = useState({});
```

In the existing `useEffect` that fetches trade data, add `fetch(`${API}/api/rate-history`)` to the Promise.all:
```jsx
fetch(`${API}/api/rate-history`).then(r => r.json()).catch(() => ({})),
```
And destructure it from the results array, then `setRateHistory(rh || {})`.

**Step 2: Import Recharts components at top of TradePage.jsx**

Add to existing recharts import:
```jsx
import { AreaChart, Area, ResponsiveContainer } from 'recharts';
```

**Step 3: Add sparkline helper component inside TradePage.jsx (before the return)**
```jsx
function RateSparkline({ data = [], color = '#00d4ff' }) {
  if (!data.length) return null;
  const chartData = data.map((v, i) => ({ v }));
  const first = data[0], last = data[data.length - 1];
  const pct = (((last - first) / first) * 100).toFixed(1);
  const up = last >= first;
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <div style={{ width: 80, height: 28 }}>
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={chartData} margin={{ top: 2, right: 0, bottom: 2, left: 0 }}>
            <defs>
              <linearGradient id="sg" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor={color} stopOpacity={0.3} />
                <stop offset="95%" stopColor={color} stopOpacity={0} />
              </linearGradient>
            </defs>
            <Area type="monotone" dataKey="v" stroke={color} strokeWidth={1.5} fill="url(#sg)" dot={false} isAnimationActive={false} />
          </AreaChart>
        </ResponsiveContainer>
      </div>
      <span style={{ fontSize: 9, fontFamily: 'JetBrains Mono', color: up ? '#ef4444' : '#10b981', minWidth: 42 }}>
        {up ? '▲' : '▼'} {Math.abs(pct)}%
      </span>
    </div>
  );
}
```

**Step 4: Find the container rates table rows in TradePage.jsx**

Search for the section rendering rate rows (look for `china-us` or similar route labels). Each row currently shows a static rate number. Find the route ID mapping — the routes are rendered in a table. Add a `routeId` mapping object near the rates data:

```jsx
const ROUTE_IDS = {
  'China → US West Coast': 'china-usw',
  'China → US East Coast': 'china-use',
  'Middle East → Europe': 'me-europe',
  'Vietnam → US West Coast': 'vietnam-usw',
  'India → US East Coast': 'india-use',
  'Europe → US East Coast': 'europe-use',
  'Latin America → US East Coast': 'latam-use',
  'SE Asia → US West Coast': 'se-asia-usw',
};
```

Then in each rate row JSX, after the rate number, add:
```jsx
<RateSparkline data={rateHistory[ROUTE_IDS[route.label]] || []} />
```

**Step 5: Verify in browser**
- Navigate to `/trade`
- Container rates table should show mini sparklines next to each rate
- Up/down arrow + % change badge should be visible

**Step 6: Commit**
```bash
git add frontend/src/pages/TradePage.jsx frontend/src/pages/TradePage.css
git commit -m "feat: animated freight rate sparklines with 12-week trend in Trade page"
```

---

## Task 4: Globe — moon, atmospheric glow, arc breathing

**Files:**
- Modify: `frontend/src/components/GlobeView.jsx`

**Step 1: Add Three.js import at top of GlobeView.jsx**
```jsx
import * as THREE from 'three';
```

**Step 2: Add arc tick state for breathing animation**

In the component body, add:
```jsx
const [arcTick, setArcTick] = useState(0);

useEffect(() => {
  const id = setInterval(() => setArcTick(t => t + 1), 80);
  return () => clearInterval(id);
}, []);
```

**Step 3: Update `laneColor` to use breathing opacity**

Replace the existing `laneColor` function with:
```jsx
const laneColor = (lane, idx = 0) => {
  const phase = (arcTick * 0.06 + idx * 0.7);
  const alpha = 0.45 + Math.sin(phase) * 0.25; // breathes between 0.2–0.7

  if (mode === 'tariff') {
    return HIGH_TARIFF_PREFIXES.some(p => lane.label?.startsWith(p))
      ? [`rgba(239,68,68,${alpha})`, `rgba(239,68,68,${alpha})`]
      : [`rgba(16,185,129,${alpha})`, `rgba(16,185,129,${alpha})`];
  }
  const status = srcPortStatus(lane);
  if (status === 'disruption') return [`rgba(239,68,68,${alpha})`, `rgba(239,68,68,${alpha})`];
  if (status === 'congestion') return [`rgba(245,158,11,${alpha})`, `rgba(245,158,11,${alpha})`];
  return [`rgba(0,212,255,${alpha})`, `rgba(0,212,255,${alpha})`];
};
```

Update `baseLanes` to pass index:
```jsx
const baseLanes = globeData.shippingLanes.map((lane, idx) => ({
  startLat: lane.src_lat, startLng: lane.src_lng,
  endLat: lane.dst_lat, endLng: lane.dst_lng,
  color: laneColor(lane, idx), label: lane.label, weight: lane.weight, type: 'lane'
}));
```

**Step 4: Add moon + glow via useEffect after globe mounts**

Add this useEffect after the existing globe effects:
```jsx
useEffect(() => {
  const g = globeRef.current;
  if (!g) return;

  const scene = g.scene();

  // — Atmospheric glow sphere —
  const glowGeom = new THREE.SphereGeometry(105, 32, 32);
  const glowMat = new THREE.ShaderMaterial({
    uniforms: { c: { value: 0.18 }, p: { value: 3.0 } },
    vertexShader: `
      varying vec3 vNormal;
      void main() {
        vNormal = normalize(normalMatrix * normal);
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }`,
    fragmentShader: `
      uniform float c;
      uniform float p;
      varying vec3 vNormal;
      void main() {
        float intensity = pow(c - dot(vNormal, vec3(0.0, 0.0, 1.0)), p);
        gl_FragColor = vec4(0.0, 0.83, 1.0, max(0.0, intensity));
      }`,
    side: THREE.FrontSide,
    blending: THREE.AdditiveBlending,
    transparent: true,
    depthWrite: false,
  });
  const glowMesh = new THREE.Mesh(glowGeom, glowMat);
  scene.add(glowMesh);

  // — Moon —
  const moonGeom = new THREE.SphereGeometry(2.8, 16, 16);
  const moonMat = new THREE.MeshStandardMaterial({ color: 0x8899aa, roughness: 0.85, metalness: 0.05 });
  const moonMesh = new THREE.Mesh(moonGeom, moonMat);
  scene.add(moonMesh);

  let frame;
  const animate = () => {
    const t = Date.now() * 0.00008;
    moonMesh.position.set(
      Math.cos(t) * 165,
      Math.sin(t * 0.28) * 28,
      Math.sin(t) * 165
    );
    frame = requestAnimationFrame(animate);
  };
  animate();

  return () => {
    cancelAnimationFrame(frame);
    scene.remove(glowMesh);
    scene.remove(moonMesh);
    glowGeom.dispose(); glowMat.dispose();
    moonGeom.dispose(); moonMat.dispose();
  };
}, []);
```

**Step 5: Tune atmosphere props on the Globe component**

Update the existing `atmosphereColor` and `atmosphereAltitude` props:
```jsx
atmosphereColor="rgba(0, 180, 255, 0.25)"
atmosphereAltitude={0.18}
```

**Step 6: Verify in browser**
- Home page globe should show breathing arcs (opacity pulses independently per arc)
- A small grey moon should slowly orbit the globe
- Soft blue limb glow should be visible at the globe's edge

**Step 7: Commit**
```bash
git add frontend/src/components/GlobeView.jsx
git commit -m "feat: globe moon orbit, atmospheric glow shader, breathing arc animation"
```

---

## Task 5: Backend — `/api/compose-email`

**Files:**
- Modify: `backend/server.js`

**Step 1: Add route to server.js** (add near other POST AI routes like `/api/analyze`):

```js
app.post('/api/compose-email', async (req, res) => {
  const { prospect, trigger, tone = 'consultative' } = req.body;
  if (!prospect) return res.status(400).json({ error: 'prospect required' });

  const toneGuide = {
    direct: 'Be direct, confident, and brief. No fluff. Lead with value.',
    consultative: 'Be warm, curious, and helpful. Ask a discovery question.',
    challenger: 'Challenge the status quo. Use a provocative insight to reframe their thinking.',
  }[tone] || 'Be professional and concise.';

  const prompt = `You are an elite SDR at Flexport, the AI-powered logistics platform.
Write a cold outreach package for this prospect. Tone: ${toneGuide}

PROSPECT:
Name: ${prospect.name}
Industry: ${prospect.industry || prospect.sector}
Primary Lanes: ${(prospect.primary_lanes || []).join(', ')}
Likely Forwarder: ${prospect.likely_forwarder || 'unknown'}
ICP Score: ${prospect.icp_score}
${trigger ? `TRIGGER/SIGNAL: ${trigger}` : ''}

OUTPUT FORMAT (use these exact headers):
## SUBJECT_1
[subject line option 1]
## SUBJECT_2
[subject line option 2]
## SUBJECT_3
[subject line option 3]
## EMAIL
[150-200 word email body — personalized, no generic opener, references their specific lanes/pain]
## LINKEDIN
[60-80 word LinkedIn message — casual, curious, references trigger if available]`;

  try {
    const openai = require('openai');
    const client = new openai.OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.flushHeaders();

    const stream = await client.chat.completions.create({
      model: 'gpt-4.1-mini',
      messages: [{ role: 'user', content: prompt }],
      stream: true,
    });
    for await (const chunk of stream) {
      const text = chunk.choices[0]?.delta?.content || '';
      if (text) res.write(`data: ${JSON.stringify({ text })}\n\n`);
    }
    res.write('data: [DONE]\n\n');
    res.end();
  } catch (err) {
    console.error('compose-email error:', err);
    res.status(500).json({ error: 'Email generation failed' });
  }
});
```

**Step 2: Verify**
```bash
curl -X POST http://localhost:5001/api/compose-email \
  -H "Content-Type: application/json" \
  -d '{"prospect":{"name":"Gymshark","industry":"Apparel","primary_lanes":["Trans-Pacific"],"icp_score":88},"tone":"direct"}'
```
Expected: SSE stream with subject lines, email, and LinkedIn message.

**Step 3: Commit**
```bash
git add backend/server.js
git commit -m "feat: add /api/compose-email SSE route for AI email composer"
```

---

## Task 6: Frontend — EmailComposerModal component

**Files:**
- Create: `frontend/src/components/EmailComposerModal.jsx`
- Create: `frontend/src/components/EmailComposerModal.css`

**Step 1: Create `EmailComposerModal.jsx`**

```jsx
import { useState, useEffect, useRef } from 'react';
import { RiMailSendLine, RiLinkedinLine, RiRefreshLine, RiFileCopyLine, RiCloseLine } from 'react-icons/ri';
import './EmailComposerModal.css';

const API = import.meta.env.VITE_API_URL || 'http://localhost:5001';
const TONES = ['direct', 'consultative', 'challenger'];

export default function EmailComposerModal({ isOpen, onClose, initialProspect = null, initialTrigger = '' }) {
  const [prospects, setProspects] = useState([]);
  const [selectedId, setSelectedId] = useState('');
  const [trigger, setTrigger] = useState(initialTrigger);
  const [tone, setTone] = useState('consultative');
  const [output, setOutput] = useState('');
  const [loading, setLoading] = useState(false);
  const [tab, setTab] = useState('email');
  const [copied, setCopied] = useState('');
  const outputRef = useRef('');

  useEffect(() => {
    if (isOpen) fetch(`${API}/api/prospects?limit=136`).then(r => r.json()).then(d => setProspects(d.prospects || []));
  }, [isOpen]);

  useEffect(() => {
    if (initialProspect) setSelectedId(String(initialProspect.id || ''));
    if (initialTrigger) setTrigger(initialTrigger);
  }, [initialProspect, initialTrigger]);

  if (!isOpen) return null;

  const prospect = prospects.find(p => String(p.id) === selectedId) || initialProspect;

  const generate = async () => {
    if (!prospect) return;
    setOutput('');
    outputRef.current = '';
    setLoading(true);
    try {
      const res = await fetch(`${API}/api/compose-email`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prospect, trigger, tone }),
      });
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const lines = decoder.decode(value).split('\n');
        for (const line of lines) {
          if (line.startsWith('data: ') && !line.includes('[DONE]')) {
            try {
              const { text } = JSON.parse(line.slice(6));
              outputRef.current += text;
              setOutput(outputRef.current);
            } catch {}
          }
        }
      }
    } finally {
      setLoading(false);
    }
  };

  const extract = (key) => {
    const sections = { email: '## EMAIL', linkedin: '## LINKEDIN' };
    const start = output.indexOf(sections[key]);
    if (start === -1) return '';
    const after = output.slice(start + sections[key].length).trim();
    const next = after.search(/^##\s/m);
    return next === -1 ? after.trim() : after.slice(0, next).trim();
  };

  const subjects = [1, 2, 3].map(n => {
    const start = output.indexOf(`## SUBJECT_${n}`);
    if (start === -1) return '';
    const after = output.slice(start + `## SUBJECT_${n}`.length).trim();
    const next = after.search(/^##\s/m);
    return (next === -1 ? after : after.slice(0, next)).trim();
  }).filter(Boolean);

  const copyText = (text, key) => {
    navigator.clipboard.writeText(text);
    setCopied(key);
    setTimeout(() => setCopied(''), 1500);
  };

  return (
    <div className="ec-overlay" onClick={onClose}>
      <div className="ec-modal" onClick={e => e.stopPropagation()}>
        <div className="ec-header">
          <RiMailSendLine size={16} />
          <span>AI EMAIL COMPOSER</span>
          <button className="ec-close" onClick={onClose}><RiCloseLine size={18} /></button>
        </div>

        <div className="ec-body">
          <div className="ec-left">
            <label className="ec-label">PROSPECT</label>
            <select className="ec-select" value={selectedId} onChange={e => setSelectedId(e.target.value)}>
              <option value="">Select prospect...</option>
              {prospects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
            {prospect && (
              <div className="ec-prospect-card">
                <div className="ec-pname">{prospect.name}</div>
                <div className="ec-pmeta">{prospect.industry || prospect.sector} · ICP {prospect.icp_score}</div>
                <div className="ec-pmeta">{(prospect.primary_lanes || []).join(', ')}</div>
              </div>
            )}

            <label className="ec-label" style={{ marginTop: 16 }}>TRIGGER / SIGNAL</label>
            <textarea
              className="ec-textarea"
              placeholder="e.g. Gymshark just expanded Vietnam sourcing, shipping costs spiking..."
              value={trigger}
              onChange={e => setTrigger(e.target.value)}
              rows={3}
            />

            <label className="ec-label" style={{ marginTop: 16 }}>TONE</label>
            <div className="ec-tone-row">
              {TONES.map(t => (
                <button key={t} className={`ec-tone-btn${tone === t ? ' active' : ''}`} onClick={() => setTone(t)}>
                  {t}
                </button>
              ))}
            </div>

            <button className="ec-generate-btn" onClick={generate} disabled={!prospect || loading}>
              {loading ? <RiRefreshLine className="ec-spin" size={14} /> : <RiMailSendLine size={14} />}
              {loading ? 'Generating...' : 'Generate'}
            </button>
          </div>

          <div className="ec-right">
            {subjects.length > 0 && (
              <div className="ec-subjects">
                <div className="ec-section-label">SUBJECT LINES</div>
                {subjects.map((s, i) => (
                  <div key={i} className="ec-subject-row">
                    <span className="ec-subject-text">{s}</span>
                    <button className="ec-copy-btn" onClick={() => copyText(s, `s${i}`)}>
                      {copied === `s${i}` ? '✓' : <RiFileCopyLine size={12} />}
                    </button>
                  </div>
                ))}
              </div>
            )}

            <div className="ec-tabs">
              <button className={`ec-tab${tab === 'email' ? ' active' : ''}`} onClick={() => setTab('email')}>
                <RiMailSendLine size={12} /> Email
              </button>
              <button className={`ec-tab${tab === 'linkedin' ? ' active' : ''}`} onClick={() => setTab('linkedin')}>
                <RiLinkedinLine size={12} /> LinkedIn
              </button>
            </div>

            <div className="ec-output-wrap">
              {tab === 'email' && (
                <>
                  <pre className="ec-output">{extract('email') || (loading ? 'Generating...' : 'Generate to see email')}</pre>
                  {extract('email') && (
                    <button className="ec-copy-full" onClick={() => copyText(extract('email'), 'email')}>
                      {copied === 'email' ? '✓ Copied' : <><RiFileCopyLine size={12} /> Copy Email</>}
                    </button>
                  )}
                </>
              )}
              {tab === 'linkedin' && (
                <>
                  <pre className="ec-output">{extract('linkedin') || (loading ? 'Generating...' : 'Generate to see LinkedIn message')}</pre>
                  {extract('linkedin') && (
                    <button className="ec-copy-full" onClick={() => copyText(extract('linkedin'), 'linkedin')}>
                      {copied === 'linkedin' ? '✓ Copied' : <><RiFileCopyLine size={12} /> Copy Message</>}
                    </button>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
```

**Step 2: Create `EmailComposerModal.css`**

```css
.ec-overlay {
  position: fixed; inset: 0; background: rgba(0,0,0,0.7);
  display: flex; align-items: center; justify-content: center;
  z-index: 1200; backdrop-filter: blur(4px);
}
.ec-modal {
  background: #0d1526; border: 1px solid rgba(0,212,255,0.15);
  border-radius: 12px; width: 860px; max-width: 96vw;
  max-height: 88vh; display: flex; flex-direction: column;
  box-shadow: 0 24px 60px rgba(0,0,0,0.7);
}
.ec-header {
  display: flex; align-items: center; gap: 10px;
  padding: 14px 20px; border-bottom: 1px solid rgba(255,255,255,0.06);
  font-family: 'JetBrains Mono', monospace; font-size: 11px;
  color: #00d4ff; letter-spacing: 0.08em;
}
.ec-close { margin-left: auto; background: none; border: none; color: #475569; cursor: pointer; }
.ec-close:hover { color: #fff; }
.ec-body { display: flex; flex: 1; overflow: hidden; }
.ec-left {
  width: 260px; flex-shrink: 0; padding: 16px;
  border-right: 1px solid rgba(255,255,255,0.06);
  overflow-y: auto; display: flex; flex-direction: column;
}
.ec-right { flex: 1; padding: 16px; display: flex; flex-direction: column; overflow: hidden; }
.ec-label {
  font-family: 'JetBrains Mono', monospace; font-size: 9px;
  color: #475569; letter-spacing: 0.1em; margin-bottom: 6px; display: block;
}
.ec-select, .ec-textarea {
  background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.08);
  border-radius: 6px; color: #e2e8f0; font-size: 12px; padding: 8px 10px;
  width: 100%; font-family: inherit; resize: none;
}
.ec-select:focus, .ec-textarea:focus { outline: none; border-color: rgba(0,212,255,0.3); }
.ec-prospect-card {
  margin-top: 8px; padding: 8px 10px;
  background: rgba(0,212,255,0.06); border-radius: 6px;
}
.ec-pname { font-size: 13px; color: #e2e8f0; font-weight: 600; }
.ec-pmeta { font-size: 10px; color: #64748b; margin-top: 2px; }
.ec-tone-row { display: flex; gap: 6px; }
.ec-tone-btn {
  flex: 1; padding: 6px 4px; background: rgba(255,255,255,0.04);
  border: 1px solid rgba(255,255,255,0.08); border-radius: 6px;
  color: #64748b; font-size: 10px; cursor: pointer; font-family: 'JetBrains Mono', monospace;
  text-transform: capitalize;
}
.ec-tone-btn.active { border-color: #00d4ff; color: #00d4ff; background: rgba(0,212,255,0.08); }
.ec-generate-btn {
  margin-top: 16px; padding: 10px; background: rgba(0,212,255,0.12);
  border: 1px solid rgba(0,212,255,0.3); border-radius: 8px;
  color: #00d4ff; font-size: 12px; cursor: pointer;
  display: flex; align-items: center; justify-content: center; gap: 6px;
  font-family: 'JetBrains Mono', monospace;
}
.ec-generate-btn:hover:not(:disabled) { background: rgba(0,212,255,0.2); }
.ec-generate-btn:disabled { opacity: 0.5; cursor: not-allowed; }
.ec-spin { animation: spin 1s linear infinite; }
@keyframes spin { to { transform: rotate(360deg); } }
.ec-subjects { margin-bottom: 12px; }
.ec-section-label {
  font-family: 'JetBrains Mono', monospace; font-size: 9px;
  color: #475569; letter-spacing: 0.1em; margin-bottom: 6px;
}
.ec-subject-row {
  display: flex; align-items: center; gap: 8px;
  padding: 6px 10px; background: rgba(255,255,255,0.03);
  border-radius: 6px; margin-bottom: 4px;
}
.ec-subject-text { flex: 1; font-size: 12px; color: #e2e8f0; }
.ec-copy-btn { background: none; border: none; color: #475569; cursor: pointer; padding: 2px; }
.ec-copy-btn:hover { color: #00d4ff; }
.ec-tabs { display: flex; gap: 4px; margin-bottom: 10px; }
.ec-tab {
  display: flex; align-items: center; gap: 6px; padding: 6px 14px;
  background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.08);
  border-radius: 6px; color: #64748b; font-size: 11px; cursor: pointer;
}
.ec-tab.active { border-color: #00d4ff; color: #00d4ff; background: rgba(0,212,255,0.08); }
.ec-output-wrap { flex: 1; overflow-y: auto; position: relative; }
.ec-output {
  font-family: 'JetBrains Mono', monospace; font-size: 12px; line-height: 1.7;
  color: #cbd5e1; white-space: pre-wrap; margin: 0; padding: 12px;
  background: rgba(255,255,255,0.02); border-radius: 8px; min-height: 120px;
}
.ec-copy-full {
  margin-top: 8px; padding: 7px 14px;
  background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.1);
  border-radius: 6px; color: #94a3b8; font-size: 11px; cursor: pointer;
  display: flex; align-items: center; gap: 6px;
}
.ec-copy-full:hover { color: #00d4ff; border-color: rgba(0,212,255,0.3); }
```

**Step 3: Commit**
```bash
git add frontend/src/components/EmailComposerModal.jsx frontend/src/components/EmailComposerModal.css
git commit -m "feat: EmailComposerModal — subject lines, email, LinkedIn with tone selector"
```

---

## Task 7: Wire EmailComposerModal into App.jsx + Account360 + SignalFeed

**Files:**
- Modify: `frontend/src/App.jsx`
- Modify: `frontend/src/pages/Account360Page.jsx`
- Modify: `frontend/src/components/SignalFeed.jsx`

**Step 1: In `App.jsx` add import + state**
```jsx
import EmailComposerModal from './components/EmailComposerModal';
```
Add state:
```jsx
const [emailState, setEmailState] = useState({ open: false, prospect: null, trigger: '' });
```

**Step 2: Add keyboard shortcut in the existing `onKey` handler** (before the Escape block):
```jsx
if (e.ctrlKey && e.shiftKey && e.key === 'E') {
  e.preventDefault();
  setEmailState(s => s.open ? { open: false, prospect: null, trigger: '' } : { open: true, prospect: null, trigger: '' });
  return;
}
```

Add to Escape handler:
```jsx
if (emailState.open) { setEmailState({ open: false, prospect: null, trigger: '' }); return; }
```

Add to the `useEffect` dependency array: `emailState.open`

**Step 3: Add handler and pass down**
```jsx
const handleOpenEmailComposer = (prospect = null, trigger = '') =>
  setEmailState({ open: true, prospect, trigger });
```
Pass `onOpenEmailComposer={handleOpenEmailComposer}` to `HomePage` and `Account360Page`.

**Step 4: Render modal at bottom of App return**
```jsx
<EmailComposerModal
  isOpen={emailState.open}
  initialProspect={emailState.prospect}
  initialTrigger={emailState.trigger}
  onClose={() => setEmailState({ open: false, prospect: null, trigger: '' })}
/>
```

**Step 5: In `Account360Page.jsx`** find the action buttons row and add:
```jsx
<button className="action-btn" onClick={() => onOpenEmailComposer?.(prospect)}>
  <RiMailSendLine size={14} /> Compose Email
</button>
```
Add `onOpenEmailComposer` to the component props destructuring.

**Step 6: In `SignalFeed.jsx`** find where signal tiles are rendered and add a small "Email" button to each tile:
```jsx
<button className="signal-email-btn" onClick={() => onOpenEmailComposer?.(null, signal.title)}>
  <RiMailSendLine size={11} />
</button>
```
Add `onOpenEmailComposer` to SignalFeed props. Pass it from `HomePage.jsx`.

**Step 7: Commit**
```bash
git add frontend/src/App.jsx frontend/src/pages/Account360Page.jsx frontend/src/components/SignalFeed.jsx
git commit -m "feat: wire EmailComposerModal — Ctrl+Shift+E, Account360 button, SignalFeed trigger"
```

---

## Task 8: Backend — `/api/research` streaming route

**Files:**
- Modify: `backend/server.js`

**Step 1: Add route to server.js**

```js
app.post('/api/research', async (req, res) => {
  const { company } = req.body;
  if (!company) return res.status(400).json({ error: 'company required' });

  let newsContext = '', serperContext = '';

  // Fire NewsAPI + Serper in parallel
  try {
    const axios = require('axios');
    const [newsRes, serperRes] = await Promise.allSettled([
      process.env.NEWS_API_KEY
        ? axios.get('https://newsapi.org/v2/everything', {
            params: { q: company, sortBy: 'publishedAt', pageSize: 5, apiKey: process.env.NEWS_API_KEY }
          })
        : Promise.resolve(null),
      process.env.SERPER_API_KEY
        ? axios.post('https://google.serper.dev/search', { q: `${company} logistics shipping supply chain 2026` }, {
            headers: { 'X-API-KEY': process.env.SERPER_API_KEY, 'Content-Type': 'application/json' }
          })
        : Promise.resolve(null),
    ]);

    if (newsRes.status === 'fulfilled' && newsRes.value?.data?.articles) {
      newsContext = newsRes.value.data.articles
        .map(a => `- ${a.title} (${a.publishedAt?.slice(0,10)})`)
        .join('\n');
    }
    if (serperRes.status === 'fulfilled' && serperRes.value?.data?.organic) {
      serperContext = serperRes.value.data.organic
        .slice(0, 4)
        .map(r => `- ${r.title}: ${r.snippet}`)
        .join('\n');
    }
  } catch (e) { console.error('research enrichment error:', e.message); }

  const prompt = `You are a world-class sales intelligence analyst. Generate a concise prospect intelligence brief for an SDR at Flexport (AI-powered freight forwarding) targeting this company.

COMPANY: ${company}

RECENT NEWS:
${newsContext || 'No live news available — use your knowledge.'}

WEB SIGNALS:
${serperContext || 'No web signals — use your knowledge.'}

Write the brief using EXACTLY these section headers:

## SNAPSHOT
2-3 sentences: revenue estimate, employee count, HQ, founding year, what they make/sell.

## TRADE PROFILE
Their primary import/export lanes, likely freight forwarder, estimated annual freight spend range, dominant shipping mode (ocean/air/both).

## RECENT SIGNALS
3-5 bullet points: notable news from last 90 days — funding, exec hires, factory moves, earnings, supply chain changes. If none, note the silence.

## WHY CONTACT NOW
2-3 specific, signal-grounded reasons this company needs Flexport RIGHT NOW. Reference tariffs, Hormuz disruption, Vietnam factory surge, or relevant market forces.

## OPENING HOOK
One killer first sentence for a cold call or email. Reference something specific about their business. Make it impossible to ignore.`;

  try {
    const openai = require('openai');
    const client = new openai.OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.flushHeaders();

    const stream = await client.chat.completions.create({
      model: 'gpt-4.1-mini',
      messages: [{ role: 'user', content: prompt }],
      stream: true,
    });
    for await (const chunk of stream) {
      const text = chunk.choices[0]?.delta?.content || '';
      if (text) res.write(`data: ${JSON.stringify({ text })}\n\n`);
    }
    res.write('data: [DONE]\n\n');
    res.end();
  } catch (err) {
    console.error('research error:', err);
    res.status(500).json({ error: 'Research generation failed' });
  }
});
```

**Step 2: Verify**
```bash
curl -X POST http://localhost:5001/api/research \
  -H "Content-Type: application/json" \
  -d '{"company":"Gymshark"}'
```
Expected: SSE stream with SNAPSHOT, TRADE PROFILE, RECENT SIGNALS, WHY CONTACT NOW, OPENING HOOK sections.

**Step 3: Commit**
```bash
git add backend/server.js
git commit -m "feat: add /api/research SSE route with Serper + NewsAPI + OpenAI"
```

---

## Task 9: Frontend — ResearchPage

**Files:**
- Create: `frontend/src/pages/ResearchPage.jsx`
- Create: `frontend/src/pages/ResearchPage.css`

**Step 1: Create `ResearchPage.jsx`**

```jsx
import { useState, useRef, useEffect } from 'react';
import { RiSearchEyeLine, RiRefreshLine, RiSaveLine, RiDeleteBinLine } from 'react-icons/ri';
import './ResearchPage.css';

const API = import.meta.env.VITE_API_URL || 'http://localhost:5001';

const SECTIONS = ['SNAPSHOT', 'TRADE PROFILE', 'RECENT SIGNALS', 'WHY CONTACT NOW', 'OPENING HOOK'];

function parseSection(text, key) {
  const start = text.indexOf(`## ${key}`);
  if (start === -1) return '';
  const after = text.slice(start + `## ${key}`.length).trim();
  const next = after.search(/^## /m);
  return (next === -1 ? after : after.slice(0, next)).trim();
}

export default function ResearchPage() {
  const [query, setQuery] = useState('');
  const [output, setOutput] = useState('');
  const [loading, setLoading] = useState(false);
  const [history, setHistory] = useState(() => JSON.parse(localStorage.getItem('research_history') || '[]'));
  const [activeSection, setActiveSection] = useState(null);
  const outputRef = useRef('');

  const saveHistory = (company, text) => {
    const entry = { company, text, ts: Date.now() };
    const next = [entry, ...history].slice(0, 10);
    setHistory(next);
    localStorage.setItem('research_history', JSON.stringify(next));
  };

  const runResearch = async (company = query.trim()) => {
    if (!company) return;
    setOutput('');
    outputRef.current = '';
    setActiveSection(null);
    setLoading(true);
    try {
      const res = await fetch(`${API}/api/research`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ company }),
      });
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        for (const line of decoder.decode(value).split('\n')) {
          if (line.startsWith('data: ') && !line.includes('[DONE]')) {
            try {
              const { text } = JSON.parse(line.slice(6));
              outputRef.current += text;
              setOutput(outputRef.current);
            } catch {}
          }
        }
      }
      saveHistory(company, outputRef.current);
    } finally {
      setLoading(false);
    }
  };

  const sections = SECTIONS.map(s => ({ key: s, content: parseSection(output, s) })).filter(s => s.content);

  return (
    <div className="research-page">
      <div className="research-left">
        <div className="research-search-box">
          <RiSearchEyeLine size={16} className="research-search-icon" />
          <input
            className="research-input"
            placeholder="Company name..."
            value={query}
            onChange={e => setQuery(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && runResearch()}
          />
          <button className="research-scan-btn" onClick={() => runResearch()} disabled={!query.trim() || loading}>
            {loading ? <RiRefreshLine className="research-spin" size={14} /> : 'SCAN'}
          </button>
        </div>

        {history.length > 0 && (
          <div className="research-history">
            <div className="research-history-label">RECENT SCANS</div>
            {history.map((h, i) => (
              <div key={i} className="research-history-item" onClick={() => { setQuery(h.company); setOutput(h.text); }}>
                <span>{h.company}</span>
                <button className="research-history-del" onClick={e => {
                  e.stopPropagation();
                  const next = history.filter((_, j) => j !== i);
                  setHistory(next);
                  localStorage.setItem('research_history', JSON.stringify(next));
                }}><RiDeleteBinLine size={11} /></button>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="research-right">
        {!output && !loading && (
          <div className="research-empty">
            <RiSearchEyeLine size={40} className="research-empty-icon" />
            <p>Enter a company name and hit Scan to generate an AI intelligence brief.</p>
            <p className="research-empty-sub">Pulls live news, web signals, and Flexport-specific talking points.</p>
          </div>
        )}

        {(output || loading) && (
          <div className="research-output">
            {loading && !output && <div className="research-loading">Scanning...</div>}

            {sections.map(({ key, content }) => (
              <div key={key} className="research-section">
                <div className="research-section-header"
                  onClick={() => setActiveSection(activeSection === key ? null : key)}>
                  <span className="research-section-key">{key}</span>
                </div>
                <div className="research-section-body">{content}</div>
              </div>
            ))}

            {loading && <span className="research-cursor">|</span>}
          </div>
        )}
      </div>
    </div>
  );
}
```

**Step 2: Create `ResearchPage.css`**

```css
.research-page {
  display: flex; height: 100%; gap: 0; overflow: hidden;
}
.research-left {
  width: 240px; flex-shrink: 0; border-right: 1px solid rgba(255,255,255,0.06);
  padding: 20px 16px; display: flex; flex-direction: column; gap: 16px; overflow-y: auto;
}
.research-right { flex: 1; overflow-y: auto; padding: 20px 24px; }
.research-search-box {
  display: flex; align-items: center; gap: 8px;
  background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.08);
  border-radius: 8px; padding: 4px 8px;
}
.research-search-icon { color: #00d4ff; flex-shrink: 0; }
.research-input {
  flex: 1; background: none; border: none; color: #e2e8f0;
  font-size: 13px; outline: none; font-family: inherit;
}
.research-scan-btn {
  padding: 5px 10px; background: rgba(0,212,255,0.12);
  border: 1px solid rgba(0,212,255,0.3); border-radius: 6px;
  color: #00d4ff; font-size: 10px; cursor: pointer;
  font-family: 'JetBrains Mono', monospace; letter-spacing: 0.08em;
}
.research-scan-btn:disabled { opacity: 0.4; cursor: not-allowed; }
.research-history-label {
  font-family: 'JetBrains Mono', monospace; font-size: 9px;
  color: #475569; letter-spacing: 0.1em; margin-bottom: 4px;
}
.research-history-item {
  display: flex; align-items: center; justify-content: space-between;
  padding: 7px 10px; background: rgba(255,255,255,0.03);
  border-radius: 6px; margin-bottom: 4px; cursor: pointer; font-size: 12px; color: #94a3b8;
}
.research-history-item:hover { background: rgba(255,255,255,0.06); color: #e2e8f0; }
.research-history-del { background: none; border: none; color: #475569; cursor: pointer; padding: 2px; }
.research-history-del:hover { color: #ef4444; }
.research-empty {
  display: flex; flex-direction: column; align-items: center; justify-content: center;
  height: 60%; color: #475569; text-align: center; gap: 12px;
}
.research-empty-icon { color: #1e3a4a; }
.research-empty p { font-size: 14px; max-width: 340px; }
.research-empty-sub { font-size: 12px; color: #334155; }
.research-section { margin-bottom: 20px; }
.research-section-header {
  display: flex; align-items: center; gap: 8px; margin-bottom: 8px; cursor: pointer;
}
.research-section-key {
  font-family: 'JetBrains Mono', monospace; font-size: 10px;
  color: #00d4ff; letter-spacing: 0.1em; font-weight: 700;
}
.research-section-body {
  font-size: 13px; line-height: 1.75; color: #cbd5e1;
  white-space: pre-wrap; padding: 12px 14px;
  background: rgba(255,255,255,0.02); border-radius: 8px;
  border-left: 2px solid rgba(0,212,255,0.2);
}
.research-loading { color: #475569; font-size: 13px; margin-bottom: 12px; }
.research-cursor { display: inline-block; width: 2px; height: 14px; background: #00d4ff; animation: blink 1s step-end infinite; vertical-align: text-bottom; }
@keyframes blink { 50% { opacity: 0; } }
.research-spin { animation: spin 1s linear infinite; }
@keyframes spin { to { transform: rotate(360deg); } }
```

**Step 3: Commit**
```bash
git add frontend/src/pages/ResearchPage.jsx frontend/src/pages/ResearchPage.css
git commit -m "feat: ResearchPage — AI company intelligence scanner with section parsing + history"
```

---

## Task 10: Backend — `/api/team` route + seed team data

**Files:**
- Modify: `backend/initDb.js` — add `team_members` table
- Create: `backend/data/seedTeam.js`
- Modify: `backend/server.js` — add `/api/team` route

**Step 1: Add table to `initDb.js`**

Find the last `db.run(CREATE TABLE` block and add after it:
```js
db.run(`CREATE TABLE IF NOT EXISTS team_members (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  avatar_initials TEXT,
  quota_calls INTEGER DEFAULT 50,
  quota_demos INTEGER DEFAULT 8,
  quota_revenue INTEGER DEFAULT 50000,
  actual_calls INTEGER DEFAULT 0,
  actual_demos INTEGER DEFAULT 0,
  actual_revenue INTEGER DEFAULT 0,
  trend TEXT DEFAULT 'flat'
)`);
```

**Step 2: Create `backend/data/seedTeam.js`**

```js
const db = require('../database');

const TEAM = [
  { name: 'Connor Evans', avatar_initials: 'CE', quota_calls: 50, quota_demos: 8, quota_revenue: 55000, actual_calls: 47, actual_demos: 7, actual_revenue: 48000, trend: 'up' },
  { name: 'Maya Rodriguez', avatar_initials: 'MR', quota_calls: 50, quota_demos: 8, quota_revenue: 55000, actual_calls: 52, actual_demos: 9, actual_revenue: 61000, trend: 'up' },
  { name: 'James Park', avatar_initials: 'JP', quota_calls: 50, quota_demos: 8, quota_revenue: 55000, actual_calls: 38, actual_demos: 5, actual_revenue: 31000, trend: 'down' },
  { name: 'Aisha Okonkwo', avatar_initials: 'AO', quota_calls: 50, quota_demos: 8, quota_revenue: 55000, actual_calls: 44, actual_demos: 8, actual_revenue: 52000, trend: 'flat' },
  { name: 'Tyler Chen', avatar_initials: 'TC', quota_calls: 50, quota_demos: 8, quota_revenue: 55000, actual_calls: 49, actual_demos: 6, actual_revenue: 44000, trend: 'up' },
];

const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const dbPath = path.join(__dirname, '..', 'flexport.db');
const rawDb = new sqlite3.Database(dbPath);

rawDb.serialize(() => {
  rawDb.get('SELECT COUNT(*) as c FROM team_members', (err, row) => {
    if (err || row.c > 0) { rawDb.close(); return; }
    const stmt = rawDb.prepare(`INSERT INTO team_members
      (name, avatar_initials, quota_calls, quota_demos, quota_revenue, actual_calls, actual_demos, actual_revenue, trend)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`);
    TEAM.forEach(m => stmt.run(m.name, m.avatar_initials, m.quota_calls, m.quota_demos, m.quota_revenue, m.actual_calls, m.actual_demos, m.actual_revenue, m.trend));
    stmt.finalize(() => { console.log('Team seeded.'); rawDb.close(); });
  });
});
```

**Step 3: Add `/api/team` route to `server.js`**

```js
app.get('/api/team', async (req, res) => {
  const db = require('./services/database');
  db.all('SELECT * FROM team_members ORDER BY actual_revenue DESC', async (err, members) => {
    if (err || !members?.length) return res.json({ members: [], coaching: [] });

    // AI coaching insights
    let coaching = [];
    try {
      const openai = require('openai');
      const client = new openai.OpenAI({ apiKey: process.env.OPENAI_API_KEY });
      const summaries = members.map(m =>
        `${m.name}: ${m.actual_calls}/${m.quota_calls} calls, ${m.actual_demos}/${m.quota_demos} demos, $${m.actual_revenue.toLocaleString()}/$${m.quota_revenue.toLocaleString()} revenue`
      ).join('\n');
      const resp = await client.chat.completions.create({
        model: 'gpt-4.1-mini',
        messages: [{
          role: 'user',
          content: `You are a sales manager at Flexport. Based on these SDR metrics, give ONE short (max 20 words) coaching insight per rep. Format: "RepName: insight"\n\n${summaries}`
        }],
      });
      coaching = (resp.choices[0].message.content || '').split('\n').filter(Boolean);
    } catch {}

    res.json({ members, coaching });
  });
});
```

**Step 4: Run seed**
```bash
cd backend && node initDb.js && node data/seedTeam.js
```
Expected: "Team seeded."

**Step 5: Verify**
```bash
curl http://localhost:5001/api/team
```
Expected: JSON with 5 team members and coaching array.

**Step 6: Commit**
```bash
git add backend/initDb.js backend/data/seedTeam.js backend/server.js
git commit -m "feat: team_members table, seed 5 reps, /api/team route with AI coaching"
```

---

## Task 11: Frontend — TeamPage

**Files:**
- Create: `frontend/src/pages/TeamPage.jsx`
- Create: `frontend/src/pages/TeamPage.css`

**Step 1: Create `TeamPage.jsx`**

```jsx
import { useState, useEffect } from 'react';
import { RiTeamLine, RiTrophyLine, RiArrowUpLine, RiArrowDownLine, RiSubtractLine } from 'react-icons/ri';
import './TeamPage.css';

const API = import.meta.env.VITE_API_URL || 'http://localhost:5001';

function QuotaRing({ pct, label, sub, color = '#00d4ff', size = 90 }) {
  const r = 36, circ = 2 * Math.PI * r;
  const fill = Math.min(pct, 100);
  return (
    <div className="team-ring-wrap">
      <svg width={size} height={size} viewBox="0 0 90 90">
        <circle cx="45" cy="45" r={r} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="6" />
        <circle cx="45" cy="45" r={r} fill="none" stroke={color} strokeWidth="6"
          strokeDasharray={circ} strokeDashoffset={circ * (1 - fill / 100)}
          strokeLinecap="round" transform="rotate(-90 45 45)"
          style={{ transition: 'stroke-dashoffset 1s ease' }} />
        <text x="45" y="47" textAnchor="middle" fill="#e2e8f0" fontSize="13" fontFamily="JetBrains Mono" fontWeight="700">
          {Math.round(pct)}%
        </text>
      </svg>
      <div className="team-ring-label">{label}</div>
      <div className="team-ring-sub">{sub}</div>
    </div>
  );
}

export default function TeamPage() {
  const [data, setData] = useState({ members: [], coaching: [] });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`${API}/api/team`).then(r => r.json()).then(d => { setData(d); setLoading(false); }).catch(() => setLoading(false));
  }, []);

  const trendIcon = t => t === 'up' ? <RiArrowUpLine color="#10b981" size={13} /> : t === 'down' ? <RiArrowDownLine color="#ef4444" size={13} /> : <RiSubtractLine color="#475569" size={13} />;

  const coachMap = {};
  (data.coaching || []).forEach(c => {
    const [name, ...rest] = c.split(':');
    if (name && rest.length) coachMap[name.trim()] = rest.join(':').trim();
  });

  if (loading) return <div className="team-loading">Loading team data...</div>;

  const totals = data.members.reduce((a, m) => ({
    calls: a.calls + m.actual_calls, calls_q: a.calls_q + m.quota_calls,
    demos: a.demos + m.actual_demos, demos_q: a.demos_q + m.quota_demos,
    rev: a.rev + m.actual_revenue, rev_q: a.rev_q + m.quota_revenue,
  }), { calls: 0, calls_q: 0, demos: 0, demos_q: 0, rev: 0, rev_q: 0 });

  return (
    <div className="team-page">
      <div className="team-header-row">
        <RiTeamLine size={18} className="team-header-icon" />
        <span className="team-header-title">TEAM INTELLIGENCE</span>
        <span className="team-header-sub">{data.members.length} reps · MTD</span>
      </div>

      <div className="team-rings-row">
        <QuotaRing pct={(totals.calls / totals.calls_q) * 100} label="Call Quota" sub={`${totals.calls} / ${totals.calls_q}`} />
        <QuotaRing pct={(totals.demos / totals.demos_q) * 100} label="Demo Quota" sub={`${totals.demos} / ${totals.demos_q}`} color="#6366f1" />
        <QuotaRing pct={(totals.rev / totals.rev_q) * 100} label="Revenue Quota" sub={`$${(totals.rev/1000).toFixed(0)}k / $${(totals.rev_q/1000).toFixed(0)}k`} color="#10b981" />
      </div>

      <div className="team-grid">
        <div className="team-leaderboard">
          <div className="team-section-label">LEADERBOARD</div>
          <div className="team-table">
            <div className="team-table-head">
              <span>REP</span><span>CALLS</span><span>DEMOS</span><span>PIPELINE</span><span>QUOTA %</span><span>TREND</span>
            </div>
            {data.members.map((m, i) => {
              const q = Math.round((m.actual_revenue / m.quota_revenue) * 100);
              return (
                <div key={m.id} className={`team-table-row${i === 0 ? ' top' : ''}`}>
                  <span className="team-rep-cell">
                    <span className="team-avatar">{m.avatar_initials}</span>
                    <span>{m.name}</span>
                    {i === 0 && <RiTrophyLine size={12} color="#f59e0b" />}
                  </span>
                  <span>{m.actual_calls}/{m.quota_calls}</span>
                  <span>{m.actual_demos}/{m.quota_demos}</span>
                  <span>${(m.actual_revenue/1000).toFixed(0)}k</span>
                  <span style={{ color: q >= 100 ? '#10b981' : q >= 75 ? '#f59e0b' : '#ef4444' }}>{q}%</span>
                  <span>{trendIcon(m.trend)}</span>
                </div>
              );
            })}
          </div>
        </div>

        <div className="team-coaching">
          <div className="team-section-label">AI COACH INSIGHTS</div>
          {data.members.map(m => (
            <div key={m.id} className="team-coach-card">
              <div className="team-coach-name">{m.name}</div>
              <div className="team-coach-text">{coachMap[m.name] || 'Keep up the momentum.'}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
```

**Step 2: Create `TeamPage.css`**

```css
.team-page { padding: 24px; display: flex; flex-direction: column; gap: 24px; overflow-y: auto; height: 100%; }
.team-loading { display: flex; align-items: center; justify-content: center; height: 100%; color: #475569; }
.team-header-row { display: flex; align-items: center; gap: 10px; }
.team-header-icon { color: #00d4ff; }
.team-header-title { font-family: 'JetBrains Mono', monospace; font-size: 13px; color: #e2e8f0; letter-spacing: 0.08em; }
.team-header-sub { font-size: 11px; color: #475569; margin-left: 8px; }
.team-rings-row { display: flex; gap: 32px; align-items: flex-start; }
.team-ring-wrap { display: flex; flex-direction: column; align-items: center; gap: 4px; }
.team-ring-label { font-size: 10px; color: #94a3b8; font-family: 'JetBrains Mono', monospace; }
.team-ring-sub { font-size: 9px; color: #475569; font-family: 'JetBrains Mono', monospace; }
.team-grid { display: grid; grid-template-columns: 1fr 320px; gap: 16px; }
.team-section-label { font-family: 'JetBrains Mono', monospace; font-size: 9px; color: #475569; letter-spacing: 0.1em; margin-bottom: 12px; }
.team-table { display: flex; flex-direction: column; gap: 2px; }
.team-table-head {
  display: grid; grid-template-columns: 2fr 1fr 1fr 1fr 1fr 0.5fr;
  padding: 6px 12px; font-family: 'JetBrains Mono', monospace;
  font-size: 9px; color: #475569; letter-spacing: 0.08em;
}
.team-table-row {
  display: grid; grid-template-columns: 2fr 1fr 1fr 1fr 1fr 0.5fr;
  padding: 10px 12px; background: rgba(255,255,255,0.02);
  border-radius: 6px; font-size: 12px; color: #94a3b8; align-items: center;
  border: 1px solid rgba(255,255,255,0.04);
}
.team-table-row.top { background: rgba(0,212,255,0.05); border-color: rgba(0,212,255,0.12); }
.team-rep-cell { display: flex; align-items: center; gap: 8px; }
.team-avatar {
  width: 24px; height: 24px; border-radius: 50%; background: rgba(0,212,255,0.12);
  color: #00d4ff; font-size: 8px; font-family: 'JetBrains Mono', monospace;
  display: flex; align-items: center; justify-content: center; flex-shrink: 0;
}
.team-leaderboard { background: rgba(255,255,255,0.02); border: 1px solid rgba(255,255,255,0.06); border-radius: 10px; padding: 16px; }
.team-coaching { background: rgba(255,255,255,0.02); border: 1px solid rgba(255,255,255,0.06); border-radius: 10px; padding: 16px; display: flex; flex-direction: column; gap: 10px; }
.team-coach-card { padding: 10px 12px; background: rgba(255,255,255,0.02); border-radius: 8px; border-left: 2px solid rgba(0,212,255,0.2); }
.team-coach-name { font-size: 11px; color: #00d4ff; font-family: 'JetBrains Mono', monospace; margin-bottom: 4px; }
.team-coach-text { font-size: 12px; color: #94a3b8; line-height: 1.5; }
```

**Step 3: Commit**
```bash
git add frontend/src/pages/TeamPage.jsx frontend/src/pages/TeamPage.css
git commit -m "feat: TeamPage — quota rings, leaderboard, AI coaching insights"
```

---

## Task 12: Backend — aisstream.io WebSocket proxy as SSE

**Files:**
- Modify: `backend/server.js`
- Modify: `backend/package.json` (ws already installed in Task 1)

**Step 1: Add vessel SSE endpoint to `server.js`**

At the top of `server.js` add:
```js
const WebSocket = require('ws');
```

Then add the route:
```js
// In-memory vessel cache — refreshed by aisstream WebSocket
let _vesselCache = {};
let _aisWs = null;
let _aisReconnectTimer = null;

function connectAisStream() {
  const key = process.env.AISSTREAM_API_KEY;
  if (!key) return; // no key — fallback vessels will be used
  if (_aisWs && (_aisWs.readyState === WebSocket.OPEN || _aisWs.readyState === WebSocket.CONNECTING)) return;

  _aisWs = new WebSocket('wss://stream.aisstream.io/v0/stream');

  _aisWs.on('open', () => {
    console.log('aisstream connected');
    _aisWs.send(JSON.stringify({
      APIKey: key,
      BoundingBoxes: [[[-90, -180], [90, 180]]],
      FilterMessageTypes: ['PositionReport', 'ShipStaticData'],
    }));
  });

  _aisWs.on('message', (raw) => {
    try {
      const msg = JSON.parse(raw);
      const pos = msg.Message?.PositionReport;
      const stat = msg.Message?.ShipStaticData;
      const mmsi = msg.MetaData?.MMSI;
      if (!mmsi) return;

      if (pos) {
        _vesselCache[mmsi] = {
          ..._vesselCache[mmsi],
          mmsi, lat: pos.Latitude, lng: pos.Longitude,
          sog: pos.Sog, cog: pos.Cog, heading: pos.TrueHeading,
          status: pos.NavigationalStatus, ts: Date.now(),
        };
      }
      if (stat) {
        _vesselCache[mmsi] = {
          ..._vesselCache[mmsi],
          mmsi, name: stat.Name?.trim(), type: stat.Type,
          destination: stat.Destination?.trim(), draught: stat.Draught,
          callsign: stat.CallSign?.trim(),
        };
      }
      // Evict stale entries (> 30 min old)
      const cutoff = Date.now() - 30 * 60 * 1000;
      Object.keys(_vesselCache).forEach(k => {
        if (_vesselCache[k].ts && _vesselCache[k].ts < cutoff) delete _vesselCache[k];
      });
    } catch {}
  });

  _aisWs.on('close', () => {
    console.log('aisstream disconnected — reconnecting in 10s');
    _aisReconnectTimer = setTimeout(connectAisStream, 10000);
  });

  _aisWs.on('error', (e) => { console.error('aisstream error:', e.message); });
}

// Start connecting when server boots
connectAisStream();

app.get('/api/vessels', (req, res) => {
  res.setHeader('Content-Type', 'application/json');
  const vessels = Object.values(_vesselCache).filter(v => v.lat && v.lng);

  if (vessels.length > 0) {
    return res.json({ source: 'live', vessels: vessels.slice(0, 500) });
  }

  // Fallback: generate ~60 simulated vessels along known shipping lanes
  const LANES = [
    { srcLat: 31.2, srcLng: 121.5, dstLat: 33.7, dstLng: -118.2 }, // China → LA
    { srcLat: 10.8, srcLng: 106.7, dstLat: 33.7, dstLng: -118.2 }, // Vietnam → LA
    { srcLat: 1.35, srcLng: 103.8, dstLat: 33.7, dstLng: -118.2 }, // Singapore → LA
    { srcLat: 31.2, srcLng: 121.5, dstLat: 40.7, dstLng: -74.0 },  // China → NY
    { srcLat: 19.0, srcLng: 72.8,  dstLat: 51.9, dstLng: 4.5 },    // India → Rotterdam
    { srcLat: 31.2, srcLng: 121.5, dstLat: 51.9, dstLng: 4.5 },    // China → Rotterdam
    { srcLat: -23.5, srcLng: -46.6, dstLat: 51.9, dstLng: 4.5 },   // Brazil → Rotterdam
    { srcLat: 3.1, srcLng: 101.7,  dstLat: 40.7, dstLng: -74.0 },  // Malaysia → NY
  ];

  const simVessels = [];
  const types = ['Container', 'Container', 'Container', 'Tanker', 'Bulk Carrier'];
  for (let i = 0; i < 60; i++) {
    const lane = LANES[i % LANES.length];
    const t = ((i * 0.17 + Date.now() * 0.000001) % 1);
    simVessels.push({
      mmsi: 900000000 + i, name: `SIM VESSEL ${i + 1}`,
      lat: lane.srcLat + (lane.dstLat - lane.srcLat) * t,
      lng: lane.srcLng + (lane.dstLng - lane.srcLng) * t,
      sog: 14 + (i % 6), cog: Math.atan2(lane.dstLat - lane.srcLat, lane.dstLng - lane.srcLng) * 180 / Math.PI,
      type: types[i % types.length], destination: 'SIMULATED', ts: Date.now(), simulated: true,
    });
  }
  res.json({ source: 'simulated', vessels: simVessels });
});
```

**Step 2: Verify**
```bash
curl http://localhost:5001/api/vessels
```
Expected: JSON with `source: "live"` (if AISSTREAM_API_KEY set) or `source: "simulated"` with 60 vessels.

**Step 3: Commit**
```bash
git add backend/server.js
git commit -m "feat: aisstream.io WebSocket proxy with in-memory vessel cache + simulated fallback"
```

---

## Task 13: Backend — Terminal49 container tracking

**Files:**
- Modify: `backend/server.js`

**Step 1: Add container routes**

```js
app.post('/api/containers/track', async (req, res) => {
  const { number, type = 'container_number', scac } = req.body;
  if (!number) return res.status(400).json({ error: 'number required' });

  const key = process.env.TERMINAL49_API_KEY;
  if (!key) return res.status(503).json({ error: 'TERMINAL49_API_KEY not configured' });

  try {
    const axios = require('axios');
    const payload = {
      data: {
        type: 'tracking_request',
        attributes: {
          request_type: type === 'bill_of_lading' ? 'bill_of_lading' : 'container_number',
          ...(type === 'bill_of_lading' ? { request_number: number, ...(scac ? { scac } : {}) } : { request_number: number }),
        }
      }
    };
    const r = await axios.post('https://api.terminal49.com/v2/tracking_requests', payload, {
      headers: { Authorization: `Token ${key}`, 'Content-Type': 'application/vnd.api+json' }
    });
    res.json(r.data);
  } catch (err) {
    res.status(err.response?.status || 500).json({ error: err.response?.data || err.message });
  }
});

app.get('/api/containers/:requestId', async (req, res) => {
  const key = process.env.TERMINAL49_API_KEY;
  if (!key) return res.status(503).json({ error: 'TERMINAL49_API_KEY not configured' });

  try {
    const axios = require('axios');
    const r = await axios.get(`https://api.terminal49.com/v2/tracking_requests/${req.params.requestId}?include=shipment.containers`, {
      headers: { Authorization: `Token ${key}` }
    });
    res.json(r.data);
  } catch (err) {
    res.status(err.response?.status || 500).json({ error: err.response?.data || err.message });
  }
});
```

**Step 2: Verify (if TERMINAL49_API_KEY is set)**
```bash
curl -X POST http://localhost:5001/api/containers/track \
  -H "Content-Type: application/json" \
  -d '{"number":"MSCU1234567","type":"container_number"}'
```
Expected: Terminal49 tracking request object or 503 if key not set.

**Step 3: Commit**
```bash
git add backend/server.js
git commit -m "feat: Terminal49 container tracking routes — /api/containers/track and /api/containers/:id"
```

---

## Task 14: Frontend — VesselsPage map

**Files:**
- Create: `frontend/src/pages/VesselsPage.jsx`
- Create: `frontend/src/pages/VesselsPage.css`

**Step 1: Add leaflet CSS to `frontend/index.html`**

In `<head>`, add:
```html
<link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
```

**Step 2: Create `VesselsPage.jsx`**

```jsx
import { useState, useEffect, useRef } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Circle, useMap } from 'react-leaflet';
import L from 'leaflet';
import { RiShipLine, RiSearchLine, RiRefreshLine } from 'react-icons/ri';
import './VesselsPage.css';

const API = import.meta.env.VITE_API_URL || 'http://localhost:5001';

// Custom vessel icon by type
const vesselIcon = (type = '', simulated = false) => {
  const color = type.includes('Tanker') ? '#f59e0b' : type.includes('Bulk') ? '#a78bfa' : '#00d4ff';
  const opacity = simulated ? 0.5 : 1;
  return L.divIcon({
    className: '',
    html: `<div style="width:8px;height:8px;border-radius:50%;background:${color};opacity:${opacity};box-shadow:0 0 6px ${color};"></div>`,
    iconSize: [8, 8],
    iconAnchor: [4, 4],
  });
};

// Disruption zone circles
const DISRUPTION_ZONES = [
  { lat: 26.5, lng: 56.5, radius: 280000, label: 'Strait of Hormuz', color: '#ef4444' },
  { lat: 13.5, lng: 43.5, radius: 240000, label: 'Red Sea / Bab-el-Mandeb', color: '#f59e0b' },
  { lat: 31.5, lng: 32.3, radius: 160000, label: 'Suez Canal', color: '#f59e0b' },
];

function VesselMap({ vessels, selectedVessel, onSelect }) {
  return (
    <MapContainer
      center={[20, 0]} zoom={3} minZoom={2} maxZoom={8}
      style={{ height: '100%', width: '100%', background: '#060b18' }}
      zoomControl={false}
    >
      <TileLayer
        url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
        attribution='&copy; <a href="https://www.openstreetmap.org">OSM</a> &copy; <a href="https://carto.com">CARTO</a>'
        subdomains="abcd" maxZoom={20}
      />
      {DISRUPTION_ZONES.map((z, i) => (
        <Circle key={i} center={[z.lat, z.lng]} radius={z.radius}
          pathOptions={{ color: z.color, fillColor: z.color, fillOpacity: 0.06, weight: 1, dashArray: '4 4' }} />
      ))}
      {vessels.map(v => (
        <Marker key={v.mmsi} position={[v.lat, v.lng]} icon={vesselIcon(v.type, v.simulated)}
          eventHandlers={{ click: () => onSelect(v) }}>
          <Popup className="vessel-popup">
            <strong>{v.name || `MMSI ${v.mmsi}`}</strong><br />
            {v.type} · {v.destination || '—'}<br />
            SOG {v.sog?.toFixed(1) || '—'} kn
          </Popup>
        </Marker>
      ))}
    </MapContainer>
  );
}

export default function VesselsPage() {
  const [vessels, setVessels] = useState([]);
  const [source, setSource] = useState('');
  const [loading, setLoading] = useState(true);
  const [selectedVessel, setSelectedVessel] = useState(null);
  const [tab, setTab] = useState('map');
  const [search, setSearch] = useState('');

  const fetchVessels = () => {
    setLoading(true);
    fetch(`${API}/api/vessels`)
      .then(r => r.json())
      .then(d => { setVessels(d.vessels || []); setSource(d.source); setLoading(false); })
      .catch(() => setLoading(false));
  };

  useEffect(() => {
    fetchVessels();
    const id = setInterval(fetchVessels, 30000); // refresh every 30s
    return () => clearInterval(id);
  }, []);

  const filtered = vessels.filter(v =>
    !search || (v.name || '').toLowerCase().includes(search.toLowerCase()) ||
    String(v.mmsi).includes(search)
  );

  return (
    <div className="vessels-page">
      <div className="vessels-header">
        <RiShipLine size={16} className="vessels-header-icon" />
        <span className="vessels-header-title">LIVE VESSEL TRACKER</span>
        {source && (
          <span className={`vessels-source-badge ${source}`}>
            {source === 'live' ? 'LIVE AIS' : 'SIMULATED'}
          </span>
        )}
        <span className="vessels-count">{vessels.length} vessels</span>
        <button className="vessels-refresh-btn" onClick={fetchVessels}>
          <RiRefreshLine size={13} className={loading ? 'vessels-spin' : ''} />
        </button>
        <div className="vessels-search">
          <RiSearchLine size={12} />
          <input placeholder="Search vessel..." value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <div className="vessels-tabs">
          <button className={tab === 'map' ? 'active' : ''} onClick={() => setTab('map')}>Map</button>
          <button className={tab === 'containers' ? 'active' : ''} onClick={() => setTab('containers')}>Containers</button>
        </div>
      </div>

      <div className="vessels-body">
        {tab === 'map' && (
          <div className="vessels-map-wrap">
            <VesselMap vessels={filtered} selectedVessel={selectedVessel} onSelect={setSelectedVessel} />
            {selectedVessel && (
              <div className="vessel-detail-panel">
                <div className="vd-header">
                  <RiShipLine size={14} />
                  <strong>{selectedVessel.name || `MMSI ${selectedVessel.mmsi}`}</strong>
                  <button onClick={() => setSelectedVessel(null)}>✕</button>
                </div>
                <div className="vd-row"><span>Type</span><span>{selectedVessel.type || '—'}</span></div>
                <div className="vd-row"><span>MMSI</span><span>{selectedVessel.mmsi}</span></div>
                <div className="vd-row"><span>Speed</span><span>{selectedVessel.sog?.toFixed(1) || '—'} kn</span></div>
                <div className="vd-row"><span>Course</span><span>{selectedVessel.cog?.toFixed(0) || '—'}°</span></div>
                <div className="vd-row"><span>Destination</span><span>{selectedVessel.destination || '—'}</span></div>
                <div className="vd-row"><span>Callsign</span><span>{selectedVessel.callsign || '—'}</span></div>
                {selectedVessel.simulated && <div className="vd-sim-note">Simulated position (no AIS key)</div>}
              </div>
            )}
          </div>
        )}
        {tab === 'containers' && <ContainerTab />}
      </div>
    </div>
  );
}

// Placeholder — implemented in Task 15
function ContainerTab() {
  return <div className="container-tab-placeholder">Container Intelligence — see Task 15</div>;
}
```

**Step 3: Create `VesselsPage.css`**

```css
.vessels-page { display: flex; flex-direction: column; height: 100%; overflow: hidden; }
.vessels-header {
  display: flex; align-items: center; gap: 10px; padding: 12px 20px;
  border-bottom: 1px solid rgba(255,255,255,0.06); flex-shrink: 0; flex-wrap: wrap;
}
.vessels-header-icon { color: #00d4ff; }
.vessels-header-title { font-family: 'JetBrains Mono', monospace; font-size: 12px; color: #e2e8f0; letter-spacing: 0.08em; }
.vessels-source-badge {
  font-family: 'JetBrains Mono', monospace; font-size: 9px; letter-spacing: 0.1em;
  padding: 2px 8px; border-radius: 4px; font-weight: 700;
}
.vessels-source-badge.live { background: rgba(16,185,129,0.15); color: #10b981; border: 1px solid rgba(16,185,129,0.3); }
.vessels-source-badge.simulated { background: rgba(71,85,105,0.2); color: #64748b; border: 1px solid rgba(71,85,105,0.3); }
.vessels-count { font-size: 11px; color: #475569; }
.vessels-refresh-btn { background: none; border: none; color: #475569; cursor: pointer; padding: 4px; }
.vessels-refresh-btn:hover { color: #00d4ff; }
.vessels-spin { animation: spin 1s linear infinite; }
@keyframes spin { to { transform: rotate(360deg); } }
.vessels-search {
  display: flex; align-items: center; gap: 6px;
  background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.08);
  border-radius: 6px; padding: 4px 10px; margin-left: auto;
}
.vessels-search input { background: none; border: none; color: #e2e8f0; font-size: 12px; outline: none; width: 140px; }
.vessels-tabs { display: flex; gap: 4px; }
.vessels-tabs button {
  padding: 5px 14px; background: rgba(255,255,255,0.04);
  border: 1px solid rgba(255,255,255,0.08); border-radius: 6px;
  color: #64748b; font-size: 11px; cursor: pointer;
}
.vessels-tabs button.active { border-color: #00d4ff; color: #00d4ff; background: rgba(0,212,255,0.08); }
.vessels-body { flex: 1; overflow: hidden; position: relative; }
.vessels-map-wrap { height: 100%; position: relative; }
/* Override leaflet dark theme */
.leaflet-container { background: #060b18 !important; }
.leaflet-tile { filter: brightness(0.9) saturate(0.8); }
.vessel-detail-panel {
  position: absolute; top: 16px; right: 16px; width: 220px;
  background: #0d1526; border: 1px solid rgba(0,212,255,0.2);
  border-radius: 10px; padding: 14px; z-index: 1000;
  box-shadow: 0 8px 32px rgba(0,0,0,0.5);
}
.vd-header { display: flex; align-items: center; gap: 8px; margin-bottom: 12px; color: #00d4ff; font-size: 13px; font-weight: 600; }
.vd-header button { margin-left: auto; background: none; border: none; color: #475569; cursor: pointer; }
.vd-row { display: flex; justify-content: space-between; padding: 5px 0; border-bottom: 1px solid rgba(255,255,255,0.04); font-size: 11px; }
.vd-row span:first-child { color: #475569; }
.vd-row span:last-child { color: #94a3b8; font-family: 'JetBrains Mono', monospace; }
.vd-sim-note { margin-top: 8px; font-size: 10px; color: #475569; font-style: italic; }
.container-tab-placeholder { display: flex; align-items: center; justify-content: center; height: 100%; color: #475569; }
```

**Step 4: Commit**
```bash
git add frontend/src/pages/VesselsPage.jsx frontend/src/pages/VesselsPage.css
git commit -m "feat: VesselsPage — live AIS map with react-leaflet, vessel detail panel, disruption zones"
```

---

## Task 15: Frontend — Container Intelligence tab

**Files:**
- Modify: `frontend/src/pages/VesselsPage.jsx` — replace `ContainerTab` placeholder

**Step 1: Replace the `ContainerTab` function**

```jsx
const CONTAINER_MILESTONES = [
  'empty_out', 'full_in', 'vessel_loaded', 'vessel_departed',
  'vessel_arrived', 'discharged', 'available', 'full_out', 'empty_returned'
];
const MILESTONE_LABELS = {
  empty_out: 'Empty Picked Up', full_in: 'Full Gate-In', vessel_loaded: 'Loaded on Vessel',
  vessel_departed: 'Vessel Departed', vessel_arrived: 'Vessel Arrived',
  discharged: 'Discharged', available: 'Available for Pickup', full_out: 'Full Gate-Out', empty_returned: 'Empty Returned',
};

function ContainerTab() {
  const [input, setInput] = useState('');
  const [inputType, setInputType] = useState('container_number');
  const [requestId, setRequestId] = useState('');
  const [trackData, setTrackData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [watchList, setWatchList] = useState(() => JSON.parse(localStorage.getItem('container_watchlist') || '[]'));

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
      if (d.error) { setError(d.error); setLoading(false); return; }
      setRequestId(d.data?.id || '');
      setTrackData(d);
    } catch (e) { setError(e.message); }
    setLoading(false);
  };

  const addToWatch = () => {
    if (!input.trim()) return;
    const entry = { number: input.trim(), type: inputType, requestId, ts: Date.now() };
    const next = [entry, ...watchList.filter(w => w.number !== input.trim())].slice(0, 10);
    setWatchList(next);
    localStorage.setItem('container_watchlist', JSON.stringify(next));
  };

  const events = trackData?.included?.filter(i => i.type === 'event') || [];
  const eventKeys = new Set(events.map(e => e.attributes?.event));

  return (
    <div className="container-tab">
      <div className="ct-left">
        <div className="ct-input-row">
          <select className="ct-type-sel" value={inputType} onChange={e => setInputType(e.target.value)}>
            <option value="container_number">Container #</option>
            <option value="bill_of_lading">Bill of Lading</option>
          </select>
          <input className="ct-input" placeholder="e.g. MSCU1234567" value={input}
            onChange={e => setInput(e.target.value)} onKeyDown={e => e.key === 'Enter' && submit()} />
          <button className="ct-track-btn" onClick={submit} disabled={!input || loading}>
            {loading ? <RiRefreshLine className="vessels-spin" size={13} /> : 'TRACK'}
          </button>
        </div>
        {error && <div className="ct-error">{error}</div>}

        {watchList.length > 0 && (
          <div className="ct-watchlist">
            <div className="ct-wl-label">WATCH LIST</div>
            {watchList.map((w, i) => (
              <div key={i} className="ct-wl-item" onClick={() => setInput(w.number)}>
                <span>{w.number}</span>
                <span className="ct-wl-type">{w.type === 'bill_of_lading' ? 'B/L' : 'CTR'}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="ct-right">
        {!trackData && !loading && (
          <div className="ct-empty">
            <RiShipLine size={36} style={{ color: '#1e3a4a' }} />
            <p>Track a container by number or Bill of Lading.</p>
            <p style={{ fontSize: 11, color: '#334155' }}>Covers Maersk, MSC, COSCO, CMA CGM, Evergreen + 29 more carriers.</p>
          </div>
        )}

        {trackData && (
          <>
            <div className="ct-timeline-label">CONTAINER JOURNEY</div>
            <div className="ct-timeline">
              {CONTAINER_MILESTONES.map((m, i) => {
                const done = eventKeys.has(m);
                const isActive = done && !CONTAINER_MILESTONES.slice(i + 1).some(n => eventKeys.has(n));
                return (
                  <div key={m} className={`ct-milestone ${done ? 'done' : ''} ${isActive ? 'active' : ''}`}>
                    <div className="ct-milestone-dot" />
                    {i < CONTAINER_MILESTONES.length - 1 && <div className="ct-milestone-line" />}
                    <div className="ct-milestone-label">{MILESTONE_LABELS[m]}</div>
                  </div>
                );
              })}
            </div>
            {trackData && (
              <button className="ct-watch-btn" onClick={addToWatch}>+ Add to Watch List</button>
            )}
          </>
        )}
      </div>
    </div>
  );
}
```

**Step 2: Add container tab CSS to `VesselsPage.css`**

```css
.container-tab { display: flex; height: 100%; overflow: hidden; }
.ct-left { width: 260px; flex-shrink: 0; border-right: 1px solid rgba(255,255,255,0.06); padding: 16px; display: flex; flex-direction: column; gap: 12px; overflow-y: auto; }
.ct-right { flex: 1; padding: 24px; overflow-y: auto; }
.ct-input-row { display: flex; gap: 6px; }
.ct-type-sel { background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.08); border-radius: 6px; color: #94a3b8; font-size: 11px; padding: 6px 8px; }
.ct-input { flex: 1; background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.08); border-radius: 6px; color: #e2e8f0; font-size: 12px; padding: 6px 10px; font-family: 'JetBrains Mono', monospace; }
.ct-track-btn { padding: 6px 12px; background: rgba(0,212,255,0.12); border: 1px solid rgba(0,212,255,0.3); border-radius: 6px; color: #00d4ff; font-size: 10px; cursor: pointer; font-family: 'JetBrains Mono', monospace; }
.ct-error { font-size: 11px; color: #ef4444; }
.ct-wl-label { font-family: 'JetBrains Mono', monospace; font-size: 9px; color: #475569; letter-spacing: 0.1em; }
.ct-wl-item { display: flex; justify-content: space-between; align-items: center; padding: 6px 10px; background: rgba(255,255,255,0.03); border-radius: 6px; cursor: pointer; font-size: 12px; color: #94a3b8; margin-bottom: 3px; }
.ct-wl-item:hover { background: rgba(255,255,255,0.06); }
.ct-wl-type { font-size: 9px; color: #475569; font-family: 'JetBrains Mono', monospace; }
.ct-empty { display: flex; flex-direction: column; align-items: center; justify-content: center; height: 80%; gap: 12px; color: #475569; text-align: center; }
.ct-timeline-label { font-family: 'JetBrains Mono', monospace; font-size: 9px; color: #475569; letter-spacing: 0.1em; margin-bottom: 16px; }
.ct-timeline { display: flex; flex-direction: column; gap: 0; position: relative; }
.ct-milestone { display: flex; align-items: flex-start; gap: 12px; position: relative; padding-bottom: 16px; }
.ct-milestone-dot { width: 10px; height: 10px; border-radius: 50%; background: rgba(255,255,255,0.1); border: 2px solid rgba(255,255,255,0.15); flex-shrink: 0; margin-top: 3px; transition: all 0.3s; }
.ct-milestone.done .ct-milestone-dot { background: #10b981; border-color: #10b981; box-shadow: 0 0 8px rgba(16,185,129,0.4); }
.ct-milestone.active .ct-milestone-dot { background: #00d4ff; border-color: #00d4ff; box-shadow: 0 0 10px rgba(0,212,255,0.6); animation: pulse 1.5s ease-in-out infinite; }
@keyframes pulse { 0%,100% { box-shadow: 0 0 8px rgba(0,212,255,0.4); } 50% { box-shadow: 0 0 16px rgba(0,212,255,0.8); } }
.ct-milestone-line { position: absolute; left: 4px; top: 16px; bottom: 0; width: 2px; background: rgba(255,255,255,0.06); }
.ct-milestone.done .ct-milestone-line { background: rgba(16,185,129,0.3); }
.ct-milestone-label { font-size: 12px; color: #64748b; padding-top: 2px; }
.ct-milestone.done .ct-milestone-label { color: #94a3b8; }
.ct-milestone.active .ct-milestone-label { color: #00d4ff; font-weight: 600; }
.ct-watch-btn { margin-top: 16px; padding: 8px 16px; background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.1); border-radius: 8px; color: #94a3b8; font-size: 12px; cursor: pointer; }
.ct-watch-btn:hover { border-color: rgba(0,212,255,0.3); color: #00d4ff; }
```

**Step 3: Commit**
```bash
git add frontend/src/pages/VesselsPage.jsx frontend/src/pages/VesselsPage.css
git commit -m "feat: Container Intelligence tab — Terminal49 tracking with milestone timeline + watch list"
```

---

## Task 16: Wire everything into Sidebar + App.jsx + update npm start script

**Files:**
- Modify: `frontend/src/components/Sidebar.jsx`
- Modify: `frontend/src/App.jsx`
- Modify: `backend/package.json` — add seedTeam to start script

**Step 1: Update `Sidebar.jsx`**

```jsx
import {
  RiGlobalLine, RiLineChartLine, RiBarChartGroupedLine, RiRadarLine, RiPercentLine,
  RiSettings3Line, RiShipLine, RiSearchEyeLine, RiTeamLine,
} from 'react-icons/ri';

const NAV = [
  { to: '/',            Icon: RiGlobalLine,          label: 'Home'               },
  { to: '/vessels',     Icon: RiShipLine,             label: 'Vessels'            },
  { to: '/market',      Icon: RiRadarLine,            label: 'Market Map'         },
  { to: '/tariff',      Icon: RiPercentLine,          label: 'Tariff Calculator'  },
  { to: '/trade',       Icon: RiLineChartLine,        label: 'Trade Intelligence' },
  { to: '/research',    Icon: RiSearchEyeLine,        label: 'Research'           },
  { to: '/performance', Icon: RiBarChartGroupedLine,  label: 'SDR Dashboard'      },
  { to: '/team',        Icon: RiTeamLine,             label: 'Team'               },
];
```

**Step 2: Update `App.jsx` — add imports + routes**

Add imports:
```jsx
import VesselsPage from './pages/VesselsPage';
import ResearchPage from './pages/ResearchPage';
import TeamPage from './pages/TeamPage';
```

Add routes inside `<Routes>`:
```jsx
<Route path="/vessels" element={<VesselsPage />} />
<Route path="/research" element={<ResearchPage />} />
<Route path="/team" element={<TeamPage />} />
```

Add `Ctrl+Shift+T` shortcut (opens `/team` via navigation — use `useNavigate` imported from react-router-dom):
```jsx
import { Routes, Route, useNavigate } from 'react-router-dom';
// inside App component:
const navigate = useNavigate();
// in onKey handler:
if (e.ctrlKey && e.shiftKey && e.key === 'T') {
  e.preventDefault();
  navigate('/team');
  return;
}
```

**Step 3: Update `backend/package.json` start script**

```json
"start": "node initDb.js && node data/seedProspects.js && node data/seedTeam.js && node server.js"
```

**Step 4: Update `backend/.env.example` to add a comment for the two new keys**

The keys were added in Task 1 — verify they're present.

**Step 5: Commit everything**
```bash
git add frontend/src/components/Sidebar.jsx frontend/src/App.jsx backend/package.json
git commit -m "feat: wire Vessels, Research, Team pages into nav + App routes + Ctrl+Shift+T shortcut"
```

**Step 6: Final verification checklist**
- [ ] `/` — globe shows breathing arcs + moon + glow
- [ ] `/trade` — rate rows show sparklines with trend arrows
- [ ] `/vessels` — map loads with vessel dots (live or simulated), disruption zone rings visible
- [ ] `/vessels` Containers tab — input + track flow works (or shows graceful error if no key)
- [ ] `/research` — type a company name, hit Scan, brief streams in
- [ ] `/team` — quota rings + leaderboard + coaching cards render
- [ ] `Ctrl+Shift+E` — email composer opens, generates on any prospect
- [ ] `Ctrl+Shift+T` — navigates to `/team`
- [ ] `Ctrl+Shift+R` — opens research page (add this shortcut if desired)

**Step 7: Push to GitHub**
```bash
git push
```
