// backend/services/usitcService.js
// USITC Harmonized Tariff Schedule REST API — free, no auth required
// Docs: https://hts.usitc.gov/reststop/api-docs
const axios = require('axios');

const USITC_BASE = 'https://hts.usitc.gov/reststop';

/**
 * Parse a duty rate string like "Free", "3.5%", "12.5¢/kg + 5%" → decimal fraction for the ad valorem portion
 */
function parseRate(rateStr) {
  if (!rateStr || rateStr.trim().toLowerCase() === 'free') return 0;
  const pct = rateStr.match(/(\d+(?:\.\d+)?)\s*%/);
  if (pct) return parseFloat(pct[1]) / 100;
  return null; // specific duty (¢/unit) — not expressible as a simple decimal
}

/**
 * Look up an HTS code (4-10 digit) against the USITC HTS API.
 * Returns an array of matching entries, each with: htsno, description, general, special, other
 * Falls back to empty array on network error.
 */
async function lookupHSCode(code) {
  try {
    const res = await axios.get(`${USITC_BASE}/search`, {
      params: { keyword: code.replace(/\./g, '') },
      timeout: 6000,
    });
    const items = Array.isArray(res.data) ? res.data : (res.data?.results || []);
    return items
      .filter(item => item.htsno && item.description)
      .map(item => ({
        htsno:       item.htsno,
        description: item.description,
        general:     item.general || 'See notes',
        special:     item.special || '',
        other:       item.other   || '',
        generalRate: parseRate(item.general),
      }))
      .slice(0, 8);
  } catch {
    return [];
  }
}

module.exports = { lookupHSCode };
