// frontend/src/components/VGPanel.jsx
import { useState, useEffect, useRef } from 'react';
import { RiAlertLine, RiRadarLine, RiRefreshLine } from 'react-icons/ri';

// MID (first 3 digits of MMSI) → flag + country for live AIS vessels
const MID_TO_FLAG = {
  211:{ f:'🇩🇪', c:'Germany' },       218:{ f:'🇩🇪', c:'Germany' },
  219:{ f:'🇩🇰', c:'Denmark' },       220:{ f:'🇩🇰', c:'Denmark' },
  224:{ f:'🇪🇸', c:'Spain' },         225:{ f:'🇪🇸', c:'Spain' },
  226:{ f:'🇫🇷', c:'France' },        227:{ f:'🇫🇷', c:'France' },        228:{ f:'🇫🇷', c:'France' },
  229:{ f:'🇲🇹', c:'Malta' },         230:{ f:'🇫🇮', c:'Finland' },
  231:{ f:'🇫🇴', c:'Faroe Islands' }, 232:{ f:'🇬🇧', c:'United Kingdom' }, 233:{ f:'🇬🇧', c:'United Kingdom' },
  234:{ f:'🇬🇧', c:'United Kingdom' }, 235:{ f:'🇬🇧', c:'United Kingdom' },
  237:{ f:'🇬🇷', c:'Greece' },        239:{ f:'🇬🇷', c:'Greece' },        240:{ f:'🇬🇷', c:'Greece' },        241:{ f:'🇬🇷', c:'Greece' },
  244:{ f:'🇳🇱', c:'Netherlands' },   245:{ f:'🇳🇱', c:'Netherlands' },   246:{ f:'🇳🇱', c:'Netherlands' },
  247:{ f:'🇮🇹', c:'Italy' },
  248:{ f:'🇲🇹', c:'Malta' },         249:{ f:'🇲🇹', c:'Malta' },         256:{ f:'🇲🇹', c:'Malta' },
  255:{ f:'🇵🇹', c:'Portugal' },
  257:{ f:'🇳🇴', c:'Norway' },        258:{ f:'🇳🇴', c:'Norway' },        259:{ f:'🇳🇴', c:'Norway' },
  265:{ f:'🇸🇪', c:'Sweden' },        266:{ f:'🇸🇪', c:'Sweden' },
  271:{ f:'🇹🇷', c:'Turkey' },        273:{ f:'🇷🇺', c:'Russia' },
  303:{ f:'🇺🇸', c:'United States' }, 316:{ f:'🇨🇦', c:'Canada' },
  338:{ f:'🇺🇸', c:'United States' }, 366:{ f:'🇺🇸', c:'United States' }, 367:{ f:'🇺🇸', c:'United States' },
  368:{ f:'🇺🇸', c:'United States' }, 369:{ f:'🇺🇸', c:'United States' },
  308:{ f:'🇧🇸', c:'Bahamas' },       309:{ f:'🇧🇸', c:'Bahamas' },       311:{ f:'🇧🇸', c:'Bahamas' },
  310:{ f:'🇧🇲', c:'Bermuda' },       319:{ f:'🇰🇾', c:'Cayman Islands' },
  351:{ f:'🇵🇦', c:'Panama' },        352:{ f:'🇵🇦', c:'Panama' },        353:{ f:'🇵🇦', c:'Panama' },
  354:{ f:'🇵🇦', c:'Panama' },        355:{ f:'🇵🇦', c:'Panama' },        356:{ f:'🇵🇦', c:'Panama' },
  357:{ f:'🇵🇦', c:'Panama' },        370:{ f:'🇵🇦', c:'Panama' },        371:{ f:'🇵🇦', c:'Panama' },
  372:{ f:'🇵🇦', c:'Panama' },        373:{ f:'🇵🇦', c:'Panama' },        374:{ f:'🇵🇦', c:'Panama' },
  412:{ f:'🇨🇳', c:'China' },         413:{ f:'🇨🇳', c:'China' },         414:{ f:'🇨🇳', c:'China' },         461:{ f:'🇨🇳', c:'China' },
  416:{ f:'🇹🇼', c:'Taiwan' },
  419:{ f:'🇮🇳', c:'India' },
  422:{ f:'🇮🇷', c:'Iran' },
  431:{ f:'🇯🇵', c:'Japan' },         432:{ f:'🇯🇵', c:'Japan' },
  440:{ f:'🇰🇷', c:'South Korea' },   441:{ f:'🇰🇷', c:'South Korea' },
  470:{ f:'🇦🇪', c:'UAE' },           471:{ f:'🇦🇪', c:'UAE' },           472:{ f:'🇦🇪', c:'UAE' },
  477:{ f:'🇭🇰', c:'Hong Kong' },
  478:{ f:'🇵🇭', c:'Philippines' },   548:{ f:'🇵🇭', c:'Philippines' },
  503:{ f:'🇦🇺', c:'Australia' },
  510:{ f:'🇲🇭', c:'Marshall Islands' }, 538:{ f:'🇲🇭', c:'Marshall Islands' },
  512:{ f:'🇳🇿', c:'New Zealand' },
  521:{ f:'🇮🇩', c:'Indonesia' },     525:{ f:'🇮🇩', c:'Indonesia' },
  533:{ f:'🇲🇾', c:'Malaysia' },
  563:{ f:'🇸🇬', c:'Singapore' },     564:{ f:'🇸🇬', c:'Singapore' },     565:{ f:'🇸🇬', c:'Singapore' },     566:{ f:'🇸🇬', c:'Singapore' },
  567:{ f:'🇹🇭', c:'Thailand' },
  574:{ f:'🇻🇳', c:'Vietnam' },
  601:{ f:'🇿🇦', c:'South Africa' },
  636:{ f:'🇱🇷', c:'Liberia' },
  209:{ f:'🇨🇾', c:'Cyprus' },        210:{ f:'🇨🇾', c:'Cyprus' },        212:{ f:'🇨🇾', c:'Cyprus' },
  215:{ f:'🇲🇹', c:'Malta' },
};

