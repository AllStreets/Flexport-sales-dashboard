// frontend/src/pages/HomePage.jsx
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import GlobeView from '../components/GlobeView';
import ProspectSearch from '../components/ProspectSearch';
import AnalysisPanel from '../components/AnalysisPanel';
import SignalFeed from '../components/SignalFeed';
import TradeDataCharts from '../components/TradeDataCharts';
import TariffCalculator from '../components/TariffCalculator';
import SignalTicker from '../components/SignalTicker';
import './HomePage.css';

const API = import.meta.env.VITE_API_URL || 'http://localhost:5000';

const STAGE_META = {
  new:         { label: 'New',        color: '#2563eb' },
  researched:  { label: 'Researched', color: '#6366f1' },
  called:      { label: 'Called',     color: '#8b5cf6' },
  demo_booked: { label: 'Demo',       color: '#10b981' },
  closed_won:  { label: 'Won',        color: '#f59e0b' },
  closed_lost: { label: 'Lost',       color: '#475569' },
};

const fmtVal = n => {
  if (!n) return '$0';
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000)    return `$${(n / 1_000).toFixed(0)}K`;
  return `$${n}`;
};

const icpColor = s => s >= 85 ? '#10b981' : s >= 70 ? '#f59e0b' : '#ef4444';

// ── KPI Strip ─────────────────────────────────────────────────────────────────
function KPIStrip({ perf }) {
  const kpis = perf?.kpis;
  const tiles = [
    { label: 'CALLS THIS WEEK',   value: kpis?.callsThisWeek  ?? '—', color: '#00d4ff' },
    { label: 'EMAILS THIS WEEK',  value: kpis?.emailsThisWeek ?? '—', color: '#a78bfa' },
    { label: 'DEMOS BOOKED',      value: kpis?.demosBooked    ?? '—', color: '#10b981' },
    { label: 'PIPELINE VALUE',    value: fmtVal(kpis?.pipelineValue), color: '#f59e0b' },
  ];
  return (
    <div className="kpi-strip">
      {tiles.map(t => (
        <div key={t.label} className="kpi-tile">
          <div className="kpi-label">{t.label}</div>
          <div className="kpi-value" style={{ color: t.color }}>{t.value}</div>
        </div>
      ))}
    </div>
  );
}

// ── Top Prospects ─────────────────────────────────────────────────────────────
function TopProspects({ onSelect, selectedId }) {
  const [prospects, setProspects] = useState([]);
  const navigate = useNavigate();

  useEffect(() => {
    fetch(`${API}/api/prospects`)
      .then(r => r.json())
      .then(data => {
        const sorted = [...(Array.isArray(data) ? data : [])]
          .sort((a, b) => (b.icp_score || 0) - (a.icp_score || 0))
          .slice(0, 6);
        setProspects(sorted);
      })
      .catch(() => {});
  }, []);

  if (!prospects.length) return null;

  return (
    <div className="top-prospects">
      <div className="tp-header">
        <span className="tp-title">Top Prospects</span>
        <span className="tp-sub">by ICP score</span>
      </div>
      {prospects.map(p => (
        <div
          key={p.id}
          className={`tp-row${selectedId === p.id ? ' tp-row--active' : ''}`}
          onClick={() => onSelect(p)}
        >
          <div className="tp-left">
            <span className="tp-name">{p.name}</span>
            <span className="tp-sector">{p.sector}</span>
          </div>
          <div className="tp-right">
            <span
              className="tp-stage"
              style={{ color: STAGE_META[p.pipeline_stage]?.color || '#475569' }}
            >
              {STAGE_META[p.pipeline_stage]?.label || p.pipeline_stage || 'New'}
            </span>
            <span className="tp-icp" style={{ color: icpColor(p.icp_score) }}>
              {p.icp_score}
            </span>
            <button
              className="tp-profile-btn"
              onClick={e => { e.stopPropagation(); navigate(`/account/${p.id}`); }}
              title="View profile"
            >→</button>
          </div>
        </div>
      ))}
    </div>
  );
}

