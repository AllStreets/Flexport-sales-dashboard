import { useEffect, useRef, useState, useCallback } from 'react';
import Globe from 'react-globe.gl';
import './GlobeView.css';

const API = import.meta.env.VITE_API_URL || 'http://localhost:5000';

const OVERLAY_MODES = ['standard', 'tariff', 'disruption'];
const OVERLAY_LABELS = { standard: '🌐 Standard', tariff: '📋 Tariff Risk', disruption: '⚠️ Disruption' };

export default function GlobeView({ selectedProspect, onPortClick, fullscreen = false, onEnterFullscreen }) {
  const globeRef = useRef(null);
  const [globeData, setGlobeData] = useState({ shippingLanes: [], ports: [] });
  const [overlayMode, setOverlayMode] = useState(0);

  const getDimensions = (fs) => ({
    w: window.innerWidth,
    h: fs ? window.innerHeight : Math.floor(window.innerHeight * 0.55)
  });
  const [dimensions, setDimensions] = useState(() => getDimensions(false));

  useEffect(() => {
    fetch(`${API}/api/globe-data`).then(r => r.json()).then(setGlobeData).catch(console.error);
  }, []);

  useEffect(() => { setDimensions(getDimensions(fullscreen)); }, [fullscreen]);

  useEffect(() => {
    const handle = () => setDimensions(getDimensions(fullscreen));
    window.addEventListener('resize', handle);
    return () => window.removeEventListener('resize', handle);
  }, [fullscreen]);

  useEffect(() => {
    const g = globeRef.current;
    if (!g) return;
    if (selectedProspect) {
      g.controls().autoRotate = false;
      g.pointOfView({ lat: 37.7749, lng: -122.4194, altitude: 1.5 }, 1000);
    } else {
      g.controls().autoRotate = true;
      g.controls().autoRotateSpeed = 0.4;
    }
  }, [selectedProspect]);

  const originCoords = {
    'China': { lat: 31.2, lng: 121.5 }, 'Vietnam': { lat: 10.8, lng: 106.7 },
    'India': { lat: 19.0, lng: 72.8 }, 'Portugal': { lat: 38.7, lng: -9.1 },
    'Italy': { lat: 41.9, lng: 12.5 }, 'South Korea': { lat: 37.5, lng: 127.0 },
    'Bangladesh': { lat: 23.8, lng: 90.4 }, 'Malaysia': { lat: 3.1, lng: 101.7 },
    'Spain': { lat: 40.4, lng: -3.7 }, 'Philippines': { lat: 14.6, lng: 121.0 },
    'Cambodia': { lat: 11.6, lng: 104.9 }, 'Mexico': { lat: 19.4, lng: -99.1 },
    'Turkey': { lat: 41.0, lng: 28.9 }, 'Netherlands': { lat: 52.4, lng: 4.9 },
    'Singapore': { lat: 1.35, lng: 103.8 }, 'Peru': { lat: -12.0, lng: -77.0 },
    'Argentina': { lat: -34.6, lng: -58.4 }, 'Sweden': { lat: 59.3, lng: 18.1 },
  };

  // Overlay-aware arc color
  const mode = OVERLAY_MODES[overlayMode];
  const laneColor = (lane) => {
    if (mode === 'tariff') {
      const highTariff = ['Asia-US West Coast', 'China-Rotterdam', 'SE Asia-US East', 'Vietnam-US West'];
      return highTariff.some(l => lane.label?.includes(l.split('-')[0]))
        ? ['rgba(239,68,68,0.7)', 'rgba(239,68,68,0.7)']
        : ['rgba(16,185,129,0.6)', 'rgba(16,185,129,0.6)'];
    }
    if (mode === 'disruption') return ['rgba(251,191,36,0.7)', 'rgba(251,191,36,0.7)'];
    return ['rgba(0, 212, 255, 0.6)', 'rgba(0, 212, 255, 0.6)'];
  };

  const baseLanes = globeData.shippingLanes.map(lane => ({
    startLat: lane.src_lat, startLng: lane.src_lng,
    endLat: lane.dst_lat, endLng: lane.dst_lng,
    color: laneColor(lane), label: lane.label, weight: lane.weight, type: 'lane'
  }));

  // Particle layer (fast-dash overlay)
  const particleLanes = globeData.shippingLanes.map(lane => ({
    startLat: lane.src_lat, startLng: lane.src_lng,
    endLat: lane.dst_lat, endLng: lane.dst_lng,
    color: ['rgba(255,255,255,0.85)', 'rgba(255,255,255,0.85)'],
    weight: 0.4, type: 'particle'
  }));

  const prospectArcs = selectedProspect?.import_origins?.map(origin => {
    const coords = originCoords[origin];
    if (!coords) return null;
    return {
      startLat: coords.lat, startLng: coords.lng,
      endLat: 34.0, endLng: -118.2,
      color: ['rgba(255, 190, 50, 0.9)', 'rgba(255, 190, 50, 0.9)'],
      label: `${origin} → US (${selectedProspect.name})`, weight: 3, type: 'lane'
    };
  }).filter(Boolean) || [];

  const allArcs = [...baseLanes, ...particleLanes, ...prospectArcs];

  // Pulsing rings for disrupted/congested ports
  const rings = globeData.ports
    .filter(p => p.status === 'disruption' || p.status === 'congestion')
    .map(p => ({
      lat: p.lat, lng: p.lng,
      maxRadius: p.status === 'disruption' ? 4 : 2.5,
      propagationSpeed: p.status === 'disruption' ? 3 : 1.5,
      repeatPeriod: p.status === 'disruption' ? 800 : 1400,
      color: p.status === 'disruption' ? '#ef4444' : '#f59e0b'
    }));

  const portColor = useCallback((port) => {
    if (port.status === 'disruption') return '#ef4444';
    if (port.status === 'congestion') return '#f59e0b';
    return '#10b981';
  }, []);

  return (
    <div
      className={`globe-wrapper${fullscreen ? ' fullscreen' : ''}`}
      onClick={() => { if (!fullscreen) onEnterFullscreen?.(); }}
    >
      <Globe
        ref={globeRef}
        width={dimensions.w}
        height={dimensions.h}
        globeImageUrl="//unpkg.com/three-globe/example/img/earth-night.jpg"
        backgroundImageUrl="//unpkg.com/three-globe/example/img/night-sky.png"
        atmosphereColor="rgba(37, 99, 235, 0.2)"
        atmosphereAltitude={0.15}
        arcsData={allArcs}
        arcColor="color"
        arcDashLength={d => d.type === 'particle' ? 0.02 : 0.4}
        arcDashGap={d => d.type === 'particle' ? 0.12 : 0.2}
        arcDashAnimateTime={d => d.type === 'particle' ? 1400 : 3000}
        arcStroke={d => d.type === 'particle' ? 0.25 : (d.weight / 5)}
        arcLabel={d => d.type === 'particle' ? null : d.label}
        pointsData={globeData.ports}
        pointLat="lat"
        pointLng="lng"
        pointColor={portColor}
        pointAltitude={0.02}
        pointRadius={0.4}
        pointLabel={d => `<div class="globe-tooltip"><strong>${d.name}</strong><br/>Status: ${d.status}<br/>Congestion: ${d.congestion}/10</div>`}
        onPointClick={port => onPortClick?.(port)}
        ringsData={rings}
        ringColor="color"
        ringMaxRadius="maxRadius"
        ringPropagationSpeed="propagationSpeed"
        ringRepeatPeriod="repeatPeriod"
      />
      <div className="globe-legend">
        <span className="legend-item green">■ Clear</span>
        <span className="legend-item amber">■ Congestion</span>
        <span className="legend-item red">■ Disruption</span>
      </div>
      <button
        className="overlay-toggle"
        onClick={e => { e.stopPropagation(); setOverlayMode(m => (m + 1) % OVERLAY_MODES.length); }}
        title="Cycle globe overlay"
      >
        {OVERLAY_LABELS[mode]}
      </button>
    </div>
  );
}
