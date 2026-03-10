import { useState, useEffect } from 'react';
import { Routes, Route, useNavigate } from 'react-router-dom';
import PortStatusBar from './components/PortStatusBar';
import Sidebar from './components/Sidebar';
import HomePage from './pages/HomePage';
import TradePage from './pages/TradePage';
import Account360Page from './pages/Account360Page';
import PerformancePage from './pages/PerformancePage';
import MarketMapPage from './pages/MarketMapPage';
import TariffCalculatorPage from './pages/TariffCalculatorPage';
import ResearchPage from './pages/ResearchPage';
import VesselsPage from './pages/VesselsPage';
import SettingsPage from './pages/SettingsPage';
import OutreachSequenceModal from './components/OutreachSequenceModal';
import BattleCardsModal from './components/BattleCardsModal';
import PipelineKanban from './components/PipelineKanban';
import LiveCallModal from './components/LiveCallModal';
import EmailComposerModal from './components/EmailComposerModal';
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
  const navigate = useNavigate();
  const [sidebarCollapsed, setSidebarCollapsed] = useState(
    () => (localStorage.getItem('sdr_ui_sidebar_default') || 'collapsed') === 'collapsed'
  );
  const [showPipeline, setShowPipeline] = useState(false);
  const [showBattleCards, setShowBattleCards] = useState(false);
  const [outreachState, setOutreachState] = useState({ open: false, prospect: null, analysis: null });
  const [pipelineRefresh, setPipelineRefresh] = useState(0);
  const [globeFullscreen, setGlobeFullscreen] = useState(false);
  const [liveCallState, setLiveCallState] = useState({ open: false, prospect: null });
  const [lastCallData, setLastCallData] = useState(null);
  const [emailState, setEmailState] = useState({ open: false, prospect: null, trigger: '' });

  // Apply accent color + density from settings on mount and on cross-tab storage changes
  useEffect(() => {
    function applyAppearance() {
      const accent = localStorage.getItem('sdr_ui_accent') || '#00d4ff';
      const r = parseInt(accent.slice(1, 3), 16) || 0;
      const g = parseInt(accent.slice(3, 5), 16) || 212;
      const b = parseInt(accent.slice(5, 7), 16) || 255;
      document.documentElement.style.setProperty('--accent', accent);
      document.documentElement.style.setProperty('--accent-rgb', `${r}, ${g}, ${b}`);
      const density = localStorage.getItem('sdr_ui_density') || 'normal';
      document.documentElement.setAttribute('data-density', density);
    }
    applyAppearance();
    const handler = (e) => {
      if (e?.key === 'sdr_ui_accent' || e?.key === 'sdr_ui_density') applyAppearance();
      if (e?.key === 'sdr_ui_sidebar_default') setSidebarCollapsed(e.newValue === 'collapsed');
    };
    window.addEventListener('storage', handler);
    return () => window.removeEventListener('storage', handler);
  }, []);

  const handleAddToPipeline = () => { setPipelineRefresh(r => r + 1); setShowPipeline(true); };
  const handleOpenOutreach = (prospect, analysis) => setOutreachState({ open: true, prospect, analysis });
  const handleStartLiveCall = (prospect = null) => setLiveCallState({ open: true, prospect });
  const handleEndCall = (callData) => setLastCallData(callData);
  const handleOpenEmailComposer = (prospect = null, trigger = '') =>
    setEmailState({ open: true, prospect, trigger });

  // Global keyboard shortcuts
  useEffect(() => {
    const onKey = (e) => {
      // Ignore when typing in an input/textarea/select
      if (['INPUT', 'TEXTAREA', 'SELECT'].includes(e.target.tagName)) return;

      // Ctrl+/ — Toggle sidebar
      if (e.ctrlKey && !e.shiftKey && e.key === '/') {
        e.preventDefault();
        setSidebarCollapsed(c => !c);
        return;
      }

      // Ctrl+Shift+P — Open Pipeline
      if (e.ctrlKey && e.shiftKey && e.key === 'P') {
        e.preventDefault();
        setShowPipeline(p => { if (!p) setPipelineRefresh(r => r + 1); return true; });
        return;
      }

      // Ctrl+Shift+B — Open Battle Cards
      if (e.ctrlKey && e.shiftKey && e.key === 'B') {
        e.preventDefault();
        setShowBattleCards(true);
        return;
      }

      // Ctrl+Shift+L — Open Live Call
      if (e.ctrlKey && e.shiftKey && e.key === 'L') {
        e.preventDefault();
        setLiveCallState(s => s.open ? s : { open: true, prospect: null });
        return;
      }

      // Ctrl+Shift+E — Toggle Email Composer
      if (e.ctrlKey && e.shiftKey && e.key === 'E') {
        e.preventDefault();
        setEmailState(s => s.open ? { open: false, prospect: null, trigger: '' } : { open: true, prospect: null, trigger: '' });
        return;
      }

      // Escape — close topmost open modal/overlay
      if (e.key === 'Escape') {
        if (emailState.open) { setEmailState({ open: false, prospect: null, trigger: '' }); return; }
        if (liveCallState.open) { setLiveCallState({ open: false, prospect: null }); return; }
        if (outreachState.open) { setOutreachState({ open: false, prospect: null, analysis: null }); return; }
        if (showBattleCards)   { setShowBattleCards(false); return; }
        if (showPipeline)      { setShowPipeline(false); setPipelineRefresh(r => r + 1); return; }
        if (globeFullscreen)   { setGlobeFullscreen(false); return; }
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [emailState.open, liveCallState.open, outreachState.open, showBattleCards, showPipeline, globeFullscreen]);

  return (
    <div className="app-root">
      <Particles />

      <PortStatusBar
        onPipelineClick={() => setShowPipeline(true)}
        onBattleCardsClick={() => setShowBattleCards(true)}
        onMenuToggle={() => setSidebarCollapsed(c => !c)}
        onLiveCallClick={() => handleStartLiveCall(null)}
        pipelineRefresh={pipelineRefresh}
      />

      <div className="app-body">
        <Sidebar collapsed={sidebarCollapsed} />

        <main className="app-content">
          <Routes>
            <Route path="/" element={
              <HomePage
                onAddToPipeline={handleAddToPipeline}
                onOpenOutreach={handleOpenOutreach}
                globeFullscreen={globeFullscreen}
                onEnterFullscreen={() => setGlobeFullscreen(true)}
                onStartLiveCall={handleStartLiveCall}
                onOpenEmailComposer={handleOpenEmailComposer}
              />
            } />
            <Route path="/vessels" element={<VesselsPage />} />
            <Route path="/trade" element={<TradePage />} />
            <Route path="/account/:id" element={
              <Account360Page
                onAddToPipeline={handleAddToPipeline}
                onOpenOutreach={handleOpenOutreach}
                onStartLiveCall={handleStartLiveCall}
                lastCallData={lastCallData}
                onOpenEmailComposer={handleOpenEmailComposer}
              />
            } />
            <Route path="/performance" element={<PerformancePage />} />
            <Route path="/market" element={<MarketMapPage />} />
            <Route path="/tariff" element={<TariffCalculatorPage />} />
            <Route path="/research" element={<ResearchPage />} />
            <Route path="/settings" element={<SettingsPage />} />
          </Routes>
        </main>
      </div>

      <PipelineKanban isOpen={showPipeline} onClose={() => { setShowPipeline(false); setPipelineRefresh(r => r + 1); }} refreshTrigger={pipelineRefresh} />

      <OutreachSequenceModal
        isOpen={outreachState.open}
        prospect={outreachState.prospect}
        analysis={outreachState.analysis}
        onClose={() => setOutreachState({ open: false, prospect: null, analysis: null })}
      />
      <BattleCardsModal isOpen={showBattleCards} onClose={() => setShowBattleCards(false)} />

      <LiveCallModal
        isOpen={liveCallState.open}
        initialProspect={liveCallState.prospect}
        onClose={() => setLiveCallState({ open: false, prospect: null })}
        onAddToPipeline={handleAddToPipeline}
        onOpenOutreach={handleOpenOutreach}
        onEndCall={handleEndCall}
      />

      <EmailComposerModal
        isOpen={emailState.open}
        initialProspect={emailState.prospect}
        initialTrigger={emailState.trigger}
        onClose={() => setEmailState({ open: false, prospect: null, trigger: '' })}
      />

      {globeFullscreen && (
        <button className="globe-close-btn" onClick={() => setGlobeFullscreen(false)} aria-label="Exit fullscreen">✕</button>
      )}
    </div>
  );
}
