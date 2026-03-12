// backend/server.js
const express = require('express');
const cors = require('cors');
require('dotenv').config();
const WebSocket = require('ws');

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
const { getPipeline, getPipelineCount, addToPipeline, updatePipeline, removeFromPipeline } = require('./services/pipelineService');
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
  { src_lat: 31.2,  src_lng: 121.5, dst_lat: 33.7,  dst_lng: -118.2, label: 'China-US West Coast',              weight: 10 },
  { src_lat: 31.2,  src_lng: 121.5, dst_lat: 40.7,  dst_lng: -74.0,  label: 'China-US East Coast',              weight: 7  },
  { src_lat: 10.8,  src_lng: 106.7, dst_lat: 33.7,  dst_lng: -118.2, label: 'Vietnam-US West',                  weight: 6  },
  { src_lat: 35.7,  src_lng: 139.7, dst_lat: 33.7,  dst_lng: -118.2, label: 'Japan-US West',                    weight: 5  },
  { src_lat: 35.1,  src_lng: 129.0, dst_lat: 33.7,  dst_lng: -118.2, label: 'Korea-US West',                    weight: 5  },
  { src_lat: 25.0,  src_lng: 121.5, dst_lat: 33.7,  dst_lng: -118.2, label: 'Taiwan-US West',                   weight: 4  },
  { src_lat: 1.35,  src_lng: 103.8, dst_lat: 40.7,  dst_lng: -74.0,  label: 'SE Asia-US East',                  weight: 7  },
  { src_lat: 22.3,  src_lng: 114.2, dst_lat: 40.7,  dst_lng: -74.0,  label: 'HK-US East',                       weight: 4  },
  // ── Asia-Europe ──────────────────────────────────────────────────────────────
  { src_lat: 31.2,  src_lng: 121.5, dst_lat: 51.9,  dst_lng: 4.5,    label: 'China-Rotterdam',                  weight: 8  },
  { src_lat: 10.8,  src_lng: 106.7, dst_lat: 51.9,  dst_lng: 4.5,    label: 'SE Asia-Europe',                   weight: 4  },
  // ── Cape of Good Hope Reroute (Red Sea / Suez avoided since Houthi attacks 2023–) ──
  // Ships that previously transited the Red Sea now go Singapore → Cape → Rotterdam
  // adding ~10-14 days transit. Split into 2 arcs to visually trace the route.
  { src_lat: 1.35,  src_lng: 103.8, dst_lat: -34.4, dst_lng: 18.5,   label: 'Cape Reroute: Asia–Cape',          weight: 7  },
  { src_lat: -34.4, src_lng: 18.5,  dst_lat: 51.9,  dst_lng: 4.5,    label: 'Cape Reroute: Cape–Europe',        weight: 7  },
  { src_lat: 19.0,  src_lng: 72.8,  dst_lat: -34.4, dst_lng: 18.5,   label: 'Cape Reroute: India–Cape',         weight: 5  },
  // ── South Asia-US ────────────────────────────────────────────────────────────
  { src_lat: 19.0,  src_lng: 72.8,  dst_lat: 33.7,  dst_lng: -118.2, label: 'India-US West',                    weight: 5  },
  { src_lat: 19.0,  src_lng: 72.8,  dst_lat: 40.7,  dst_lng: -74.0,  label: 'India-US East',                    weight: 4  },
  // ── Atlantic ─────────────────────────────────────────────────────────────────
  { src_lat: 51.9,  src_lng: 4.5,   dst_lat: 40.7,  dst_lng: -74.0,  label: 'Europe-US East',                   weight: 6  },
  { src_lat: 41.0,  src_lng: 28.9,  dst_lat: 51.9,  dst_lng: 4.5,    label: 'Turkey-Europe',                    weight: 3  },
  // ── Middle East / Africa ─────────────────────────────────────────────────────
  // Middle East-Europe direct lane now at risk — Houthi attacks on Red Sea shipping
  { src_lat: 25.0,  src_lng: 55.1,  dst_lat: 51.9,  dst_lng: 4.5,    label: 'Middle East-Europe (Red Sea Risk)', weight: 4  },
  { src_lat: -29.9, src_lng: 31.0,  dst_lat: 51.9,  dst_lng: 4.5,    label: 'Africa-Europe',                    weight: 4  },
  // ── Americas ─────────────────────────────────────────────────────────────────
  { src_lat: 19.4,  src_lng: -99.1, dst_lat: 29.7,  dst_lng: -95.0,  label: 'Mexico-US South',                  weight: 5  },
  { src_lat: -23.9, src_lng: -46.3, dst_lat: 40.7,  dst_lng: -74.0,  label: 'Brazil-US East',                   weight: 3  },
  { src_lat: -12.0, src_lng: -77.1, dst_lat: 33.7,  dst_lng: -118.2, label: 'Peru-US West',                     weight: 3  },
  // ── Australia ────────────────────────────────────────────────────────────────
  { src_lat: -33.9, src_lng: 151.2, dst_lat: 33.7,  dst_lng: -118.2, label: 'Australia-US West',                weight: 3  },
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
        // Singapore/Port Klang: major bottlenecks on Cape reroute; massive volume surge since Red Sea closure
        { name: 'Singapore',             lat: 1.26,   lng: 103.82,  status: 'congestion', congestion: 6 },
        { name: 'Port Klang',            lat: 3.00,   lng: 101.40,  status: 'congestion', congestion: 5 },
        { name: 'Tanjung Pelepas',       lat: 1.37,   lng: 103.55,  status: 'congestion', congestion: 5 },
        { name: 'Ho Chi Minh City',      lat: 10.77,  lng: 106.72,  status: 'congestion', congestion: 5 },
        { name: 'Hong Kong',             lat: 22.29,  lng: 114.17,  status: 'clear',      congestion: 3 },
        // ── Middle East / Europe ──
        // Jebel Ali: Strait of Hormuz disruption — Iran vessel seizures + US-Iran tensions, carriers diverting via Cape
        { name: 'Jebel Ali',             lat: 25.01,  lng: 55.06,   status: 'disruption', congestion: 9 },
        // Aden: active conflict zone — Houthi attacks, port effectively closed to commercial traffic
        { name: 'Aden',                  lat: 12.77,  lng: 45.03,   status: 'disruption', congestion: 9 },
        // Salalah: key alternative hub on Cape reroute, surge in vessel calls since 2024
        { name: 'Salalah',               lat: 16.94,  lng: 54.00,   status: 'congestion', congestion: 5 },
        // Colombo: surge in Cape-reroute transshipment; became critical waystation
        { name: 'Colombo',               lat: 6.94,   lng: 79.84,   status: 'congestion', congestion: 5 },
        { name: 'Rotterdam',             lat: 51.95,  lng: 4.13,    status: 'clear',      congestion: 3 },
        { name: 'Antwerp',               lat: 51.26,  lng: 4.40,    status: 'clear',      congestion: 3 },
        { name: 'Hamburg',               lat: 53.54,  lng: 9.97,    status: 'congestion', congestion: 5 },
        { name: 'Felixstowe',            lat: 51.96,  lng: 1.35,    status: 'congestion', congestion: 6 },
        { name: 'Piraeus',               lat: 37.94,  lng: 23.63,   status: 'clear',      congestion: 4 },
        // ── Africa ──
        { name: 'Durban',                lat: -29.87, lng: 31.03,   status: 'disruption', congestion: 8 },
        // Tangier Med: surge from Cape-rerouted ships; now busiest European transshipment hub
        { name: 'Tangier Med',           lat: 35.88,  lng: -5.50,   status: 'congestion', congestion: 5 },
        // Port Said: Suez Canal traffic severely reduced by Houthi threat — security disruption
        { name: 'Port Said',             lat: 31.26,  lng: 32.30,   status: 'disruption', congestion: 8 },
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
    const analysis = await analyzeForFlexport(companyName, prospect, aggregated.news?.map(n => n.title), aggregated.searchResults, req.body?.model || 'gpt-4.1-mini');
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

