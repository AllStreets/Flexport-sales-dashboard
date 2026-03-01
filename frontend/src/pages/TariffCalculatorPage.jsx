// frontend/src/pages/TariffCalculatorPage.jsx
import { useState } from 'react';
import { RiPercentLine, RiArrowRightLine, RiInformationLine } from 'react-icons/ri';
import './TariffCalculatorPage.css';

const API = import.meta.env.VITE_API_URL || 'http://localhost:5000';

const ORIGINS = ['China', 'Vietnam', 'India', 'Mexico', 'Bangladesh', 'South Korea', 'Taiwan', 'Indonesia', 'Thailand', 'Malaysia', 'Japan', 'Germany', 'Italy', 'Portugal'];
const CATEGORIES = [
  { label: 'Electronics & Computers', hs: '8471', base: 0, section301: 25 },
  { label: 'Smartphones & Telecom', hs: '8517', base: 0, section301: 25 },
  { label: 'Apparel & Knitwear', hs: '6110', base: 12, section301: 0 },
  { label: 'Footwear', hs: '6403', base: 8.5, section301: 0 },
  { label: 'Furniture', hs: '9403', base: 5, section301: 25 },
  { label: 'Auto Parts', hs: '8708', base: 2.5, section301: 25 },
  { label: 'EV Batteries (Li-ion)', hs: '8507', base: 7.5, section301: 25 },
  { label: 'Electric Vehicles', hs: '8703', base: 25, section301: 100 },
  { label: 'Machinery & Equipment', hs: '8479', base: 3.5, section301: 25 },
  { label: 'Luggage & Handbags', hs: '4202', base: 15.8, section301: 0 },
  { label: 'Solar Cells', hs: '8541', base: 0, section301: 50 },
  { label: 'Steel Products', hs: '7208', base: 0, section301: 25 },
  { label: 'Pharmaceuticals', hs: '3004', base: 0, section301: 0 },
  { label: 'Medical Devices', hs: '9018', base: 0, section301: 0 },
];

const CHINA_SECTION_301_ORIGINS = ['China'];
const ADDITIONAL_TARIFF_ORIGINS = {
  'Vietnam': 10,
  'India': 26,
  'Bangladesh': 37,
  'Cambodia': 49,
  'Indonesia': 32,
  'Thailand': 36,
  'Malaysia': 24,
};

const FREIGHT_RATES = {
  'China':       { ocean: 1850, air: 4200 },
  'Vietnam':     { ocean: 1950, air: 4400 },
  'India':       { ocean: 2100, air: 5100 },
  'Mexico':      { ocean: 750,  air: 1200 },
  'Bangladesh':  { ocean: 2200, air: 4800 },
  'South Korea': { ocean: 1380, air: 3800 },
  'Taiwan':      { ocean: 1490, air: 3900 },
  'Indonesia':   { ocean: 1700, air: 4500 },
  'Thailand':    { ocean: 1800, air: 4300 },
  'Malaysia':    { ocean: 1700, air: 4200 },
  'Japan':       { ocean: 1420, air: 3700 },
  'Germany':     { ocean: 1350, air: 2900 },
  'Italy':       { ocean: 1400, air: 3000 },
  'Portugal':    { ocean: 1380, air: 2950 },
};

function TariffBar({ label, rate, color, max = 150 }) {
  const pct = Math.min((rate / max) * 100, 100);
  return (
    <div className="tc-bar-row">
      <span className="tc-bar-label">{label}</span>
      <div className="tc-bar-track">
        <div className="tc-bar-fill" style={{ width: `${pct}%`, background: color }} />
      </div>
      <span className="tc-bar-val" style={{ color }}>{rate.toFixed(1)}%</span>
    </div>
  );
}