// Port-of-origin → flag for simulated vessels (uses srcName field)
const PORT_TO_FLAG = {
  'Shanghai':        { f:'🇨🇳', c:'China' },
  'Ho Chi Minh City':{ f:'🇻🇳', c:'Vietnam' },
  'Tokyo':           { f:'🇯🇵', c:'Japan' },
  'Nagoya':          { f:'🇯🇵', c:'Japan' },
  'Busan':           { f:'🇰🇷', c:'South Korea' },
  'Taipei':          { f:'🇹🇼', c:'Taiwan' },
  'Singapore':       { f:'🇸🇬', c:'Singapore' },
  'Cape Town':       { f:'🇿🇦', c:'South Africa' },
  'Durban':          { f:'🇿🇦', c:'South Africa' },
  'Rotterdam':       { f:'🇳🇱', c:'Netherlands' },
  'Hamburg':         { f:'🇩🇪', c:'Germany' },
  'Los Angeles':     { f:'🇺🇸', c:'United States' },
  'New York':        { f:'🇺🇸', c:'United States' },
  'Houston':         { f:'🇺🇸', c:'United States' },
  'Seattle':         { f:'🇺🇸', c:'United States' },
  'Mumbai':          { f:'🇮🇳', c:'India' },
  'Chennai':         { f:'🇮🇳', c:'India' },
  'Istanbul':        { f:'🇹🇷', c:'Turkey' },
  'Santos':          { f:'🇧🇷', c:'Brazil' },
  'Callao':          { f:'🇵🇪', c:'Peru' },
  'Sydney':          { f:'🇦🇺', c:'Australia' },
  'Melbourne':       { f:'🇦🇺', c:'Australia' },
  'Brisbane':        { f:'🇦🇺', c:'Australia' },
  'Fremantle':       { f:'🇦🇺', c:'Australia' },
  'Jebel Ali':       { f:'🇦🇪', c:'UAE' },
  'Port Klang':      { f:'🇲🇾', c:'Malaysia' },
  'Hong Kong':       { f:'🇭🇰', c:'Hong Kong' },
  'Manila':          { f:'🇵🇭', c:'Philippines' },
  'Jakarta':         { f:'🇮🇩', c:'Indonesia' },
  'Auckland':        { f:'🇳🇿', c:'New Zealand' },
  'Colombo':         { f:'🇱🇰', c:'Sri Lanka' },
  'Antwerp':         { f:'🇧🇪', c:'Belgium' },
  'Le Havre':        { f:'🇫🇷', c:'France' },
  'Algeciras':       { f:'🇪🇸', c:'Spain' },
  'Barcelona':       { f:'🇪🇸', c:'Spain' },
  'Felixstowe':      { f:'🇬🇧', c:'United Kingdom' },
  'Genoa':           { f:'🇮🇹', c:'Italy' },
  'Piraeus':         { f:'🇬🇷', c:'Greece' },
};