app.get('/api/pipeline/count', async (req, res) => {
  try { res.json({ count: await getPipelineCount() }); }
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
  const { companyName, prospectData, analysisData, sdrIdentity } = req.body;
  if (!companyName) return res.status(400).json({ error: 'companyName required' });
  try {
    const axios = require('axios');
    const sdrCtx = sdrIdentity?.name
      ? `SDR: ${sdrIdentity.name}${sdrIdentity.title ? `, ${sdrIdentity.title}` : ''}${sdrIdentity.team ? ` (${sdrIdentity.team})` : ''}${sdrIdentity.email ? ` — ${sdrIdentity.email}` : ''}${sdrIdentity.phone ? ` / ${sdrIdentity.phone}` : ''}.`
      : 'SDR: Flexport sales representative.';
    const prompt = `Generate a 4-touch outreach sequence for a Flexport SDR targeting ${companyName}.
${sdrCtx}
Context: ${JSON.stringify({ prospectData, analysisData })}
Return JSON: {"touches": [{"type":"email|linkedin|call","subject":"...","body":"...","day":1}]}
Each touch should reference Flexport value props and the company's specific supply chain situation. Sign emails with the SDR's name if provided.`;
    const r = await axios.post('https://api.openai.com/v1/chat/completions', {
      model: req.body?.model || 'gpt-4.1-mini', max_tokens: 1200,
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
    { competitor: 'Expeditors International', strengths: ['Deep customs expertise', 'Global network', 'Long-term enterprise relationships'], weaknesses: ['Very manual processes', 'Relationship-driven pricing opacity', 'Limited real-time visibility', 'Not built for DTC growth-stage companies'], flexport_wins: 'Flexport\'s tech platform vs Expeditors\' phone-and-email model. Flexport gives your ops team a live dashboard; Expeditors gives you an account manager you hope picks up.', trigger_phrases: ['We use Expeditors', 'Our customs broker handles it', 'We\'ve had the same forwarder for years'], talk_track: 'Ask: "When your CFO asks where a shipment is or what the landed cost came in at, how do you find out? How long does it take?" Expeditors customers are usually pulling data manually from a rep.' }
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
  try { res.json(await getPerformanceSummary(req.query.retention_days)); }
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

// ── Team Leaderboard ───────────────────────────────
let teamCache = null;
let teamCacheExpiry = 0;

const TEAM_REPS = [
  { id: 1, name: 'Marcus Chen',    avatar_initials: 'MC', calls: 127, demos: 18, pipeline_value: 340000, quota_pct: 94,  trend: '+', role: 'SDR',        is_you: true  },
  { id: 2, name: 'Jordan Kim',     avatar_initials: 'JK', calls: 143, demos: 22, pipeline_value: 415000, quota_pct: 112, trend: '+', role: 'SDR',        is_you: false },
  { id: 3, name: 'Priya Patel',    avatar_initials: 'PP', calls: 98,  demos: 14, pipeline_value: 268000, quota_pct: 76,  trend: '-', role: 'SDR',        is_you: false },
  { id: 4, name: 'Tyler Brooks',   avatar_initials: 'TB', calls: 156, demos: 19, pipeline_value: 372000, quota_pct: 98,  trend: '+', role: 'Sr. SDR',    is_you: false },
  { id: 5, name: 'Keisha Williams',avatar_initials: 'KW', calls: 89,  demos: 11, pipeline_value: 198000, quota_pct: 61,  trend: '-', role: 'SDR',        is_you: false },
  { id: 6, name: 'Sam Rivera',     avatar_initials: 'SR', calls: 117, demos: 16, pipeline_value: 302000, quota_pct: 84,  trend: '+', role: 'SDR',        is_you: false },
];

const TEAM_FALLBACK_INSIGHT = 'Focus on pipeline conversion this week.';

app.get('/api/team', async (req, res) => {
  if (teamCache && Date.now() < teamCacheExpiry) {
    return res.json(teamCache);
  }
  try {
    const axios = require('axios');
    const repSummaries = TEAM_REPS.map(r =>
      `${r.name}: calls=${r.calls}, demos=${r.demos}, pipeline=$${r.pipeline_value.toLocaleString()}, quota=${r.quota_pct}%, trend=${r.trend}`
    ).join('\n');
    const prompt = `You are a sales coaching AI. Based on each SDR's metrics below, write ONE concise coaching insight per rep (1 sentence, under 20 words). Be specific and actionable.

Reps:
${repSummaries}

Return ONLY a valid JSON array with exactly 6 objects in the same order, like:
[{"name":"Marcus Chen","insight":"..."},{"name":"Jordan Kim","insight":"..."},...]`;

    const r = await axios.post('https://api.openai.com/v1/chat/completions', {
      model: 'gpt-4.1-mini',
      max_tokens: 400,
      messages: [{ role: 'user', content: prompt }]
    }, { headers: { 'Authorization': `Bearer ${process.env.OPENAI_API_KEY}` } });

    const raw = r.data.choices[0].message.content;
    const match = raw.match(/\[[\s\S]*\]/);
    let insightMap = {};
    if (match) {
      const parsed = JSON.parse(match[0]);
      parsed.forEach(item => { insightMap[item.name] = item.insight; });
    }

    const result = TEAM_REPS.map(rep => ({
      ...rep,
      insight: insightMap[rep.name] || TEAM_FALLBACK_INSIGHT,
    }));

    teamCache = result;
    teamCacheExpiry = Date.now() + 3600000;
    res.json(result);
  } catch (e) {
    console.error('[/api/team] OpenAI error:', e.message);
    const fallback = TEAM_REPS.map(rep => ({ ...rep, insight: TEAM_FALLBACK_INSIGHT }));
    res.json(fallback);
  }
});

// ── Follow-up Radar ────────────────────────────────
app.get('/api/followup-radar', (req, res) => {
  const days = Math.max(1, parseInt(req.query.days, 10) || 3);
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
    HAVING days_since >= ?
    ORDER BY pr.icp_score DESC, days_since DESC
    LIMIT 12
  `, [days], (err, rows) => {
    db.close();
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});

// ── Pipeline Velocity ───────────────────────────────
app.get('/api/pipeline-velocity', (req, res) => {
  const staleDays = Math.max(1, parseInt(req.query.stale_days, 10) || 7);
  const db = getDb();
  db.all(`
    SELECT stage,
      COUNT(*) as count,
      ROUND(AVG(julianday('now', 'localtime') - julianday(updated_at)), 1) as avg_days,
      COUNT(CASE WHEN julianday('now', 'localtime') - julianday(updated_at) > ? THEN 1 END) as stuck_count
    FROM pipeline
    WHERE stage NOT IN ('closed_won', 'closed_lost')
    GROUP BY stage
    ORDER BY CASE stage
      WHEN 'new' THEN 1 WHEN 'researched' THEN 2
      WHEN 'called' THEN 3 WHEN 'demo_booked' THEN 4
      ELSE 5 END
  `, [staleDays], (err, rows) => {
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
      model: req.body?.model || 'gpt-4.1-mini', max_tokens: 800,
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
      model: req.body?.model || 'gpt-4.1-mini', max_tokens: 300,
      messages: [{ role: 'user', content: prompt }]
    }, { headers: { 'Authorization': `Bearer ${process.env.OPENAI_API_KEY}` } });
    const m = r.data.choices[0].message.content.match(/\{[\s\S]*\}/);
    res.json(m ? JSON.parse(m[0]) : {});
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/call-predict', async (req, res) => {
  const { transcript, companyName, model = 'gpt-4.1-mini' } = req.body;
  if (!transcript?.trim()) return res.status(400).json({ error: 'transcript required' });
  if (!process.env.OPENAI_API_KEY) return res.status(503).json({ error: 'AI not configured' });
  try {
    const axios = require('axios');
    const systemPrompt = `You are a real-time sales call coach for a Flexport SDR on a live sales call. Based on the live call transcript, predict what will likely happen in the next 15-30 seconds and suggest exactly what the SDR should say next. Be very concise. Respond ONLY with valid JSON: { "prediction": "one short sentence about what's coming", "suggested_response": "exact words the SDR should say", "tone": "confident|curious|empathetic|urgent" }`;
    const r = await axios.post('https://api.openai.com/v1/chat/completions', {
      model, max_tokens: 200,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: `Company: ${companyName || 'Unknown'}\n\nLive transcript:\n${transcript.slice(-2000)}` },
      ],
      response_format: { type: 'json_object' },
    }, { headers: { 'Authorization': `Bearer ${process.env.OPENAI_API_KEY}` } });
    res.json(JSON.parse(r.data.choices[0].message.content));
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
      model: req.body?.model || 'gpt-4.1-mini', max_tokens: 600,
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
      model: req.body?.model || 'gpt-4.1-mini', max_tokens: 100,
      messages: [{ role: 'user', content: prompt }]
    }, { headers: { 'Authorization': `Bearer ${process.env.OPENAI_API_KEY}` } });
    const m = r.data.choices[0].message.content.match(/\{[\s\S]*\}/);
    res.json(m ? JSON.parse(m[0]) : { first_line: '' });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── FX Rates — live rates + 1-day change via frankfurter.app ─────────────
let _fxCache = null, _fxCacheAt = 0;
app.get('/api/fx-rates', async (req, res) => {
  if (_fxCache && Date.now() - _fxCacheAt < 5 * 60 * 1000) return res.json(_fxCache);
  const key = process.env.EXCHANGE_RATE_API_KEY;
  if (!key) return res.json({ source: 'static', rates: null });
  try {
    const axios = require('axios');
    const pairs = [
      { pair: 'USD/CNY', symbol: 'CNY', note: 'China Yuan' },
      { pair: 'USD/EUR', symbol: 'EUR', note: 'Euro' },
      { pair: 'USD/CAD', symbol: 'CAD', note: 'Canadian Dollar' },
      { pair: 'USD/MXN', symbol: 'MXN', note: 'Mexican Peso' },
      { pair: 'USD/JPY', symbol: 'JPY', note: 'Japanese Yen' },
      { pair: 'USD/KRW', symbol: 'KRW', note: 'Korean Won' },
      { pair: 'USD/VND', symbol: 'VND', note: 'Vietnam Dong' },
      { pair: 'USD/INR', symbol: 'INR', note: 'Indian Rupee' },
      { pair: 'USD/TWD', symbol: 'TWD', note: 'Taiwan Dollar' },
      { pair: 'USD/SGD', symbol: 'SGD', note: 'Singapore Dollar' },
      { pair: 'USD/HKD', symbol: 'HKD', note: 'Hong Kong Dollar' },
      { pair: 'USD/MYR', symbol: 'MYR', note: 'Malaysian Ringgit' },
      { pair: 'USD/THB', symbol: 'THB', note: 'Thai Baht' },
      { pair: 'USD/GBP', symbol: 'GBP', note: 'British Pound' },
      { pair: 'USD/AUD', symbol: 'AUD', note: 'Australian Dollar' },
      { pair: 'USD/BRL', symbol: 'BRL', note: 'Brazilian Real' },
    ];

    // Yesterday's date string for historical comparison
    const yest = new Date(); yest.setDate(yest.getDate() - 1);
    const yStr = yest.toISOString().slice(0, 10);

    // Fetch current rates (user key) + yesterday's rates (frankfurter, free, no key)
    const [todayRes, yestRes] = await Promise.allSettled([
      axios.get(`https://v6.exchangerate-api.com/v6/${key}/latest/USD`),
      axios.get(`https://api.frankfurter.app/${yStr}?from=USD&to=CNY,EUR,CAD,MXN,JPY,KRW,INR,TWD,SGD,HKD,MYR,THB,GBP,AUD,BRL`),
    ]);

    const raw = todayRes.status === 'fulfilled' ? (todayRes.value.data.conversion_rates || {}) : {};
    const yestRaw = yestRes.status === 'fulfilled' ? (yestRes.value.data.rates || {}) : {};

    const rates = pairs.map(p => {
      const current = raw[p.symbol] || null;
      const prev = yestRaw[p.symbol] || null;
      const pct = (current && prev) ? parseFloat(((current - prev) / prev * 100).toFixed(3)) : 0;
      return { pair: p.pair, rate: current, note: p.note, pct };
    });

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
    if (err) { db.close(); return res.status(500).json({ error: err.message }); }
    db.close();
    res.json(rows || []);
  });
});

// ── Trigger Events — NewsAPI supply chain news, 30-min cache ──────────────
let _triggerCache = null, _triggerCacheAt = 0;
const TRIGGER_FALLBACK = [
  { headline: 'US-Iran naval standoff closes Strait of Hormuz — Lloyd\'s war-risk surcharges active, carriers rerouting via Cape of Good Hope', sector: 'Global Freight', urgency: 'high', date: 'Mar 2026' },
  { headline: 'Apple shifts 25% of iPhone production from China to India amid tariff concerns', sector: 'Electronics', urgency: 'high', date: 'Mar 2026' },
  { headline: 'Nike announces Vietnam manufacturing capacity expansion — 3 new factories', sector: 'Apparel', urgency: 'high', date: 'Mar 2026' },
  { headline: 'Target reports Q4 inventory glut — import velocity expected to slow 15%', sector: 'E-commerce', urgency: 'medium', date: 'Feb 2026' },
  { headline: 'TSMC Arizona fab ramp-up — domestic semiconductor logistics demand rising', sector: 'Electronics', urgency: 'medium', date: 'Feb 2026' },
  { headline: 'Walmart nearshoring push — 5 Mexican suppliers added for 2026', sector: 'Retail / CPG', urgency: 'medium', date: 'Jan 2026' },
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
      model: req.body?.model || 'gpt-4.1-mini', max_tokens: 150,
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
      model: req.body?.model || 'gpt-4.1-mini', max_tokens: 400,
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
      model: req.body?.model || 'gpt-4.1-mini', max_tokens: 500,
      messages: [{ role: 'user', content: prompt }]
    }, { headers: { 'Authorization': `Bearer ${process.env.OPENAI_API_KEY}` } });
    const m = r.data.choices[0].message.content.match(/\{[\s\S]*\}/);
    if (!m) return res.status(500).json({ error: 'parse failed' });
    res.json(JSON.parse(m[0]));
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── Email Composer — SSE streaming cold outreach package ──────────────────
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
    const axios = require('axios');
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.flushHeaders();

    const response = await axios.post('https://api.openai.com/v1/chat/completions', {
      model: 'gpt-4.1-mini',
      messages: [{ role: 'user', content: prompt }],
      stream: true,
    }, {
      headers: { 'Authorization': `Bearer ${process.env.OPENAI_API_KEY}` },
      responseType: 'stream',
    });

    response.data.on('data', (chunk) => {
      const lines = chunk.toString().split('\n').filter(l => l.trim());
      for (const line of lines) {
        if (!line.startsWith('data: ')) continue;
        const raw = line.slice(6).trim();
        if (raw === '[DONE]') { res.write('data: [DONE]\n\n'); return; }
        try {
          const parsed = JSON.parse(raw);
          const text = parsed.choices?.[0]?.delta?.content || '';
          if (text) res.write(`data: ${JSON.stringify({ text })}\n\n`);
        } catch { /* skip malformed chunk */ }
      }
    });

    response.data.on('end', () => {
      res.write('data: [DONE]\n\n');
      res.end();
    });

    response.data.on('error', (err) => {
      console.error('compose-email stream error:', err);
      if (!res.headersSent) res.status(500).json({ error: 'Email generation failed' });
      else res.end();
    });
  } catch (err) {
    console.error('compose-email error:', err);
    if (!res.headersSent) res.status(500).json({ error: 'Email generation failed' });
  }
});

