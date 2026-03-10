// frontend/src/pages/FlightsPage.jsx
import { useState, useEffect, useRef, Component } from 'react';
import { RiPlaneLine, RiRefreshLine, RiWifiLine } from 'react-icons/ri';

class GlobeErrorBoundary extends Component {
  constructor(props) { super(props); this.state = { error: null }; }
  static getDerivedStateFromError(e) { return { error: e }; }
  componentDidCatch(e) { console.error('FlightsGlobe WebGL error:', e); }
  render() {
    if (this.state.error) {
      return (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', gap: 12, color: '#334155', fontFamily: "'JetBrains Mono', monospace" }}>
          <div style={{ fontSize: 11, letterSpacing: '0.1em' }}>RENDERER ERROR — WEBGL CONTEXT LOST</div>
          <button
            style={{ fontSize: 9, background: 'none', border: '1px solid rgba(245,158,11,0.2)', color: '#f59e0b', padding: '5px 14px', cursor: 'pointer', borderRadius: 4, letterSpacing: '0.08em' }}
            onClick={() => this.setState({ error: null })}
          >RELOAD GLOBE</button>
        </div>
      );
    }
    return this.props.children;
  }
}

class PanelErrorBoundary extends Component {
  constructor(props) { super(props); this.state = { error: null }; }
  static getDerivedStateFromError(e) { return { error: e }; }
  componentDidCatch(e) { console.error('FGPanel error:', e); }
  render() {
    if (this.state.error) return null;
    return this.props.children;
  }
}

import FlightsGlobe from '../components/FlightsGlobe';
import FGPanel from '../components/FGPanel';
import './FlightsPage.css';

const API = import.meta.env.VITE_API_URL || 'http://localhost:5001';

export default function FlightsPage() {
  const [flights, setFlights]           = useState([]);
  const [source, setSource]             = useState('');
  const [loading, setLoading]           = useState(true);
  const [selectedFlight, setSelectedFlight] = useState(null);
  const [focusTarget, setFocusTarget]   = useState(null);
  const [forcedSim, setForcedSim]       = useState(false);
  const forcedSimRef = useRef(false);
  const wrapRef = useRef(null);
  const [dims, setDims] = useState({ w: 0, h: 0 });

  const fetchFlights = () => {
    setLoading(true);
    const qs = forcedSimRef.current ? '?mode=sim' : '';
    fetch(`${API}/api/flights${qs}`)
      .then(r => r.json())
      .then(d => { setFlights(d.flights || []); setSource(d.source); setLoading(false); })
      .catch(() => setLoading(false));
  };

  const toggleMode = () => {
    forcedSimRef.current = !forcedSimRef.current;
    setForcedSim(forcedSimRef.current);
    fetchFlights();
  };

  const handleFeedFlightClick = (flight) => {
    setSelectedFlight(flight);
    setFocusTarget({ lat: flight.lat, lng: flight.lng, ts: Date.now() });
  };

  useEffect(() => {
    fetchFlights();
    const id = setInterval(fetchFlights, 60000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    const measure = () => {
      if (!wrapRef.current) return;
      setDims({ w: wrapRef.current.offsetWidth, h: wrapRef.current.offsetHeight });
    };
    measure();
    const ro = new ResizeObserver(measure);
    if (wrapRef.current) ro.observe(wrapRef.current);
    return () => ro.disconnect();
  }, []);

  return (
    <div className="fg-page">
      <div className="fg-header">
        <RiPlaneLine size={15} className="fg-header-icon" />
        <span className="fg-header-title">AIR FREIGHT</span>
        {source && (
          <button
            className={`fg-source-badge ${source}`}
            onClick={toggleMode}
            title={forcedSim ? 'Switch to live data' : 'Switch to simulated data'}
          >
            <RiWifiLine size={9} /> {source === 'live' ? 'LIVE ADS-B' : 'SIMULATED'}
          </button>
        )}
        <span className="fg-aircraft-count">{flights.length} aircraft tracked</span>
        <button className="fg-refresh-btn" onClick={fetchFlights} title="Refresh">
          <RiRefreshLine size={13} className={loading ? 'fg-spin' : ''} />
        </button>
        <div className="fg-airspace-badges">
          <span className="fg-az-badge red">Ukraine</span>
          <span className="fg-az-badge amber">Russia</span>
          <span className="fg-az-badge amber">Iran</span>
        </div>
      </div>

      <div className="fg-body">
        <div className="fg-globe-wrap" ref={wrapRef}>
          {dims.w > 0 && (
            <GlobeErrorBoundary>
              <FlightsGlobe
                flights={flights}
                source={source}
                onFlightClick={setSelectedFlight}
                focusTarget={focusTarget}
                width={dims.w}
                height={dims.h}
              />
            </GlobeErrorBoundary>
          )}
          <div className="fg-legend">
            <span style={{ color: '#f59e0b' }}>&#9632; Cargo</span>
            <span style={{ color: '#38bdf8' }}>&#9632; Passenger</span>
            <span style={{ color: '#f59e0b' }}>&#9679; Hub (Tier 1)</span>
            <span style={{ color: 'rgba(245,158,11,0.5)' }}>&#9679; Hub (Tier 2)</span>
            <span style={{ color: '#ef4444' }}>&#9679; Airspace Alert</span>
          </div>
          <div className="fg-scanline" />
        </div>
        <PanelErrorBoundary>
          <FGPanel
            flights={flights}
            selectedFlight={selectedFlight}
            onClearFlight={() => setSelectedFlight(null)}
            onFeedFlightClick={handleFeedFlightClick}
          />
        </PanelErrorBoundary>
      </div>
    </div>
  );
}
