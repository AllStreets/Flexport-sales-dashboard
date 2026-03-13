// frontend/src/components/ProspectSearch.jsx
import { useState, useEffect, useCallback } from 'react';
import { RiSparklingLine } from 'react-icons/ri';
import ICPBadge from './ICPBadge';
import './ProspectSearch.css';

const API = import.meta.env.VITE_API_URL || 'http://localhost:5001';

export default function ProspectSearch({ onSelect }) {
  const [prospects, setProspects] = useState([]);
  const [sectors, setSectors] = useState([]);
  const [filters, setFilters] = useState({ search: '', sector: '', icp_min: '' });
  const [loading, setLoading] = useState(false);
  const [aiMode, setAiMode] = useState(false);
  const [aiQuery, setAiQuery] = useState('');
  const [aiFilters, setAiFilters] = useState(null);
  const [aiLoading, setAiLoading] = useState(false);

  const fetchProspects = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams(Object.entries(filters).filter(([,v]) => v));
    try {
      const r = await fetch(`${API}/api/prospects?${params}&limit=50`);
      const json = await r.json();
      setProspects(Array.isArray(json) ? json : []);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  }, [filters]);

  useEffect(() => {
    fetch(`${API}/api/prospects/sectors`).then(r => r.json()).then(setSectors).catch(console.error);
  }, []);

  useEffect(() => { if (!aiMode) fetchProspects(); }, [fetchProspects, aiMode]);

  const runAiSearch = async () => {
    if (!aiQuery.trim()) return;
    setAiLoading(true);
    setAiFilters(null);
    try {
      const r = await fetch(`${API}/api/semantic-search`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: aiQuery }),
      });
      const data = await r.json();
      setAiFilters(data.filters);
      setProspects(Array.isArray(data.results) ? data.results : []);
    } catch { }
    finally { setAiLoading(false); }
  };

  return (
    <div className="prospect-search">
      <div className="ps-mode-row">
        <button className={`ps-mode-btn${!aiMode ? ' active' : ''}`} onClick={() => setAiMode(false)}>Search</button>
        <button className={`ps-mode-btn${aiMode ? ' active' : ''}`} onClick={() => setAiMode(true)}>
          <RiSparklingLine size={11} style={{ marginRight: 4 }} />AI Search
        </button>
      </div>

      {aiMode ? (
        <div className="ai-search-wrap">
          <div className="ai-search-row">
            <input
              className="search-input ai-search-input"
              placeholder="e.g. Electronics importers from Asia with high ICP..."
              value={aiQuery}
              onChange={e => setAiQuery(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && runAiSearch()}
            />
            <button className="ai-search-btn" onClick={runAiSearch} disabled={aiLoading || !aiQuery.trim()}>
              {aiLoading ? '...' : <RiSparklingLine size={13} />}
            </button>
          </div>
          {aiFilters && (
            <div className="ai-filters-row">
              {aiFilters.sector && <span className="ai-filter-chip">Sector: {aiFilters.sector}</span>}
              {aiFilters.icp_min && <span className="ai-filter-chip">ICP {aiFilters.icp_min}+</span>}
              {aiFilters.volume && <span className="ai-filter-chip">Volume: {aiFilters.volume}</span>}
              {aiFilters.import_origins_keyword && <span className="ai-filter-chip">Origin: {aiFilters.import_origins_keyword}</span>}
              {aiFilters.lanes_keyword && <span className="ai-filter-chip">Lane: {aiFilters.lanes_keyword}</span>}
              {aiFilters.location_keyword && <span className="ai-filter-chip">HQ: {aiFilters.location_keyword}</span>}
              {aiFilters.description_keywords?.map(kw => <span key={kw} className="ai-filter-chip">"{kw}"</span>)}
            </div>
          )}
        </div>
      ) : (
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
      )}

      {(loading || aiLoading) && <div className="loading-row">{aiLoading ? 'AI searching...' : 'Loading prospects...'}</div>}

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
