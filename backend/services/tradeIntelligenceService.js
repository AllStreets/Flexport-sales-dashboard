// backend/services/tradeIntelligenceService.js
const { getTradeData } = require('./fredService');

async function getTradeIntelligence() {
  const [tb, ti, cg, cons, fi, ds] = await Promise.allSettled([
    getTradeData('trade_balance'),
    getTradeData('total_imports'),
    getTradeData('capital_goods'),
    getTradeData('consumer_goods'),
    getTradeData('freight_index'),
    getTradeData('diesel_price'),
  ]);

  // Process $B series (trade/import data)
  // divisor: raw FRED unit → $B conversion (1000 for Millions series, 4 for SAAR quarterly)
  // prevYearIdx: observation index for prior-year comparison (12 = monthly, 4 = quarterly)
  // period: label for period-over-period change ('MoM' or 'QoQ')
  const process = (result, label, unit, { divisor = 1, prevYearIdx = 12, period = 'MoM' } = {}) => {
    if (result.status === 'rejected') return { label, unit, period, current: 0, momDelta: 0, momPct: '0.0', yoyDelta: 0, yoyPct: '0.0', sparkline: [] };
    const obs = (result.value.observations || []).filter(o => o.value !== '.').slice(0, 24);
    const val = i => (parseFloat(obs[i]?.value) || 0) / divisor;
    const current = val(0);
    const prev = val(1);
    const prevYear = val(prevYearIdx);
    return {
      label, unit, period, current,
      momDelta: +(current - prev).toFixed(2),
      momPct: prev ? ((current - prev) / Math.abs(prev) * 100).toFixed(1) : '0.0',
      yoyDelta: +(current - prevYear).toFixed(2),
      yoyPct: prevYear ? ((current - prevYear) / Math.abs(prevYear) * 100).toFixed(1) : '0.0',
      sparkline: obs.slice(0, 12).reverse().map(o => ({ v: (parseFloat(o.value) || 0) / divisor, d: o.date }))
    };
  };

  // Process $/unit series (daily or weekly price data)
  // prevIdx: obs index for ~1 month ago (21 trading days for daily, 4 for weekly)
  // yearIdx: obs index for ~1 year ago (252 trading days for daily, 52 for weekly)
  // sparkCount: how many obs to include in sparkline
  const processRaw = (result, label, unit, { prevIdx = 21, yearIdx = 252, sparkCount = 60 } = {}) => {
    if (result.status === 'rejected') return { label, unit, current: 0, momDelta: 0, momPct: '0.0', yoyDelta: 0, yoyPct: '0.0', sparkline: [] };
    const obs = (result.value.observations || []).filter(o => o.value !== '.').slice(0, 400);
    const val = i => parseFloat(obs[i]?.value) || 0;
    const current = val(0);
    const prev = val(prevIdx);
    const prevYear = val(yearIdx);
    return {
      label, unit, current: +current.toFixed(3),
      momDelta: +(current - prev).toFixed(3),
      momPct: prev ? ((current - prev) / Math.abs(prev) * 100).toFixed(1) : '0.0',
      yoyDelta: +(current - prevYear).toFixed(3),
      yoyPct: prevYear ? ((current - prevYear) / Math.abs(prevYear) * 100).toFixed(1) : '0.0',
      sparkline: obs.slice(0, sparkCount).reverse().map(o => ({ v: parseFloat(o.value) || 0, d: o.date }))
    };
  };

  return {
    // BOPGSTB, AITGICS, AITGIGS → Millions of Dollars → ÷1000 for $B
    trade_balance:  process(tb,   'Trade Balance',    '$B', { divisor: 1000 }),
    capital_goods:  process(cg,   'Capital Goods',    '$B', { divisor: 1000 }),
    consumer_goods: process(cons, 'Consumer Goods',   '$B', { divisor: 1000 }),
    // IMPGS → Billions SAAR Quarterly → ÷4 for single-quarter value, prevYearIdx=4 (4 quarters back)
    total_imports:  process(ti,   'Total Imports',    '$B', { divisor: 4, prevYearIdx: 4, period: 'QoQ' }),
    freight_index:  processRaw(fi, 'Brent Crude',      '$/bbl'),
    // GASDESW = weekly retail diesel — prevIdx:4 (~4 weeks), yearIdx:52 (52 weeks = 1yr)
    diesel_price:   processRaw(ds, 'US Diesel Retail', '$/gal', { prevIdx: 4, yearIdx: 52, sparkCount: 52 }),
    timestamp: new Date().toISOString()
  };
}

module.exports = { getTradeIntelligence };
