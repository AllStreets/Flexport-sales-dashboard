// backend/server.js
const express = require('express');
const cors = require('cors');
require('dotenv').config();

const app = express();
app.use(cors({
  origin: (origin, cb) => {
    if (!origin) return cb(null, true); // non-browser / server-to-server
    if (/localhost/.test(origin)) return cb(null, true);
    if (/vercel\.app$/.test(origin)) return cb(null, true);
    if (process.env.FRONTEND_URL && origin === process.env.FRONTEND_URL) return cb(null, true);
    cb(new Error('CORS: origin not allowed'));
  }
}));
app.use(express.json());

const { getProspects, getProspectById, getSectors } = require('./services/prospectsService');
const { saveAnalysis, getAllAnalyses, toggleFavorite, deleteAnalysis } = require('./services/database');
const { analyzeForFlexport } = require('./services/flexportAnalyzer');
const { fetchAndScoreSignals } = require('./services/signalsService');
const { getTradeData, refreshAllTradeCache } = require('./services/fredService');
const { getPipeline, addToPipeline, updatePipeline, removeFromPipeline } = require('./services/pipelineService');
const { aggregateCompanyData } = require('./services/dataAggregator');
const { getTradeIntelligence } = require('./services/tradeIntelligenceService');
const { initDb, getPerformanceSummary, logActivity, getWinLoss, addWinLoss } = require('./services/performanceService');
const { getPortCongestion } = require('./services/portCongestionService');

// Shared DB helper for inline endpoints
const sqlite3 = require('sqlite3').verbose();
const path = require('path');
function getDb() {
  return new sqlite3.Database(process.env.DB_PATH || path.join(__dirname, 'flexport.db'));
}
const { lookupHSCode } = require('./services/usitcService');

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
const SHIPPING_LANES = [
  // ── Trans-Pacific ────────────────────────────────────────────────────────────
  { src_lat: 31.2,  src_lng: 121.5, dst_lat: 33.7,  dst_lng: -118.2, label: 'China-US West Coast',   weight: 10 },
  { src_lat: 31.2,  src_lng: 121.5, dst_lat: 40.7,  dst_lng: -74.0,  label: 'China-US East Coast',   weight: 7  },
  { src_lat: 10.8,  src_lng: 106.7, dst_lat: 33.7,  dst_lng: -118.2, label: 'Vietnam-US West',       weight: 6  },
  { src_lat: 35.7,  src_lng: 139.7, dst_lat: 33.7,  dst_lng: -118.2, label: 'Japan-US West',         weight: 5  },
  { src_lat: 35.1,  src_lng: 129.0, dst_lat: 33.7,  dst_lng: -118.2, label: 'Korea-US West',         weight: 5  },
  { src_lat: 25.0,  src_lng: 121.5, dst_lat: 33.7,  dst_lng: -118.2, label: 'Taiwan-US West',        weight: 4  },
  { src_lat: 1.35,  src_lng: 103.8, dst_lat: 40.7,  dst_lng: -74.0,  label: 'SE Asia-US East',       weight: 7  },
  { src_lat: 22.3,  src_lng: 114.2, dst_lat: 40.7,  dst_lng: -74.0,  label: 'HK-US East',            weight: 4  },
  // ── Asia-Europe ──────────────────────────────────────────────────────────────
  { src_lat: 31.2,  src_lng: 121.5, dst_lat: 51.9,  dst_lng: 4.5,    label: 'China-Rotterdam',       weight: 8  },
  { src_lat: 10.8,  src_lng: 106.7, dst_lat: 51.9,  dst_lng: 4.5,    label: 'SE Asia-Europe',        weight: 4  },
  // ── South Asia-US ────────────────────────────────────────────────────────────
  { src_lat: 19.0,  src_lng: 72.8,  dst_lat: 33.7,  dst_lng: -118.2, label: 'India-US West',         weight: 5  },
  { src_lat: 19.0,  src_lng: 72.8,  dst_lat: 40.7,  dst_lng: -74.0,  label: 'India-US East',         weight: 4  },
  // ── Atlantic ─────────────────────────────────────────────────────────────────
  { src_lat: 51.9,  src_lng: 4.5,   dst_lat: 40.7,  dst_lng: -74.0,  label: 'Europe-US East',        weight: 6  },
  { src_lat: 41.0,  src_lng: 28.9,  dst_lat: 51.9,  dst_lng: 4.5,    label: 'Turkey-Europe',         weight: 3  },
  // ── Middle East / Africa ─────────────────────────────────────────────────────
  { src_lat: 25.0,  src_lng: 55.1,  dst_lat: 51.9,  dst_lng: 4.5,    label: 'Middle East-Europe',    weight: 5  },
  { src_lat: -29.9, src_lng: 31.0,  dst_lat: 51.9,  dst_lng: 4.5,    label: 'Africa-Europe',         weight: 3  },
  // ── Americas ─────────────────────────────────────────────────────────────────
  { src_lat: 19.4,  src_lng: -99.1, dst_lat: 29.7,  dst_lng: -95.0,  label: 'Mexico-US South',       weight: 5  },
  { src_lat: -23.9, src_lng: -46.3, dst_lat: 40.7,  dst_lng: -74.0,  label: 'Brazil-US East',        weight: 3  },
  { src_lat: -12.0, src_lng: -77.1, dst_lat: 33.7,  dst_lng: -118.2, label: 'Peru-US West',          weight: 3  },
  // ── Australia ────────────────────────────────────────────────────────────────
  { src_lat: -33.9, src_lng: 151.2, dst_lat: 33.7,  dst_lng: -118.2, label: 'Australia-US West',     weight: 3  },
];

