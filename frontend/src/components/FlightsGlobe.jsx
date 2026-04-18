// frontend/src/components/FlightsGlobe.jsx
import { useEffect, useRef, useCallback, useMemo, useState } from 'react';
import Globe from 'react-globe.gl';
import * as THREE from 'three';
import { RiRefreshLine } from 'react-icons/ri';

const GLOBE_TEXTURES = {
  'blue-marble': '//unpkg.com/three-globe/example/img/earth-blue-marble.jpg',
  'night':       '//unpkg.com/three-globe/example/img/earth-night.jpg',
};

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
  { lat: 32.0, lng: 53.0, label: 'Iran',    color: '#ef4444', maxRadius: 3,   propagationSpeed: 1.8, repeatPeriod: 900  },
];

const HOME_POV = { lat: 25, lng: 10, altitude: 2.2 };

// ── Colors ─────────────────────────────────────────────────────────────────
const CARGO_COLOR   = 'rgba(0,212,255,0.9)';    // cyan
const GOV_COLOR     = 'rgba(130,90,220,0.9)';   // deep violet — government/military
const CARGO_DIM     = 'rgba(0,212,255,0.12)';   // cyan trail
const GOV_DIM       = 'rgba(130,90,220,0.12)';

function portStatusColor(status) {
  if (status === 'disruption') return '#ef4444';
  if (status === 'congestion') return '#f59e0b';
  return '#10b981';
}

function nearestHub(lat, lng) {
  let best = CARGO_HUBS[0], bestDist = Infinity;
  for (const h of CARGO_HUBS) {
    const d = (h.lat - lat) ** 2 + (h.lng - lng) ** 2;
    if (d < bestDist) { bestDist = d; best = h; }
  }
  return best;
}

// Simulated flights: full route arc src→dst with progress-phased dashes.
// Live flights (no route data): trail arc from nearest cargo hub → current position.
function flightRouteArc(f) {
  const bright = f.isCargo ? CARGO_COLOR.replace('0.9)', '0.6)') : GOV_COLOR.replace('0.9)', '0.6)');
  const dim    = f.isCargo ? CARGO_DIM : GOV_DIM;
  if (f.srcLat && f.dstLat) {
    return { startLat: f.srcLat, startLng: f.srcLng, endLat: f.dstLat, endLng: f.dstLng, color: [dim, bright], id: f.id, progress: f.progress ?? 0 };
  }
  // Live ADS-B: nearest cargo hub as estimated origin, trail to current position
  const hub = nearestHub(f.lat, f.lng);
  return { startLat: hub.lat, startLng: hub.lng, endLat: f.lat, endLng: f.lng, color: [dim, bright], id: f.id, progress: 0 };
}

// ── Great-circle SLERP (mirrored from backend) ────────────────────────────
// Used in the RAF loop for real-time sprite animation between API refreshes.
function gcFlightPoint(lat1d, lng1d, lat2d, lng2d, t) {
  const R = Math.PI / 180;
  const lat1 = lat1d*R, lng1 = lng1d*R, lat2 = lat2d*R, lng2 = lng2d*R;
  const x1 = Math.cos(lat1)*Math.cos(lng1), y1 = Math.cos(lat1)*Math.sin(lng1), z1 = Math.sin(lat1);
  const x2 = Math.cos(lat2)*Math.cos(lng2), y2 = Math.cos(lat2)*Math.sin(lng2), z2 = Math.sin(lat2);
  const dot = Math.min(1, Math.max(-1, x1*x2 + y1*y2 + z1*z2));
  const omega = Math.acos(dot);
  if (omega < 0.0001) return { lat: lat1d, lng: lng1d, heading: 0 };
  const s = Math.sin(omega);
  const a = Math.sin((1-t)*omega)/s, b = Math.sin(t*omega)/s;
  const x = a*x1 + b*x2, y = a*y1 + b*y2, z = a*z1 + b*z2;
  const lat = Math.atan2(z, Math.sqrt(x*x + y*y)) / R;
  const lng = Math.atan2(y, x) / R;
  const t2 = Math.min(t + 0.01, 0.999);
  const a2 = Math.sin((1-t2)*omega)/s, b2 = Math.sin(t2*omega)/s;
  const x2p = a2*x1 + b2*x2, y2p = a2*y1 + b2*y2, z2p = a2*z1 + b2*z2;
  const lat2p = Math.atan2(z2p, Math.sqrt(x2p*x2p + y2p*y2p)) / R;
  const lng2p = Math.atan2(y2p, x2p) / R;
  const dLng = ((lng2p - lng + 540) % 360 - 180) * R;
  const heading = ((Math.atan2(
    Math.sin(dLng),
    Math.cos(lat*R)*Math.sin(lat2p*R) - Math.sin(lat*R)*Math.cos(lat2p*R)*Math.cos(dLng)
  ) / R + 360) % 360);
  return { lat, lng, heading };
}

