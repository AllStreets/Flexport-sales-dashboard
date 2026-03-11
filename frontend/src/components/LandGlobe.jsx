// frontend/src/components/LandGlobe.jsx
import { useEffect, useRef, useCallback, useMemo } from 'react';
import Globe from 'react-globe.gl';
import * as THREE from 'three';

const REGULAR_COLOR = 'rgba(250,204,21,0.9)';
const TANK_COLOR    = 'rgba(163,230,53,0.9)';
const REGULAR_DIM   = 'rgba(250,204,21,0.05)';
const TANK_DIM      = 'rgba(163,230,53,0.05)';

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

const BORDER_CROSSINGS = [
  { name: 'Laredo / Nuevo Laredo', lat: 27.5,  lng: -99.5, color: '#10b981', maxRadius: 3.5, propagationSpeed: 2,   repeatPeriod: 800  },
  { name: 'Dover / Calais',        lat: 51.1,  lng: 1.8,   color: '#f59e0b', maxRadius: 3,   propagationSpeed: 1.8, repeatPeriod: 1000 },
  { name: 'Brest-Terespol',        lat: 52.1,  lng: 23.7,  color: '#ef4444', maxRadius: 4,   propagationSpeed: 2.5, repeatPeriod: 700  },
  { name: 'Khorgos (CN-KZ)',       lat: 44.2,  lng: 80.2,  color: '#f59e0b', maxRadius: 3,   propagationSpeed: 1.5, repeatPeriod: 1100 },
  { name: 'Wagah (IN-PK)',         lat: 31.6,  lng: 74.6,  color: '#ef4444', maxRadius: 3.5, propagationSpeed: 2,   repeatPeriod: 750  },
];

function truckColor(type) { return type === 'tank' ? TANK_COLOR : REGULAR_COLOR; }
function truckDim(type)   { return type === 'tank' ? TANK_DIM   : REGULAR_DIM;   }

function portStatusColor(status) {
  if (status === 'disruption') return '#ef4444';
  if (status === 'congestion') return '#f59e0b';
  return '#10b981';
}

function gcPoint(lat1d, lng1d, lat2d, lng2d, t) {
  const R = Math.PI / 180;
  const lat1 = lat1d*R, lng1 = lng1d*R, lat2 = lat2d*R, lng2 = lng2d*R;
  const cosDelta = Math.sin(lat1)*Math.sin(lat2) + Math.cos(lat1)*Math.cos(lat2)*Math.cos(lng2-lng1);
  const delta = Math.acos(Math.max(-1, Math.min(1, cosDelta)));
  if (delta < 1e-8) return { lat: lat1d, lng: lng1d, heading: 0 };
  const sinD = Math.sin(delta);
  const A = Math.sin((1-t)*delta)/sinD, B = Math.sin(t*delta)/sinD;
  const x = A*Math.cos(lat1)*Math.cos(lng1) + B*Math.cos(lat2)*Math.cos(lng2);
  const y = A*Math.cos(lat1)*Math.sin(lng1) + B*Math.cos(lat2)*Math.sin(lng2);
  const z = A*Math.sin(lat1)                + B*Math.sin(lat2);
  const lat = Math.atan2(z, Math.sqrt(x*x+y*y));
  const lng = Math.atan2(y, x);
  const t2 = Math.min(t + 0.001, 1);
  const A2=Math.sin((1-t2)*delta)/sinD, B2=Math.sin(t2*delta)/sinD;
  const x2=A2*Math.cos(lat1)*Math.cos(lng1)+B2*Math.cos(lat2)*Math.cos(lng2);
  const y2=A2*Math.cos(lat1)*Math.sin(lng1)+B2*Math.cos(lat2)*Math.sin(lng2);
  const z2=A2*Math.sin(lat1)+B2*Math.sin(lat2);
  const lat2r=Math.atan2(z2,Math.sqrt(x2*x2+y2*y2)), lng2r=Math.atan2(y2,x2);
  const heading = (Math.atan2(lng2r-lng, lat2r-lat) * 180 / Math.PI + 360) % 360;
  return { lat: lat/R, lng: lng/R, heading };
}

