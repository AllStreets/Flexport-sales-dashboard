// frontend/src/components/FGPanel.jsx
import { useState, useEffect, useRef, useMemo } from 'react';
import { RiAlertLine, RiRadarLine, RiPlaneLine } from 'react-icons/ri';

const CARRIER_NAMES = {
  FDX: 'FedEx Express',     UPS: 'UPS Airlines',    GTI: 'Atlas Air',
  CLX: 'Cargolux',          NCA: 'Nippon Cargo',    ABX: 'ABX Air',
  ATN: 'Air Transport Intl',PAC: 'Polar Air Cargo', KAC: 'Korean Air Cargo',
  CAL: 'China Airlines',    CPA: 'Cathay Cargo',    ETH: 'Ethiopian Cargo',
  TAY: 'TNT Airways',       GEC: 'Lufthansa Cargo', DHL: 'DHL Air',
};

// Major cargo hubs for proximity-based event generation
const HUB_CHECKS = [
  { code: 'MEM', name: 'Memphis',     lat: 35.04, lng: -89.98 },
  { code: 'SDF', name: 'Louisville',  lat: 38.17, lng: -85.74 },
  { code: 'HKG', name: 'Hong Kong',   lat: 22.31, lng: 113.92 },
  { code: 'FRA', name: 'Frankfurt',   lat: 50.04, lng: 8.57   },
  { code: 'DXB', name: 'Dubai',       lat: 25.25, lng: 55.36  },
  { code: 'ANC', name: 'Anchorage',   lat: 61.17, lng: -149.99},
  { code: 'ORD', name: 'Chicago',     lat: 41.97, lng: -87.91 },
];

function dist(a, b) {
  return Math.sqrt((a.lat - b.lat) ** 2 + (a.lng - b.lng) ** 2);
}

function flightAltFl(f) {
  return Math.round((f.altitude || 10000) / 30.48);
}

function generateFlightEvent(flight) {
  if (!flight) return null;
  const cs = flight.callsign || flight.id || 'UNKNOWN';
  const fl = flightAltFl(flight);
  const spd = flight.velocity || 0;
  // Hub proximity
  const nearHub = HUB_CHECKS.find(h => dist(h, { lat: flight.lat, lng: flight.lng }) < 4.5);
  if (nearHub) return { name: cs, detail: `Approaching ${nearHub.name}`, fl, spd, warn: false, id: flight.id, ts: Date.now() };
  // Trans-Pacific
  if (flight.lng > -170 && flight.lng < -115 && Math.abs(flight.lat) < 65) {
    return { name: cs, detail: 'Trans-Pacific crossing', fl, spd, warn: false, id: flight.id, ts: Date.now() };
  }
  // Transatlantic
  if (flight.lng > -45 && flight.lng < -10 && flight.lat > 30 && flight.lat < 65) {
    return { name: cs, detail: 'Transatlantic crossing', fl, spd, warn: false, id: flight.id, ts: Date.now() };
  }
  // High altitude cruise
  if (fl > 370) return { name: cs, detail: `High-altitude cruise FL${fl}`, fl, spd, warn: false, id: flight.id, ts: Date.now() };
  // Default
  return {
    name: cs,
    detail: flight.destination ? `${flight.origin || '—'} \u2192 ${flight.destination}` : 'In transit',
    fl, spd, warn: false, id: flight.id, ts: Date.now(),
  };
}

function FGStats({ flights }) {
  const cargo = flights.filter(f => f.isCargo).length;
  const pax   = flights.filter(f => !f.isCargo).length;
  const avgFl      = flights.length
    ? Math.round(flights.reduce((s, f) => s + flightAltFl(f), 0) / flights.length)
    : 0;
  const avgSpd     = flights.length
    ? Math.round(flights.reduce((s, f) => s + (f.velocity || 0), 0) / flights.length)
    : 0;
  return (
    <div className="fg-stats">
      <div className="fg-stats-label">FLEET OVERVIEW</div>
      <div className="fg-stats-grid">
        <div className="fg-stat"><span className="fg-stat-val" style={{ color: '#94a3b8' }}>{flights.length}</span><span className="fg-stat-key">TOTAL</span></div>
        <div className="fg-stat"><span className="fg-stat-val" style={{ color: '#00d4ff' }}>{cargo}</span><span className="fg-stat-key">CARGO</span></div>
        <div className="fg-stat"><span className="fg-stat-val" style={{ color: '#a78bfa' }}>{pax || '\u2014'}</span><span className="fg-stat-key">PAX</span></div>
        <div className="fg-stat"><span className="fg-stat-val" style={{ color: '#10b981', fontSize: 13 }}>FL{avgFl || '\u2014'}</span><span className="fg-stat-key">AVG ALT</span></div>
      </div>
      {avgSpd > 0 && (
        <div className="fg-speed-strip">
          <RiPlaneLine size={10} />
          <span>Avg speed {avgSpd} kts &middot; {Math.round(avgSpd * 1.852)} km/h</span>
        </div>
      )}
    </div>
  );
}

function FGCarrierWatch({ flights }) {
  const carriers = useMemo(() => {
    const map = {};
    flights.forEach(f => {
      const prefix = (f.callsign || '').slice(0, 3).toUpperCase() || 'OTH';
      map[prefix] = (map[prefix] || 0) + 1;
    });
    return Object.entries(map).sort((a, b) => b[1] - a[1]).slice(0, 6);
  }, [flights]);
  const max = carriers[0]?.[1] || 1;
  if (!carriers.length) return null;
  return (
    <div className="fg-carriers">
      <div className="fg-section-label">CARRIER WATCH</div>
      {carriers.map(([code, count]) => (
        <div key={code} className="fg-carrier-row">
          <span className="fg-carrier-code">{code}</span>
          <span className="fg-carrier-name">{CARRIER_NAMES[code] || 'Cargo Airline'}</span>
          <div className="fg-carrier-bar">
            <div className="fg-carrier-fill" style={{ width: `${(count / max) * 100}%` }} />
          </div>
          <span className="fg-carrier-count">{count}</span>
        </div>
      ))}
    </div>
  );
}