// ── Research — AI company intelligence brief with Serper + NewsAPI + OpenAI ─
app.post('/api/research', async (req, res) => {
  const { company } = req.body;
  if (!company) return res.status(400).json({ error: 'company required' });

  let newsContext = '', serperContext = '';
  try {
    const axios = require('axios');
    const [newsRes, serperRes] = await Promise.allSettled([
      process.env.NEWS_API_KEY
        ? axios.get('https://newsapi.org/v2/everything', {
            params: { q: company, sortBy: 'publishedAt', pageSize: 5, apiKey: process.env.NEWS_API_KEY }
          })
        : Promise.resolve(null),
      process.env.SERPER_API_KEY
        ? axios.post('https://google.serper.dev/search',
            { q: `${company} logistics shipping supply chain 2026` },
            { headers: { 'X-API-KEY': process.env.SERPER_API_KEY, 'Content-Type': 'application/json' } })
        : Promise.resolve(null),
    ]);
    if (newsRes.status === 'fulfilled' && newsRes.value?.data?.articles) {
      newsContext = newsRes.value.data.articles
        .map(a => `- ${a.title} (${a.publishedAt?.slice(0,10)})`).join('\n');
    }
    if (serperRes.status === 'fulfilled' && serperRes.value?.data?.organic) {
      serperContext = serperRes.value.data.organic.slice(0, 4)
        .map(r => `- ${r.title}: ${r.snippet}`).join('\n');
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
    const axios = require('axios');
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.flushHeaders();

    const response = await axios.post('https://api.openai.com/v1/chat/completions', {
      model: 'gpt-4.1-mini',
      messages: [{ role: 'user', content: prompt }],
      stream: true,
    }, {
      headers: { 'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`, 'Content-Type': 'application/json' },
      responseType: 'stream',
    });

    response.data.on('data', (chunk) => {
      const lines = chunk.toString().split('\n').filter(l => l.trim());
      for (const line of lines) {
        if (line.startsWith('data: ') && !line.includes('[DONE]')) {
          try {
            const json = JSON.parse(line.slice(6));
            const text = json.choices?.[0]?.delta?.content || '';
            if (text) res.write(`data: ${JSON.stringify({ text })}\n\n`);
          } catch {}
        } else if (line.includes('[DONE]')) {
          res.write('data: [DONE]\n\n');
          res.end();
        }
      }
    });
    response.data.on('end', () => { if (!res.writableEnded) { res.write('data: [DONE]\n\n'); res.end(); } });
    response.data.on('error', () => { if (!res.writableEnded) res.end(); });
  } catch (err) {
    console.error('research error:', err.message);
    if (!res.headersSent) res.status(500).json({ error: 'Research generation failed' });
  }
});

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

// ── Settings Health ────────────────────────────────
app.get('/api/settings/health', (req, res) => {
  res.json({
    status: 'ok',
    version: '2.0.0',
    timestamp: new Date().toISOString(),
    env: {
      openai:       !!process.env.OPENAI_API_KEY,
      fred:         !!process.env.FRED_API_KEY,
      newsapi:      !!(process.env.NEWSAPI_KEY || process.env.NEWS_API_KEY),
      exchangeRate: !!process.env.EXCHANGE_RATE_API_KEY,
      serper:       !!process.env.SERPER_API_KEY,
    },
  });
});

// ── AIS Stream WebSocket proxy ──────────────────────
// In-memory vessel cache
let _vesselCache = {};
let _aisWs = null;
let _aisReconnectDelay = 10000; // exponential backoff, resets to 10s on successful open

// Periodic cache maintenance — NOT per-message. Running cleanup on every WebSocket
// message is O(n_cache) and at global AIS feed rates (1000s msg/min) it saturates
// the Node.js event loop, making all HTTP endpoints unresponsive.
setInterval(() => {
  const cutoff = Date.now() - 30 * 60 * 1000;
  for (const k of Object.keys(_vesselCache)) {
    if (!_vesselCache[k]?.ts || _vesselCache[k].ts < cutoff) delete _vesselCache[k];
  }
  // Cap at 500 vessels — prevents memory growth on dense global feed
  const keys = Object.keys(_vesselCache);
  if (keys.length > 500) {
    keys.sort((a, b) => (_vesselCache[a]?.ts || 0) - (_vesselCache[b]?.ts || 0));
    keys.slice(0, keys.length - 500).forEach(k => delete _vesselCache[k]);
  }
}, 5 * 60 * 1000); // every 5 minutes

function connectAisStream() {
  const key = process.env.AISSTREAM_API_KEY;
  if (!key) return;
  if (_aisWs && (_aisWs.readyState === WebSocket.OPEN || _aisWs.readyState === WebSocket.CONNECTING)) return;

  _aisWs = new WebSocket('wss://stream.aisstream.io/v0/stream');

  _aisWs.on('open', () => {
    _aisReconnectDelay = 10000; // reset backoff on success
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
      // (cache cleanup moved to 5-min setInterval — not per-message)
    } catch {}
  });

  _aisWs.on('close', () => {
    _aisReconnectDelay = Math.min(_aisReconnectDelay * 2, 120000); // backoff up to 2 min
    console.log(`aisstream disconnected — reconnecting in ${Math.round(_aisReconnectDelay / 1000)}s`);
    setTimeout(connectAisStream, _aisReconnectDelay);
  });

  _aisWs.on('error', (e) => { console.error('aisstream error:', e.message); });
}

connectAisStream();

app.get('/api/vessels', (req, res) => {
  const vessels = Object.values(_vesselCache).filter(v => v.lat && v.lng);
  if (vessels.length >= 20 && req.query.mode !== 'sim') {
    // Serve live data once we have at least 20 vessels. Lower threshold helps localhost
    // where AISstream free-tier concurrent-connection limits cause shorter accumulation windows.
    return res.json({ source: 'live', vessels: vessels.slice(0, 200) });
  }
  // Great-circle interpolation
  function greatCirclePoint(lat1d, lng1d, lat2d, lng2d, t) {
    const R = Math.PI / 180;
    const lat1 = lat1d * R, lng1 = lng1d * R, lat2 = lat2d * R, lng2 = lng2d * R;
    const x1 = Math.cos(lat1)*Math.cos(lng1), y1 = Math.cos(lat1)*Math.sin(lng1), z1 = Math.sin(lat1);
    const x2 = Math.cos(lat2)*Math.cos(lng2), y2 = Math.cos(lat2)*Math.sin(lng2), z2 = Math.sin(lat2);
    const dot = Math.min(1, Math.max(-1, x1*x2 + y1*y2 + z1*z2));
    const omega = Math.acos(dot);
    if (omega < 0.0001) return { lat: lat1d, lng: lng1d };
    const s = Math.sin(omega);
    const a = Math.sin((1-t)*omega)/s, b = Math.sin(t*omega)/s;
    const x = a*x1 + b*x2, y = a*y1 + b*y2, z = a*z1 + b*z2;
    return {
      lat: Math.atan2(z, Math.sqrt(x*x + y*y)) / R,
      lng: Math.atan2(y, x) / R,
    };
  }
  // Multi-segment waypoint interpolation — distributes t equally across segments.
  // points = [{lat,lng}, ...] covering full path from src through waypoints to dst.
  function gcWaypointedPoint(points, t) {
    const n = points.length - 1;
    if (n <= 0) return points[0];
    if (t <= 0) return points[0];
    if (t >= 1) return points[n];
    const segT = t * n;
    const idx = Math.min(Math.floor(segT), n - 1);
    return greatCirclePoint(points[idx].lat, points[idx].lng, points[idx+1].lat, points[idx+1].lng, segT - idx);
  }

  // Simulated fallback — 250 vessels on real SHIPPING_LANES trade routes
  const PORT_NAMES = {
    '31.2,121.5': 'Shanghai', '10.8,106.7': 'Ho Chi Minh City',
    '35.7,139.7': 'Tokyo', '35.1,129.0': 'Busan', '25.0,121.5': 'Taipei',
    '1.35,103.8': 'Singapore', '-34.4,18.5': 'Cape Town', '51.9,4.5': 'Rotterdam',
    '33.7,-118.2': 'Los Angeles', '40.7,-74.0': 'New York', '19.0,72.8': 'Mumbai',
    '41.0,28.9': 'Istanbul', '29.7,-95.0': 'Houston', '-23.5,-46.6': 'Santos',
    '-12.0,-77.1': 'Callao', '-33.9,151.2': 'Sydney', '-29.9,31.0': 'Durban',
    '25.0,55.1': 'Jebel Ali', '3.1,101.7': 'Port Klang', '22.3,114.2': 'Hong Kong',
    '19.4,-99.1': 'Mexico City', '-34.4,18.5': 'Cape Town',
  };
  function portName(lat, lng) {
    const key = `${lat},${lng}`;
    return PORT_NAMES[key] || `${Math.abs(lat).toFixed(1)}°${lat >= 0 ? 'N' : 'S'} ${Math.abs(lng).toFixed(1)}°${lng >= 0 ? 'E' : 'W'}`;
  }
  // Ocean routes with waypoints (wps) on any path that would cross land.
  // wps = intermediate {lat,lng} checkpoints; vessel interpolates through them.
  const VESSEL_LANES = [
    // ── Trans-Pacific (Asia → US West) — open Pacific, safe ──
    { sl: 31.2, sg: 121.5, dl: 33.7, dg: -118.2, sn: 'Shanghai',       dn: 'Los Angeles' },
    { sl: 10.8, sg: 106.7, dl: 33.7, dg: -118.2, sn: 'Ho Chi Minh City',dn: 'Los Angeles' },
    { sl: 35.7, sg: 139.7, dl: 33.7, dg: -118.2, sn: 'Tokyo',           dn: 'Los Angeles' },
    { sl: 35.1, sg: 129.0, dl: 33.7, dg: -118.2, sn: 'Busan',           dn: 'Los Angeles' },
    { sl: 25.0, sg: 121.5, dl: 33.7, dg: -118.2, sn: 'Taipei',          dn: 'Los Angeles' },
    { sl: 22.3, sg: 114.2, dl: 33.7, dg: -118.2, sn: 'Hong Kong',       dn: 'Los Angeles' },
    { sl: 14.6, sg: 121.0, dl: 33.7, dg: -118.2, sn: 'Manila',          dn: 'Los Angeles' },
    { sl: -6.2, sg: 106.8, dl: 33.7, dg: -118.2, sn: 'Jakarta',         dn: 'Los Angeles' },
    { sl: -33.9,sg: 151.2, dl: 33.7, dg: -118.2, sn: 'Sydney',          dn: 'Los Angeles' },
    { sl: -37.8,sg: 144.9, dl: 33.7, dg: -118.2, sn: 'Melbourne',       dn: 'Los Angeles' },
    { sl: -36.9,sg: 174.8, dl: 33.7, dg: -118.2, sn: 'Auckland',        dn: 'Los Angeles' },
    { sl: 35.0, sg: 136.8, dl: 33.7, dg: -118.2, sn: 'Nagoya',          dn: 'Los Angeles' },
    { sl: -27.4,sg: 153.0, dl: 33.7, dg: -118.2, sn: 'Brisbane',        dn: 'Los Angeles' },
    // ── Trans-Pacific (Asia → Seattle) — safe ──
    { sl: 31.2, sg: 121.5, dl: 47.6, dg: -122.3, sn: 'Shanghai',   dn: 'Seattle' },
    { sl: 1.35, sg: 103.8, dl: 47.6, dg: -122.3, sn: 'Singapore',  dn: 'Seattle' },
    // ── Cape Reroute: Asia → Cape Town (waypoints keep ships in Indian Ocean) ──
    { sl: 1.35, sg: 103.8, dl: -34.4, dg: 18.5, sn: 'Singapore', dn: 'Cape Town',
      wps: [{lat:-8,lng:80},{lat:-22,lng:53},{lat:-32,lng:33}] },
    { sl: 19.0, sg: 72.8,  dl: -34.4, dg: 18.5, sn: 'Mumbai',    dn: 'Cape Town',
      wps: [{lat:-5,lng:62},{lat:-22,lng:53},{lat:-32,lng:33}] },
    { sl: 6.9,  sg: 79.9,  dl: -34.4, dg: 18.5, sn: 'Colombo',   dn: 'Cape Town',
      wps: [{lat:-5,lng:68},{lat:-22,lng:53},{lat:-32,lng:33}] },
    { sl: 31.2, sg: 121.5, dl: -34.4, dg: 18.5, sn: 'Shanghai',   dn: 'Cape Town',
      wps: [{lat:3,lng:103},{lat:-8,lng:78},{lat:-22,lng:53},{lat:-32,lng:33}] },
    { sl: 35.7, sg: 139.7, dl: -34.4, dg: 18.5, sn: 'Tokyo',      dn: 'Cape Town',
      wps: [{lat:10,lng:125},{lat:3,lng:108},{lat:-8,lng:78},{lat:-22,lng:53},{lat:-32,lng:33}] },
    { sl: -6.2, sg: 106.8, dl: -34.4, dg: 18.5, sn: 'Jakarta',    dn: 'Cape Town',
      wps: [{lat:-12,lng:85},{lat:-22,lng:53},{lat:-32,lng:33}] },
    { sl: -31.9,sg: 115.8, dl: -34.4, dg: 18.5, sn: 'Fremantle',  dn: 'Cape Town' }, // Southern Ocean, safe
    { sl: 13.1, sg: 80.3,  dl: -34.4, dg: 18.5, sn: 'Chennai',    dn: 'Cape Town',
      wps: [{lat:-5,lng:64},{lat:-22,lng:53},{lat:-32,lng:33}] },
    // ── Cape Reroute: Cape Town → Europe/Americas ──
    { sl: -34.4, sg: 18.5, dl: 51.9,  dg: 4.5,   sn: 'Cape Town', dn: 'Rotterdam',
      wps: [{lat:-30,lng:12},{lat:-5,lng:-2},{lat:15,lng:-22},{lat:36.1,lng:-5.6}] },
    { sl: -34.4, sg: 18.5, dl: 53.5,  dg: 10.0,  sn: 'Cape Town', dn: 'Hamburg',
      wps: [{lat:-30,lng:12},{lat:-5,lng:-2},{lat:15,lng:-22},{lat:36.1,lng:-5.6}] },
    { sl: -34.4, sg: 18.5, dl: 40.7,  dg: -74.0, sn: 'Cape Town', dn: 'New York'  },
    { sl: -34.4, sg: 18.5, dl: 29.7,  dg: -95.0, sn: 'Cape Town', dn: 'Houston',
      wps: [{lat:8,lng:-55},{lat:15,lng:-75},{lat:24,lng:-84},{lat:25,lng:-90}] },
    // ── Atlantic: Europe ↔ Americas ──
    { sl: 51.9,  sg: 4.5,  dl: 40.7,  dg: -74.0, sn: 'Rotterdam', dn: 'New York'  }, // Atlantic, safe
    { sl: 53.5,  sg: 10.0, dl: 40.7,  dg: -74.0, sn: 'Hamburg',   dn: 'New York'  },
    { sl: 51.3,  sg: 4.4,  dl: 40.7,  dg: -74.0, sn: 'Antwerp',   dn: 'New York'  },
    { sl: 51.9,  sg: 4.5,  dl: 32.1,  dg: -81.1, sn: 'Rotterdam', dn: 'Savannah'  },
    { sl: 51.9,  sg: 4.5,  dl: 25.8,  dg: -80.2, sn: 'Rotterdam', dn: 'Miami'     },
    { sl: 51.9,  sg: 4.5,  dl: 29.7,  dg: -95.0, sn: 'Rotterdam', dn: 'Houston',
      wps: [{lat:28,lng:-55},{lat:24,lng:-84},{lat:25,lng:-90}] },
    // ── South America ──
    { sl: -23.9, sg: -46.3, dl: 40.7,  dg: -74.0, sn: 'Santos',       dn: 'New York',
      wps: [{lat:-30,lng:-35},{lat:-5,lng:-28},{lat:10,lng:-55},{lat:25,lng:-70}] },
    { sl: -23.9, sg: -46.3, dl: 51.9,  dg: 4.5,   sn: 'Santos',       dn: 'Rotterdam',
      wps: [{lat:-30,lng:-35},{lat:-5,lng:-28},{lat:15,lng:-26},{lat:36.1,lng:-5.6}] },
    { sl: -34.6, sg: -58.4, dl: 51.9,  dg: 4.5,   sn: 'Buenos Aires', dn: 'Rotterdam',
      wps: [{lat:-38,lng:-50},{lat:-10,lng:-30},{lat:10,lng:-25},{lat:25,lng:-22},{lat:36.1,lng:-5.6}] },
    { sl: -34.6, sg: -58.4, dl: 40.7,  dg: -74.0, sn: 'Buenos Aires', dn: 'New York',
      wps: [{lat:-38,lng:-50},{lat:-10,lng:-30},{lat:8,lng:-56},{lat:25,lng:-70}] },
    { sl: -12.0, sg: -77.1, dl: 33.7,  dg: -118.2,sn: 'Callao',       dn: 'Los Angeles',
      wps: [{lat:5,lng:-88},{lat:18,lng:-110}] },
    { sl: 10.4,  sg: -75.5, dl: 29.7,  dg: -95.0, sn: 'Cartagena',    dn: 'Houston',
      wps: [{lat:15,lng:-80},{lat:22,lng:-87}] }, // Caribbean then Yucatan Channel
    { sl: 19.2,  sg: -96.1, dl: 29.7,  dg: -95.0, sn: 'Veracruz',     dn: 'Houston',
      wps: [{lat:24,lng:-94}] }, // Gulf of Mexico
    // ── Africa — routes that would cross land need Atlantic waypoints ──
    { sl: -29.9, sg: 31.0,  dl: 51.9,  dg: 4.5,   sn: 'Durban',   dn: 'Rotterdam',
      wps: [{lat:-35,lng:32},{lat:-37,lng:20},{lat:-25,lng:11},{lat:-8,lng:3},{lat:5,lng:-3},{lat:24,lng:-18},{lat:36.1,lng:-5.6}] },
    { sl: 6.4,   sg: 3.4,   dl: 51.9,  dg: 4.5,   sn: 'Lagos',    dn: 'Rotterdam',
      wps: [{lat:2,lng:-5},{lat:14,lng:-18},{lat:28,lng:-14},{lat:36.1,lng:-5.6}] },
    { sl: 14.7,  sg: -17.4, dl: 40.7,  dg: -74.0, sn: 'Dakar',    dn: 'New York' }, // Atlantic, safe
    { sl: -4.1,  sg: 39.7,  dl: -34.4, dg: 18.5,  sn: 'Mombasa',  dn: 'Cape Town',
      wps: [{lat:-10,lng:44},{lat:-22,lng:50},{lat:-32,lng:33}] },
    // ── Indian Ocean — waypoints keep ships clear of Arabian Peninsula, India, E.Africa ──
    { sl: 25.0,  sg: 55.1,  dl: 1.35,  dg: 103.8, sn: 'Jebel Ali', dn: 'Singapore',
      wps: [{lat:18,lng:63},{lat:8,lng:78},{lat:4,lng:92}] },
    { sl: 25.0,  sg: 55.1,  dl: -34.4, dg: 18.5,  sn: 'Jebel Ali', dn: 'Cape Town',
      wps: [{lat:18,lng:63},{lat:5,lng:58},{lat:-8,lng:48},{lat:-22,lng:53},{lat:-32,lng:33}] },
    { sl: 19.0,  sg: 72.8,  dl: 1.35,  dg: 103.8, sn: 'Mumbai',    dn: 'Singapore',
      wps: [{lat:6,lng:82},{lat:3,lng:93}] }, // south of Sri Lanka
    { sl: 6.9,   sg: 79.9,  dl: 1.35,  dg: 103.8, sn: 'Colombo',   dn: 'Singapore' }, // Indian Ocean, safe
    { sl: -4.1,  sg: 39.7,  dl: 19.0,  dg: 72.8,  sn: 'Mombasa',   dn: 'Mumbai',
      wps: [{lat:5,lng:52}] }, // Gulf of Aden
    { sl: 19.0,  sg: 72.8,  dl: -4.1,  dg: 39.7,  sn: 'Mumbai',    dn: 'Mombasa',
      wps: [{lat:5,lng:52}] },
    // ── Intra-Asia — South China Sea/Western Pacific, safe ──
    { sl: 31.2,  sg: 121.5, dl: 1.35,  dg: 103.8, sn: 'Shanghai', dn: 'Singapore' },
    { sl: 35.7,  sg: 139.7, dl: 1.35,  dg: 103.8, sn: 'Tokyo',    dn: 'Singapore' },
    { sl: 35.1,  sg: 129.0, dl: 1.35,  dg: 103.8, sn: 'Busan',    dn: 'Singapore' },
    { sl: 14.6,  sg: 121.0, dl: 1.35,  dg: 103.8, sn: 'Manila',   dn: 'Singapore' },
    { sl: 31.2,  sg: 121.5, dl: 35.7,  dg: 139.7, sn: 'Shanghai', dn: 'Tokyo'     },
    { sl: 31.2,  sg: 121.5, dl: 35.1,  dg: 129.0, sn: 'Shanghai', dn: 'Busan'     },
    // ── Australia ↔ Asia — waypoints avoid Indonesian archipelago ──
    { sl: -33.9, sg: 151.2, dl: 1.35,  dg: 103.8, sn: 'Sydney',    dn: 'Singapore',
      wps: [{lat:-22,lng:152},{lat:-10.5,lng:143},{lat:-9,lng:128},{lat:-5,lng:116},{lat:-3,lng:108}] }, // Coral Sea → Torres Strait → Timor Sea → Lombok Strait
    { sl: -37.8, sg: 144.9, dl: 35.7,  dg: 139.7, sn: 'Melbourne', dn: 'Tokyo',
      wps: [{lat:-38,lng:152},{lat:-10,lng:156},{lat:5,lng:148},{lat:20,lng:145}] }, // Tasman Sea → Coral Sea → Pacific
    { sl: -27.4, sg: 153.0, dl: 1.35,  dg: 103.8, sn: 'Brisbane',  dn: 'Singapore',
      wps: [{lat:-20,lng:155},{lat:-10.5,lng:143},{lat:-9,lng:128},{lat:-5,lng:116},{lat:-3,lng:108}] },
    { sl: -31.9, sg: 115.8, dl: 1.35,  dg: 103.8, sn: 'Fremantle', dn: 'Singapore',
      wps: [{lat:-8,lng:108},{lat:3,lng:103}] }, // Indian Ocean → Malacca
    // ── South Pacific — Tasman Sea / open Pacific, safe ──
    { sl: -36.9, sg: 174.8, dl: 35.7,  dg: 139.7, sn: 'Auckland', dn: 'Tokyo'   },
    { sl: -36.9, sg: 174.8, dl: -33.9, dg: 151.2, sn: 'Auckland', dn: 'Sydney'  },
  ];
  const VESSEL_NAMES = [
    'EVER ACCORD','OOCL EUROPE','MSC GÜLSÜN','CMA CGM BRAZIL','COSCO SHIPPING UNIVERSE',
    'HMM ALGECIRAS','YANG MING WITNESS','ONE APUS','ZIM KINGSTON','MAERSK ESSEX',
    'HYUNDAI PRIDE','PIL VICTORIA','EVERGREEN ZENITH','APL DANUBE','HAPAG CAIRO',
    'MSC DIANA','CMA CGM THALASSA','COSCO NAGOYA','EVERGREEN FORTUNE','MSC OSCAR',
    'MAERSK MC-KINNEY','OOCL HONG KONG','ONE STORK','ZIM LUANDA','APL TEMASEK',
    'HYUNDAI BRAVE','PIL EUROPE','HAPAG BERLIN','MSC LORETO','COSCO FAITH',
    'EVER GIVEN','CMA CGM MARCO POLO','YANG MING UNIFORMITY','APL VANDA',
    'HAPAG LONDON','MSC ROMINA','EVERGREEN LION','ONE COLUMBA','ZIM AMSTERDAM',
    'MAERSK LABERINTO','OOCL BERLIN','PIL JAVA','HAPAG BRUGES','COSCO ALPS',
    'MSC ISTANBUL','CMA CGM TITUS','YANG MING WIND','APL CHANGI','ONE MINATO',
  ];
  const SIM_TYPES = ['Container', 'Container', 'Container', 'Container', 'Tanker', 'Bulk Carrier'];
  const simVessels = [];
  for (let i = 0; i < 250; i++) {
    const lane = VESSEL_LANES[i % VESSEL_LANES.length];
    const t = ((i * 0.13 + i * i * 0.0003 + Date.now() * 0.0000008) % 1);
    // Use waypointed interpolation if the lane has wps, otherwise plain great-circle.
    const allPts = lane.wps
      ? [{lat:lane.sl,lng:lane.sg}, ...lane.wps, {lat:lane.dl,lng:lane.dg}]
      : null;
    const pos = allPts ? gcWaypointedPoint(allPts, t) : greatCirclePoint(lane.sl, lane.sg, lane.dl, lane.dg, t);
    const { lat, lng } = pos;
    const suffix = i >= VESSEL_NAMES.length ? ` ${Math.floor(i / VESSEL_NAMES.length) + 1}` : '';
    simVessels.push({
      mmsi: 900000000 + i,
      name: VESSEL_NAMES[i % VESSEL_NAMES.length] + suffix,
      lat, lng,
      sog: 14 + (i % 7),
      cog: Math.atan2(lane.dl - lane.sl, lane.dg - lane.sg) * 180 / Math.PI,
      type: SIM_TYPES[i % SIM_TYPES.length],
      destination: lane.dn,
      srcLat: lane.sl, srcLng: lane.sg,
      dstLat: lane.dl, dstLng: lane.dg,
      srcName: lane.sn, dstName: lane.dn,
      waypoints: lane.wps || null,
      progress: t,
      ts: Date.now(), simulated: true,
    });
  }
  res.json({ source: 'simulated', vessels: simVessels });
});

// ── Terminal49 Container Tracking ───────────────────
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
          request_number: number,
          ...(type === 'bill_of_lading' && scac ? { scac } : {}),
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
    const r = await axios.get(
      `https://api.terminal49.com/v2/tracking_requests/${req.params.requestId}?include=shipment.containers`,
      { headers: { Authorization: `Token ${key}` } }
    );
    res.json(r.data);
  } catch (err) {
    res.status(err.response?.status || 500).json({ error: err.response?.data || err.message });
  }
});

