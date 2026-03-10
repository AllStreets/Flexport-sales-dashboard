// frontend/src/components/VesselsGlobe.jsx
import { useEffect, useRef, useMemo, useCallback } from 'react';
import Globe from 'react-globe.gl';
import * as THREE from 'three';

const DISRUPTION_ZONES = [
  { lat: 26.5, lng: 56.5, label: 'Strait of Hormuz', color: '#ef4444', maxRadius: 5, propagationSpeed: 3, repeatPeriod: 700 },
  { lat: 13.5, lng: 43.5, label: 'Red Sea / Bab-el-Mandeb', color: '#f59e0b', maxRadius: 4, propagationSpeed: 2, repeatPeriod: 900 },
  { lat: 31.5, lng: 32.3, label: 'Suez Canal', color: '#f59e0b', maxRadius: 3, propagationSpeed: 1.8, repeatPeriod: 1100 },
];

const MAJOR_PORTS = [
  { lat: 31.2, lng: 121.5, name: 'Shanghai' },
  { lat: 1.35, lng: 103.8, name: 'Singapore' },
  { lat: 51.9, lng: 4.5,   name: 'Rotterdam' },
  { lat: 33.7, lng: -118.2, name: 'Los Angeles' },
  { lat: 22.3, lng: 114.2, name: 'Hong Kong' },
  { lat: 53.5, lng: 10.0,  name: 'Hamburg' },
  { lat: 25.2, lng: 55.3,  name: 'Dubai (Jebel Ali)' },
  { lat: 35.4, lng: 139.6, name: 'Tokyo / Yokohama' },
];

function vesselColor(type = '') {
  if (type.includes('Tanker')) return 'rgba(245,158,11,0.9)';
  if (type.includes('Bulk'))   return 'rgba(167,139,250,0.9)';
  return 'rgba(0,212,255,0.9)';
}

// Given a vessel's current position + COG + SOG, compute N ghost positions trailing behind it
function trailArcs(vessel, steps = 3) {
  if (!vessel.cog && !vessel.sog) return [];
  const sogKm = (vessel.sog || 14) * 1.852; // knots → km/h
  const cog = (vessel.cog || 0) * Math.PI / 180;
  const R = 6371; // Earth radius km
  const arcs = [];
  // step = 2 hours of travel
  for (let i = 1; i <= steps; i++) {
    const dist = (sogKm * 2 * i) / R;
    const lat1 = vessel.lat * Math.PI / 180;
    const lng1 = vessel.lng * Math.PI / 180;
    const lat2 = Math.asin(Math.sin(lat1) * Math.cos(dist) + Math.cos(lat1) * Math.sin(dist) * Math.cos(cog + Math.PI));
    const lng2 = lng1 + Math.atan2(Math.sin(cog + Math.PI) * Math.sin(dist) * Math.cos(lat1), Math.cos(dist) - Math.sin(lat1) * Math.sin(lat2));
    const opacity = (steps - i + 1) / steps * 0.35;
    const baseColor = vesselColor(vessel.type);
    const color = baseColor.replace(/[\d.]+\)$/, `${opacity})`);
    arcs.push({
      startLat: vessel.lat, startLng: vessel.lng,
      endLat: lat2 * 180 / Math.PI, endLng: lng2 * 180 / Math.PI,
      color: [color, 'rgba(0,0,0,0)'],
      mmsi: vessel.mmsi, trailStep: i
    });
  }
  return arcs;
}

