// frontend/src/components/LandGlobe.jsx
import { useEffect, useRef, useCallback, useMemo, useState } from 'react';
import Globe from 'react-globe.gl';
import * as THREE from 'three';
import { RiRefreshLine } from 'react-icons/ri';

const GLOBE_TEXTURES = {
  'blue-marble': '//unpkg.com/three-globe/example/img/earth-blue-marble.jpg',
  'night':       '//unpkg.com/three-globe/example/img/earth-night.jpg',
};

// Cyan for semi-trucks, orange for tanks
const REGULAR_COLOR = 'rgba(0,212,255,0.9)';    // cyan — matches accent
const TANK_COLOR    = 'rgba(251,146,60,0.9)';   // orange-400
const REGULAR_DIM   = 'rgba(0,212,255,0.05)';   // cyan trail
const TANK_DIM      = 'rgba(251,146,60,0.05)';

const HOME_POV = { lat: 30, lng: 0, altitude: 2.2 };

const DISTRIBUTION_HUBS = [
  { code: 'MEM', name: 'Memphis',     lat: 35.04,  lng: -90.00  },
  { code: 'SDF', name: 'Louisville',  lat: 38.17,  lng: -85.74  },
  { code: 'ORD', name: 'Chicago',     lat: 41.97,  lng: -87.91  },
  { code: 'DFW', name: 'Dallas',      lat: 32.90,  lng: -97.04  },
  { code: 'LAX', name: 'Los Angeles', lat: 34.05,  lng: -118.24 },
  { code: 'RTM', name: 'Rotterdam',   lat: 51.95,  lng: 4.13    },
  { code: 'FRA', name: 'Frankfurt',   lat: 50.10,  lng: 8.68    },
  { code: 'DXB', name: 'Dubai',       lat: 25.20,  lng: 55.27   },
  { code: 'CTU', name: 'Chengdu',     lat: 30.57,  lng: 104.07  },
  { code: 'SIN', name: 'Singapore',   lat: 1.35,   lng: 103.82  },
  { code: 'GRU', name: 'São Paulo',   lat: -23.55, lng: -46.63  },
];


function portStatusColor(status) {
  if (status === 'disruption') return '#ef4444';
  if (status === 'congestion') return '#f59e0b';
  return '#10b981';
}

// Great-circle SLERP — same formula as FlightsGlobe gcFlightPoint
function gcPoint(lat1d, lng1d, lat2d, lng2d, t) {
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

function setSpritePos(sprite, lat, lng, alt, globeRadius) {
  const phi   = (90 - lat)  * Math.PI / 180;
  const theta = (90 - lng) * Math.PI / 180;
  const r = globeRadius * (1 + alt);
  const ps = Math.sin(phi);
  sprite.position.set(r * ps * Math.cos(theta), r * Math.cos(phi), r * ps * Math.sin(theta));
}

// Reusable vectors — avoid per-frame allocations in the RAF loop
const _rafWP = new THREE.Vector3();
const _rafFP = new THREE.Vector3();

// Side-profile semi-truck sprite — landscape canvas, truck faces RIGHT.
// Rotation formula: PI/2 - heading*PI/180 orients the side-view correctly
// with direction of travel on the globe.
const _truckTexCache = {};

function makeTruckCanvas(colorStr) {
  const key = colorStr;
  if (_truckTexCache[key]) return _truckTexCache[key];

  const W = 52, H = 24;
  const c = document.createElement('canvas');
  c.width = W; c.height = H;
  const ctx = c.getContext('2d');

  const alpha = (a) => colorStr.replace(/[\d.]+\)$/, `${a})`);
  const WHEEL_COLOR = 'rgba(15,15,25,0.95)';
  const RIM_COLOR = 'rgba(100,110,140,0.8)';
  const GLASS = 'rgba(120,180,255,0.35)';

  // Subtle glow
  const glow = ctx.createRadialGradient(28, 10, 2, 28, 10, 18);
  glow.addColorStop(0, alpha('0.18'));
  glow.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, W, H);

  // ── SEMI TRUCK (both regular and tank use this shape, differ only in color) ──
  // Trailer body
  const trailerGrad = ctx.createLinearGradient(2, 4, 2, 18);
  trailerGrad.addColorStop(0, alpha('0.55'));
  trailerGrad.addColorStop(0.5, colorStr);
  trailerGrad.addColorStop(1, alpha('0.45'));
  ctx.fillStyle = trailerGrad;
  ctx.beginPath();
  ctx.roundRect(2, 5, 34, 12, 1);
  ctx.fill();

  // Trailer panel lines
  ctx.strokeStyle = alpha('0.15');
  ctx.lineWidth = 0.6;
  for (const x of [10, 18, 26]) {
    ctx.beginPath(); ctx.moveTo(x, 5); ctx.lineTo(x, 17); ctx.stroke();
  }

  // Rear tail lights
  ctx.fillStyle = 'rgba(239,68,68,0.75)';
  ctx.fillRect(1, 6, 2, 4);
  ctx.fillRect(1, 13, 2, 4);

  // Coupling
  ctx.fillStyle = alpha('0.35');
  ctx.fillRect(34, 9, 5, 4);

  // Cab body
  ctx.fillStyle = colorStr;
  ctx.beginPath();
  ctx.roundRect(37, 4, 13, 13, 2);
  ctx.fill();

  // Cab roof (slightly darker)
  ctx.fillStyle = alpha('0.7');
  ctx.fillRect(37, 4, 13, 4);

  // Windshield
  ctx.fillStyle = GLASS;
  ctx.beginPath();
  ctx.roundRect(46, 5, 4, 9, 1);
  ctx.fill();

  // Exhaust stack
  ctx.fillStyle = 'rgba(200,210,230,0.7)';
  ctx.fillRect(40, 1, 2, 5);

  // ── WHEELS ────────────────────────────────────────────────────
  const wheel = (cx, cy) => {
    ctx.fillStyle = WHEEL_COLOR;
    ctx.beginPath(); ctx.arc(cx, cy, 3.5, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = RIM_COLOR;
    ctx.beginPath(); ctx.arc(cx, cy, 1.6, 0, Math.PI * 2); ctx.fill();
  };

  wheel(44, 19); // front (cab)
  wheel(16, 19); // rear (trailer front)
  wheel(24, 19); // rear (trailer back)

  _truckTexCache[key] = c;
  return c;
}