// ── Air Freight (Flights) ─────────────────────────────────────────────────
const CARGO_PREFIXES_SET = new Set(['FDX','UPS','GTI','CLX','NCA','CKS','PAC','SWN','KAC','CAL','CPA','ETD','QTR','ABX','ATN','GEC','TAY','VDA','DHL','BOX','WOA','ETH','LCO','CKK']);

const FLIGHT_ROUTES = [
  { from:'Memphis',     fromLat:35.04,  fromLng:-89.98,  to:'Frankfurt',   toLat:50.04,  toLng:8.57    },
  { from:'Memphis',     fromLat:35.04,  fromLng:-89.98,  to:'Los Angeles', toLat:33.94,  toLng:-118.41 },
  { from:'Memphis',     fromLat:35.04,  fromLng:-89.98,  to:'Tokyo',       toLat:35.54,  toLng:139.78  },
  { from:'Memphis',     fromLat:35.04,  fromLng:-89.98,  to:'Shanghai',    toLat:31.14,  toLng:121.81  },
  { from:'Louisville',  fromLat:38.17,  fromLng:-85.74,  to:'Frankfurt',   toLat:50.04,  toLng:8.57    },
  { from:'Louisville',  fromLat:38.17,  fromLng:-85.74,  to:'Los Angeles', toLat:33.94,  toLng:-118.41 },
  { from:'Louisville',  fromLat:38.17,  fromLng:-85.74,  to:'Chicago',     toLat:41.97,  toLng:-87.91  },
  { from:'Frankfurt',   fromLat:50.04,  fromLng:8.57,    to:'Dubai',       toLat:25.25,  toLng:55.36   },
  { from:'Frankfurt',   fromLat:50.04,  fromLng:8.57,    to:'Singapore',   toLat:1.36,   toLng:103.99  },
  { from:'Frankfurt',   fromLat:50.04,  fromLng:8.57,    to:'New York',    toLat:40.63,  toLng:-73.78  },
  { from:'Dubai',       fromLat:25.25,  fromLng:55.36,   to:'Hong Kong',   toLat:22.31,  toLng:113.92  },
  { from:'Dubai',       fromLat:25.25,  fromLng:55.36,   to:'London',      toLat:51.47,  toLng:-0.45   },
  { from:'Dubai',       fromLat:25.25,  fromLng:55.36,   to:'Mumbai',      toLat:19.09,  toLng:72.87   },
  { from:'Hong Kong',   fromLat:22.31,  fromLng:113.92,  to:'Los Angeles', toLat:33.94,  toLng:-118.41 },
  { from:'Hong Kong',   fromLat:22.31,  fromLng:113.92,  to:'Chicago',     toLat:41.97,  toLng:-87.91  },
  { from:'Shanghai',    fromLat:31.14,  fromLng:121.81,  to:'Los Angeles', toLat:33.94,  toLng:-118.41 },
  { from:'Shanghai',    fromLat:31.14,  fromLng:121.81,  to:'Amsterdam',   toLat:52.31,  toLng:4.77    },
  { from:'Tokyo',       fromLat:35.54,  fromLng:139.78,  to:'Los Angeles', toLat:33.94,  toLng:-118.41 },
  { from:'Tokyo',       fromLat:35.54,  fromLng:139.78,  to:'Amsterdam',   toLat:52.31,  toLng:4.77    },
  { from:'Incheon',     fromLat:37.46,  fromLng:126.44,  to:'Los Angeles', toLat:33.94,  toLng:-118.41 },
  { from:'Incheon',     fromLat:37.46,  fromLng:126.44,  to:'Frankfurt',   toLat:50.04,  toLng:8.57    },
  { from:'Anchorage',   fromLat:61.17,  fromLng:-149.99, to:'Tokyo',       toLat:35.54,  toLng:139.78  },
  { from:'Anchorage',   fromLat:61.17,  fromLng:-149.99, to:'Frankfurt',   toLat:50.04,  toLng:8.57    },
  { from:'Anchorage',   fromLat:61.17,  fromLng:-149.99, to:'Chicago',     toLat:41.97,  toLng:-87.91  },
  { from:'Singapore',   fromLat:1.36,   fromLng:103.99,  to:'Amsterdam',   toLat:52.31,  toLng:4.77    },
  { from:'Singapore',   fromLat:1.36,   fromLng:103.99,  to:'Sydney',      toLat:-33.95, toLng:151.18  },
  { from:'Miami',       fromLat:25.79,  fromLng:-80.29,  to:'Bogota',      toLat:4.70,   toLng:-74.14  },
  { from:'Miami',       fromLat:25.79,  fromLng:-80.29,  to:'Mexico City', toLat:19.44,  toLng:-99.07  },
  { from:'Los Angeles', fromLat:33.94,  fromLng:-118.41, to:'Tokyo',       toLat:35.54,  toLng:139.78  },
  { from:'London',      fromLat:51.47,  fromLng:-0.45,   to:'New York',    toLat:40.63,  toLng:-73.78  },
  { from:'London',      fromLat:51.47,  fromLng:-0.45,   to:'Dubai',       toLat:25.25,  toLng:55.36   },
  { from:'Amsterdam',   fromLat:52.31,  fromLng:4.77,    to:'New York',    toLat:40.63,  toLng:-73.78  },
  { from:'Amsterdam',   fromLat:52.31,  fromLng:4.77,    to:'Singapore',   toLat:1.36,   toLng:103.99  },
  { from:'Doha',        fromLat:25.27,  fromLng:51.61,   to:'Chicago',     toLat:41.97,  toLng:-87.91  },
  { from:'Addis Ababa', fromLat:8.98,   fromLng:38.80,   to:'Frankfurt',   toLat:50.04,  toLng:8.57    },
  { from:'Addis Ababa', fromLat:8.98,   fromLng:38.80,   to:'Beijing',     toLat:40.08,  toLng:116.59  },
  { from:'Taipei',      fromLat:25.08,  fromLng:121.23,  to:'Los Angeles', toLat:33.94,  toLng:-118.41 },
];

