import { useState, useEffect } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Circle } from 'react-leaflet';
import L from 'leaflet';
import { RiShipLine, RiSearchLine, RiRefreshLine } from 'react-icons/ri';
import './VesselsPage.css';

const API = import.meta.env.VITE_API_URL || 'http://localhost:5001';

const vesselIcon = (type = '', simulated = false) => {
  const color = type.includes('Tanker') ? '#f59e0b' : type.includes('Bulk') ? '#a78bfa' : '#00d4ff';
  const opacity = simulated ? 0.5 : 1;
  return L.divIcon({
    className: '',
    html: `<div style="width:8px;height:8px;border-radius:50%;background:${color};opacity:${opacity};box-shadow:0 0 6px ${color};"></div>`,
    iconSize: [8, 8],
    iconAnchor: [4, 4],
  });
};

const DISRUPTION_ZONES = [
  { lat: 26.5, lng: 56.5, radius: 280000, label: 'Strait of Hormuz', color: '#ef4444' },
  { lat: 13.5, lng: 43.5, radius: 240000, label: 'Red Sea / Bab-el-Mandeb', color: '#f59e0b' },
  { lat: 31.5, lng: 32.3, radius: 160000, label: 'Suez Canal', color: '#f59e0b' },
];

const CONTAINER_MILESTONES = [
  'empty_out', 'full_in', 'vessel_loaded', 'vessel_departed',
  'vessel_arrived', 'discharged', 'available', 'full_out', 'empty_returned'
];
const MILESTONE_LABELS = {
  empty_out: 'Empty Picked Up', full_in: 'Full Gate-In', vessel_loaded: 'Loaded on Vessel',
  vessel_departed: 'Vessel Departed', vessel_arrived: 'Vessel Arrived',
  discharged: 'Discharged', available: 'Available for Pickup',
  full_out: 'Full Gate-Out', empty_returned: 'Empty Returned',
};

function ContainerTab() {
  const [input, setInput] = useState('');
  const [inputType, setInputType] = useState('container_number');
  const [trackData, setTrackData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [watchList, setWatchList] = useState(() =>
    JSON.parse(localStorage.getItem('container_watchlist') || '[]')
  );

  const submit = async () => {
    if (!input.trim()) return;
    setError(''); setTrackData(null); setLoading(true);
    try {
      const r = await fetch(`${API}/api/containers/track`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ number: input.trim(), type: inputType }),
      });
      const d = await r.json();
      if (d.error) { setError(typeof d.error === 'string' ? d.error : 'Tracking failed'); setLoading(false); return; }
      setTrackData(d);
    } catch (e) { setError(e.message); }
    setLoading(false);
  };

  const addToWatch = () => {
    if (!input.trim()) return;
    const entry = { number: input.trim(), type: inputType, ts: Date.now() };
    const next = [entry, ...watchList.filter(w => w.number !== input.trim())].slice(0, 10);
    setWatchList(next);
    localStorage.setItem('container_watchlist', JSON.stringify(next));
  };

  const events = trackData?.included?.filter(i => i.type === 'event') || [];
  const eventKeys = new Set(events.map(e => e.attributes?.event));

  return (
    <div className="container-tab">
      <div className="ct-left">
        <div className="ct-section-label">CONTAINER TRACKER</div>
        <div className="ct-input-row">
          <select className="ct-type-sel" value={inputType} onChange={e => setInputType(e.target.value)}>
            <option value="container_number">Container #</option>
            <option value="bill_of_lading">Bill of Lading</option>
          </select>
          <input className="ct-input" placeholder="e.g. MSCU1234567" value={input}
            onChange={e => setInput(e.target.value)} onKeyDown={e => e.key === 'Enter' && submit()} />
          <button className="ct-track-btn" onClick={submit} disabled={!input || loading}>
            {loading ? <RiRefreshLine className="vessels-spin" size={13} /> : 'TRACK'}
          </button>
        </div>
        {error && <div className="ct-error">{error}</div>}
        {watchList.length > 0 && (
          <div className="ct-watchlist">
            <div className="ct-wl-label">WATCH LIST</div>
            {watchList.map((w, i) => (
              <div key={i} className="ct-wl-item" onClick={() => setInput(w.number)}>
                <span>{w.number}</span>
                <span className="ct-wl-type">{w.type === 'bill_of_lading' ? 'B/L' : 'CTR'}</span>
              </div>
            ))}
          </div>
        )}
        <div className="ct-carriers-note">
          Covers Maersk, MSC, COSCO, CMA CGM, Evergreen, Hapag-Lloyd + 29 more carriers
        </div>
      </div>
      <div className="ct-right">
        {!trackData && !loading && (
          <div className="ct-empty">
            <RiShipLine size={40} style={{ color: '#1e3a4a' }} />
            <p>Track a container by number or Bill of Lading.</p>
          </div>
        )}
        {loading && <div className="ct-loading">Submitting tracking request...</div>}
        {trackData && (
          <>
            <div className="ct-timeline-label">CONTAINER JOURNEY</div>
            <div className="ct-timeline">
              {CONTAINER_MILESTONES.map((m, i) => {
                const done = eventKeys.has(m);
                const isActive = done && !CONTAINER_MILESTONES.slice(i + 1).some(n => eventKeys.has(n));
                return (
                  <div key={m} className={`ct-milestone${done ? ' done' : ''}${isActive ? ' active' : ''}`}>
                    <div className="ct-milestone-dot" />
                    {i < CONTAINER_MILESTONES.length - 1 && <div className="ct-milestone-line" />}
                    <div className="ct-milestone-label">{MILESTONE_LABELS[m]}</div>
                  </div>
                );
              })}
            </div>
            <button className="ct-watch-btn" onClick={addToWatch}>+ Add to Watch List</button>
          </>
        )}
      </div>
    </div>
  );
}

