// frontend/src/pages/TradePage.jsx
import { useState, useEffect, useRef } from 'react';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import { RiBarChartBoxLine } from 'react-icons/ri';
import './TradePage.css';

const API = import.meta.env.VITE_API_URL || 'http://localhost:5000';

// ── Formatters ─────────────────────────────────────────────────────────────────
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
const fmtBbl = n => (!n && n !== 0) ? '—' : `$${n.toFixed(2)}/bbl`;
const fmtGal = n => (!n && n !== 0) ? '—' : `$${n.toFixed(3)}/gal`;

// ── Static fallback signals (shown when NewsAPI is unavailable) ────────────────
const FALLBACK_SIGNALS = [
  { title: 'Red Sea disruptions ongoing — vessels rerouting via Cape of Good Hope adds 12–14 days', urgency_score: 9, affected_sectors: ['all sectors'] },
  { title: 'Section 301 tariff review: additional China goods under assessment for 25%+ rates', urgency_score: 8, affected_sectors: ['electronics', 'apparel'] },
  { title: 'Air freight rates up 18% MoM on Asia-US routes — ocean alternative window narrowing', urgency_score: 8, affected_sectors: ['electronics', 'pharma'] },
  { title: 'Port of LA/LB dwell times rising ahead of holiday pre-stocking surge', urgency_score: 7, affected_sectors: ['e-commerce', 'cpg'] },
  { title: 'Vietnam manufacturing capacity expanding — apparel/electronics sourcing shift accelerating', urgency_score: 7, affected_sectors: ['apparel', 'electronics'] },
  { title: 'IMO 2025 fuel regulations — carrier fuel surcharges rising across all major lanes', urgency_score: 6, affected_sectors: ['all sectors'] },
  { title: 'India-US trade corridor volumes +22% YoY as brands diversify from China', urgency_score: 6, affected_sectors: ['cpg', 'pharma'] },
  { title: 'Panama Canal water levels recovered — transit capacity near historical norms', urgency_score: 5, affected_sectors: ['cpg', 'e-commerce'] },
];

// ── Static reference data ─────────────────────────────────────────────────────
const CONTAINER_RATES = [
  // Trans-Pacific
  { route: 'China-US West Coast',   lane: 'Shanghai → Los Angeles',      feu: 1_850, change: -4.2 },
  { route: 'China-US East Coast',   lane: 'Shanghai → New York',         feu: 2_800, change: +5.4 },
  { route: 'Vietnam-US West',       lane: 'Ho Chi Minh → Los Angeles',   feu: 1_950, change: +3.1 },
  { route: 'Japan-US West',         lane: 'Tokyo → Los Angeles',         feu: 1_420, change: -1.2 },
  { route: 'Korea-US West',         lane: 'Busan → Los Angeles',         feu: 1_380, change: -0.9 },
  { route: 'Taiwan-US West',        lane: 'Kaohsiung → Los Angeles',     feu: 1_490, change: +0.7 },
  { route: 'SE Asia-US East',       lane: 'Singapore → New York',        feu: 2_650, change: +4.2 },
  { route: 'HK-US East',            lane: 'Hong Kong → New York',        feu: 2_750, change: +3.8 },
  // Asia-Europe
  { route: 'China-Rotterdam',       lane: 'Shanghai → Rotterdam',        feu: 1_650, change: -2.8 },
  { route: 'SE Asia-Europe',        lane: 'Singapore → Rotterdam',       feu: 1_520, change: -1.4 },
  // South Asia
  { route: 'India-US West',         lane: 'Mumbai → Los Angeles',        feu: 2_100, change: +1.8 },
  { route: 'India-US East',         lane: 'Mumbai → New York',           feu: 2_280, change: +2.3 },
  // Atlantic
  { route: 'Europe-US East',        lane: 'Rotterdam → New York',        feu: 1_350, change: -1.5 },
  { route: 'Turkey-Europe',         lane: 'Istanbul → Rotterdam',        feu:   980, change: -0.6 },
  // Middle East / Africa
  { route: 'Middle East-Europe',    lane: 'Dubai → Rotterdam',           feu: 1_150, change: +1.1 },
  { route: 'Africa-Europe',         lane: 'Durban → Rotterdam',          feu: 1_320, change: -2.1 },
  // Americas
  { route: 'Mexico-US South',       lane: 'Manzanillo → Houston',        feu:   750, change: -3.4 },
  { route: 'Brazil-US East',        lane: 'Santos → New York',           feu: 1_680, change: +2.7 },
  { route: 'Peru-US West',          lane: 'Callao → Los Angeles',        feu: 1_450, change: +1.5 },
  // Australia
  { route: 'Australia-US West',     lane: 'Melbourne → Los Angeles',     feu: 2_050, change: +0.9 },
];