// Cache of horizontally-mirrored canvases (cab on LEFT) for left-facing trucks.
const _mirrorCache = {};
function getMirroredCanvas(colorStr) {
  const key = colorStr + '_mirror';
  if (_mirrorCache[key]) return _mirrorCache[key];
  const src = makeTruckCanvas(colorStr);
  const m = document.createElement('canvas');
  m.width = src.width; m.height = src.height;
  const ctx = m.getContext('2d');
  ctx.translate(src.width, 0);
  ctx.scale(-1, 1);
  ctx.drawImage(src, 0, 0);
  _mirrorCache[key] = m;
  return m;
}

function makeTruckSprite(truck) {
  const colorStr = truck.type === 'tank' ? TANK_COLOR : REGULAR_COLOR;
  // Two textures — right-facing (cab at right, default) and left-facing (mirrored).
  // The RAF loop swaps material.map based on screen-space travel direction.
  const texR = new THREE.CanvasTexture(makeTruckCanvas(colorStr));
  const texL = new THREE.CanvasTexture(getMirroredCanvas(colorStr));
  const mat = new THREE.SpriteMaterial({ map: texR, transparent: true, depthWrite: false, sizeAttenuation: true });
  const sprite = new THREE.Sprite(mat);
  sprite.scale.set(3, 1.39, 1);
  sprite.userData.texR = texR;
  sprite.userData.texL = texL;
  return sprite;
}

