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

function connectAisStream() {
  const key = process.env.AISSTREAM_API_KEY;
  if (!key) return;
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
      const cutoff = Date.now() - 30 * 60 * 1000;
      Object.keys(_vesselCache).forEach(k => {
        if (_vesselCache[k].ts && _vesselCache[k].ts < cutoff) delete _vesselCache[k];
      });
    } catch {}
  });

  _aisWs.on('close', () => {
    console.log('aisstream disconnected — reconnecting in 10s');
    setTimeout(connectAisStream, 10000);
  });

  _aisWs.on('error', (e) => { console.error('aisstream error:', e.message); });
}

connectAisStream();

app.get('/api/vessels', (req, res) => {
  const vessels = Object.values(_vesselCache).filter(v => v.lat && v.lng);
  if (vessels.length > 0) {
    return res.json({ source: 'live', vessels: vessels.slice(0, 100) });
  }
  // Simulated fallback — 60 vessels along key shipping lanes
  const LANES = [
    { srcLat: 31.2, srcLng: 121.5, dstLat: 33.7, dstLng: -118.2 },
    { srcLat: 10.8, srcLng: 106.7, dstLat: 33.7, dstLng: -118.2 },
    { srcLat: 1.35, srcLng: 103.8, dstLat: 33.7, dstLng: -118.2 },
    { srcLat: 31.2, srcLng: 121.5, dstLat: 40.7, dstLng: -74.0  },
    { srcLat: 19.0, srcLng: 72.8,  dstLat: 51.9, dstLng: 4.5    },
    { srcLat: 31.2, srcLng: 121.5, dstLat: 51.9, dstLng: 4.5    },
    { srcLat: -23.5, srcLng: -46.6, dstLat: 51.9, dstLng: 4.5   },
    { srcLat: 3.1, srcLng: 101.7,  dstLat: 40.7, dstLng: -74.0  },
  ];
  const types = ['Container', 'Container', 'Container', 'Tanker', 'Bulk Carrier'];
  const simVessels = [];
  for (let i = 0; i < 40; i++) {
    const lane = LANES[i % LANES.length];
    const t = ((i * 0.17 + Date.now() * 0.000001) % 1);
    simVessels.push({
      mmsi: 900000000 + i, name: `SIM VESSEL ${i + 1}`,
      lat: lane.srcLat + (lane.dstLat - lane.srcLat) * t,
      lng: lane.srcLng + (lane.dstLng - lane.srcLng) * t,
      sog: 14 + (i % 6),
      cog: Math.atan2(lane.dstLat - lane.srcLat, lane.dstLng - lane.srcLng) * 180 / Math.PI,
      type: types[i % types.length], destination: 'SIMULATED', ts: Date.now(), simulated: true,
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
