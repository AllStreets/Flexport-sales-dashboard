// backend/services/portCongestionService.js
// Signals-driven dynamic port congestion scoring.
// Queries news_signals for recent port-related headlines and scores each port 1–10.
// If MARINETRAFFIC_API_KEY is set, uses MarineTraffic as an additional data source.
const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const axios = require('axios');

function getDb() {
  const db = new sqlite3.Database(process.env.DB_PATH || path.join(__dirname, '..', 'flexport.db'));
  db.run('PRAGMA busy_timeout = 5000');
  db.run('PRAGMA journal_mode = WAL');
  return db;
}

// Static port registry — coordinates + baseline congestion (used when no signal data exists)
const PORT_REGISTRY = [
  // ── US Ports ────────────────────────────────────────────────────────────────
  // LA/LB: chronic pre-stocking surges; NY/NJ: volume pressure from Red Sea reroutes
  // Baltimore: recovering from Francis Scott Key Bridge collapse (March 2024)
  { name: 'LA/Long Beach',        lat: 33.74,  lng: -118.26, baseline: 6, keywords: ['los angeles', 'long beach', 'la/lb', 'lalb', 'san pedro'] },
  { name: 'New York/New Jersey',  lat: 40.68,  lng: -74.05,  baseline: 5, keywords: ['new york', 'new jersey', 'port newark', 'elizabeth', 'bayonne'] },
  { name: 'Savannah',             lat: 32.08,  lng: -81.09,  baseline: 3, keywords: ['savannah', 'georgia ports', 'garden city'] },
  { name: 'Seattle/Tacoma',       lat: 47.27,  lng: -122.42, baseline: 2, keywords: ['seattle', 'tacoma', 'nwsa', 'northwest seaport'] },
  { name: 'Houston',              lat: 29.73,  lng: -95.02,  baseline: 4, keywords: ['houston', 'port of houston', 'bayport', 'barbours cut'] },
  { name: 'Charleston',           lat: 32.78,  lng: -79.93,  baseline: 2, keywords: ['charleston', 'south carolina ports', 'wando welch'] },
  { name: 'Norfolk/Hampton Roads', lat: 36.97, lng: -76.33,  baseline: 2, keywords: ['norfolk', 'hampton roads', 'virginia port', 'portsmouth'] },
  { name: 'Oakland',              lat: 37.80,  lng: -122.28, baseline: 4, keywords: ['oakland', 'port of oakland', 'alameda'] },
  { name: 'Baltimore',            lat: 39.27,  lng: -76.58,  baseline: 5, keywords: ['baltimore', 'maryland port', 'seagirt', 'dundalk'] },
  { name: 'Miami',                lat: 25.77,  lng: -80.18,  baseline: 3, keywords: ['miami', 'portmiami', 'port everglades', 'south florida'] },

  // ── Asia-Pacific ───────────────────────────────────────────────────────────
  // Shanghai/Ningbo: consistent volume pressure; Ho Chi Minh: dwell time elevation
  // Felixstowe: chronic labour and infrastructure constraints
  { name: 'Shanghai',             lat: 31.22,  lng: 121.47,  baseline: 4, keywords: ['shanghai', 'yangshan'] },
  { name: 'Ningbo-Zhoushan',      lat: 29.87,  lng: 121.55,  baseline: 4, keywords: ['ningbo', 'zhoushan', 'ningbo-zhoushan'] },
  { name: 'Yantian/Shenzhen',     lat: 22.57,  lng: 114.27,  baseline: 4, keywords: ['yantian', 'shenzhen port', 'shekou', 'chiwan'] },
  { name: 'Guangzhou/Nansha',     lat: 22.74,  lng: 113.62,  baseline: 3, keywords: ['guangzhou', 'nansha', 'guangzhou port', 'nansha port'] },
  { name: 'Tianjin',              lat: 39.00,  lng: 117.73,  baseline: 3, keywords: ['tianjin', 'xingang', 'tianjin port'] },
  { name: 'Busan',                lat: 35.10,  lng: 129.04,  baseline: 2, keywords: ['busan', 'pusan'] },
  // Singapore/Port Klang/Pelepas: massive volume surge as Cape-rerouted vessels concentrate here
  { name: 'Singapore',            lat: 1.26,   lng: 103.82,  baseline: 6, keywords: ['singapore', 'psa', 'jurong'] },
  { name: 'Port Klang',           lat: 3.00,   lng: 101.40,  baseline: 5, keywords: ['port klang', 'klang', 'westports', 'northport'] },
  { name: 'Tanjung Pelepas',      lat: 1.37,   lng: 103.55,  baseline: 5, keywords: ['tanjung pelepas', 'ptp', 'johor'] },
  { name: 'Ho Chi Minh City',     lat: 10.77,  lng: 106.72,  baseline: 5, keywords: ['ho chi minh', 'saigon', 'cat lai', 'hcmc'] },
  { name: 'Hong Kong',            lat: 22.29,  lng: 114.17,  baseline: 3, keywords: ['hong kong', 'kwai tsing', 'stonecutters'] },

  // ── Middle East / Europe ───────────────────────────────────────────────────
  // Jebel Ali: Strait of Hormuz effectively closed — Iran IRGC vessel seizures and US-Iran tensions
  //   have made transiting the strait extremely high-risk. Most carriers diverting via Cape of Good Hope.
  //   Commercial traffic through the Strait has dropped sharply. Disruption-level classification.
  // Aden: active Houthi conflict zone — effectively closed to commercial shipping since late 2023
  // Salalah: key alternative waystation on Cape reroute, surge in vessel calls
  // Colombo: critical Cape-reroute transshipment hub, volume surged since Red Sea closure
  // Hamburg: labour disputes + low-water Elbe constraints; Felixstowe: chronic UK port congestion
  { name: 'Jebel Ali',            lat: 25.01,  lng: 55.06,   baseline: 9, keywords: ['jebel ali', 'dubai port', 'dp world', 'jafza', 'hormuz', 'strait of hormuz', 'iran'] },
  { name: 'Aden',                 lat: 12.77,  lng: 45.03,   baseline: 9, keywords: ['aden', 'yemen', 'bab el-mandeb', 'bab-el-mandeb', 'houthi', 'red sea attack'] },
  { name: 'Salalah',              lat: 16.94,  lng: 54.00,   baseline: 5, keywords: ['salalah', 'oman port', 'pdsa'] },
  { name: 'Colombo',              lat: 6.94,   lng: 79.84,   baseline: 5, keywords: ['colombo', 'sri lanka port', 'jict', 'cict'] },
  { name: 'Rotterdam',            lat: 51.95,  lng: 4.13,    baseline: 3, keywords: ['rotterdam', 'maasvlakte', 'europoort'] },
  { name: 'Antwerp',              lat: 51.26,  lng: 4.40,    baseline: 3, keywords: ['antwerp', 'port of antwerp', 'antwerp-bruges'] },
  { name: 'Hamburg',              lat: 53.54,  lng: 9.97,    baseline: 5, keywords: ['hamburg', 'burchardkai', 'tollerort'] },
  { name: 'Felixstowe',           lat: 51.96,  lng: 1.35,    baseline: 6, keywords: ['felixstowe', 'harwich'] },
  { name: 'Piraeus',              lat: 37.94,  lng: 23.63,   baseline: 4, keywords: ['piraeus', 'greece port', 'cosco piraeus', 'pct'] },

  // ── Africa ─────────────────────────────────────────────────────────────────
  // Durban: Transnet infrastructure failures + massive volume surge from Cape reroutes
  // Port Said: Suez Canal under Houthi threat — security disruption; commercial traffic
  //   has dropped ~50–70% through canal since 2023. Disruption-level classification.
  // Tangier Med: now busiest European transshipment hub for Cape-rerouted cargo
  { name: 'Durban',               lat: -29.87, lng: 31.03,   baseline: 8, keywords: ['durban', 'south africa port', 'transnet', 'pier 1'] },
  { name: 'Tangier Med',          lat: 35.88,  lng: -5.50,   baseline: 5, keywords: ['tangier', 'tanger med', 'morocco port'] },
  { name: 'Port Said',            lat: 31.26,  lng: 32.30,   baseline: 8, keywords: ['port said', 'suez canal', 'egypt port', 'sczone', 'houthi', 'red sea'] },

  // ── South America ──────────────────────────────────────────────────────────
  // Santos: chronic dwell times 7–12 days, Brazil customs complexity
  { name: 'Santos',               lat: -23.95, lng: -46.33,  baseline: 6, keywords: ['santos', 'brazil port', 'porto de santos'] },
  { name: 'Callao',               lat: -12.04, lng: -77.14,  baseline: 4, keywords: ['callao', 'peru port', 'lima port', 'dpp'] },
  { name: 'Buenos Aires',         lat: -34.59, lng: -58.37,  baseline: 4, keywords: ['buenos aires', 'argentina port', 'exolgan', 'tec plata'] },

  // ── Australia ──────────────────────────────────────────────────────────────
  { name: 'Melbourne',            lat: -37.83, lng: 144.93,  baseline: 3, keywords: ['melbourne', 'port of melbourne', 'victoria port'] },
  { name: 'Sydney/Port Botany',   lat: -33.97, lng: 151.22,  baseline: 2, keywords: ['sydney', 'port botany', 'new south wales port'] },
  { name: 'Brisbane',             lat: -27.38, lng: 153.17,  baseline: 2, keywords: ['brisbane', 'port of brisbane', 'queensland port'] },
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
    const status = congestion >= 8 ? 'disruption' : congestion >= 5 ? 'congestion' : 'clear';

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
