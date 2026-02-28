// backend/services/fredService.js
const axios = require('axios');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');

function getDb() {
  return new sqlite3.Database(process.env.DB_PATH || path.join(__dirname, '..', 'flexport.db'));
}

const FRED_SERIES = {
  trade_balance:  'BOPGSTB',  // Trade Balance: Goods & Services (monthly, $B)
  total_imports:  'IMPGS',    // Imports of Goods and Services (quarterly, $B annualized)
  capital_goods:  'AITGICS',  // Advance Imports: Capital Goods (monthly, $B)
  consumer_goods: 'AITGIGS',  // Advance Imports: Consumer Goods (monthly, $B)
  freight_index:  'DCOILBRENTEU', // Brent Crude Oil ($/bbl) — freight cost leading indicator
};

async function getTradeData(commodity) {
  const seriesId = FRED_SERIES[commodity] || FRED_SERIES.total_imports;

  // Check cache (7 day TTL)
  const cached = await getCached(seriesId);
  if (cached) return cached;

  // Daily series (like Brent Crude) need more observations for year-ago comparison
  const isDailyLike = ['DCOILBRENTEU'].includes(seriesId);
  const limit = isDailyLike ? 400 : 24;

  const res = await axios.get('https://api.stlouisfed.org/fred/series/observations', {
    params: { series_id: seriesId, api_key: process.env.FRED_API_KEY, file_type: 'json', limit, sort_order: 'desc' }
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

function clearCache(seriesId) {
  return new Promise((resolve) => {
    const db = getDb();
    db.run(`DELETE FROM trade_data_cache WHERE series_id = ?`, [seriesId], () => { db.close(); resolve(); });
  });
}

async function refreshAllTradeCache() {
  const series = Object.values(FRED_SERIES);
  for (const id of series) {
    await clearCache(id);
  }
  // Re-fetch all series sequentially to avoid hammering FRED
  for (const key of Object.keys(FRED_SERIES)) {
    try {
      await getTradeData(key);
      console.log(`[FRED] Refreshed ${FRED_SERIES[key]}`);
    } catch (e) {
      console.error(`[FRED] Failed to refresh ${FRED_SERIES[key]}:`, e.message);
    }
  }
  console.log(`[FRED] Cache refresh complete at ${new Date().toISOString()}`);
}

module.exports = { getTradeData, FRED_SERIES, refreshAllTradeCache };
