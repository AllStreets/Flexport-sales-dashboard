// frontend/src/components/LGPanel.jsx
import { useState, useEffect, useRef, useMemo } from 'react';
import { RiTruckLine, RiAlertLine, RiRadarLine } from 'react-icons/ri';

const CARRIER_DISPLAY = {
  'JB Hunt':      'JB Hunt Transport',
  'Werner':       'Werner Enterprises',
  'Schneider':    'Schneider National',
  'XPO':          'XPO Logistics',
  'Old Dominion': 'Old Dominion Freight',
  'DB Schenker':  'DB Schenker',
  'DHL Freight':  'DHL Freight',
};

const HUB_CHECKS = [
  { name: 'Memphis',     lat: 35.04, lng: -90.00 },
  { name: 'Louisville',  lat: 38.17, lng: -85.74 },
  { name: 'Chicago',     lat: 41.97, lng: -87.91 },
  { name: 'Dallas',      lat: 32.90, lng: -97.04 },
  { name: 'Los Angeles', lat: 34.05, lng: -118.24 },
  { name: 'Rotterdam',   lat: 51.95, lng: 4.13   },
  { name: 'Frankfurt',   lat: 50.10, lng: 8.68   },
  { name: 'Dubai',       lat: 25.20, lng: 55.27  },
];

const BORDER_CHECKS = [
  { name: 'Laredo',       lat: 27.5,  lng: -99.5 },
  { name: 'Dover/Calais', lat: 51.1,  lng: 1.8   },
  { name: 'Khorgos',      lat: 44.2,  lng: 80.2  },
];

function dist(a, b) {
  return Math.sqrt((a.lat - b.lat) ** 2 + (a.lng - b.lng) ** 2);
}

function generateTruckEvent(truck) {
  if (!truck) return null;
  const spd = truck.velocity || 0;
  const nearHub = HUB_CHECKS.find(h => dist(h, { lat: truck.lat, lng: truck.lng }) < 3.5);
  if (nearHub) return { name: truck.callsign, detail: `Approaching ${nearHub.name} hub`, spd, warn: false, id: truck.id, ts: Date.now() };
  const nearBorder = BORDER_CHECKS.find(h => dist(h, { lat: truck.lat, lng: truck.lng }) < 5);
  if (nearBorder) return { name: truck.callsign, detail: `Border crossing: ${nearBorder.name}`, spd, warn: false, id: truck.id, ts: Date.now() };
  return {
    name: truck.callsign,
    detail: truck.destination ? `${truck.origin || '\u2014'} \u2192 ${truck.destination}` : 'In transit',
    spd, warn: false, id: truck.id, ts: Date.now(),
  };
}

function LGStats({ trucks }) {
  const regular = trucks.filter(t => t.type === 'regular').length;
  const tank    = trucks.filter(t => t.type === 'tank').length;
  const avgSpd  = trucks.length
    ? Math.round(trucks.reduce((s, t) => s + (t.velocity || 0), 0) / trucks.length)
    : 0;
  return (
    <div className="lg-stats">
      <div className="lg-stats-label">FLEET OVERVIEW</div>
      <div className="lg-stats-grid">
        <div className="lg-stat"><span className="lg-stat-val" style={{ color: '#94a3b8' }}>{trucks.length}</span><span className="lg-stat-key">TOTAL</span></div>
        <div className="lg-stat"><span className="lg-stat-val" style={{ color: '#00d4ff' }}>{regular}</span><span className="lg-stat-key">SEMI</span></div>
        <div className="lg-stat"><span className="lg-stat-val" style={{ color: '#fb923c' }}>{tank}</span><span className="lg-stat-key">TANK</span></div>
        <div className="lg-stat"><span className="lg-stat-val" style={{ color: '#10b981', fontSize: 13 }}>{avgSpd || '\u2014'}</span><span className="lg-stat-key">AVG MPH</span></div>
      </div>
      {avgSpd > 0 && (
        <div className="lg-speed-strip">
          <RiTruckLine size={10} />
          <span>Avg speed {avgSpd} mph &middot; {Math.round(avgSpd * 1.609)} km/h</span>
        </div>
      )}
    </div>
  );
}

function LGCarrierWatch({ trucks }) {
  const carriers = useMemo(() => {
    const map = {};
    trucks.forEach(t => { map[t.carrier] = (map[t.carrier] || 0) + 1; });
    return Object.entries(map).sort((a, b) => b[1] - a[1]).slice(0, 6);
  }, [trucks]);
  const max = carriers[0]?.[1] || 1;
  if (!carriers.length) return null;
  return (
    <div className="lg-carriers">
      <div className="lg-section-label">CARRIER WATCH</div>
      {carriers.map(([name, count]) => (
        <div key={name} className="lg-carrier-row">
          <span className="lg-carrier-code">{name.split(' ')[0].slice(0, 5)}</span>
          <span className="lg-carrier-name">{CARRIER_DISPLAY[name] || name}</span>
          <div className="lg-carrier-bar">
            <div className="lg-carrier-fill" style={{ width: `${(count / max) * 100}%` }} />
          </div>
          <span className="lg-carrier-count">{count}</span>
        </div>
      ))}
    </div>
  );
}

