# Chicago Explorer — Phase 1 Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Scaffold a full-stack Chicago city explorer app with a live 3D Mapbox map, real CTA transit data, Yelp-powered food map, and floating intelligence feed — deployed on Vercel (frontend) + Railway (backend).

**Architecture:** React 19 + Vite 7 SPA served from Vercel; Express 5 + SQLite backend on Railway proxies all external API calls (CTA, Yelp, OpenWeatherMap, Divvy GBFS). Mapbox GL JS renders the 3D city map with CTA train dots overlaid as a live GeoJSON source. All keys are server-side except the Mapbox public token (which must be URL-restricted to the Vercel domain).

**Tech Stack:** React 19, Vite 7, React Router v7, Mapbox GL JS, Express 5, SQLite (better-sqlite3), Vitest + React Testing Library (frontend), Jest + Supertest (backend), react-icons/ri, Space Grotesk + JetBrains Mono fonts.

---

## File Map

```
chicago-explorer/
├── frontend/
│   ├── index.html
│   ├── vite.config.js
│   ├── package.json
│   ├── vercel.json
│   └── src/
│       ├── main.jsx                    # React root, imports global.css
│       ├── App.jsx                     # Router + Sidebar layout shell
│       ├── styles/
│       │   └── global.css              # CSS vars, font imports, resets
│       ├── components/
│       │   ├── Sidebar.jsx             # Fixed left nav — ri icons, cyan accent
│       │   ├── Sidebar.css
│       │   ├── IntelFeed.jsx           # Floating right-side intelligence cards
│       │   └── IntelFeed.css
│       ├── hooks/
│       │   ├── useCTA.js               # Polls /api/cta/trains every 30s
│       │   ├── useWeather.js           # Fetches /api/weather once + cache
│       │   └── useYelp.js              # Fetches /api/places with filter params
│       └── pages/
│           ├── HomePage.jsx            # Full-screen Mapbox + IntelFeed overlay
│           ├── HomePage.css
│           ├── TransitPage.jsx         # CTA L map + line status + Divvy
│           ├── TransitPage.css
│           ├── FoodPage.jsx            # Yelp-powered restaurant map + filters
│           └── FoodPage.css
└── backend/
    ├── server.js                       # Express app, CORS, route mounts, port
    ├── db.js                           # better-sqlite3 init, Yelp cache table
    ├── .env.example                    # All required env var names
    ├── package.json
    └── routes/
        ├── cta.js                      # /api/cta/* — trains, arrivals, alerts
        ├── weather.js                  # /api/weather — current conditions
        ├── lake.js                     # /api/lake — lake conditions + niceness score
        ├── yelp.js                     # /api/places — with 6h SQLite cache
        └── divvy.js                    # /api/divvy/stations — GBFS proxy
```

---

## Chunk 1: Scaffold, Design System, Sidebar, Routing

### Task 1: Initialize monorepo + git

**Files:**
- Create: `chicago-explorer/frontend/package.json`
- Create: `chicago-explorer/backend/package.json`
- Create: `chicago-explorer/.gitignore`

- [ ] **Step 1: Create root directory and initialize git**

```bash
mkdir -p /Users/connorevans/Downloads/chicago-explorer
cd /Users/connorevans/Downloads/chicago-explorer
git init
git remote add origin https://github.com/AllStreets/chicago-explore.git
```

- [ ] **Step 2: Create .gitignore**

```
node_modules/
dist/
.env
*.db
.DS_Store
```

- [ ] **Step 3: Scaffold frontend with Vite**

```bash
cd /Users/connorevans/Downloads/chicago-explorer
npm create vite@latest frontend -- --template react
cd frontend
npm install
npm install react-router-dom mapbox-gl react-icons
npm install -D vitest @vitest/ui @testing-library/react @testing-library/jest-dom jsdom
```

- [ ] **Step 4: Scaffold backend**

```bash
cd /Users/connorevans/Downloads/chicago-explorer/backend
npm init -y
npm install express cors better-sqlite3 node-fetch dotenv
npm install -D jest supertest
```

Update `backend/package.json` to add test script:
```json
{
  "scripts": {
    "start": "node server.js",
    "test": "jest --testEnvironment node"
  }
}
```

- [ ] **Step 5: Create .env.example**

```bash
# backend/.env.example
CTA_API_KEY=
YELP_API_KEY=
TICKETMASTER_API_KEY=
OPENWEATHER_API_KEY=
ANTHROPIC_API_KEY=
FRONTEND_URL=http://localhost:5173
```

- [ ] **Step 6: Commit scaffold**

```bash
cd /Users/connorevans/Downloads/chicago-explorer
git add .
git commit -m "chore: scaffold monorepo — React 19 + Vite 7 frontend, Express 5 backend"
```

---

### Task 2: Design system — global CSS + fonts

**Files:**
- Create: `frontend/src/styles/global.css`
- Modify: `frontend/index.html`
- Modify: `frontend/src/main.jsx`

- [ ] **Step 1: Write the failing test**

Create `frontend/src/styles/__tests__/global.test.js`:
```js
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { resolve } from 'path'

describe('global.css design tokens', () => {
  let css

  beforeAll(() => {
    css = readFileSync(resolve(__dirname, '../global.css'), 'utf-8')
  })

  const REQUIRED_VARS = ['--bg', '--accent', '--text', '--text-muted', '--surface', '--border', '--font-ui', '--font-mono']

  REQUIRED_VARS.forEach(v => {
    it(`defines ${v}`, () => {
      expect(css).toContain(v + ':')
    })
  })

  it('imports Space Grotesk font', () => {
    expect(css).toContain('Space+Grotesk')
  })

  it('imports JetBrains Mono font', () => {
    expect(css).toContain('JetBrains+Mono')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd frontend && npx vitest run src/styles/__tests__/global.test.js
```
Expected: FAIL — `ENOENT: no such file or directory, open '.../global.css'` (file does not exist yet)

- [ ] **Step 3: Configure Vitest in vite.config.js**

```js
// frontend/vite.config.js
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test-setup.js'],
    globals: true,
  },
})
```

Create `frontend/src/test-setup.js`:
```js
import '@testing-library/jest-dom'
```

- [ ] **Step 4: Write global.css**

```css
/* frontend/src/styles/global.css */
@import url('https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap');

:root {
  --bg: #060b18;
  --accent: #00d4ff;
  --text: #e2e8f0;
  --text-muted: #64748b;
  --surface: #0f1f3a;
  --border: #1e3a5f;
  --font-ui: 'Space Grotesk', sans-serif;
  --font-mono: 'JetBrains Mono', monospace;
}

*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

html, body, #root {
  height: 100%;
  background: var(--bg);
  color: var(--text);
  font-family: var(--font-ui);
  -webkit-font-smoothing: antialiased;
}

a { color: inherit; text-decoration: none; }
```

- [ ] **Step 5: Import global.css in main.jsx**

```jsx
// frontend/src/main.jsx
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './styles/global.css'
import App from './App.jsx'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>
)
```

Update `frontend/index.html` — add `<title>Chicago Explorer</title>` and remove Vite's default favicon line.

- [ ] **Step 6: Run test to verify it passes**

```bash
cd frontend && npx vitest run src/styles/__tests__/global.test.js
```
Expected: PASS

- [ ] **Step 7: Commit**

```bash
git add frontend/
git commit -m "feat: design system — global CSS vars, Space Grotesk + JetBrains Mono"
```

---

### Task 3: Sidebar navigation

**Files:**
- Create: `frontend/src/components/Sidebar.jsx`
- Create: `frontend/src/components/Sidebar.css`
- Create: `frontend/src/components/__tests__/Sidebar.test.jsx`

- [ ] **Step 1: Write the failing test**

```jsx
// frontend/src/components/__tests__/Sidebar.test.jsx
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { describe, it, expect } from 'vitest'
import Sidebar from '../Sidebar'

describe('Sidebar', () => {
  const renderSidebar = () =>
    render(<MemoryRouter><Sidebar /></MemoryRouter>)

  it('renders all 10 nav items', () => {
    renderSidebar()
    const links = screen.getAllByRole('link')
    expect(links).toHaveLength(10)
  })

  it('links to the correct routes', () => {
    renderSidebar()
    expect(screen.getByRole('link', { name: /home/i })).toHaveAttribute('href', '/')
    expect(screen.getByRole('link', { name: /transit/i })).toHaveAttribute('href', '/transit')
    expect(screen.getByRole('link', { name: /food/i })).toHaveAttribute('href', '/food')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd frontend && npx vitest run src/components/__tests__/Sidebar.test.jsx
```
Expected: FAIL — `Cannot find module '../Sidebar'`

- [ ] **Step 3: Write Sidebar.jsx**