function VesselMap({ vessels, onSelect }) {
  return (
    <MapContainer
      center={[20, 0]} zoom={3} minZoom={2} maxZoom={8}
      style={{ height: '100%', width: '100%', background: '#060b18' }}
      zoomControl={false}
    >
      <TileLayer
        url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
        attribution='&copy; <a href="https://www.openstreetmap.org">OSM</a> &copy; <a href="https://carto.com">CARTO</a>'
        subdomains="abcd" maxZoom={20}
      />
      {DISRUPTION_ZONES.map((z, i) => (
        <Circle key={i} center={[z.lat, z.lng]} radius={z.radius}
          pathOptions={{ color: z.color, fillColor: z.color, fillOpacity: 0.06, weight: 1, dashArray: '4 4' }} />
      ))}
      {vessels.map(v => (
        <Marker key={v.mmsi} position={[v.lat, v.lng]} icon={vesselIcon(v.type, v.simulated)}
          eventHandlers={{ click: () => onSelect(v) }}>
          <Popup className="vessel-popup">
            <strong>{v.name || `MMSI ${v.mmsi}`}</strong><br />
            {v.type || 'Unknown'} · {v.destination || '—'}<br />
            SOG {v.sog?.toFixed(1) ?? '—'} kn
          </Popup>
        </Marker>
      ))}
    </MapContainer>
  );
}

export default function VesselsPage() {
  const [vessels, setVessels] = useState([]);
  const [source, setSource] = useState('');
  const [loading, setLoading] = useState(true);
  const [selectedVessel, setSelectedVessel] = useState(null);
  const [tab, setTab] = useState('map');
  const [search, setSearch] = useState('');

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

  const filtered = vessels.filter(v =>
    !search ||
    (v.name || '').toLowerCase().includes(search.toLowerCase()) ||
    String(v.mmsi).includes(search)
  );

  return (
    <div className="vessels-page">
      <div className="vessels-header">
        <RiShipLine size={16} className="vessels-header-icon" />
        <span className="vessels-header-title">LIVE VESSEL TRACKER</span>
        {source && (
          <span className={`vessels-source-badge ${source}`}>
            {source === 'live' ? 'LIVE AIS' : 'SIMULATED'}
          </span>
        )}
        <span className="vessels-count">{vessels.length} vessels</span>
        <button className="vessels-refresh-btn" onClick={fetchVessels} title="Refresh">
          <RiRefreshLine size={13} className={loading ? 'vessels-spin' : ''} />
        </button>
        <div className="vessels-search">
          <RiSearchLine size={12} />
          <input placeholder="Search vessel or MMSI..." value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <div className="vessels-tabs">
          <button className={tab === 'map' ? 'active' : ''} onClick={() => setTab('map')}>Map</button>
          <button className={tab === 'containers' ? 'active' : ''} onClick={() => setTab('containers')}>Containers</button>
        </div>
      </div>

      <div className="vessels-body">
        {tab === 'map' && (
          <div className="vessels-map-wrap">
            <VesselMap vessels={filtered} onSelect={setSelectedVessel} />
            {selectedVessel && (
              <div className="vessel-detail-panel">
                <div className="vd-header">
                  <RiShipLine size={14} />
                  <strong>{selectedVessel.name || `MMSI ${selectedVessel.mmsi}`}</strong>
                  <button className="vd-close" onClick={() => setSelectedVessel(null)}>✕</button>
                </div>
                <div className="vd-row"><span>Type</span><span>{selectedVessel.type || '—'}</span></div>
                <div className="vd-row"><span>MMSI</span><span>{selectedVessel.mmsi}</span></div>
                <div className="vd-row"><span>Speed</span><span>{selectedVessel.sog?.toFixed(1) ?? '—'} kn</span></div>
                <div className="vd-row"><span>Course</span><span>{selectedVessel.cog?.toFixed(0) ?? '—'}°</span></div>
                <div className="vd-row"><span>Destination</span><span>{selectedVessel.destination || '—'}</span></div>
                <div className="vd-row"><span>Callsign</span><span>{selectedVessel.callsign || '—'}</span></div>
                {selectedVessel.simulated && (
                  <div className="vd-sim-note">Simulated — connect AISSTREAM_API_KEY for live data</div>
                )}
              </div>
            )}
            <div className="vessels-legend">
              <span style={{ color: '#00d4ff' }}>● Container</span>
              <span style={{ color: '#f59e0b' }}>● Tanker</span>
              <span style={{ color: '#a78bfa' }}>● Bulk Carrier</span>
              {DISRUPTION_ZONES.map(z => (
                <span key={z.label} style={{ color: z.color }}>◎ {z.label}</span>
              ))}
            </div>
          </div>
        )}
        {tab === 'containers' && <ContainerTab />}
      </div>
    </div>
  );
}
