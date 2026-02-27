// frontend/src/components/TariffCalculator.jsx
import { useState } from 'react';
import './TariffCalculator.css';

const TARIFF_RATES = {
  electronics: { rate: 0.255, sector_name: 'Electronics (Section 301)' },
  apparel: { rate: 0.12, sector_name: 'Apparel (standard)' },
  furniture: { rate: 0.18, sector_name: 'Furniture (Section 301 elevated)' },
  'e-commerce': { rate: 0.15, sector_name: 'General DTC goods' },
  CPG: { rate: 0.08, sector_name: 'Consumer packaged goods' },
  default: { rate: 0.15, sector_name: 'General imported goods' }
};

const FLEXPORT_SAVINGS_RATE = 0.25; // 25% duty cost reduction via bonded warehouse + deferral

export default function TariffCalculator({ prospectSector }) {
  const [importVolume, setImportVolume] = useState(2000000);
  const [shipmentFreq, setShipmentFreq] = useState(24);

  const tariffInfo = TARIFF_RATES[prospectSector] || TARIFF_RATES.default;
  const annualDuty = importVolume * tariffInfo.rate;
  const flexportSavings = annualDuty * FLEXPORT_SAVINGS_RATE;
  const perShipment = annualDuty / shipmentFreq;

  const fmt = (n) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(n);

  return (
    <div className="tariff-calc">
      <h3>ROI Calculator</h3>
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
          <span className="stat-label">Est. Annual Duty ({(tariffInfo.rate * 100).toFixed(0)}% {tariffInfo.sector_name})</span>
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
        "At {fmt(importVolume)} in annual imports, {prospectSector ? `your ${prospectSector} business` : 'your business'} likely pays {fmt(annualDuty)}/year in duties. Flexport's bonded warehouse and duty deferral program could save you {fmt(flexportSavings)} annually."
      </p>
    </div>
  );
}
