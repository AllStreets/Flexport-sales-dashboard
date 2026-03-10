// frontend/src/pages/VesselsPage.jsx
import { useState, useEffect, useRef, Component } from 'react';
import { RiShipLine, RiRefreshLine, RiWifiLine } from 'react-icons/ri';

class GlobeErrorBoundary extends Component {
  constructor(props) { super(props); this.state = { error: null }; }
  static getDerivedStateFromError(e) { return { error: e }; }
  componentDidCatch(e) { console.error('VesselsGlobe WebGL error:', e); }
  render() {
    if (this.state.error) {
      return (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', gap: 12, color: '#334155', fontFamily: "'JetBrains Mono', monospace" }}>
          <div style={{ fontSize: 11, letterSpacing: '0.1em' }}>RENDERER ERROR — WEBGL CONTEXT LOST</div>
          <button
            style={{ fontSize: 9, background: 'none', border: '1px solid rgba(0,212,255,0.2)', color: '#00d4ff', padding: '5px 14px', cursor: 'pointer', borderRadius: 4, letterSpacing: '0.08em' }}
            onClick={() => this.setState({ error: null })}
          >RELOAD GLOBE</button>
        </div>
      );
    }
    return this.props.children;
  }
}
import VesselsGlobe from '../components/VesselsGlobe';
import VGPanel from '../components/VGPanel';
import './VesselsPage.css';

const API = import.meta.env.VITE_API_URL || 'http://localhost:5000';

export default function VesselsPage() {
  const [vessels, setVessels] = useState([]);
  const [ports, setPorts] = useState([]);
  const [source, setSource] = useState('');
  const [loading, setLoading] = useState(true);
  const [selectedVessel, setSelectedVessel] = useState(null);
  const wrapRef = useRef(null);
  const [dims, setDims] = useState({ w: 0, h: 0 });

  const fetchVessels = () => {
    setLoading(true);
    fetch(`${API}/api/vessels`)
      .then(r => r.json())
      .then(d => { setVessels(d.vessels || []); setSource(d.source); setLoading(false); })
      .catch(() => setLoading(false));
  };

  const fetchGlobeData = () => {
    fetch(`${API}/api/globe-data`)
      .then(r => r.json())
      .then(d => setPorts(d.ports || []))
      .catch(console.error);
  };

  useEffect(() => {
    fetchVessels();
    fetchGlobeData();
    const vesselId = setInterval(fetchVessels, 30000);
    const portId = setInterval(fetchGlobeData, 60000);
    return () => { clearInterval(vesselId); clearInterval(portId); };
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

  // Derive disruption badge statuses from live port data
  const hormuz = ports.find(p => p.name === 'Jebel Ali')?.status || 'disruption';
  const redSea = ports.find(p => p.name === 'Aden')?.status || 'disruption';
  const suez   = ports.find(p => p.name === 'Port Said')?.status || 'disruption';
  const badgeClass = s => s === 'disruption' ? 'red' : s === 'congestion' ? 'amber' : 'green';

  return (
    <div className="vg-page">
      <div className="vg-header">
        <RiShipLine size={15} className="vg-header-icon" />
        <span className="vg-header-title">OCEAN COMMAND</span>
        {source && (
          <span className={`vg-source-badge ${source}`}>
            <RiWifiLine size={9} /> {source === 'live' ? 'LIVE AIS' : 'SIMULATED'}
          </span>
        )}
        <span className="vg-vessel-count">{vessels.length} vessels tracked</span>
        <button className="vg-refresh-btn" onClick={fetchVessels} title="Refresh">
          <RiRefreshLine size={13} className={loading ? 'vg-spin' : ''} />
        </button>
        <div className="vg-disruption-badges">
          <span className={`vg-dz-badge ${badgeClass(hormuz)}`}>Hormuz</span>
          <span className={`vg-dz-badge ${badgeClass(redSea)}`}>Red Sea</span>
          <span className={`vg-dz-badge ${badgeClass(suez)}`}>Suez</span>
        </div>
      </div>

      <div className="vg-body">
        <div className="vg-globe-wrap" ref={wrapRef}>
          {dims.w > 0 && (
            <GlobeErrorBoundary>
              <VesselsGlobe
                vessels={vessels}
                ports={ports}
                onVesselClick={setSelectedVessel}
                width={dims.w}
                height={dims.h}
              />
            </GlobeErrorBoundary>
          )}
          <div className="vg-legend">
            <span style={{ color: '#00d4ff' }}>■ Container</span>
            <span style={{ color: '#f59e0b' }}>■ Tanker</span>
            <span style={{ color: '#a78bfa' }}>■ Bulk Carrier</span>
            <span style={{ color: '#10b981' }}>● Clear</span>
            <span style={{ color: '#f59e0b' }}>● Congested</span>
            <span style={{ color: '#ef4444' }}>● Disrupted</span>
          </div>
          <div className="vg-scanline" />
        </div>
        <VGPanel
          vessels={vessels}
          ports={ports}
          selectedVessel={selectedVessel}
          onClearVessel={() => setSelectedVessel(null)}
        />
      </div>
    </div>
  );
}
