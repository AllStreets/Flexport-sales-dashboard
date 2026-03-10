// frontend/src/components/FlightsGlobe.jsx
import { useEffect, useRef, useCallback, useMemo, useState } from 'react';
import Globe from 'react-globe.gl';
import * as THREE from 'three';
import { RiRefreshLine } from 'react-icons/ri';

const CARGO_HUBS = [
  { code: 'MEM', name: 'Memphis',      lat: 35.04,  lng: -89.98,  tier: 1 },
  { code: 'SDF', name: 'Louisville',   lat: 38.17,  lng: -85.74,  tier: 1 },
  { code: 'HKG', name: 'Hong Kong',    lat: 22.31,  lng: 113.92,  tier: 1 },
  { code: 'FRA', name: 'Frankfurt',    lat: 50.04,  lng: 8.57,    tier: 1 },
  { code: 'DXB', name: 'Dubai',        lat: 25.25,  lng: 55.36,   tier: 1 },
  { code: 'PVG', name: 'Shanghai',     lat: 31.14,  lng: 121.81,  tier: 2 },
  { code: 'NRT', name: 'Tokyo',        lat: 35.54,  lng: 139.78,  tier: 2 },
  { code: 'ICN', name: 'Incheon',      lat: 37.46,  lng: 126.44,  tier: 2 },
  { code: 'SIN', name: 'Singapore',    lat: 1.36,   lng: 103.99,  tier: 2 },
  { code: 'AMS', name: 'Amsterdam',    lat: 52.31,  lng: 4.77,    tier: 2 },
  { code: 'ANC', name: 'Anchorage',    lat: 61.17,  lng: -149.99, tier: 2 },
  { code: 'LAX', name: 'Los Angeles',  lat: 33.94,  lng: -118.41, tier: 2 },
  { code: 'ORD', name: 'Chicago',      lat: 41.97,  lng: -87.91,  tier: 2 },
  { code: 'LHR', name: 'London',       lat: 51.47,  lng: -0.45,   tier: 2 },
  { code: 'JFK', name: 'New York',     lat: 40.63,  lng: -73.78,  tier: 3 },
  { code: 'MIA', name: 'Miami',        lat: 25.79,  lng: -80.29,  tier: 3 },
  { code: 'ADD', name: 'Addis Ababa',  lat: 8.98,   lng: 38.80,   tier: 3 },
  { code: 'DOH', name: 'Doha',         lat: 25.27,  lng: 51.61,   tier: 3 },
  { code: 'TPE', name: 'Taipei',       lat: 25.08,  lng: 121.23,  tier: 3 },
  { code: 'SYD', name: 'Sydney',       lat: -33.95, lng: 151.18,  tier: 3 },
  { code: 'BOG', name: 'Bogota',       lat: 4.70,   lng: -74.14,  tier: 3 },
  { code: 'BOM', name: 'Mumbai',       lat: 19.09,  lng: 72.87,   tier: 3 },
];

const AIRSPACE_RESTRICTIONS = [
  { lat: 50.5, lng: 30.5, label: 'Ukraine', color: '#ef4444', maxRadius: 5,   propagationSpeed: 2,   repeatPeriod: 1000 },
  { lat: 64.0, lng: 60.0, label: 'Russia',  color: '#f59e0b', maxRadius: 4,   propagationSpeed: 1.5, repeatPeriod: 1200 },
  { lat: 32.0, lng: 53.0, label: 'Iran',    color: '#f59e0b', maxRadius: 3,   propagationSpeed: 1.8, repeatPeriod: 900  },
];

const HOME_POV = { lat: 25, lng: 10, altitude: 2.2 };

function flightRouteArc(f) {
  if (!f.srcLat || !f.dstLat) return null;
  return {
    startLat: f.srcLat, startLng: f.srcLng,
    endLat: f.dstLat,   endLng: f.dstLng,
    color: ['rgba(0,212,255,0.85)', 'rgba(0,212,255,0.08)'],
    id: f.id,
    progress: f.progress ?? 0,
  };
}