const FX_RATES = [
  { pair: 'USD/CNY', rate: 7.32,    pct: +0.12,  note: 'China Yuan' },
  { pair: 'USD/EUR', rate: 0.93,    pct: -0.08,  note: 'Euro' },
  { pair: 'USD/CAD', rate: 1.36,    pct: -0.05,  note: 'Canadian Dollar' },
  { pair: 'USD/MXN', rate: 20.4,    pct: -0.31,  note: 'Mexican Peso' },
  { pair: 'USD/JPY', rate: 156.0,   pct: +0.04,  note: 'Japanese Yen' },
  { pair: 'USD/KRW', rate: 1_382,   pct: +0.09,  note: 'Korean Won' },
  { pair: 'USD/VND', rate: 25_450,  pct: +0.00,  note: 'Vietnam Dong' },
  { pair: 'USD/INR', rate: 84.2,    pct: +0.15,  note: 'Indian Rupee' },
  { pair: 'USD/TWD', rate: 32.1,    pct: -0.02,  note: 'Taiwan Dollar' },
  { pair: 'USD/SGD', rate: 1.34,    pct: -0.06,  note: 'Singapore Dollar' },
  { pair: 'USD/HKD', rate: 7.82,    pct: +0.01,  note: 'Hong Kong Dollar' },
  { pair: 'USD/MYR', rate: 4.71,    pct: +0.08,  note: 'Malaysian Ringgit' },
  { pair: 'USD/THB', rate: 35.2,    pct: -0.11,  note: 'Thai Baht' },
  { pair: 'USD/GBP', rate: 0.79,    pct: -0.03,  note: 'British Pound' },
  { pair: 'USD/AUD', rate: 1.55,    pct: +0.07,  note: 'Australian Dollar' },
  { pair: 'USD/BRL', rate: 5.12,    pct: +0.18,  note: 'Brazilian Real' },
];

const IMPORT_ORIGINS = [
  { country: 'China',       pct: 14.5, color: '#ff3b3b' },
  { country: 'Mexico',      pct: 14.4, color: '#ff9f0a' },
  { country: 'Canada',      pct: 13.2, color: '#00c176' },
  { country: 'Germany',     pct: 4.3,  color: '#e2e8f0' },
  { country: 'Japan',       pct: 4.1,  color: '#a78bfa' },
  { country: 'Vietnam',     pct: 3.9,  color: '#60a5fa' },
  { country: 'South Korea', pct: 3.8,  color: '#34d399' },
  { country: 'Taiwan',      pct: 3.4,  color: '#fb923c' },
  { country: 'Ireland',     pct: 3.2,  color: '#2dd4bf' },
  { country: 'India',       pct: 2.8,  color: '#f97316' },
  { country: 'Italy',       pct: 2.2,  color: '#84cc16' },
  { country: 'Switzerland', pct: 2.0,  color: '#94a3b8' },
  { country: 'Malaysia',    pct: 2.0,  color: '#38bdf8' },
  { country: 'Thailand',    pct: 1.8,  color: '#fbbf24' },
  { country: 'France',      pct: 1.7,  color: '#818cf8' },
  { country: 'UK',          pct: 1.6,  color: '#c084fc' },
  { country: 'Indonesia',   pct: 1.4,  color: '#fb7185' },
  { country: 'Brazil',      pct: 1.3,  color: '#4ade80' },
];