export default function TariffCalculatorPage() {
  const [origin, setOrigin] = useState('China');
  const [catIdx, setCatIdx] = useState(0);
  const [cargoValue, setCargoValue] = useState('100000');
  const [cargoWeight, setCargoWeight] = useState('500');
  const [freightMode, setFreightMode] = useState('ocean');
  const [result, setResult] = useState(null);
  const [hsResult, setHsResult] = useState(null);
  const [hsCode, setHsCode] = useState('');
  const [hsLoading, setHsLoading] = useState(false);

  const cat = CATEGORIES[catIdx];
  const value = parseFloat(cargoValue) || 0;
  const weight = parseFloat(cargoWeight) || 0;

  const calculate = () => {
    let baseRate = cat.base;
    let s301Rate = CHINA_SECTION_301_ORIGINS.includes(origin) ? cat.section301 : 0;
    let addlRate = ADDITIONAL_TARIFF_ORIGINS[origin] || 0;
    // Mexico exempt from additional tariffs if USMCA-qualifying
    if (origin === 'Mexico') { addlRate = 0; s301Rate = 0; }

    const totalTariffRate = baseRate + s301Rate + addlRate;
    const dutyAmount = value * (totalTariffRate / 100);
    const freightCost = (FREIGHT_RATES[origin]?.[freightMode] || 1500) * Math.ceil(weight / 1000);
    const totalLandedCost = value + dutyAmount + freightCost;
    const effectiveRate = value > 0 ? (dutyAmount / value) * 100 : 0;

    setResult({ baseRate, s301Rate, addlRate, totalTariffRate, dutyAmount, freightCost, totalLandedCost, effectiveRate, value });
  };

  const lookupHs = async () => {
    if (!hsCode) return;
    setHsLoading(true);
    try {
      const r = await fetch(`${API}/api/hs-lookup`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ hsCode, origin }),
      });
      setHsResult(await r.json());
    } catch { setHsResult({ error: 'Lookup failed' }); }
    finally { setHsLoading(false); }
  };

  const fmt = n => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(n);

  return (
    <div className="tc-page page-wrap">
      <div className="tc-header">
        <div>
          <div className="page-title">
            <RiPercentLine size={22} style={{ verticalAlign: 'middle', marginRight: 8 }} />
            Tariff Impact Calculator
          </div>
          <div className="page-subtitle">Landed cost modeling · Section 301 · Reciprocal tariff exposure</div>
        </div>
      </div>

      <div className="tc-body">
        {/* Left: Inputs */}
        <div className="tc-inputs glass-card">
          <div className="tc-section-title">Shipment Parameters</div>

          <div className="tc-field">
            <label className="tc-label">Country of Origin</label>
            <select className="tc-select" value={origin} onChange={e => setOrigin(e.target.value)}>
              {ORIGINS.map(o => <option key={o} value={o}>{o}</option>)}
            </select>
          </div>

          <div className="tc-field">
            <label className="tc-label">Product Category</label>
            <select className="tc-select" value={catIdx} onChange={e => setCatIdx(Number(e.target.value))}>
              {CATEGORIES.map((c, i) => <option key={c.hs} value={i}>{c.label} (HS {c.hs})</option>)}
            </select>
          </div>

          <div className="tc-field-row">
            <div className="tc-field">
              <label className="tc-label">Cargo Value (USD)</label>
              <input className="tc-input" type="number" value={cargoValue} onChange={e => setCargoValue(e.target.value)} placeholder="100000" />
            </div>
            <div className="tc-field">
              <label className="tc-label">Weight (kg)</label>
              <input className="tc-input" type="number" value={cargoWeight} onChange={e => setCargoWeight(e.target.value)} placeholder="500" />
            </div>
          </div>

          <div className="tc-field">
            <label className="tc-label">Freight Mode</label>
            <div className="tc-mode-btns">
              <button className={`tc-mode-btn${freightMode === 'ocean' ? ' active' : ''}`} onClick={() => setFreightMode('ocean')}>Ocean FCL</button>
              <button className={`tc-mode-btn${freightMode === 'air' ? ' active' : ''}`} onClick={() => setFreightMode('air')}>Air Freight</button>
            </div>
          </div>

          <button className="tc-calc-btn" onClick={calculate}>
            <RiArrowRightLine size={14} style={{ marginRight: 6 }} />
            Calculate Landed Cost
          </button>

          <div className="tc-divider" />

          <div className="tc-section-title">HS Code Lookup</div>
          <div className="tc-field">
            <label className="tc-label">HS Code (6-digit)</label>
            <div className="tc-hs-row">
              <input className="tc-input" value={hsCode} onChange={e => setHsCode(e.target.value)} placeholder="e.g. 847130" maxLength={10} />
              <button className="tc-hs-btn" onClick={lookupHs} disabled={hsLoading || !hsCode}>
                {hsLoading ? '...' : 'Lookup'}
              </button>
            </div>
          </div>
          {hsResult && (
            <div className="tc-hs-result">
              {hsResult.error ? (
                <span className="tc-hs-err">{hsResult.error}</span>
              ) : (
                <>
                  <div className="tc-hs-rate">General Rate: <strong>{hsResult.general_rate || '—'}</strong></div>
                  {hsResult.description && <div className="tc-hs-desc">{hsResult.description}</div>}
                </>
              )}
            </div>
          )}
        </div>

        {/* Right: Results */}
        <div className="tc-results-col">
          {result ? (
            <>
              <div className="tc-result-card glass-card">
                <div className="tc-section-title">Tariff Breakdown — {origin} · {cat.label}</div>
                <TariffBar label="Base MFN Rate" rate={result.baseRate} color="#10b981" />
                {result.s301Rate > 0 && <TariffBar label="Section 301 Surcharge" rate={result.s301Rate} color="#ef4444" />}
                {result.addlRate > 0 && <TariffBar label="Reciprocal Tariff" rate={result.addlRate} color="#f59e0b" />}
                <div className="tc-total-rate">
                  <span>Effective Total Rate</span>
                  <span style={{ color: result.totalTariffRate > 20 ? '#ef4444' : result.totalTariffRate > 10 ? '#f59e0b' : '#10b981' }}>
                    {result.totalTariffRate.toFixed(1)}%
                  </span>
                </div>
              </div>

              <div className="tc-result-card glass-card">
                <div className="tc-section-title">Landed Cost Estimate</div>
                <div className="tc-cost-row">
                  <span className="tc-cost-label">Cargo Value</span>
                  <span className="tc-cost-val">{fmt(result.value)}</span>
                </div>
                <div className="tc-cost-row">
                  <span className="tc-cost-label">Duty Amount ({result.totalTariffRate.toFixed(1)}%)</span>
                  <span className="tc-cost-val" style={{ color: '#ef4444' }}>+{fmt(result.dutyAmount)}</span>
                </div>
                <div className="tc-cost-row">
                  <span className="tc-cost-label">Est. Freight ({freightMode === 'air' ? 'Air' : 'Ocean'})</span>
                  <span className="tc-cost-val" style={{ color: '#60a5fa' }}>+{fmt(result.freightCost)}</span>
                </div>
                <div className="tc-cost-total">
                  <span>Total Landed Cost</span>
                  <span>{fmt(result.totalLandedCost)}</span>
                </div>
                <div className="tc-cost-note">
                  <RiInformationLine size={11} style={{ marginRight: 4, verticalAlign: 'middle' }} />
                  Duty-to-value ratio: {result.effectiveRate.toFixed(1)}% · Estimates only
                </div>
              </div>

              {/* Flexport angle */}
              <div className="tc-tip glass-card">
                <div className="tc-section-title">Flexport SDR Angle</div>
                {result.totalTariffRate >= 30 ? (
                  <p className="tc-tip-text">High tariff exposure ({result.totalTariffRate}%) from {origin}. Position Flexport's bonded warehousing, FTZ partnerships, and first-sale valuation to reduce duty basis. Duty deferral and origin diversification analysis are strong hooks.</p>
                ) : result.addlRate > 0 ? (
                  <p className="tc-tip-text">Reciprocal tariff of {result.addlRate}% from {origin} is a fresh pain point. Flexport's tariff intelligence alerts and multi-origin routing can help this prospect stay ahead of escalation.</p>
                ) : (
                  <p className="tc-tip-text">Moderate tariff profile from {origin}. Lead with Flexport's transit time advantages and real-time visibility — cost savings through efficiency are the primary angle here.</p>
                )}
              </div>
            </>
          ) : (
            <div className="tc-empty glass-card">
              <RiPercentLine size={40} style={{ color: '#1e2d4a', marginBottom: 16 }} />
              <p>Configure shipment parameters and click Calculate to model tariff impact and landed cost.</p>
            </div>
          )}

          {/* Rate reference table */}
          <div className="tc-ref glass-card">
            <div className="tc-section-title">Key Rate Reference — China Origin</div>
            <table className="tc-table">
              <thead>
                <tr><th>HS</th><th>Category</th><th>Base</th><th>§301</th><th>Total</th></tr>
              </thead>
              <tbody>
                {CATEGORIES.slice(0, 10).map(c => (
                  <tr key={c.hs}>
                    <td className="tc-mono">{c.hs}</td>
                    <td>{c.label}</td>
                    <td className="tc-mono">{c.base}%</td>
                    <td className="tc-mono" style={{ color: c.section301 > 0 ? '#ef4444' : '#475569' }}>{c.section301 > 0 ? `+${c.section301}%` : '—'}</td>
                    <td className="tc-mono" style={{ color: (c.base + c.section301) > 20 ? '#ef4444' : (c.base + c.section301) > 10 ? '#f59e0b' : '#10b981' }}>
                      {c.base + c.section301}%
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="tc-note">§301 = Section 301 China surcharge · Rates as of 2025 · Subject to change</div>
          </div>
        </div>
      </div>
    </div>
  );
}