function LGHotCorridors({ trucks }) {
  const corridors = useMemo(() => {
    const map = {};
    trucks.forEach(t => {
      if (t.origin && t.destination) {
        const key = `${t.origin} \u2192 ${t.destination}`;
        map[key] = (map[key] || 0) + 1;
      }
    });
    return Object.entries(map).sort((a, b) => b[1] - a[1]).slice(0, 5);
  }, [trucks]);
  if (!corridors.length) return null;
  return (
    <div className="lg-corridors">
      <div className="lg-section-label">HOT CORRIDORS</div>
      {corridors.map(([lane, count], i) => (
        <div key={lane} className="lg-corridor-row">
          <span className="lg-corridor-rank">#{i + 1}</span>
          <span className="lg-corridor-name">{lane}</span>
          <span className="lg-corridor-count">{count} trucks</span>
        </div>
      ))}
    </div>
  );
}

function LGEventFeed({ trucks, selectedTruck, onClear, onFeedTruckClick }) {
  const [events, setEvents] = useState([]);
  const timerRef  = useRef(null);
  const trucksRef = useRef(trucks);
  useEffect(() => { trucksRef.current = trucks; }, [trucks]);

  useEffect(() => {
    if (!trucksRef.current.length) return;
    const push = () => {
      if (selectedTruck) return;
      const arr = trucksRef.current;
      const t   = arr[Math.floor(Math.random() * arr.length)];
      const ev  = generateTruckEvent(t);
      if (!ev) return;
      setEvents(prev => [ev, ...prev].slice(0, 8));
    };
    push();
    timerRef.current = setInterval(push, 3500);
    return () => clearInterval(timerRef.current);
  }, [selectedTruck]);

  if (selectedTruck) {
    return (
      <div className="lg-feed">
        <div className="lg-feed-label">
          VEHICLE DETAIL
          <button className="lg-feed-clear" onClick={onClear}>CLOSE</button>
        </div>
        <div className="lg-truck-detail">
          <div className="lg-td-name">{selectedTruck.callsign}</div>
          <div className="lg-td-row"><span>Carrier</span><span>{selectedTruck.carrier}</span></div>
          <div className="lg-td-row"><span>Type</span><span>{selectedTruck.type === 'tank' ? 'Tank Truck' : 'Semi-Truck'}</span></div>
          <div className="lg-td-row"><span>Speed</span><span>{selectedTruck.velocity || '\u2014'} mph</span></div>
          <div className="lg-td-row"><span>Heading</span><span>{selectedTruck.heading?.toFixed(0) ?? '\u2014'}{selectedTruck.heading != null ? '\u00b0' : ''}</span></div>
          <div className="lg-td-row"><span>Origin</span><span>{selectedTruck.origin || '\u2014'}</span></div>
          <div className="lg-td-row"><span>Destination</span><span>{selectedTruck.destination || '\u2014'}</span></div>
          <div className="lg-td-row"><span>Progress</span><span>{selectedTruck.progress != null ? `${Math.round(selectedTruck.progress * 100)}%` : '\u2014'}</span></div>
        </div>
      </div>
    );
  }

  return (
    <div className="lg-feed">
      <div className="lg-feed-label">
        LIVE EVENT FEED
        <span className="lg-feed-pulse" />
      </div>
      <div className="lg-feed-list">
        {events.map((ev, i) => {
          const truck = ev.id ? trucks.find(t => t.id === ev.id) : null;
          return (
            <div
              key={ev.ts + i}
              className={`lg-feed-card${truck ? ' lg-feed-card-clickable' : ''}`}
              onClick={() => truck && onFeedTruckClick?.(truck)}
            >
              <div className="lg-feed-card-top">
                <span className="lg-feed-callsign">{ev.name}</span>
                {ev.warn && <span className="lg-feed-warn"><RiAlertLine size={9} /> WARN</span>}
              </div>
              <div className="lg-feed-card-detail">{ev.detail} &middot; {ev.spd} mph</div>
            </div>
          );
        })}
        {events.length === 0 && (
          <div className="lg-feed-empty">
            <RiRadarLine size={22} />
            <span>Scanning...</span>
          </div>
        )}
      </div>
    </div>
  );
}

export default function LGPanel({ trucks, selectedTruck, onClearTruck, onFeedTruckClick }) {
  return (
    <div className="lg-panel">
      <LGStats trucks={trucks} />
      <LGCarrierWatch trucks={trucks} />
      <LGHotCorridors trucks={trucks} />
      <LGEventFeed
        trucks={trucks}
        selectedTruck={selectedTruck}
        onClear={onClearTruck}
        onFeedTruckClick={onFeedTruckClick}
      />
    </div>
  );
}