const POLICY_CALENDAR = [
  { date: 'Ongoing',  event: 'Section 301 China — 4-year statutory review',           urgency: 'high'   },
  { date: 'Jul 2026', event: 'USMCA joint review — tariff-free status re-evaluation', urgency: 'medium' },
  { date: 'Q2 2025',  event: 'ITC §201 solar cells — annual duty rate review',        urgency: 'medium' },
  { date: 'Quarterly', event: 'DOC antidumping/CVD administrative reviews',           urgency: 'low'    },
  { date: 'Ongoing',  event: 'India bilateral trade deal negotiations',               urgency: 'low'    },
  { date: 'Ongoing',  event: 'EU-US Trade & Technology Council quarterly sessions',   urgency: 'low'    },
];

const SECTION_301 = [
  { list: 'List 1',  goods: '$34B',  rate: '25%',  categories: 'Aerospace, machinery, nuclear reactors' },
  { list: 'List 2',  goods: '$16B',  rate: '25%',  categories: 'Chemicals, plastics, motor vehicles' },
  { list: 'List 3',  goods: '$200B', rate: '7.5–25%', categories: 'Consumer & industrial goods' },
  { list: 'List 4A', goods: '$120B', rate: '7.5%', categories: 'Consumer goods, apparel, footwear' },
  { list: 'EV',      goods: 'All',   rate: '100%', categories: 'Battery electric vehicles' },
  { list: 'Solar',   goods: 'All',   rate: '50%',  categories: 'Crystalline silicon solar cells' },
  { list: 'Li-ion',  goods: 'All',   rate: '25%',  categories: 'Lithium-ion batteries & components' },
];

const CYCLE_TIMES = [
  { lane: 'China → US West',    ocean: '16d', air: '3d', customs: '1–2d', drayage: '1d' },
  { lane: 'Vietnam → US West',  ocean: '18d', air: '3d', customs: '1–2d', drayage: '1d' },
  { lane: 'India → US West',    ocean: '22d', air: '4d', customs: '2–3d', drayage: '1d' },
  { lane: 'Europe → US East',   ocean: '12d', air: '2d', customs: '1d',   drayage: '1d' },
  { lane: 'China → US East',    ocean: '30d', air: '4d', customs: '2d',   drayage: '1d' },
];

const FREIGHT_MODES = [
  { mode: 'Ocean FCL',    volumePct: 58, valuePct: 35, color: '#00d4ff' },
  { mode: 'Ocean LCL',    volumePct: 14, valuePct: 6,  color: '#0ea5e9' },
  { mode: 'Air Freight',  volumePct: 1,  valuePct: 26, color: '#a78bfa' },
  { mode: 'Truck (Cross-border)', volumePct: 25, valuePct: 32, color: '#10b981' },
  { mode: 'Rail',         volumePct: 2,  valuePct: 1,  color: '#475569' },
];

const COMMODITIES = [
  { key: 'total_imports',  label: 'Total Imports' },
  { key: 'capital_goods',  label: 'Capital Goods' },
  { key: 'consumer_goods', label: 'Consumer Goods' },
  { key: 'trade_balance',  label: 'Trade Balance' },
];

const ROUTES = [
  // Trans-Pacific
  'China-US West Coast',
  'China-US East Coast',
  'Vietnam-US West',
  'Japan-US West',
  'Korea-US West',
  'Taiwan-US West',
  'SE Asia-US East',
  'HK-US East',
  // Asia-Europe
  'China-Rotterdam',
  'SE Asia-Europe',
  // South Asia
  'India-US West',
  'India-US East',
  // Atlantic
  'Europe-US East',
  'Turkey-Europe',
  // Middle East / Africa
  'Middle East-Europe',
  'Africa-Europe',
  // Americas
  'Mexico-US South',
  'Brazil-US East',
  'Peru-US West',
  // Australia
  'Australia-US West',
];