function getVesselFlag(vessel) {
  if (vessel.simulated || (vessel.mmsi >= 900000000)) {
    return PORT_TO_FLAG[vessel.srcName] || null;
  }
  const mid = Math.floor((vessel.mmsi || 0) / 1000000);
  return MID_TO_FLAG[mid] || null;
}

const API = import.meta.env.VITE_API_URL || 'http://localhost:5000';

const CONTAINER_MILESTONES = [
  'empty_out','full_in','vessel_loaded','vessel_departed',
  'vessel_arrived','discharged','available','full_out','empty_returned'
];
const MILESTONE_LABELS = {
  empty_out:'Empty Picked Up', full_in:'Full Gate-In', vessel_loaded:'Loaded on Vessel',
  vessel_departed:'Vessel Departed', vessel_arrived:'Vessel Arrived',
  discharged:'Discharged', available:'Available for Pickup',
  full_out:'Full Gate-Out', empty_returned:'Empty Returned',
};

const DISRUPTION_CHECK = [
  { lat: 26.5, lng: 56.5, r: 4 },
  { lat: 13.5, lng: 43.5, r: 3.5 },
  { lat: 31.5, lng: 32.3, r: 2 },
];

function deg(a, b) {
  return Math.sqrt((a.lat - b.lat) ** 2 + (a.lng - b.lng) ** 2);
}

function generateEvent(vessel) {
  if (!vessel) return null;
  const ZONES = [
    { lat: 26.5, lng: 56.5, label: 'Strait of Hormuz', warn: true },
    { lat: 13.5, lng: 43.5, label: 'Red Sea / Bab-el-Mandeb', warn: true },
    { lat: 31.5, lng: 32.3, label: 'Suez Canal', warn: false },
  ];
  const zone = ZONES.find(z => deg(z, vessel) < (z === ZONES[0] ? 4 : z === ZONES[1] ? 3.5 : 2));
  const name = vessel.name || `MMSI ${vessel.mmsi}`;
  const spd = (vessel.sog || 0).toFixed(1);
  const mmsi = vessel.mmsi;
  if (zone) return { name, detail: zone.label, speed: spd, warn: zone.warn, ts: Date.now(), mmsi };
  if ((vessel.sog || 0) < 0.5) return { name, detail: 'At anchor', speed: spd, warn: false, ts: Date.now(), mmsi };
  return { name, detail: `${vessel.type || 'Vessel'} in transit`, speed: spd, warn: false, ts: Date.now(), mmsi };
}

// Normalize AIS vessel type: live vessels use numeric codes (70=Container, 80=Tanker),
// simulated vessels use strings. Optional chaining only guards null/undefined — NOT
// non-string types, so (70)?.includes('Tanker') still throws. Convert explicitly.
function vesselTypeStr(v) {
  if (typeof v.type === 'number') {
    if (v.type >= 80 && v.type < 90) return 'Tanker';
    if (v.type >= 70 && v.type < 80) return 'Container';
    return '';
  }
  return String(v.type || '');
}