function gcFlightPoint(lat1d, lng1d, lat2d, lng2d, t) {
  const R = Math.PI / 180;
  const lat1 = lat1d * R, lng1 = lng1d * R, lat2 = lat2d * R, lng2 = lng2d * R;
  const x1 = Math.cos(lat1)*Math.cos(lng1), y1 = Math.cos(lat1)*Math.sin(lng1), z1 = Math.sin(lat1);
  const x2 = Math.cos(lat2)*Math.cos(lng2), y2 = Math.cos(lat2)*Math.sin(lng2), z2 = Math.sin(lat2);
  const dot = Math.min(1, Math.max(-1, x1*x2 + y1*y2 + z1*z2));
  const omega = Math.acos(dot);
  if (omega < 0.0001) return { lat: lat1d, lng: lng1d, heading: 0 };
  const s = Math.sin(omega);
  const a = Math.sin((1-t)*omega)/s, b = Math.sin(t*omega)/s;
  const x = a*x1 + b*x2, y = a*y1 + b*y2, z = a*z1 + b*z2;
  const lat = Math.atan2(z, Math.sqrt(x*x + y*y)) / R;
  const lng = Math.atan2(y, x) / R;
  // Heading from adjacent point
  const t2 = Math.min(t + 0.01, 0.999);
  const a2 = Math.sin((1-t2)*omega)/s, b2 = Math.sin(t2*omega)/s;
  const x2p = a2*x1 + b2*x2, y2p = a2*y1 + b2*y2, z2p = a2*z1 + b2*z2;
  const lat2p = Math.atan2(z2p, Math.sqrt(x2p*x2p + y2p*y2p)) / R;
  const lng2p = Math.atan2(y2p, x2p) / R;
  const dLng = ((lng2p - lng + 540) % 360 - 180) * R;
  const heading = ((Math.atan2(
    Math.sin(dLng),
    Math.cos(lat * R) * Math.sin(lat2p * R) - Math.sin(lat * R) * Math.cos(lat2p * R) * Math.cos(dLng)
  ) / R + 360) % 360);
  return { lat, lng, heading };
}

const CARGO_CS = ['FDX','UPS','GTI','CLX','NCA','ABX','ATN','PAC','KAC','CAL','CPA','ETH'];
const AC_TYPES = ['B748','B77F','MD11','B763','A330'];
const PAXCS = ['AAL','UAL','DAL','BAW','DLH','AFR','SIA','KAL','QFA','CCA','UAE','JAL','ANA','VIR','IBE'];
const PAX_AC_TYPES = ['B777','B787','A380','A350','B737','A320'];
const PASSENGER_ROUTES = [
  { from:'New York',     fromLat:40.63,  fromLng:-73.78,  to:'London',      toLat:51.47,  toLng:-0.45   },
  { from:'New York',     fromLat:40.63,  fromLng:-73.78,  to:'Paris',       toLat:49.01,  toLng:2.55    },
  { from:'New York',     fromLat:40.63,  fromLng:-73.78,  to:'Tokyo',       toLat:35.54,  toLng:139.78  },
  { from:'New York',     fromLat:40.63,  fromLng:-73.78,  to:'Dubai',       toLat:25.25,  toLng:55.36   },
  { from:'New York',     fromLat:40.63,  fromLng:-73.78,  to:'Hong Kong',   toLat:22.31,  toLng:113.92  },
  { from:'Los Angeles',  fromLat:33.94,  fromLng:-118.41, to:'London',      toLat:51.47,  toLng:-0.45   },
  { from:'Los Angeles',  fromLat:33.94,  fromLng:-118.41, to:'Seoul',       toLat:37.46,  toLng:126.44  },
  { from:'Los Angeles',  fromLat:33.94,  fromLng:-118.41, to:'Singapore',   toLat:1.36,   toLng:103.99  },
  { from:'Los Angeles',  fromLat:33.94,  fromLng:-118.41, to:'Sydney',      toLat:-33.95, toLng:151.18  },
  { from:'Los Angeles',  fromLat:33.94,  fromLng:-118.41, to:'Beijing',     toLat:40.08,  toLng:116.59  },
  { from:'Chicago',      fromLat:41.97,  fromLng:-87.91,  to:'London',      toLat:51.47,  toLng:-0.45   },
  { from:'Chicago',      fromLat:41.97,  fromLng:-87.91,  to:'Tokyo',       toLat:35.54,  toLng:139.78  },
  { from:'Dallas',       fromLat:32.90,  fromLng:-97.04,  to:'Tokyo',       toLat:35.54,  toLng:139.78  },
  { from:'Dallas',       fromLat:32.90,  fromLng:-97.04,  to:'London',      toLat:51.47,  toLng:-0.45   },
  { from:'Miami',        fromLat:25.79,  fromLng:-80.29,  to:'London',      toLat:51.47,  toLng:-0.45   },
  { from:'London',       fromLat:51.47,  fromLng:-0.45,   to:'Singapore',   toLat:1.36,   toLng:103.99  },
  { from:'London',       fromLat:51.47,  fromLng:-0.45,   to:'Hong Kong',   toLat:22.31,  toLng:113.92  },
  { from:'London',       fromLat:51.47,  fromLng:-0.45,   to:'Sydney',      toLat:-33.95, toLng:151.18  },
  { from:'London',       fromLat:51.47,  fromLng:-0.45,   to:'Mumbai',      toLat:19.09,  toLng:72.87   },
  { from:'Dubai',        fromLat:25.25,  fromLng:55.36,   to:'New York',    toLat:40.63,  toLng:-73.78  },
  { from:'Dubai',        fromLat:25.25,  fromLng:55.36,   to:'Sydney',      toLat:-33.95, toLng:151.18  },
  { from:'Dubai',        fromLat:25.25,  fromLng:55.36,   to:'London',      toLat:51.47,  toLng:-0.45   },
  { from:'Paris',        fromLat:49.01,  fromLng:2.55,    to:'Singapore',   toLat:1.36,   toLng:103.99  },
  { from:'Paris',        fromLat:49.01,  fromLng:2.55,    to:'Tokyo',       toLat:35.54,  toLng:139.78  },
  { from:'Tokyo',        fromLat:35.54,  fromLng:139.78,  to:'New York',    toLat:40.63,  toLng:-73.78  },
  { from:'Seoul',        fromLat:37.46,  fromLng:126.44,  to:'London',      toLat:51.47,  toLng:-0.45   },
  { from:'Seoul',        fromLat:37.46,  fromLng:126.44,  to:'New York',    toLat:40.63,  toLng:-73.78  },
  { from:'Sydney',       fromLat:-33.95, fromLng:151.18,  to:'London',      toLat:51.47,  toLng:-0.45   },
  { from:'Mumbai',       fromLat:19.09,  fromLng:72.87,   to:'London',      toLat:51.47,  toLng:-0.45   },
  { from:'Sao Paulo',    fromLat:-23.43, fromLng:-46.48,  to:'London',      toLat:51.47,  toLng:-0.45   },
];
let _flightCache = { flights: [], ts: 0, source: 'simulated' };
let _openSkyToken = { access_token: null, expires_at: 0 };

async function getOpenSkyToken() {
  if (_openSkyToken.access_token && Date.now() < _openSkyToken.expires_at - 30000) {
    return _openSkyToken.access_token;
  }
  const clientId = process.env.OPENSKY_CLIENT_ID;
  const clientSecret = process.env.OPENSKY_CLIENT_SECRET;
  if (!clientId || !clientSecret) return null;
  try {
    const axios = require('axios');
    const r = await axios.post(
      'https://opensky-network.org/auth/realms/opensky-network/protocol/openid-connect/token',
      `grant_type=client_credentials&client_id=${encodeURIComponent(clientId)}&client_secret=${encodeURIComponent(clientSecret)}`,
      { headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, timeout: 6000 }
    );
    const { access_token, expires_in } = r.data;
    _openSkyToken = { access_token, expires_at: Date.now() + (expires_in || 300) * 1000 };
    return access_token;
  } catch (e) {
    console.warn('[flights] OpenSky token fetch failed:', e.message);
    return null;
  }
}

// Token proxy: lets the browser call OpenSky directly using the user's IP (bypasses Railway IP blocks)
app.get('/api/opensky-token', async (req, res) => {
  try {
    const token = await getOpenSkyToken();
    if (!token) return res.status(503).json({ error: 'OpenSky credentials not configured' });
    res.json({ token, expires_in: 300 });
  } catch (e) {
    res.status(503).json({ error: e.message });
  }
});

