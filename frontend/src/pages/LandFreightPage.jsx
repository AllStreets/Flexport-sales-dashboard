// frontend/src/pages/LandFreightPage.jsx
import { useState, useEffect, useRef, Component } from 'react';
import { RiTruckLine, RiRefreshLine, RiWifiLine } from 'react-icons/ri';

class GlobeErrorBoundary extends Component {
  constructor(props) { super(props); this.state = { error: null }; }
  static getDerivedStateFromError(e) { return { error: e }; }
  componentDidCatch(e) { console.error('LandGlobe WebGL error:', e); }
  render() {
    if (this.state.error) {
      return (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', gap: 12, color: '#334155', fontFamily: "'JetBrains Mono', monospace" }}>
          <div style={{ fontSize: 11, letterSpacing: '0.1em' }}>RENDERER ERROR — WEBGL CONTEXT LOST</div>
          <button
            style={{ fontSize: 9, background: 'none', border: '1px solid rgba(250,204,21,0.2)', color: '#facc15', padding: '5px 14px', cursor: 'pointer', borderRadius: 4, letterSpacing: '0.08em' }}
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
  componentDidCatch(e) { console.error('LGPanel error:', e); }
  render() {
    if (this.state.error) return null;
    return this.props.children;
  }
}

import LandGlobe from '../components/LandGlobe';
import LGPanel from '../components/LGPanel';
import './LandFreightPage.css';

const API = import.meta.env.VITE_API_URL || 'http://localhost:5001';

export default function LandFreightPage() {
  const [trucks, setTrucks]               = useState([]);
  const [ports, setPorts]                 = useState([]);
  const [loading, setLoading]             = useState(true);
  const [selectedTruck, setSelectedTruck] = useState(null);
  const [focusTarget, setFocusTarget]     = useState(null);
  const wrapRef = useRef(null);
  const [dims, setDims] = useState({ w: 0, h: 0 });

  const fetchTrucks = () => {
    setLoading(true);
    fetch(`${API}/api/trucks`)
      .then(r => r.json())
      .then(d => { setTrucks(d.trucks || []); setLoading(false); })
      .catch(() => setLoading(false));
  };

  const handleFeedTruckClick = (truck) => {
    setSelectedTruck(truck);
    setFocusTarget({ lat: truck.lat, lng: truck.lng, ts: Date.now() });
  };

  useEffect(() => {
    fetchTrucks();
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
    <div className="lg-page">
      <div className="lg-header">
        <RiTruckLine size={15} className="lg-header-icon" />
        <span className="lg-header-title">LAND FREIGHT</span>
        <span className="lg-source-badge"><RiWifiLine size={9} /> SIMULATED</span>
        <span className="lg-truck-count">{trucks.length} trucks tracked</span>
        <button className="lg-refresh-btn" onClick={fetchTrucks} title="Refresh">
          <RiRefreshLine size={13} className={loading ? 'lg-spin' : ''} />
        </button>
        <div className="lg-border-badges">
          <span className="lg-bz-badge green">Laredo</span>
          <span className="lg-bz-badge amber">Dover</span>
          <span className="lg-bz-badge red">Brest</span>
        </div>
      </div>

      <div className="lg-body">
        <div className="lg-globe-wrap" ref={wrapRef}>
          {dims.w > 0 && (
            <GlobeErrorBoundary>
              <LandGlobe
                trucks={trucks}
                ports={ports}
                onTruckClick={setSelectedTruck}
                focusTarget={focusTarget}
                width={dims.w}
                height={dims.h}
              />
            </GlobeErrorBoundary>
          )}
          <div className="lg-legend">
            <span style={{ color: '#00d4ff' }}>&#9632; Semi-Truck</span>
            <span style={{ color: '#fb923c' }}>&#9632; Tank Truck</span>
            <span style={{ color: '#00d4ff' }}>&#9679; Distribution Hub</span>
            <span style={{ color: '#10b981' }}>&#9679; Port Clear</span>
            <span style={{ color: '#f59e0b' }}>&#9679; Port Congested</span>
            <span style={{ color: '#ef4444' }}>&#9679; Disruption</span>
          </div>
          <div className="lg-scanline" />
        </div>
        <PanelErrorBoundary>
          <LGPanel
            trucks={trucks}
            selectedTruck={selectedTruck}
            onClearTruck={() => setSelectedTruck(null)}
            onFeedTruckClick={handleFeedTruckClick}
          />
        </PanelErrorBoundary>
      </div>
    </div>
  );
}