function VGStats({ vessels, ports = [] }) {
  const ctr = vessels.filter(v => { const t = vesselTypeStr(v); return !t.includes('Tanker') && !t.includes('Bulk'); }).length;
  const tnk = vessels.filter(v => vesselTypeStr(v).includes('Tanker')).length;
  const blk = vessels.filter(v => vesselTypeStr(v).includes('Bulk')).length;
  const alerts = ports.length > 0
    ? ports.filter(p => p.status === 'disruption').length
    : vessels.filter(v => DISRUPTION_CHECK.some(z => deg(z, v) < z.r)).length;

  return (
    <div className="vg-stats">
      <div className="vg-stats-label">FLEET OVERVIEW</div>
      <div className="vg-stats-grid">
        <div className="vg-stat"><span className="vg-stat-val" style={{ color: '#94a3b8' }}>{vessels.length}</span><span className="vg-stat-key">TOTAL</span></div>
        <div className="vg-stat"><span className="vg-stat-val" style={{ color: '#00d4ff' }}>{ctr}</span><span className="vg-stat-key">CONTAINER</span></div>
        <div className="vg-stat"><span className="vg-stat-val" style={{ color: '#f97316' }}>{tnk}</span><span className="vg-stat-key">TANKER</span></div>
        <div className="vg-stat"><span className="vg-stat-val" style={{ color: '#a78bfa' }}>{blk}</span><span className="vg-stat-key">BULK</span></div>
      </div>
      {alerts > 0 && (
        <div className="vg-alert-strip">
          <RiAlertLine size={11} />
          <span>{alerts} vessel{alerts !== 1 ? 's' : ''} in disruption zone{alerts !== 1 ? 's' : ''}</span>
        </div>
      )}
    </div>
  );
}

function VGEventFeed({ vessels, selectedVessel, onClear, onFeedVesselClick }) {
  const [events, setEvents] = useState([]);
  const timerRef = useRef(null);
  const vesselsRef = useRef(vessels);
  useEffect(() => { vesselsRef.current = vessels; }, [vessels]);

  useEffect(() => {
    if (!vesselsRef.current.length) return;
    const push = () => {
      if (selectedVessel) return;
      const arr = vesselsRef.current;
      const v = arr[Math.floor(Math.random() * arr.length)];
      const ev = generateEvent(v);
      if (!ev) return;
      setEvents(prev => [ev, ...prev].slice(0, 8));
    };
    push();
    timerRef.current = setInterval(push, 3000);
    return () => clearInterval(timerRef.current);
  }, [selectedVessel]);

  if (selectedVessel) {
    return (
      <div className="vg-feed">
        <div className="vg-feed-label">
          VESSEL DETAIL
          <button className="vg-feed-clear" onClick={onClear}>CLOSE</button>
        </div>
        <div className="vg-vessel-detail">
          <div className="vg-vd-name">{selectedVessel.name || `MMSI ${selectedVessel.mmsi}`}</div>
          <div className="vg-vd-row"><span>Type</span><span>{selectedVessel.type || '—'}</span></div>
          <div className="vg-vd-row"><span>MMSI</span><span>{selectedVessel.mmsi}</span></div>
          <div className="vg-vd-row"><span>Speed</span><span>{(selectedVessel.sog || 0).toFixed(1)} kn</span></div>
          <div className="vg-vd-row"><span>Course</span><span>{selectedVessel.cog?.toFixed(0) ?? '—'}{selectedVessel.cog != null ? '\u00b0' : ''}</span></div>
          <div className="vg-vd-row"><span>Destination</span><span>{selectedVessel.destination || '—'}</span></div>
          <div className="vg-vd-row"><span>Callsign</span><span>{selectedVessel.callsign || '—'}</span></div>
          {(() => { const fl = getVesselFlag(selectedVessel); return fl ? (
            <div className="vg-vd-row"><span>Flag</span><span>{fl.f} {fl.c}</span></div>
          ) : null; })()}
          {selectedVessel.simulated && <div className="vg-vd-sim">Simulated — connect AISSTREAM_API_KEY for live data</div>}
        </div>
      </div>
    );
  }

  return (
    <div className="vg-feed">
      <div className="vg-feed-label">
        LIVE EVENT FEED
        <span className="vg-feed-pulse" />
      </div>
      <div className="vg-feed-list">
        {events.map((ev, i) => {
          const vessel = ev.mmsi != null ? vessels.find(v => v.mmsi === ev.mmsi) : null;
          return (
            <div
              key={ev.ts + i}
              className={`vg-feed-card${vessel ? ' vg-feed-card-clickable' : ''}`}
              onClick={() => vessel && onFeedVesselClick && onFeedVesselClick(vessel)}
            >
              <div className="vg-feed-card-top">
                <span className="vg-feed-vessel">{ev.name}</span>
                {ev.warn && <span className="vg-feed-warn"><RiAlertLine size={9} /> WARN</span>}
              </div>
              <div className="vg-feed-card-detail">{ev.detail} · {ev.speed} kn</div>
            </div>
          );
        })}
        {events.length === 0 && (
          <div className="vg-feed-empty">
            <RiRadarLine size={22} />
            <span>Scanning...</span>
          </div>
        )}
      </div>
    </div>
  );
}