```jsx
// frontend/src/components/Sidebar.jsx
import { NavLink } from 'react-router-dom'
import {
  RiMapPin2Line, RiBuilding2Line, RiTrainLine, RiRestaurantLine,
  RiMoonLine, RiTrophyLine, RiCalendarEventLine, RiCompassLine,
  RiWindyLine, RiUserHeartLine
} from 'react-icons/ri'
import './Sidebar.css'

const NAV = [
  { to: '/',              icon: RiMapPin2Line,       label: 'Home' },
  { to: '/neighborhoods', icon: RiBuilding2Line,     label: 'Neighborhoods' },
  { to: '/transit',       icon: RiTrainLine,         label: 'Transit' },
  { to: '/food',          icon: RiRestaurantLine,    label: 'Food & Drink' },
  { to: '/nightlife',     icon: RiMoonLine,          label: 'Nightlife' },
  { to: '/sports',        icon: RiTrophyLine,        label: 'Sports' },
  { to: '/events',        icon: RiCalendarEventLine, label: 'Events' },
  { to: '/explore',       icon: RiCompassLine,       label: 'Explore' },
  { to: '/weather',       icon: RiWindyLine,         label: 'Weather & Lake' },
  { to: '/me',            icon: RiUserHeartLine,     label: 'My Chicago' },
]

export default function Sidebar() {
  return (
    <nav className="sidebar">
      <div className="sidebar-logo">
        <span className="sidebar-logo-text">CHI</span>
      </div>
      <ul className="sidebar-nav">
        {NAV.map(({ to, icon: Icon, label }) => (
          <li key={to}>
            <NavLink
              to={to}
              end={to === '/'}
              className={({ isActive }) => `sidebar-link${isActive ? ' active' : ''}`}
              aria-label={label}
            >
              <Icon className="sidebar-icon" />
              <span className="sidebar-label">{label}</span>
            </NavLink>
          </li>
        ))}
      </ul>
    </nav>
  )
}
```

- [ ] **Step 4: Write Sidebar.css**

```css
/* frontend/src/components/Sidebar.css */
.sidebar {
  position: fixed;
  top: 0;
  left: 0;
  width: 200px;
  height: 100vh;
  background: #060b18;
  border-right: 1px solid var(--border);
  display: flex;
  flex-direction: column;
  z-index: 100;
}

.sidebar-logo {
  padding: 20px 16px 16px;
  border-bottom: 1px solid var(--border);
}

.sidebar-logo-text {
  font-family: var(--font-mono);
  font-size: 18px;
  font-weight: 500;
  color: var(--accent);
  letter-spacing: 0.15em;
}

.sidebar-nav {
  list-style: none;
  padding: 8px 0;
  flex: 1;
  overflow-y: auto;
}

.sidebar-link {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 16px;
  color: var(--text-muted);
  font-size: 13px;
  font-weight: 500;
  transition: color 0.15s, background 0.15s;
  border-left: 2px solid transparent;
}

.sidebar-link:hover {
  color: var(--text);
  background: rgba(0, 212, 255, 0.04);
}

.sidebar-link.active {
  color: var(--accent);
  border-left-color: var(--accent);
  background: rgba(0, 212, 255, 0.08);
}

.sidebar-icon { font-size: 16px; flex-shrink: 0; }
.sidebar-label { white-space: nowrap; }
```

- [ ] **Step 5: Run test to verify it passes**

```bash
cd frontend && npx vitest run src/components/__tests__/Sidebar.test.jsx
```
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add frontend/
git commit -m "feat: sidebar nav — 10 routes, ri icons, cyan active state"
```

---

### Task 4: App shell + routing

**Files:**
- Create: `frontend/src/App.jsx`
- Create: `frontend/src/App.css`
- Create: `frontend/vercel.json`

- [ ] **Step 1: Write the failing test**

```jsx
// frontend/src/components/__tests__/App.test.jsx  (note: test of routing, not component internals)
import { render, screen } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import App from '../../App'

describe('App routing', () => {
  it('renders without crashing', () => {
    render(<App />)
    // Sidebar should always be present
    expect(screen.getByRole('navigation')).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd frontend && npx vitest run src/components/__tests__/App.test.jsx
```
Expected: FAIL — `Cannot find module '../../App'`

- [ ] **Step 3: Write App.jsx**

```jsx
// frontend/src/App.jsx
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import Sidebar from './components/Sidebar'
import HomePage from './pages/HomePage'
import TransitPage from './pages/TransitPage'
import FoodPage from './pages/FoodPage'
import './App.css'

// Phase 2 pages — placeholder component
function ComingSoon({ name }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
      {name} — coming in Phase 2
    </div>
  )
}

export default function App() {
  return (
    <BrowserRouter>
      <Sidebar />
      <main className="main-content">
        <Routes>
          <Route path="/"              element={<HomePage />} />
          <Route path="/transit"       element={<TransitPage />} />
          <Route path="/food"          element={<FoodPage />} />
          <Route path="/neighborhoods" element={<ComingSoon name="Neighborhoods" />} />
          <Route path="/nightlife"     element={<ComingSoon name="Nightlife" />} />
          <Route path="/sports"        element={<ComingSoon name="Sports" />} />
          <Route path="/events"        element={<ComingSoon name="Events" />} />
          <Route path="/explore"       element={<ComingSoon name="Explore" />} />
          <Route path="/weather"       element={<ComingSoon name="Weather & Lake" />} />
          <Route path="/me"            element={<ComingSoon name="My Chicago" />} />
        </Routes>
      </main>
    </BrowserRouter>
  )
}
```

- [ ] **Step 4: Write App.css**

```css
/* frontend/src/App.css */
.main-content {
  margin-left: 200px;
  min-height: 100vh;
  position: relative;
}
```

- [ ] **Step 5: Write vercel.json**

```json
{
  "rewrites": [{ "source": "/(.*)", "destination": "/index.html" }]
}
```

- [ ] **Step 6: Create placeholder page files so imports resolve**

Create three empty placeholder files (will be filled in Chunk 3):

`frontend/src/pages/HomePage.jsx`:
```jsx
export default function HomePage() {
  return <div style={{ color: 'var(--text-muted)', padding: 40 }}>Home — loading...</div>
}
```

`frontend/src/pages/TransitPage.jsx`:
```jsx
export default function TransitPage() {
  return <div style={{ color: 'var(--text-muted)', padding: 40 }}>Transit — loading...</div>
}
```

`frontend/src/pages/FoodPage.jsx`:
```jsx
export default function FoodPage() {
  return <div style={{ color: 'var(--text-muted)', padding: 40 }}>Food — loading...</div>
}
```

- [ ] **Step 7: Run test to verify it passes**

```bash
cd frontend && npx vitest run src/components/__tests__/App.test.jsx
```
Expected: PASS

- [ ] **Step 8: Verify dev server runs**

```bash
cd frontend && npm run dev
```
Expected: Vite starts on `http://localhost:5173`, sidebar visible, 10 nav links, page content area visible.

- [ ] **Step 9: Commit**

```bash
git add frontend/
git commit -m "feat: app shell — React Router v7, sidebar layout, Phase 2 placeholders"
```

---

## Chunk 2: Backend — Express Server + API Proxy Routes

### Task 5: Express server + SQLite init

**Files:**
- Create: `backend/server.js`
- Create: `backend/db.js`

- [ ] **Step 1: Write the failing test**

```js
// backend/tests/server.test.js
const request = require('supertest')
const app = require('../server')

describe('server health', () => {
  it('GET /api/health returns 200', async () => {
    const res = await request(app).get('/api/health')
    expect(res.status).toBe(200)
    expect(res.body).toHaveProperty('status', 'ok')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd backend && npx jest tests/server.test.js
```
Expected: FAIL — `Cannot find module '../server'`

- [ ] **Step 3: Write db.js**

```js
// backend/db.js
const Database = require('better-sqlite3')
const path = require('path')

const db = new Database(path.join(__dirname, 'chicago.db'))

db.exec(`
  CREATE TABLE IF NOT EXISTS yelp_cache (
    cache_key TEXT PRIMARY KEY,
    data      TEXT NOT NULL,
    cached_at INTEGER NOT NULL
  )
`)

module.exports = db
```

- [ ] **Step 4: Write server.js**

```js
// backend/server.js
require('dotenv').config()
const express = require('express')
const cors = require('cors')

const app = express()

const allowedOrigins = [
  process.env.FRONTEND_URL || 'http://localhost:5173',
  /\.vercel\.app$/,
]

app.use(cors({
  origin: (origin, cb) => {
    if (!origin) return cb(null, true)
    const allowed = allowedOrigins.some(o =>
      typeof o === 'string' ? o === origin : o.test(origin)
    )
    cb(allowed ? null : new Error('Not allowed by CORS'), allowed)
  }
}))

app.use(express.json())

app.get('/api/health', (_req, res) => res.json({ status: 'ok' }))

app.use('/api/cta',     require('./routes/cta'))
app.use('/api/weather', require('./routes/weather'))
app.use('/api/lake',    require('./routes/lake'))
app.use('/api/places',  require('./routes/yelp'))
app.use('/api/divvy',   require('./routes/divvy'))

if (require.main === module) {
  const port = process.env.PORT || 3001
  app.listen(port, () => console.log(`Backend on :${port}`))
}

module.exports = app
```

- [ ] **Step 5: Create stub route files so server.js imports resolve**

```js
// backend/routes/cta.js (stub — filled in Task 6)
module.exports = require('express').Router()
```

```js
// backend/routes/weather.js (stub — filled in Task 7)
module.exports = require('express').Router()
```

```js
// backend/routes/lake.js (stub — filled in Task 7)
module.exports = require('express').Router()
```

```js
// backend/routes/yelp.js (stub — filled in Task 8)
module.exports = require('express').Router()
```

```js
// backend/routes/divvy.js (stub — filled in Task 9)
module.exports = require('express').Router()
```

Create `backend/.env` (local dev only, not committed):
```
FRONTEND_URL=http://localhost:5173
CTA_API_KEY=test
YELP_API_KEY=test
OPENWEATHER_API_KEY=test
```

- [ ] **Step 6: Run test to verify it passes**

```bash
cd backend && npx jest tests/server.test.js
```
Expected: PASS — GET /api/health → 200 `{"status":"ok"}`

- [ ] **Step 7: Commit**

```bash
git add backend/
git commit -m "feat: express server + sqlite init — health endpoint, CORS, route mounts"
```

---

### Task 6: CTA route — live train positions + arrivals

**Files:**
- Modify: `backend/routes/cta.js`
- Create: `backend/tests/cta.test.js`

CTA Train Tracker API base: `http://lapi.transitchicago.com/api/1.0/`
Key param: `key=<CTA_API_KEY>`, always append `outputType=JSON`.

- [ ] **Step 1: Write the failing tests**

```js
// backend/tests/cta.test.js
const request = require('supertest')
const app = require('../server')

// Mock fetch so tests don't hit the real CTA API
global.fetch = jest.fn()

beforeEach(() => fetch.mockClear())

describe('GET /api/cta/trains', () => {
  it('returns 200 with a trains array when CTA responds', async () => {
    fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        ctatt: {
          train: [
            { rn: '101', lat: '41.87', lon: '-87.63', heading: '90', rt: 'Red', nextStaNm: 'Grand', prdt: '20260323 12:00:00', arrT: '20260323 12:02:00' }
          ]
        }
      })
    })

    const res = await request(app).get('/api/cta/trains')
    expect(res.status).toBe(200)
    expect(Array.isArray(res.body.trains)).toBe(true)
    expect(res.body.trains[0]).toMatchObject({ rn: '101', lat: 41.87, lon: -87.63, line: 'Red' })
  })

  it('returns 200 with empty array when CTA has no trains', async () => {
    fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ ctatt: {} })
    })

    const res = await request(app).get('/api/cta/trains')
    expect(res.status).toBe(200)
    expect(res.body.trains).toEqual([])
  })
})

describe('GET /api/cta/arrivals', () => {
  it('requires a stop query param', async () => {
    const res = await request(app).get('/api/cta/arrivals')
    expect(res.status).toBe(400)
  })

  it('returns arrivals array for a valid stop', async () => {
    fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        ctatt: {
          eta: [
            { staNm: 'Grand', rt: 'Red', arrT: '20260323 12:02:00', isApp: '0', isDly: '0' }
          ]
        }
      })
    })

    const res = await request(app).get('/api/cta/arrivals?stop=40490')
    expect(res.status).toBe(200)
    expect(Array.isArray(res.body.arrivals)).toBe(true)
    expect(res.body.arrivals[0]).toMatchObject({ station: 'Grand', line: 'Red' })
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd backend && npx jest tests/cta.test.js
```
Expected: FAIL — routes return empty router stubs

- [ ] **Step 3: Write CTA route**

```js
// backend/routes/cta.js
const { Router } = require('express')
const router = Router()

const BASE = 'http://lapi.transitchicago.com/api/1.0'
const key = () => process.env.CTA_API_KEY

// Normalize a CTA train object to a clean shape
function normalizeTrain(t) {
  return {
    rn:      t.rn,
    lat:     parseFloat(t.lat),
    lon:     parseFloat(t.lon),
    heading: parseInt(t.heading, 10),
    line:    t.rt,
    nextStation: t.nextStaNm,
    predTime:    t.prdt,
    arrTime:     t.arrT,
  }
}

// GET /api/cta/trains — all active train positions
router.get('/trains', async (_req, res) => {
  try {
    const r = await fetch(`${BASE}/ttpositions.aspx?rt=Red,Blue,Brn,G,Org,P,Pink,Y&key=${key()}&outputType=JSON`)
    const data = await r.json()
    const raw = data?.ctatt?.train
    const trains = raw ? (Array.isArray(raw) ? raw : [raw]).map(normalizeTrain) : []
    res.json({ trains })
  } catch (e) {
    res.status(502).json({ error: 'CTA trains unavailable', detail: e.message })
  }
})

// GET /api/cta/arrivals?stop=:stopId — arrivals for a stop
router.get('/arrivals', async (req, res) => {
  const { stop } = req.query
  if (!stop) return res.status(400).json({ error: 'stop param required' })
  try {
    const r = await fetch(`${BASE}/ttarrivals.aspx?stpid=${stop}&key=${key()}&outputType=JSON`)
    const data = await r.json()
    const raw = data?.ctatt?.eta
    const arrivals = raw
      ? (Array.isArray(raw) ? raw : [raw]).map(e => ({
          station: e.staNm,
          line:    e.rt,
          arrTime: e.arrT,
          isApproaching: e.isApp === '1',
          isDelayed:     e.isDly === '1',
        }))
      : []
    res.json({ arrivals })
  } catch (e) {
    res.status(502).json({ error: 'CTA arrivals unavailable', detail: e.message })
  }
})

// GET /api/cta/alerts — service alerts
router.get('/alerts', async (_req, res) => {
  try {
    const r = await fetch(`https://lapi.transitchicago.com/api/1.0/alerts.aspx?activeonly=true&outputType=JSON`)
    const data = await r.json()
    const raw = data?.CTAAlerts?.Alert
    const alerts = raw ? (Array.isArray(raw) ? raw : [raw]).map(a => ({
      id:       a.AlertId,
      headline: a.Headline,
      impact:   a.Impact,
      affected: a.ImpactedService?.Service?.map?.(s => s.ShortDescription) || [],
    })) : []
    res.json({ alerts })
  } catch (e) {
    res.status(502).json({ error: 'CTA alerts unavailable', detail: e.message })
  }
})