function buildSimulatedFlights() {
  const now = Date.now();
  const flights = [];
  // Cargo flights
  FLIGHT_ROUTES.forEach((r, ri) => {
    for (let i = 0; i < 3; i++) {
      const seed = ri * 3 + i;
      const phase = (seed * 7919 + 3571) % 86400;
      const progress = ((now / 1000 + phase) % 86400) / 86400;
      const { lat, lng, heading } = gcFlightPoint(r.fromLat, r.fromLng, r.toLat, r.toLng, progress);
      const cs = CARGO_CS[seed % CARGO_CS.length];
      const num = 1000 + ((seed * 47 + ri * 13) % 8999);
      flights.push({
        id: `SIM${seed}`, callsign: `${cs}${num}`, isCargo: true,
        lat, lng, altitude: 9000 + ((seed * 37 + i * 500) % 3000),
        velocity: 240 + ((seed * 13 + i * 7) % 60), heading,
        origin: r.from, destination: r.to,
        srcLat: r.fromLat, srcLng: r.fromLng, dstLat: r.toLat, dstLng: r.toLng,
        progress, aircraftType: AC_TYPES[seed % AC_TYPES.length],
      });
    }
  });
  // Passenger flights
  PASSENGER_ROUTES.forEach((r, ri) => {
    for (let i = 0; i < 3; i++) {
      const seed = 10000 + ri * 3 + i;
      const phase = (seed * 6271 + 4817) % 86400;
      const progress = ((now / 1000 + phase) % 86400) / 86400;
      const { lat, lng, heading } = gcFlightPoint(r.fromLat, r.fromLng, r.toLat, r.toLng, progress);
      const cs = PAXCS[seed % PAXCS.length];
      const num = 100 + ((seed * 31 + ri * 17) % 899);
      flights.push({
        id: `PAX${seed}`, callsign: `${cs}${num}`, isCargo: false,
        lat, lng, altitude: 10000 + ((seed * 29 + i * 300) % 2000),
        velocity: 250 + ((seed * 11 + i * 9) % 50), heading,
        origin: r.from, destination: r.to,
        srcLat: r.fromLat, srcLng: r.fromLng, dstLat: r.toLat, dstLng: r.toLng,
        progress, aircraftType: PAX_AC_TYPES[seed % PAX_AC_TYPES.length],
      });
    }
  });
  return flights;
}

app.get('/api/flights', async (req, res) => {
  const now = Date.now();
  const CACHE_TTL = 45_000;
  const forceSim = req.query.mode === 'sim';
  // Only serve cached live data; simulated positions are derived from Date.now()
  // so they must be computed fresh each call — otherwise planes don't move on refresh.
  if (!forceSim && _flightCache.source === 'live' && now - _flightCache.ts < CACHE_TTL && _flightCache.flights.length > 0) {
    return res.json({ flights: _flightCache.flights, source: _flightCache.source });
  }
  if (!forceSim) {
    try {
      const axios = require('axios');
      // Try authenticated first; if token fetch fails fall through to unauthenticated
      let headers = {};
      try {
        const token = await getOpenSkyToken();
        if (token) headers = { Authorization: `Bearer ${token}` };
      } catch (_) {}
      const r = await axios.get('https://opensky-network.org/api/states/all', {
        headers,
        timeout: 8000,
      });
      const states = (r.data?.states || []).filter(s =>
        s[5] != null && s[6] != null && !s[8] &&
        CARGO_PREFIXES_SET.has((s[1] || '').trim().toUpperCase().slice(0, 3))
      );
      if (states.length >= 20) {
        const flights = states.map(s => ({
          id: s[0],
          callsign: (s[1] || '').trim(),
          isCargo: true,
          lat: s[6], lng: s[5],
          altitude: s[7] || 0,
          velocity: s[9] ? Math.round(s[9] * 1.944) : 0,
          heading: s[10] || 0,
          origin: s[2] || 'Unknown',
          destination: null,
          srcLat: null, srcLng: null, dstLat: null, dstLng: null,
          progress: null,
          aircraftType: null,
        }));
        _flightCache = { flights, ts: now, source: 'live' };
        return res.json({ flights, source: 'live' });
      }
    } catch (liveErr) {
      console.error('[flights] Live ADS-B failed:', liveErr?.response?.status, liveErr?.message?.slice(0, 120));
      // fall through to simulated data
    }
  }
  const simFlights = buildSimulatedFlights();
  // Don't write simulated data to cache — fresh positions on every request
  res.json({ flights: simFlights, source: 'simulated' });
});

// ── Scheduled Jobs ─────────────────────────────────
const cron = require('node-cron');

// Refresh FRED trade data cache every night at midnight EST
// '0 0 * * *' in America/New_York = 05:00 UTC in winter, 04:00 UTC in summer
cron.schedule('0 0 * * *', () => {
  console.log('[CRON] Midnight EST — refreshing FRED trade data cache...');
  refreshAllTradeCache().catch(e => console.error('[CRON] Refresh failed:', e.message));
}, { timezone: 'America/New_York' });