function VGContainerTracker() {
  const [input, setInput] = useState('');
  const [inputType, setInputType] = useState('container_number');
  const [trackData, setTrackData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

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
      if (d.error) setError(typeof d.error === 'string' ? d.error : 'Tracking failed');
      else setTrackData(d);
    } catch (e) { setError(e.message); }
    setLoading(false);
  };

  const events = trackData?.included?.filter(i => i.type === 'event') || [];
  const eventKeys = new Set(events.map(e => e.attributes?.event));

  return (
    <div className="vg-ctr">
      <div className="vg-feed-label">CONTAINER TRACKER</div>
      <div className="vg-ctr-row">
        <select className="vg-ctr-sel" value={inputType} onChange={e => setInputType(e.target.value)}>
          <option value="container_number">Container #</option>
          <option value="bill_of_lading">Bill of Lading</option>
        </select>
        <input
          className="vg-ctr-input"
          placeholder="MSCU1234567"
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && submit()}
        />
        <button className="vg-ctr-btn" onClick={submit} disabled={!input || loading}>
          {loading ? <RiRefreshLine className="vg-spin" size={11} /> : 'TRACK'}
        </button>
      </div>
      {error && <div className="vg-ctr-error">{error}</div>}
      {trackData && (
        <div className="vg-ctr-timeline">
          {CONTAINER_MILESTONES.map((m, i) => {
            const done = eventKeys.has(m);
            const isActive = done && !CONTAINER_MILESTONES.slice(i + 1).some(n => eventKeys.has(n));
            return (
              <div key={m} className={`vg-ms${done ? ' done' : ''}${isActive ? ' active' : ''}`}>
                <div className="vg-ms-dot" />
                {i < CONTAINER_MILESTONES.length - 1 && <div className="vg-ms-line" />}
                <div className="vg-ms-label">{MILESTONE_LABELS[m]}</div>
              </div>
            );
          })}
        </div>
      )}
      {!trackData && !loading && (
        <div className="vg-ctr-hint">Track by container # or B/L across 35+ carriers</div>
      )}
    </div>
  );
}

export default function VGPanel({ vessels, ports = [], selectedVessel, onClearVessel, onFeedVesselClick }) {
  return (
    <div className="vg-panel">
      <VGStats vessels={vessels} ports={ports} />
      <VGEventFeed vessels={vessels} selectedVessel={selectedVessel} onClear={onClearVessel} onFeedVesselClick={onFeedVesselClick} />
      <VGContainerTracker />
    </div>
  );
}
