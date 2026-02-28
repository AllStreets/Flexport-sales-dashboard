// frontend/src/pages/HomePage.jsx
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import GlobeView from '../components/GlobeView';
import ProspectSearch from '../components/ProspectSearch';
import AnalysisPanel from '../components/AnalysisPanel';
import SignalFeed from '../components/SignalFeed';
import TradeDataCharts from '../components/TradeDataCharts';
import TariffCalculator from '../components/TariffCalculator';
import SignalTicker from '../components/SignalTicker';
import './HomePage.css';

export default function HomePage({ onAddToPipeline, onOpenOutreach, globeFullscreen, onEnterFullscreen }) {
  const [selectedProspect, setSelectedProspect] = useState(null);
  const navigate = useNavigate();

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
        </div>
      </div>
    </div>
  );
}