// ── Plane sprite icons ─────────────────────────────────────────────────────
const _planeTexCache = {};
function makePlaneCanvas(isCargo) {
  const color = isCargo ? 'rgba(132,204,22,0.95)' : 'rgba(56,189,248,0.9)';
  const c = document.createElement('canvas');
  c.width = 56; c.height = 56;
  const ctx = c.getContext('2d');
  // Glow halo
  const glow = ctx.createRadialGradient(28, 28, 2, 28, 28, 22);
  glow.addColorStop(0, color.replace('0.9)', '0.28)'));
  glow.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = glow; ctx.fillRect(0, 0, 56, 56);
  ctx.fillStyle = color;
  // Fuselage (ellipse, nose pointing up in canvas = North on globe when heading=0)
  ctx.beginPath();
  ctx.ellipse(28, 28, 4, 20, 0, 0, Math.PI * 2);
  ctx.fill();
  // Main wings (swept trapezoid)
  ctx.beginPath();
  ctx.moveTo(28, 20); ctx.lineTo(7, 34);
  ctx.lineTo(9, 38);  ctx.lineTo(28, 30);
  ctx.lineTo(47, 38); ctx.lineTo(49, 34);
  ctx.closePath(); ctx.fill();
  // Tail fins
  ctx.beginPath();
  ctx.moveTo(28, 42); ctx.lineTo(18, 51);
  ctx.lineTo(20, 53); ctx.lineTo(28, 46);
  ctx.lineTo(36, 53); ctx.lineTo(38, 51);
  ctx.closePath(); ctx.fill();
  return c;
}
function makePlaneSprite(flight) {
  const key = flight.isCargo ? 'cargo' : 'commercial';
  if (!_planeTexCache[key]) _planeTexCache[key] = new THREE.CanvasTexture(makePlaneCanvas(flight.isCargo));
  const mat = new THREE.SpriteMaterial({ map: _planeTexCache[key], transparent: true, depthWrite: false, sizeAttenuation: true });
  const sprite = new THREE.Sprite(mat);
  sprite.scale.set(7, 7, 1);
  return sprite;
}