// ── Pipeline by Stage ─────────────────────────────────────────────────────────
function PipelineStages({ perf }) {
  const byStage = perf?.pipeline?.byStage || {};
  const total = Object.values(byStage).reduce((s, v) => s + v, 0) || 1;
  const stages = Object.entries(STAGE_META).map(([key, meta]) => ({
    key, ...meta, count: byStage[key] || 0,
  })).filter(s => s.count > 0);

  return (
    <div className="pipeline-stages">
      <div className="ps-header">
        <span className="ps-title">Pipeline by Stage</span>
        <span className="ps-total">{perf?.pipeline?.totalProspects ?? 0} total</span>
      </div>
      <div className="ps-bars">
        {stages.map(s => (
          <div key={s.key} className="ps-row">
            <span className="ps-label">{s.label}</span>
            <div className="ps-bar-wrap">
              <div
                className="ps-bar"
                style={{ width: `${(s.count / total) * 100}%`, background: s.color }}
              />
            </div>
            <span className="ps-count" style={{ color: s.color }}>{s.count}</span>
          </div>
        ))}
      </div>
      <div className="ps-funnel">
        <span className="ps-funnel-item">
          <span className="ps-funnel-num" style={{ color: '#10b981' }}>
            {byStage.demo_booked || 0}
          </span> demos
        </span>
        <span className="ps-funnel-sep">·</span>
        <span className="ps-funnel-item">
          <span className="ps-funnel-num" style={{ color: '#f59e0b' }}>
            {byStage.closed_won || 0}
          </span> won
        </span>
        <span className="ps-funnel-sep">·</span>
        <span className="ps-funnel-item">
          <span className="ps-funnel-num" style={{ color: '#475569' }}>
            {byStage.closed_lost || 0}
          </span> lost
        </span>
      </div>
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function HomePage({ onAddToPipeline, onOpenOutreach, globeFullscreen, onEnterFullscreen }) {
  const [selectedProspect, setSelectedProspect] = useState(null);
  const [perf, setPerf] = useState(null);
  const navigate = useNavigate();

  useEffect(() => {
    fetch(`${API}/api/performance`)
      .then(r => r.json())
      .then(setPerf)
      .catch(() => {});
  }, []);

  return (
    <div className="home-page">
      <SignalTicker />

      <section className="globe-section">
        <GlobeView
          selectedProspect={selectedProspect}
          fullscreen={globeFullscreen}
          onEnterFullscreen={onEnterFullscreen}
        />
      </section>

      {/* KPI strip */}
      <KPIStrip perf={perf} />

      {/* Two-column content */}
      <div className="content-columns">
        {/* Left column */}
        <div className="left-column">
          <TopProspects onSelect={setSelectedProspect} selectedId={selectedProspect?.id} />

          <div className="glass-card col-section">
            <h2 className="section-title">Prospect Intelligence</h2>
            <ProspectSearch onSelect={setSelectedProspect} />
          </div>

          {selectedProspect && (
            <div className="glass-card col-section">
              <AnalysisPanel
                key={selectedProspect?.id}
                prospect={selectedProspect}
                onOpenOutreach={onOpenOutreach}
                onAddToPipeline={onAddToPipeline}
                onViewProfile={() => navigate(`/account/${selectedProspect.id}`)}
              />
            </div>
          )}

          {selectedProspect && (
            <TariffCalculator prospectSector={selectedProspect.sector} />
          )}
        </div>

        {/* Right column */}
        <div className="right-column">
          <div className="glass-card col-section">
            <SignalFeed onOpenOutreach={onOpenOutreach} selectedProspect={selectedProspect} />
          </div>
          <TradeDataCharts />
          <PipelineStages perf={perf} />
        </div>
      </div>
    </div>
  );
}