// ── Sub-components ────────────────────────────────────────────────────────────
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

function BarSparkline({ data, color }) {
  if (!data?.length) return <div className="sparkline-empty" />;
  const vals = data.map(d => d.v);
  const min = Math.min(...vals);
  const max = Math.max(...vals);
  const range = max - min || 1;
  const H = 36, W = 120;
  const n = Math.min(data.length, 12);
  const gap = 1.5;
  const bw = (W - gap * (n - 1)) / n;
  return (
    <svg width="100%" height={H} viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none">
      {data.slice(0, n).map((pt, i) => {
        const bh = Math.max(2, ((pt.v - min) / range) * (H - 4));
        return (
          <rect
            key={i}
            x={i * (bw + gap)}
            y={H - bh}
            width={bw}
            height={bh}
            fill={color}
            opacity={0.35 + 0.65 * ((pt.v - min) / range)}
            rx={1}
          />
        );
      })}
    </svg>
  );
}

function MacroTile({ label, data, color, formatter, barSpark }) {
  const fmtVal = formatter || fmt;
  const delta = data ? fmtDelta(data.momDelta, data.momPct) : null;
  const positive = data?.momDelta >= 0;
  return (
    <div className="macro-tile">
      <div className="tile-label">{label}</div>
      <div className="tile-value" style={{ color }}>{fmtVal(data?.current)}</div>
      {delta && (
        <div className="tile-delta" style={{ color: positive ? '#00c176' : '#ff3b3b' }}>
          {delta} {data?.period || 'MoM'}
        </div>
      )}
      <div className="tile-spark">
        {barSpark
          ? <BarSparkline data={data?.sparkline} color={color} />
          : <Sparkline    data={data?.sparkline} color={color} />}
      </div>
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function TradePage() {
  const [tradeData, setTradeData]   = useState(null);
  const [signals, setSignals]       = useState([]);
  const [ports, setPorts]           = useState([]);
  const [loading, setLoading]       = useState(true);
  const [routeOrigin, setRouteOrigin] = useState('China-US West Coast');
  const [routeResult, setRouteResult] = useState(null);
  const [routeLoading, setRouteLoading] = useState(false);
  const [clock, setClock]           = useState('');
  const [triggerEvents, setTriggerEvents] = useState([]);
  const [liveFx, setLiveFx]         = useState(null);

  // Live EST clock
  useEffect(() => {
    const tick = () => {
      setClock(new Date().toLocaleString('en-US', {
        timeZone: 'America/New_York',
        weekday: 'short', month: 'short', day: '2-digit',
        hour: '2-digit', minute: '2-digit', second: '2-digit',
        hour12: false,
      }) + ' EST');
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    Promise.all([
      fetch(`${API}/api/trade-intelligence`).then(r => r.json()),
      fetch(`${API}/api/signals`).then(r => r.json()),
      fetch(`${API}/api/globe-data`).then(r => r.json()),
      fetch(`${API}/api/trigger-events`).then(r => r.json()).catch(() => null),
      fetch(`${API}/api/fx-rates`).then(r => r.json()).catch(() => null),
    ]).then(([td, sig, globe, te, fx]) => {
      setTradeData(td);
      setSignals(Array.isArray(sig) && sig.length > 0 ? sig : FALLBACK_SIGNALS);
      setPorts(globe?.ports || []);
      if (te?.events?.length) setTriggerEvents(te.events);
      if (fx?.rates?.length) setLiveFx(fx);
      setLoading(false);
    }).catch(() => {
      setSignals(FALLBACK_SIGNALS);
      setLoading(false);
    });
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

  const chartData = (() => {
    if (!tradeData) return [];
    const tb   = tradeData.trade_balance?.sparkline  || [];
    const cg   = tradeData.capital_goods?.sparkline  || [];
    const cons = tradeData.consumer_goods?.sparkline || [];
    // Date-keyed maps so mismatched FRED release calendars still align correctly
    const cgByDate   = Object.fromEntries(cg.map(p => [p.d?.slice(0, 7), p.v]));
    const consByDate = Object.fromEntries(cons.map(p => [p.d?.slice(0, 7), p.v]));
    return tb.map(pt => {
      const mo = pt.d?.slice(0, 7);
      return {
        d:        mo,
        balance:  pt.v,
        capital:  cgByDate[mo]   ?? null,
        consumer: consByDate[mo] ?? null,
      };
    });
  })();

  const urgencyColor = s => s >= 8 ? '#ff3b3b' : s >= 5 ? '#ff9f0a' : '#00c176';
  const portColor    = s => s === 'disruption' ? '#ff3b3b' : s === 'congestion' ? '#ff9f0a' : '#00c176';
  const policyColor  = u => u === 'high' ? '#ff3b3b' : u === 'medium' ? '#ff9f0a' : '#475569';

  return (
    <div className="trade-page page-wrap">

      {/* Header */}
      <div className="trade-header">
        <div>
          <div className="page-title">
            <RiBarChartBoxLine size={22} style={{ verticalAlign: 'middle', marginRight: 8 }} />
            Trade Intelligence Terminal
          </div>
          <div className="page-subtitle">Live FRED macro data · Global supply chain signals · Route analytics</div>
        </div>
        <div className="bb-clock">{clock}</div>
      </div>

      {/* ── Macro tiles ── */}
      <div className="macro-tiles">
        <MacroTile label="TRADE BALANCE"              data={tradeData?.trade_balance}  color="#ff3b3b" />
        <MacroTile label="TOTAL IMPORTS"              data={tradeData?.total_imports}  color="#60a5fa" />
        <MacroTile label="CAPITAL GOODS"              data={tradeData?.capital_goods}  color="#00c176" barSpark />
        <MacroTile label="CONSUMER GOODS"             data={tradeData?.consumer_goods} color="#ff9f0a" barSpark />
        <MacroTile label="BRENT CRUDE · FREIGHT PROXY" data={tradeData?.freight_index} color="#a78bfa" formatter={fmtBbl} />
        <MacroTile label="US DIESEL RETAIL"           data={tradeData?.diesel_price}  color="#e2e8f0" formatter={fmtGal} />
      </div>

      {/* ── Row 1: Chart · Commodity table · Live signals ── */}
      <div className="trade-main-row">
        <div className="bb-panel chart-panel">
          <div className="bb-panel-header">US GOODS IMPORTS — 12M MONTHLY TREND</div>
          {loading ? (
            <div className="bb-loading">Fetching FRED data...</div>
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <AreaChart data={chartData} margin={{ top: 10, right: 10, bottom: 0, left: 0 }}>
                <defs>
                  <linearGradient id="gCapital" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#00c176" stopOpacity={0.25} />
                    <stop offset="95%" stopColor="#00c176" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="gConsumer" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#ff9f0a" stopOpacity={0.2} />
                    <stop offset="95%" stopColor="#ff9f0a" stopOpacity={0} />
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
                <Area type="monotone" dataKey="capital"  name="Capital Goods"  stroke="#00c176" strokeWidth={2}   fill="url(#gCapital)"  dot={false} />
                <Area type="monotone" dataKey="consumer" name="Consumer Goods" stroke="#ff9f0a" strokeWidth={1.5} fill="url(#gConsumer)" dot={false} />
                <Area type="monotone" dataKey="balance"  name="Trade Balance"  stroke="#ff3b3b" strokeWidth={1.5} fill="none"            dot={false} />
              </AreaChart>
            </ResponsiveContainer>
          )}
          <div className="chart-legend">
            <span style={{ color: '#00c176' }}>── Capital Goods</span>
            <span style={{ color: '#ff9f0a' }}>── Consumer Goods</span>
            <span style={{ color: '#ff3b3b' }}>── Trade Balance</span>
          </div>
        </div>

        <div className="bb-panel commodity-panel">
          <div className="bb-panel-header">COMMODITY FLOWS</div>
          <table className="commodity-table">
            <thead>
              <tr>
                <th>Series</th><th>Current</th><th>MoM</th><th>YoY</th>
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

        <div className="bb-panel signal-panel">
          <div className="bb-panel-header">LIVE SIGNALS</div>
          <div className="bb-signals">
            {signals.slice(0, 8).map((s, i) => (
              <div key={i} className="bb-signal-row">
                <span className="bb-sig-dot" style={{ background: urgencyColor(s.urgency_score) }} />
                <span className="bb-sig-score" style={{ color: urgencyColor(s.urgency_score) }}>{s.urgency_score}</span>
                <span className="bb-sig-text">{(s.title || s.headline || '').slice(0, 60)}{(s.title || s.headline || '').length > 60 ? '…' : ''}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── Row 2: Port Status · Container Rates · FX Rates · Import Origins ── */}
      <div className="trade-mid-row">

        {/* Port congestion status */}
        <div className="bb-panel">
          <div className="bb-panel-header">PORT CONGESTION STATUS</div>
          <div className="port-status-list">
            {(ports.length > 0 ? ports : [
              { name: 'LA/Long Beach', congestion: 5, status: 'congestion' },
              { name: 'Shanghai',      congestion: 3, status: 'clear' },
              { name: 'Rotterdam',     congestion: 2, status: 'clear' },
              { name: 'Singapore',     congestion: 2, status: 'clear' },
              { name: 'Felixstowe',    congestion: 5, status: 'congestion' },
              { name: 'Busan',         congestion: 2, status: 'clear' },
              { name: 'Hamburg',       congestion: 2, status: 'clear' },
              { name: 'Savannah',      congestion: 3, status: 'clear' },
            ]).map(p => (
              <div key={p.name} className="port-status-row">
                <span className="port-status-dot" style={{ background: portColor(p.status) }} />
                <span className="port-status-name">{p.name}</span>
                <div className="port-cong-bar-wrap">
                  <div className="port-cong-bar" style={{
                    width: `${(p.congestion / 10) * 100}%`,
                    background: portColor(p.status),
                  }} />
                </div>
                <span className="port-cong-val" style={{ color: portColor(p.status) }}>{p.congestion}/10</span>
              </div>
            ))}
          </div>
        </div>

        {/* Container rates */}
        <div className="bb-panel">
          <div className="bb-panel-header">CONTAINER RATES — 40FT FEU SPOT · 2025</div>
          <div className="container-rate-list">
            {CONTAINER_RATES.map(r => (
              <div key={r.route} className="cr-row">
                <span className="cr-route">{r.route}</span>
                <span className="cr-lane">{r.lane}</span>
                <span className="cr-rate">${r.feu.toLocaleString()}</span>
                <span className="cr-change" style={{ color: r.change >= 0 ? '#ff3b3b' : '#00c176' }}>
                  {r.change >= 0 ? '+' : ''}{r.change}%
                </span>
              </div>
            ))}
          </div>
          <div className="fred-note">Indicative spot rates · Source: industry benchmarks</div>
        </div>

        {/* FX rates */}
        <div className="bb-panel">
          <div className="bb-panel-header">
            FX RATES
            {liveFx ? <span className="bb-live-tag">LIVE</span> : <span className="bb-live-tag static">REF</span>}
          </div>
          <div className="fx-list">
            {(liveFx?.rates || FX_RATES).map(r => (
              <div key={r.pair} className="fx-row">
                <div className="fx-left">
                  <span className="fx-pair">{r.pair}</span>
                  <span className="fx-note">{r.note}</span>
                </div>
                <div className="fx-right">
                  <span className="fx-rate">{r.rate ? r.rate.toLocaleString('en-US', { minimumFractionDigits: 2 }) : '—'}</span>
                  {r.pct !== undefined && (
                    <span className="fx-pct" style={{ color: r.pct >= 0 ? '#ff3b3b' : '#00c176' }}>
                      {r.pct >= 0 ? '+' : ''}{r.pct.toFixed(2)}%
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
          <div className="fred-note">
            {liveFx ? `Live · exchangerate-api.com · Updated ${new Date(liveFx.updated).toLocaleTimeString()}` : 'USD base · % = 1-day change · Indicative only'}
          </div>
        </div>

        {/* Import origins */}
        <div className="bb-panel">
          <div className="bb-panel-header">US IMPORT ORIGINS — 2024 SHARE</div>
          <div className="origins-list">
            {IMPORT_ORIGINS.map(o => (
              <div key={o.country} className="origin-row">
                <span className="origin-country">{o.country}</span>
                <div className="origin-bar-wrap">
                  <div className="origin-bar" style={{ width: `${(o.pct / 15) * 100}%`, background: o.color }} />
                </div>
                <span className="origin-pct" style={{ color: o.color }}>{o.pct}%</span>
              </div>
            ))}
          </div>
          <div className="fred-note">Source: US Census Bureau · Top 18 by import value</div>
        </div>
      </div>

      {/* ── Row 3: Route Optimizer · Tariff Rates ── */}
      <div className="trade-bottom-row">
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

        <div className="bb-panel tariff-info-panel">
          <div className="bb-panel-header">KEY TARIFF RATES — CHINA ORIGIN · 2025</div>
          <div className="tariff-table">
            {[
              { code: '8471', desc: 'Computers & peripherals', rate: '0% + 25% §301' },
              { code: '8517', desc: 'Smartphones & telecom',   rate: '0% + 25% §301' },
              { code: '9403', desc: 'Furniture',               rate: '5% + 25% §301' },
              { code: '6110', desc: 'Knitwear / Apparel',      rate: '12%' },
              { code: '4202', desc: 'Luggage & handbags',      rate: '15.8%' },
              { code: '6403', desc: 'Footwear',                rate: '8.5%' },
              { code: '8708', desc: 'Auto parts',              rate: '2.5% + 25% §301' },
              { code: '8703', desc: 'Electric vehicles',       rate: '25% + 100%' },
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
          <div className="fred-note">§301 = Section 301 China surcharge · Rates as of 2025 · Subject to change</div>
        </div>
      </div>

      {/* ── Row 4: Cycle Times · §301 Actions · Policy Calendar · Freight Modes ── */}
      <div className="trade-extra-row">

        {/* Supply chain cycle times */}
        <div className="bb-panel">
          <div className="bb-panel-header">SUPPLY CHAIN CYCLE TIMES — FLEXPORT BENCHMARKS</div>
          <table className="commodity-table">
            <thead>
              <tr>
                <th>Lane</th><th>Ocean</th><th>Air</th><th>Customs</th><th>Drayage</th>
              </tr>
            </thead>
            <tbody>
              {CYCLE_TIMES.map(r => (
                <tr key={r.lane}>
                  <td className="c-label">{r.lane}</td>
                  <td className="c-val" style={{ color: '#00d4ff' }}>{r.ocean}</td>
                  <td className="c-val" style={{ color: '#a78bfa' }}>{r.air}</td>
                  <td className="c-val" style={{ color: '#ff9f0a' }}>{r.customs}</td>
                  <td className="c-val" style={{ color: '#10b981' }}>{r.drayage}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="fred-note">Port-to-door estimates · Customs assumes pre-filing · Flexport benchmarks 2024–2025</div>
        </div>

        {/* Section 301 actions */}
        <div className="bb-panel">
          <div className="bb-panel-header">ACTIVE §301 TARIFF ACTIONS — CHINA</div>
          <div className="s301-list">
            {SECTION_301.map(r => (
              <div key={r.list} className="s301-row">
                <div className="s301-left">
                  <span className="s301-list-badge">{r.list}</span>
                  <span className="s301-goods">{r.goods} goods</span>
                </div>
                <div className="s301-right">
                  <span className="s301-rate">{r.rate}</span>
                </div>
                <span className="s301-cats">{r.categories}</span>
              </div>
            ))}
          </div>
          <div className="fred-note">USTR active lists · Rates additional to MFN base duty</div>
        </div>

        {/* Policy calendar */}
        <div className="bb-panel">
          <div className="bb-panel-header">TRADE POLICY CALENDAR</div>
          <div className="policy-list">
            {POLICY_CALENDAR.map((e, i) => (
              <div key={i} className="policy-row">
                <span className="policy-date">{e.date}</span>
                <span className="policy-dot" style={{ background: policyColor(e.urgency) }} />
                <span className="policy-event">{e.event}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Freight mode split */}
        <div className="bb-panel">
          <div className="bb-panel-header">US INTERNATIONAL FREIGHT — MODE SPLIT</div>
          <div className="mode-list">
            {FREIGHT_MODES.map(m => (
              <div key={m.mode} className="mode-row">
                <span className="mode-name">{m.mode}</span>
                <div className="mode-bars">
                  <div className="mode-bar-row">
                    <span className="mode-bar-label">Vol</span>
                    <div className="mode-bar-wrap">
                      <div className="mode-bar" style={{ width: `${m.volumePct}%`, background: m.color }} />
                    </div>
                    <span className="mode-bar-pct">{m.volumePct}%</span>
                  </div>
                  <div className="mode-bar-row">
                    <span className="mode-bar-label">Val</span>
                    <div className="mode-bar-wrap">
                      <div className="mode-bar" style={{ width: `${m.valuePct}%`, background: m.color, opacity: 0.5 }} />
                    </div>
                    <span className="mode-bar-pct">{m.valuePct}%</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
          <div className="fred-note">Source: US Census Foreign Trade · % of total international freight</div>
        </div>
      </div>

      {/* ── Row 5: Trigger Events ── */}
      <div className="trade-trigger-row">
        <div className="bb-panel" style={{ gridColumn: '1 / -1' }}>
          <div className="bb-panel-header">
            EARNINGS & TRIGGER EVENT MONITOR
            <span className="bb-live-tag">LIVE</span>
          </div>
          <div className="te-grid">
            {(triggerEvents.length > 0 ? triggerEvents : [
              { headline: 'Apple shifts 25% of iPhone production from China to India amid tariff concerns', sector: 'Electronics', urgency: 'high', date: 'Mar 2026' },
              { headline: 'Nike announces Vietnam manufacturing capacity expansion — 3 new factories', sector: 'Apparel', urgency: 'high', date: 'Mar 2026' },
              { headline: 'Target reports Q4 inventory glut — import velocity expected to slow 15%', sector: 'E-commerce', urgency: 'medium', date: 'Feb 2026' },
              { headline: 'TSMC Arizona fab ramp-up — domestic semiconductor logistics demand rising', sector: 'Electronics', urgency: 'medium', date: 'Feb 2026' },
              { headline: 'Walmart nearshoring push — 5 Mexican suppliers added for 2026', sector: 'Retail / CPG', urgency: 'medium', date: 'Jan 2026' },
              { headline: 'Amazon repatriates 8% of SKUs from China warehouses to US 3PL network', sector: 'E-commerce', urgency: 'low', date: 'Jan 2026' },
            ]).map((e, i) => {
              const uc = e.urgency === 'high' ? '#ff3b3b' : e.urgency === 'medium' ? '#ff9f0a' : '#475569';
              return (
                <div key={i} className="te-card" style={{ borderColor: `${uc}22` }}>
                  <div className="te-top">
                    <span className="te-sector">{e.sector}</span>
                    <span className="te-urgency" style={{ color: uc }}>{e.urgency?.toUpperCase()}</span>
                    <span className="te-date">{e.date}</span>
                  </div>
                  {e.url ? (
                    <a href={e.url} target="_blank" rel="noreferrer" className="te-headline">{e.headline}</a>
                  ) : (
                    <p className="te-headline">{e.headline}</p>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>

    </div>
  );
}