function FGHotLanes({ flights }) {
  const lanes = useMemo(() => {
    const map = {};
    flights.forEach(f => {
      if (f.origin && f.destination) {
        const key = `${f.origin} \u2192 ${f.destination}`;
        map[key] = (map[key] || 0) + 1;
      }
    });
    return Object.entries(map).sort((a, b) => b[1] - a[1]).slice(0, 5);
  }, [flights]);
  if (!lanes.length) return null;
  return (
    <div className="fg-hotlanes">
      <div className="fg-section-label">HOT LANES</div>
      {lanes.map(([lane, count], i) => (
        <div key={lane} className="fg-lane-row">
          <span className="fg-lane-rank">#{i + 1}</span>
          <span className="fg-lane-name">{lane}</span>
          <span className="fg-lane-count">{count} ac</span>
        </div>
      ))}
    </div>
  );
}

function FGEventFeed({ flights, selectedFlight, onClear, onFeedFlightClick }) {
  const [events, setEvents] = useState([]);
  const timerRef  = useRef(null);
  const flightsRef = useRef(flights);
  useEffect(() => { flightsRef.current = flights; }, [flights]);

  useEffect(() => {
    if (!flightsRef.current.length) return;
    const push = () => {
      if (selectedFlight) return;
      const arr = flightsRef.current;
      const f   = arr[Math.floor(Math.random() * arr.length)];
      const ev  = generateFlightEvent(f);
      if (!ev) return;
      setEvents(prev => [ev, ...prev].slice(0, 8));
    };
    push();
    timerRef.current = setInterval(push, 3500);
    return () => clearInterval(timerRef.current);
  }, [selectedFlight]);

  if (selectedFlight) {
    const fl = flightAltFl(selectedFlight);
    return (
      <div className="fg-feed">
        <div className="fg-feed-label">
          AIRCRAFT DETAIL
          <button className="fg-feed-clear" onClick={onClear}>CLOSE</button>
        </div>
        <div className="fg-flight-detail">
          <div className="fg-fd-name">{selectedFlight.callsign || selectedFlight.id}</div>
          <div className="fg-fd-row"><span>Aircraft</span><span>{selectedFlight.aircraftType || '\u2014'}</span></div>
          <div className="fg-fd-row"><span>Altitude</span><span>FL{fl} ({Math.round((selectedFlight.altitude || 0) / 0.3048).toLocaleString()} ft)</span></div>
          <div className="fg-fd-row"><span>Speed</span><span>{selectedFlight.velocity || '\u2014'} kts</span></div>
          <div className="fg-fd-row"><span>Heading</span><span>{selectedFlight.heading?.toFixed(0) ?? '\u2014'}{selectedFlight.heading != null ? '\u00b0' : ''}</span></div>
          {selectedFlight.id?.startsWith('SIM') && (
            <div className="fg-fd-row"><span>Origin</span><span>{selectedFlight.origin || '\u2014'}</span></div>
          )}
          {selectedFlight.id?.startsWith('SIM') && (
            <div className="fg-fd-row"><span>Destination</span><span>{selectedFlight.destination || '\u2014'}</span></div>
          )}
          <div className="fg-fd-row"><span>Type</span><span>{selectedFlight.isCargo ? 'Cargo' : 'Passenger'}</span></div>
          {selectedFlight.id?.startsWith('SIM') && (
            <div className="fg-fd-sim">Simulated \u2014 set OPENSKY_CLIENT_ID + OPENSKY_CLIENT_SECRET for live data</div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="fg-feed">
      <div className="fg-feed-label">
        LIVE EVENT FEED
        <span className="fg-feed-pulse" />
      </div>
      <div className="fg-feed-list">
        {events.map((ev, i) => {
          const flight = ev.id ? flights.find(f => f.id === ev.id) : null;
          return (
            <div
              key={ev.ts + i}
              className={`fg-feed-card${flight ? ' fg-feed-card-clickable' : ''}`}
              onClick={() => flight && onFeedFlightClick && onFeedFlightClick(flight)}
            >
              <div className="fg-feed-card-top">
                <span className="fg-feed-callsign">{ev.name}</span>
                {ev.warn && <span className="fg-feed-warn"><RiAlertLine size={9} /> WARN</span>}
              </div>
              <div className="fg-feed-card-detail">{ev.detail} &middot; FL{ev.fl}</div>
            </div>
          );
        })}
        {events.length === 0 && (
          <div className="fg-feed-empty">
            <RiRadarLine size={22} />
            <span>Scanning...</span>
          </div>
        )}
      </div>
    </div>
  );
}

export default function FGPanel({ flights, selectedFlight, onClearFlight, onFeedFlightClick }) {
  return (
    <div className="fg-panel">
      <FGStats flights={flights} />
      <FGCarrierWatch flights={flights} />
      <FGHotLanes flights={flights} />
      <FGEventFeed
        flights={flights}
        selectedFlight={selectedFlight}
        onClear={onClearFlight}
        onFeedFlightClick={onFeedFlightClick}
      />
    </div>
  );
}