// Compute a point slightly ahead of (lat, lng) along the given heading (degrees from north).
// Used to give live ADS-B sprites the same nose-forward NDC rotation as simulated flights.
function forwardPoint(lat, lng, headingDeg, stepDeg = 0.5) {
  const R = Math.PI / 180;
  const latR = lat * R, lonR = lng * R, hR = headingDeg * R, d = stepDeg * R;
  const newLatR = Math.asin(Math.sin(latR) * Math.cos(d) + Math.cos(latR) * Math.sin(d) * Math.cos(hR));
  const newLonR = lonR + Math.atan2(Math.sin(hR) * Math.sin(d) * Math.cos(latR), Math.cos(d) - Math.sin(latR) * Math.sin(newLatR));
  return { lat: newLatR / R, lng: newLonR / R };
}

function setSpritePos(sprite, lat, lng, alt, globeRadius) {
  const phi = (90 - lat) * Math.PI / 180;
  const theta = (90 - lng) * Math.PI / 180;
  const r = globeRadius * (1 + alt);
  const ps = Math.sin(phi);
  sprite.position.set(r * ps * Math.cos(theta), r * Math.cos(phi), r * ps * Math.sin(theta));
}

// Reusable Vector3s for RAF NDC projection (avoid per-frame allocation)
const _rafWPF = new THREE.Vector3();
const _rafFPF = new THREE.Vector3();