const _truckTexCache = {};
function makeTruckCanvas(colorStr, isTank) {
  const key = colorStr + (isTank ? 'T' : 'R');
  if (_truckTexCache[key]) return _truckTexCache[key];
  const c = document.createElement('canvas');
  c.width = 28; c.height = 56;
  const ctx = c.getContext('2d');

  const glow = ctx.createRadialGradient(14, 28, 2, 14, 28, 16);
  glow.addColorStop(0, colorStr.replace(/[\d.]+\)$/, '0.25)'));
  glow.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, 28, 56);

  const bright = colorStr;
  const dim    = colorStr.replace(/[\d.]+\)$/, '0.65)');

  // Cab
  ctx.fillStyle = bright;
  ctx.fillRect(7, 2, 14, 13);
  // Windshield
  ctx.fillStyle = 'rgba(0,0,0,0.4)';
  ctx.fillRect(9, 4, 10, 6);

  if (isTank) {
    ctx.fillStyle = dim;
    ctx.beginPath();
    ctx.ellipse(14, 38, 9, 17, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = colorStr.replace(/[\d.]+\)$/, '0.28)');
    ctx.beginPath();
    ctx.ellipse(11, 34, 4, 8, -0.2, 0, Math.PI * 2);
    ctx.fill();
  } else {
    ctx.fillStyle = dim;
    ctx.fillRect(7, 17, 14, 34);
    ctx.strokeStyle = colorStr.replace(/[\d.]+\)$/, '0.3)');
    ctx.lineWidth = 0.8;
    ctx.beginPath();
    ctx.moveTo(7, 41);
    ctx.lineTo(21, 41);
    ctx.stroke();
  }

  _truckTexCache[key] = c;
  return c;
}

function setSpritePos(sprite, lat, lng, alt, globeRadius) {
  const phi   = (90 - lat)  * Math.PI / 180;
  const theta = (90 - lng) * Math.PI / 180;
  const r = globeRadius * (1 + alt);
  sprite.position.set(
    r * Math.sin(phi) * Math.cos(theta),
    r * Math.cos(phi),
    r * Math.sin(phi) * Math.sin(theta),
  );
}