module.exports = router
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
cd backend && npx jest tests/cta.test.js
```
Expected: PASS — all 4 tests green

- [ ] **Step 5: Commit**

```bash
git add backend/routes/cta.js backend/tests/cta.test.js
git commit -m "feat: CTA route — trains, arrivals, alerts — JSON-normalized responses"
```

---

### Task 7: Weather + Lake routes

**Files:**
- Modify: `backend/routes/weather.js`
- Create: `backend/routes/lake.js`
- Create: `backend/tests/weather.test.js`

The lake route is a separate file mounted at `/api/lake` in `server.js`. Both routes call the same OpenWeatherMap endpoint but return different shapes.

- [ ] **Step 1: Write the failing tests**

```js
// backend/tests/weather.test.js
const request = require('supertest')
const app = require('../server')

global.fetch = jest.fn()
beforeEach(() => fetch.mockClear())

const OWM_RESPONSE = {
  main: { temp: 285, feels_like: 282, humidity: 65 },
  wind: { speed: 5.2, deg: 270 },
  weather: [{ description: 'partly cloudy', icon: '02d' }],
  name: 'Chicago'
}

describe('GET /api/weather', () => {
  it('returns current conditions', async () => {
    fetch.mockResolvedValueOnce({ ok: true, json: async () => OWM_RESPONSE })
    const res = await request(app).get('/api/weather')
    expect(res.status).toBe(200)
    expect(res.body).toHaveProperty('temp')
    expect(res.body).toHaveProperty('wind')
    expect(res.body).toHaveProperty('description')
  })
})