export default function FlightsGlobe({ flights = [], source, onFlightClick, focusTarget, width, height }) {
  const globeRef = useRef(null);
  const threeRefs = useRef({
    frame: null, shouldAnimate: false,
    glowMesh: null, glowGeom: null, glowMat: null,
    ringMesh: null, ringGeom: null, ringMat: null,
  });

  useEffect(() => {
    const refs = threeRefs.current;
    const timer = setTimeout(() => {
      const g = globeRef.current;
      if (!g?.scene) return;
      const scene = g.scene();

      // ── Atmosphere glow (blue — matches Ocean Command) ──
      const glowGeom = new THREE.SphereGeometry(105, 32, 32);
      const glowMat = new THREE.ShaderMaterial({
        uniforms: { c: { value: 0.22 }, p: { value: 4.5 } },
        vertexShader: `varying vec3 vNormal; void main() { vNormal = normalize(normalMatrix * normal); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
        fragmentShader: `uniform float c; uniform float p; varying vec3 vNormal; void main() { float i = pow(c - dot(vNormal, vec3(0.0,0.0,1.0)), p); gl_FragColor = vec4(0.0,0.6,1.0,max(0.0,i)); }`,
        side: THREE.FrontSide, blending: THREE.AdditiveBlending, transparent: true, depthWrite: false,
      });
      const glowMesh = new THREE.Mesh(glowGeom, glowMat);
      scene.add(glowMesh);
      refs.glowMesh = glowMesh; refs.glowGeom = glowGeom; refs.glowMat = glowMat;

      // ── Equatorial ring (navy blue — matches Ocean Command) ──
      const ringGeom = new THREE.TorusGeometry(102, 0.5, 8, 64);
      const ringMat = new THREE.MeshBasicMaterial({ color: 0x004466, transparent: true, opacity: 0.4 });
      const ringMesh = new THREE.Mesh(ringGeom, ringMat);
      ringMesh.rotation.x = Math.PI / 2;
      scene.add(ringMesh);
      refs.ringMesh = ringMesh; refs.ringGeom = ringGeom; refs.ringMat = ringMat;

      refs.shouldAnimate = true;
      const animate = () => {
        if (!refs.shouldAnimate) return;
        try { if (refs.ringMesh) refs.ringMesh.rotation.z += 0.0008; } catch (_) {}
        refs.frame = requestAnimationFrame(animate);
      };
      animate();
    }, 600);

    return () => {
      try {
        clearTimeout(timer);
        refs.shouldAnimate = false;
        if (refs.frame) cancelAnimationFrame(refs.frame);
        refs.frame = null;
        const scene = globeRef.current?.scene?.();
        if (scene) {
          if (refs.glowMesh) scene.remove(refs.glowMesh);
          if (refs.ringMesh) scene.remove(refs.ringMesh);
        }
        refs.glowGeom?.dispose(); refs.glowMat?.dispose();
        refs.ringGeom?.dispose(); refs.ringMat?.dispose();
      } catch (_) {}
      finally {
        refs.shouldAnimate = false; refs.frame = null;
        refs.glowMesh = refs.ringMesh = null;
        refs.glowGeom = refs.glowMat = refs.ringGeom = refs.ringMat = null;
      }
    };
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      const g = globeRef.current;
      if (!g) return;
      const controls = g.controls();
      if (!controls) return;
      controls.autoRotate = true;
      controls.autoRotateSpeed = 0.25;
      controls.enableDamping = true;
      controls.dampingFactor = 0.08;
    }, 600);
    return () => clearTimeout(timer);
  }, []);

  const handleReset = useCallback(() => {
    const g = globeRef.current;
    if (!g) return;
    g.controls().autoRotate = true;
    g.controls().autoRotateSpeed = 0.25;
    g.pointOfView(HOME_POV, 1000);
  }, []);

  // ── Route arcs: frozen after first sim load, cleared on sim→live transition ──
  const [stableArcs, setStableArcs] = useState([]);
  const arcsInitialized = useRef(false);
  const prevSourceRef = useRef(source);

  useEffect(() => {
    if (prevSourceRef.current === 'simulated' && source === 'live') {
      setStableArcs([]);
      arcsInitialized.current = false;
    }
    prevSourceRef.current = source;
  }, [source]);

  useEffect(() => {
    if (arcsInitialized.current || !flights.length) return;
    const routed = flights.filter(f => f.srcLat && f.dstLat);
    if (!routed.length) return;
    const arcs = routed.map(f => flightRouteArc(f)).filter(Boolean);
    if (arcs.length > 0) {
      arcsInitialized.current = true;
      setStableArcs(arcs);
    }
  }, [flights]);

  // Pan globe when feed card is clicked
  useEffect(() => {
    if (!focusTarget || !globeRef.current) return;
    globeRef.current.pointOfView({ lat: focusTarget.lat, lng: focusTarget.lng, altitude: 1.2 }, 1500);
  }, [focusTarget]);

  const handleFlightClick = useCallback((obj) => {
    const g = globeRef.current;
    if (g) {
      g.controls().autoRotate = false;
      g.pointOfView({ lat: obj.lat, lng: obj.lng, altitude: 1.2 }, 800);
    }
    onFlightClick?.(obj);
  }, [onFlightClick]);

  const arcInitialGap = useCallback(arc => arc.progress ?? 0, []);

  const hubRings = useMemo(() => [
    ...CARGO_HUBS.filter(h => h.tier <= 2).map(h => ({
      lat: h.lat, lng: h.lng,
      color: h.tier === 1 ? '#00d4ff' : 'rgba(0,212,255,0.45)',
      maxRadius: h.tier === 1 ? 2.5 : 1.8,
      propagationSpeed: h.tier === 1 ? 3 : 2,
      repeatPeriod: h.tier === 1 ? 700 : 950,
    })),
    ...AIRSPACE_RESTRICTIONS,
  ], []);

  const hubLabels = useMemo(() => CARGO_HUBS.map(h => ({
    ...h,
    color: h.tier === 1 ? '#00d4ff' : h.tier === 2 ? 'rgba(0,212,255,0.65)' : 'rgba(0,212,255,0.38)',
    labelSize: h.tier === 1 ? 0.52 : h.tier === 2 ? 0.38 : 0.28,
  })), []);

  const hubLabelColor = useCallback(h => h.color, []);
  const hubLabelSize  = useCallback(h => h.labelSize, []);

  const hubLabelLabel = useCallback(h =>
    `<div style="color:#00d4ff;font-size:10px;font-family:'JetBrains Mono',monospace;background:rgba(6,11,24,0.85);padding:2px 6px;border-radius:4px;border:1px solid rgba(0,212,255,0.3)">${h.name}<br/><span style="font-size:9px;opacity:0.7">Cargo Hub · Tier ${h.tier}</span></div>`,
  []);

  const flightLabel = useCallback(f =>
    `<div style="color:#e2e8f0;font-size:11px;background:rgba(6,11,24,0.9);padding:4px 8px;border-radius:6px;border:1px solid rgba(0,212,255,0.25);font-family:'JetBrains Mono',monospace"><strong>${f.callsign || f.id}</strong><br/>FL${Math.round((f.altitude || 10000) / 30.48)} · ${f.velocity || 0} kts${f.destination ? '<br/>' + (f.origin || '') + ' \u2192 ' + f.destination : ''}</div>`,
  []);

  return (
    <div style={{ position: 'relative', width, height }}>
      <Globe
        ref={globeRef}
        width={width}
        height={height}
        globeImageUrl="//unpkg.com/three-globe/example/img/earth-day.jpg"
        backgroundImageUrl="//unpkg.com/three-globe/example/img/night-sky.png"
        backgroundColor="rgba(0,0,0,0)"
        atmosphereColor="rgba(0,180,255,0.25)"
        atmosphereAltitude={0.25}
        customLayerData={flights}
        customThreeObject={makePlaneSprite}
        customThreeObjectUpdate={(sprite, f, globeRadius) => {
          const alt = 0.04;
          const phi = (90 - f.lat) * Math.PI / 180;
          const theta = (90 - f.lng) * Math.PI / 180;
          const r = globeRadius * (1 + alt);
          const ps = Math.sin(phi);
          sprite.position.set(r * ps * Math.cos(theta), r * Math.cos(phi), r * ps * Math.sin(theta));
          sprite.material.rotation = -((f.heading ?? 0) * Math.PI / 180);
        }}
        onCustomLayerClick={handleFlightClick}
        customLayerLabel={flightLabel}
        arcsData={stableArcs}
        arcColor="color"
        arcDashLength={0.55}
        arcDashGap={0.45}
        arcDashInitialGap={arcInitialGap}
        arcDashAnimateTime={4500}
        arcStroke={0.25}
        arcAltitudeAutoScale={0.2}
        arcCurveResolution={24}
        ringsData={hubRings}
        ringColor="color"
        ringMaxRadius="maxRadius"
        ringPropagationSpeed="propagationSpeed"
        ringRepeatPeriod="repeatPeriod"
        labelsData={hubLabels}
        labelLat="lat"
        labelLng="lng"
        labelText="code"
        labelSize={hubLabelSize}
        labelDotRadius={0.4}
        labelColor={hubLabelColor}
        labelResolution={2}
        labelLabel={hubLabelLabel}
      />
      <button
        onClick={handleReset}
        title="Reset globe view"
        style={{
          position: 'absolute', top: 14, right: 14, zIndex: 20,
          width: 28, height: 28, display: 'flex', alignItems: 'center', justifyContent: 'center',
          background: 'rgba(6,11,24,0.88)', border: '1px solid rgba(0,212,255,0.2)',
          borderRadius: 6, cursor: 'pointer', color: '#334155', transition: 'all 0.15s',
        }}
        onMouseEnter={e => { e.currentTarget.style.color = '#00d4ff'; e.currentTarget.style.borderColor = 'rgba(0,212,255,0.5)'; }}
        onMouseLeave={e => { e.currentTarget.style.color = '#334155'; e.currentTarget.style.borderColor = 'rgba(0,212,255,0.2)'; }}
      >
        <RiRefreshLine size={13} />
      </button>
    </div>
  );
}
