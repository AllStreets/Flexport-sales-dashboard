// backend/services/portCongestionService.js
// Signals-driven dynamic port congestion scoring.
// Queries news_signals for recent port-related headlines and scores each port 1–10.
// If MARINETRAFFIC_API_KEY is set, uses MarineTraffic as an additional data source.
const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const axios = require('axios');

function getDb() {
  return new sqlite3.Database(process.env.DB_PATH || path.join(__dirname, '..', 'flexport.db'));
}

// Static port registry — coordinates + baseline congestion (used when no signal data exists)
const PORT_REGISTRY = [
  { name: 'LA/Long Beach', lat: 33.74,  lng: -118.26, baseline: 5, keywords: ['los angeles', 'long beach', 'la/lb', 'lalb', 'san pedro'] },
  { name: 'Shanghai',      lat: 31.22,  lng: 121.47,  baseline: 3, keywords: ['shanghai', 'yangshan'] },
  { name: 'Rotterdam',     lat: 51.95,  lng: 4.13,    baseline: 2, keywords: ['rotterdam', 'maasvlakte'] },
  { name: 'Singapore',     lat: 1.26,   lng: 103.82,  baseline: 2, keywords: ['singapore', 'psa'] },
  { name: 'Hong Kong',     lat: 22.29,  lng: 114.17,  baseline: 3, keywords: ['hong kong', 'kwai tsing'] },
  { name: 'Felixstowe',    lat: 51.96,  lng: 1.35,    baseline: 5, keywords: ['felixstowe', 'harwich'] },
  { name: 'Hamburg',       lat: 53.54,  lng: 9.97,    baseline: 2, keywords: ['hamburg', 'burchardkai'] },
  { name: 'Savannah',      lat: 32.08,  lng: -81.09,  baseline: 3, keywords: ['savannah', 'georgia ports'] },
  { name: 'Busan',         lat: 35.10,  lng: 129.04,  baseline: 2, keywords: ['busan', 'pusan'] },
  { name: 'Yantian',       lat: 22.57,  lng: 114.27,  baseline: 3, keywords: ['yantian', 'shenzhen port', 'shekou'] },
];

/**
 * Fetch recent news_signals from SQLite and build a port-name → max urgency map.
 */
function getSignalScores() {
  return new Promise((resolve) => {
    const db = getDb();
    // Look at signals from the last 14 days
    db.all(
      `SELECT title, headline, urgency_score FROM news_signals
       WHERE created_at >= datetime('now', '-14 days')
       ORDER BY urgency_score DESC LIMIT 200`,
      [],
      (err, rows) => {
        db.close();
        if (err || !rows) return resolve({});
        const scoreMap = {};
        rows.forEach(row => {
          const text = ((row.title || '') + ' ' + (row.headline || '')).toLowerCase();
          PORT_REGISTRY.forEach(port => {
            const hit = port.keywords.some(kw => text.includes(kw));
            if (hit) {
              const urgency = row.urgency_score || 0;
              if (!scoreMap[port.name] || urgency > scoreMap[port.name]) {
                scoreMap[port.name] = urgency;
              }
            }
          });
        });
        resolve(scoreMap);
      }
    );
  });
}

/**
 * Optional: Fetch port congestion from MarineTraffic if API key is present.
 * MarineTraffic /expectedarrivals endpoint returns vessel counts per port.
 * We map vessel count to a 1–10 congestion score.
 */
async function getMarineTrafficScores() {
  const apiKey = process.env.MARINETRAFFIC_API_KEY;
  if (!apiKey) return {};
  try {
    // MarineTraffic PS07 — Port Calls — returns expected arrivals per port
    // We use a simple heuristic: portcalls > 40 → high congestion
    const scoreMap = {};
    for (const port of PORT_REGISTRY) {
      const r = await axios.get('https://services.marinetraffic.com/api/expectedarrivals/v:2', {
        params: { APIKEY: apiKey, portname: port.name, timespan: 24 },
        timeout: 4000,
      });
      const count = Array.isArray(r.data) ? r.data.length : 0;
      // Map count to 1–10 scale: 0→1, 20→5, 40+→10
      scoreMap[port.name] = Math.min(10, Math.max(1, Math.round(count / 4)));
    }
    return scoreMap;
  } catch {
    return {};
  }
}

/**
 * Merge signal + MarineTraffic scores with baseline, return enriched port list.
 */
async function getPortCongestion() {
  const [signalScores, mtScores] = await Promise.all([
    getSignalScores(),
    getMarineTrafficScores(),
  ]);

  return PORT_REGISTRY.map(port => {
    const signal = signalScores[port.name] || 0;
    const mt     = mtScores[port.name]     || 0;

    // Blend: MarineTraffic > signals > baseline
    let congestion;
    if (mt > 0) {
      congestion = Math.round((mt + signal * 0.3 + port.baseline * 0.2) / 1.5);
    } else if (signal > 0) {
      // Scale urgency (0–10) to congestion (1–8): high urgency bumps baseline
      const bump = Math.round(signal * 0.4);
      congestion = Math.min(10, port.baseline + bump);
    } else {
      congestion = port.baseline;
    }

    congestion = Math.max(1, Math.min(10, congestion));
    const status = congestion >= 6 ? 'congestion' : congestion >= 4 ? 'moderate' : 'clear';

    return {
      name:       port.name,
      lat:        port.lat,
      lng:        port.lng,
      congestion,
      status,
      signalHit:  signal > 0,
    };
  });
}

module.exports = { getPortCongestion };
