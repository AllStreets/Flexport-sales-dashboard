import { useEffect, useRef, useState, useCallback } from 'react';
import Globe from 'react-globe.gl';
import './GlobeView.css';

const API = import.meta.env.VITE_API_URL || 'http://localhost:5000';

export default function GlobeView({ selectedProspect, onPortClick, fullscreen = false, onEnterFullscreen }) {
  const globeRef = useRef(null);
  const [globeData, setGlobeData] = useState({ shippingLanes: [], ports: [] });

  const getDimensions = (fs) => ({
    w: window.innerWidth,
    h: fs ? window.innerHeight : Math.floor(window.innerHeight * 0.55)
  });
  const [dimensions, setDimensions] = useState(() => getDimensions(false));

  useEffect(() => {
    fetch(`${API}/api/globe-data`).then(r => r.json()).then(setGlobeData).catch(console.error);
  }, []);

  useEffect(() => {
    setDimensions(getDimensions(fullscreen));
  }, [fullscreen]);

  useEffect(() => {
    const handle = () => setDimensions(getDimensions(fullscreen));
    window.addEventListener('resize', handle);
    return () => window.removeEventListener('resize', handle);
  }, [fullscreen]);

  // Auto-rotate unless a prospect is selected
  useEffect(() => {
    const g = globeRef.current;
    if (!g) return;
    if (selectedProspect) {
      g.controls().autoRotate = false;
      // Zoom to prospect HQ (approximate)
      g.pointOfView({ lat: 37.7749, lng: -122.4194, altitude: 1.5 }, 1000);
    } else {
      g.controls().autoRotate = true;
      g.controls().autoRotateSpeed = 0.4;
    }
  }, [selectedProspect]);

  // Build arcs: base lanes + prospect-specific origin arcs
  const arcs = (() => {
    const base = globeData.shippingLanes.map(lane => ({
      startLat: lane.src_lat, startLng: lane.src_lng,
      endLat: lane.dst_lat,   endLng: lane.dst_lng,
      color: ['rgba(0, 212, 255, 0.6)', 'rgba(0, 212, 255, 0.6)'],
      label: lane.label, weight: lane.weight
    }));

    if (!selectedProspect?.import_origins) return base;

    const originCoords = {
      'China': { lat: 31.2, lng: 121.5 },
      'Vietnam': { lat: 10.8, lng: 106.7 },
      'India': { lat: 19.0, lng: 72.8 },
      'Portugal': { lat: 38.7, lng: -9.1 },
      'Italy': { lat: 41.9, lng: 12.5 },
      'South Korea': { lat: 37.5, lng: 127.0 },
      'Bangladesh': { lat: 23.8, lng: 90.4 },
      'Malaysia': { lat: 3.1, lng: 101.7 },
      'Austria': { lat: 48.2, lng: 16.4 },
      'Spain': { lat: 40.4, lng: -3.7 },
      'Philippines': { lat: 14.6, lng: 121.0 },
      'Cambodia': { lat: 11.6, lng: 104.9 },
      'Costa Rica': { lat: 9.9, lng: -84.1 },
      'Peru': { lat: -12.0, lng: -77.0 },
      'Mexico': { lat: 19.4, lng: -99.1 },
      'Turkey': { lat: 41.0, lng: 28.9 },
      'Argentina': { lat: -34.6, lng: -58.4 },
      'Netherlands': { lat: 52.4, lng: 4.9 },
      'Sweden': { lat: 59.3, lng: 18.1 },
      'Singapore': { lat: 1.35, lng: 103.8 }
    };

    const usCoords = { lat: 34.0, lng: -118.2 }; // LA port
    const prospectArcs = selectedProspect.import_origins.map(origin => {
      const coords = originCoords[origin];
      if (!coords) return null;
      return {
        startLat: coords.lat, startLng: coords.lng,
        endLat: usCoords.lat, endLng: usCoords.lng,
        color: ['rgba(255, 190, 50, 0.9)', 'rgba(255, 190, 50, 0.9)'],
        label: `${origin} → US (${selectedProspect.name})`,
        weight: 3
      };
    }).filter(Boolean);

    return [...base, ...prospectArcs];
  })();

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
        arcsData={arcs}
        arcColor="color"
        arcDashLength={0.4}
        arcDashGap={0.2}
        arcDashAnimateTime={3000}
        arcStroke={d => (d.weight / 5)}
        arcLabel="label"
        pointsData={globeData.ports}
        pointLat="lat"
        pointLng="lng"
        pointColor={portColor}
        pointAltitude={0.02}
        pointRadius={0.4}
        pointLabel={d => `<div class="globe-tooltip"><strong>${d.name}</strong><br/>Status: ${d.status}<br/>Congestion: ${d.congestion}/10</div>`}
        onPointClick={port => onPortClick?.(port)}
      />
      <div className="globe-legend">
        <span className="legend-item green">■ Clear</span>
        <span className="legend-item amber">■ Congestion</span>
        <span className="legend-item red">■ Disruption</span>
      </div>
    </div>
  );
}