// ── Plane sprite icons ─────────────────────────────────────────────────────
const _planeTexCache = {};
function makePlaneCanvas(isCargo) {
  const color = isCargo ? CARGO_COLOR : GOV_COLOR;
  const c = document.createElement('canvas');
  c.width = 56; c.height = 56;
  const ctx = c.getContext('2d');
  const glow = ctx.createRadialGradient(28, 28, 2, 28, 28, 22);
  glow.addColorStop(0, color.replace('0.9)', '0.28)'));
  glow.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = glow; ctx.fillRect(0, 0, 56, 56);
  ctx.fillStyle = color;
  ctx.beginPath(); ctx.ellipse(28, 28, 4, 20, 0, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath();
  ctx.moveTo(28, 20); ctx.lineTo(7, 34); ctx.lineTo(9, 38);
  ctx.lineTo(28, 30); ctx.lineTo(47, 38); ctx.lineTo(49, 34);
  ctx.closePath(); ctx.fill();
  ctx.beginPath();
  ctx.moveTo(28, 42); ctx.lineTo(18, 51); ctx.lineTo(20, 53);
  ctx.lineTo(28, 46); ctx.lineTo(36, 53); ctx.lineTo(38, 51);
  ctx.closePath(); ctx.fill();
  return c;
}
function makePlaneSprite(flight) {
  const key = flight.isCargo ? 'cargo' : 'gov';
  if (!_planeTexCache[key]) _planeTexCache[key] = new THREE.CanvasTexture(makePlaneCanvas(flight.isCargo));
  const mat = new THREE.SpriteMaterial({ map: _planeTexCache[key], transparent: true, depthWrite: false, sizeAttenuation: true });
  const sprite = new THREE.Sprite(mat);
  sprite.scale.set(7, 7, 1);
  return sprite;
}

export default function FlightsGlobe({ flights = [], ports = [], source, onFlightClick, focusTarget, width, height }) {
  const globeRef = useRef(null);
  const [globeTexture, setGlobeTexture] = useState(
    () => GLOBE_TEXTURES[localStorage.getItem('sdr_globe_texture_air')] || GLOBE_TEXTURES['night']
  );
  useEffect(() => {
    const handler = e => {
      if (e.key === 'sdr_globe_texture_air')
        setGlobeTexture(GLOBE_TEXTURES[e.newValue] || GLOBE_TEXTURES['night']);
    };
    window.addEventListener('storage', handler);
    return () => window.removeEventListener('storage', handler);
  }, []);
  const threeRefs = useRef({
    frame: null, shouldAnimate: false,
    glowMesh: null, glowGeom: null, glowMat: null,
    ringMesh: null, ringGeom: null, ringMat: null,
    moonMesh: null, moonGeom: null, moonMat: null, moonTex: null,
    sprites: new Map(), // id → { sprite, srcLat, srcLng, dstLat, dstLng, progress0, fetchTs, globeRadius }
    cam: null,
  });

  // NOTE: do NOT clear the sprites map when flights refresh.
  // React runs child effects (react-globe.gl's customThreeObjectUpdate) BEFORE parent effects,
  // so clearing here would wipe out freshly-registered sprites every refresh cycle.
  // Sprites overwrite themselves by ID on each refresh; stale entries are harmless.

  useEffect(() => {
    const refs = threeRefs.current;
    const timer = setTimeout(() => {
      const g = globeRef.current;
      if (!g?.scene) return;
      const scene = g.scene();

      // ── Atmosphere glow ──
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

      // ── Equatorial ring ──
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

      // Capture camera reference once — used every RAF frame for sprite rotation
      refs.cam = g.camera?.() ?? null;

      // ── Unified RAF: ring + moon orbit + real-time sprite animation ──
      refs.shouldAnimate = true;
      const animate = () => {
        if (!refs.shouldAnimate) return;

        // Ring + moon — these are safe and stay in try/catch
        try {
          if (refs.ringMesh) refs.ringMesh.rotation.z += 0.0008;
          if (refs.moonMesh) {
            const t = Date.now() * 0.00008;
            refs.moonMesh.position.set(Math.cos(t) * 165, Math.sin(t * 0.28) * 28, Math.sin(t) * 165);
          }
        } catch (_) {}

        // Sprite animation — separate block so rotation errors don't suppress position updates
        if (refs.sprites.size > 0) {
          const now = Date.now();
          // Re-check camera each frame in case it's initialized after first render
          if (!refs.cam) refs.cam = globeRef.current?.camera?.() ?? null;
          const cam = refs.cam;

          for (const entry of refs.sprites.values()) {
            const { sprite, globeRadius } = entry;
            let curLat, curLng, fwdLat, fwdLng;

            let headingDeg = 0;
            if (entry.isLive) {
              headingDeg = entry.heading ?? 0;
              curLat = entry.lat; curLng = entry.lng;
              const fp = forwardPoint(curLat, curLng, headingDeg);
              fwdLat = fp.lat; fwdLng = fp.lng;
            } else {
              const { srcLat, srcLng, dstLat, dstLng, progress0, fetchTs, cycleSecs } = entry;
              const elapsed = (now - fetchTs) / 1000;
              const t = (progress0 + elapsed / (cycleSecs || 120)) % 1;
              const pt  = gcFlightPoint(srcLat, srcLng, dstLat, dstLng, t);
              const ptF = gcFlightPoint(srcLat, srcLng, dstLat, dstLng, Math.min(t + 0.02, 0.999));
              curLat = pt.lat; curLng = pt.lng;
              fwdLat = ptF.lat; fwdLng = ptF.lng;
              headingDeg = pt.heading ?? 0;
              setSpritePos(sprite, curLat, curLng, 0.04, globeRadius);
            }

            // Always apply heading-based rotation as baseline (works even without NDC cam)
            // Sprite nose points UP (canvas y≈20 = top), so rotation = -heading converts geographic heading to screen rotation
            sprite.material.rotation = -headingDeg * Math.PI / 180;

            // Override with NDC screen-space projection for globe-rotation-aware accuracy
            if (cam) {
              const rC = globeRadius * 1.04;
              const phi  = (90 - curLat) * Math.PI / 180;
              const th   = (90 - curLng) * Math.PI / 180;
              const phiF = (90 - fwdLat) * Math.PI / 180;
              const thF  = (90 - fwdLng) * Math.PI / 180;
              _rafWPF.set(rC * Math.sin(phi)  * Math.cos(th),  rC * Math.cos(phi),  rC * Math.sin(phi)  * Math.sin(th));
              _rafFPF.set(rC * Math.sin(phiF) * Math.cos(thF), rC * Math.cos(phiF), rC * Math.sin(phiF) * Math.sin(thF));
              _rafWPF.project(cam);
              _rafFPF.project(cam);
              const dx = _rafFPF.x - _rafWPF.x;
              const dy = _rafFPF.y - _rafWPF.y;
              if (dx * dx + dy * dy > 1e-8) {
                sprite.material.rotation = Math.atan2(dy, dx) - Math.PI / 2;
              }
            }
          }
        }

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
        refs.cam = null;
        refs.sprites.clear();
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

  // Route arcs for all flights — simulated get full src→dst, live get nearest hub→position
  const arcs = useMemo(() =>
    flights.filter(f => f.lat && f.lng).map(flightRouteArc).filter(Boolean),
  [flights]);

  const arcInitialGap = useCallback(arc => arc.progress ?? 0, []);

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

  // Rings: hub rings + airspace restrictions + disruption-status ports
  const allRings = useMemo(() => {
    const portRings = ports
      .filter(p => p.status === 'disruption')
      .slice(0, 5)
      .map(p => ({ lat: p.lat, lng: p.lng, color: '#ef4444', maxRadius: 3.5, propagationSpeed: 2.5, repeatPeriod: 850 }));
    return [
      ...CARGO_HUBS.filter(h => h.tier <= 2).map(h => ({
        lat: h.lat, lng: h.lng,
        color: h.tier === 1 ? '#00d4ff' : 'rgba(0,212,255,0.45)',
        maxRadius: h.tier === 1 ? 2.5 : 1.8,
        propagationSpeed: h.tier === 1 ? 3 : 2,
        repeatPeriod: h.tier === 1 ? 700 : 950,
      })),
      ...AIRSPACE_RESTRICTIONS,
      ...portRings,
    ];
  }, [ports]);

  // Labels: cargo hubs + port status labels (same as Ocean Command)
  const allLabels = useMemo(() => {
    const hubs = CARGO_HUBS.map(h => ({
      type: 'hub', name: h.name, code: h.code, tier: h.tier,
      lat: h.lat, lng: h.lng,
      color: h.tier === 1 ? '#00d4ff' : h.tier === 2 ? 'rgba(0,212,255,0.65)' : 'rgba(0,212,255,0.38)',
      labelSize: h.tier === 1 ? 0.52 : h.tier === 2 ? 0.38 : 0.28,
    }));
    const portLabels = ports.map(p => ({
      type: 'port', name: p.name, status: p.status, congestion: p.congestion,
      lat: p.lat, lng: p.lng,
      color: portStatusColor(p.status),
      labelSize: 0.25,
    }));
    return [...hubs, ...portLabels];
  }, [ports]);

  const labelText  = useCallback(l => l.type === 'hub' ? l.code : l.name, []);
  const labelColor = useCallback(l => l.color, []);
  const labelSize  = useCallback(l => l.labelSize, []);
  const labelLabel = useCallback(l => {
    if (l.type === 'hub') {
      return `<div style="color:#00d4ff;font-size:10px;font-family:'JetBrains Mono',monospace;background:rgba(6,11,24,0.85);padding:2px 6px;border-radius:4px;border:1px solid rgba(0,212,255,0.3)">${l.name}<br/><span style="font-size:9px;opacity:0.7">Cargo Hub · Tier ${l.tier}</span></div>`;
    }
    const c = portStatusColor(l.status);
    return `<div style="color:${c};font-size:10px;font-family:'JetBrains Mono',monospace;background:rgba(6,11,24,0.85);padding:2px 6px;border-radius:4px;border:1px solid ${c}40">${l.name}<br/><span style="font-size:9px;opacity:0.7">${l.status} · ${l.congestion}/10</span></div>`;
  }, []);

  const flightLabel = useCallback(f =>
    `<div style="color:#e2e8f0;font-size:11px;background:rgba(6,11,24,0.9);padding:4px 8px;border-radius:6px;border:1px solid rgba(0,212,255,0.25);font-family:'JetBrains Mono',monospace"><strong>${f.callsign || f.id}</strong><br/>FL${Math.round((f.altitude || 10000) / 30.48)} · ${f.velocity || 0} kts${f.destination ? '<br/>' + (f.origin || '') + ' \u2192 ' + f.destination : ''}</div>`,
  []);

  return (
    <div style={{ position: 'relative', width, height }}>
      <Globe
        ref={globeRef}
        width={width}
        height={height}
        globeImageUrl={globeTexture}
        backgroundImageUrl="//unpkg.com/three-globe/example/img/night-sky.png"
        backgroundColor="rgba(0,0,0,0)"
        atmosphereColor="rgba(0,180,255,0.25)"
        atmosphereAltitude={0.25}
        customLayerData={flights}
        customThreeObject={makePlaneSprite}
        customThreeObjectUpdate={(sprite, f, globeRadius) => {
          if (f.srcLat && f.dstLat) {
            const seed = parseInt(f.id.replace(/\D/g, '').slice(-4) || '100', 10) || 100;
            const cycleSecs = 45 + (seed % 196);
            threeRefs.current.sprites.set(f.id, {
              sprite, srcLat: f.srcLat, srcLng: f.srcLng,
              dstLat: f.dstLat, dstLng: f.dstLng,
              progress0: f.progress ?? 0, fetchTs: Date.now(), globeRadius, cycleSecs,
            });
            setSpritePos(sprite, f.lat, f.lng, 0.04, globeRadius);
            // Apply heading-based rotation immediately so sprite is oriented before RAF fires
            const initPt = gcFlightPoint(f.srcLat, f.srcLng, f.dstLat, f.dstLng, f.progress ?? 0);
            sprite.material.rotation = -(initPt.heading ?? 0) * Math.PI / 180;
          } else {
            const heading = f.heading ?? 0;
            threeRefs.current.sprites.set(f.id, {
              sprite, lat: f.lat, lng: f.lng,
              heading, globeRadius, isLive: true,
            });
            setSpritePos(sprite, f.lat, f.lng, 0.04, globeRadius);
            sprite.material.rotation = -heading * Math.PI / 180;
          }
        }}
        onCustomLayerClick={handleFlightClick}
        customLayerLabel={flightLabel}
        arcsData={arcs}
        arcColor="color"
        arcDashLength={0.65}
        arcDashGap={0.35}
        arcDashInitialGap={arcInitialGap}
        arcDashAnimateTime={4000}
        arcStroke={0.38}
        arcAltitudeAutoScale={0.18}
        arcCurveResolution={24}
        ringsData={allRings}
        ringColor="color"
        ringMaxRadius="maxRadius"
        ringPropagationSpeed="propagationSpeed"
        ringRepeatPeriod="repeatPeriod"
        labelsData={allLabels}
        labelLat="lat"
        labelLng="lng"
        labelText={labelText}
        labelSize={labelSize}
        labelDotRadius={0.35}
        labelColor={labelColor}
        labelResolution={2}
        labelLabel={labelLabel}
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