// ── Land Freight — 110 highway corridors, ~340 simulated trucks ──────────────
// count field = trucks on that lane (default 4).
const TRUCK_LANES = [
  // ── North America — US Interstate (high-volume) ──
  { sl: 34.0, sg: -118.2, dl: 40.7, dg: -74.0,  sn: 'Los Angeles', dn: 'New York',        type: 'regular', carrier: 'JB Hunt',      count: 4 },
  { sl: 41.9, sg: -87.6,  dl: 34.0, dg: -118.2, sn: 'Chicago',     dn: 'Los Angeles',     type: 'regular', carrier: 'Schneider',    count: 4 },
  { sl: 40.7, sg: -74.0,  dl: 41.9, dg: -87.6,  sn: 'New York',    dn: 'Chicago',         type: 'regular', carrier: 'Werner',       count: 4 },
  { sl: 33.7, sg: -84.4,  dl: 41.9, dg: -87.6,  sn: 'Atlanta',     dn: 'Chicago',         type: 'regular', carrier: 'XPO',          count: 4 },
  { sl: 32.8, sg: -96.8,  dl: 41.9, dg: -87.6,  sn: 'Dallas',      dn: 'Chicago',         type: 'regular', carrier: 'JB Hunt',      count: 4 },
  { sl: 34.0, sg: -118.2, dl: 32.8, dg: -96.8,  sn: 'Los Angeles', dn: 'Dallas',          type: 'regular', carrier: 'Schneider',    count: 4 },
  { sl: 33.7, sg: -84.4,  dl: 32.8, dg: -96.8,  sn: 'Atlanta',     dn: 'Dallas',          type: 'regular', carrier: 'JB Hunt',      count: 4 },
  { sl: 32.8, sg: -96.8,  dl: 33.7, dg: -84.4,  sn: 'Dallas',      dn: 'Atlanta',         type: 'regular', carrier: 'Werner',       count: 4 },
  { sl: 41.9, sg: -87.6,  dl: 35.1, dg: -90.0,  sn: 'Chicago',     dn: 'Memphis',         type: 'regular', carrier: 'Old Dominion', count: 4 },
  { sl: 29.8, sg: -95.4,  dl: 32.8, dg: -96.8,  sn: 'Houston',     dn: 'Dallas',          type: 'tank',    carrier: 'Schneider',    count: 4 },
  // ── US Interstate (standard) ──
  { sl: 25.8, sg: -80.2,  dl: 33.7, dg: -84.4,  sn: 'Miami',       dn: 'Atlanta',         type: 'regular', carrier: 'Old Dominion' },
  { sl: 35.1, sg: -90.0,  dl: 33.7, dg: -84.4,  sn: 'Memphis',     dn: 'Atlanta',         type: 'regular', carrier: 'XPO'          },
  { sl: 34.0, sg: -118.2, dl: 33.4, dg: -112.1, sn: 'Los Angeles', dn: 'Phoenix',         type: 'regular', carrier: 'JB Hunt'      },
  { sl: 33.4, sg: -112.1, dl: 32.8, dg: -96.8,  sn: 'Phoenix',     dn: 'Dallas',          type: 'regular', carrier: 'Werner'       },
  { sl: 47.6, sg: -122.3, dl: 34.0, dg: -118.2, sn: 'Seattle',     dn: 'Los Angeles',     type: 'regular', carrier: 'Schneider'    },
  { sl: 39.7, sg: -104.9, dl: 34.0, dg: -118.2, sn: 'Denver',      dn: 'Los Angeles',     type: 'regular', carrier: 'XPO'          },
  { sl: 39.1, sg: -94.6,  dl: 39.7, dg: -104.9, sn: 'Kansas City', dn: 'Denver',          type: 'regular', carrier: 'JB Hunt'      },
  { sl: 40.7, sg: -74.0,  dl: 42.4, dg: -71.1,  sn: 'New York',    dn: 'Boston',          type: 'regular', carrier: 'Old Dominion' },
  { sl: 42.3, sg: -83.1,  dl: 41.9, dg: -87.6,  sn: 'Detroit',     dn: 'Chicago',         type: 'regular', carrier: 'XPO'          },
  { sl: 42.3, sg: -83.1,  dl: 40.7, dg: -74.0,  sn: 'Detroit',     dn: 'New York',        type: 'regular', carrier: 'JB Hunt'      },
  { sl: 40.7, sg: -74.0,  dl: 39.0, dg: -76.6,  sn: 'New York',    dn: 'Baltimore',       type: 'regular', carrier: 'Old Dominion' },
  { sl: 36.2, sg: -115.2, dl: 34.0, dg: -118.2, sn: 'Las Vegas',   dn: 'Los Angeles',     type: 'regular', carrier: 'Werner'       },
  { sl: 29.8, sg: -95.4,  dl: 29.95,dg: -90.1,  sn: 'Houston',     dn: 'New Orleans',     type: 'tank',    carrier: 'Werner'       },
  { sl: 29.8, sg: -95.4,  dl: 30.3, dg: -97.7,  sn: 'Houston',     dn: 'Austin',          type: 'tank',    carrier: 'Schneider'    },
  // ── US secondary corridors (count 3) ──
  { sl: 44.9, sg: -93.2,  dl: 41.9, dg: -87.6,  sn: 'Minneapolis', dn: 'Chicago',         type: 'regular', carrier: 'JB Hunt',      count: 3 },
  { sl: 35.2, sg: -80.8,  dl: 33.7, dg: -84.4,  sn: 'Charlotte',   dn: 'Atlanta',         type: 'regular', carrier: 'Old Dominion', count: 3 },
  { sl: 30.3, sg: -81.7,  dl: 25.8, dg: -80.2,  sn: 'Jacksonville',dn: 'Miami',           type: 'regular', carrier: 'XPO',          count: 3 },
  { sl: 36.2, sg: -86.8,  dl: 33.7, dg: -84.4,  sn: 'Nashville',   dn: 'Atlanta',         type: 'regular', carrier: 'Werner',       count: 3 },
  { sl: 39.8, sg: -86.1,  dl: 41.9, dg: -87.6,  sn: 'Indianapolis',dn: 'Chicago',         type: 'regular', carrier: 'Schneider',    count: 3 },
  { sl: 40.8, sg: -111.9, dl: 39.7, dg: -104.9, sn: 'Salt Lake City',dn: 'Denver',        type: 'regular', carrier: 'JB Hunt',      count: 3 },
  { sl: 37.8, sg: -122.4, dl: 34.0, dg: -118.2, sn: 'San Francisco',dn: 'Los Angeles',    type: 'regular', carrier: 'Werner',       count: 3 },
  { sl: 45.5, sg: -122.7, dl: 47.6, dg: -122.3, sn: 'Portland',    dn: 'Seattle',         type: 'regular', carrier: 'Schneider',    count: 3 },
  { sl: 29.4, sg: -98.5,  dl: 29.8, dg: -95.4,  sn: 'San Antonio', dn: 'Houston',         type: 'tank',    carrier: 'XPO',          count: 3 },
  { sl: 38.6, sg: -90.2,  dl: 41.9, dg: -87.6,  sn: 'St. Louis',   dn: 'Chicago',         type: 'regular', carrier: 'Old Dominion', count: 3 },
  { sl: 36.2, sg: -86.8,  dl: 35.1, dg: -90.0,  sn: 'Nashville',   dn: 'Memphis',         type: 'regular', carrier: 'JB Hunt',      count: 3 },
  { sl: 35.2, sg: -89.9,  dl: 32.3, dg: -90.2,  sn: 'Memphis',     dn: 'Jackson MS',      type: 'tank',    carrier: 'Werner',       count: 3 },
  // ── US–Mexico NAFTA ──
  { sl: 27.5, sg: -99.5,  dl: 19.4, dg: -99.1,  sn: 'Laredo',      dn: 'Mexico City',     type: 'regular', carrier: 'XPO'          },
  { sl: 31.8, sg: -106.4, dl: 25.7, dg: -100.3, sn: 'El Paso',     dn: 'Monterrey',       type: 'regular', carrier: 'DB Schenker'  },
  { sl: 32.5, sg: -117.0, dl: 20.7, dg: -103.3, sn: 'Tijuana',     dn: 'Guadalajara',     type: 'tank',    carrier: 'Werner'       },
  { sl: 32.8, sg: -96.8,  dl: 27.5, dg: -99.5,  sn: 'Dallas',      dn: 'Laredo',          type: 'regular', carrier: 'JB Hunt'      },
  { sl: 29.8, sg: -95.4,  dl: 27.5, dg: -99.5,  sn: 'Houston',     dn: 'Laredo',          type: 'tank',    carrier: 'Schneider'    },
  { sl: 19.4, sg: -99.1,  dl: 20.7, dg: -103.3, sn: 'Mexico City', dn: 'Guadalajara',     type: 'regular', carrier: 'DHL Freight',  count: 3 },
  { sl: 20.7, sg: -103.3, dl: 20.5, dg: -100.4, sn: 'Guadalajara', dn: 'Querétaro',       type: 'regular', carrier: 'DB Schenker',  count: 3 },
  // ── US–Canada ──
  { sl: 42.3, sg: -83.1,  dl: 43.7, dg: -79.4,  sn: 'Detroit',     dn: 'Toronto',         type: 'regular', carrier: 'XPO'          },
  { sl: 47.6, sg: -122.3, dl: 49.3, dg: -123.1, sn: 'Seattle',     dn: 'Vancouver',       type: 'regular', carrier: 'JB Hunt'      },
  { sl: 43.7, sg: -79.4,  dl: 45.5, dg: -73.6,  sn: 'Toronto',     dn: 'Montreal',        type: 'regular', carrier: 'DB Schenker'  },
  { sl: 49.3, sg: -123.1, dl: 51.0, dg: -114.1, sn: 'Vancouver',   dn: 'Calgary',         type: 'regular', carrier: 'Werner'       },
  { sl: 51.0, sg: -114.1, dl: 53.5, dg: -113.5, sn: 'Calgary',     dn: 'Edmonton',        type: 'tank',    carrier: 'Schneider'    },
  { sl: 45.5, sg: -73.6,  dl: 46.8, dg: -71.2,  sn: 'Montreal',    dn: 'Quebec City',     type: 'regular', carrier: 'DHL Freight',  count: 3 },
  // ── South America ──
  { sl: -23.5,sg: -46.6,  dl: -34.6,dg: -58.4,  sn: 'São Paulo',   dn: 'Buenos Aires',    type: 'regular', carrier: 'DHL Freight'  },
  { sl: -23.5,sg: -46.6,  dl: -19.9,dg: -43.9,  sn: 'São Paulo',   dn: 'Belo Horizonte',  type: 'regular', carrier: 'DHL Freight'  },
  { sl: -12.0,sg: -77.0,  dl: -33.5,dg: -70.6,  sn: 'Lima',        dn: 'Santiago',        type: 'tank',    carrier: 'DB Schenker'  },
  { sl: -22.9,sg: -43.2,  dl: -23.5,dg: -46.6,  sn: 'Rio de Janeiro',dn: 'São Paulo',     type: 'regular', carrier: 'DHL Freight',  count: 3 },
  { sl: 4.7,  sg: -74.1,  dl: 6.2,  dg: -75.6,  sn: 'Bogotá',      dn: 'Medellín',        type: 'regular', carrier: 'DB Schenker',  count: 3 },
  { sl: -34.6,sg: -58.4,  dl: -32.9,dg: -68.8,  sn: 'Buenos Aires',dn: 'Mendoza',         type: 'tank',    carrier: 'DHL Freight',  count: 3 },
  { sl: 10.5, sg: -66.9,  dl: 4.7,  dg: -74.1,  sn: 'Caracas',     dn: 'Bogotá',          type: 'regular', carrier: 'DB Schenker',  count: 3 },
  // ── Europe (core) ──
  { sl: 51.5, sg: -0.1,   dl: 48.9, dg: 2.3,    sn: 'London',      dn: 'Paris',           type: 'regular', carrier: 'DB Schenker'  },
  { sl: 48.9, sg: 2.3,    dl: 50.8, dg: 4.4,    sn: 'Paris',       dn: 'Brussels',        type: 'regular', carrier: 'DHL Freight'  },
  { sl: 50.8, sg: 4.4,    dl: 52.4, dg: 4.9,    sn: 'Brussels',    dn: 'Amsterdam',       type: 'regular', carrier: 'DB Schenker'  },
  { sl: 52.4, sg: 4.9,    dl: 53.6, dg: 10.0,   sn: 'Amsterdam',   dn: 'Hamburg',         type: 'regular', carrier: 'XPO'          },
  { sl: 53.6, sg: 10.0,   dl: 52.5, dg: 13.4,   sn: 'Hamburg',     dn: 'Berlin',          type: 'regular', carrier: 'DB Schenker'  },
  { sl: 52.5, sg: 13.4,   dl: 52.2, dg: 21.0,   sn: 'Berlin',      dn: 'Warsaw',          type: 'regular', carrier: 'DHL Freight'  },
  { sl: 52.2, sg: 21.0,   dl: 50.5, dg: 30.5,   sn: 'Warsaw',      dn: 'Kyiv',            type: 'regular', carrier: 'DB Schenker'  },
  { sl: 48.9, sg: 2.3,    dl: 45.7, dg: 4.8,    sn: 'Paris',       dn: 'Lyon',            type: 'regular', carrier: 'XPO'          },
  { sl: 45.7, sg: 4.8,    dl: 45.5, dg: 9.2,    sn: 'Lyon',        dn: 'Milan',           type: 'regular', carrier: 'DHL Freight'  },
  { sl: 45.5, sg: 9.2,    dl: 41.9, dg: 12.5,   sn: 'Milan',       dn: 'Rome',            type: 'regular', carrier: 'DB Schenker'  },
  { sl: 53.6, sg: 10.0,   dl: 48.1, dg: 11.6,   sn: 'Hamburg',     dn: 'Munich',          type: 'regular', carrier: 'DHL Freight'  },
  { sl: 48.1, sg: 11.6,   dl: 48.2, dg: 16.4,   sn: 'Munich',      dn: 'Vienna',          type: 'regular', carrier: 'DB Schenker'  },
  { sl: 48.2, sg: 16.4,   dl: 47.5, dg: 19.1,   sn: 'Vienna',      dn: 'Budapest',        type: 'regular', carrier: 'XPO'          },
  { sl: 47.5, sg: 19.1,   dl: 44.4, dg: 26.1,   sn: 'Budapest',    dn: 'Bucharest',       type: 'regular', carrier: 'DHL Freight'  },
  { sl: 50.1, sg: 8.7,    dl: 48.9, dg: 2.3,    sn: 'Frankfurt',   dn: 'Paris',           type: 'regular', carrier: 'DB Schenker'  },
  { sl: 41.4, sg: 2.2,    dl: 40.4, dg: -3.7,   sn: 'Barcelona',   dn: 'Madrid',          type: 'regular', carrier: 'DHL Freight'  },
  { sl: 40.4, sg: -3.7,   dl: 38.7, dg: -9.1,   sn: 'Madrid',      dn: 'Lisbon',          type: 'regular', carrier: 'DB Schenker'  },
  { sl: 51.9, sg: 4.5,    dl: 50.1, dg: 8.7,    sn: 'Rotterdam',   dn: 'Frankfurt',       type: 'tank',    carrier: 'DHL Freight'  },
  { sl: 59.3, sg: 18.1,   dl: 59.9, dg: 10.7,   sn: 'Stockholm',   dn: 'Oslo',            type: 'regular', carrier: 'DB Schenker'  },
  { sl: 60.2, sg: 24.9,   dl: 59.3, dg: 18.1,   sn: 'Helsinki',    dn: 'Stockholm',       type: 'regular', carrier: 'DHL Freight'  },
  // ── Europe (secondary, count 3) ──
  { sl: 51.5, sg: -0.1,   dl: 50.1, dg: 8.7,    sn: 'London',      dn: 'Frankfurt',       type: 'regular', carrier: 'DB Schenker',  count: 3 },
  { sl: 47.4, sg: 8.5,    dl: 50.1, dg: 8.7,    sn: 'Zurich',      dn: 'Frankfurt',       type: 'tank',    carrier: 'DHL Freight',  count: 3 },
  { sl: 50.1, sg: 14.4,   dl: 48.2, dg: 16.4,   sn: 'Prague',      dn: 'Vienna',          type: 'regular', carrier: 'DB Schenker',  count: 3 },
  { sl: 42.7, sg: 23.3,   dl: 41.0, dg: 28.9,   sn: 'Sofia',       dn: 'Istanbul',        type: 'regular', carrier: 'DHL Freight',  count: 3 },
  { sl: 55.7, sg: 12.6,   dl: 53.6, dg: 10.0,   sn: 'Copenhagen',  dn: 'Hamburg',         type: 'regular', carrier: 'DB Schenker',  count: 3 },
  { sl: 38.0, sg: 23.7,   dl: 41.0, dg: 28.9,   sn: 'Athens',      dn: 'Istanbul',        type: 'regular', carrier: 'XPO',          count: 3 },
  { sl: 44.8, sg: 20.5,   dl: 42.7, dg: 23.3,   sn: 'Belgrade',    dn: 'Sofia',           type: 'regular', carrier: 'DHL Freight',  count: 3 },
  // ── Europe (expanded — splitting heavy corridors into segments) ──
  { sl: 51.5, sg: -0.1,   dl: 50.8, dg: 4.4,    sn: 'London',      dn: 'Brussels',        type: 'regular', carrier: 'DB Schenker',  count: 3 },
  { sl: 50.1, sg: 8.7,    dl: 52.5, dg: 13.4,   sn: 'Frankfurt',   dn: 'Berlin',          type: 'regular', carrier: 'DHL Freight',  count: 3 },
  { sl: 52.5, sg: 13.4,   dl: 50.1, dg: 14.4,   sn: 'Berlin',      dn: 'Prague',          type: 'regular', carrier: 'XPO',          count: 3 },
  { sl: 48.9, sg: 2.3,    dl: 47.4, dg: 8.5,    sn: 'Paris',       dn: 'Zurich',          type: 'regular', carrier: 'DB Schenker',  count: 3 },
  { sl: 48.2, sg: 16.4,   dl: 50.1, dg: 14.4,   sn: 'Vienna',      dn: 'Prague',          type: 'regular', carrier: 'DHL Freight',  count: 3 },
  { sl: 52.2, sg: 21.0,   dl: 47.5, dg: 19.1,   sn: 'Warsaw',      dn: 'Budapest',        type: 'regular', carrier: 'DB Schenker',  count: 3 },
  { sl: 48.1, sg: 11.6,   dl: 47.4, dg: 8.5,    sn: 'Munich',      dn: 'Zurich',          type: 'tank',    carrier: 'XPO',          count: 3 },
  { sl: 45.5, sg: 9.2,    dl: 44.8, dg: 20.5,   sn: 'Milan',       dn: 'Belgrade',        type: 'regular', carrier: 'DHL Freight',  count: 3 },
  { sl: 41.9, sg: 12.5,   dl: 40.8, dg: 14.2,   sn: 'Rome',        dn: 'Naples',          type: 'regular', carrier: 'DB Schenker',  count: 3 },
  { sl: 53.6, sg: 10.0,   dl: 55.7, dg: 12.6,   sn: 'Hamburg',     dn: 'Copenhagen',      type: 'regular', carrier: 'DHL Freight',  count: 3 },
  { sl: 51.9, sg: 4.5,    dl: 52.4, dg: 4.9,    sn: 'Rotterdam',   dn: 'Amsterdam',       type: 'tank',    carrier: 'XPO',          count: 4 },
  { sl: 50.8, sg: 4.4,    dl: 50.1, dg: 8.7,    sn: 'Brussels',    dn: 'Frankfurt',       type: 'regular', carrier: 'DB Schenker',  count: 4 },
  { sl: 41.4, sg: 2.2,    dl: 45.7, dg: 4.8,    sn: 'Barcelona',   dn: 'Lyon',            type: 'regular', carrier: 'XPO',          count: 3 },
  { sl: 47.5, sg: 19.1,   dl: 44.8, dg: 20.5,   sn: 'Budapest',    dn: 'Belgrade',        type: 'regular', carrier: 'DHL Freight',  count: 3 },
  // ── Turkey / Middle East ──
  { sl: 41.0, sg: 28.9,   dl: 39.9, dg: 32.9,   sn: 'Istanbul',    dn: 'Ankara',          type: 'regular', carrier: 'DB Schenker'  },
  { sl: 39.9, sg: 32.9,   dl: 35.7, dg: 51.4,   sn: 'Ankara',      dn: 'Tehran',          type: 'tank',    carrier: 'DHL Freight'  },
  { sl: 35.7, sg: 51.4,   dl: 25.2, dg: 55.3,   sn: 'Tehran',      dn: 'Dubai',           type: 'tank',    carrier: 'DB Schenker'  },
  { sl: 25.2, sg: 55.3,   dl: 24.7, dg: 46.7,   sn: 'Dubai',       dn: 'Riyadh',          type: 'tank',    carrier: 'XPO'          },
  { sl: 25.2, sg: 55.3,   dl: 23.6, dg: 58.6,   sn: 'Dubai',       dn: 'Muscat',          type: 'regular', carrier: 'DHL Freight'  },
  { sl: 30.1, sg: 31.2,   dl: 31.2, dg: 29.9,   sn: 'Cairo',       dn: 'Alexandria',      type: 'regular', carrier: 'DB Schenker'  },
  { sl: 31.9, sg: 35.9,   dl: 24.7, dg: 46.7,   sn: 'Amman',       dn: 'Riyadh',          type: 'tank',    carrier: 'DHL Freight',  count: 3 },
  // ── China ──
  { sl: 31.2, sg: 121.5,  dl: 39.9, dg: 116.4,  sn: 'Shanghai',    dn: 'Beijing',         type: 'regular', carrier: 'DHL Freight'  },
  { sl: 39.9, sg: 116.4,  dl: 23.1, dg: 113.3,  sn: 'Beijing',     dn: 'Guangzhou',       type: 'regular', carrier: 'DB Schenker'  },
  { sl: 30.6, sg: 104.1,  dl: 29.6, dg: 106.5,  sn: 'Chengdu',     dn: 'Chongqing',       type: 'regular', carrier: 'DHL Freight'  },
  { sl: 39.9, sg: 116.4,  dl: 34.3, dg: 108.9,  sn: 'Beijing',     dn: "Xi'an",           type: 'regular', carrier: 'DB Schenker'  },
  { sl: 34.3, sg: 108.9,  dl: 30.6, dg: 104.1,  sn: "Xi'an",       dn: 'Chengdu',         type: 'regular', carrier: 'DHL Freight'  },
  { sl: 34.3, sg: 108.9,  dl: 39.5, dg: 76.0,   sn: "Xi'an",       dn: 'Kashgar',         type: 'regular', carrier: 'DB Schenker'  },
  { sl: 39.5, sg: 76.0,   dl: 43.3, dg: 76.9,   sn: 'Kashgar',     dn: 'Almaty',          type: 'regular', carrier: 'DHL Freight'  },
  { sl: 43.3, sg: 76.9,   dl: 55.8, dg: 37.6,   sn: 'Almaty',      dn: 'Moscow',          type: 'regular', carrier: 'DB Schenker'  },
  { sl: 23.1, sg: 113.3,  dl: 22.5, dg: 114.1,  sn: 'Guangzhou',   dn: 'Shenzhen',        type: 'regular', carrier: 'DHL Freight',  count: 3 },
  { sl: 31.2, sg: 121.5,  dl: 30.3, dg: 120.2,  sn: 'Shanghai',    dn: 'Hangzhou',        type: 'regular', carrier: 'DB Schenker',  count: 3 },
  // ── Russia ──
  { sl: 55.8, sg: 37.6,   dl: 52.2, dg: 21.0,   sn: 'Moscow',      dn: 'Warsaw',          type: 'regular', carrier: 'DHL Freight'  },
  { sl: 55.8, sg: 37.6,   dl: 59.9, dg: 30.3,   sn: 'Moscow',      dn: 'St. Petersburg',  type: 'regular', carrier: 'DB Schenker'  },
  { sl: 55.8, sg: 37.6,   dl: 56.9, dg: 60.6,   sn: 'Moscow',      dn: 'Yekaterinburg',   type: 'tank',    carrier: 'DHL Freight',  count: 3 },
  // ── India ──
  { sl: 28.6, sg: 77.2,   dl: 19.1, dg: 72.9,   sn: 'Delhi',       dn: 'Mumbai',          type: 'regular', carrier: 'DHL Freight'  },
  { sl: 28.6, sg: 77.2,   dl: 22.6, dg: 88.4,   sn: 'Delhi',       dn: 'Kolkata',         type: 'regular', carrier: 'DB Schenker'  },
  { sl: 19.1, sg: 72.9,   dl: 12.9, dg: 77.6,   sn: 'Mumbai',      dn: 'Bangalore',       type: 'regular', carrier: 'DHL Freight'  },
  { sl: 12.9, sg: 77.6,   dl: 13.1, dg: 80.3,   sn: 'Bangalore',   dn: 'Chennai',         type: 'regular', carrier: 'XPO'          },
  { sl: 22.6, sg: 88.4,   dl: 26.2, dg: 92.9,   sn: 'Kolkata',     dn: 'Guwahati',        type: 'regular', carrier: 'DHL Freight',  count: 3 },
  { sl: 17.4, sg: 78.5,   dl: 19.1, dg: 72.9,   sn: 'Hyderabad',   dn: 'Mumbai',          type: 'tank',    carrier: 'DB Schenker',  count: 3 },
  // ── SE Asia ──
  { sl: 13.8, sg: 100.5,  dl: 3.1,  dg: 101.7,  sn: 'Bangkok',     dn: 'Kuala Lumpur',    type: 'regular', carrier: 'DHL Freight'  },
  { sl: 3.1,  sg: 101.7,  dl: 1.4,  dg: 103.8,  sn: 'Kuala Lumpur',dn: 'Singapore',       type: 'regular', carrier: 'DB Schenker'  },
  { sl: 10.8, sg: 106.7,  dl: 11.6, dg: 104.9,  sn: 'Ho Chi Minh', dn: 'Phnom Penh',      type: 'regular', carrier: 'DHL Freight'  },
  { sl: 21.0, sg: 105.8,  dl: 10.8, dg: 106.7,  sn: 'Hanoi',       dn: 'Ho Chi Minh',     type: 'regular', carrier: 'DB Schenker',  count: 3 },
  { sl: 13.8, sg: 100.5,  dl: 16.9, dg: 100.0,  sn: 'Bangkok',     dn: 'Chiang Mai',      type: 'regular', carrier: 'DHL Freight',  count: 3 },
  { sl: -6.2, sg: 106.8,  dl: -7.3, dg: 112.7,  sn: 'Jakarta',     dn: 'Surabaya',        type: 'regular', carrier: 'DB Schenker',  count: 3 },
  // ── East Asia ──
  { sl: 37.6, sg: 127.0,  dl: 35.2, dg: 129.1,  sn: 'Seoul',       dn: 'Busan',           type: 'regular', carrier: 'DHL Freight',  count: 3 },
  { sl: 35.7, sg: 139.7,  dl: 34.7, dg: 135.5,  sn: 'Tokyo',       dn: 'Osaka',           type: 'regular', carrier: 'DB Schenker',  count: 3 },
  { sl: 24.5, sg: 118.1,  dl: 23.1, dg: 113.3,  sn: 'Xiamen',      dn: 'Guangzhou',       type: 'regular', carrier: 'DHL Freight',  count: 3 },
  // ── Pakistan / Central Asia ──
  { sl: 24.9, sg: 67.0,   dl: 31.5, dg: 74.3,   sn: 'Karachi',     dn: 'Lahore',          type: 'tank',    carrier: 'DB Schenker',  count: 3 },
  // ── Australia ──
  { sl: -33.9,sg: 151.2,  dl: -37.8,dg: 144.9,  sn: 'Sydney',      dn: 'Melbourne',       type: 'regular', carrier: 'DB Schenker'  },
  { sl: -37.8,sg: 144.9,  dl: -34.9,dg: 138.6,  sn: 'Melbourne',   dn: 'Adelaide',        type: 'regular', carrier: 'DHL Freight'  },
  { sl: -33.9,sg: 151.2,  dl: -27.5,dg: 153.0,  sn: 'Sydney',      dn: 'Brisbane',        type: 'regular', carrier: 'DB Schenker',  count: 3 },
  { sl: -31.9,sg: 115.9,  dl: -33.9,dg: 151.2,  sn: 'Perth',       dn: 'Sydney',          type: 'tank',    carrier: 'DHL Freight',  count: 3 },
  // ── Africa ──
  { sl: -26.2,sg: 28.0,   dl: -29.9,dg: 31.0,   sn: 'Johannesburg',dn: 'Durban',          type: 'tank',    carrier: 'DB Schenker'  },
  { sl: 6.5,  sg: 3.4,    dl: 9.1,  dg: 7.2,    sn: 'Lagos',       dn: 'Abuja',           type: 'regular', carrier: 'DHL Freight'  },
  { sl: -1.3, sg: 36.8,   dl: -4.1, dg: 39.7,   sn: 'Nairobi',     dn: 'Mombasa',         type: 'regular', carrier: 'DB Schenker'  },
  { sl: -33.9,sg: 18.4,   dl: -26.2,dg: 28.0,   sn: 'Cape Town',   dn: 'Johannesburg',    type: 'regular', carrier: 'DHL Freight',  count: 3 },
  { sl: 33.6, sg: -7.6,   dl: 36.8, dg: 10.2,   sn: 'Casablanca',  dn: 'Tunis',           type: 'regular', carrier: 'DB Schenker',  count: 3 },
  { sl: 6.5,  sg: 3.4,    dl: 5.6,  dg: -0.2,   sn: 'Lagos',       dn: 'Accra',           type: 'regular', carrier: 'DHL Freight',  count: 3 },
  { sl: -1.3, sg: 36.8,   dl: 0.3,  dg: 32.6,   sn: 'Nairobi',     dn: 'Kampala',         type: 'regular', carrier: 'DB Schenker',  count: 3 },
  { sl: 15.6, sg: 32.5,   dl: 30.1, dg: 31.2,   sn: 'Khartoum',    dn: 'Cairo',           type: 'tank',    carrier: 'DHL Freight',  count: 3 },
];

