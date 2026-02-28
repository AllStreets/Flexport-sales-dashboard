// backend/services/tradeIntelligenceService.js
const { getTradeData } = require('./fredService');

async function getTradeIntelligence() {
  const [tb, ti, cg, cons] = await Promise.allSettled([
    getTradeData('trade_balance'),
    getTradeData('total_imports'),
    getTradeData('electronics'),  // capital goods (AITGICS)
    getTradeData('apparel')       // consumer goods (AITGIGS)
  ]);

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

  return {
    trade_balance:  process(tb,   'Trade Balance',    '$B'),
    total_imports:  process(ti,   'Total Imports',    '$B'),
    capital_goods:  process(cg,   'Capital Goods',    '$B'),
    consumer_goods: process(cons, 'Consumer Goods',   '$B'),
    timestamp: new Date().toISOString()
  };
}

module.exports = { getTradeIntelligence };
