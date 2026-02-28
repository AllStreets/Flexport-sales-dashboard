// frontend/src/components/TariffCalculator.jsx
import { useState } from 'react';
import './TariffCalculator.css';

const API = import.meta.env.VITE_API_URL || 'http://localhost:5000';

const TARIFF_RATES = {
  electronics: { rate: 0.255, sector_name: 'Electronics (Section 301)' },
  apparel:     { rate: 0.12,  sector_name: 'Apparel (standard)' },
  furniture:   { rate: 0.18,  sector_name: 'Furniture (Section 301 elevated)' },
  'e-commerce':{ rate: 0.15,  sector_name: 'General DTC goods' },
  CPG:         { rate: 0.08,  sector_name: 'Consumer packaged goods' },
  default:     { rate: 0.15,  sector_name: 'General imported goods' }
};

const FLEXPORT_SAVINGS_RATE = 0.25;
const fmt = n => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(n);

export default function TariffCalculator({ prospectSector }) {
  const [importVolume, setImportVolume] = useState(2000000);
  const [shipmentFreq, setShipmentFreq] = useState(24);
  const [hsQuery, setHsQuery] = useState('');
  const [hsResults, setHsResults] = useState([]);
  const [hsSelected, setHsSelected] = useState(null);
  const [hsLoading, setHsLoading] = useState(false);

  const tariffInfo = TARIFF_RATES[prospectSector] || TARIFF_RATES.default;
  const effectiveRate = hsSelected ? (hsSelected.rate + (hsSelected.section301 || 0)) : tariffInfo.rate;
  const annualDuty = importVolume * effectiveRate;
  const flexportSavings = annualDuty * FLEXPORT_SAVINGS_RATE;
  const perShipment = annualDuty / shipmentFreq;

  const lookupHS = async (q) => {
    setHsQuery(q);
    if (q.length < 2) { setHsResults([]); return; }
    setHsLoading(true);
    try {
      const r = await fetch(`${API}/api/hs-lookup?q=${encodeURIComponent(q)}`);
      setHsResults(await r.json());
    } catch { setHsResults([]); }
    finally { setHsLoading(false); }
  };

  return (
    <div className="tariff-calc glass-card col-section">
      <h3>ROI Calculator</h3>

      {/* HS Code lookup */}
      <div className="hs-lookup">
        <label className="hs-label">HS Code or Product</label>
        <div className="hs-input-wrap">
          <input
            className="hs-input"
            placeholder="e.g. 8471 or 'furniture'"
            value={hsQuery}
            onChange={e => lookupHS(e.target.value)}
          />
          {hsLoading && <span className="hs-spinner">⟳</span>}
        </div>
        {hsResults.length > 0 && (
          <div className="hs-results">
            {hsResults.map(r => (
              <button
                key={r.code}
                className={`hs-result-item${hsSelected?.code === r.code ? ' selected' : ''}`}
                onClick={() => { setHsSelected(r); setHsResults([]); setHsQuery(`${r.code} — ${r.desc}`); }}
              >
                <span className="hs-code">{r.code}</span>
                <span className="hs-desc">{r.desc}</span>
                <span className="hs-rate">{((r.rate + (r.section301 || 0)) * 100).toFixed(1)}%</span>
                {r.section301 > 0 && <span className="hs-301">+301</span>}
              </button>
            ))}
          </div>
        )}
        {hsSelected && (
          <div className="hs-selected-info">
            <span className="hs-code">{hsSelected.code}</span>
            <span>{hsSelected.desc}</span>
            <span className="stat-value red">{(hsSelected.rate * 100).toFixed(1)}% base{hsSelected.section301 > 0 ? ` + ${(hsSelected.section301 * 100).toFixed(0)}% §301` : ''}</span>
          </div>
        )}
      </div>

      <div className="calc-inputs">
        <label>
          <span>Annual Import Volume</span>
          <input type="range" min={100000} max={10000000} step={100000} value={importVolume} onChange={e => setImportVolume(+e.target.value)} />
          <span className="calc-value">{fmt(importVolume)}</span>
        </label>
        <label>
          <span>Shipments/Year</span>
          <input type="range" min={4} max={100} step={4} value={shipmentFreq} onChange={e => setShipmentFreq(+e.target.value)} />
          <span className="calc-value">{shipmentFreq}</span>
        </label>
      </div>

      <div className="calc-results">
        <div className="calc-stat">
          <span className="stat-label">
            Est. Annual Duty ({(effectiveRate * 100).toFixed(0)}% — {hsSelected ? hsSelected.desc : tariffInfo.sector_name})
          </span>
          <span className="stat-value red">{fmt(annualDuty)}</span>
        </div>
        <div className="calc-stat">
          <span className="stat-label">Duty per Shipment</span>
          <span className="stat-value">{fmt(perShipment)}</span>
        </div>
        <div className="calc-stat highlight">
          <span className="stat-label">Flexport Duty Deferral Savings</span>
          <span className="stat-value green">{fmt(flexportSavings)}/yr</span>
        </div>
      </div>

      <p className="calc-pitch">
        "At {fmt(importVolume)} in annual imports, your business likely pays {fmt(annualDuty)}/year in duties.
        Flexport's bonded warehouse and duty deferral program could save you {fmt(flexportSavings)} annually."
      </p>
    </div>
  );
}