export default function LandGlobe({ trucks, ports, onTruckClick, focusTarget, width, height }) {
  const globeRef  = useRef();
  const threeRefs = useRef({ scene: null, camera: null, renderer: null, sprites: new Map() });
  const rafRef    = useRef();
  const moonSetupDone = useRef(false);

  const setupMoon = useCallback((scene, globeRadius) => {
    if (moonSetupDone.current) return;
    moonSetupDone.current = true;
    const mc = document.createElement('canvas');
    mc.width = 128; mc.height = 128;
    const mctx = mc.getContext('2d');
    const mg = mctx.createRadialGradient(64, 64, 0, 64, 64, 64);
    mg.addColorStop(0, '#e2e8f0'); mg.addColorStop(0.6, '#cbd5e1'); mg.addColorStop(1, '#94a3b8');
    mctx.fillStyle = mg; mctx.beginPath(); mctx.arc(64, 64, 64, 0, Math.PI * 2); mctx.fill();
    for (let i = 0; i < 14; i++) {
      const cx = 10 + Math.random() * 108, cy = 10 + Math.random() * 108, r = 2 + Math.random() * 8;
      mctx.fillStyle = 'rgba(100,116,139,0.25)';
      mctx.beginPath(); mctx.arc(cx, cy, r, 0, Math.PI * 2); mctx.fill();
    }
    const moonMesh = new THREE.Mesh(
      new THREE.SphereGeometry(globeRadius * 0.12, 16, 16),
      new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(mc) }),
    );
    const orbitR = globeRadius * 3.5;
    const orbitGeo = new THREE.BufferGeometry();
    const pts = [];
    for (let i = 0; i <= 128; i++) { const a = (i / 128) * Math.PI * 2; pts.push(Math.cos(a) * orbitR, 0, Math.sin(a) * orbitR); }
    orbitGeo.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3));
    const orbitLine = new THREE.Line(orbitGeo, new THREE.LineBasicMaterial({ color: 0x1e293b, transparent: true, opacity: 0.35 }));
    scene.add(orbitLine);
    scene.add(moonMesh);
    const moonAngle = { v: 0 };
    const animMoon = () => { moonAngle.v += 0.0003; moonMesh.position.set(Math.cos(moonAngle.v) * orbitR, 0, Math.sin(moonAngle.v) * orbitR); requestAnimationFrame(animMoon); };
    animMoon();
  }, []);

  const onGlobeReady = useCallback(() => {
    const g = globeRef.current;
    if (!g) return;
    const renderer    = g.renderer();
    const scene       = g.scene();
    const camera      = g.camera();
    const globeRadius = g.getGlobeRadius();
    threeRefs.current = { ...threeRefs.current, scene, camera, renderer };
    setupMoon(scene, globeRadius);
    g.pointOfView(HOME_POV, 1200);

    const animate = () => {
      rafRef.current = requestAnimationFrame(animate);
      const refs = threeRefs.current;
      if (refs.sprites.size > 0) {
        const now = Date.now();
        for (const entry of refs.sprites.values()) {
          const { sprite, srcLat, srcLng, dstLat, dstLng, progress0, fetchTs, globeRadius: gr } = entry;
          const elapsed = (now - fetchTs) / 1000;
          const t = (progress0 + elapsed / 86400) % 1;
          const pt = gcPoint(srcLat, srcLng, dstLat, dstLng, t);
          setSpritePos(sprite, pt.lat, pt.lng, 0.035, gr);
          sprite.material.rotation = -(pt.heading * Math.PI / 180);
        }
      }
      renderer.render(scene, camera);
    };
    animate();
  }, [setupMoon]);

  useEffect(() => { threeRefs.current.sprites = new Map(); }, [trucks]);

  useEffect(() => {
    if (!focusTarget || !globeRef.current) return;
    globeRef.current.pointOfView({ lat: focusTarget.lat, lng: focusTarget.lng, altitude: 0.8 }, 900);
  }, [focusTarget]);

  useEffect(() => () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); }, []);

  const arcs = useMemo(() =>
    trucks.filter(t => t.lat && t.lng).map(t => ({
      startLat: t.srcLat, startLng: t.srcLng,
      endLat:   t.dstLat, endLng:   t.dstLng,
      color: [truckDim(t.type), truckColor(t.type)],
      id: t.id, progress: t.progress ?? 0,
    })),
  [trucks]);

  const allLabels = useMemo(() => [
    ...DISTRIBUTION_HUBS.map(h => ({
      lat: h.lat, lng: h.lng, text: h.code,
      size: 0.5, color: 'rgba(0,212,255,0.75)',
      dotRadius: 0.35, dotColor: '#00d4ff', type: 'hub',
    })),
    ...ports.map(p => ({
      lat: p.lat, lng: p.lng, text: p.name,
      size: 0.4, color: portStatusColor(p.status),
      dotRadius: 0.28, dotColor: portStatusColor(p.status), type: 'port',
    })),
  ], [ports]);

  const allRings = useMemo(() => [
    ...BORDER_CROSSINGS.map(b => ({
      lat: b.lat, lng: b.lng,
      maxRadius: b.maxRadius, propagationSpeed: b.propagationSpeed,
      repeatPeriod: b.repeatPeriod, color: b.color,
    })),
    ...ports.filter(p => p.status !== 'clear').map(p => ({
      lat: p.lat, lng: p.lng,
      maxRadius: p.status === 'disruption' ? 4 : 3,
      propagationSpeed: p.status === 'disruption' ? 2.5 : 1.5,
      repeatPeriod: p.status === 'disruption' ? 700 : 1000,
      color: portStatusColor(p.status),
    })),
  ], [ports]);

  return (
    <Globe
      ref={globeRef}
      width={width}
      height={height}
      onGlobeReady={onGlobeReady}
      globeImageUrl="//unpkg.com/three-globe/example/img/earth-topology.png"
      backgroundColor="rgba(0,0,0,0)"
      atmosphereColor="rgba(0,180,255,0.25)"
      atmosphereAltitude={0.25}

      arcsData={arcs}
      arcStartLat="startLat" arcStartLng="startLng"
      arcEndLat="endLat"     arcEndLng="endLng"
      arcColor="color"
      arcDashLength={0.35} arcDashGap={0.6} arcDashAnimateTime={4500}
      arcStroke={0.4} arcAltitudeAutoScale={0.3}

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

      customLayerData={trucks.filter(t => t.lat && t.lng)}
      customThreeObject={truck => {
        const isTank   = truck.type === 'tank';
        const colorStr = isTank ? TANK_COLOR : REGULAR_COLOR;
        const tex = new THREE.CanvasTexture(makeTruckCanvas(colorStr, isTank));
        const mat = new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false });
        const s   = new THREE.Sprite(mat);
        s.scale.set(1.4, isTank ? 2.4 : 2.8, 1);
        return s;
      }}
      customThreeObjectUpdate={(sprite, truck) => {
        const refs = threeRefs.current;
        const gr   = globeRef.current?.getGlobeRadius?.() ?? 100;
        setSpritePos(sprite, truck.lat, truck.lng, 0.035, gr);
        sprite.material.rotation = -(truck.heading * Math.PI / 180);
        refs.sprites.set(truck.id, {
          sprite, globeRadius: gr,
          srcLat: truck.srcLat, srcLng: truck.srcLng,
          dstLat: truck.dstLat, dstLng: truck.dstLng,
          progress0: truck.progress ?? 0,
          fetchTs: Date.now() - ((truck.progress ?? 0) * 86400000),
        });
      }}
      onCustomLayerClick={obj => onTruckClick?.(obj)}
    />
  );
}
