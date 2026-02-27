// backend/services/fredService.js
const axios = require('axios');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');

function getDb() {
  return new sqlite3.Database(process.env.DB_PATH || path.join(__dirname, '..', 'flexport.db'));
}

const FRED_SERIES = {
  electronics: 'AITGICS',     // Advance Imports: Capital Goods (monthly, $B)
  apparel: 'AITGIGS',         // Advance Imports: Consumer Goods (monthly, $B)
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
