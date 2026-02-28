import { useState } from 'react';
import PortStatusBar from './components/PortStatusBar';
import GlobeView from './components/GlobeView';
import ProspectSearch from './components/ProspectSearch';
import AnalysisPanel from './components/AnalysisPanel';
import SignalFeed from './components/SignalFeed';
import TradeDataCharts from './components/TradeDataCharts';
import TariffCalculator from './components/TariffCalculator';
import PipelineKanban from './components/PipelineKanban';
import OutreachSequenceModal from './components/OutreachSequenceModal';
import BattleCardsModal from './components/BattleCardsModal';
import './App.css';

// Generate particle field
function Particles() {
  const particles = Array.from({ length: 80 }, (_, i) => ({
    id: i,
    left: `${Math.random() * 100}%`,
    top: `${Math.random() * 100}%`,
    size: Math.random() * 3 + 1,
    dur: `${Math.random() * 30 + 20}s`,
    delay: `${Math.random() * -30}s`,
    tx: `${(Math.random() - 0.5) * 80}px`,
    ty: `${(Math.random() - 0.5) * 80}px`,
  }));
  return (
    <div className="particle-field" aria-hidden>
      {particles.map(p => (
        <div key={p.id} className="particle" style={{
          left: p.left, top: p.top,
          width: p.size, height: p.size,
          '--dur': p.dur, '--delay': p.delay,
          '--tx': p.tx, '--ty': p.ty
        }} />
      ))}
    </div>
  );
}

export default function App() {
  const [selectedProspect, setSelectedProspect] = useState(null);
  const [showPipeline, setShowPipeline] = useState(false);
  const [showBattleCards, setShowBattleCards] = useState(false);
  const [outreachState, setOutreachState] = useState({ open: false, prospect: null, analysis: null });
  const [portDetail, setPortDetail] = useState(null);
  const [globeFullscreen, setGlobeFullscreen] = useState(false);
  const [pipelineRefresh, setPipelineRefresh] = useState(0);

  const handlePortClick = (port) => setPortDetail(port);
  const handleAddToPipeline = () => { setPipelineRefresh(r => r + 1); setShowPipeline(true); };
  const closePortDetail = () => setPortDetail(null);

  return (
    <div className="app-root">
      <Particles />

      <PortStatusBar
        onPipelineClick={() => setShowPipeline(true)}
        onBattleCardsClick={() => setShowBattleCards(true)}
      />

      <main className="app-main">
        {/* Globe hero */}
        <section className="globe-section">
          <GlobeView
            selectedProspect={selectedProspect}
            onPortClick={handlePortClick}
            fullscreen={globeFullscreen}
            onEnterFullscreen={() => setGlobeFullscreen(true)}
          />
          {portDetail && (
            <div className="port-detail-popup glass-card" onClick={closePortDetail}>
              <strong>{portDetail.name}</strong>
              <span>Status: {portDetail.status} · Congestion {portDetail.congestion}/10</span>
              <span className="popup-close">✕</span>
            </div>
          )}
        </section>

        {/* Two-column below globe */}
        <div className="content-columns">
          {/* Left column — Prospect Intelligence */}
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
                  onOpenOutreach={(prospect, analysis) =>
                    setOutreachState({ open: true, prospect, analysis })
                  }
                  onAddToPipeline={handleAddToPipeline}
                />
              </div>
            )}

            {selectedProspect && (
              <TariffCalculator prospectSector={selectedProspect.sector} />
            )}
          </div>

          {/* Right column — Signals + Trade Data */}
          <div className="right-column">
            <div className="glass-card col-section">
              <SignalFeed />
            </div>
            <TradeDataCharts />
          </div>
        </div>
      </main>

      {/* Pipeline Kanban */}
      <PipelineKanban isOpen={showPipeline} onClose={() => setShowPipeline(false)} refreshTrigger={pipelineRefresh} />

      {/* Modals */}
      <OutreachSequenceModal
        isOpen={outreachState.open}
        prospect={outreachState.prospect}
        analysis={outreachState.analysis}
        onClose={() => setOutreachState({ open: false, prospect: null, analysis: null })}
      />
      <BattleCardsModal isOpen={showBattleCards} onClose={() => setShowBattleCards(false)} />

      {globeFullscreen && (
        <button className="globe-close-btn" onClick={() => setGlobeFullscreen(false)} aria-label="Exit fullscreen">✕</button>
      )}
    </div>
  );
}
