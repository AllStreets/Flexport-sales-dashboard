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

const STAGE_COLORS = {
  new: '#2563eb', researched: '#6366f1', called: '#8b5cf6',
  demo_booked: '#10b981', closed_won: '#f59e0b', closed_lost: '#475569',
};

export default function HomePage({ onAddToPipeline, onOpenOutreach, globeFullscreen, onEnterFullscreen }) {
  const [selectedProspect, setSelectedProspect] = useState(null);
  const [hotProspects, setHotProspects] = useState([]);
  const navigate = useNavigate();

  useEffect(() => {
    fetch(`${API}/api/hot-prospects`)
      .then(r => r.json())
      .then(d => setHotProspects(Array.isArray(d) ? d : []))
      .catch(() => {});
  }, []);

  return (
    <div className="home-page">
      <SignalTicker />

      {/* Globe hero — port detail popup now lives inside GlobeView */}
      <section className="globe-section">
        <GlobeView
          selectedProspect={selectedProspect}
          fullscreen={globeFullscreen}
          onEnterFullscreen={onEnterFullscreen}
        />
      </section>

      {/* Two-column below globe */}
      <div className="content-columns">
        {/* Left column */}
        <div className="left-column">
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

          {hotProspects.length > 0 && (
            <div className="glass-card col-section hp-panel">
              <h2 className="section-title">Hot Prospects</h2>
              <div className="hp-list">
                {hotProspects.map((p, i) => (
                  <div key={p.id} className="hp-row" style={{ animationDelay: `${i * 50}ms` }} onClick={() => navigate(`/account/${p.id}`)}>
                    <div className="hp-rank">{i + 1}</div>
                    <div className="hp-info">
                      <span className="hp-name">{p.name}</span>
                      <span className="hp-meta">{p.sector} · {p.hq_location}</span>
                    </div>
                    <div className="hp-right">
                      <span className="hp-score">{p.opp_score}</span>
                      {p.pipeline_stage && (
                        <span className="hp-stage" style={{ background: `${STAGE_COLORS[p.pipeline_stage] || '#2563eb'}22`, color: STAGE_COLORS[p.pipeline_stage] || '#2563eb', borderColor: `${STAGE_COLORS[p.pipeline_stage] || '#2563eb'}44` }}>
                          {p.pipeline_stage.replace('_', ' ')}
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
