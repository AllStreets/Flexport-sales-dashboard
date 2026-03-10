import { useEffect, useRef, useState, useCallback } from 'react';
import { createPortal } from 'react-dom';
import Globe from 'react-globe.gl';
import * as THREE from 'three';
import { RiGlobalLine, RiPercentLine } from 'react-icons/ri';
import './GlobeView.css';

const API = import.meta.env.VITE_API_URL || 'http://localhost:5000';

const OVERLAY_MODES = ['standard', 'tariff'];
const OVERLAY_ICONS = { standard: RiGlobalLine, tariff: RiPercentLine };
const OVERLAY_LABELS = { standard: 'Standard', tariff: 'Tariff Risk' };

const statusColor = s => s === 'disruption' ? '#ef4444' : s === 'congestion' ? '#f59e0b' : '#10b981';

export default function GlobeView({ selectedProspect, onPortClick, fullscreen = false, onEnterFullscreen }) {
  const globeRef = useRef(null);
  const [globeData, setGlobeData] = useState({ shippingLanes: [], ports: [] });
  const [overlayMode, setOverlayMode] = useState(0);
  const [portDetail, setPortDetail] = useState(null);
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

  // Close port popup when exiting fullscreen
  useEffect(() => { if (!fullscreen) setPortDetail(null); }, [fullscreen]);

  // Derive the best globe POV from a prospect's primary_lanes
  function lanesPOV(prospect) {
    const lanes = (prospect?.primary_lanes || []).join(' ').toLowerCase();
    const east  = lanes.includes('east coast') || lanes.includes('trans-atlantic');
    const west  = lanes.includes('west coast') || lanes.includes('trans-pacific');
    const gulf  = lanes.includes('gulf');
    if (east && !west)  return { lat: 38.5,  lng: -72.0,  altitude: 1.5 }; // NY/NJ + Savannah
    if (west && !east)  return { lat: 33.7,  lng: -118.2, altitude: 1.5 }; // LA/Long Beach
    if (gulf && !east)  return { lat: 29.7,  lng: -90.0,  altitude: 1.5 }; // Gulf Coast
    if (east && west)   return { lat: 37.0,  lng: -95.0,  altitude: 2.2 }; // both coasts — pull back
    return { lat: 37.7749, lng: -122.4194, altitude: 1.5 };                 // fallback West Coast
  }

  useEffect(() => {
    const g = globeRef.current;
    if (!g) return;
    if (selectedProspect) {
      g.controls().autoRotate = false;
      g.pointOfView(lanesPOV(selectedProspect), 1000);
    } else {
      g.controls().autoRotate = true;
      g.controls().autoRotateSpeed = 0.4;
    }
  }, [selectedProspect]);

  useEffect(() => {
    let frame;
    const glowMeshRef = { current: null };
    const moonMeshRef = { current: null };
    const glowGeomRef = { current: null };
    const glowMatRef = { current: null };
    const moonGeomRef = { current: null };
    const moonMatRef = { current: null };

    const timer = setTimeout(() => {
      const g = globeRef.current;
      if (!g?.scene) return;
      const scene = g.scene();

      const glowGeom = new THREE.SphereGeometry(105, 32, 32);
      const glowMat = new THREE.ShaderMaterial({
        uniforms: { c: { value: 0.18 }, p: { value: 3.0 } },
        vertexShader: `
          varying vec3 vNormal;
          void main() {
            vNormal = normalize(normalMatrix * normal);
            gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
          }`,
        fragmentShader: `
          uniform float c;
          uniform float p;
          varying vec3 vNormal;
          void main() {
            float intensity = pow(c - dot(vNormal, vec3(0.0, 0.0, 1.0)), p);
            gl_FragColor = vec4(0.0, 0.83, 1.0, max(0.0, intensity));
          }`,
        side: THREE.FrontSide,
        blending: THREE.AdditiveBlending,
        transparent: true,
        depthWrite: false,
      });
      const glowMesh = new THREE.Mesh(glowGeom, glowMat);
      scene.add(glowMesh);
      glowMeshRef.current = glowMesh;
      glowGeomRef.current = glowGeom;
      glowMatRef.current = glowMat;

      const moonGeom = new THREE.SphereGeometry(3.5, 32, 32);
      const moonMat = new THREE.MeshStandardMaterial({ roughness: 0.9, metalness: 0.0 });
      new THREE.TextureLoader().load(
        'https://unpkg.com/three-globe/example/img/earth-night.jpg', // fallback while moon loads
        () => {},
        () => {}
      );
      new THREE.TextureLoader().load(
        'https://raw.githubusercontent.com/mrdoob/three.js/master/examples/textures/planets/moon_1024.jpg',
        (tex) => { moonMat.map = tex; moonMat.needsUpdate = true; },
        undefined,
        () => {
          // fallback: procedural grey crater texture via canvas
          const size = 256;
          const canvas = document.createElement('canvas');
          canvas.width = size; canvas.height = size;
          const ctx = canvas.getContext('2d');
          ctx.fillStyle = '#7a7a7a';
          ctx.fillRect(0, 0, size, size);
          const craters = [[80,60,22],[180,100,18],[130,180,14],[50,170,10],[200,200,16],[100,120,8],[160,50,12],[220,140,9]];
          craters.forEach(([x,y,r]) => {
            const g = ctx.createRadialGradient(x-r*0.3,y-r*0.3,r*0.1,x,y,r);
            g.addColorStop(0,'#999'); g.addColorStop(0.4,'#5a5a5a'); g.addColorStop(1,'#707070');
            ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x,y,r,0,Math.PI*2); ctx.fill();
          });
          const fallbackTex = new THREE.CanvasTexture(canvas);
          moonMat.map = fallbackTex; moonMat.needsUpdate = true;
        }
      );
      const moonMesh = new THREE.Mesh(moonGeom, moonMat);
      scene.add(moonMesh);
      moonMeshRef.current = moonMesh;
      moonGeomRef.current = moonGeom;
      moonMatRef.current = moonMat;

      const animate = () => {
        const t = Date.now() * 0.00008;
        moonMesh.position.set(
          Math.cos(t) * 165,
          Math.sin(t * 0.28) * 28,
          Math.sin(t) * 165
        );
        frame = requestAnimationFrame(animate);
      };
      animate();
    }, 500);

    return () => {
      clearTimeout(timer);
      if (frame) cancelAnimationFrame(frame);
      const scene = globeRef.current?.scene?.();
      if (scene) {
        if (glowMeshRef.current) scene.remove(glowMeshRef.current);
        if (moonMeshRef.current) scene.remove(moonMeshRef.current);
      }
      glowGeomRef.current?.dispose();
      glowMatRef.current?.dispose();
      moonGeomRef.current?.dispose();
      if (moonMatRef.current?.map) moonMatRef.current.map.dispose();
      moonMatRef.current?.dispose();
    };
  }, []);

  const originCoords = {
    // Asia-Pacific
    'China': { lat: 31.2, lng: 121.5 }, 'Vietnam': { lat: 10.8, lng: 106.7 },
    'India': { lat: 19.0, lng: 72.8 }, 'South Korea': { lat: 37.5, lng: 127.0 },
    'Bangladesh': { lat: 23.8, lng: 90.4 }, 'Malaysia': { lat: 3.1, lng: 101.7 },
    'Philippines': { lat: 14.6, lng: 121.0 }, 'Cambodia': { lat: 11.6, lng: 104.9 },
    'Singapore': { lat: 1.35, lng: 103.8 }, 'Japan': { lat: 35.7, lng: 139.7 },
    'Taiwan': { lat: 25.0, lng: 121.5 }, 'Thailand': { lat: 13.8, lng: 100.5 },
    'Indonesia': { lat: -6.2, lng: 106.8 }, 'Sri Lanka': { lat: 6.9, lng: 79.9 },
    'New Zealand': { lat: -36.9, lng: 174.8 },
    // Europe
    'Italy': { lat: 41.9, lng: 12.5 }, 'Portugal': { lat: 38.7, lng: -9.1 },
    'Spain': { lat: 40.4, lng: -3.7 }, 'Netherlands': { lat: 52.4, lng: 4.9 },
    'Sweden': { lat: 59.3, lng: 18.1 }, 'Turkey': { lat: 41.0, lng: 28.9 },
    'France': { lat: 48.9, lng: 2.4 }, 'Germany': { lat: 52.5, lng: 13.4 },
    'Finland': { lat: 60.2, lng: 24.9 }, 'Belgium': { lat: 50.8, lng: 4.4 },
    'Austria': { lat: 48.2, lng: 16.4 }, 'Switzerland': { lat: 47.4, lng: 8.5 },
    // Americas
    'Mexico': { lat: 19.4, lng: -99.1 }, 'Peru': { lat: -12.0, lng: -77.0 },
    'Argentina': { lat: -34.6, lng: -58.4 }, 'Brazil': { lat: -23.5, lng: -46.6 },
    'Colombia': { lat: 4.7, lng: -74.1 }, 'Chile': { lat: -33.5, lng: -70.6 },
    // Africa / Middle East
    'Morocco': { lat: 33.6, lng: -7.6 }, 'USA': { lat: 37.8, lng: -96.0 },
  };

  const mode = OVERLAY_MODES[overlayMode];

  // Find the closest port to a lane's source coords (within 1.5° tolerance)
  const srcPortStatus = (lane) => {
    const p = globeData.ports.find(
      pt => Math.abs(pt.lat - lane.src_lat) < 1.5 && Math.abs(pt.lng - lane.src_lng) < 1.5
    );
    return p?.status || 'clear';
  };

  // High-tariff origin prefixes for tariff overlay
  const HIGH_TARIFF_PREFIXES = ['China', 'SE Asia', 'Vietnam', 'Taiwan', 'Korea'];

  const laneColor = (lane) => {
    if (mode === 'tariff') {
      return HIGH_TARIFF_PREFIXES.some(p => lane.label?.startsWith(p))
        ? ['rgba(239,68,68,0.7)', 'rgba(239,68,68,0.7)']
        : ['rgba(16,185,129,0.6)', 'rgba(16,185,129,0.6)'];
    }
    const status = srcPortStatus(lane);
    if (status === 'disruption') return ['rgba(239,68,68,0.75)', 'rgba(239,68,68,0.75)'];
    if (status === 'congestion') return ['rgba(245,158,11,0.75)', 'rgba(245,158,11,0.75)'];
    return ['rgba(0, 212, 255, 0.6)', 'rgba(0, 212, 255, 0.6)'];
  };

  const baseLanes = globeData.shippingLanes.map(lane => ({
    startLat: lane.src_lat, startLng: lane.src_lng,
    endLat: lane.dst_lat, endLng: lane.dst_lng,
    color: laneColor(lane), label: lane.label, weight: lane.weight, type: 'lane'
  }));

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

  const rings = globeData.ports
    .filter(p => p.status === 'disruption' || p.status === 'congestion')
    .map(p => ({
      lat: p.lat, lng: p.lng,
      maxRadius: p.status === 'disruption' ? 4 : 2.5,
      propagationSpeed: p.status === 'disruption' ? 3 : 1.5,
      repeatPeriod: p.status === 'disruption' ? 800 : 1400,
      color: p.status === 'disruption' ? '#ef4444' : '#f59e0b'
    }));

  const portColor = useCallback((port) => statusColor(port.status), []);

  const handlePortClick = (port) => {
    setPortDetail(port);
    onPortClick?.(port);
  };

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
        atmosphereColor="rgba(0, 180, 255, 0.25)"
        atmosphereAltitude={0.18}
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
        onPointClick={handlePortClick}
        ringsData={rings}
        ringColor="color"
        ringMaxRadius="maxRadius"
        ringPropagationSpeed="propagationSpeed"
        ringRepeatPeriod="repeatPeriod"
      />

      <div className="globe-legend">
        <span className="legend-item" style={{ color: mode === 'tariff' ? '#10b981' : '#00d4ff' }}>■ Clear</span>
        <span className="legend-item amber">■ Congestion</span>
        <span className="legend-item red">■ Disruption</span>
      </div>

      {/* Overlay mode toggle — in fullscreen, portalled to document.body to escape stacking context */}
      {(() => {
        const Icon = OVERLAY_ICONS[mode];
        const btn = (
          <button
            className={`overlay-toggle${fullscreen ? ' overlay-toggle--fs' : ''}`}
            onClick={e => { e.stopPropagation(); setOverlayMode(m => (m + 1) % OVERLAY_MODES.length); }}
            title="Cycle globe overlay"
          >
            <Icon size={12} />{' '}{OVERLAY_LABELS[mode]}
          </button>
        );
        return fullscreen ? createPortal(btn, document.body) : btn;
      })()}

      {/* Port detail popup — rendered inside the wrapper so it layers above the globe in fullscreen */}
      {portDetail && (
        <div
          className={`port-popup${fullscreen ? ' port-popup--fs' : ''}`}
          onClick={e => { e.stopPropagation(); setPortDetail(null); }}
        >
          <div className="port-popup-inner" onClick={e => e.stopPropagation()}>
            <div className="port-popup-header">
              <span
                className="port-popup-dot"
                style={{ background: statusColor(portDetail.status) }}
              />
              <strong className="port-popup-name">{portDetail.name}</strong>
              <button className="port-popup-close" onClick={() => setPortDetail(null)}>✕</button>
            </div>
            <div className="port-popup-row">
              <span className="port-popup-label">Status</span>
              <span className="port-popup-val" style={{ color: statusColor(portDetail.status), textTransform: 'capitalize' }}>
                {portDetail.status}
              </span>
            </div>
            <div className="port-popup-row">
              <span className="port-popup-label">Congestion</span>
              <span className="port-popup-val">{portDetail.congestion}/10</span>
            </div>
            {portDetail.signalHit && (
              <div className="port-popup-signal">Signal detected in recent news</div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
