# Flexport SDR Intelligence Hub — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Transform the existing HappyRobot Express+React codebase into a Flexport-branded sales intelligence platform with a 3D globe, 150+ prospects, AI analysis, pipeline kanban, and supply chain signal feed.

**Architecture:** Complete rewrite of all prompts, components, and DB schema; existing tech stack (Express 5, React 19, SQLite, Vite 7, Tailwind 4) is kept. New frontend libs (react-globe.gl, recharts, @dnd-kit) added. Backend gains 4 new service files and a fully rewritten server.js.

**Tech Stack:** Node.js/Express 5, SQLite 3, React 19, Vite 7, Tailwind 4, Globe.gl (via react-globe.gl), Recharts, @dnd-kit, OpenAI GPT-4-turbo, NewsAPI, Serper, FRED API

**Working directory:** `/Users/connorevans/Downloads/Flexport-sales-dashboard`

---

## Task 1: Database Schema Migration

**Files:**
- Rewrite: `backend/initDb.js`
- Delete old DB: `backend/analyses.db` (will be recreated)

**Step 1: Write the schema migration script**

Replace `backend/initDb.js` entirely:

```js
const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = process.env.DB_PATH || path.join(__dirname, 'flexport.db');
const db = new sqlite3.Database(dbPath);

db.serialize(() => {
  db.run(`CREATE TABLE IF NOT EXISTS prospects (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    sector TEXT,
    hq_location TEXT,
    estimated_revenue TEXT,
    employee_count TEXT,
    shipping_volume_estimate TEXT,
    import_origins TEXT,
    primary_lanes TEXT,
    icp_score INTEGER,
    likely_forwarder TEXT,
    website TEXT,
    description TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS analyses (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    prospect_id INTEGER REFERENCES prospects(id),
    company_name TEXT NOT NULL,
    profile TEXT,
    pain_points TEXT,
    tech_maturity TEXT,
    outreach_angle TEXT,
    decision_makers TEXT,
    icp_breakdown TEXT,
    flexport_value_props TEXT,
    analysis_data TEXT,
    is_favorite BOOLEAN DEFAULT 0,
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS pipeline (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    prospect_id INTEGER REFERENCES prospects(id),
    company_name TEXT NOT NULL,
    stage TEXT DEFAULT 'new',
    notes TEXT,
    next_action TEXT,
    next_action_date TEXT,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS news_signals (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    headline TEXT NOT NULL,
    summary TEXT,
    url TEXT,
    source TEXT,
    published_at TEXT,
    urgency_score INTEGER,
    urgency_reason TEXT,
    affected_lanes TEXT,
    affected_sectors TEXT,
    cached_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS trade_data_cache (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    series_id TEXT NOT NULL,
    data_json TEXT NOT NULL,
    expires_at DATETIME,
    cached_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`, (err) => {
    if (err) { console.error(err); process.exit(1); }
    console.log('All 5 tables created');
    db.close();
  });
});
```

**Step 2: Remove old DB and run migration**

```bash
cd backend
rm -f analyses.db flexport.db
node initDb.js
```

Expected output: `All 5 tables created`

**Step 3: Commit**

```bash
git add backend/initDb.js
git commit -m "feat: replace single-table schema with 5-table Flexport schema"
```

---

## Task 2: Prospect Seed Data

**Files:**
- Create: `backend/data/seedProspects.js`

**Step 1: Create the seed script**

Create `backend/data/seedProspects.js`:

```js
const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = process.env.DB_PATH || path.join(__dirname, '..', 'flexport.db');
const db = new sqlite3.Database(dbPath);

const prospects = [
  // E-commerce / DTC
  { name: 'Allbirds', sector: 'e-commerce', hq_location: 'San Francisco, CA', estimated_revenue: '$200M-$500M', employee_count: '500-1000', shipping_volume_estimate: 'High', import_origins: JSON.stringify(['China','Vietnam']), primary_lanes: JSON.stringify(['Asia-US West Coast']), icp_score: 85, likely_forwarder: 'Flexport (existing)', website: 'allbirds.com', description: 'Sustainable footwear brand with heavy Asia sourcing and complex multi-lane import operations.' },
  { name: 'Gymshark', sector: 'e-commerce', hq_location: 'Birmingham, UK (US ops Chicago)', estimated_revenue: '$500M+', employee_count: '1000+', shipping_volume_estimate: 'Very High', import_origins: JSON.stringify(['China','Bangladesh','Vietnam']), primary_lanes: JSON.stringify(['Asia-US West Coast','Asia-US East Coast']), icp_score: 88, likely_forwarder: 'C.H. Robinson', website: 'gymshark.com', description: 'Fast-growing UK-origin DTC activewear brand with massive US import volume across multiple Asian factories.' },
  { name: 'Away', sector: 'e-commerce', hq_location: 'New York, NY', estimated_revenue: '$100M-$200M', employee_count: '200-500', shipping_volume_estimate: 'High', import_origins: JSON.stringify(['China','Vietnam']), primary_lanes: JSON.stringify(['Asia-US West Coast']), icp_score: 82, likely_forwarder: 'Flexport (existing)', website: 'awaytravel.com', description: 'DTC luggage brand importing finished goods from Asia with seasonal peak shipping complexity.' },
  { name: 'Warby Parker', sector: 'e-commerce', hq_location: 'New York, NY', estimated_revenue: '$500M+', employee_count: '1000+', shipping_volume_estimate: 'High', import_origins: JSON.stringify(['China','Italy']), primary_lanes: JSON.stringify(['Asia-US East Coast','Europe-US East Coast']), icp_score: 80, likely_forwarder: 'DHL Global Forwarding', website: 'warbyparker.com', description: 'Eyewear DTC brand with complex multi-origin imports from Asia and European luxury supply chains.' },
  { name: 'Glossier', sector: 'beauty', hq_location: 'New York, NY', estimated_revenue: '$100M-$200M', employee_count: '200-500', shipping_volume_estimate: 'Medium', import_origins: JSON.stringify(['South Korea','China']), primary_lanes: JSON.stringify(['Asia-US West Coast']), icp_score: 76, likely_forwarder: 'Flexport (existing)', website: 'glossier.com', description: 'Beauty DTC brand with growing Asian manufacturing base and complex SKU management requirements.' },
  { name: 'Bombas', sector: 'e-commerce', hq_location: 'New York, NY', estimated_revenue: '$100M-$200M', employee_count: '200-500', shipping_volume_estimate: 'High', import_origins: JSON.stringify(['China','Vietnam']), primary_lanes: JSON.stringify(['Asia-US East Coast']), icp_score: 82, likely_forwarder: 'Forto', website: 'bombas.com', description: 'Mission-driven apparel brand with sock and apparel imports scaling rapidly from Southeast Asia.' },
  { name: 'Everlane', sector: 'e-commerce', hq_location: 'San Francisco, CA', estimated_revenue: '$100M-$200M', employee_count: '200-500', shipping_volume_estimate: 'High', import_origins: JSON.stringify(['Vietnam','China','Portugal']), primary_lanes: JSON.stringify(['Asia-US West Coast','Europe-US East Coast']), icp_score: 85, likely_forwarder: 'Flexport (existing)', website: 'everlane.com', description: 'Radical transparency apparel brand with multi-country manufacturing requiring full shipment visibility.' },
  { name: 'Vuori', sector: 'e-commerce', hq_location: 'Encinitas, CA', estimated_revenue: '$100M-$500M', employee_count: '200-500', shipping_volume_estimate: 'High', import_origins: JSON.stringify(['China','Vietnam']), primary_lanes: JSON.stringify(['Asia-US West Coast']), icp_score: 87, likely_forwarder: 'C.H. Robinson', website: 'vuoriclothing.com', description: 'Premium activewear brand scaling rapidly with heavy West Coast port dependency and complex seasonal cadence.' },
  { name: 'Ridge Wallet', sector: 'e-commerce', hq_location: 'Los Angeles, CA', estimated_revenue: '$50M-$100M', employee_count: '50-200', shipping_volume_estimate: 'Medium', import_origins: JSON.stringify(['China']), primary_lanes: JSON.stringify(['Asia-US West Coast']), icp_score: 79, likely_forwarder: 'Freightos', website: 'ridge.com', description: 'Hardware accessories brand with China-sourced metal goods and growing product line complexity.' },
  { name: 'Cotopaxi', sector: 'e-commerce', hq_location: 'Salt Lake City, UT', estimated_revenue: '$50M-$200M', employee_count: '100-300', shipping_volume_estimate: 'Medium', import_origins: JSON.stringify(['Philippines','Vietnam','Cambodia']), primary_lanes: JSON.stringify(['Asia-US West Coast']), icp_score: 84, likely_forwarder: 'Flexport (existing)', website: 'cotopaxi.com', description: 'Outdoor gear brand with unique multi-country SE Asian manufacturing and social impact supply chain.' },

  // CPG / Consumer Goods
  { name: 'Liquid Death', sector: 'CPG', hq_location: 'Los Angeles, CA', estimated_revenue: '$50M-$200M', employee_count: '100-300', shipping_volume_estimate: 'Medium', import_origins: JSON.stringify(['Austria']), primary_lanes: JSON.stringify(['Europe-US East Coast']), icp_score: 65, likely_forwarder: 'Flexport (existing)', website: 'liquiddeath.com', description: 'Beverage brand importing canned water from Austrian source with growing US distribution complexity.' },
  { name: 'Oatly', sector: 'CPG', hq_location: 'New York, NY (Swedish origin)', estimated_revenue: '$100M-$500M', employee_count: '500-1000', shipping_volume_estimate: 'High', import_origins: JSON.stringify(['Sweden','Netherlands','Singapore']), primary_lanes: JSON.stringify(['Europe-US East Coast','Asia-US West Coast']), icp_score: 72, likely_forwarder: 'DHL Global Forwarding', website: 'oatly.com', description: 'Plant-based dairy brand with complex multi-continent manufacturing and cold chain logistics requirements.' },
  { name: 'Fishwife', sector: 'CPG', hq_location: 'Los Angeles, CA', estimated_revenue: '$10M-$50M', employee_count: '10-50', shipping_volume_estimate: 'Low', import_origins: JSON.stringify(['Spain','Portugal','Chile']), primary_lanes: JSON.stringify(['Europe-US East Coast']), icp_score: 62, likely_forwarder: 'Flexport (existing)', website: 'eatfishwife.com', description: 'Tinned seafood startup importing artisan canned fish from European producers with customs complexity.' },
  { name: 'Graza', sector: 'CPG', hq_location: 'New York, NY', estimated_revenue: '$10M-$50M', employee_count: '10-50', shipping_volume_estimate: 'Low', import_origins: JSON.stringify(['Spain']), primary_lanes: JSON.stringify(['Europe-US East Coast']), icp_score: 64, likely_forwarder: 'Flexport (existing)', website: 'graza.co', description: 'DTC olive oil brand importing from Spanish producers — high customs scrutiny, agricultural import compliance.' },
  { name: 'Chomps', sector: 'CPG', hq_location: 'Chicago, IL', estimated_revenue: '$50M-$100M', employee_count: '50-100', shipping_volume_estimate: 'Medium', import_origins: JSON.stringify(['New Zealand','Uruguay']), primary_lanes: JSON.stringify(['Pacific-US West Coast','South America-US East Coast']), icp_score: 68, likely_forwarder: 'C.H. Robinson', website: 'chomps.com', description: 'Grass-fed meat snack brand importing from Southern Hemisphere with complex protein cold chain needs.' },

  // Electronics / Hardware
  { name: 'Anker Innovations', sector: 'electronics', hq_location: 'Palo Alto, CA', estimated_revenue: '$1B+', employee_count: '1000+', shipping_volume_estimate: 'Very High', import_origins: JSON.stringify(['China']), primary_lanes: JSON.stringify(['Asia-US West Coast','Asia-US East Coast']), icp_score: 92, likely_forwarder: 'Flexport (existing)', website: 'anker.com', description: 'Electronics brand with massive China import volumes, complex SKU count, and precision customs classification needs.' },
  { name: 'Peak Design', sector: 'electronics', hq_location: 'San Francisco, CA', estimated_revenue: '$50M-$100M', employee_count: '50-200', shipping_volume_estimate: 'Medium', import_origins: JSON.stringify(['China','Vietnam']), primary_lanes: JSON.stringify(['Asia-US West Coast']), icp_score: 88, likely_forwarder: 'Flexport (existing)', website: 'peakdesign.com', description: 'Camera accessories brand with Kickstarter roots and complex international pre-order fulfillment logistics.' },
  { name: 'Jackery', sector: 'electronics', hq_location: 'Fremont, CA', estimated_revenue: '$100M-$500M', employee_count: '200-500', shipping_volume_estimate: 'Very High', import_origins: JSON.stringify(['China']), primary_lanes: JSON.stringify(['Asia-US West Coast']), icp_score: 90, likely_forwarder: 'Forto', website: 'jackery.com', description: 'Portable power station brand with explosive growth, heavy battery import regulations, and hazmat compliance needs.' },
  { name: 'Govee', sector: 'electronics', hq_location: 'Fremont, CA', estimated_revenue: '$100M-$500M', employee_count: '200-500', shipping_volume_estimate: 'High', import_origins: JSON.stringify(['China']), primary_lanes: JSON.stringify(['Asia-US West Coast']), icp_score: 91, likely_forwarder: 'Flexport (existing)', website: 'govee.com', description: 'Smart home lighting brand with China-direct operations and rapid SKU expansion creating customs complexity.' },
  { name: 'Wyze Labs', sector: 'electronics', hq_location: 'Kirkland, WA', estimated_revenue: '$50M-$200M', employee_count: '100-300', shipping_volume_estimate: 'High', import_origins: JSON.stringify(['China']), primary_lanes: JSON.stringify(['Asia-US West Coast']), icp_score: 89, likely_forwarder: 'C.H. Robinson', website: 'wyze.com', description: 'Smart home device brand with high-volume China imports and electronics tariff exposure under Section 301.' },

  // Furniture / Home
  { name: 'Article', sector: 'furniture', hq_location: 'Vancouver, BC (US-focused)', estimated_revenue: '$100M-$500M', employee_count: '200-500', shipping_volume_estimate: 'High', import_origins: JSON.stringify(['China','Vietnam','Malaysia']), primary_lanes: JSON.stringify(['Asia-US West Coast']), icp_score: 85, likely_forwarder: 'Flexport (existing)', website: 'article.com', description: 'Online furniture brand with heavy-volume Asia sourcing and complex LTL last-mile coordination from ports.' },
  { name: 'Floyd', sector: 'furniture', hq_location: 'Detroit, MI', estimated_revenue: '$10M-$50M', employee_count: '10-100', shipping_volume_estimate: 'Medium', import_origins: JSON.stringify(['China','Vietnam']), primary_lanes: JSON.stringify(['Asia-US East Coast']), icp_score: 82, likely_forwarder: 'Freightos', website: 'floydhome.com', description: 'Modular furniture startup with Asia manufacturing and growing volume needing supply chain visibility.' },
  { name: 'Burrow', sector: 'furniture', hq_location: 'New York, NY', estimated_revenue: '$50M-$100M', employee_count: '50-200', shipping_volume_estimate: 'Medium', import_origins: JSON.stringify(['China','Vietnam']), primary_lanes: JSON.stringify(['Asia-US East Coast']), icp_score: 83, likely_forwarder: 'Flexport (existing)', website: 'burrow.com', description: 'DTC sofa brand with modular furniture imports and complex port-to-warehouse delivery coordination.' },
  { name: 'Parachute Home', sector: 'home-textiles', hq_location: 'Culver City, CA', estimated_revenue: '$100M-$200M', employee_count: '100-300', shipping_volume_estimate: 'High', import_origins: JSON.stringify(['Portugal','India','Turkey']), primary_lanes: JSON.stringify(['Europe-US East Coast','India-US East Coast']), icp_score: 84, likely_forwarder: 'DHL Global Forwarding', website: 'parachutehome.com', description: 'Premium bedding brand with European and Indian sourcing requiring multi-origin consolidation expertise.' },
  { name: 'Brooklinen', sector: 'home-textiles', hq_location: 'Brooklyn, NY', estimated_revenue: '$100M-$200M', employee_count: '100-300', shipping_volume_estimate: 'High', import_origins: JSON.stringify(['Portugal','China','India']), primary_lanes: JSON.stringify(['Europe-US East Coast','Asia-US East Coast']), icp_score: 83, likely_forwarder: 'Flexport (existing)', website: 'brooklinen.com', description: 'Luxury bedding DTC brand with complex multi-origin sourcing and seasonal peak shipping requirements.' },

  // Beauty / Personal Care
  { name: 'Function of Beauty', sector: 'beauty', hq_location: 'New York, NY', estimated_revenue: '$50M-$200M', employee_count: '100-300', shipping_volume_estimate: 'Medium', import_origins: JSON.stringify(['South Korea','China']), primary_lanes: JSON.stringify(['Asia-US West Coast']), icp_score: 68, likely_forwarder: 'Flexport (existing)', website: 'functionofbeauty.com', description: 'Personalized beauty brand with Korean ingredient sourcing and complex formulation import compliance.' },
  { name: 'Hero Cosmetics', sector: 'beauty', hq_location: 'New York, NY', estimated_revenue: '$50M-$100M', employee_count: '50-200', shipping_volume_estimate: 'Medium', import_origins: JSON.stringify(['South Korea']), primary_lanes: JSON.stringify(['Asia-US West Coast']), icp_score: 70, likely_forwarder: 'C.H. Robinson', website: 'herocosmetics.us', description: 'Korean skincare-inspired brand with single-origin Seoul manufacturing and FDA cosmetics import complexity.' },
  { name: 'Glow Recipe', sector: 'beauty', hq_location: 'New York, NY', estimated_revenue: '$50M-$100M', employee_count: '50-200', shipping_volume_estimate: 'Medium', import_origins: JSON.stringify(['South Korea']), primary_lanes: JSON.stringify(['Asia-US West Coast']), icp_score: 71, likely_forwarder: 'Flexport (existing)', website: 'glowrecipe.com', description: 'K-beauty brand with entirely South Korean manufacturing and complex cosmetic ingredient import documentation.' },

  // Mid-Market Importers
  { name: 'Mejuri', sector: 'jewelry', hq_location: 'Toronto, ON (US-focused)', estimated_revenue: '$100M-$200M', employee_count: '200-500', shipping_volume_estimate: 'Medium', import_origins: JSON.stringify(['India','Italy','Thailand']), primary_lanes: JSON.stringify(['Europe-US East Coast','India-US']), icp_score: 72, likely_forwarder: 'DHL Global Forwarding', website: 'mejuri.com', description: 'Fine jewelry brand with multi-country precious metal sourcing and strict customs valuation requirements.' },
  { name: 'Faherty', sector: 'apparel', hq_location: 'New York, NY', estimated_revenue: '$50M-$100M', employee_count: '100-300', shipping_volume_estimate: 'Medium', import_origins: JSON.stringify(['India','Portugal','Peru']), primary_lanes: JSON.stringify(['Europe-US East Coast','India-US']), icp_score: 81, likely_forwarder: 'Flexport (existing)', website: 'fahertybrand.com', description: 'Lifestyle apparel brand with multi-continent ethical sourcing and complex textile tariff classification.' },
  { name: 'Marine Layer', sector: 'apparel', hq_location: 'San Francisco, CA', estimated_revenue: '$50M-$100M', employee_count: '100-300', shipping_volume_estimate: 'Medium', import_origins: JSON.stringify(['China','Peru']), primary_lanes: JSON.stringify(['Asia-US West Coast','South America-US East Coast']), icp_score: 80, likely_forwarder: 'Flexport (existing)', website: 'marinelayer.com', description: 'Sustainable apparel brand with regenerative cotton sourcing from Peru and finished goods from China.' },
  { name: 'Thursday Boot', sector: 'footwear', hq_location: 'New York, NY', estimated_revenue: '$50M-$100M', employee_count: '50-200', shipping_volume_estimate: 'Medium', import_origins: JSON.stringify(['Mexico','India']), primary_lanes: JSON.stringify(['Mexico-US','India-US']), icp_score: 79, likely_forwarder: 'Flexport (existing)', website: 'thursdayboots.com', description: 'Premium boots brand with North American and Indian leather sourcing and USMCA duty optimization opportunity.' },
  { name: 'Outdoor Voices', sector: 'apparel', hq_location: 'Austin, TX', estimated_revenue: '$50M-$100M', employee_count: '100-300', shipping_volume_estimate: 'Medium', import_origins: JSON.stringify(['China','Vietnam']), primary_lanes: JSON.stringify(['Asia-US West Coast']), icp_score: 82, likely_forwarder: 'Forto', website: 'outdoorvoices.com', description: 'Activewear brand rebuilding after downsizing with renewed focus on supply chain efficiency and cost reduction.' },
  { name: "Rothy's", sector: 'footwear', hq_location: 'San Francisco, CA', estimated_revenue: '$50M-$100M', employee_count: '200-500', shipping_volume_estimate: 'High', import_origins: JSON.stringify(['China']), primary_lanes: JSON.stringify(['Asia-US West Coast']), icp_score: 82, likely_forwarder: 'Flexport (existing)', website: 'rothys.com', description: 'Sustainable footwear brand with China-based recycled plastic manufacturing and growing volume complexity.' },
  { name: 'Public Goods', sector: 'CPG', hq_location: 'New York, NY', estimated_revenue: '$10M-$50M', employee_count: '50-100', shipping_volume_estimate: 'Medium', import_origins: JSON.stringify(['China','Vietnam','India']), primary_lanes: JSON.stringify(['Asia-US West Coast','Asia-US East Coast']), icp_score: 76, likely_forwarder: 'Flexport (existing)', website: 'publicgoods.com', description: 'Membership-based essentials brand with multi-category Asian sourcing requiring consolidated shipment management.' },
  { name: 'Pura Vida', sector: 'jewelry', hq_location: 'La Jolla, CA', estimated_revenue: '$50M-$100M', employee_count: '100-300', shipping_volume_estimate: 'Medium', import_origins: JSON.stringify(['Costa Rica','China']), primary_lanes: JSON.stringify(['Central America-US','Asia-US West Coast']), icp_score: 74, likely_forwarder: 'C.H. Robinson', website: 'puravidabracelets.com', description: 'Handmade accessories brand with artisan sourcing from Costa Rica and manufactured goods from China.' },
  { name: 'Saatva', sector: 'furniture', hq_location: 'New York, NY', estimated_revenue: '$100M-$500M', employee_count: '500-1000', shipping_volume_estimate: 'High', import_origins: JSON.stringify(['China','Vietnam']), primary_lanes: JSON.stringify(['Asia-US East Coast']), icp_score: 77, likely_forwarder: 'Flexport (existing)', website: 'saatva.com', description: 'Luxury mattress brand with mixed domestic and imported component sourcing and white-glove delivery requirements.' },
  { name: 'Interior Define', sector: 'furniture', hq_location: 'Chicago, IL', estimated_revenue: '$50M-$100M', employee_count: '100-300', shipping_volume_estimate: 'High', import_origins: JSON.stringify(['China','Vietnam']), primary_lanes: JSON.stringify(['Asia-US West Coast']), icp_score: 83, likely_forwarder: 'Flexport (existing)', website: 'interiordefine.com', description: 'Custom furniture brand with Asia manufacturing and SKU-level production tracking across multiple factories.' },
  { name: 'Cuyana', sector: 'apparel', hq_location: 'San Francisco, CA', estimated_revenue: '$50M-$100M', employee_count: '100-300', shipping_volume_estimate: 'Medium', import_origins: JSON.stringify(['Italy','Peru','Argentina']), primary_lanes: JSON.stringify(['Europe-US East Coast','South America-US East Coast']), icp_score: 77, likely_forwarder: 'DHL Global Forwarding', website: 'cuyana.com', description: 'Fewer, better things brand with luxury European and South American sourcing and artisan import compliance needs.' },
  { name: 'Medley', sector: 'furniture', hq_location: 'Los Angeles, CA', estimated_revenue: '$10M-$50M', employee_count: '10-50', shipping_volume_estimate: 'Low', import_origins: JSON.stringify(['China','Vietnam']), primary_lanes: JSON.stringify(['Asia-US West Coast']), icp_score: 80, likely_forwarder: 'Freightos', website: 'medleyhome.com', description: 'Custom furniture startup growing rapidly with Asia sourcing and need for shipment milestone visibility.' }
];

const stmt = db.prepare(`INSERT INTO prospects
  (name, sector, hq_location, estimated_revenue, employee_count, shipping_volume_estimate,
   import_origins, primary_lanes, icp_score, likely_forwarder, website, description)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`);

db.serialize(() => {
  prospects.forEach(p => {
    stmt.run(p.name, p.sector, p.hq_location, p.estimated_revenue, p.employee_count,
      p.shipping_volume_estimate, p.import_origins, p.primary_lanes, p.icp_score,
      p.likely_forwarder, p.website, p.description);
  });
  stmt.finalize(() => {
    console.log(`Seeded ${prospects.length} prospects`);
    db.close();
  });
});
```

**Step 2: Run seed script**

```bash
cd backend
node data/seedProspects.js
```

Expected: `Seeded 45 prospects`

**Step 3: Verify data**

```bash
sqlite3 flexport.db "SELECT COUNT(*) FROM prospects; SELECT name, icp_score FROM prospects ORDER BY icp_score DESC LIMIT 5;"
```

Expected: `45` then top 5 by ICP score

**Step 4: Commit**

```bash
git add backend/data/seedProspects.js backend/initDb.js
git commit -m "feat: add 45-prospect seed database with ICP scores and trade lane metadata"
```
## Task 3: Backend Service Layer

**Files:**
- Create: `backend/services/prospectsService.js`
- Rewrite: `backend/services/database.js` (extend for all 5 tables)
- Create: `backend/services/flexportAnalyzer.js` (replaces claudeSynthesizer.js)
- Create: `backend/services/signalsService.js`
- Create: `backend/services/fredService.js`
- Create: `backend/services/pipelineService.js`

**Step 1: Create prospectsService.js**

```js
// backend/services/prospectsService.js
const sqlite3 = require('sqlite3').verbose();
const path = require('path');

function getDb() {
  return new sqlite3.Database(process.env.DB_PATH || path.join(__dirname, '..', 'flexport.db'));
}

function getProspects({ sector, icp_min, lane, search, limit = 50, offset = 0 } = {}) {
  return new Promise((resolve, reject) => {
    const db = getDb();
    let query = 'SELECT * FROM prospects WHERE 1=1';
    const params = [];
    if (sector) { query += ' AND sector = ?'; params.push(sector); }
    if (icp_min) { query += ' AND icp_score >= ?'; params.push(parseInt(icp_min)); }
    if (lane) { query += ' AND primary_lanes LIKE ?'; params.push(`%${lane}%`); }
    if (search) { query += ' AND (name LIKE ? OR description LIKE ?)'; params.push(`%${search}%`, `%${search}%`); }
    query += ' ORDER BY icp_score DESC LIMIT ? OFFSET ?';
    params.push(parseInt(limit), parseInt(offset));
    db.all(query, params, (err, rows) => {
      db.close();
      if (err) return reject(err);
      resolve(rows.map(r => ({
        ...r,
        import_origins: JSON.parse(r.import_origins || '[]'),
        primary_lanes: JSON.parse(r.primary_lanes || '[]')
      })));
    });
  });
}

function getProspectById(id) {
  return new Promise((resolve, reject) => {
    const db = getDb();
    db.get('SELECT * FROM prospects WHERE id = ?', [id], (err, row) => {
      db.close();
      if (err) return reject(err);
      if (!row) return reject(new Error('Prospect not found'));
      resolve({ ...row, import_origins: JSON.parse(row.import_origins || '[]'), primary_lanes: JSON.parse(row.primary_lanes || '[]') });
    });
  });
}

function getSectors() {
  return new Promise((resolve, reject) => {
    const db = getDb();
    db.all('SELECT sector, COUNT(*) as count FROM prospects GROUP BY sector ORDER BY count DESC', [], (err, rows) => {
      db.close();
      if (err) return reject(err);
      resolve(rows);
    });
  });
}

module.exports = { getProspects, getProspectById, getSectors };
```

**Step 2: Rewrite database.js for analyses table**

```js
// backend/services/database.js
const sqlite3 = require('sqlite3').verbose();
const path = require('path');

function getDb() {
  return new sqlite3.Database(process.env.DB_PATH || path.join(__dirname, '..', 'flexport.db'));
}

function saveAnalysis(prospectId, companyName, analysisData) {
  return new Promise((resolve, reject) => {
    const db = getDb();
    const { profile, pain_points, tech_maturity, outreach_angle, decision_makers, icp_breakdown, flexport_value_props } = analysisData;
    db.run(
      `INSERT INTO analyses (prospect_id, company_name, profile, pain_points, tech_maturity, outreach_angle, decision_makers, icp_breakdown, flexport_value_props, analysis_data)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [prospectId || null, companyName,
       profile, JSON.stringify(pain_points), tech_maturity, outreach_angle,
       JSON.stringify(decision_makers), JSON.stringify(icp_breakdown),
       JSON.stringify(flexport_value_props), JSON.stringify(analysisData)],
      function(err) {
        db.close();
        if (err) return reject(err);
        resolve({ id: this.lastID, company_name: companyName });
      }
    );
  });
}

function getAllAnalyses() {
  return new Promise((resolve, reject) => {
    const db = getDb();
    db.all('SELECT * FROM analyses ORDER BY timestamp DESC', [], (err, rows) => {
      db.close();
      if (err) return reject(err);
      resolve(rows.map(parseAnalysisRow));
    });
  });
}

function toggleFavorite(id, isFavorite) {
  return new Promise((resolve, reject) => {
    const db = getDb();
    db.run('UPDATE analyses SET is_favorite = ? WHERE id = ?', [isFavorite ? 1 : 0, id], function(err) {
      db.close();
      if (err) return reject(err);
      if (this.changes === 0) return reject(new Error('Analysis not found'));
      resolve({ id, is_favorite: isFavorite });
    });
  });
}

function deleteAnalysis(id) {
  return new Promise((resolve, reject) => {
    const db = getDb();
    db.run('DELETE FROM analyses WHERE id = ?', [id], function(err) {
      db.close();
      if (err) return reject(err);
      if (this.changes === 0) return reject(new Error('Analysis not found'));
      resolve({ deleted: id });
    });
  });
}

function parseAnalysisRow(row) {
  return {
    ...row,
    pain_points: tryParse(row.pain_points, []),
    decision_makers: tryParse(row.decision_makers, []),
    icp_breakdown: tryParse(row.icp_breakdown, {}),
    flexport_value_props: tryParse(row.flexport_value_props, []),
    analysis_data: tryParse(row.analysis_data, {})
  };
}

function tryParse(str, fallback) {
  try { return JSON.parse(str); } catch { return fallback; }
}

module.exports = { saveAnalysis, getAllAnalyses, toggleFavorite, deleteAnalysis };
```

**Step 3: Create flexportAnalyzer.js**

```js
// backend/services/flexportAnalyzer.js
const axios = require('axios');
const OPENAI_URL = 'https://api.openai.com/v1/chat/completions';

async function analyzeForFlexport(companyName, prospectData, newsHeadlines, searchResults) {
  const system = `You are a Flexport sales intelligence analyst. Flexport is a global freight forwarder and logistics platform offering: real-time shipment visibility, customs clearance, duty deferral, bonded warehouses, and ocean/air/trucking coordination. Your role is to help SDRs understand import-dependent companies and craft compelling Flexport outreach.`;

  const user = `Analyze this company as a Flexport inbound sales prospect:

Company: ${companyName}
${prospectData ? `Sector: ${prospectData.sector} | Revenue: ${prospectData.estimated_revenue} | Import Origins: ${prospectData.import_origins?.join(', ')} | Shipping Lanes: ${prospectData.primary_lanes?.join(', ')} | Current Forwarder: ${prospectData.likely_forwarder}` : ''}

Recent Supply Chain News:
${newsHeadlines?.map(n => `- ${n}`).join('\n') || 'No recent news'}

Search Context:
${searchResults?.map(r => `- ${r.title}: ${r.snippet}`).join('\n') || 'Limited data'}

Return JSON with exactly these fields:
{
  "profile": "2-3 sentence overview: what they import, from where, how it relates to their business model",
  "pain_points": ["Supply chain pain specific to their business", "Customs/compliance challenge", "Visibility or cost pain point"],
  "tech_maturity": "1-2 sentences on their logistics tech sophistication — are they using a TMS, manual tracking, etc.",
  "outreach_angle": "Specific 1-2 sentence Flexport pitch referencing their actual lanes and pain points. Reference real Flexport value props.",
  "decision_makers": [
    {"title": "VP Supply Chain or Head of Operations", "concerns": ["Specific concern 1", "Specific concern 2"]},
    {"title": "CFO or Finance Lead", "concerns": ["Duty cost concern", "Freight spend visibility"]}
  ],
  "icp_breakdown": {
    "fit_score": 85,
    "reasoning": "Why this company is a strong Flexport ICP fit",
    "key_signals": ["Signal 1", "Signal 2", "Signal 3"]
  },
  "flexport_value_props": ["Most relevant Flexport feature for this company", "Second most relevant"]
}`;

  const response = await axios.post(OPENAI_URL, {
    model: 'gpt-4-turbo',
    max_tokens: 800,
    messages: [{ role: 'system', content: system }, { role: 'user', content: user }]
  }, { headers: { 'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`, 'Content-Type': 'application/json' } });

  const content = response.data.choices[0].message.content;
  const match = content.match(/\{[\s\S]*\}/);
  if (!match) throw new Error('Could not parse analysis JSON');
  return JSON.parse(match[0]);
}

module.exports = { analyzeForFlexport };
```

**Step 4: Create signalsService.js**

```js
// backend/services/signalsService.js
const axios = require('axios');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const OPENAI_URL = 'https://api.openai.com/v1/chat/completions';

function getDb() {
  return new sqlite3.Database(process.env.DB_PATH || path.join(__dirname, '..', 'flexport.db'));
}

async function fetchAndScoreSignals() {
  // Check cache (1 hour TTL)
  const cached = await getCachedSignals();
  if (cached.length > 0) return cached;

  const q = 'supply chain freight logistics tariff port disruption shipping';
  const newsRes = await axios.get('https://newsapi.org/v2/everything', {
    params: { q, language: 'en', sortBy: 'publishedAt', pageSize: 20, apiKey: process.env.NEWS_API_KEY }
  });

  const articles = newsRes.data.articles || [];
  if (articles.length === 0) return [];

  // Score urgency with OpenAI
  const scorePrompt = `You are scoring news articles for urgency to a Flexport inbound SDR. Rate each from 1-10 where 10 = "call prospects now".

Articles:
${articles.map((a, i) => `${i + 1}. ${a.title}`).join('\n')}

Return a JSON array (same order as input):
[{"urgency_score": 8, "urgency_reason": "Port congestion on Asia-US West Coast affects electronics importers", "affected_lanes": ["Asia-US West Coast"], "affected_sectors": ["electronics","e-commerce"]}]`;

  const scoreRes = await axios.post(OPENAI_URL, {
    model: 'gpt-4-turbo', max_tokens: 1000,
    messages: [{ role: 'user', content: scorePrompt }]
  }, { headers: { 'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`, 'Content-Type': 'application/json' } });

  let scores = [];
  try {
    const m = scoreRes.data.choices[0].message.content.match(/\[[\s\S]*\]/);
    scores = m ? JSON.parse(m[0]) : [];
  } catch { scores = []; }

  const db = getDb();
  // Clear old signals, insert new
  await new Promise(r => db.run('DELETE FROM news_signals', r));
  const stmt = db.prepare(`INSERT INTO news_signals (headline, summary, url, source, published_at, urgency_score, urgency_reason, affected_lanes, affected_sectors) VALUES (?,?,?,?,?,?,?,?,?)`);

  const signals = articles.map((a, i) => {
    const score = scores[i] || { urgency_score: 5, urgency_reason: 'General supply chain news', affected_lanes: [], affected_sectors: [] };
    stmt.run(a.title, a.description, a.url, a.source?.name, a.publishedAt,
      score.urgency_score, score.urgency_reason,
      JSON.stringify(score.affected_lanes || []), JSON.stringify(score.affected_sectors || []));
    return { ...a, ...score };
  });

  stmt.finalize();
  db.close();
  return signals;
}

async function getCachedSignals() {
  return new Promise((resolve) => {
    const db = getDb();
    db.all(`SELECT * FROM news_signals WHERE cached_at > datetime('now', '-1 hour') ORDER BY urgency_score DESC`, [], (err, rows) => {
      db.close();
      if (err || !rows) return resolve([]);
      resolve(rows.map(r => ({ ...r, affected_lanes: JSON.parse(r.affected_lanes || '[]'), affected_sectors: JSON.parse(r.affected_sectors || '[]') })));
    });
  });
}

module.exports = { fetchAndScoreSignals };
```

**Step 5: Create fredService.js**

```js
// backend/services/fredService.js
const axios = require('axios');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');

function getDb() {
  return new sqlite3.Database(process.env.DB_PATH || path.join(__dirname, '..', 'flexport.db'));
}

const FRED_SERIES = {
  electronics: 'IMPE',        // Imports: Capital Goods except Automotive
  apparel: 'IMPCNS',          // Imports: Consumer Goods
  trade_balance: 'BOPGSTB',   // Trade Balance: Goods
  total_imports: 'IMPGS'      // Imports of Goods and Services
};

async function getTradeData(commodity) {
  const seriesId = FRED_SERIES[commodity] || FRED_SERIES.total_imports;

  // Check cache (7 day TTL)
  const cached = await getCached(seriesId);
  if (cached) return cached;

  const res = await axios.get('https://api.stlouisfed.org/fred/series/observations', {
    params: { series_id: seriesId, api_key: process.env.FRED_API_KEY, file_type: 'json', limit: 24, sort_order: 'desc' }
  });

  const data = res.data;
  await cacheData(seriesId, data);
  return data;
}

function getCached(seriesId) {
  return new Promise((resolve) => {
    const db = getDb();
    db.get(`SELECT data_json FROM trade_data_cache WHERE series_id = ? AND expires_at > datetime('now')`, [seriesId], (err, row) => {
      db.close();
      if (err || !row) return resolve(null);
      try { resolve(JSON.parse(row.data_json)); } catch { resolve(null); }
    });
  });
}

function cacheData(seriesId, data) {
  return new Promise((resolve) => {
    const db = getDb();
    db.run(`INSERT OR REPLACE INTO trade_data_cache (series_id, data_json, expires_at) VALUES (?, ?, datetime('now', '+7 days'))`,
      [seriesId, JSON.stringify(data)], () => { db.close(); resolve(); });
  });
}

module.exports = { getTradeData, FRED_SERIES };
```

**Step 6: Create pipelineService.js**

```js
// backend/services/pipelineService.js
const sqlite3 = require('sqlite3').verbose();
const path = require('path');

function getDb() {
  return new sqlite3.Database(process.env.DB_PATH || path.join(__dirname, '..', 'flexport.db'));
}

const VALID_STAGES = ['new', 'researched', 'called', 'demo_booked', 'closed_won', 'closed_lost'];

function getPipeline() {
  return new Promise((resolve, reject) => {
    const db = getDb();
    db.all('SELECT p.*, pr.icp_score, pr.sector, pr.hq_location FROM pipeline p LEFT JOIN prospects pr ON p.prospect_id = pr.id ORDER BY p.updated_at DESC', [], (err, rows) => {
      db.close();
      if (err) return reject(err);
      // Group by stage
      const grouped = Object.fromEntries(VALID_STAGES.map(s => [s, []]));
      rows.forEach(r => { if (grouped[r.stage]) grouped[r.stage].push(r); });
      resolve(grouped);
    });
  });
}

function addToPipeline({ prospect_id, company_name, stage = 'new', notes, next_action, next_action_date }) {
  return new Promise((resolve, reject) => {
    const db = getDb();
    db.run(`INSERT INTO pipeline (prospect_id, company_name, stage, notes, next_action, next_action_date) VALUES (?,?,?,?,?,?)`,
      [prospect_id, company_name, stage, notes, next_action, next_action_date],
      function(err) { db.close(); if (err) return reject(err); resolve({ id: this.lastID, company_name, stage }); }
    );
  });
}

function updatePipeline(id, { stage, notes, next_action, next_action_date }) {
  return new Promise((resolve, reject) => {
    if (stage && !VALID_STAGES.includes(stage)) return reject(new Error(`Invalid stage: ${stage}`));
    const db = getDb();
    db.run(`UPDATE pipeline SET stage=COALESCE(?,stage), notes=COALESCE(?,notes), next_action=COALESCE(?,next_action), next_action_date=COALESCE(?,next_action_date), updated_at=CURRENT_TIMESTAMP WHERE id=?`,
      [stage, notes, next_action, next_action_date, id],
      function(err) { db.close(); if (err) return reject(err); if (this.changes === 0) return reject(new Error('Not found')); resolve({ id, stage }); }
    );
  });
}

function removeFromPipeline(id) {
  return new Promise((resolve, reject) => {
    const db = getDb();
    db.run('DELETE FROM pipeline WHERE id = ?', [id], function(err) {
      db.close(); if (err) return reject(err); if (this.changes === 0) return reject(new Error('Not found')); resolve({ deleted: id });
    });
  });
}

module.exports = { getPipeline, addToPipeline, updatePipeline, removeFromPipeline };
```

**Step 7: Commit services**

```bash
git add backend/services/
git commit -m "feat: add Flexport service layer (analyzer, signals, FRED, pipeline, prospects)"
```

---

## Task 4: Backend API Rewrite

**Files:**
- Rewrite: `backend/server.js`
- Add test deps: `backend/package.json`

**Step 1: Install test dependencies**

```bash
cd backend && npm install --save-dev jest supertest
```

Add to `backend/package.json` scripts:
```json
"test": "jest --testPathPattern=tests/"
```

**Step 2: Write API tests**

Create `backend/tests/api.test.js`:

```js
const request = require('supertest');
const app = require('../server');

describe('Prospects API', () => {
  test('GET /api/prospects returns array', async () => {
    const res = await request(app).get('/api/prospects');
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.length).toBeGreaterThan(0);
  });

  test('GET /api/prospects?icp_min=85 filters by ICP', async () => {
    const res = await request(app).get('/api/prospects?icp_min=85');
    expect(res.status).toBe(200);
    res.body.forEach(p => expect(p.icp_score).toBeGreaterThanOrEqual(85));
  });

  test('GET /api/prospects/:id returns single prospect', async () => {
    const res = await request(app).get('/api/prospects/1');
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('name');
    expect(res.body).toHaveProperty('icp_score');
  });

  test('GET /api/prospects/sectors returns sector counts', async () => {
    const res = await request(app).get('/api/prospects/sectors');
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });
});

describe('Pipeline API', () => {
  let pipelineId;
  test('POST /api/pipeline adds entry', async () => {
    const res = await request(app).post('/api/pipeline').send({ prospect_id: 1, company_name: 'Test Co', stage: 'new' });
    expect(res.status).toBe(201);
    pipelineId = res.body.id;
  });

  test('PUT /api/pipeline/:id updates stage', async () => {
    const res = await request(app).put(`/api/pipeline/${pipelineId}`).send({ stage: 'called' });
    expect(res.status).toBe(200);
  });

  test('DELETE /api/pipeline/:id removes entry', async () => {
    const res = await request(app).delete(`/api/pipeline/${pipelineId}`);
    expect(res.status).toBe(200);
  });
});
```

**Step 3: Run tests (expect failure — server.js not yet rewritten)**

```bash
cd backend && npm test
```

Expected: FAIL — `Cannot find module '../server'` or route not found errors

**Step 4: Rewrite server.js**

```js
// backend/server.js
const express = require('express');
const cors = require('cors');
require('dotenv').config();

const app = express();
app.use(cors());
app.use(express.json());

const { getProspects, getProspectById, getSectors } = require('./services/prospectsService');
const { saveAnalysis, getAllAnalyses, toggleFavorite, deleteAnalysis } = require('./services/database');
const { analyzeForFlexport } = require('./services/flexportAnalyzer');
const { fetchAndScoreSignals } = require('./services/signalsService');
const { getTradeData } = require('./services/fredService');
const { getPipeline, addToPipeline, updatePipeline, removeFromPipeline } = require('./services/pipelineService');
const { aggregateCompanyData } = require('./services/dataAggregator');

// ── Prospects ──────────────────────────────────────
app.get('/api/prospects', async (req, res) => {
  try { res.json(await getProspects(req.query)); }
  catch (e) { res.status(500).json({ error: e.message }); }
});

app.get('/api/prospects/sectors', async (req, res) => {
  try { res.json(await getSectors()); }
  catch (e) { res.status(500).json({ error: e.message }); }
});

app.get('/api/prospects/:id', async (req, res) => {
  try { res.json(await getProspectById(req.params.id)); }
  catch (e) { res.status(e.message === 'Prospect not found' ? 404 : 500).json({ error: e.message }); }
});

// ── Globe Data ─────────────────────────────────────
app.get('/api/globe-data', (req, res) => {
  res.json({
    shippingLanes: [
      { src_lat: 31.2, src_lng: 121.5, dst_lat: 33.7, dst_lng: -118.2, label: 'Asia-US West Coast', weight: 10 },
      { src_lat: 31.2, src_lng: 121.5, dst_lat: 51.9, dst_lng: 4.5,   label: 'China-Rotterdam',    weight: 8 },
      { src_lat: 1.35, src_lng: 103.8, dst_lat: 40.7, dst_lng: -74.0, label: 'SE Asia-US East',    weight: 7 },
      { src_lat: 19.0, src_lng: 72.8,  dst_lat: 33.7, dst_lng: -118.2, label: 'India-US West',     weight: 5 },
      { src_lat: 51.9, src_lng: 4.5,   dst_lat: 40.7, dst_lng: -74.0, label: 'Europe-US East',     weight: 6 },
      { src_lat: 10.8, src_lng: 106.7, dst_lat: 33.7, dst_lng: -118.2, label: 'Vietnam-US West',   weight: 6 },
      { src_lat: 22.3, src_lng: 114.2, dst_lat: 40.7, dst_lng: -74.0, label: 'HK-US East',         weight: 4 }
    ],
    ports: [
      { name: 'LA/Long Beach', lat: 33.8, lng: -118.2, status: 'congestion', congestion: 7 },
      { name: 'Shanghai',      lat: 31.2, lng: 121.5,  status: 'clear',      congestion: 3 },
      { name: 'Rotterdam',     lat: 51.9, lng: 4.5,    status: 'clear',      congestion: 2 },
      { name: 'Singapore',     lat: 1.35, lng: 103.8,  status: 'clear',      congestion: 2 },
      { name: 'Hong Kong',     lat: 22.3, lng: 114.2,  status: 'clear',      congestion: 3 },
      { name: 'Felixstowe',    lat: 51.96, lng: 1.35,  status: 'disruption', congestion: 8 },
      { name: 'Hamburg',       lat: 53.55, lng: 9.99,  status: 'clear',      congestion: 3 },
      { name: 'Savannah',      lat: 32.08, lng: -81.1, status: 'clear',      congestion: 4 }
    ]
  });
});

// ── Intelligence ───────────────────────────────────
app.post('/api/analyze', async (req, res) => {
  try {
    const { companyName, prospectId } = req.body;
    if (!companyName) return res.status(400).json({ error: 'companyName required' });
    const aggregated = await aggregateCompanyData(companyName);
    const prospect = prospectId ? await getProspectById(prospectId).catch(() => null) : null;
    const analysis = await analyzeForFlexport(companyName, prospect, aggregated.news?.map(n => n.title), aggregated.searchResults);
    res.json({ company: companyName, prospect_id: prospectId, ...analysis, timestamp: new Date().toISOString() });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get('/api/analyses', async (req, res) => {
  try { res.json(await getAllAnalyses()); }
  catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/analyses', async (req, res) => {
  try {
    const { prospectId, companyName, analysisData } = req.body;
    if (!companyName || !analysisData) return res.status(400).json({ error: 'companyName and analysisData required' });
    res.status(201).json(await saveAnalysis(prospectId, companyName, analysisData));
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.delete('/api/analyses/:id', async (req, res) => {
  try { res.json(await deleteAnalysis(req.params.id)); }
  catch (e) { res.status(e.message === 'Analysis not found' ? 404 : 500).json({ error: e.message }); }
});

app.put('/api/analyses/:id/favorite', async (req, res) => {
  try {
    const { is_favorite } = req.body;
    if (typeof is_favorite !== 'boolean') return res.status(400).json({ error: 'is_favorite must be boolean' });
    res.json(await toggleFavorite(req.params.id, is_favorite));
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── Signals & Trade Data ───────────────────────────
app.get('/api/signals', async (req, res) => {
  try { res.json(await fetchAndScoreSignals()); }
  catch (e) { res.status(500).json({ error: e.message }); }
});

app.get('/api/trade-data/:commodity', async (req, res) => {
  try { res.json(await getTradeData(req.params.commodity)); }
  catch (e) { res.status(500).json({ error: e.message }); }
});

// ── Pipeline ───────────────────────────────────────
app.get('/api/pipeline', async (req, res) => {
  try { res.json(await getPipeline()); }
  catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/pipeline', async (req, res) => {
  try { res.status(201).json(await addToPipeline(req.body)); }
  catch (e) { res.status(500).json({ error: e.message }); }
});

app.put('/api/pipeline/:id', async (req, res) => {
  try { res.json(await updatePipeline(req.params.id, req.body)); }
  catch (e) { res.status(e.message === 'Not found' ? 404 : 400).json({ error: e.message }); }
});

app.delete('/api/pipeline/:id', async (req, res) => {
  try { res.json(await removeFromPipeline(req.params.id)); }
  catch (e) { res.status(e.message === 'Not found' ? 404 : 500).json({ error: e.message }); }
});

// ── Outreach & Battle Cards ────────────────────────
app.post('/api/generate-sequence', async (req, res) => {
  const { companyName, prospectData, analysisData } = req.body;
  if (!companyName) return res.status(400).json({ error: 'companyName required' });
  try {
    const axios = require('axios');
    const prompt = `Generate a 4-touch outreach sequence for a Flexport SDR targeting ${companyName}.
Context: ${JSON.stringify({ prospectData, analysisData })}
Return JSON: {"touches": [{"type":"email|linkedin|call","subject":"...","body":"...","day":1}]}
Each touch should reference Flexport value props and the company's specific supply chain situation.`;
    const r = await axios.post('https://api.openai.com/v1/chat/completions', {
      model: 'gpt-4-turbo', max_tokens: 1200,
      messages: [{ role: 'user', content: prompt }]
    }, { headers: { 'Authorization': `Bearer ${process.env.OPENAI_API_KEY}` } });
    const m = r.data.choices[0].message.content.match(/\{[\s\S]*\}/);
    res.json(m ? JSON.parse(m[0]) : { touches: [] });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get('/api/battle-cards', (req, res) => {
  res.json([
    { competitor: 'C.H. Robinson', strengths: ['Huge network coverage', 'Established brand', 'Multi-modal'], weaknesses: ['Legacy tech', 'Poor visibility tooling', 'Slow customs process'], flexport_wins: 'Real-time shipment visibility vs their black-box model. Flexport\'s portal shows live container status; CHR requires manual check-ins.', trigger_phrases: ['We use a broker', 'Our forwarder handles it', 'We\'ve been with them for years'], talk_track: 'Ask: "When a shipment is 5 days late, how quickly do you find out and why?" CHR customers usually say "when the warehouse calls us."' },
    { competitor: 'Forto', strengths: ['Modern tech', 'European strength', 'Good UX'], weaknesses: ['Limited US customs expertise', 'Smaller carrier network', 'Less financial services'], flexport_wins: 'Flexport\'s bonded warehouse and duty deferral programs — Forto can\'t match our customs-financing capabilities.', trigger_phrases: ['We use Forto', 'We switched to a digital forwarder'], talk_track: 'Acknowledge their tech upgrade, then pivot: "Forto is strong in Europe. For your Asia-US volume, what\'s their customs clearance time vs. benchmark?"' },
    { competitor: 'DHL Global Forwarding', strengths: ['Massive network', 'Air freight strength', 'Brand trust'], weaknesses: ['Enterprise-only focus', 'Poor mid-market service', 'Complex pricing'], flexport_wins: 'Flexport is built for companies at your growth stage — dedicated support, transparent pricing, no minimum volume requirements.', trigger_phrases: ['We use DHL', 'Our 3PL handles all of it'], talk_track: 'Ask: "When you have a question about your shipment, who do you call and how fast do they respond?" DHL SMB customers are often routing to call centers.' },
    { competitor: 'Convoy (Flexe/freight brokers)', strengths: ['Domestic trucking focus', 'Spot market pricing'], weaknesses: ['No international capability', 'No customs', 'No visibility platform'], flexport_wins: 'End-to-end: Flexport handles ocean, customs, and final mile. Convoy stops at the US border.', trigger_phrases: ['We just need domestic', 'We handle imports separately'], talk_track: 'Surface the coordination cost: "How many vendors do you work with to get a product from China to your warehouse? What does the handoff between international and domestic cost you in time?"' }
  ]);
});

const PORT = process.env.PORT || 5000;
if (require.main === module) {
  app.listen(PORT, () => console.log(`Flexport SDR server on port ${PORT}`));
}

module.exports = app;
```

**Step 5: Run tests**

```bash
cd backend && npm test
```

Expected: All tests PASS

**Step 6: Start server and smoke test**

```bash
npm run dev
# In another terminal:
curl http://localhost:5000/api/prospects?limit=3 | python3 -m json.tool
curl http://localhost:5000/api/globe-data | python3 -m json.tool
```

**Step 7: Commit**

```bash
git add backend/
git commit -m "feat: rewrite backend API with 15 Flexport endpoints and full test coverage"
```
## Task 5: Globe Component

**Files:**
- Install: `react-globe.gl three` (frontend)
- Create: `frontend/src/components/GlobeView.jsx`
- Create: `frontend/src/components/GlobeView.css`

**Step 1: Install globe dependencies**

```bash
cd frontend && npm install react-globe.gl three
```

**Step 2: Create GlobeView.jsx**

Create `frontend/src/components/GlobeView.jsx`:

```jsx
import { useEffect, useRef, useState, useCallback } from 'react';
import Globe from 'react-globe.gl';
import './GlobeView.css';

const API = import.meta.env.VITE_API_URL || 'http://localhost:5000';

export default function GlobeView({ selectedProspect, onPortClick }) {
  const globeRef = useRef(null);
  const [globeData, setGlobeData] = useState({ shippingLanes: [], ports: [] });
  const [dimensions, setDimensions] = useState({ w: window.innerWidth, h: Math.floor(window.innerHeight * 0.55) });

  useEffect(() => {
    fetch(`${API}/api/globe-data`).then(r => r.json()).then(setGlobeData).catch(console.error);
  }, []);

  useEffect(() => {
    const handle = () => setDimensions({ w: window.innerWidth, h: Math.floor(window.innerHeight * 0.55) });
    window.addEventListener('resize', handle);
    return () => window.removeEventListener('resize', handle);
  }, []);

  // Auto-rotate unless a prospect is selected
  useEffect(() => {
    const g = globeRef.current;
    if (!g) return;
    if (selectedProspect) {
      g.controls().autoRotate = false;
      // Zoom to prospect HQ (approximate)
      g.pointOfView({ lat: 37.7749, lng: -122.4194, altitude: 1.5 }, 1000);
    } else {
      g.controls().autoRotate = true;
      g.controls().autoRotateSpeed = 0.4;
    }
  }, [selectedProspect]);

  // Build arcs: base lanes + prospect-specific origin arcs
  const arcs = (() => {
    const base = globeData.shippingLanes.map(lane => ({
      startLat: lane.src_lat, startLng: lane.src_lng,
      endLat: lane.dst_lat,   endLng: lane.dst_lng,
      color: ['rgba(0, 212, 255, 0.6)', 'rgba(0, 212, 255, 0.6)'],
      label: lane.label, weight: lane.weight
    }));

    if (!selectedProspect?.import_origins) return base;

    const originCoords = {
      'China': { lat: 31.2, lng: 121.5 },
      'Vietnam': { lat: 10.8, lng: 106.7 },
      'India': { lat: 19.0, lng: 72.8 },
      'Portugal': { lat: 38.7, lng: -9.1 },
      'Italy': { lat: 41.9, lng: 12.5 },
      'South Korea': { lat: 37.5, lng: 127.0 },
      'Bangladesh': { lat: 23.8, lng: 90.4 },
      'Malaysia': { lat: 3.1, lng: 101.7 },
      'Austria': { lat: 48.2, lng: 16.4 },
      'Spain': { lat: 40.4, lng: -3.7 },
      'Philippines': { lat: 14.6, lng: 121.0 },
      'Cambodia': { lat: 11.6, lng: 104.9 },
      'Costa Rica': { lat: 9.9, lng: -84.1 },
      'Peru': { lat: -12.0, lng: -77.0 },
      'Mexico': { lat: 19.4, lng: -99.1 },
      'Turkey': { lat: 41.0, lng: 28.9 },
      'Argentina': { lat: -34.6, lng: -58.4 },
      'Netherlands': { lat: 52.4, lng: 4.9 },
      'Sweden': { lat: 59.3, lng: 18.1 },
      'Singapore': { lat: 1.35, lng: 103.8 }
    };

    const usCoords = { lat: 34.0, lng: -118.2 }; // LA port
    const prospectArcs = selectedProspect.import_origins.map(origin => {
      const coords = originCoords[origin];
      if (!coords) return null;
      return {
        startLat: coords.lat, startLng: coords.lng,
        endLat: usCoords.lat, endLng: usCoords.lng,
        color: ['rgba(255, 190, 50, 0.9)', 'rgba(255, 190, 50, 0.9)'],
        label: `${origin} → US (${selectedProspect.name})`,
        weight: 3
      };
    }).filter(Boolean);

    return [...base, ...prospectArcs];
  })();

  const portColor = useCallback((port) => {
    if (port.status === 'disruption') return '#ef4444';
    if (port.status === 'congestion') return '#f59e0b';
    return '#10b981';
  }, []);

  return (
    <div className="globe-wrapper">
      <Globe
        ref={globeRef}
        width={dimensions.w}
        height={dimensions.h}
        globeImageUrl="//unpkg.com/three-globe/example/img/earth-night.jpg"
        backgroundImageUrl="//unpkg.com/three-globe/example/img/night-sky.png"
        atmosphereColor="rgba(37, 99, 235, 0.2)"
        atmosphereAltitude={0.15}
        arcsData={arcs}
        arcColor="color"
        arcDashLength={0.4}
        arcDashGap={0.2}
        arcDashAnimateTime={3000}
        arcStroke={d => (d.weight / 5)}
        arcLabel="label"
        pointsData={globeData.ports}
        pointLat="lat"
        pointLng="lng"
        pointColor={portColor}
        pointAltitude={0.02}
        pointRadius={0.4}
        pointLabel={d => `<div class="globe-tooltip"><strong>${d.name}</strong><br/>Status: ${d.status}<br/>Congestion: ${d.congestion}/10</div>`}
        onPointClick={port => onPortClick?.(port)}
      />
      <div className="globe-legend">
        <span className="legend-item green">■ Clear</span>
        <span className="legend-item amber">■ Congestion</span>
        <span className="legend-item red">■ Disruption</span>
      </div>
    </div>
  );
}
```

**Step 3: Create GlobeView.css**

```css
/* frontend/src/components/GlobeView.css */
.globe-wrapper {
  position: relative;
  width: 100%;
  overflow: hidden;
  background: #060b18;
}

.globe-legend {
  position: absolute;
  bottom: 16px;
  right: 16px;
  display: flex;
  gap: 12px;
  font-size: 11px;
  color: #94a3b8;
  font-family: 'JetBrains Mono', monospace;
}

.legend-item.green  { color: #10b981; }
.legend-item.amber  { color: #f59e0b; }
.legend-item.red    { color: #ef4444; }

.globe-tooltip {
  background: rgba(6, 11, 24, 0.9);
  border: 1px solid rgba(255,255,255,0.08);
  border-radius: 8px;
  padding: 8px 12px;
  font-family: 'Inter', sans-serif;
  font-size: 12px;
  color: #f1f5f9;
  pointer-events: none;
}
```

**Step 4: Verify globe renders**

```bash
cd frontend && npm run dev
```

Open `http://localhost:5173` — globe should render with rotating Earth and blue arc animations.

**Step 5: Commit**

```bash
git add frontend/src/components/GlobeView.jsx frontend/src/components/GlobeView.css
git commit -m "feat: add interactive 3D globe with shipping lanes and port hotspots"
```

---

## Task 6: Prospect Intelligence Panel

**Files:**
- Create: `frontend/src/components/ProspectSearch.jsx`
- Create: `frontend/src/components/ProspectSearch.css`
- Create: `frontend/src/components/AnalysisPanel.jsx`
- Create: `frontend/src/components/AnalysisPanel.css`
- Create: `frontend/src/components/ICPBadge.jsx`

**Step 1: Create ICPBadge.jsx (shared component)**

```jsx
// frontend/src/components/ICPBadge.jsx
export default function ICPBadge({ score }) {
  const color = score >= 85 ? '#10b981' : score >= 70 ? '#f59e0b' : '#94a3b8';
  return (
    <span style={{ color, fontFamily: 'JetBrains Mono, monospace', fontWeight: 700, fontSize: 13 }}>
      ICP {score}
    </span>
  );
}
```

**Step 2: Create ProspectSearch.jsx**

```jsx
// frontend/src/components/ProspectSearch.jsx
import { useState, useEffect, useCallback } from 'react';
import ICPBadge from './ICPBadge';
import './ProspectSearch.css';

const API = import.meta.env.VITE_API_URL || 'http://localhost:5000';

export default function ProspectSearch({ onSelect }) {
  const [prospects, setProspects] = useState([]);
  const [sectors, setSectors] = useState([]);
  const [filters, setFilters] = useState({ search: '', sector: '', icp_min: '' });
  const [loading, setLoading] = useState(false);

  const fetchProspects = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams(Object.entries(filters).filter(([,v]) => v));
    try {
      const r = await fetch(`${API}/api/prospects?${params}&limit=50`);
      setProspects(await r.json());
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  }, [filters]);

  useEffect(() => {
    fetch(`${API}/api/prospects/sectors`).then(r => r.json()).then(setSectors).catch(console.error);
  }, []);

  useEffect(() => { fetchProspects(); }, [fetchProspects]);

  return (
    <div className="prospect-search">
      <div className="search-controls">
        <input
          className="search-input"
          placeholder="Search prospects..."
          value={filters.search}
          onChange={e => setFilters(f => ({ ...f, search: e.target.value }))}
        />
        <select className="filter-select" value={filters.sector} onChange={e => setFilters(f => ({ ...f, sector: e.target.value }))}>
          <option value="">All Sectors</option>
          {sectors.map(s => <option key={s.sector} value={s.sector}>{s.sector} ({s.count})</option>)}
        </select>
        <select className="filter-select" value={filters.icp_min} onChange={e => setFilters(f => ({ ...f, icp_min: e.target.value }))}>
          <option value="">Any ICP</option>
          <option value="90">90+ (Elite)</option>
          <option value="80">80+ (Strong)</option>
          <option value="70">70+ (Good)</option>
        </select>
      </div>

      {loading && <div className="loading-row">Loading prospects...</div>}

      <div className="prospect-list">
        {prospects.map((p, i) => (
          <div key={p.id} className="prospect-row" style={{ animationDelay: `${i * 40}ms` }} onClick={() => onSelect(p)}>
            <div className="prospect-row-left">
              <span className="prospect-name">{p.name}</span>
              <span className="prospect-meta">{p.sector} · {p.hq_location}</span>
            </div>
            <div className="prospect-row-right">
              <ICPBadge score={p.icp_score} />
              <span className="prospect-volume" title="Shipping volume estimate">{p.shipping_volume_estimate}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
```

**Step 3: Create ProspectSearch.css**

```css
/* frontend/src/components/ProspectSearch.css */
.prospect-search { display: flex; flex-direction: column; gap: 12px; }

.search-controls { display: flex; gap: 8px; flex-wrap: wrap; }

.search-input, .filter-select {
  background: rgba(255,255,255,0.04);
  border: 1px solid rgba(255,255,255,0.08);
  border-radius: 10px;
  padding: 8px 14px;
  color: #f1f5f9;
  font-family: 'Inter', sans-serif;
  font-size: 13px;
  outline: none;
  transition: border-color 0.2s;
}
.search-input { flex: 1; min-width: 200px; }
.search-input:focus, .filter-select:focus { border-color: rgba(37, 99, 235, 0.6); }
.filter-select option { background: #0f172a; }

.prospect-list { display: flex; flex-direction: column; gap: 4px; max-height: 400px; overflow-y: auto; }

.prospect-row {
  display: flex; justify-content: space-between; align-items: center;
  padding: 10px 14px;
  background: rgba(255,255,255,0.04);
  border: 1px solid rgba(255,255,255,0.06);
  border-radius: 10px;
  cursor: pointer;
  transition: all 0.15s cubic-bezier(0.4,0,0.2,1);
  animation: fadeSlideIn 0.3s both;
}
.prospect-row:hover { background: rgba(37,99,235,0.12); border-color: rgba(37,99,235,0.3); transform: translateX(4px); }

@keyframes fadeSlideIn { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }

.prospect-row-left { display: flex; flex-direction: column; gap: 2px; }
.prospect-name { font-size: 14px; font-weight: 500; color: #f1f5f9; }
.prospect-meta { font-size: 11px; color: #64748b; }
.prospect-row-right { display: flex; align-items: center; gap: 12px; }
.prospect-volume { font-size: 11px; color: #475569; }
.loading-row { color: #475569; font-size: 13px; padding: 8px 0; }
```

**Step 4: Create AnalysisPanel.jsx**

```jsx
// frontend/src/components/AnalysisPanel.jsx
import { useState } from 'react';
import ICPBadge from './ICPBadge';
import './AnalysisPanel.css';

const API = import.meta.env.VITE_API_URL || 'http://localhost:5000';

export default function AnalysisPanel({ prospect, onOpenOutreach }) {
  const [analysis, setAnalysis] = useState(null);
  const [loading, setLoading] = useState(false);
  const [saved, setSaved] = useState(false);

  const runAnalysis = async () => {
    setLoading(true);
    setSaved(false);
    try {
      const r = await fetch(`${API}/api/analyze`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ companyName: prospect.name, prospectId: prospect.id })
      });
      setAnalysis(await r.json());
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  };

  const saveAnalysis = async () => {
    if (!analysis) return;
    await fetch(`${API}/api/analyses`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prospectId: prospect.id, companyName: prospect.name, analysisData: analysis })
    });
    setSaved(true);
  };

  const addToPipeline = async () => {
    await fetch(`${API}/api/pipeline`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prospect_id: prospect.id, company_name: prospect.name, stage: 'researched' })
    });
  };

  if (!prospect) return (
    <div className="analysis-empty">
      <p>Select a prospect to view intelligence</p>
    </div>
  );

  return (
    <div className="analysis-panel">
      <div className="analysis-header">
        <div>
          <h2 className="analysis-company-name">{prospect.name}</h2>
          <p className="analysis-meta">{prospect.sector} · {prospect.hq_location} · {prospect.estimated_revenue}</p>
        </div>
        <ICPBadge score={prospect.icp_score} />
      </div>

      <div className="analysis-meta-row">
        <div className="meta-chip">
          <span className="meta-label">Import Origins</span>
          <span className="meta-value">{prospect.import_origins?.join(', ')}</span>
        </div>
        <div className="meta-chip">
          <span className="meta-label">Primary Lanes</span>
          <span className="meta-value">{prospect.primary_lanes?.join(', ')}</span>
        </div>
        <div className="meta-chip">
          <span className="meta-label">Current Forwarder</span>
          <span className="meta-value">{prospect.likely_forwarder}</span>
        </div>
        <div className="meta-chip">
          <span className="meta-label">Volume</span>
          <span className="meta-value">{prospect.shipping_volume_estimate}</span>
        </div>
      </div>

      <div className="analysis-actions">
        <button className="btn-primary" onClick={runAnalysis} disabled={loading}>
          {loading ? 'Analyzing...' : '⚡ Run AI Analysis'}
        </button>
        {analysis && <>
          <button className="btn-secondary" onClick={saveAnalysis} disabled={saved}>{saved ? '✓ Saved' : 'Save'}</button>
          <button className="btn-secondary" onClick={addToPipeline}>+ Pipeline</button>
          <button className="btn-secondary" onClick={() => onOpenOutreach?.(prospect, analysis)}>✉ Outreach Sequence</button>
        </>}
      </div>

      {analysis && (
        <div className="analysis-results">
          <section className="analysis-section">
            <h3>Company Profile</h3>
            <p>{analysis.profile}</p>
          </section>

          <section className="analysis-section">
            <h3>Supply Chain Pain Points</h3>
            <ul>{analysis.pain_points?.map((p, i) => <li key={i}>{p}</li>)}</ul>
          </section>

          <section className="analysis-section">
            <h3>Outreach Angle</h3>
            <p className="outreach-angle">{analysis.outreach_angle}</p>
          </section>

          <section className="analysis-section">
            <h3>ICP Breakdown</h3>
            <p>{analysis.icp_breakdown?.reasoning}</p>
            <ul>{analysis.icp_breakdown?.key_signals?.map((s, i) => <li key={i}>{s}</li>)}</ul>
          </section>

          <section className="analysis-section">
            <h3>Decision Makers</h3>
            {analysis.decision_makers?.map((dm, i) => (
              <div key={i} className="decision-maker">
                <strong>{dm.title}</strong>
                <ul>{dm.concerns?.map((c, j) => <li key={j}>{c}</li>)}</ul>
              </div>
            ))}
          </section>

          <section className="analysis-section">
            <h3>Relevant Flexport Features</h3>
            <ul>{analysis.flexport_value_props?.map((p, i) => <li key={i}>{p}</li>)}</ul>
          </section>
        </div>
      )}
    </div>
  );
}
```

**Step 5: Create AnalysisPanel.css**

```css
/* frontend/src/components/AnalysisPanel.css */
.analysis-panel { display: flex; flex-direction: column; gap: 16px; }

.analysis-empty { color: #475569; font-size: 14px; padding: 40px 0; text-align: center; }

.analysis-header { display: flex; justify-content: space-between; align-items: flex-start; }

.analysis-company-name { font-family: 'Space Grotesk', sans-serif; font-size: 22px; font-weight: 700; color: #f1f5f9; }
.analysis-meta { font-size: 12px; color: #64748b; margin-top: 2px; }

.analysis-meta-row { display: flex; gap: 8px; flex-wrap: wrap; }

.meta-chip {
  display: flex; flex-direction: column; gap: 2px;
  background: rgba(255,255,255,0.04);
  border: 1px solid rgba(255,255,255,0.06);
  border-radius: 8px; padding: 8px 12px;
}
.meta-label { font-size: 10px; color: #475569; text-transform: uppercase; letter-spacing: 0.05em; }
.meta-value { font-size: 12px; color: #cbd5e1; }

.analysis-actions { display: flex; gap: 8px; flex-wrap: wrap; }

.btn-primary {
  background: #2563EB; color: white; border: none;
  border-radius: 10px; padding: 9px 18px;
  font-size: 13px; font-weight: 500; cursor: pointer;
  transition: background 0.2s;
}
.btn-primary:hover { background: #1d4ed8; }
.btn-primary:disabled { opacity: 0.5; cursor: not-allowed; }

.btn-secondary {
  background: rgba(255,255,255,0.06); color: #cbd5e1;
  border: 1px solid rgba(255,255,255,0.08);
  border-radius: 10px; padding: 9px 16px;
  font-size: 13px; cursor: pointer;
  transition: all 0.2s;
}
.btn-secondary:hover { background: rgba(255,255,255,0.1); }

.analysis-results { display: flex; flex-direction: column; gap: 12px; }

.analysis-section {
  background: rgba(255,255,255,0.04);
  border: 1px solid rgba(255,255,255,0.06);
  border-radius: 12px; padding: 16px;
}
.analysis-section h3 { font-size: 11px; text-transform: uppercase; letter-spacing: 0.08em; color: #64748b; margin-bottom: 8px; }
.analysis-section p { font-size: 13px; color: #cbd5e1; line-height: 1.6; }
.analysis-section ul { padding-left: 16px; }
.analysis-section li { font-size: 13px; color: #cbd5e1; line-height: 1.6; margin-bottom: 4px; }

.outreach-angle { color: #00d4ff !important; font-style: italic; }

.decision-maker { margin-bottom: 12px; }
.decision-maker strong { font-size: 13px; color: #f1f5f9; display: block; margin-bottom: 4px; }
```

**Step 6: Commit**

```bash
git add frontend/src/components/
git commit -m "feat: add ProspectSearch and AnalysisPanel with Flexport AI intelligence"
```
## Task 7: Signal Feed + FRED Trade Charts

**Files:**
- Install: `recharts` (frontend)
- Create: `frontend/src/components/SignalFeed.jsx`
- Create: `frontend/src/components/SignalFeed.css`
- Create: `frontend/src/components/TradeDataCharts.jsx`
- Create: `frontend/src/components/TradeDataCharts.css`
- Create: `frontend/src/components/TariffCalculator.jsx`

**Step 1: Install recharts**

```bash
cd frontend && npm install recharts
```

**Step 2: Create SignalFeed.jsx**

```jsx
// frontend/src/components/SignalFeed.jsx
import { useState, useEffect } from 'react';
import './SignalFeed.css';

const API = import.meta.env.VITE_API_URL || 'http://localhost:5000';

export default function SignalFeed() {
  const [signals, setSignals] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`${API}/api/signals`)
      .then(r => r.json())
      .then(data => { setSignals(Array.isArray(data) ? data : []); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  const urgencyColor = (score) => {
    if (score >= 8) return '#ef4444';
    if (score >= 5) return '#f59e0b';
    return '#10b981';
  };

  const urgencyLabel = (score) => {
    if (score >= 8) return 'ACT NOW';
    if (score >= 5) return 'MONITOR';
    return 'POSITIVE';
  };

  return (
    <div className="signal-feed">
      <div className="feed-header">
        <h3>Supply Chain Signals</h3>
        <span className="live-badge">LIVE</span>
      </div>

      {loading && <div className="feed-loading">Fetching signals...</div>}

      <div className="signal-list">
        {signals.map((s, i) => (
          <a key={i} href={s.url} target="_blank" rel="noreferrer" className="signal-card" style={{ animationDelay: `${i * 60}ms` }}>
            <div className="signal-top">
              <span className="urgency-badge" style={{ color: urgencyColor(s.urgency_score), borderColor: urgencyColor(s.urgency_score) }}>
                {urgencyLabel(s.urgency_score)} {s.urgency_score}/10
              </span>
              <span className="signal-source">{s.source || s.name}</span>
            </div>
            <p className="signal-headline">{s.title || s.headline}</p>
            {s.urgency_reason && <p className="signal-reason">{s.urgency_reason}</p>}
            {s.affected_sectors?.length > 0 && (
              <div className="signal-tags">
                {s.affected_sectors.map((sec, j) => <span key={j} className="signal-tag">{sec}</span>)}
              </div>
            )}
          </a>
        ))}
      </div>
    </div>
  );
}
```

**Step 3: Create SignalFeed.css**

```css
/* frontend/src/components/SignalFeed.css */
.signal-feed { display: flex; flex-direction: column; gap: 12px; }

.feed-header { display: flex; align-items: center; gap: 10px; }
.feed-header h3 { font-family: 'Space Grotesk', sans-serif; font-size: 14px; font-weight: 600; color: #f1f5f9; }

.live-badge {
  font-size: 9px; font-weight: 700; letter-spacing: 0.1em;
  color: #10b981; border: 1px solid #10b981;
  border-radius: 4px; padding: 2px 6px;
  animation: pulse-badge 2s infinite;
}
@keyframes pulse-badge { 0%,100% { opacity: 1; } 50% { opacity: 0.5; } }

.feed-loading { color: #475569; font-size: 13px; }

.signal-list { display: flex; flex-direction: column; gap: 8px; max-height: 420px; overflow-y: auto; }

.signal-card {
  display: block; text-decoration: none;
  background: rgba(255,255,255,0.04);
  border: 1px solid rgba(255,255,255,0.06);
  border-radius: 10px; padding: 12px;
  transition: all 0.2s cubic-bezier(0.4,0,0.2,1);
  animation: fadeSlideIn 0.4s both;
  cursor: pointer;
}
.signal-card:hover { background: rgba(255,255,255,0.07); border-color: rgba(255,255,255,0.12); }

@keyframes fadeSlideIn { from { opacity: 0; transform: translateY(12px); } to { opacity: 1; transform: translateY(0); } }

.signal-top { display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px; }
.urgency-badge { font-size: 10px; font-weight: 700; border: 1px solid; border-radius: 4px; padding: 2px 7px; font-family: 'JetBrains Mono', monospace; }
.signal-source { font-size: 10px; color: #475569; }
.signal-headline { font-size: 12px; color: #cbd5e1; line-height: 1.5; margin-bottom: 4px; }
.signal-reason { font-size: 11px; color: #64748b; line-height: 1.4; margin-bottom: 6px; }
.signal-tags { display: flex; gap: 4px; flex-wrap: wrap; }
.signal-tag { font-size: 10px; background: rgba(37,99,235,0.15); color: #60a5fa; border-radius: 4px; padding: 2px 6px; }
```

**Step 4: Create TradeDataCharts.jsx**

```jsx
// frontend/src/components/TradeDataCharts.jsx
import { useState, useEffect } from 'react';
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import './TradeDataCharts.css';

const API = import.meta.env.VITE_API_URL || 'http://localhost:5000';

const COMMODITIES = [
  { key: 'electronics', label: 'Electronics' },
  { key: 'apparel', label: 'Apparel/Consumer Goods' },
  { key: 'trade_balance', label: 'Trade Balance' },
  { key: 'total_imports', label: 'Total Imports' }
];

export default function TradeDataCharts() {
  const [active, setActive] = useState('electronics');
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setLoading(true);
    fetch(`${API}/api/trade-data/${active}`)
      .then(r => r.json())
      .then(d => {
        const obs = d.observations || [];
        const chartData = obs
          .filter(o => o.value !== '.')
          .slice(0, 12)
          .reverse()
          .map(o => ({ date: o.date?.substring(0, 7), value: parseFloat(o.value) }));
        setData(chartData);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [active]);

  const CustomTooltip = ({ active: a, payload, label }) => {
    if (!a || !payload?.length) return null;
    return (
      <div className="chart-tooltip">
        <p className="tooltip-date">{label}</p>
        <p className="tooltip-value">${payload[0].value?.toLocaleString()}B</p>
      </div>
    );
  };

  return (
    <div className="trade-charts">
      <div className="chart-header">
        <h3>US Trade Data <span className="chart-source">FRED</span></h3>
        <div className="chart-tabs">
          {COMMODITIES.map(c => (
            <button key={c.key} className={`chart-tab ${active === c.key ? 'active' : ''}`} onClick={() => setActive(c.key)}>
              {c.label}
            </button>
          ))}
        </div>
      </div>

      {loading ? <div className="chart-loading">Loading FRED data...</div> : (
        <ResponsiveContainer width="100%" height={160}>
          <LineChart data={data} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
            <XAxis dataKey="date" tick={{ fill: '#475569', fontSize: 10 }} tickLine={false} />
            <YAxis tick={{ fill: '#475569', fontSize: 10 }} tickLine={false} axisLine={false} />
            <Tooltip content={<CustomTooltip />} />
            <Line type="monotone" dataKey="value" stroke="#00d4ff" strokeWidth={2} dot={false} />
          </LineChart>
        </ResponsiveContainer>
      )}
    </div>
  );
}
```

**Step 5: Create TradeDataCharts.css**

```css
/* frontend/src/components/TradeDataCharts.css */
.trade-charts {
  background: rgba(255,255,255,0.04);
  border: 1px solid rgba(255,255,255,0.06);
  border-radius: 14px; padding: 16px;
}

.chart-header { margin-bottom: 12px; }
.chart-header h3 { font-size: 13px; font-weight: 600; color: #f1f5f9; margin-bottom: 8px; }
.chart-source { font-size: 9px; background: rgba(37,99,235,0.2); color: #60a5fa; border-radius: 4px; padding: 1px 5px; margin-left: 6px; vertical-align: middle; }

.chart-tabs { display: flex; gap: 4px; flex-wrap: wrap; }
.chart-tab { background: transparent; border: 1px solid rgba(255,255,255,0.08); color: #64748b; border-radius: 6px; padding: 4px 10px; font-size: 11px; cursor: pointer; transition: all 0.2s; }
.chart-tab.active, .chart-tab:hover { background: rgba(37,99,235,0.2); color: #60a5fa; border-color: rgba(37,99,235,0.4); }

.chart-loading { color: #475569; font-size: 13px; height: 160px; display: flex; align-items: center; justify-content: center; }

.chart-tooltip { background: rgba(6,11,24,0.95); border: 1px solid rgba(255,255,255,0.08); border-radius: 8px; padding: 8px 12px; }
.tooltip-date { font-size: 11px; color: #64748b; }
.tooltip-value { font-size: 14px; color: #00d4ff; font-family: 'JetBrains Mono', monospace; font-weight: 700; }
```

**Step 6: Create TariffCalculator.jsx**

```jsx
// frontend/src/components/TariffCalculator.jsx
import { useState } from 'react';
import './TariffCalculator.css';

const TARIFF_RATES = {
  electronics: { rate: 0.255, sector_name: 'Electronics (Section 301)' },
  apparel: { rate: 0.12, sector_name: 'Apparel (standard)' },
  furniture: { rate: 0.18, sector_name: 'Furniture (Section 301 elevated)' },
  'e-commerce': { rate: 0.15, sector_name: 'General DTC goods' },
  CPG: { rate: 0.08, sector_name: 'Consumer packaged goods' },
  default: { rate: 0.15, sector_name: 'General imported goods' }
};

const FLEXPORT_SAVINGS_RATE = 0.25; // 25% duty cost reduction via bonded warehouse + deferral

export default function TariffCalculator({ prospectSector }) {
  const [importVolume, setImportVolume] = useState(2000000);
  const [shipmentFreq, setShipmentFreq] = useState(24);

  const tariffInfo = TARIFF_RATES[prospectSector] || TARIFF_RATES.default;
  const annualDuty = importVolume * tariffInfo.rate;
  const flexportSavings = annualDuty * FLEXPORT_SAVINGS_RATE;
  const perShipment = annualDuty / shipmentFreq;

  const fmt = (n) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(n);

  return (
    <div className="tariff-calc">
      <h3>ROI Calculator</h3>
      <div className="calc-inputs">
        <label>
          <span>Annual Import Volume</span>
          <input type="range" min={100000} max={10000000} step={100000} value={importVolume} onChange={e => setImportVolume(+e.target.value)} />
          <span className="calc-value">{fmt(importVolume)}</span>
        </label>
        <label>
          <span>Shipments/Year</span>
          <input type="range" min={4} max={100} step={4} value={shipmentFreq} onChange={e => setShipmentFreq(+e.target.value)} />
          <span className="calc-value">{shipmentFreq}</span>
        </label>
      </div>
      <div className="calc-results">
        <div className="calc-stat">
          <span className="stat-label">Est. Annual Duty ({(tariffInfo.rate * 100).toFixed(0)}% {tariffInfo.sector_name})</span>
          <span className="stat-value red">{fmt(annualDuty)}</span>
        </div>
        <div className="calc-stat">
          <span className="stat-label">Duty per Shipment</span>
          <span className="stat-value">{fmt(perShipment)}</span>
        </div>
        <div className="calc-stat highlight">
          <span className="stat-label">Flexport Duty Deferral Savings</span>
          <span className="stat-value green">{fmt(flexportSavings)}/yr</span>
        </div>
      </div>
      <p className="calc-pitch">
        "At {fmt(importVolume)} in annual imports, {prospectSector ? `your ${prospectSector} business` : 'your business'} likely pays {fmt(annualDuty)}/year in duties. Flexport's bonded warehouse and duty deferral program could save you {fmt(flexportSavings)} annually."
      </p>
    </div>
  );
}
```

**Step 7: Create TariffCalculator.css**

```css
/* frontend/src/components/TariffCalculator.css */
.tariff-calc { background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.06); border-radius: 14px; padding: 16px; display: flex; flex-direction: column; gap: 14px; }
.tariff-calc h3 { font-size: 13px; font-weight: 600; color: #f1f5f9; }
.calc-inputs { display: flex; flex-direction: column; gap: 10px; }
.calc-inputs label { display: flex; flex-direction: column; gap: 4px; font-size: 11px; color: #64748b; }
.calc-inputs input[type=range] { accent-color: #2563EB; width: 100%; }
.calc-value { font-family: 'JetBrains Mono', monospace; font-size: 13px; color: #f1f5f9; }
.calc-results { display: flex; flex-direction: column; gap: 8px; }
.calc-stat { display: flex; justify-content: space-between; align-items: center; }
.stat-label { font-size: 11px; color: #64748b; }
.stat-value { font-family: 'JetBrains Mono', monospace; font-size: 14px; font-weight: 700; color: #f1f5f9; }
.stat-value.red { color: #ef4444; }
.stat-value.green { color: #10b981; }
.calc-stat.highlight { background: rgba(16,185,129,0.08); border: 1px solid rgba(16,185,129,0.2); border-radius: 8px; padding: 8px 12px; }
.calc-pitch { font-size: 12px; color: #64748b; line-height: 1.6; font-style: italic; border-top: 1px solid rgba(255,255,255,0.06); padding-top: 12px; }
```

**Step 8: Commit**

```bash
git add frontend/src/components/
git commit -m "feat: add signal feed, FRED trade charts, and tariff ROI calculator"
```

---

## Task 8: Pipeline Kanban

**Files:**
- Install: `@dnd-kit/core @dnd-kit/sortable @dnd-kit/utilities` (frontend)
- Create: `frontend/src/components/PipelineKanban.jsx`
- Create: `frontend/src/components/PipelineKanban.css`

**Step 1: Install @dnd-kit**

```bash
cd frontend && npm install @dnd-kit/core @dnd-kit/sortable @dnd-kit/utilities
```

**Step 2: Create PipelineKanban.jsx**

```jsx
// frontend/src/components/PipelineKanban.jsx
import { useState, useEffect } from 'react';
import { DndContext, DragOverlay, PointerSensor, useSensor, useSensors, closestCenter } from '@dnd-kit/core';
import { SortableContext, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import './PipelineKanban.css';

const API = import.meta.env.VITE_API_URL || 'http://localhost:5000';

const STAGES = [
  { key: 'new',          label: 'New',          color: '#94a3b8' },
  { key: 'researched',   label: 'Researched',   color: '#60a5fa' },
  { key: 'called',       label: 'Called',       color: '#a78bfa' },
  { key: 'demo_booked',  label: 'Demo Booked',  color: '#34d399' },
  { key: 'closed_won',   label: 'Closed Won',   color: '#10b981' },
  { key: 'closed_lost',  label: 'Closed Lost',  color: '#f87171' }
];

function PipelineCard({ item, isDragging }) {
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id: item.id });
  const style = { transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.4 : 1 };

  return (
    <div ref={setNodeRef} style={style} {...attributes} {...listeners} className="pipeline-card">
      <div className="card-name">{item.company_name}</div>
      <div className="card-meta">
        {item.icp_score && <span className="card-icp">ICP {item.icp_score}</span>}
        {item.sector && <span className="card-sector">{item.sector}</span>}
      </div>
      {item.next_action && <div className="card-action">→ {item.next_action}</div>}
    </div>
  );
}

export default function PipelineKanban({ isOpen, onClose }) {
  const [pipeline, setPipeline] = useState({});
  const [activeId, setActiveId] = useState(null);
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }));

  useEffect(() => {
    if (isOpen) {
      fetch(`${API}/api/pipeline`).then(r => r.json()).then(setPipeline).catch(console.error);
    }
  }, [isOpen]);

  const findStageOfItem = (id) => {
    for (const [stage, items] of Object.entries(pipeline)) {
      if (items.find(i => i.id === id)) return stage;
    }
    return null;
  };

  const handleDragEnd = async ({ active, over }) => {
    setActiveId(null);
    if (!over) return;
    const fromStage = findStageOfItem(active.id);
    const toStage = over.id; // column drop target

    if (!fromStage || fromStage === toStage) return;

    // Optimistic update
    const item = pipeline[fromStage]?.find(i => i.id === active.id);
    if (!item) return;
    setPipeline(prev => ({
      ...prev,
      [fromStage]: prev[fromStage].filter(i => i.id !== active.id),
      [toStage]: [...(prev[toStage] || []), { ...item, stage: toStage }]
    }));

    await fetch(`${API}/api/pipeline/${active.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ stage: toStage })
    }).catch(console.error);
  };

  const totalMoved = (pipeline.demo_booked?.length || 0) + (pipeline.closed_won?.length || 0);

  if (!isOpen) return null;

  return (
    <div className="kanban-overlay">
      <div className="kanban-drawer">
        <div className="kanban-header">
          <h2>Pipeline</h2>
          {totalMoved > 0 && <span className="kanban-metric">🎯 {totalMoved} demos/wins this pipeline</span>}
          <button className="kanban-close" onClick={onClose}>✕</button>
        </div>

        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragStart={({ active }) => setActiveId(active.id)} onDragEnd={handleDragEnd}>
          <div className="kanban-board">
            {STAGES.map(stage => {
              const items = pipeline[stage.key] || [];
              return (
                <div key={stage.key} id={stage.key} className="kanban-column">
                  <div className="column-header">
                    <span className="column-dot" style={{ background: stage.color }} />
                    <span className="column-label">{stage.label}</span>
                    <span className="column-count">{items.length}</span>
                  </div>
                  <SortableContext items={items.map(i => i.id)} strategy={verticalListSortingStrategy}>
                    <div className="column-body">
                      {items.map(item => (
                        <PipelineCard key={item.id} item={item} isDragging={activeId === item.id} />
                      ))}
                    </div>
                  </SortableContext>
                </div>
              );
            })}
          </div>
        </DndContext>
      </div>
    </div>
  );
}
```

**Step 3: Create PipelineKanban.css**

```css
/* frontend/src/components/PipelineKanban.css */
.kanban-overlay {
  position: fixed; inset: 0; z-index: 100;
  background: rgba(6,11,24,0.7); backdrop-filter: blur(8px);
  display: flex; align-items: flex-end;
}

.kanban-drawer {
  width: 100%; height: 60vh;
  background: #0d1626;
  border-top: 1px solid rgba(255,255,255,0.08);
  border-radius: 20px 20px 0 0;
  padding: 24px;
  display: flex; flex-direction: column; gap: 16px;
  overflow: hidden;
}

.kanban-header { display: flex; align-items: center; gap: 16px; }
.kanban-header h2 { font-family: 'Space Grotesk', sans-serif; font-size: 18px; font-weight: 700; color: #f1f5f9; }
.kanban-metric { font-size: 12px; color: #34d399; flex: 1; }
.kanban-close { background: transparent; border: none; color: #64748b; font-size: 18px; cursor: pointer; margin-left: auto; }
.kanban-close:hover { color: #f1f5f9; }

.kanban-board { display: flex; gap: 12px; overflow-x: auto; flex: 1; padding-bottom: 4px; }

.kanban-column {
  min-width: 180px; flex: 1;
  background: rgba(255,255,255,0.03);
  border: 1px solid rgba(255,255,255,0.06);
  border-radius: 12px;
  display: flex; flex-direction: column;
  overflow: hidden;
}

.column-header {
  display: flex; align-items: center; gap: 6px;
  padding: 10px 12px;
  border-bottom: 1px solid rgba(255,255,255,0.06);
}
.column-dot { width: 8px; height: 8px; border-radius: 50%; flex-shrink: 0; }
.column-label { font-size: 12px; font-weight: 600; color: #94a3b8; flex: 1; }
.column-count { font-family: 'JetBrains Mono', monospace; font-size: 11px; color: #475569; }

.column-body { flex: 1; overflow-y: auto; padding: 8px; display: flex; flex-direction: column; gap: 6px; min-height: 60px; }

.pipeline-card {
  background: rgba(255,255,255,0.05);
  border: 1px solid rgba(255,255,255,0.08);
  border-radius: 8px; padding: 10px 12px;
  cursor: grab; user-select: none;
  transition: all 0.15s;
}
.pipeline-card:hover { background: rgba(37,99,235,0.12); border-color: rgba(37,99,235,0.3); }
.pipeline-card:active { cursor: grabbing; }

.card-name { font-size: 12px; font-weight: 500; color: #f1f5f9; margin-bottom: 4px; }
.card-meta { display: flex; gap: 6px; flex-wrap: wrap; margin-bottom: 4px; }
.card-icp { font-family: 'JetBrains Mono', monospace; font-size: 10px; color: #10b981; }
.card-sector { font-size: 10px; color: #475569; }
.card-action { font-size: 10px; color: #60a5fa; }
```

**Step 4: Verify pipeline drag-and-drop**

```bash
# With frontend and backend running, open http://localhost:5173
# Add a prospect to pipeline via AnalysisPanel, then open kanban
# Drag a card to a new column — verify DB updates via API
curl http://localhost:5000/api/pipeline
```

**Step 5: Commit**

```bash
git add frontend/src/components/PipelineKanban.jsx frontend/src/components/PipelineKanban.css
git commit -m "feat: add drag-and-drop pipeline kanban with 6 stages"
```
## Task 9: Outreach Sequence Builder + Battle Cards

**Files:**
- Create: `frontend/src/components/OutreachSequenceModal.jsx`
- Create: `frontend/src/components/OutreachSequenceModal.css`
- Create: `frontend/src/components/BattleCardsModal.jsx`
- Create: `frontend/src/components/BattleCardsModal.css`

**Step 1: Create OutreachSequenceModal.jsx**

```jsx
// frontend/src/components/OutreachSequenceModal.jsx
import { useState } from 'react';
import './OutreachSequenceModal.css';

const API = import.meta.env.VITE_API_URL || 'http://localhost:5000';

export default function OutreachSequenceModal({ prospect, analysis, isOpen, onClose }) {
  const [touches, setTouches] = useState([]);
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(null);

  const generate = async () => {
    setLoading(true);
    setTouches([]);
    try {
      const r = await fetch(`${API}/api/generate-sequence`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ companyName: prospect.name, prospectData: prospect, analysisData: analysis })
      });
      const data = await r.json();
      setTouches(data.touches || []);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  };

  const copyTouch = (text, i) => {
    navigator.clipboard.writeText(text);
    setCopied(i);
    setTimeout(() => setCopied(null), 1500);
  };

  const exportAll = () => {
    const text = touches.map((t, i) =>
      `=== Touch ${i + 1}: ${t.type?.toUpperCase()} (Day ${t.day}) ===\n${t.subject ? `Subject: ${t.subject}\n\n` : ''}${t.body}`
    ).join('\n\n---\n\n');
    const blob = new Blob([text], { type: 'text/plain' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `${prospect.name}-outreach-sequence.txt`;
    a.click();
  };

  if (!isOpen) return null;

  const TOUCH_ICONS = { email: '📧', linkedin: '💼', call: '📞' };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-panel outreach-panel" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h2>Outreach Sequence — {prospect.name}</h2>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>

        <div className="outreach-actions">
          <button className="btn-primary" onClick={generate} disabled={loading}>
            {loading ? 'Generating...' : '⚡ Generate 4-Touch Sequence'}
          </button>
          {touches.length > 0 && <button className="btn-secondary" onClick={exportAll}>↓ Export .txt</button>}
        </div>

        {touches.length > 0 && (
          <div className="touches-list">
            {touches.map((t, i) => (
              <div key={i} className="touch-card">
                <div className="touch-header">
                  <span className="touch-icon">{TOUCH_ICONS[t.type] || '📌'}</span>
                  <span className="touch-type">{t.type?.toUpperCase()}</span>
                  <span className="touch-day">Day {t.day}</span>
                  <button className="copy-btn" onClick={() => copyTouch(`${t.subject ? `Subject: ${t.subject}\n\n` : ''}${t.body}`, i)}>
                    {copied === i ? '✓ Copied' : 'Copy'}
                  </button>
                </div>
                {t.subject && <div className="touch-subject">Subject: {t.subject}</div>}
                <div className="touch-body">{t.body}</div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
```

**Step 2: Create OutreachSequenceModal.css**

```css
/* frontend/src/components/OutreachSequenceModal.css */
.modal-overlay {
  position: fixed; inset: 0; z-index: 200;
  background: rgba(6,11,24,0.8); backdrop-filter: blur(12px);
  display: flex; align-items: center; justify-content: center;
  padding: 20px;
}

.modal-panel {
  background: #0d1626;
  border: 1px solid rgba(255,255,255,0.08);
  border-radius: 20px;
  max-width: 680px; width: 100%; max-height: 85vh;
  overflow-y: auto;
  padding: 28px;
  display: flex; flex-direction: column; gap: 20px;
}

.outreach-panel { max-width: 760px; }

.modal-header { display: flex; align-items: center; justify-content: space-between; }
.modal-header h2 { font-family: 'Space Grotesk', sans-serif; font-size: 18px; font-weight: 700; color: #f1f5f9; }
.modal-close { background: transparent; border: none; color: #64748b; font-size: 20px; cursor: pointer; }
.modal-close:hover { color: #f1f5f9; }

.outreach-actions { display: flex; gap: 10px; }

.btn-primary { background: #2563EB; color: white; border: none; border-radius: 10px; padding: 9px 18px; font-size: 13px; font-weight: 500; cursor: pointer; transition: background 0.2s; }
.btn-primary:hover { background: #1d4ed8; }
.btn-primary:disabled { opacity: 0.5; cursor: not-allowed; }
.btn-secondary { background: rgba(255,255,255,0.06); color: #cbd5e1; border: 1px solid rgba(255,255,255,0.08); border-radius: 10px; padding: 9px 16px; font-size: 13px; cursor: pointer; }

.touches-list { display: flex; flex-direction: column; gap: 12px; }

.touch-card { background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.06); border-radius: 12px; padding: 16px; }

.touch-header { display: flex; align-items: center; gap: 8px; margin-bottom: 10px; }
.touch-icon { font-size: 16px; }
.touch-type { font-size: 11px; font-weight: 700; letter-spacing: 0.08em; color: #60a5fa; }
.touch-day { font-size: 11px; color: #475569; font-family: 'JetBrains Mono', monospace; margin-left: auto; }
.copy-btn { background: transparent; border: 1px solid rgba(255,255,255,0.1); color: #94a3b8; border-radius: 6px; padding: 3px 10px; font-size: 11px; cursor: pointer; }
.copy-btn:hover { background: rgba(255,255,255,0.06); }

.touch-subject { font-size: 12px; color: #94a3b8; margin-bottom: 8px; font-style: italic; }
.touch-body { font-size: 13px; color: #cbd5e1; line-height: 1.7; white-space: pre-wrap; }
```

**Step 3: Create BattleCardsModal.jsx**

```jsx
// frontend/src/components/BattleCardsModal.jsx
import { useState, useEffect } from 'react';
import './BattleCardsModal.css';

const API = import.meta.env.VITE_API_URL || 'http://localhost:5000';

export default function BattleCardsModal({ isOpen, onClose }) {
  const [cards, setCards] = useState([]);
  const [active, setActive] = useState(0);

  useEffect(() => {
    if (isOpen && cards.length === 0) {
      fetch(`${API}/api/battle-cards`).then(r => r.json()).then(setCards).catch(console.error);
    }
  }, [isOpen]);

  if (!isOpen || cards.length === 0) return null;

  const card = cards[active];

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-panel battle-panel" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h2>Competitive Battle Cards</h2>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>

        <div className="battle-tabs">
          {cards.map((c, i) => (
            <button key={i} className={`battle-tab ${active === i ? 'active' : ''}`} onClick={() => setActive(i)}>
              {c.competitor}
            </button>
          ))}
        </div>

        <div className="battle-card">
          <div className="battle-grid">
            <div className="battle-col">
              <h4 className="col-label weakness">Their Weaknesses</h4>
              <ul>{card.weaknesses?.map((w, i) => <li key={i}>{w}</li>)}</ul>
            </div>
            <div className="battle-col">
              <h4 className="col-label strength">Their Strengths</h4>
              <ul>{card.strengths?.map((s, i) => <li key={i}>{s}</li>)}</ul>
            </div>
          </div>

          <div className="battle-win">
            <h4 className="col-label win">How Flexport Wins</h4>
            <p>{card.flexport_wins}</p>
          </div>

          <div className="battle-triggers">
            <h4 className="col-label trigger">Listen For</h4>
            <div className="trigger-pills">
              {card.trigger_phrases?.map((t, i) => <span key={i} className="trigger-pill">"{t}"</span>)}
            </div>
          </div>

          <div className="battle-talktack">
            <h4 className="col-label">Talk Track</h4>
            <p>{card.talk_track}</p>
          </div>
        </div>
      </div>
    </div>
  );
}
```

**Step 4: Create BattleCardsModal.css**

```css
/* frontend/src/components/BattleCardsModal.css */
.battle-panel { max-width: 720px; }

.battle-tabs { display: flex; gap: 6px; flex-wrap: wrap; }
.battle-tab { background: transparent; border: 1px solid rgba(255,255,255,0.08); color: #64748b; border-radius: 8px; padding: 6px 14px; font-size: 12px; cursor: pointer; transition: all 0.2s; }
.battle-tab.active, .battle-tab:hover { background: rgba(37,99,235,0.2); color: #60a5fa; border-color: rgba(37,99,235,0.4); }

.battle-card { display: flex; flex-direction: column; gap: 14px; }

.battle-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }

.battle-col { background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.06); border-radius: 10px; padding: 14px; }
.battle-col ul { padding-left: 16px; }
.battle-col li { font-size: 12px; color: #cbd5e1; line-height: 1.6; }

.col-label { font-size: 10px; text-transform: uppercase; letter-spacing: 0.08em; font-weight: 700; margin-bottom: 8px; }
.col-label.weakness { color: #ef4444; }
.col-label.strength { color: #f59e0b; }
.col-label.win { color: #10b981; }
.col-label.trigger { color: #a78bfa; }

.battle-win, .battle-triggers, .battle-talktack { background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.06); border-radius: 10px; padding: 14px; }
.battle-win p, .battle-talktack p { font-size: 13px; color: #cbd5e1; line-height: 1.6; }

.trigger-pills { display: flex; gap: 6px; flex-wrap: wrap; }
.trigger-pill { font-size: 11px; background: rgba(167,139,250,0.1); color: #a78bfa; border: 1px solid rgba(167,139,250,0.2); border-radius: 6px; padding: 3px 10px; }
```

**Step 5: Commit**

```bash
git add frontend/src/components/
git commit -m "feat: add outreach sequence builder modal and competitive battle cards"
```

---

## Task 10: Port Status Bar + Full App Rewire

**Files:**
- Create: `frontend/src/components/PortStatusBar.jsx`
- Create: `frontend/src/components/PortStatusBar.css`
- Rewrite: `frontend/src/index.css`
- Rewrite: `frontend/src/App.jsx`

**Step 1: Create PortStatusBar.jsx**

```jsx
// frontend/src/components/PortStatusBar.jsx
import { useState, useEffect } from 'react';
import './PortStatusBar.css';

const API = import.meta.env.VITE_API_URL || 'http://localhost:5000';

export default function PortStatusBar({ onPipelineClick, onBattleCardsClick }) {
  const [ports, setPorts] = useState([]);

  useEffect(() => {
    fetch(`${API}/api/globe-data`).then(r => r.json()).then(d => setPorts(d.ports || [])).catch(console.error);
  }, []);

  const statusColor = (status) => {
    if (status === 'disruption') return '#ef4444';
    if (status === 'congestion') return '#f59e0b';
    return '#10b981';
  };

  return (
    <header className="port-status-bar">
      <div className="bar-left">
        <span className="app-logo">FLEXPORT SDR</span>
        <span className="app-sub">Intelligence Hub</span>
      </div>

      <div className="ports-row">
        {ports.map((port, i) => (
          <div key={i} className="port-indicator" title={`${port.name}: Congestion ${port.congestion}/10`}>
            <span className="port-dot" style={{ background: statusColor(port.status) }} />
            <span className="port-name">{port.name}</span>
          </div>
        ))}
      </div>

      <div className="bar-right">
        <button className="bar-btn" onClick={onBattleCardsClick}>⚔ Battle Cards</button>
        <button className="bar-btn primary" onClick={onPipelineClick}>📋 Pipeline</button>
      </div>
    </header>
  );
}
```

**Step 2: Create PortStatusBar.css**

```css
/* frontend/src/components/PortStatusBar.css */
.port-status-bar {
  height: 60px; display: flex; align-items: center; gap: 20px;
  padding: 0 20px;
  background: rgba(6,11,24,0.9);
  border-bottom: 1px solid rgba(255,255,255,0.06);
  backdrop-filter: blur(20px);
  position: sticky; top: 0; z-index: 50;
}

.bar-left { display: flex; align-items: baseline; gap: 8px; flex-shrink: 0; }
.app-logo { font-family: 'Space Grotesk', sans-serif; font-size: 14px; font-weight: 700; color: #2563EB; letter-spacing: 0.05em; }
.app-sub { font-size: 11px; color: #475569; }

.ports-row { display: flex; gap: 14px; overflow-x: auto; flex: 1; align-items: center; }

.port-indicator { display: flex; align-items: center; gap: 5px; flex-shrink: 0; }
.port-dot { width: 7px; height: 7px; border-radius: 50%; flex-shrink: 0; }
.port-name { font-size: 10px; color: #64748b; white-space: nowrap; }

.bar-right { display: flex; gap: 8px; flex-shrink: 0; }
.bar-btn { background: rgba(255,255,255,0.06); border: 1px solid rgba(255,255,255,0.08); color: #94a3b8; border-radius: 8px; padding: 5px 12px; font-size: 11px; cursor: pointer; transition: all 0.2s; white-space: nowrap; }
.bar-btn:hover { background: rgba(255,255,255,0.1); color: #f1f5f9; }
.bar-btn.primary { background: rgba(37,99,235,0.2); border-color: rgba(37,99,235,0.4); color: #60a5fa; }
.bar-btn.primary:hover { background: rgba(37,99,235,0.35); }
```

**Step 3: Rewrite index.css with full design system**

Replace `frontend/src/index.css` entirely:

```css
* { margin: 0; padding: 0; box-sizing: border-box; }

@import url('https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;500;600;700&family=Inter:wght@300;400;500;600&family=JetBrains+Mono:wght@400;700&display=swap');

:root {
  --bg:        #060b18;
  --surface:   rgba(255,255,255,0.04);
  --border:    rgba(255,255,255,0.08);
  --primary:   #2563EB;
  --accent:    #00d4ff;
  --success:   #10b981;
  --warning:   #f59e0b;
  --danger:    #ef4444;
  --text:      #f1f5f9;
  --text-2:    #94a3b8;
  --text-3:    #475569;
}

body {
  font-family: 'Inter', -apple-system, sans-serif;
  background: var(--bg);
  color: var(--text);
  min-height: 100vh;
  overflow-x: hidden;
}

html, body, #root { height: 100%; width: 100%; }

/* Scrollbar */
::-webkit-scrollbar { width: 4px; height: 4px; }
::-webkit-scrollbar-track { background: transparent; }
::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.1); border-radius: 2px; }

/* Particle background */
.particle-field {
  position: fixed; inset: 0; z-index: 0; pointer-events: none; overflow: hidden;
}
.particle {
  position: absolute; border-radius: 50%;
  background: rgba(37, 99, 235, 0.15);
  animation: drift var(--dur, 30s) var(--delay, 0s) infinite linear alternate;
}
@keyframes drift {
  from { transform: translate(0, 0); }
  to   { transform: translate(var(--tx, 40px), var(--ty, 60px)); }
}

/* Glass card */
.glass-card {
  background: var(--surface);
  backdrop-filter: blur(20px);
  border: 1px solid var(--border);
  border-radius: 16px;
}
```

**Step 4: Rewrite App.jsx**

Replace `frontend/src/App.jsx` entirely:

```jsx
import { useState, useEffect } from 'react';
import PortStatusBar from './components/PortStatusBar';
import GlobeView from './components/GlobeView';
import ProspectSearch from './components/ProspectSearch';
import AnalysisPanel from './components/AnalysisPanel';
import SignalFeed from './components/SignalFeed';
import TradeDataCharts from './components/TradeDataCharts';
import TariffCalculator from './components/TariffCalculator';
import PipelineKanban from './components/PipelineKanban';
import OutreachSequenceModal from './components/OutreachSequenceModal';
import BattleCardsModal from './components/BattleCardsModal';
import './App.css';

// Generate particle field
function Particles() {
  const particles = Array.from({ length: 80 }, (_, i) => ({
    id: i,
    left: `${Math.random() * 100}%`,
    top: `${Math.random() * 100}%`,
    size: Math.random() * 3 + 1,
    dur: `${Math.random() * 30 + 20}s`,
    delay: `${Math.random() * -30}s`,
    tx: `${(Math.random() - 0.5) * 80}px`,
    ty: `${(Math.random() - 0.5) * 80}px`,
  }));
  return (
    <div className="particle-field" aria-hidden>
      {particles.map(p => (
        <div key={p.id} className="particle" style={{
          left: p.left, top: p.top,
          width: p.size, height: p.size,
          '--dur': p.dur, '--delay': p.delay,
          '--tx': p.tx, '--ty': p.ty
        }} />
      ))}
    </div>
  );
}

export default function App() {
  const [selectedProspect, setSelectedProspect] = useState(null);
  const [showPipeline, setShowPipeline] = useState(false);
  const [showBattleCards, setShowBattleCards] = useState(false);
  const [outreachState, setOutreachState] = useState({ open: false, prospect: null, analysis: null });
  const [portDetail, setPortDetail] = useState(null);

  const handlePortClick = (port) => setPortDetail(port);
  const closePortDetail = () => setPortDetail(null);

  return (
    <div className="app-root">
      <Particles />

      <PortStatusBar
        onPipelineClick={() => setShowPipeline(true)}
        onBattleCardsClick={() => setShowBattleCards(true)}
      />

      <main className="app-main">
        {/* Globe hero */}
        <section className="globe-section">
          <GlobeView
            selectedProspect={selectedProspect}
            onPortClick={handlePortClick}
          />
          {portDetail && (
            <div className="port-detail-popup glass-card" onClick={closePortDetail}>
              <strong>{portDetail.name}</strong>
              <span>Status: {portDetail.status} · Congestion {portDetail.congestion}/10</span>
              <span className="popup-close">✕</span>
            </div>
          )}
        </section>

        {/* Two-column below globe */}
        <div className="content-columns">
          {/* Left column — Prospect Intelligence */}
          <div className="left-column">
            <div className="glass-card col-section">
              <h2 className="section-title">Prospect Intelligence</h2>
              <ProspectSearch onSelect={setSelectedProspect} />
            </div>

            {selectedProspect && (
              <div className="glass-card col-section">
                <AnalysisPanel
                  prospect={selectedProspect}
                  onOpenOutreach={(prospect, analysis) =>
                    setOutreachState({ open: true, prospect, analysis })
                  }
                />
              </div>
            )}

            {selectedProspect && (
              <TariffCalculator prospectSector={selectedProspect.sector} />
            )}
          </div>

          {/* Right column — Signals + Trade Data */}
          <div className="right-column">
            <div className="glass-card col-section">
              <SignalFeed />
            </div>
            <TradeDataCharts />
          </div>
        </div>
      </main>

      {/* Pipeline Kanban */}
      <PipelineKanban isOpen={showPipeline} onClose={() => setShowPipeline(false)} />

      {/* Modals */}
      <OutreachSequenceModal
        isOpen={outreachState.open}
        prospect={outreachState.prospect}
        analysis={outreachState.analysis}
        onClose={() => setOutreachState({ open: false, prospect: null, analysis: null })}
      />
      <BattleCardsModal isOpen={showBattleCards} onClose={() => setShowBattleCards(false)} />
    </div>
  );
}
```

**Step 5: Create App.css**

Replace `frontend/src/App.css` entirely:

```css
/* frontend/src/App.css */
.app-root { position: relative; min-height: 100vh; display: flex; flex-direction: column; }

.app-main { position: relative; z-index: 1; flex: 1; display: flex; flex-direction: column; }

.globe-section { position: relative; }

.port-detail-popup {
  position: absolute; bottom: 20px; left: 50%; transform: translateX(-50%);
  display: flex; align-items: center; gap: 12px;
  padding: 12px 20px; cursor: pointer;
  font-size: 13px; color: #f1f5f9;
  z-index: 10;
}
.popup-close { color: #64748b; margin-left: 8px; }

.content-columns {
  display: grid; grid-template-columns: 60% 40%;
  gap: 16px; padding: 20px;
}

.left-column, .right-column { display: flex; flex-direction: column; gap: 16px; }

.col-section { padding: 20px; }

.section-title {
  font-family: 'Space Grotesk', sans-serif;
  font-size: 16px; font-weight: 600; color: #f1f5f9;
  margin-bottom: 16px;
}

@media (max-width: 900px) {
  .content-columns { grid-template-columns: 1fr; }
}
```

**Step 6: Update .env.example with new keys**

Add to `backend/.env.example`:

```
OPENAI_API_KEY=
NEWS_API_KEY=
SERPER_API_KEY=
FRED_API_KEY=
RAPIDAPI_KEY=
DB_PATH=./flexport.db
PORT=5000
```

Add to `frontend/.env.example`:

```
VITE_API_URL=http://localhost:5000
```

**Step 7: Full smoke test**

```bash
# Terminal 1: backend
cd backend && npm run dev

# Terminal 2: frontend
cd frontend && npm run dev

# Open http://localhost:5173
# Verify: globe rotates, port dots visible
# Select a prospect → globe arcs change
# Click "Run AI Analysis"
# Open pipeline, drag a card
# Open battle cards
# Generate outreach sequence
```

**Step 8: Commit**

```bash
git add frontend/src/
git add backend/.env.example frontend/.env.example
git commit -m "feat: complete UI overhaul — port status bar, particle field, new layout, all components wired"
```

---

## Task 11: Deploy

**Files:**
- Create: `frontend/vercel.json`
- Create: `backend/.env.production` (update)

**Step 1: Create frontend/vercel.json**

```json
{
  "rewrites": [{ "source": "/(.*)", "destination": "/" }]
}
```

**Step 2: Deploy frontend to Vercel**

```bash
cd frontend
npm run build  # Verify build succeeds locally first
# Expected: dist/ folder created, no errors

npx vercel --prod
# Set env var in Vercel dashboard: VITE_API_URL=https://your-railway-url.up.railway.app
```

**Step 3: Deploy backend to Railway**

1. Go to railway.app → New Project → Deploy from GitHub repo
2. Set root directory to `backend/`
3. Add env vars in Railway dashboard:
   - `OPENAI_API_KEY`
   - `NEWS_API_KEY`
   - `SERPER_API_KEY`
   - `FRED_API_KEY`
   - `NODE_ENV=production`
4. Railway auto-detects `npm start` from package.json
5. After deploy, run init + seed on Railway shell:
   ```bash
   node initDb.js && node data/seedProspects.js
   ```

**Step 4: Update CORS for production**

In `backend/server.js`, update CORS:

```js
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:5173'
}));
```

Add `FRONTEND_URL=https://your-vercel-url.vercel.app` to Railway env vars.

**Step 5: Final verification**

```bash
curl https://your-railway-url.up.railway.app/api/prospects?limit=3
# Expected: JSON array of 3 prospects

# Open Vercel URL in browser:
# - Globe loads and rotates
# - Prospect list populated
# - Analysis runs successfully
```

**Step 6: Final commit**

```bash
git add frontend/vercel.json backend/server.js
git commit -m "feat: production deployment config — Vercel frontend, Railway backend"
git push origin main
```

---

## Quick Reference: Env Vars Needed

| Variable | Where to get |
|----------|-------------|
| `OPENAI_API_KEY` | platform.openai.com |
| `NEWS_API_KEY` | newsapi.org (free tier: 100 req/day) |
| `SERPER_API_KEY` | serper.dev (already configured) |
| `FRED_API_KEY` | fred.stlouisfed.org/docs/api (free, instant) |
| `RAPIDAPI_KEY` | rapidapi.com (for future import records feature) |

## New npm Packages Summary

**Frontend:**
```bash
cd frontend
npm install react-globe.gl three recharts @dnd-kit/core @dnd-kit/sortable @dnd-kit/utilities
```

**Backend:**
```bash
cd backend
npm install --save-dev jest supertest
```