describe('GET /api/lake', () => {
  it('returns a lake conditions object with a niceness score', async () => {
    fetch.mockResolvedValueOnce({ ok: true, json: async () => OWM_RESPONSE })
    const res = await request(app).get('/api/lake')
    expect(res.status).toBe(200)
    expect(res.body).toHaveProperty('niceScore')
    expect(typeof res.body.niceScore).toBe('number')
    expect(res.body.niceScore).toBeGreaterThanOrEqual(0)
    expect(res.body.niceScore).toBeLessThanOrEqual(100)
  })

  it('returns niceLabel string', async () => {
    fetch.mockResolvedValueOnce({ ok: true, json: async () => OWM_RESPONSE })
    const res = await request(app).get('/api/lake')
    expect(res.body).toHaveProperty('niceLabel')
    expect(typeof res.body.niceLabel).toBe('string')
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd backend && npx jest tests/weather.test.js
```
Expected: FAIL — stubs return empty responses

- [ ] **Step 3: Write shared OWM helper (inline in each route file)**

Chicago Streeterville anchor: `lat=41.8919, lon=-87.6197`.

- [ ] **Step 4: Write weather.js**

```js
// backend/routes/weather.js
const { Router } = require('express')
const router = Router()

const LAT = 41.8919
const LON = -87.6197
const OWM_BASE = 'https://api.openweathermap.org/data/2.5'

function owmUrl() {
  return `${OWM_BASE}/weather?lat=${LAT}&lon=${LON}&units=metric&appid=${process.env.OPENWEATHER_API_KEY}`
}

// GET /api/weather — current conditions
router.get('/', async (_req, res) => {
  try {
    const r = await fetch(owmUrl())
    const d = await r.json()
    res.json({
      temp:        Math.round(d.main.temp),
      feelsLike:   Math.round(d.main.feels_like),
      humidity:    d.main.humidity,
      wind:        { speed: d.wind.speed, deg: d.wind.deg },
      description: d.weather[0].description,
      icon:        d.weather[0].icon,
      city:        d.name,
    })
  } catch (e) {
    res.status(502).json({ error: 'Weather unavailable', detail: e.message })
  }
})

module.exports = router
```

- [ ] **Step 5: Write lake.js**

```js
// backend/routes/lake.js
const { Router } = require('express')
const router = Router()

const LAT = 41.8919
const LON = -87.6197
const OWM_BASE = 'https://api.openweathermap.org/data/2.5'

function owmUrl() {
  return `${OWM_BASE}/weather?lat=${LAT}&lon=${LON}&units=metric&appid=${process.env.OPENWEATHER_API_KEY}`
}

function calcNiceScore({ tempC, windMps, description }) {
  let score = 50
  if (tempC >= 18 && tempC <= 24) score += 25
  else if (tempC >= 12 && tempC < 18) score += 10
  else if (tempC < 5 || tempC > 30) score -= 20
  if (windMps > 10) score -= 20
  else if (windMps < 5) score += 10
  if (description.includes('clear') || description.includes('sunny')) score += 15
  if (description.includes('rain') || description.includes('storm')) score -= 30
  if (description.includes('snow')) score -= 25
  return Math.min(100, Math.max(0, score))
}

// GET /api/lake — lake-specific conditions + niceness score
router.get('/', async (_req, res) => {
  try {
    const r = await fetch(owmUrl())
    const d = await r.json()
    const tempC = d.main.temp
    const windMps = d.wind.speed
    const description = d.weather[0].description
    const niceScore = calcNiceScore({ tempC, windMps, description })
    res.json({
      tempC:     Math.round(tempC),
      windMps:   Math.round(windMps * 10) / 10,
      description,
      niceScore,
      niceLabel: niceScore >= 70 ? 'Great day' : niceScore >= 40 ? 'Decent' : 'Stay inside',
    })
  } catch (e) {
    res.status(502).json({ error: 'Lake conditions unavailable', detail: e.message })
  }
})

module.exports = router
```

- [ ] **Step 6: Run tests to verify they pass**

```bash
cd backend && npx jest tests/weather.test.js
```
Expected: PASS — both `/api/weather` and `/api/lake` return 200 with correct shapes

- [ ] **Step 7: Commit**

```bash
git add backend/routes/weather.js backend/routes/lake.js backend/tests/weather.test.js
git commit -m "feat: weather + lake routes — OWM current conditions, composite niceness score"
```

---

### Task 8: Yelp route with SQLite cache

**Files:**
- Modify: `backend/routes/yelp.js`
- Create: `backend/tests/yelp.test.js`

Cache TTL: 6 hours. Key: MD5/hash of the query string. Use `JSON.stringify(params)` as the cache key for simplicity.

- [ ] **Step 1: Write the failing tests**

```js
// backend/tests/yelp.test.js
const request = require('supertest')
const app = require('../server')
const db = require('../db')

global.fetch = jest.fn()
beforeEach(() => {
  fetch.mockClear()
  db.prepare('DELETE FROM yelp_cache').run()
})

describe('GET /api/places', () => {
  it('returns businesses array from Yelp', async () => {
    fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        businesses: [
          { id: 'abc', name: 'The Gage', categories: [{ title: 'American' }], rating: 4.2, price: '$$', location: { neighborhood: 'Loop' }, coordinates: { latitude: 41.88, longitude: -87.62 } }
        ]
      })
    })
    const res = await request(app).get('/api/places?type=restaurants&neighborhood=Loop')
    expect(res.status).toBe(200)
    expect(Array.isArray(res.body.places)).toBe(true)
    expect(res.body.places[0]).toMatchObject({ id: 'abc', name: 'The Gage' })
  })

  it('serves from SQLite cache on second identical request', async () => {
    fetch.mockResolvedValue({
      ok: true,
      json: async () => ({
        businesses: [{ id: 'xyz', name: 'Cached Place', categories: [], rating: 4.0, price: '$', location: {}, coordinates: { latitude: 41.88, longitude: -87.62 } }]
      })
    })

    // First request — hits Yelp
    await request(app).get('/api/places?type=bars')
    // Second request — should use cache, not call fetch again
    const res = await request(app).get('/api/places?type=bars')
    expect(res.status).toBe(200)
    expect(fetch).toHaveBeenCalledTimes(1)  // only one real fetch
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd backend && npx jest tests/yelp.test.js
```
Expected: FAIL

- [ ] **Step 3: Write Yelp route**

```js
// backend/routes/yelp.js
const { Router } = require('express')
const db = require('../db')
const router = Router()

const YELP_BASE = 'https://api.yelp.com/v3/businesses/search'
const TTL_MS = 6 * 60 * 60 * 1000  // 6 hours

const stmtGet = db.prepare('SELECT data, cached_at FROM yelp_cache WHERE cache_key = ?')
const stmtSet = db.prepare('INSERT OR REPLACE INTO yelp_cache (cache_key, data, cached_at) VALUES (?, ?, ?)')

// GET /api/places?type=restaurants&neighborhood=Loop&open_now=true
router.get('/', async (req, res) => {
  const { type = 'restaurants', neighborhood = 'Chicago', open_now, price } = req.query
  const cacheKey = JSON.stringify({ type, neighborhood, open_now, price })

  // Check SQLite cache
  const cached = stmtGet.get(cacheKey)
  if (cached && Date.now() - cached.cached_at < TTL_MS) {
    return res.json(JSON.parse(cached.data))
  }

  // Fetch from Yelp
  const params = new URLSearchParams({
    term: type,
    location: neighborhood + ', Chicago, IL',
    limit: 20,
    sort_by: 'rating',
  })
  if (open_now === 'true') params.set('open_now', 'true')
  if (price) params.set('price', price)

  try {
    const r = await fetch(`${YELP_BASE}?${params}`, {
      headers: { Authorization: `Bearer ${process.env.YELP_API_KEY}` }
    })
    const data = await r.json()
    const places = (data.businesses || []).map(b => ({
      id:          b.id,
      name:        b.name,
      categories:  b.categories.map(c => c.title),
      rating:      b.rating,
      price:       b.price || '',
      neighborhood: b.location?.neighborhood || neighborhood,
      lat:          b.coordinates?.latitude,
      lon:          b.coordinates?.longitude,
      url:          b.url,
      imageUrl:     b.image_url,
    }))
    const payload = { places }
    stmtSet.run(cacheKey, JSON.stringify(payload), Date.now())
    res.json(payload)
  } catch (e) {
    res.status(502).json({ error: 'Yelp unavailable', detail: e.message })
  }
})

module.exports = router
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
cd backend && npx jest tests/yelp.test.js
```
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add backend/routes/yelp.js backend/tests/yelp.test.js
git commit -m "feat: yelp route — place search with 6h SQLite cache to protect 500/day limit"
```

---

### Task 9: Divvy GBFS route

**Files:**
- Modify: `backend/routes/divvy.js`
- Create: `backend/tests/divvy.test.js`

Divvy GBFS feeds (no key required):
- Station info: `https://gbfs.divvybikes.com/gbfs/en/station_information.json`
- Station status: `https://gbfs.divvybikes.com/gbfs/en/station_status.json`

- [ ] **Step 1: Write the failing tests**

```js
// backend/tests/divvy.test.js
const request = require('supertest')
const app = require('../server')

global.fetch = jest.fn()
beforeEach(() => fetch.mockClear())

describe('GET /api/divvy/stations', () => {
  it('merges station info and status into a combined array', async () => {
    fetch
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          data: { stations: [{ station_id: 's1', name: 'Michigan Ave', lat: 41.88, lon: -87.62, capacity: 15 }] }
        })
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          data: { stations: [{ station_id: 's1', num_bikes_available: 7, num_docks_available: 8, is_renting: 1 }] }
        })
      })

    const res = await request(app).get('/api/divvy/stations')
    expect(res.status).toBe(200)
    expect(Array.isArray(res.body.stations)).toBe(true)
    expect(res.body.stations[0]).toMatchObject({
      id: 's1', name: 'Michigan Ave', bikesAvailable: 7, docksAvailable: 8, isRenting: true
    })
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd backend && npx jest tests/divvy.test.js
```
Expected: FAIL

- [ ] **Step 3: Write Divvy route**

```js
// backend/routes/divvy.js
const { Router } = require('express')
const router = Router()

const INFO_URL   = 'https://gbfs.divvybikes.com/gbfs/en/station_information.json'
const STATUS_URL = 'https://gbfs.divvybikes.com/gbfs/en/station_status.json'

// GET /api/divvy/stations
router.get('/stations', async (_req, res) => {
  try {
    const [infoRes, statusRes] = await Promise.all([fetch(INFO_URL), fetch(STATUS_URL)])
    const [infoData, statusData] = await Promise.all([infoRes.json(), statusRes.json()])

    const infoMap = new Map(
      infoData.data.stations.map(s => [s.station_id, s])
    )

    const stations = statusData.data.stations.map(s => {
      const info = infoMap.get(s.station_id) || {}
      return {
        id:             s.station_id,
        name:           info.name || '',
        lat:            info.lat,
        lon:            info.lon,
        capacity:       info.capacity,
        bikesAvailable: s.num_bikes_available,
        docksAvailable: s.num_docks_available,
        isRenting:      s.is_renting === 1,
      }
    })

    res.json({ stations })
  } catch (e) {
    res.status(502).json({ error: 'Divvy unavailable', detail: e.message })
  }
})

module.exports = router
```

- [ ] **Step 4: Run test to verify it passes**

```bash
cd backend && npx jest tests/divvy.test.js
```
Expected: PASS

- [ ] **Step 5: Run all backend tests**

```bash
cd backend && npx jest
```
Expected: All tests pass across server, cta, weather, yelp, divvy.

- [ ] **Step 6: Commit**

```bash
git add backend/routes/divvy.js backend/tests/divvy.test.js
git commit -m "feat: divvy route — GBFS station info + status merged, no API key required"
```

---

## Chunk 3: Frontend Pages + Deploy

### Task 10: Data-fetching hooks

**Files:**
- Create: `frontend/src/hooks/useCTA.js`
- Create: `frontend/src/hooks/useWeather.js`
- Create: `frontend/src/hooks/useYelp.js`
- Create: `frontend/src/hooks/__tests__/useCTA.test.js`

The API base URL comes from `import.meta.env.VITE_API_URL` (falls back to `http://localhost:3001`).

- [ ] **Step 1: Write the failing hook test**

```js
// frontend/src/hooks/__tests__/useCTA.test.js
import { renderHook, act } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import useCTA from '../useCTA'

describe('useCTA', () => {
  beforeEach(() => vi.restoreAllMocks())

  it('returns trains array after fetch resolves', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ trains: [{ rn: '101', lat: 41.87, lon: -87.63, line: 'Red' }] })
    }))

    const { result } = renderHook(() => useCTA())
    await act(async () => { await Promise.resolve() })

    expect(result.current.trains).toHaveLength(1)
    expect(result.current.trains[0].rn).toBe('101')
  })

  it('exposes loading state', () => {
    vi.stubGlobal('fetch', vi.fn().mockReturnValue(new Promise(() => {})))
    const { result } = renderHook(() => useCTA())
    expect(result.current.loading).toBe(true)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd frontend && npx vitest run src/hooks/__tests__/useCTA.test.js
```
Expected: FAIL

- [ ] **Step 3: Write useCTA.js**

```js
// frontend/src/hooks/useCTA.js
import { useState, useEffect, useRef } from 'react'

const API = import.meta.env.VITE_API_URL || 'http://localhost:3001'
const POLL_MS = 30_000

export default function useCTA() {
  const [trains, setTrains] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const timerRef = useRef(null)

  async function fetchTrains() {
    try {
      const r = await fetch(`${API}/api/cta/trains`)
      const d = await r.json()
      setTrains(d.trains || [])
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchTrains()
    timerRef.current = setInterval(fetchTrains, POLL_MS)
    return () => clearInterval(timerRef.current)
  }, [])

  return { trains, loading, error }
}
```

- [ ] **Step 4: Write useWeather.js**

```js
// frontend/src/hooks/useWeather.js
import { useState, useEffect } from 'react'

const API = import.meta.env.VITE_API_URL || 'http://localhost:3001'

export default function useWeather() {
  const [weather, setWeather] = useState(null)
  const [lake, setLake] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.all([
      fetch(`${API}/api/weather`).then(r => r.json()),
      fetch(`${API}/api/lake`).then(r => r.json()),
    ])
      .then(([w, l]) => { setWeather(w); setLake(l) })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  return { weather, lake, loading }
}
```

- [ ] **Step 5: Write useYelp.js**

```js
// frontend/src/hooks/useYelp.js
import { useState, useEffect } from 'react'

const API = import.meta.env.VITE_API_URL || 'http://localhost:3001'

export default function useYelp(params = {}) {
  const [places, setPlaces] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const qs = new URLSearchParams(params).toString()
    fetch(`${API}/api/places?${qs}`)
      .then(r => r.json())
      .then(d => setPlaces(d.places || []))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [JSON.stringify(params)])

  return { places, loading }
}
```

- [ ] **Step 6: Run useCTA test to verify it passes**

```bash
cd frontend && npx vitest run src/hooks/__tests__/useCTA.test.js
```
Expected: PASS

- [ ] **Step 7: Commit**

```bash
git add frontend/src/hooks/
git commit -m "feat: data hooks — useCTA (30s poll), useWeather, useYelp"
```

---

### Task 11: IntelFeed component

**Files:**
- Create: `frontend/src/components/IntelFeed.jsx`
- Create: `frontend/src/components/IntelFeed.css`
- Create: `frontend/src/components/__tests__/IntelFeed.test.jsx`

The IntelFeed floats over the right ~30% of the map, showing CTA arrival cards, weather, and a nearby buzz card. It receives data as props (keeping it pure/testable).

- [ ] **Step 1: Write the failing test**

```jsx
// frontend/src/components/__tests__/IntelFeed.test.jsx
import { render, screen } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import IntelFeed from '../IntelFeed'

const mockWeather = { temp: 18, description: 'partly cloudy', wind: { speed: 4.2 } }
const mockLake = { niceLabel: 'Great day', niceScore: 78, tempC: 16 }
const mockTrains = [
  { rn: '101', line: 'Red', nextStation: 'Grand', arrTime: '20260323 14:02:00' }
]

describe('IntelFeed', () => {
  it('renders weather temp', () => {
    render(<IntelFeed weather={mockWeather} lake={mockLake} trains={mockTrains} />)
    expect(screen.getByText(/18/)).toBeInTheDocument()
  })

  it('renders lake niceness label', () => {
    render(<IntelFeed weather={mockWeather} lake={mockLake} trains={mockTrains} />)
    expect(screen.getByText(/Great day/i)).toBeInTheDocument()
  })

  it('renders train arrivals', () => {
    render(<IntelFeed weather={mockWeather} lake={mockLake} trains={mockTrains} />)
    expect(screen.getByText(/Red/i)).toBeInTheDocument()
    expect(screen.getByText(/Grand/i)).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd frontend && npx vitest run src/components/__tests__/IntelFeed.test.jsx
```
Expected: FAIL

- [ ] **Step 3: Write IntelFeed.jsx**

```jsx
// frontend/src/components/IntelFeed.jsx
import './IntelFeed.css'

const LINE_COLORS = {
  Red: '#ef4444', Blue: '#3b82f6', Brn: '#92400e',
  G: '#10b981', Org: '#f97316', P: '#8b5cf6',
  Pink: '#ec4899', Y: '#eab308',
}

function arrivalMins(arrTime) {
  if (!arrTime) return '?'
  const [datePart, timePart] = arrTime.split(' ')
  const [y, mo, d] = datePart.match(/.{4}|.{2}/g)
  const [h, m, s] = timePart.split(':')
  const t = new Date(`20${y.slice(2)}-${mo}-${d}T${h}:${m}:${s}`)
  const diff = Math.round((t - Date.now()) / 60000)
  return diff <= 0 ? 'Due' : `${diff} min`
}

export default function IntelFeed({ weather, lake, trains = [] }) {
  const nearbyTrains = trains.slice(0, 4)

  return (
    <aside className="intel-feed">
      <div className="intel-feed-header">
        <span className="intel-feed-title">LIVE INTEL</span>
        <span className="intel-feed-sub">Streeterville</span>
      </div>

      {/* Weather card */}
      {weather && (
        <div className="intel-card">
          <div className="intel-card-label">WEATHER</div>
          <div className="intel-card-value">{weather.temp}°C</div>
          <div className="intel-card-sub">{weather.description} · Wind {weather.wind?.speed} m/s</div>
          {lake && <div className="intel-card-badge">{lake.niceLabel}</div>}
        </div>
      )}

      {/* CTA arrivals */}
      <div className="intel-card-label" style={{ marginTop: 12 }}>CTA NEARBY</div>
      {nearbyTrains.length === 0 && (
        <div className="intel-card-sub" style={{ padding: '8px 0' }}>Loading trains...</div>
      )}
      {nearbyTrains.map(t => (
        <div key={t.rn} className="intel-card intel-card--train">
          <span className="intel-train-dot" style={{ background: LINE_COLORS[t.line] || '#00d4ff' }} />
          <div className="intel-train-info">
            <span className="intel-train-line">{t.line} Line</span>
            <span className="intel-train-station">{t.nextStation}</span>
          </div>
          <span className="intel-train-time">{arrivalMins(t.arrTime)}</span>
        </div>
      ))}
    </aside>
  )
}
```

- [ ] **Step 4: Write IntelFeed.css**

```css
/* frontend/src/components/IntelFeed.css */
.intel-feed {
  position: absolute;
  top: 0;
  right: 0;
  width: 280px;
  height: 100%;
  background: linear-gradient(90deg, transparent 0%, rgba(6,11,24,0.85) 20%, rgba(6,11,24,0.95) 100%);
  border-left: 1px solid var(--border);
  padding: 24px 16px;
  overflow-y: auto;
  z-index: 10;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.intel-feed-header {
  display: flex;
  flex-direction: column;
  gap: 2px;
  margin-bottom: 12px;
  padding-bottom: 12px;
  border-bottom: 1px solid var(--border);
}

.intel-feed-title {
  font-family: var(--font-mono);
  font-size: 11px;
  color: var(--accent);
  letter-spacing: 0.15em;
}

.intel-feed-sub {
  font-size: 11px;
  color: var(--text-muted);
  font-family: var(--font-mono);
}

.intel-card {
  background: rgba(15,31,58,0.7);
  border: 1px solid var(--border);
  border-radius: 6px;
  padding: 10px 12px;
}

.intel-card--train {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 12px;
}

.intel-card-label {
  font-family: var(--font-mono);
  font-size: 9px;
  color: var(--text-muted);
  letter-spacing: 0.12em;
  margin-bottom: 4px;
}

.intel-card-value {
  font-size: 22px;
  font-weight: 600;
  color: var(--text);
  font-family: var(--font-mono);
}

.intel-card-sub {
  font-size: 11px;
  color: var(--text-muted);
  margin-top: 2px;
}

.intel-card-badge {
  display: inline-block;
  margin-top: 6px;
  padding: 2px 8px;
  background: rgba(0,212,255,0.1);
  border: 1px solid rgba(0,212,255,0.3);
  border-radius: 10px;
  font-size: 10px;
  color: var(--accent);
  font-family: var(--font-mono);
}

.intel-train-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  flex-shrink: 0;
}

.intel-train-info {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 1px;
}

.intel-train-line { font-size: 12px; font-weight: 600; color: var(--text); }
.intel-train-station { font-size: 10px; color: var(--text-muted); font-family: var(--font-mono); }

.intel-train-time {
  font-family: var(--font-mono);
  font-size: 11px;
  color: var(--accent);
  white-space: nowrap;
}
```

- [ ] **Step 5: Run test to verify it passes**

```bash
cd frontend && npx vitest run src/components/__tests__/IntelFeed.test.jsx
```
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add frontend/src/components/IntelFeed.jsx frontend/src/components/IntelFeed.css frontend/src/components/__tests__/IntelFeed.test.jsx
git commit -m "feat: IntelFeed — floating CTA arrivals, weather, lake niceness card"
```

---

### Task 12: Home page — 3D Mapbox map + IntelFeed

**Files:**
- Modify: `frontend/src/pages/HomePage.jsx`
- Create: `frontend/src/pages/HomePage.css`

Mapbox GL JS requires a DOM element and a valid token. Skip full rendering tests for the map itself (no headless WebGL). Test the page renders the feed overlay and doesn't crash.

- [ ] **Step 1: Write the failing test**

```jsx
// frontend/src/pages/__tests__/HomePage.test.jsx
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { describe, it, expect, vi } from 'vitest'

// Mock mapbox-gl — no WebGL in jsdom
vi.mock('mapbox-gl', () => ({
  default: {
    Map: vi.fn(() => ({
      on: vi.fn(),
      addControl: vi.fn(),
      remove: vi.fn(),
      addSource: vi.fn(),
      addLayer: vi.fn(),
      getSource: vi.fn(() => ({ setData: vi.fn() })),
      isStyleLoaded: vi.fn(() => true),
    })),
    NavigationControl: vi.fn(),
    accessToken: '',
  }
}))

// Mock data hooks
vi.mock('../../hooks/useCTA', () => ({
  default: () => ({ trains: [], loading: false, error: null })
}))
vi.mock('../../hooks/useWeather', () => ({
  default: () => ({ weather: { temp: 18, description: 'clear', wind: { speed: 3 } }, lake: { niceLabel: 'Great day', niceScore: 80, tempC: 16 }, loading: false })
}))

import HomePage from '../HomePage'

describe('HomePage', () => {
  it('renders without crashing', () => {
    render(<MemoryRouter><HomePage /></MemoryRouter>)
    expect(document.querySelector('.home-page')).toBeTruthy()
  })

  it('renders the intel feed overlay', () => {
    render(<MemoryRouter><HomePage /></MemoryRouter>)
    expect(screen.getByText(/LIVE INTEL/i)).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd frontend && npx vitest run src/pages/__tests__/HomePage.test.jsx
```
Expected: FAIL

- [ ] **Step 3: Write HomePage.jsx**

```jsx
// frontend/src/pages/HomePage.jsx
import { useEffect, useRef } from 'react'
import mapboxgl from 'mapbox-gl'
import 'mapbox-gl/dist/mapbox-gl.css'
import IntelFeed from '../components/IntelFeed'
import useCTA from '../hooks/useCTA'
import useWeather from '../hooks/useWeather'
import './HomePage.css'

mapboxgl.accessToken = import.meta.env.VITE_MAPBOX_TOKEN || ''

// Streeterville anchor
const CENTER = [-87.6197, 41.8919]
const ZOOM   = 13.5

// CTA line colors for map dots
const LINE_COLOR_MAP = {
  Red: '#ef4444', Blue: '#3b82f6', Brn: '#92400e',
  G: '#10b981', Org: '#f97316', P: '#8b5cf6',
  Pink: '#ec4899', Y: '#eab308',
}

export default function HomePage() {
  const mapContainer = useRef(null)
  const mapRef       = useRef(null)
  const { trains }   = useCTA()
  const { weather, lake } = useWeather()

  // Initialize map
  useEffect(() => {
    if (mapRef.current) return
    const map = new mapboxgl.Map({
      container: mapContainer.current,
      style: 'mapbox://styles/mapbox/dark-v11',
      center: CENTER,
      zoom: ZOOM,
      pitch: 45,
      bearing: -17.6,
      antialias: true,
    })

    map.addControl(new mapboxgl.NavigationControl({ showCompass: false }), 'top-left')

    map.on('load', () => {
      // 3D buildings layer
      const layers = map.getStyle().layers
      const labelLayer = layers.find(l => l.type === 'symbol' && l.layout?.['text-field'])
      map.addLayer(
        {
          id: '3d-buildings',
          source: 'composite',
          'source-layer': 'building',
          filter: ['==', 'extrude', 'true'],
          type: 'fill-extrusion',
          minzoom: 12,
          paint: {
            'fill-extrusion-color': '#0f1f3a',
            'fill-extrusion-height': ['get', 'height'],
            'fill-extrusion-base': ['get', 'min_height'],
            'fill-extrusion-opacity': 0.8,
          },
        },
        labelLayer?.id
      )

      // CTA train source (empty GeoJSON, updated by the train effect below)
      map.addSource('cta-trains', {
        type: 'geojson',
        data: { type: 'FeatureCollection', features: [] }
      })

      map.addLayer({
        id: 'cta-train-dots',
        type: 'circle',
        source: 'cta-trains',
        paint: {
          'circle-radius': 5,
          'circle-color': ['get', 'color'],
          'circle-stroke-color': '#fff',
          'circle-stroke-width': 1,
          'circle-opacity': 0.9,
        }
      })
    })

    mapRef.current = map
    return () => { map.remove(); mapRef.current = null }
  }, [])

  // Update train dots whenever new data arrives
  useEffect(() => {
    const map = mapRef.current
    if (!map || !map.isStyleLoaded()) return
    const source = map.getSource('cta-trains')
    if (!source) return
    source.setData({
      type: 'FeatureCollection',
      features: trains.map(t => ({
        type: 'Feature',
        geometry: { type: 'Point', coordinates: [t.lon, t.lat] },
        properties: { rn: t.rn, line: t.line, color: LINE_COLOR_MAP[t.line] || '#00d4ff' }
      }))
    })
  }, [trains])

  return (
    <div className="home-page">
      <div ref={mapContainer} className="home-map" />
      <IntelFeed weather={weather} lake={lake} trains={trains} />
    </div>
  )
}
```

- [ ] **Step 4: Write HomePage.css**

```css
/* frontend/src/pages/HomePage.css */
.home-page {
  position: relative;
  width: 100%;
  height: 100vh;
  overflow: hidden;
}

.home-map {
  position: absolute;
  inset: 0;
}

/* Override Mapbox attribution to match dark theme */
.mapboxgl-ctrl-attrib {
  background: rgba(6,11,24,0.8) !important;
  color: var(--text-muted) !important;
}
```

- [ ] **Step 5: Create `__tests__` directory and run test**

```bash
cd frontend && npx vitest run src/pages/__tests__/HomePage.test.jsx
```
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add frontend/src/pages/HomePage.jsx frontend/src/pages/HomePage.css frontend/src/pages/__tests__/HomePage.test.jsx
git commit -m "feat: home page — mapbox 3D map, extruded buildings, live CTA train dots, intel feed overlay"
```

---

### Task 13: Transit page — CTA L map + Divvy

**Files:**
- Modify: `frontend/src/pages/TransitPage.jsx`
- Create: `frontend/src/pages/TransitPage.css`

- [ ] **Step 1: Write the failing test**

```jsx
// frontend/src/pages/__tests__/TransitPage.test.jsx
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { describe, it, expect, vi } from 'vitest'

vi.mock('mapbox-gl', () => ({
  default: {
    Map: vi.fn(() => ({
      on: vi.fn(), addControl: vi.fn(), remove: vi.fn(),
      addSource: vi.fn(), addLayer: vi.fn(),
      getSource: vi.fn(() => ({ setData: vi.fn() })),
      isStyleLoaded: vi.fn(() => true),
    })),
    NavigationControl: vi.fn(),
    accessToken: '',
  }
}))

vi.mock('../../hooks/useCTA', () => ({
  default: () => ({ trains: [{ rn: '1', line: 'Red', lat: 41.88, lon: -87.63, nextStation: 'Grand', arrTime: null }], loading: false, error: null })
}))

global.fetch = vi.fn().mockResolvedValue({
  ok: true,
  json: async () => ({ stations: [] })
})

import TransitPage from '../TransitPage'

describe('TransitPage', () => {
  it('renders the CTA status header', () => {
    render(<MemoryRouter><TransitPage /></MemoryRouter>)
    expect(screen.getByText(/CTA/i)).toBeInTheDocument()
  })

  it('renders line status cards', () => {
    render(<MemoryRouter><TransitPage /></MemoryRouter>)
    expect(screen.getByText(/Red Line/i)).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd frontend && npx vitest run src/pages/__tests__/TransitPage.test.jsx
```
Expected: FAIL

- [ ] **Step 3: Write TransitPage.jsx**

```jsx
// frontend/src/pages/TransitPage.jsx
import { useEffect, useRef, useState } from 'react'
import mapboxgl from 'mapbox-gl'
import 'mapbox-gl/dist/mapbox-gl.css'
import useCTA from '../hooks/useCTA'
import './TransitPage.css'

mapboxgl.accessToken = import.meta.env.VITE_MAPBOX_TOKEN || ''

const API = import.meta.env.VITE_API_URL || 'http://localhost:3001'

const LINES = [
  { id: 'Red',  label: 'Red Line',    color: '#ef4444' },
  { id: 'Blue', label: 'Blue Line',   color: '#3b82f6' },
  { id: 'Brn',  label: 'Brown Line',  color: '#92400e' },
  { id: 'G',    label: 'Green Line',  color: '#10b981' },
  { id: 'Org',  label: 'Orange Line', color: '#f97316' },
  { id: 'P',    label: 'Purple Line', color: '#8b5cf6' },
  { id: 'Pink', label: 'Pink Line',   color: '#ec4899' },
  { id: 'Y',    label: 'Yellow Line', color: '#eab308' },
]

export default function TransitPage() {
  const mapContainer = useRef(null)
  const mapRef       = useRef(null)
  const { trains, loading } = useCTA()
  const [divvyStations, setDivvyStations] = useState([])

  useEffect(() => {
    fetch(`${API}/api/divvy/stations`)
      .then(r => r.json())
      .then(d => setDivvyStations(d.stations || []))
      .catch(() => {})
  }, [])

  useEffect(() => {
    if (mapRef.current) return
    const map = new mapboxgl.Map({
      container: mapContainer.current,
      style: 'mapbox://styles/mapbox/dark-v11',
      center: [-87.6298, 41.8781],
      zoom: 11,
      pitch: 0,
    })
    map.addControl(new mapboxgl.NavigationControl({ showCompass: false }), 'top-left')
    map.on('load', () => {
      map.addSource('trains', { type: 'geojson', data: { type: 'FeatureCollection', features: [] } })
      map.addLayer({
        id: 'train-dots',
        type: 'circle',
        source: 'trains',
        paint: {
          'circle-radius': 5,
          'circle-color': ['get', 'color'],
          'circle-stroke-color': '#fff',
          'circle-stroke-width': 1,
        }
      })
      map.addSource('divvy', { type: 'geojson', data: { type: 'FeatureCollection', features: [] } })
      map.addLayer({
        id: 'divvy-dots',
        type: 'circle',
        source: 'divvy',
        paint: { 'circle-radius': 3, 'circle-color': '#22c55e', 'circle-opacity': 0.7 }
      })
    })
    mapRef.current = map
    return () => { map.remove(); mapRef.current = null }
  }, [])

  useEffect(() => {
    const map = mapRef.current
    if (!map || !map.isStyleLoaded()) return
    const src = map.getSource('trains')
    if (!src) return
    const LINE_COLORS = Object.fromEntries(LINES.map(l => [l.id, l.color]))
    src.setData({
      type: 'FeatureCollection',
      features: trains.map(t => ({
        type: 'Feature',
        geometry: { type: 'Point', coordinates: [t.lon, t.lat] },
        properties: { color: LINE_COLORS[t.line] || '#00d4ff' }
      }))
    })
  }, [trains])

  useEffect(() => {
    const map = mapRef.current
    if (!map || !map.isStyleLoaded() || !divvyStations.length) return
    const src = map.getSource('divvy')
    if (!src) return
    src.setData({
      type: 'FeatureCollection',
      features: divvyStations
        .filter(s => s.lat && s.lon)
        .map(s => ({
          type: 'Feature',
          geometry: { type: 'Point', coordinates: [s.lon, s.lat] },
          properties: { bikes: s.bikesAvailable, name: s.name }
        }))
    })
  }, [divvyStations])

  const trainsByLine = Object.fromEntries(LINES.map(l => [l.id, trains.filter(t => t.line === l.id)]))

  return (
    <div className="transit-page">
      <div className="transit-header">
        <span className="transit-title">CTA Live Transit</span>
        <span className="transit-sub">{loading ? 'Loading...' : `${trains.length} active trains`}</span>
      </div>

      <div className="transit-layout">
        <div className="transit-sidebar">
          {LINES.map(line => (
            <div key={line.id} className="line-card">
              <div className="line-card-dot" style={{ background: line.color }} />
              <div className="line-card-info">
                <span className="line-card-name">{line.label}</span>
                <span className="line-card-count" style={{ color: line.color }}>
                  {trainsByLine[line.id]?.length || 0} trains
                </span>
              </div>
            </div>
          ))}
          <div className="line-card">
            <div className="line-card-dot" style={{ background: '#22c55e' }} />
            <div className="line-card-info">
              <span className="line-card-name">Divvy Bikes</span>
              <span className="line-card-count" style={{ color: '#22c55e' }}>
                {divvyStations.length} stations
              </span>
            </div>
          </div>
        </div>

        <div ref={mapContainer} className="transit-map" />
      </div>
    </div>
  )
}
```

- [ ] **Step 4: Write TransitPage.css**

```css
/* frontend/src/pages/TransitPage.css */
.transit-page {
  height: 100vh;
  display: flex;
  flex-direction: column;
  background: var(--bg);
}

.transit-header {
  padding: 16px 24px;
  border-bottom: 1px solid var(--border);
  display: flex;
  align-items: baseline;
  gap: 16px;
}

.transit-title {
  font-size: 16px;
  font-weight: 600;
  color: var(--text);
}

.transit-sub {
  font-family: var(--font-mono);
  font-size: 11px;
  color: var(--text-muted);
}

.transit-layout {
  flex: 1;
  display: flex;
  overflow: hidden;
}

.transit-sidebar {
  width: 200px;
  border-right: 1px solid var(--border);
  padding: 12px 0;
  overflow-y: auto;
  flex-shrink: 0;
}

.transit-map {
  flex: 1;
}

.line-card {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 16px;
  cursor: default;
}

.line-card:hover { background: rgba(0,212,255,0.04); }

.line-card-dot {
  width: 10px;
  height: 10px;
  border-radius: 50%;
  flex-shrink: 0;
}

.line-card-info {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.line-card-name {
  font-size: 12px;
  font-weight: 500;
  color: var(--text);
}

.line-card-count {
  font-family: var(--font-mono);
  font-size: 10px;
}
```

- [ ] **Step 5: Run test to verify it passes**

```bash
cd frontend && npx vitest run src/pages/__tests__/TransitPage.test.jsx
```
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add frontend/src/pages/TransitPage.jsx frontend/src/pages/TransitPage.css frontend/src/pages/__tests__/TransitPage.test.jsx
git commit -m "feat: transit page — CTA L map with live train dots, line status cards, Divvy stations"
```

---

### Task 14: Food & Drink page — Yelp map + filters

**Files:**
- Modify: `frontend/src/pages/FoodPage.jsx`
- Create: `frontend/src/pages/FoodPage.css`

- [ ] **Step 1: Write the failing test**

```jsx
// frontend/src/pages/__tests__/FoodPage.test.jsx
import { render, screen, fireEvent } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { describe, it, expect, vi } from 'vitest'

vi.mock('mapbox-gl', () => ({
  default: {
    Map: vi.fn(() => ({
      on: vi.fn(), addControl: vi.fn(), remove: vi.fn(),
      addSource: vi.fn(), addLayer: vi.fn(),
      getSource: vi.fn(() => ({ setData: vi.fn() })),
      isStyleLoaded: vi.fn(() => true),
    })),
    NavigationControl: vi.fn(),
    Popup: vi.fn(() => ({ setLngLat: vi.fn(() => ({ setHTML: vi.fn(() => ({ addTo: vi.fn() })) })) })),
    accessToken: '',
  }
}))

vi.mock('../../hooks/useYelp', () => ({
  default: () => ({
    places: [
      { id: '1', name: 'The Gage', rating: 4.2, price: '$$', categories: ['American'], lat: 41.88, lon: -87.62, neighborhood: 'Loop' }
    ],
    loading: false
  })
}))

import FoodPage from '../FoodPage'

describe('FoodPage', () => {
  it('renders the filter panel', () => {
    render(<MemoryRouter><FoodPage /></MemoryRouter>)
    expect(screen.getByText(/Food & Drink/i)).toBeInTheDocument()
  })

  it('renders place cards from hook', () => {
    render(<MemoryRouter><FoodPage /></MemoryRouter>)
    expect(screen.getByText('The Gage')).toBeInTheDocument()
  })

  it('shows cuisine filter options', () => {
    render(<MemoryRouter><FoodPage /></MemoryRouter>)
    expect(screen.getByText(/Restaurants/i)).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd frontend && npx vitest run src/pages/__tests__/FoodPage.test.jsx
```
Expected: FAIL

- [ ] **Step 3: Write FoodPage.jsx**

```jsx
// frontend/src/pages/FoodPage.jsx
import { useEffect, useRef, useState } from 'react'
import mapboxgl from 'mapbox-gl'
import 'mapbox-gl/dist/mapbox-gl.css'
import useYelp from '../hooks/useYelp'
import './FoodPage.css'

mapboxgl.accessToken = import.meta.env.VITE_MAPBOX_TOKEN || ''

const TYPES = ['restaurants', 'bars', 'cafes', 'pizza', 'sushi', 'tacos', 'brunch']

export default function FoodPage() {
  const mapContainer = useRef(null)
  const mapRef       = useRef(null)
  const [type, setType] = useState('restaurants')
  const [openNow, setOpenNow] = useState(false)
  const { places, loading } = useYelp({ type, open_now: openNow ? 'true' : undefined })

  useEffect(() => {
    if (mapRef.current) return
    const map = new mapboxgl.Map({
      container: mapContainer.current,
      style: 'mapbox://styles/mapbox/dark-v11',
      center: [-87.6197, 41.8919],
      zoom: 13,
      pitch: 30,
    })
    map.addControl(new mapboxgl.NavigationControl({ showCompass: false }), 'top-left')
    map.on('load', () => {
      map.addSource('places', { type: 'geojson', data: { type: 'FeatureCollection', features: [] } })
      map.addLayer({
        id: 'place-dots',
        type: 'circle',
        source: 'places',
        paint: {
          'circle-radius': 6,
          'circle-color': '#00d4ff',
          'circle-stroke-color': '#fff',
          'circle-stroke-width': 1,
          'circle-opacity': 0.85,
        }
      })
      map.on('click', 'place-dots', e => {
        const { name, rating, price, category } = e.features[0].properties
        new mapboxgl.Popup()
          .setLngLat(e.features[0].geometry.coordinates)
          .setHTML(`<strong>${name}</strong><br>${rating} stars · ${price}<br><small>${category}</small>`)
          .addTo(map)
      })
      map.on('mouseenter', 'place-dots', () => { map.getCanvas().style.cursor = 'pointer' })
      map.on('mouseleave', 'place-dots', () => { map.getCanvas().style.cursor = '' })
    })
    mapRef.current = map
    return () => { map.remove(); mapRef.current = null }
  }, [])

  useEffect(() => {
    const map = mapRef.current
    if (!map || !map.isStyleLoaded()) return
    const src = map.getSource('places')
    if (!src) return
    src.setData({
      type: 'FeatureCollection',
      features: places
        .filter(p => p.lat && p.lon)
        .map(p => ({
          type: 'Feature',
          geometry: { type: 'Point', coordinates: [p.lon, p.lat] },
          properties: { name: p.name, rating: p.rating, price: p.price, category: p.categories?.[0] || '' }
        }))
    })
  }, [places])

  return (
    <div className="food-page">
      <div className="food-header">
        <span className="food-title">Food & Drink</span>
        <div className="food-filters">
          <div className="food-filter-types">
            {TYPES.map(t => (
              <button
                key={t}
                onClick={() => setType(t)}
                className={`food-filter-btn${type === t ? ' active' : ''}`}
              >
                {t.charAt(0).toUpperCase() + t.slice(1)}
              </button>
            ))}
          </div>
          <label className="food-filter-toggle">
            <input type="checkbox" checked={openNow} onChange={e => setOpenNow(e.target.checked)} />
            Open now
          </label>
        </div>
      </div>

      <div className="food-layout">
        <div className="food-list">
          {loading && <div className="food-loading">Loading places...</div>}
          {places.map(p => (
            <div key={p.id} className="food-card">
              <div className="food-card-name">{p.name}</div>
              <div className="food-card-meta">
                <span className="food-card-rating">{p.rating}</span>
                <span className="food-card-price">{p.price}</span>
                <span className="food-card-category">{p.categories?.[0]}</span>
              </div>
              <div className="food-card-neighborhood">{p.neighborhood}</div>
            </div>
          ))}
        </div>
        <div ref={mapContainer} className="food-map" />
      </div>
    </div>
  )
}
```

- [ ] **Step 4: Write FoodPage.css**

```css
/* frontend/src/pages/FoodPage.css */
.food-page {
  height: 100vh;
  display: flex;
  flex-direction: column;
  background: var(--bg);
}

.food-header {
  padding: 14px 24px;
  border-bottom: 1px solid var(--border);
  display: flex;
  align-items: center;
  gap: 24px;
  flex-wrap: wrap;
}

.food-title {
  font-size: 16px;
  font-weight: 600;
  color: var(--text);
  flex-shrink: 0;
}

.food-filters {
  display: flex;
  align-items: center;
  gap: 12px;
  flex-wrap: wrap;
}

.food-filter-types { display: flex; gap: 6px; flex-wrap: wrap; }

.food-filter-btn {
  padding: 4px 12px;
  border-radius: 14px;
  border: 1px solid var(--border);
  background: transparent;
  color: var(--text-muted);
  font-size: 12px;
  font-family: var(--font-ui);
  cursor: pointer;
  transition: all 0.15s;
}

.food-filter-btn:hover { color: var(--text); border-color: rgba(0,212,255,0.4); }
.food-filter-btn.active { color: var(--accent); border-color: var(--accent); background: rgba(0,212,255,0.08); }

.food-filter-toggle {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  color: var(--text-muted);
  cursor: pointer;
  user-select: none;
}

.food-layout {
  flex: 1;
  display: flex;
  overflow: hidden;
}

.food-list {
  width: 260px;
  border-right: 1px solid var(--border);
  overflow-y: auto;
  padding: 8px 0;
  flex-shrink: 0;
}

.food-map { flex: 1; }

.food-loading {
  padding: 16px;
  font-size: 12px;
  color: var(--text-muted);
  font-family: var(--font-mono);
}

.food-card {
  padding: 12px 16px;
  border-bottom: 1px solid rgba(30,58,95,0.5);
  cursor: pointer;
  transition: background 0.1s;
}

.food-card:hover { background: rgba(0,212,255,0.04); }

.food-card-name {
  font-size: 13px;
  font-weight: 500;
  color: var(--text);
  margin-bottom: 4px;
}

.food-card-meta {
  display: flex;
  gap: 8px;
  align-items: center;
  margin-bottom: 2px;
}

.food-card-rating {
  font-family: var(--font-mono);
  font-size: 11px;
  color: var(--accent);
}

.food-card-price, .food-card-category {
  font-size: 11px;
  color: var(--text-muted);
}

.food-card-neighborhood {
  font-size: 10px;
  color: var(--text-muted);
  font-family: var(--font-mono);
}
```

- [ ] **Step 5: Run test to verify it passes**

```bash
cd frontend && npx vitest run src/pages/__tests__/FoodPage.test.jsx
```
Expected: PASS

- [ ] **Step 6: Run all frontend tests**

```bash
cd frontend && npx vitest run
```
Expected: All tests pass.

- [ ] **Step 7: Commit**

```bash
git add frontend/src/pages/FoodPage.jsx frontend/src/pages/FoodPage.css frontend/src/pages/__tests__/FoodPage.test.jsx
git commit -m "feat: food page — yelp map, cuisine filters, open-now toggle, place cards"
```

---

### Task 15: Deploy config + push to GitHub

**Files:**
- Create: `frontend/.env.example`
- Create: `backend/Procfile` (Railway)
- Verify: `frontend/vercel.json`

- [ ] **Step 1: Create frontend .env.example**

```bash
# frontend/.env.example
VITE_MAPBOX_TOKEN=
VITE_API_URL=https://your-backend.railway.app
```

- [ ] **Step 2: Verify vercel.json is correct**

`frontend/vercel.json` should contain:
```json
{
  "rewrites": [{ "source": "/(.*)", "destination": "/index.html" }]
}
```

- [ ] **Step 3: Create backend Procfile for Railway**

```
# backend/Procfile
web: node server.js
```

- [ ] **Step 4: Run full backend test suite**

```bash
cd backend && npx jest
```
Expected: All tests pass — server, cta, weather, yelp, divvy.

- [ ] **Step 5: Run full frontend test suite**

```bash
cd frontend && npx vitest run
```
Expected: All tests pass.

- [ ] **Step 6: Commit deploy config**

```bash
git add frontend/.env.example backend/Procfile
git commit -m "chore: deploy config — vercel.json SPA rewrite, Railway Procfile, env examples"
```

- [ ] **Step 7: Push to GitHub**

```bash
cd /Users/connorevans/Downloads/chicago-explorer
git push -u origin main
```
Expected: Branch `main` pushed to `https://github.com/AllStreets/chicago-explore.git`

- [ ] **Step 8: Deploy instructions**

**Vercel (frontend):**
1. Import `AllStreets/chicago-explore` repo in Vercel dashboard
2. Set root directory to `frontend`
3. Add env var: `VITE_MAPBOX_TOKEN` (URL-restricted to your Vercel domain in Mapbox dashboard), `VITE_API_URL` (Railway URL)
4. Deploy

**Railway (backend):**
1. Create new Railway project → Deploy from GitHub → `AllStreets/chicago-explore`
2. Set root directory to `backend`
3. Add all env vars from `backend/.env.example` with real values
4. Railway auto-detects `Procfile` and runs `node server.js`

**Mapbox token security:** Before going public, restrict the token in the Mapbox dashboard to only the Vercel deployment domain. Set a usage alert at $10.

---

## Phase 1 Complete

After Task 15, Phase 1 is deployed and live:
- Home page: 3D Chicago map, live CTA dots, intel feed
- Transit page: All 8 CTA lines, Divvy bike stations
- Food page: Yelp-powered place map with cuisine filters
- All backend routes tested
- Deployed to Vercel + Railway

Phase 2 plan covers: Neighborhoods, Nightlife, Sports, Events, Explore, Weather & Lake, My Chicago, AI briefings.
