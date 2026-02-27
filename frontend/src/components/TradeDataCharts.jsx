// frontend/src/components/TradeDataCharts.jsx
import { useState, useEffect } from 'react';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import './TradeDataCharts.css';

const API = import.meta.env.VITE_API_URL || 'http://localhost:5000';

const COMMODITIES = [
  { key: 'electronics', label: 'Electronics' },
  { key: 'apparel', label: 'Apparel/Consumer Goods' },
  { key: 'trade_balance', label: 'Trade Balance' },
  { key: 'total_imports', label: 'Total Imports' }
];

export default function TradeDataCharts() {
  const [active, setActive] = useState('electronics');
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setLoading(true);
    fetch(`${API}/api/trade-data/${active}`)
      .then(r => r.json())
      .then(d => {
        const obs = d.observations || [];
        const chartData = obs
          .filter(o => o.value !== '.')
          .slice(0, 12)
          .reverse()
          .map(o => ({ date: o.date?.substring(0, 7), value: parseFloat(o.value) }));
        setData(chartData);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [active]);

  const CustomTooltip = ({ active: a, payload, label }) => {
    if (!a || !payload?.length) return null;
    return (
      <div className="chart-tooltip">
        <p className="tooltip-date">{label}</p>
        <p className="tooltip-value">${payload[0].value?.toLocaleString()}B</p>
      </div>
    );
  };

  return (
    <div className="trade-charts">
      <div className="chart-header">
        <h3>US Trade Data <span className="chart-source">FRED</span></h3>
        <div className="chart-tabs">
          {COMMODITIES.map(c => (
            <button key={c.key} className={`chart-tab ${active === c.key ? 'active' : ''}`} onClick={() => setActive(c.key)}>
              {c.label}
            </button>
          ))}
        </div>
      </div>

      {loading ? <div className="chart-loading">Loading FRED data...</div> : (
        <ResponsiveContainer width="100%" height={160}>
          <LineChart data={data} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
            <XAxis dataKey="date" tick={{ fill: '#475569', fontSize: 10 }} tickLine={false} />
            <YAxis tick={{ fill: '#475569', fontSize: 10 }} tickLine={false} axisLine={false} />
            <Tooltip content={<CustomTooltip />} />
            <Line type="monotone" dataKey="value" stroke="#00d4ff" strokeWidth={2} dot={false} />
          </LineChart>
        </ResponsiveContainer>
      )}
    </div>
  );
}
