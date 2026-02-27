// frontend/src/components/ProspectSearch.jsx
import { useState, useEffect, useCallback } from 'react';
import ICPBadge from './ICPBadge';
import './ProspectSearch.css';

const API = import.meta.env.VITE_API_URL || 'http://localhost:5000';

export default function ProspectSearch({ onSelect }) {
  const [prospects, setProspects] = useState([]);
  const [sectors, setSectors] = useState([]);
  const [filters, setFilters] = useState({ search: '', sector: '', icp_min: '' });
  const [loading, setLoading] = useState(false);

  const fetchProspects = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams(Object.entries(filters).filter(([,v]) => v));
    try {
      const r = await fetch(`${API}/api/prospects?${params}&limit=50`);
      setProspects(await r.json());
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  }, [filters]);

  useEffect(() => {
    fetch(`${API}/api/prospects/sectors`).then(r => r.json()).then(setSectors).catch(console.error);
  }, []);

  useEffect(() => { fetchProspects(); }, [fetchProspects]);

  return (
    <div className="prospect-search">
      <div className="search-controls">
        <input
          className="search-input"
          placeholder="Search prospects..."
          value={filters.search}
          onChange={e => setFilters(f => ({ ...f, search: e.target.value }))}
        />
        <select className="filter-select" value={filters.sector} onChange={e => setFilters(f => ({ ...f, sector: e.target.value }))}>
          <option value="">All Sectors</option>
          {sectors.map(s => <option key={s.sector} value={s.sector}>{s.sector} ({s.count})</option>)}
        </select>
        <select className="filter-select" value={filters.icp_min} onChange={e => setFilters(f => ({ ...f, icp_min: e.target.value }))}>
          <option value="">Any ICP</option>
          <option value="90">90+ (Elite)</option>
          <option value="80">80+ (Strong)</option>
          <option value="70">70+ (Good)</option>
        </select>
      </div>

      {loading && <div className="loading-row">Loading prospects...</div>}

      <div className="prospect-list">
        {prospects.map((p, i) => (
          <div key={p.id} className="prospect-row" style={{ animationDelay: `${i * 40}ms` }} onClick={() => onSelect(p)}>
            <div className="prospect-row-left">
              <span className="prospect-name">{p.name}</span>
              <span className="prospect-meta">{p.sector} · {p.hq_location}</span>
            </div>
            <div className="prospect-row-right">
              <ICPBadge score={p.icp_score} />
              <span className="prospect-volume" title="Shipping volume estimate">{p.shipping_volume_estimate}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