function buildSimulatedTrucks() {
  function gcTruckPoint(lat1d, lng1d, lat2d, lng2d, t) {
    const R = Math.PI / 180;
    const lat1 = lat1d * R, lng1 = lng1d * R, lat2 = lat2d * R, lng2 = lng2d * R;
    const cosDelta = Math.sin(lat1)*Math.sin(lat2) + Math.cos(lat1)*Math.cos(lat2)*Math.cos(lng2-lng1);
    const delta = Math.acos(Math.max(-1, Math.min(1, cosDelta)));
    if (delta < 1e-8) return { lat: lat1d, lng: lng1d, heading: 0 };
    const sinD = Math.sin(delta);
    const A = Math.sin((1-t)*delta)/sinD, B = Math.sin(t*delta)/sinD;
    const x = A*Math.cos(lat1)*Math.cos(lng1) + B*Math.cos(lat2)*Math.cos(lng2);
    const y = A*Math.cos(lat1)*Math.sin(lng1) + B*Math.cos(lat2)*Math.sin(lng2);
    const z = A*Math.sin(lat1)                + B*Math.sin(lat2);
    const lat = Math.atan2(z, Math.sqrt(x*x+y*y));
    const lng = Math.atan2(y, x);
    const t2 = Math.min(t + 0.001, 1);
    const A2=Math.sin((1-t2)*delta)/sinD, B2=Math.sin(t2*delta)/sinD;
    const x2=A2*Math.cos(lat1)*Math.cos(lng1)+B2*Math.cos(lat2)*Math.cos(lng2);
    const y2=A2*Math.cos(lat1)*Math.sin(lng1)+B2*Math.cos(lat2)*Math.sin(lng2);
    const z2=A2*Math.sin(lat1)+B2*Math.sin(lat2);
    const lat2r=Math.atan2(z2,Math.sqrt(x2*x2+y2*y2)), lng2r=Math.atan2(y2,x2);
    const heading = (Math.atan2(lng2r-lng, lat2r-lat) * 180 / Math.PI + 360) % 360;
    return { lat: lat/R, lng: lng/R, heading };
  }

  const trucks = [];
  let id = 0;
  TRUCK_LANES.forEach((lane, laneIdx) => {
    for (let i = 0; i < (lane.count ?? 4); i++) {
      const seed = laneIdx * 1000 + i;
      const phase = (seed * 2654435761) % 86400;
      const progress = ((Date.now() / 1000 + phase) % 86400) / 86400;
      const pos = gcTruckPoint(lane.sl, lane.sg, lane.dl, lane.dg, progress);
      const velocity = lane.type === 'tank' ? 50 + (seed % 15) : 60 + (seed % 15);
      id++;
      trucks.push({
        id: `TRK${String(id).padStart(4, '0')}`,
        callsign: `${lane.carrier.split(' ')[0].toUpperCase().slice(0, 4)}-${String(seed % 9999).padStart(4, '0')}`,
        carrier: lane.carrier,
        type: lane.type,
        srcLat: lane.sl, srcLng: lane.sg,
        dstLat: lane.dl, dstLng: lane.dg,
        origin: lane.sn, destination: lane.dn,
        progress,
        lat: pos.lat, lng: pos.lng, heading: pos.heading,
        velocity,
      });
    }
  });
  return trucks;
}

app.get('/api/trucks', (req, res) => {
  res.json({ trucks: buildSimulatedTrucks(), source: 'simulated' });
});

const PORT = process.env.PORT || 5000;
if (require.main === module) {
  initDb()
    .then(() => app.listen(PORT, () => console.log(`Flexport SDR server on port ${PORT}`)))
    .catch(e => { console.error('DB init failed:', e.message); process.exit(1); });
}

module.exports = app;
