// frontend/src/components/FlightsGlobe.jsx
import { useEffect, useRef, useCallback, useMemo } from 'react';
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

// Trail arc: from origin airport to current flight position — bright at plane end, fading at origin.
function flightTrailArc(f) {
  if (!f.srcLat || !f.lat) return null;
  const isCargo = f.isCargo;
  const bright = isCargo ? 'rgba(132,204,22,0.8)' : 'rgba(0,212,255,0.8)';
  const dim    = isCargo ? 'rgba(132,204,22,0.05)' : 'rgba(0,212,255,0.05)';
  return {
    startLat: f.srcLat, startLng: f.srcLng,
    endLat: f.lat,       endLng: f.lng,
    color: [dim, bright],
    id: f.id,
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
    moonMesh: null, moonGeom: null, moonMat: null, moonTex: null,
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

      // ── Moon (same canvas texture + orbit as Ocean Command) ──
      const moonGeom = new THREE.SphereGeometry(3.5, 32, 32);
      const mc = document.createElement('canvas');
      mc.width = 512; mc.height = 512;
      const mx = mc.getContext('2d');
      const baseG = mx.createRadialGradient(220, 180, 30, 256, 256, 300);
      baseG.addColorStop(0, '#c8c8c8'); baseG.addColorStop(0.35, '#a0a0a0');
      baseG.addColorStop(0.7, '#7c7c7c'); baseG.addColorStop(1, '#606060');
      mx.fillStyle = baseG; mx.fillRect(0, 0, 512, 512);
      [[190,155,90],[310,200,70],[145,295,55],[360,330,50],[240,390,40]].forEach(([x,y,r]) => {
        const g = mx.createRadialGradient(x,y,0,x,y,r);
        g.addColorStop(0,'rgba(48,50,58,0.75)'); g.addColorStop(1,'rgba(48,50,58,0)');
        mx.fillStyle = g; mx.fillRect(0,0,512,512);
      });
      [[110,75,42],[365,145,36],[195,360,30],[445,290,26],[70,340,32],[300,420,22]].forEach(([x,y,r]) => {
        const ej = mx.createRadialGradient(x,y,r*0.8,x,y,r*1.6);
        ej.addColorStop(0,'rgba(185,185,185,0.25)'); ej.addColorStop(1,'rgba(185,185,185,0)');
        mx.fillStyle=ej; mx.beginPath(); mx.arc(x,y,r*1.6,0,Math.PI*2); mx.fill();
        const rim = mx.createRadialGradient(x,y,r*0.55,x,y,r*1.05);
        rim.addColorStop(0,'rgba(60,62,68,0)'); rim.addColorStop(0.6,'rgba(175,175,178,0.55)');
        rim.addColorStop(1,'rgba(175,175,178,0)');
        mx.fillStyle=rim; mx.beginPath(); mx.arc(x,y,r*1.05,0,Math.PI*2); mx.fill();
        const fl = mx.createRadialGradient(x-r*0.15,y-r*0.1,0,x,y,r*0.62);
        fl.addColorStop(0,'rgba(78,80,86,0.95)'); fl.addColorStop(1,'rgba(58,60,66,0.88)');
        mx.fillStyle=fl; mx.beginPath(); mx.arc(x,y,r*0.62,0,Math.PI*2); mx.fill();
        mx.fillStyle='rgba(195,195,198,0.7)'; mx.beginPath(); mx.arc(x,y,r*0.07,0,Math.PI*2); mx.fill();
      });
      for (let i=0;i<18;i++){
        const x=18+(i*47+i*i*13)%476, y=18+(i*61+i*i*7)%476, r=5+(i*11)%16;
        const g=mx.createRadialGradient(x,y,0,x,y,r);
        g.addColorStop(0,'rgba(62,64,70,0.9)'); g.addColorStop(0.75,'rgba(158,158,162,0.4)');
        g.addColorStop(1,'rgba(130,130,134,0)');
        mx.fillStyle=g; mx.beginPath(); mx.arc(x,y,r,0,Math.PI*2); mx.fill();
      }
      for (let i=0;i<40;i++){
        const x=5+(i*83+i*i*17)%502, y=5+(i*71+i*i*23)%502, r=1.5+(i*5)%5;
        mx.fillStyle=`rgba(60,62,65,${0.5+0.3*(i%3)/2})`;
        mx.beginPath(); mx.arc(x,y,r,0,Math.PI*2); mx.fill();
        mx.fillStyle=`rgba(170,170,172,${0.2+0.15*(i%2)})`;
        mx.beginPath(); mx.arc(x-r*0.4,y-r*0.4,r*0.4,0,Math.PI*2); mx.fill();
      }
      const idata = mx.getImageData(0,0,512,512);
      for (let i=0;i<idata.data.length;i+=4){
        const n=(Math.sin(i*0.0013)*Math.cos(i*0.00071)*14)|0;
        idata.data[i]  =Math.min(255,Math.max(0,idata.data[i]+n));
        idata.data[i+1]=Math.min(255,Math.max(0,idata.data[i+1]+n));
        idata.data[i+2]=Math.min(255,Math.max(0,idata.data[i+2]+n));
      }
      mx.putImageData(idata,0,0);
      const moonTex = new THREE.CanvasTexture(mc);
      const moonMat = new THREE.MeshBasicMaterial({ map: moonTex });
      const moonMesh = new THREE.Mesh(moonGeom, moonMat);
      scene.add(moonMesh);
      refs.moonMesh = moonMesh; refs.moonGeom = moonGeom; refs.moonMat = moonMat; refs.moonTex = moonTex;

      // ── Unified RAF: ring rotation + moon orbit ──
      refs.shouldAnimate = true;
      const animate = () => {
        if (!refs.shouldAnimate) return;
        try {
          if (refs.ringMesh) refs.ringMesh.rotation.z += 0.0008;
          if (refs.moonMesh) {
            const t = Date.now() * 0.00008;
            refs.moonMesh.position.set(Math.cos(t) * 165, Math.sin(t * 0.28) * 28, Math.sin(t) * 165);
          }
        } catch (_) {}
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
          if (refs.moonMesh) scene.remove(refs.moonMesh);
        }
        refs.glowGeom?.dispose(); refs.glowMat?.dispose();
        refs.ringGeom?.dispose(); refs.ringMat?.dispose();
        refs.moonGeom?.dispose(); refs.moonTex?.dispose(); refs.moonMat?.dispose();
      } catch (_) {}
      finally {
        refs.shouldAnimate = false; refs.frame = null;
        refs.glowMesh = refs.ringMesh = refs.moonMesh = null;
        refs.glowGeom = refs.glowMat = refs.ringGeom = refs.ringMat = null;
        refs.moonGeom = refs.moonMat = refs.moonTex = null;
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

  // Trail arcs: origin → current position, updated on every flights refresh
  const arcs = useMemo(() =>
    flights.filter(f => f.srcLat && f.lat).map(flightTrailArc).filter(Boolean),
  [flights]);

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
        arcsData={arcs}
        arcColor="color"
        arcDashLength={0.5}
        arcDashGap={0.5}
        arcDashInitialGap={0}
        arcDashAnimateTime={3500}
        arcStroke={0.22}
        arcAltitudeAutoScale={0.15}
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