export default function LandGlobe({ trucks = [], ports = [], onTruckClick, focusTarget, width, height }) {
  const globeRef  = useRef(null);
  const [globeTexture, setGlobeTexture] = useState(
    () => GLOBE_TEXTURES[localStorage.getItem('sdr_globe_texture_land')] || GLOBE_TEXTURES['night']
  );
  useEffect(() => {
    const handler = e => {
      if (e.key === 'sdr_globe_texture_land')
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
    sprites: new Map(),
  });

  // Clear sprite map when trucks data refreshes
  useEffect(() => { threeRefs.current.sprites.clear(); }, [trucks]);

  // Three.js scene setup — atmosphere glow, equatorial ring, moon, RAF loop
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

      // ── Equatorial ring — same as Ocean/Air Freight ──
      const ringGeom = new THREE.TorusGeometry(102, 0.6, 8, 64);
      const ringMat  = new THREE.MeshBasicMaterial({ color: 0x004466, transparent: true, opacity: 0.4 });
      const ringMesh = new THREE.Mesh(ringGeom, ringMat);
      ringMesh.rotation.x = Math.PI / 2;
      scene.add(ringMesh);
      refs.ringMesh = ringMesh; refs.ringGeom = ringGeom; refs.ringMat = ringMat;

      // ── Moon (same detailed canvas texture as Ocean/Air Freight) ──
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

      // Cache camera reference once at init — re-checked each frame if null
      refs.cam = g.camera?.() ?? null;

      // ── Unified RAF: ring rotation + moon orbit + real-time sprite animation ──
      refs.shouldAnimate = true;
      const animate = () => {
        if (!refs.shouldAnimate) return;
        try {
          if (refs.ringMesh) refs.ringMesh.rotation.z += 0.0008;
          if (refs.moonMesh) {
            const t = Date.now() * 0.00008;
            refs.moonMesh.position.set(Math.cos(t) * 165, Math.sin(t * 0.28) * 28, Math.sin(t) * 165);
          }
          if (refs.sprites.size > 0) {
            const now = Date.now();
            // Re-acquire camera each frame in case it wasn't ready at init
            if (!refs.cam) refs.cam = globeRef.current?.camera?.() ?? null;
            const cam = refs.cam;

            for (const entry of refs.sprites.values()) {
              const { sprite, srcLat, srcLng, dstLat, dstLng, progress0, fetchTs, cycleSecs, globeRadius } = entry;
              const elapsed = (now - fetchTs) / 1000;
              const t = (progress0 + elapsed / (cycleSecs || 120)) % 1;
              const pt = gcPoint(srcLat, srcLng, dstLat, dstLng, t);
              setSpritePos(sprite, pt.lat, pt.lng, 0.035, globeRadius);
              sprite.scale.set(3, 1.39, 1);

              const headingDeg = pt.heading ?? 0;

              // ── Baseline: heading-based rotation (works even without NDC cam) ──
              // Landscape truck sprite: cab faces RIGHT at rotation=0.
              // Formula: PI/2 - heading*PI/180 orients cab in the direction of travel.
              const baseAngle = Math.PI / 2 - headingDeg * Math.PI / 180;
              const goingLeftBaseline = headingDeg > 90 && headingDeg < 270;
              sprite.material.rotation = goingLeftBaseline ? baseAngle + Math.PI : baseAngle;
              const baselineTex = goingLeftBaseline ? sprite.userData.texL : sprite.userData.texR;
              if (baselineTex && sprite.material.map !== baselineTex) {
                sprite.material.map = baselineTex;
                sprite.material.needsUpdate = true;
              }

              // ── Override: NDC screen-space projection for globe-rotation accuracy ──
              if (cam) {
                const rC   = globeRadius * 1.035;
                const phiC = (90 - pt.lat) * Math.PI / 180;
                const thC  = (90 - pt.lng) * Math.PI / 180;
                _rafWP.set(rC * Math.sin(phiC) * Math.cos(thC), rC * Math.cos(phiC), rC * Math.sin(phiC) * Math.sin(thC));
                const ptFwd = gcPoint(srcLat, srcLng, dstLat, dstLng, Math.min(t + 0.005, 0.999));
                const phiF  = (90 - ptFwd.lat) * Math.PI / 180;
                const thF   = (90 - ptFwd.lng) * Math.PI / 180;
                _rafFP.set(rC * Math.sin(phiF) * Math.cos(thF), rC * Math.cos(phiF), rC * Math.sin(phiF) * Math.sin(thF));
                _rafWP.project(cam);
                _rafFP.project(cam);
                const dx = _rafFP.x - _rafWP.x;
                const dy = _rafFP.y - _rafWP.y;
                if (dx * dx + dy * dy > 1e-8) {
                  const angle = Math.atan2(dy, dx);
                  const goingLeft = Math.abs(angle) > Math.PI / 2;
                  sprite.material.rotation = goingLeft ? angle - Math.PI : angle;
                  const targetTex = goingLeft ? sprite.userData.texL : sprite.userData.texR;
                  if (targetTex && sprite.material.map !== targetTex) {
                    sprite.material.map = targetTex;
                    sprite.material.needsUpdate = true;
                  }
                }
              }
            }
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
        refs.sprites.clear();
      }
    };
  }, []);

  // Auto-rotate + damping — same as Ocean/Air Freight
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

  const handleReset = useCallback(() => {
    const g = globeRef.current;
    if (!g) return;
    g.controls().autoRotate = true;
    g.controls().autoRotateSpeed = 0.3;
    g.pointOfView(HOME_POV, 1000);
  }, []);

  useEffect(() => {
    if (!focusTarget || !globeRef.current) return;
    globeRef.current.controls().autoRotate = false;
    globeRef.current.pointOfView({ lat: focusTarget.lat, lng: focusTarget.lng, altitude: 0.8 }, 900);
  }, [focusTarget]);

  const arcs = useMemo(() =>
    trucks.filter(t => t.lat && t.lng).map(t => ({
      startLat: t.srcLat, startLng: t.srcLng,
      endLat:   t.dstLat, endLng:   t.dstLng,
      color: [
        (t.type === 'tank' ? TANK_DIM : REGULAR_DIM),
        (t.type === 'tank' ? TANK_COLOR : REGULAR_COLOR),
      ],
      id: t.id, progress: t.progress ?? 0,
    })),
  [trucks]);

  const allLabels = useMemo(() => [
    ...DISTRIBUTION_HUBS.map(h => ({
      lat: h.lat, lng: h.lng, text: h.code,
      size: 0.45, color: 'rgba(0,212,255,0.75)',
      dotRadius: 0.32, type: 'hub',
    })),
    ...ports.map(p => ({
      lat: p.lat, lng: p.lng, text: p.name,
      size: 0.32, color: portStatusColor(p.status),
      dotRadius: 0.25, type: 'port',
    })),
  ], [ports]);

  const allRings = useMemo(() => [
    ...ports.filter(p => p.status !== 'clear').map(p => ({
      lat: p.lat, lng: p.lng,
      maxRadius: p.status === 'disruption' ? 4 : 3,
      propagationSpeed: p.status === 'disruption' ? 2.5 : 1.5,
      repeatPeriod: p.status === 'disruption' ? 700 : 1000,
      color: portStatusColor(p.status),
    })),
  ], [ports]);

  const truckLabel = useCallback(t =>
    `<div style="color:#e2e8f0;font-size:11px;background:rgba(6,11,24,0.9);padding:4px 8px;border-radius:6px;border:1px solid rgba(0,212,255,0.25);font-family:'JetBrains Mono',monospace"><strong>${t.callsign}</strong><br/>${t.carrier} · ${t.type === 'tank' ? 'Tank' : 'Semi'}${t.destination ? '<br/>' + (t.origin || '') + ' \u2192 ' + t.destination : ''}</div>`,
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

        customLayerData={trucks.filter(t => t.lat && t.lng)}
        customThreeObject={makeTruckSprite}
        customThreeObjectUpdate={(sprite, truck, globeRadius) => {
          // Re-register whenever the sprite object reference changes (react-globe.gl creates
          // new Three.js objects when data refreshes, so we must detect the new reference).
          // After registration the RAF loop owns position/rotation/scale every frame —
          // we don't touch those here so auto-rotation can't overwrite the RAF's work.
          const existing = threeRefs.current.sprites.get(truck.id);
          if (!existing || existing.sprite !== sprite) {
            setSpritePos(sprite, truck.lat, truck.lng, 0.035, globeRadius);
            sprite.scale.set(3, 1.39, 1);
            const seed = parseInt(String(truck.id).replace(/\D/g, ''), 10) || 0;
            const cycleSecs = 60 + (seed % 241);
            threeRefs.current.sprites.set(truck.id, {
              sprite, srcLat: truck.srcLat, srcLng: truck.srcLng,
              dstLat: truck.dstLat, dstLng: truck.dstLng,
              progress0: truck.progress ?? 0, fetchTs: Date.now(), cycleSecs, globeRadius,
            });
          }
        }}
        onCustomLayerClick={obj => { globeRef.current?.controls()?.autoRotate && (globeRef.current.controls().autoRotate = false); onTruckClick?.(obj); }}
        customLayerLabel={truckLabel}

        arcsData={arcs}
        arcStartLat="startLat" arcStartLng="startLng"
        arcEndLat="endLat"     arcEndLng="endLng"
        arcColor="color"
        arcDashLength={0.6} arcDashGap={0.35} arcDashInitialGap={t => t.progress ?? 0} arcDashAnimateTime={3500}
        arcStroke={0.3} arcAltitudeAutoScale={0.25}

        labelsData={allLabels}
        labelLat="lat" labelLng="lng" labelText="text"
        labelSize="size" labelColor="color"
        labelDotRadius="dotRadius" labelDotOrientation="bottom"
        labelResolution={2} labelAltitude={0.005}

        ringsData={allRings}
        ringLat="lat" ringLng="lng"
        ringMaxRadius="maxRadius"
        ringPropagationSpeed="propagationSpeed"
        ringRepeatPeriod="repeatPeriod"
        ringColor="color"
        ringResolution={48}
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
