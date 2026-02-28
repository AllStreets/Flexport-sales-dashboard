// backend/services/tradeIntelligenceService.js
const { getTradeData } = require('./fredService');

async function getTradeIntelligence() {
  const [tb, ti, cg, cons, fi] = await Promise.allSettled([
    getTradeData('trade_balance'),
    getTradeData('total_imports'),
    getTradeData('capital_goods'),
    getTradeData('consumer_goods'),
    getTradeData('freight_index'),
  ]);

  // Process $B series (trade/import data)
  const process = (result, label, unit) => {
    if (result.status === 'rejected') return { label, unit, current: 0, momDelta: 0, momPct: '0.0', yoyDelta: 0, yoyPct: '0.0', sparkline: [] };
    const obs = (result.value.observations || []).filter(o => o.value !== '.').slice(0, 24);
    const val = i => parseFloat(obs[i]?.value) || 0;
    const current = val(0);
    const prev = val(1);
    const prevYear = val(12);
    return {
      label, unit, current,
      momDelta: +(current - prev).toFixed(2),
      momPct: prev ? ((current - prev) / Math.abs(prev) * 100).toFixed(1) : '0.0',
      yoyDelta: +(current - prevYear).toFixed(2),
      yoyPct: prevYear ? ((current - prevYear) / Math.abs(prevYear) * 100).toFixed(1) : '0.0',
      sparkline: obs.slice(0, 12).reverse().map(o => ({ v: parseFloat(o.value) || 0, d: o.date }))
    };
  };

  // Process $/unit series (oil/freight index — daily, last 90 obs covers ~3 months)
  const processRaw = (result, label, unit) => {
    if (result.status === 'rejected') return { label, unit, current: 0, momDelta: 0, momPct: '0.0', yoyDelta: 0, yoyPct: '0.0', sparkline: [] };
    const obs = (result.value.observations || []).filter(o => o.value !== '.').slice(0, 365);
    const val = i => parseFloat(obs[i]?.value) || 0;
    const current = val(0);
    const prev = val(21);    // ~1 month ago (trading days)
    const prevYear = val(252); // ~1 year ago (trading days)
    return {
      label, unit, current: +current.toFixed(2),
      momDelta: +(current - prev).toFixed(2),
      momPct: prev ? ((current - prev) / Math.abs(prev) * 100).toFixed(1) : '0.0',
      yoyDelta: +(current - prevYear).toFixed(2),
      yoyPct: prevYear ? ((current - prevYear) / Math.abs(prevYear) * 100).toFixed(1) : '0.0',
      sparkline: obs.slice(0, 60).reverse().map(o => ({ v: parseFloat(o.value) || 0, d: o.date }))
    };
  };

  return {
    trade_balance:  process(tb,   'Trade Balance',    '$B'),
    total_imports:  process(ti,   'Total Imports',    '$B'),
    capital_goods:  process(cg,   'Capital Goods',    '$B'),
    consumer_goods: process(cons, 'Consumer Goods',   '$B'),
    freight_index:  processRaw(fi, 'Brent Crude',     '$/bbl'),
    timestamp: new Date().toISOString()
  };
}

module.exports = { getTradeIntelligence };