export default function VesselsGlobe({ vessels = [], onVesselClick, width, height }) {
  const globeRef = useRef(null);

  // Build canvas globe texture — deep ocean focused, no external URLs
  const globeTexture = useMemo(() => {
    const c = document.createElement('canvas');
    c.width = 2048; c.height = 1024;
    const ctx = c.getContext('2d');

    // Deep ocean base
    const oceanGrad = ctx.createLinearGradient(0, 0, 0, 1024);
    oceanGrad.addColorStop(0, '#020810');
    oceanGrad.addColorStop(0.5, '#03111e');
    oceanGrad.addColorStop(1, '#020810');
    ctx.fillStyle = oceanGrad;
    ctx.fillRect(0, 0, 2048, 1024);

    // Ocean depth variation patches
    [[1024, 512, 400], [400, 350, 250], [1500, 600, 300], [700, 150, 180]].forEach(([x, y, r]) => {
      const g = ctx.createRadialGradient(x, y, 0, x, y, r);
      g.addColorStop(0, 'rgba(1,10,21,0.6)');
      g.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = g; ctx.fillRect(0, 0, 2048, 1024);
    });

    // Land masses — flat muted grey-green ellipses
    ctx.fillStyle = '#0d1c18';
    const LAND = [
      // North America
      [180, 180, 220, 280],
      // South America
      [260, 440, 120, 240],
      // Europe
      [820, 140, 120, 140],
      // Africa
      [860, 310, 160, 300],
      // Asia
      [960, 100, 480, 280],
      // Australia
      [1360, 540, 180, 160],
      // Greenland
      [320, 60, 120, 120],
    ];
    LAND.forEach(([x, y, w, h]) => {
      ctx.beginPath();
      ctx.ellipse(x + w / 2, y + h / 2, w / 2, h / 2, 0, 0, Math.PI * 2);
      ctx.fill();
    });

    // Coastline shimmer
    ctx.strokeStyle = 'rgba(0,212,255,0.07)';
    ctx.lineWidth = 2;
    LAND.forEach(([x, y, w, h]) => {
      ctx.beginPath();
      ctx.ellipse(x + w / 2, y + h / 2, w / 2 + 3, h / 2 + 3, 0, 0, Math.PI * 2);
      ctx.stroke();
    });

    // Latitude/longitude grid — very faint
    ctx.strokeStyle = 'rgba(0,212,255,0.03)';
    ctx.lineWidth = 1;
    for (let lat = -80; lat <= 80; lat += 20) {
      const y = (90 - lat) / 180 * 1024;
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(2048, y); ctx.stroke();
    }
    for (let lng = -180; lng <= 180; lng += 30) {
      const x = (lng + 180) / 360 * 2048;
      ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, 1024); ctx.stroke();
    }

    return c.toDataURL();
  }, []);

  // Custom atmosphere shader + rotating equatorial ring
  useEffect(() => {
    let frame;
    let glowMesh, glowGeom, glowMat, ringMesh, ringGeom, ringMat;
    const timer = setTimeout(() => {
      const g = globeRef.current;
      if (!g?.scene) return;
      const scene = g.scene();

      glowGeom = new THREE.SphereGeometry(105, 32, 32);
      glowMat = new THREE.ShaderMaterial({
        uniforms: { c: { value: 0.22 }, p: { value: 4.5 } },
        vertexShader: `varying vec3 vNormal; void main() { vNormal = normalize(normalMatrix * normal); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
        fragmentShader: `uniform float c; uniform float p; varying vec3 vNormal; void main() { float i = pow(c - dot(vNormal, vec3(0.0,0.0,1.0)), p); gl_FragColor = vec4(0.0,0.6,1.0,max(0.0,i)); }`,
        side: THREE.FrontSide, blending: THREE.AdditiveBlending, transparent: true, depthWrite: false,
      });
      glowMesh = new THREE.Mesh(glowGeom, glowMat);
      scene.add(glowMesh);

      ringGeom = new THREE.TorusGeometry(102, 0.6, 8, 64);
      ringMat = new THREE.MeshBasicMaterial({ color: 0x004466, transparent: true, opacity: 0.4 });
      ringMesh = new THREE.Mesh(ringGeom, ringMat);
      ringMesh.rotation.x = Math.PI / 2;
      scene.add(ringMesh);

      const animRing = () => {
        ringMesh.rotation.z += 0.001;
        frame = requestAnimationFrame(animRing);
      };
      animRing();
    }, 600);

    return () => {
      clearTimeout(timer);
      if (frame) cancelAnimationFrame(frame);
      const scene = globeRef.current?.scene?.();
      if (scene) {
        if (glowMesh) scene.remove(glowMesh);
        if (ringMesh) scene.remove(ringMesh);
      }
      glowGeom?.dispose(); glowMat?.dispose(); ringGeom?.dispose(); ringMat?.dispose();
    };
  }, []);

  // Auto-rotate with damping — deferred to match globe async init
  useEffect(() => {
    const timer = setTimeout(() => {
      const g = globeRef.current;
      if (!g) return;
      const controls = g.controls();
      if (!controls) return;
      controls.autoRotate = true;
      controls.autoRotateSpeed = 0.3;
      controls.enableDamping = true;
      controls.dampingFactor = 0.08;
    }, 600);
    return () => clearTimeout(timer);
  }, []);

  const vesselPoints = useMemo(() => vessels.map(v => ({
    ...v,
    color: vesselColor(v.type),
    size: 0.35,
  })), [vessels]);

  const trailData = useMemo(() =>
    vessels.flatMap(v => trailArcs(v, 3)), [vessels]);

  const handleVesselClick = useCallback((point) => {
    const g = globeRef.current;
    if (g) {
      g.controls().autoRotate = false;
      g.pointOfView({ lat: point.lat, lng: point.lng, altitude: 1.2 }, 800);
    }
    onVesselClick?.(point);
  }, [onVesselClick]);

  const portLabel = useCallback((p) =>
    `<div style="color:#00d4ff;font-size:10px;font-family:'JetBrains Mono',monospace;background:rgba(6,11,24,0.85);padding:2px 6px;border-radius:4px;border:1px solid rgba(0,212,255,0.2)">${p.name}</div>`, []);

  const vesselLabel = useCallback((v) =>
    `<div style="color:#e2e8f0;font-size:11px;background:rgba(6,11,24,0.9);padding:4px 8px;border-radius:6px;border:1px solid rgba(0,212,255,0.25);font-family:'JetBrains Mono',monospace"><strong>${v.name || 'MMSI ' + v.mmsi}</strong><br/>${v.type || 'Unknown'} · ${(v.sog || 0).toFixed(1)} kn</div>`, []);

  return (
    <Globe
      ref={globeRef}
      width={width}
      height={height}
      globeImageUrl={globeTexture}
      backgroundColor="rgba(0,0,0,0)"
      atmosphereColor="rgba(0,140,255,0.18)"
      atmosphereAltitude={0.22}
      pointsData={vesselPoints}
      pointLat="lat"
      pointLng="lng"
      pointColor="color"
      pointAltitude={0.008}
      pointRadius="size"
      pointLabel={vesselLabel}
      onPointClick={handleVesselClick}
      arcsData={trailData}
      arcColor="color"
      arcDashLength={0.3}
      arcDashGap={0.15}
      arcDashAnimateTime={2000}
      arcStroke={0.3}
      arcAltitudeAutoScale={0.2}
      ringsData={DISRUPTION_ZONES}
      ringColor="color"
      ringMaxRadius="maxRadius"
      ringPropagationSpeed="propagationSpeed"
      ringRepeatPeriod="repeatPeriod"
      labelsData={MAJOR_PORTS}
      labelLat="lat"
      labelLng="lng"
      labelText="name"
      labelSize={0.4}
      labelDotRadius={0.3}
      labelColor={() => 'rgba(0,212,255,0.7)'}
      labelResolution={2}
      labelLabel={portLabel}
    />
  );
}
