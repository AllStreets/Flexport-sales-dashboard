// frontend/src/pages/TradePage.jsx
import { useState, useEffect } from 'react';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import { RiBarChartBoxLine } from 'react-icons/ri';
import './TradePage.css';

const API = import.meta.env.VITE_API_URL || 'http://localhost:5000';

const fmt = n => {
  if (!n && n !== 0) return '—';
  const abs = Math.abs(n);
  const formatted = abs >= 100 ? Math.round(n).toLocaleString('en-US') : n.toFixed(1);
  return `$${formatted}B`;
};
const fmtDelta = (n, pct) => {
  if (!n && n !== 0) return null;
  const sign = n >= 0 ? '+' : '';
  const abs = Math.abs(n);
  const formatted = abs >= 100 ? Math.round(n).toLocaleString('en-US') : n.toFixed(1);
  return `${sign}${pct}% (${sign}${formatted}B)`;
};

function Sparkline({ data, color }) {
  if (!data?.length) return <div className="sparkline-empty" />;
  return (
    <ResponsiveContainer width="100%" height={36}>
      <AreaChart data={data} margin={{ top: 2, right: 0, bottom: 2, left: 0 }}>
        <defs>
          <linearGradient id={`sg-${color.replace('#', '')}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor={color} stopOpacity={0.3} />
            <stop offset="95%" stopColor={color} stopOpacity={0} />
          </linearGradient>
        </defs>
        <Area type="monotone" dataKey="v" stroke={color} strokeWidth={1.5} fill={`url(#sg-${color.replace('#', '')})`} dot={false} />
      </AreaChart>
    </ResponsiveContainer>
  );
}

function MacroTile({ label, data, color, formatter }) {
  const fmtVal = formatter || fmt;
  const delta = data ? fmtDelta(data.momDelta, data.momPct) : null;
  const positive = data?.momDelta >= 0;
  return (
    <div className="macro-tile">
      <div className="tile-label">{label}</div>
      <div className="tile-value" style={{ color }}>{fmtVal(data?.current)}</div>
      {delta && (
        <div className="tile-delta" style={{ color: positive ? '#00c176' : '#ff3b3b' }}>
          {delta} MoM
        </div>
      )}
      <div className="tile-spark">
        <Sparkline data={data?.sparkline} color={color} />
      </div>
    </div>
  );
}

const fmtBbl = n => {
  if (!n && n !== 0) return '—';
  return `$${n.toFixed(2)}/bbl`;
};

const COMMODITIES = [
  { key: 'total_imports',  label: 'Total Imports' },
  { key: 'capital_goods',  label: 'Capital Goods' },
  { key: 'consumer_goods', label: 'Consumer Goods' },
  { key: 'trade_balance',  label: 'Trade Balance' },
];

const ROUTES = [
  'China-US West Coast', 'China-US East Coast', 'SE Asia-US West Coast',
  'India-US', 'Europe-US East Coast', 'Vietnam-US West Coast',
];

export default function TradePage() {
  const [tradeData, setTradeData] = useState(null);
  const [signals, setSignals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [routeOrigin, setRouteOrigin] = useState('China-US West Coast');
  const [routeResult, setRouteResult] = useState(null);
  const [routeLoading, setRouteLoading] = useState(false);

  useEffect(() => {
    Promise.all([
      fetch(`${API}/api/trade-intelligence`).then(r => r.json()),
      fetch(`${API}/api/signals`).then(r => r.json()),
    ]).then(([td, sig]) => {
      setTradeData(td);
      setSignals(Array.isArray(sig) ? sig : []);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  const optimizeRoute = async () => {
    const [origin, ...destParts] = routeOrigin.split('-');
    const destination = destParts.join(' ');
    setRouteLoading(true);
    try {
      const r = await fetch(`${API}/api/route-optimize`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ origin: origin.trim(), destination: destination.trim() })
      });
      setRouteResult(await r.json());
    } catch { }
    finally { setRouteLoading(false); }
  };

  // Build chart data from sparklines
  const chartData = (() => {
    if (!tradeData) return [];
    const ti = tradeData.total_imports?.sparkline || [];
    const tb = tradeData.trade_balance?.sparkline || [];
    const cg = tradeData.capital_goods?.sparkline || [];
    return ti.map((pt, i) => ({
      d: pt.d?.slice(0, 7),
      imports: pt.v,
      balance: tb[i]?.v ?? null,
      capital: cg[i]?.v ?? null,
    }));
  })();

  const urgencyColor = s => s >= 8 ? '#ff3b3b' : s >= 5 ? '#ff9f0a' : '#00c176';

  return (
    <div className="trade-page page-wrap">
      <div className="trade-header">
        <div>
          <div className="page-title"><RiBarChartBoxLine size={22} style={{ verticalAlign: 'middle', marginRight: 8 }} />Trade Intelligence Terminal</div>
          <div className="page-subtitle">Live FRED macro data · Global supply chain signals · Route analytics</div>
        </div>
        <div className="bb-clock">{new Date().toUTCString().slice(0, 25)} UTC</div>
      </div>

      {/* Macro tiles */}
      <div className="macro-tiles">
        <MacroTile label="TRADE BALANCE" data={tradeData?.trade_balance} color="#ff3b3b" />
        <MacroTile label="TOTAL IMPORTS" data={tradeData?.total_imports} color="#00d4ff" />
        <MacroTile label="CAPITAL GOODS" data={tradeData?.capital_goods} color="#00c176" />
        <MacroTile label="CONSUMER GOODS" data={tradeData?.consumer_goods} color="#ff9f0a" />
        <MacroTile label="BRENT CRUDE · FREIGHT PROXY" data={tradeData?.freight_index} color="#a78bfa" formatter={fmtBbl} />
      </div>

      {/* Main row */}
      <div className="trade-main-row">
        {/* Area chart */}
        <div className="bb-panel chart-panel">
          <div className="bb-panel-header">US IMPORT FLOWS — 12M TREND</div>
          {loading ? (
            <div className="bb-loading">Fetching FRED data...</div>
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <AreaChart data={chartData} margin={{ top: 10, right: 10, bottom: 0, left: 0 }}>
                <defs>
                  <linearGradient id="gImports" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#00d4ff" stopOpacity={0.25} />
                    <stop offset="95%" stopColor="#00d4ff" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="gCapital" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#00c176" stopOpacity={0.2} />
                    <stop offset="95%" stopColor="#00c176" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="2 4" stroke="rgba(255,255,255,0.04)" />
                <XAxis dataKey="d" tick={{ fill: '#475569', fontSize: 9, fontFamily: 'JetBrains Mono' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: '#475569', fontSize: 9, fontFamily: 'JetBrains Mono' }} axisLine={false} tickLine={false} tickFormatter={v => `$${Math.round(v).toLocaleString('en-US')}B`} width={60} />
                <Tooltip
                  contentStyle={{ background: '#0a0e1a', border: '1px solid #1a2744', borderRadius: 8, fontSize: 11, fontFamily: 'JetBrains Mono' }}
                  labelStyle={{ color: '#94a3b8' }}
                  formatter={(v, name) => [`$${Math.abs(v) >= 100 ? Math.round(v).toLocaleString('en-US') : v?.toFixed(1)}B`, name]}
                />
                <Area type="monotone" dataKey="imports" name="Total Imports" stroke="#00d4ff" strokeWidth={2} fill="url(#gImports)" dot={false} />
                <Area type="monotone" dataKey="capital" name="Capital Goods" stroke="#00c176" strokeWidth={1.5} fill="url(#gCapital)" dot={false} />
                <Area type="monotone" dataKey="balance" name="Trade Balance" stroke="#ff3b3b" strokeWidth={1.5} fill="none" dot={false} />
              </AreaChart>
            </ResponsiveContainer>
          )}
          <div className="chart-legend">
            <span style={{ color: '#00d4ff' }}>── Total Imports</span>
            <span style={{ color: '#00c176' }}>── Capital Goods</span>
            <span style={{ color: '#ff3b3b' }}>── Trade Balance</span>
          </div>
        </div>

        {/* Commodity table */}
        <div className="bb-panel commodity-panel">
          <div className="bb-panel-header">COMMODITY FLOWS</div>
          <table className="commodity-table">
            <thead>
              <tr>
                <th>Series</th>
                <th>Current</th>
                <th>MoM</th>
                <th>YoY</th>
              </tr>
            </thead>
            <tbody>
              {COMMODITIES.map(({ key, label }) => {
                const d = tradeData?.[key];
                const momPos = d?.momDelta >= 0;
                const yoyPos = d?.yoyDelta >= 0;
                return (
                  <tr key={key}>
                    <td className="c-label">{label}</td>
                    <td className="c-val">{fmt(d?.current)}</td>
                    <td className="c-delta" style={{ color: momPos ? '#00c176' : '#ff3b3b' }}>
                      {d ? `${momPos ? '+' : ''}${d.momPct}%` : '—'}
                    </td>
                    <td className="c-delta" style={{ color: yoyPos ? '#00c176' : '#ff3b3b' }}>
                      {d ? `${yoyPos ? '+' : ''}${d.yoyPct}%` : '—'}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          <div className="fred-note">Source: Federal Reserve Bank of St. Louis (FRED)</div>
        </div>

        {/* Compact signal feed */}
        <div className="bb-panel signal-panel">
          <div className="bb-panel-header">LIVE SIGNALS</div>
          <div className="bb-signals">
            {signals.slice(0, 8).map((s, i) => (
              <div key={i} className="bb-signal-row">
                <span className="bb-sig-dot" style={{ background: urgencyColor(s.urgency_score) }} />
                <span className="bb-sig-score" style={{ color: urgencyColor(s.urgency_score) }}>{s.urgency_score}</span>
                <span className="bb-sig-text">{(s.title || s.headline || '').slice(0, 55)}{(s.title || '').length > 55 ? '…' : ''}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Bottom row */}
      <div className="trade-bottom-row">
        {/* Route optimizer */}
        <div className="bb-panel route-panel">
          <div className="bb-panel-header">ROUTE OPTIMIZER</div>
          <div className="route-controls">
            <select className="route-select" value={routeOrigin} onChange={e => setRouteOrigin(e.target.value)}>
              {ROUTES.map(r => <option key={r} value={r}>{r}</option>)}
            </select>
            <button className="bb-btn" onClick={optimizeRoute} disabled={routeLoading}>
              {routeLoading ? 'Calculating...' : 'Analyze Route'}
            </button>
          </div>
          {routeResult && (
            <div className="route-result">
              <div className="route-metric">
                <span className="rm-label">Flexport Transit</span>
                <span className="rm-val green">{routeResult.flexport} days</span>
              </div>
              <div className="route-metric">
                <span className="rm-label">Industry Avg</span>
                <span className="rm-val red">{routeResult.industry} days</span>
              </div>
              <div className="route-metric">
                <span className="rm-label">Days Saved</span>
                <span className="rm-val accent">{routeResult.industry - routeResult.flexport} days</span>
              </div>
              <div className="route-metric">
                <span className="rm-label">Est. Cost Reduction</span>
                <span className="rm-val green">{routeResult.costSave}%</span>
              </div>
              <div className="route-metric">
                <span className="rm-label">Disruption Risk</span>
                <span className="rm-val" style={{ color: routeResult.risk === 'high' ? '#ff3b3b' : routeResult.risk === 'medium' ? '#ff9f0a' : '#00c176' }}>
                  {routeResult.risk?.toUpperCase()}
                </span>
              </div>
            </div>
          )}
        </div>

        {/* Tariff info panel */}
        <div className="bb-panel tariff-info-panel">
          <div className="bb-panel-header">KEY TARIFF RATES — CHINA ORIGIN · Q2 2025</div>
          <div className="tariff-table">
            {[
              { code: '8471', desc: 'Computers & peripherals', rate: '0% + 25% §301' },
              { code: '8517', desc: 'Smartphones & telecom',   rate: '0% + 25% §301' },
              { code: '9403', desc: 'Furniture',               rate: '5% + 25% §301' },
              { code: '6110', desc: 'Knitwear / Apparel',      rate: '12%' },
              { code: '4202', desc: 'Luggage & handbags',      rate: '15.8%' },
              { code: '6403', desc: 'Footwear',                rate: '8.5%' },
              { code: '8708', desc: 'Auto parts',              rate: '2.5% + 25% §301' },
              { code: '8703', desc: 'Electric vehicles',       rate: '25% + 25% §301' },
              { code: '8507', desc: 'EV batteries (lithium)',  rate: '7.5% + 25% §301' },
              { code: '8501', desc: 'Electric motors',         rate: '2.5% + 25% §301' },
            ].map(r => (
              <div key={r.code} className="tariff-row">
                <span className="t-code">{r.code}</span>
                <span className="t-desc">{r.desc}</span>
                <span className="t-rate">{r.rate}</span>
              </div>
            ))}
          </div>
          <div className="fred-note">§301 = Section 301 China surcharge · Rates as of Q2 2025 · Subject to change</div>
        </div>
      </div>
    </div>
  );
}
