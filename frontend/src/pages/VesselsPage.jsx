// frontend/src/pages/VesselsPage.jsx
import { useState, useEffect, useRef } from 'react';
import { RiShipLine, RiRefreshLine, RiWifiLine } from 'react-icons/ri';
import VesselsGlobe from '../components/VesselsGlobe';
import VGPanel from '../components/VGPanel';
import './VesselsPage.css';

const API = import.meta.env.VITE_API_URL || 'http://localhost:5001';

export default function VesselsPage() {
  const [vessels, setVessels] = useState([]);
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

  useEffect(() => {
    fetchVessels();
    const id = setInterval(fetchVessels, 30000);
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
          <span className="vg-dz-badge red">Hormuz</span>
          <span className="vg-dz-badge amber">Red Sea</span>
          <span className="vg-dz-badge amber">Suez</span>
        </div>
      </div>

      <div className="vg-body">
        <div className="vg-globe-wrap" ref={wrapRef}>
          {dims.w > 0 && (
            <VesselsGlobe
              vessels={vessels}
              onVesselClick={setSelectedVessel}
              width={dims.w}
              height={dims.h}
            />
          )}
          <div className="vg-legend">
            <span style={{ color: '#00d4ff' }}>■ Container</span>
            <span style={{ color: '#f59e0b' }}>■ Tanker</span>
            <span style={{ color: '#a78bfa' }}>■ Bulk Carrier</span>
            <span style={{ color: '#ef4444' }}>◎ Disruption Zone</span>
          </div>
          <div className="vg-scanline" />
        </div>
        <VGPanel
          vessels={vessels}
          selectedVessel={selectedVessel}
          onClearVessel={() => setSelectedVessel(null)}
        />
      </div>
    </div>
  );
}
