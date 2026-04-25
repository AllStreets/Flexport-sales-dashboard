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

// Maps a raw OpenSky states array into our flight shape
function parseOpenSkyStates(states) {
  return states.slice(0, 300).map(s => ({
    id: s[0],
    callsign: (s[1] || '').trim(),
    isCargo: true,
    isGov: false,
    lat: s[6],
    lng: s[5],
    altitude: s[13] || 10000,
    velocity: s[9] ? Math.round(s[9] * 1.944) : 460,
    heading: s[10] || 0,
  }));
}

// Attempts live ADS-B via backend, then browser-side (unauthenticated then authenticated)
async function fetchFlightsWithFallback(API) {
  // Step 1: Try backend (works on localhost where Railway IP blocks don't apply)
  let backendData;
  try {
    const r = await fetch(`${API}/api/flights`);
    backendData = await r.json();
  } catch (_) {
    backendData = { source: 'sim', flights: [] };
  }

  if (backendData.source === 'live' && backendData.flights?.length > 0) {
    return backendData;
  }

  // Step 2a: Browser-side unauthenticated OpenSky call.
  // Railway's IPs are blocked from OpenSky's OAuth server, but the user's browser
  // is not — so call the data API directly without a token first.
  try {
    const osRes = await fetch('https://opensky-network.org/api/states/all');
    if (osRes.ok) {
      const data = await osRes.json();
      const states = (data?.states || []).filter(s =>
        s[5] != null && s[6] != null && !s[8]
      );
      if (states.length >= 20) {
        return { source: 'live', flights: parseOpenSkyStates(states) };
      }
    }
  } catch (_) {}

  // Step 2b: Try browser-side authenticated call.
  // First try token from backend proxy; if that fails (Railway IP blocked from OAuth server),
  // fall back to fetching the token directly from the browser using VITE_ credentials.
  try {
    let token = null;
    // Try Vercel serverless function first (same domain, Vercel IPs not blocked by OpenSky)
    try {
      const tr = await fetch('/api/opensky-token');
      if (tr.ok) { const d = await tr.json(); token = d.token || null; }
    } catch (_) {}
    // Fall back to Railway proxy
    if (!token) {
      try {
        const tr = await fetch(`${API}/api/opensky-token`);
        if (tr.ok) { const d = await tr.json(); token = d.token || null; }
      } catch (_) {}
    }

    if (!token) throw new Error('no token');
    const osRes = await fetch('https://opensky-network.org/api/states/all', {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!osRes.ok) throw new Error(`OpenSky ${osRes.status}`);
    const data = await osRes.json();
    const states = (data?.states || []).filter(s =>
      s[5] != null && s[6] != null && !s[8]
    );
    if (states.length >= 20) {
      return { source: 'live', flights: parseOpenSkyStates(states) };
    }
  } catch (_) {}

  // Step 3: Fallback — fetch sim explicitly
  try {
    const r = await fetch(`${API}/api/flights?mode=sim`);
    return r.json();
  } catch (_) {
    return backendData;
  }
}

export default function FlightsPage() {
  const [flights, setFlights]           = useState([]);
  const [ports, setPorts]               = useState([]);
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
    const fetchPromise = forcedSimRef.current
      ? fetch(`${API}/api/flights?mode=sim`).then(r => r.json())
      : fetchFlightsWithFallback(API);
    fetchPromise
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

  // Fetch port congestion/disruption data (same source as Ocean Command globe)
  useEffect(() => {
    fetch(`${API}/api/globe-data`)
      .then(r => r.json())
      .then(d => setPorts(d.ports || []))
      .catch(() => {});
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
          <span className="fg-az-badge red">Iran</span>
        </div>
      </div>

      <div className="fg-body">
        <div className="fg-globe-wrap" ref={wrapRef}>
          {dims.w > 0 && (
            <GlobeErrorBoundary>
              <FlightsGlobe
                flights={flights}
                ports={ports}
                source={source}
                onFlightClick={setSelectedFlight}
                focusTarget={focusTarget}
                width={dims.w}
                height={dims.h}
              />
            </GlobeErrorBoundary>
          )}
          <div className="fg-legend">
            <span style={{ color: '#00d4ff' }}>&#9632; Cargo</span>
            <span style={{ color: '#825adc' }}>&#9632; Passenger</span>
            <span style={{ color: '#00d4ff' }}>&#9679; Hub (Tier 1)</span>
            <span style={{ color: 'rgba(0,212,255,0.5)' }}>&#9679; Hub (Tier 2)</span>
            <span style={{ color: '#10b981' }}>&#9679; Port Clear</span>
            <span style={{ color: '#f59e0b' }}>&#9679; Congested</span>
            <span style={{ color: '#ef4444' }}>&#9679; Disruption</span>
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