app.get('/api/globe-data', async (req, res) => {
  try {
    const ports = await getPortCongestion();
    res.json({ shippingLanes: SHIPPING_LANES, ports });
  } catch {
    // Fallback to baseline values if service fails
    res.json({
      shippingLanes: SHIPPING_LANES,
      ports: [
        // ── US ──
        { name: 'LA/Long Beach',         lat: 33.74,  lng: -118.26, status: 'congestion', congestion: 6 },
        { name: 'New York/New Jersey',   lat: 40.68,  lng: -74.05,  status: 'congestion', congestion: 5 },
        { name: 'Savannah',              lat: 32.08,  lng: -81.09,  status: 'clear',      congestion: 3 },
        { name: 'Seattle/Tacoma',        lat: 47.27,  lng: -122.42, status: 'clear',      congestion: 2 },
        { name: 'Houston',               lat: 29.73,  lng: -95.02,  status: 'clear',      congestion: 4 },
        { name: 'Charleston',            lat: 32.78,  lng: -79.93,  status: 'clear',      congestion: 2 },
        { name: 'Norfolk/Hampton Roads', lat: 36.97,  lng: -76.33,  status: 'clear',      congestion: 2 },
        { name: 'Oakland',               lat: 37.80,  lng: -122.28, status: 'clear',      congestion: 4 },
        { name: 'Baltimore',             lat: 39.27,  lng: -76.58,  status: 'congestion', congestion: 5 },
        { name: 'Miami',                 lat: 25.77,  lng: -80.18,  status: 'clear',      congestion: 3 },
        // ── Asia-Pacific ──
        { name: 'Shanghai',              lat: 31.22,  lng: 121.47,  status: 'clear',      congestion: 4 },
        { name: 'Ningbo-Zhoushan',       lat: 29.87,  lng: 121.55,  status: 'clear',      congestion: 4 },
        { name: 'Yantian/Shenzhen',      lat: 22.57,  lng: 114.27,  status: 'clear',      congestion: 4 },
        { name: 'Guangzhou/Nansha',      lat: 22.74,  lng: 113.62,  status: 'clear',      congestion: 3 },
        { name: 'Tianjin',               lat: 39.00,  lng: 117.73,  status: 'clear',      congestion: 3 },
        { name: 'Busan',                 lat: 35.10,  lng: 129.04,  status: 'clear',      congestion: 2 },
        { name: 'Singapore',             lat: 1.26,   lng: 103.82,  status: 'clear',      congestion: 3 },
        { name: 'Port Klang',            lat: 3.00,   lng: 101.40,  status: 'clear',      congestion: 2 },
        { name: 'Tanjung Pelepas',       lat: 1.37,   lng: 103.55,  status: 'clear',      congestion: 2 },
        { name: 'Ho Chi Minh City',      lat: 10.77,  lng: 106.72,  status: 'congestion', congestion: 5 },
        { name: 'Hong Kong',             lat: 22.29,  lng: 114.17,  status: 'clear',      congestion: 3 },
        // ── Middle East / Europe ──
        { name: 'Jebel Ali',             lat: 25.01,  lng: 55.06,   status: 'clear',      congestion: 4 },
        { name: 'Colombo',               lat: 6.94,   lng: 79.84,   status: 'clear',      congestion: 2 },
        { name: 'Rotterdam',             lat: 51.95,  lng: 4.13,    status: 'clear',      congestion: 3 },
        { name: 'Antwerp',               lat: 51.26,  lng: 4.40,    status: 'clear',      congestion: 3 },
        { name: 'Hamburg',               lat: 53.54,  lng: 9.97,    status: 'congestion', congestion: 5 },
        { name: 'Felixstowe',            lat: 51.96,  lng: 1.35,    status: 'congestion', congestion: 6 },
        { name: 'Piraeus',               lat: 37.94,  lng: 23.63,   status: 'clear',      congestion: 4 },
        // ── Africa ──
        { name: 'Durban',                lat: -29.87, lng: 31.03,   status: 'disruption', congestion: 8 },
        { name: 'Tangier Med',           lat: 35.88,  lng: -5.50,   status: 'clear',      congestion: 2 },
        { name: 'Port Said',             lat: 31.26,  lng: 32.30,   status: 'congestion', congestion: 6 },
        // ── South America ──
        { name: 'Santos',                lat: -23.95, lng: -46.33,  status: 'congestion', congestion: 6 },
        { name: 'Callao',                lat: -12.04, lng: -77.14,  status: 'clear',      congestion: 4 },
        { name: 'Buenos Aires',          lat: -34.59, lng: -58.37,  status: 'clear',      congestion: 4 },
        // ── Australia ──
        { name: 'Melbourne',             lat: -37.83, lng: 144.93,  status: 'clear',      congestion: 3 },
        { name: 'Sydney/Port Botany',    lat: -33.97, lng: 151.22,  status: 'clear',      congestion: 2 },
        { name: 'Brisbane',              lat: -27.38, lng: 153.17,  status: 'clear',      congestion: 2 },
      ]
    });
  }
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
      model: 'gpt-4.1-mini', max_tokens: 1200,
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

// ── Trade Intelligence ─────────────────────────────
app.get('/api/trade-intelligence', async (req, res) => {
  try { res.json(await getTradeIntelligence()); }
  catch (e) { res.status(500).json({ error: e.message }); }
});

// ── Account 360 ────────────────────────────────────
app.get('/api/account360/:id', async (req, res) => {
  try {
    const prospect = await getProspectById(req.params.id);
    const aggregated = await aggregateCompanyData(prospect.name);
    res.json({ prospect, news: aggregated.news || [], searchResults: aggregated.searchResults || [] });
  } catch (e) { res.status(e.message === 'Prospect not found' ? 404 : 500).json({ error: e.message }); }
});

// ── Performance ────────────────────────────────────
app.get('/api/performance', async (req, res) => {
  try { res.json(await getPerformanceSummary()); }
  catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/performance/activity', async (req, res) => {
  try { res.status(201).json(await logActivity(req.body)); }
  catch (e) { res.status(500).json({ error: e.message }); }
});

// ── Win / Loss ─────────────────────────────────────
app.get('/api/win-loss', async (req, res) => {
  try { res.json(await getWinLoss()); }
  catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/win-loss', async (req, res) => {
  try { res.status(201).json(await addWinLoss(req.body)); }
  catch (e) { res.status(500).json({ error: e.message }); }
});

// ── Market Map ─────────────────────────────────────
app.get('/api/market-map', async (req, res) => {
  try {
    const db = getDb();
    const all = await new Promise((resolve, reject) => {
      db.all(`
        SELECT p.*, pl.stage AS pipeline_stage
        FROM prospects p
        LEFT JOIN pipeline pl ON pl.prospect_id = p.id
        ORDER BY p.icp_score DESC
      `, [], (err, rows) => {
        db.close();
        if (err) return reject(err);
        resolve(rows.map(r => ({
          ...r,
          import_origins: JSON.parse(r.import_origins || '[]'),
          primary_lanes: JSON.parse(r.primary_lanes || '[]'),
        })));
      });
    });
    const bySector = {};
    all.forEach(p => {
      const s = p.sector || 'Other';
      if (!bySector[s]) bySector[s] = [];
      bySector[s].push(p);
    });
    const sectors = Object.entries(bySector).map(([sector, prospects]) => ({
      sector,
      count: prospects.length,
      avgIcp: Math.round(prospects.reduce((s, p) => s + (p.icp_score || 0), 0) / prospects.length),
      prospects: prospects.sort((a, b) => (b.icp_score || 0) - (a.icp_score || 0))
    })).sort((a, b) => b.avgIcp - a.avgIcp);
    res.json(sectors);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── HS Code Lookup ─────────────────────────────────
const HS_CODES = {
  '8471': { desc: 'Computers & peripherals', rate: 0.00, section301: 0.25 },
  '8517': { desc: 'Smartphones & telecom equipment', rate: 0.00, section301: 0.25 },
  '6110': { desc: 'Knitted sweaters & pullovers', rate: 0.12, section301: 0 },
  '9403': { desc: 'Furniture (other)', rate: 0.05, section301: 0.25 },
  '8415': { desc: 'Air conditioning machines', rate: 0.01, section301: 0.25 },
  '9504': { desc: 'Video game consoles & equipment', rate: 0.00, section301: 0.25 },
  '3304': { desc: 'Beauty & skincare preparations', rate: 0.00, section301: 0 },
  '6204': { desc: "Women's apparel", rate: 0.12, section301: 0 },
  '8703': { desc: 'Passenger automobiles', rate: 0.025, section301: 0 },
  '8708': { desc: 'Auto parts & accessories', rate: 0.025, section301: 0.25 },
  '3926': { desc: 'Plastic articles (misc.)', rate: 0.053, section301: 0.25 },
  '7318': { desc: 'Screws, bolts, nuts (iron/steel)', rate: 0.062, section301: 0.25 },
  '8544': { desc: 'Insulated wire & cable', rate: 0.026, section301: 0.25 },
  '3005': { desc: 'Medical dressings & bandages', rate: 0.00, section301: 0 },
  '9506': { desc: 'Sports equipment & apparatus', rate: 0.04, section301: 0 },
  '4202': { desc: 'Luggage & handbags', rate: 0.158, section301: 0 },
  '6403': { desc: 'Footwear with leather uppers', rate: 0.085, section301: 0 },
  '2106': { desc: 'Food preparations (misc.)', rate: 0.086, section301: 0 },
  '8501': { desc: 'Electric motors & generators', rate: 0.025, section301: 0.25 },
  '9401': { desc: 'Seating furniture', rate: 0.00, section301: 0.25 },
  '6109': { desc: 'T-shirts & tank tops', rate: 0.165, section301: 0 },
  '8528': { desc: 'Monitors, TVs & displays', rate: 0.00, section301: 0.25 },
};

app.get('/api/hs-lookup', async (req, res) => {
  const q = (req.query.q || '').trim();
  if (!q) return res.json([]);

  // Try live USITC HTS API first
  try {
    const usitcResults = await lookupHSCode(q);
    if (usitcResults.length > 0) {
      // Merge with local §301 data where we have it
      const enriched = usitcResults.map(r => {
        const local = HS_CODES[r.htsno?.slice(0, 4)] || {};
        return {
          code:       r.htsno,
          desc:       r.description,
          rate:       r.generalRate ?? local.rate ?? null,
          section301: local.section301 ?? 0,
          general:    r.general,
          special:    r.special,
          source:     'usitc',
        };
      });
      return res.json(enriched.slice(0, 5));
    }
  } catch { /* fall through to local */ }

  // Fallback: local hardcoded HS_CODES
  const results = Object.entries(HS_CODES)
    .filter(([code, info]) => code.startsWith(q) || info.desc.toLowerCase().includes(q.toLowerCase()))
    .map(([code, info]) => ({ code, ...info, source: 'local' }));
  res.json(results.slice(0, 5));
});

// ── Follow-up Radar ────────────────────────────────
app.get('/api/followup-radar', (req, res) => {
  const db = getDb();
  db.all(`
    SELECT p.id, p.company_name, p.stage, pr.icp_score, pr.sector,
      MAX(a.date) as last_contact,
      CASE
        WHEN MAX(a.date) IS NULL THEN 999
        ELSE CAST(julianday('now', 'localtime') - julianday(MAX(a.date)) AS INTEGER)
      END as days_since
    FROM pipeline p
    LEFT JOIN prospects pr ON p.prospect_id = pr.id
    LEFT JOIN sdr_activities a ON lower(a.company_name) = lower(p.company_name)
    WHERE p.stage NOT IN ('closed_won', 'closed_lost')
    GROUP BY p.id
    HAVING days_since >= 3
    ORDER BY pr.icp_score DESC, days_since DESC
    LIMIT 12
  `, [], (err, rows) => {
    db.close();
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});

// ── Pipeline Velocity ───────────────────────────────
app.get('/api/pipeline-velocity', (req, res) => {
  const db = getDb();
  db.all(`
    SELECT stage,
      COUNT(*) as count,
      ROUND(AVG(julianday('now', 'localtime') - julianday(updated_at)), 1) as avg_days,
      COUNT(CASE WHEN julianday('now', 'localtime') - julianday(updated_at) > 7 THEN 1 END) as stuck_count
    FROM pipeline
    WHERE stage NOT IN ('closed_won', 'closed_lost')
    GROUP BY stage
    ORDER BY CASE stage
      WHEN 'new' THEN 1 WHEN 'researched' THEN 2
      WHEN 'called' THEN 3 WHEN 'demo_booked' THEN 4
      ELSE 5 END
  `, [], (err, rows) => {
    db.close();
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});

// ── Route Optimizer ────────────────────────────────
app.post('/api/route-optimize', (req, res) => {
  const { origin, destination } = req.body;
  // Transit benchmarks based on 2024-2025 ocean freight data (days port-to-port)
  const ROUTES = {
    // Trans-Pacific
    'China-US West Coast':   { flexport: 16, industry: 21, costSave: 11, risk: 'medium' },
    'China-US East Coast':   { flexport: 30, industry: 36, costSave: 9,  risk: 'medium' },
    'Vietnam-US West':       { flexport: 17, industry: 22, costSave: 13, risk: 'low'    },
    'Japan-US West':         { flexport: 12, industry: 16, costSave: 8,  risk: 'low'    },
    'Korea-US West':         { flexport: 14, industry: 18, costSave: 9,  risk: 'low'    },
    'Taiwan-US West':        { flexport: 14, industry: 19, costSave: 10, risk: 'low'    },
    'SE Asia-US East':       { flexport: 25, industry: 31, costSave: 12, risk: 'medium' },
    'HK-US East':            { flexport: 28, industry: 34, costSave: 9,  risk: 'medium' },
    // Asia-Europe (Red Sea rerouting via Cape adds transit time)
    'China-Rotterdam':       { flexport: 28, industry: 38, costSave: 10, risk: 'high'   },
    'SE Asia-Europe':        { flexport: 25, industry: 34, costSave: 11, risk: 'high'   },
    // South Asia
    'India-US West':         { flexport: 22, industry: 28, costSave: 10, risk: 'low'    },
    'India-US East':         { flexport: 28, industry: 34, costSave: 9,  risk: 'low'    },
    // Atlantic
    'Europe-US East':        { flexport: 12, industry: 16, costSave: 8,  risk: 'low'    },
    'Turkey-Europe':         { flexport: 8,  industry: 12, costSave: 10, risk: 'medium' },
    // Middle East / Africa
    'Middle East-Europe':    { flexport: 14, industry: 19, costSave: 11, risk: 'high'   },
    'Africa-Europe':         { flexport: 18, industry: 24, costSave: 9,  risk: 'medium' },
    // Americas
    'Mexico-US South':       { flexport: 4,  industry: 7,  costSave: 14, risk: 'low'    },
    'Brazil-US East':        { flexport: 14, industry: 19, costSave: 10, risk: 'low'    },
    'Peru-US West':          { flexport: 16, industry: 21, costSave: 9,  risk: 'low'    },
    // Australia
    'Australia-US West':     { flexport: 19, industry: 25, costSave: 10, risk: 'low'    },
  };
  const key = `${origin}-${destination}`;
  const route = ROUTES[key] || ROUTES['China-US West Coast'];
  res.json({ origin, destination, ...route, timestamp: new Date().toISOString() });
});

// ── AI Utilities ───────────────────────────────────
app.post('/api/call-prep', async (req, res) => {
  const { companyName, prospectData, analysisData } = req.body;
  if (!companyName) return res.status(400).json({ error: 'companyName required' });
  try {
    const axios = require('axios');
    const prompt = `Generate a concise pre-call prep sheet for a Flexport SDR calling ${companyName}.
Context: ${JSON.stringify({ prospectData, analysisData })}
Return JSON: {
  "opening_hook": "30-second opener referencing their specific supply chain",
  "discovery_questions": ["Question 1", "Question 2", "Question 3"],
  "pain_points_to_surface": ["Pain 1", "Pain 2"],
  "flexport_value_props": ["Value prop 1", "Value prop 2"],
  "objection_responses": [{"objection": "We have a forwarder", "response": "..."}],
  "call_to_action": "Specific next step to propose"
}`;
    const r = await axios.post('https://api.openai.com/v1/chat/completions', {
      model: 'gpt-4.1-mini', max_tokens: 800,
      messages: [{ role: 'user', content: prompt }]
    }, { headers: { 'Authorization': `Bearer ${process.env.OPENAI_API_KEY}` } });
    const m = r.data.choices[0].message.content.match(/\{[\s\S]*\}/);
    res.json(m ? JSON.parse(m[0]) : {});
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/objection', async (req, res) => {
  const { objection, companyName, context } = req.body;
  if (!objection) return res.status(400).json({ error: 'objection required' });
  try {
    const axios = require('axios');
    const prompt = `You are a Flexport SDR coach. Provide a concise, confident response to this sales objection.
Company: ${companyName || 'unknown'}
Context: ${JSON.stringify(context || {})}
Objection: "${objection}"
Return JSON: { "response": "2-3 sentence counter", "follow_up_question": "Question to keep conversation going" }`;
    const r = await axios.post('https://api.openai.com/v1/chat/completions', {
      model: 'gpt-4.1-mini', max_tokens: 300,
      messages: [{ role: 'user', content: prompt }]
    }, { headers: { 'Authorization': `Bearer ${process.env.OPENAI_API_KEY}` } });
    const m = r.data.choices[0].message.content.match(/\{[\s\S]*\}/);
    res.json(m ? JSON.parse(m[0]) : {});
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/map-plan', async (req, res) => {
  const { companyName, prospectData } = req.body;
  if (!companyName) return res.status(400).json({ error: 'companyName required' });
  try {
    const axios = require('axios');
    const prompt = `Create a Mutual Action Plan (MAP) for a Flexport SDR closing a deal with ${companyName}.
Context: ${JSON.stringify(prospectData || {})}
Return JSON: {
  "milestones": [
    {"day": 1, "owner": "SDR", "action": "..."},
    {"day": 3, "owner": "Prospect", "action": "..."},
    {"day": 7, "owner": "Both", "action": "..."},
    {"day": 14, "owner": "Flexport", "action": "..."},
    {"day": 21, "owner": "Both", "action": "..."}
  ],
  "success_criteria": "What does success look like at 90 days"
}`;
    const r = await axios.post('https://api.openai.com/v1/chat/completions', {
      model: 'gpt-4.1-mini', max_tokens: 600,
      messages: [{ role: 'user', content: prompt }]
    }, { headers: { 'Authorization': `Bearer ${process.env.OPENAI_API_KEY}` } });
    const m = r.data.choices[0].message.content.match(/\{[\s\S]*\}/);
    res.json(m ? JSON.parse(m[0]) : {});
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/first-line', async (req, res) => {
  const { companyName, prospectData, signal } = req.body;
  if (!companyName) return res.status(400).json({ error: 'companyName required' });
  try {
    const axios = require('axios');
    const prompt = `Write a single hyper-personalized cold email opening line for a Flexport SDR reaching out to ${companyName}.
Context: ${JSON.stringify({ prospectData, signal })}
Rules: Under 25 words. Reference something specific (a lane, a recent event, their imports). No generic phrases.
Return JSON: { "first_line": "..." }`;
    const r = await axios.post('https://api.openai.com/v1/chat/completions', {
      model: 'gpt-4.1-mini', max_tokens: 100,
      messages: [{ role: 'user', content: prompt }]
    }, { headers: { 'Authorization': `Bearer ${process.env.OPENAI_API_KEY}` } });
    const m = r.data.choices[0].message.content.match(/\{[\s\S]*\}/);
    res.json(m ? JSON.parse(m[0]) : { first_line: '' });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── FX Rates — live from exchangerate-api.com, 5-min cache ───────────────
let _fxCache = null, _fxCacheAt = 0;
app.get('/api/fx-rates', async (req, res) => {
  if (_fxCache && Date.now() - _fxCacheAt < 5 * 60 * 1000) return res.json(_fxCache);
  const key = process.env.EXCHANGE_RATE_API_KEY;
  if (!key) return res.json({ source: 'static', rates: null });
  try {
    const axios = require('axios');
    const r = await axios.get(`https://v6.exchangerate-api.com/v6/${key}/latest/USD`);
    const raw = r.data.conversion_rates || {};
    const pairs = [
      { pair: 'USD/CNY', symbol: 'CNY', note: 'China Yuan' },
      { pair: 'USD/EUR', symbol: 'EUR', note: 'Euro' },
      { pair: 'USD/VND', symbol: 'VND', note: 'Vietnam Dong' },
      { pair: 'USD/INR', symbol: 'INR', note: 'Indian Rupee' },
      { pair: 'USD/MXN', symbol: 'MXN', note: 'Mexican Peso' },
      { pair: 'USD/KRW', symbol: 'KRW', note: 'Korean Won' },
      { pair: 'USD/JPY', symbol: 'JPY', note: 'Japanese Yen' },
      { pair: 'USD/SGD', symbol: 'SGD', note: 'Singapore Dollar' },
    ];
    const rates = pairs.map(p => ({ pair: p.pair, rate: raw[p.symbol] || null, note: p.note, pct: 0 }));
    _fxCache = { source: 'live', updated: new Date().toISOString(), rates };
    _fxCacheAt = Date.now();
    res.json(_fxCache);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── Hot Prospects — opportunity-scored from SQLite ────────────────────────
app.get('/api/hot-prospects', (req, res) => {
  const db = getDb();
  const sql = `
    SELECT p.id, p.name, p.sector, p.hq_location, p.icp_score, p.shipping_volume_estimate,
           pl.stage AS pipeline_stage,
           p.icp_score + CASE pl.stage
             WHEN 'demo_booked' THEN 20
             WHEN 'called'      THEN 15
             WHEN 'researched'  THEN 10
             WHEN 'new'         THEN 5
             ELSE 0
           END AS opp_score
    FROM prospects p
    LEFT JOIN pipeline pl ON pl.prospect_id = p.id
    WHERE p.icp_score >= 70
    ORDER BY opp_score DESC
    LIMIT 8`;
  db.all(sql, [], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows || []);
  });
});

// ── Trigger Events — NewsAPI supply chain news, 30-min cache ──────────────
let _triggerCache = null, _triggerCacheAt = 0;
const TRIGGER_FALLBACK = [
  { headline: 'Apple shifts 25% of iPhone production from China to India amid tariff concerns', sector: 'Electronics', urgency: 'high', date: 'Mar 2026' },
  { headline: 'Nike announces Vietnam manufacturing capacity expansion — 3 new factories', sector: 'Apparel', urgency: 'high', date: 'Mar 2026' },
  { headline: 'Target reports Q4 inventory glut — import velocity expected to slow 15%', sector: 'E-commerce', urgency: 'medium', date: 'Feb 2026' },
  { headline: 'TSMC Arizona fab ramp-up — domestic semiconductor logistics demand rising', sector: 'Electronics', urgency: 'medium', date: 'Feb 2026' },
  { headline: 'Walmart nearshoring push — 5 Mexican suppliers added for 2026', sector: 'Retail / CPG', urgency: 'medium', date: 'Jan 2026' },
  { headline: 'Amazon repatriates 8% of SKUs from China warehouses to US 3PL network', sector: 'E-commerce', urgency: 'low', date: 'Jan 2026' },
];
app.get('/api/trigger-events', async (req, res) => {
  if (_triggerCache && Date.now() - _triggerCacheAt < 30 * 60 * 1000) return res.json(_triggerCache);
  const key = process.env.NEWSAPI_KEY;
  if (!key) return res.json({ source: 'static', events: TRIGGER_FALLBACK });
  try {
    const axios = require('axios');
    const q = encodeURIComponent('supply chain sourcing manufacturing import freight logistics');
    const url = `https://newsapi.org/v2/everything?q=${q}&language=en&sortBy=publishedAt&pageSize=8&apiKey=${key}`;
    const r = await axios.get(url);
    const articles = (r.data.articles || []).map(a => ({
      headline: a.title,
      sector: 'General',
      urgency: 'medium',
      date: a.publishedAt ? new Date(a.publishedAt).toLocaleDateString('en-US', { month: 'short', year: 'numeric' }) : '',
      url: a.url,
    }));
    const result = { source: articles.length ? 'live' : 'static', events: articles.length ? articles : TRIGGER_FALLBACK };
    _triggerCache = result;
    _triggerCacheAt = Date.now();
    res.json(result);
  } catch (e) { res.json({ source: 'static', events: TRIGGER_FALLBACK }); }
});

// ── Semantic Prospect Search — GPT parses NL query → prospect filters ─────
app.post('/api/semantic-search', async (req, res) => {
  const { query } = req.body;
  if (!query) return res.status(400).json({ error: 'query required' });
  try {
    const axios = require('axios');
    const prompt = `You are a sales intelligence assistant for Flexport. Parse this natural language prospect search query into structured filters.
Query: "${query}"
Return ONLY JSON: { "search": string, "sector": string, "icp_min": number }
Sector options: Electronics, Apparel, Automotive, Pharma, Retail / CPG, E-commerce, Food & Beverage, Industrial
Use empty string if no clear filter applies. Return valid JSON only.`;
    const r = await axios.post('https://api.openai.com/v1/chat/completions', {
      model: 'gpt-4.1-mini', max_tokens: 150,
      messages: [{ role: 'user', content: prompt }]
    }, { headers: { 'Authorization': `Bearer ${process.env.OPENAI_API_KEY}` } });
    const m = r.data.choices[0].message.content.match(/\{[\s\S]*\}/);
    const filters = m ? JSON.parse(m[0]) : {};
    const { getProspects } = require('./services/prospectsService');
    const results = await getProspects({ ...filters, limit: 20 });
    res.json({ filters, results });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── Signal-to-Prospect Matching — GPT maps signals to sectors + talking pts ─
app.post('/api/signal-match', async (req, res) => {
  const { signal } = req.body;
  if (!signal) return res.status(400).json({ error: 'signal required' });
  try {
    const axios = require('axios');
    const prompt = `You are a Flexport SDR assistant. A supply chain signal has been detected. Identify which prospect sectors are most affected and generate outreach talking points.
Signal: "${signal}"
Return JSON: {
  "affected_sectors": ["Sector1", "Sector2"],
  "talking_points": ["point 1", "point 2", "point 3"],
  "urgency": "high|medium|low",
  "flexport_angle": "how Flexport specifically helps with this signal"
}`;
    const r = await axios.post('https://api.openai.com/v1/chat/completions', {
      model: 'gpt-4.1-mini', max_tokens: 400,
      messages: [{ role: 'user', content: prompt }]
    }, { headers: { 'Authorization': `Bearer ${process.env.OPENAI_API_KEY}` } });
    const m = r.data.choices[0].message.content.match(/\{[\s\S]*\}/);
    if (!m) return res.status(500).json({ error: 'parse failed' });
    res.json(JSON.parse(m[0]));
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── Call Intelligence Parser — GPT extracts structured data from call notes ─
app.post('/api/call-intelligence', async (req, res) => {
  const { notes, companyName } = req.body;
  if (!notes) return res.status(400).json({ error: 'notes required' });
  try {
    const axios = require('axios');
    const prompt = `You are a Flexport SDR assistant. Analyze these call notes and extract structured intelligence.
Company: ${companyName || 'Unknown'}
Call Notes: "${notes}"
Return JSON: {
  "pain_points": ["pain 1", "pain 2"],
  "signals": ["signal 1", "signal 2"],
  "objections": ["objection 1"],
  "next_steps": ["step 1", "step 2"],
  "sentiment": "positive|neutral|negative",
  "deal_probability": number 0-100,
  "recommended_follow_up": "brief recommendation"
}`;
    const r = await axios.post('https://api.openai.com/v1/chat/completions', {
      model: 'gpt-4.1-mini', max_tokens: 500,
      messages: [{ role: 'user', content: prompt }]
    }, { headers: { 'Authorization': `Bearer ${process.env.OPENAI_API_KEY}` } });
    const m = r.data.choices[0].message.content.match(/\{[\s\S]*\}/);
    if (!m) return res.status(500).json({ error: 'parse failed' });
    res.json(JSON.parse(m[0]));
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── Scheduled Jobs ─────────────────────────────────
const cron = require('node-cron');

// Refresh FRED trade data cache every night at midnight EST
// '0 0 * * *' in America/New_York = 05:00 UTC in winter, 04:00 UTC in summer
cron.schedule('0 0 * * *', () => {
  console.log('[CRON] Midnight EST — refreshing FRED trade data cache...');
  refreshAllTradeCache().catch(e => console.error('[CRON] Refresh failed:', e.message));
}, { timezone: 'America/New_York' });

const PORT = process.env.PORT || 5000;
if (require.main === module) {
  initDb()
    .then(() => app.listen(PORT, () => console.log(`Flexport SDR server on port ${PORT}`)))
    .catch(e => { console.error('DB init failed:', e.message); process.exit(1); });
}

module.exports = app;
