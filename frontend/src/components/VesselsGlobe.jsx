// frontend/src/components/VesselsGlobe.jsx
import { useEffect, useRef, useCallback, useMemo } from 'react';
import Globe from 'react-globe.gl';
import * as THREE from 'three';
import { RiRefreshLine } from 'react-icons/ri';

const DISRUPTION_ZONES = [
  { lat: 26.5, lng: 56.5, label: 'Strait of Hormuz', color: '#ef4444', maxRadius: 5, propagationSpeed: 3, repeatPeriod: 700 },
  { lat: 13.5, lng: 43.5, label: 'Red Sea / Bab-el-Mandeb', color: '#f59e0b', maxRadius: 4, propagationSpeed: 2, repeatPeriod: 900 },
  { lat: 31.5, lng: 32.3, label: 'Suez Canal', color: '#f59e0b', maxRadius: 3, propagationSpeed: 1.8, repeatPeriod: 1100 },
];

const HOME_POV = { lat: 20, lng: 10, altitude: 2.2 };

function vesselColor(type) {
  // Handle both AIS numeric codes (70=Cargo, 80=Tanker) and string labels
  let t = '';
  if (typeof type === 'number') {
    if (type >= 80 && type < 90) t = 'Tanker';
    else if (type >= 70 && type < 80) t = 'Container';
  } else {
    t = String(type || '');
  }
  if (t.includes('Tanker')) return 'rgba(249,115,22,0.9)'; // orange — distinct from amber Congested
  if (t.includes('Bulk'))   return 'rgba(167,139,250,0.9)';
  return 'rgba(0,212,255,0.9)';
}

function portStatusColor(status) {
  if (status === 'disruption') return '#ef4444';
  if (status === 'congestion') return '#f59e0b';
  return '#10b981';
}

// Trail arc: origin port → current vessel position.
// Dim at origin, bright at the vessel's current position — gives a wake/trail effect.
// Simulated vessels use known srcLat/srcLng; live AIS vessels use nearest known port.
function dimColor(color) {
  return color.replace(/[\d.]+\)$/, '0.06)');
}
function nearestPort(lat, lng, ports) {
  if (!ports.length) return null;
  let best = ports[0], bestDist = Infinity;
  for (const p of ports) {
    const d = (p.lat - lat) ** 2 + (p.lng - lng) ** 2;
    if (d < bestDist) { bestDist = d; best = p; }
  }
  return best;
}
function trailArc(vessel, ports) {
  if (!vessel.lat) return null;
  let srcLat = vessel.srcLat, srcLng = vessel.srcLng;
  if (!srcLat) {
    const p = nearestPort(vessel.lat, vessel.lng, ports);
    if (!p) return null;
    srcLat = p.lat; srcLng = p.lng;
  }
  const bright = vesselColor(vessel.type);
  return {
    startLat: srcLat, startLng: srcLng,
    endLat: vessel.lat, endLng: vessel.lng,
    color: [dimColor(bright), bright],
    mmsi: vessel.mmsi,
  };
}

// ── Ship sprite icons (customLayerData) ────────────────────────────────────
// CanvasTexture is created once per color → uploaded to GPU once → reused by all
// vessels of that type. SpriteMaterial is lightweight (just a map reference).
const _shipTexCache = {};
function makeShipCanvas(colorStr) {
  const c = document.createElement('canvas');
  c.width = 32; c.height = 48;
  const ctx = c.getContext('2d');
  // Glow halo
  const glow = ctx.createRadialGradient(16, 24, 2, 16, 24, 16);
  glow.addColorStop(0, colorStr.replace(/[\d.]+\)$/, '0.3)'));
  glow.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = glow; ctx.fillRect(0, 0, 32, 48);
  // Hull: pointed bow at top (y=4), bezier midship, tapered stern
  ctx.fillStyle = colorStr;
  ctx.beginPath();
  ctx.moveTo(16, 4);
  ctx.bezierCurveTo(22, 12, 24, 22, 22, 32);
  ctx.lineTo(20, 44); ctx.lineTo(12, 44); ctx.lineTo(10, 32);
  ctx.bezierCurveTo(8, 22, 10, 12, 16, 4);
  ctx.closePath(); ctx.fill();
  // Centerline stripe
  ctx.strokeStyle = 'rgba(255,255,255,0.5)'; ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(16, 8); ctx.lineTo(16, 40); ctx.stroke();
  // Superstructure block
  ctx.fillStyle = 'rgba(255,255,255,0.2)'; ctx.fillRect(12, 26, 8, 8);
  return c;
}
function makeShipSprite(vessel) {
  const color = vesselColor(vessel.type);
  if (!_shipTexCache[color]) _shipTexCache[color] = new THREE.CanvasTexture(makeShipCanvas(color));
  const mat = new THREE.SpriteMaterial({ map: _shipTexCache[color], transparent: true, depthWrite: false, sizeAttenuation: true });
  const sprite = new THREE.Sprite(mat);
  sprite.scale.set(5, 8, 1);
  return sprite;
}

export default function VesselsGlobe({ vessels = [], ports = [], onVesselClick, focusTarget, source, width, height }) {
  const globeRef = useRef(null);

  // Single ref object for all Three.js scene objects — safe across React strict-mode double-mount
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
      const ringGeom = new THREE.TorusGeometry(102, 0.6, 8, 64);
      const ringMat = new THREE.MeshBasicMaterial({ color: 0x004466, transparent: true, opacity: 0.4 });
      const ringMesh = new THREE.Mesh(ringGeom, ringMat);
      ringMesh.rotation.x = Math.PI / 2;
      scene.add(ringMesh);
      refs.ringMesh = ringMesh; refs.ringGeom = ringGeom; refs.ringMat = ringMat;

      // ── Moon (same texture + orbit as homepage, MeshBasicMaterial for GPU efficiency) ──
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
      // MeshBasicMaterial: no lighting pass needed, much lighter GPU load than MeshStandardMaterial
      const moonMat = new THREE.MeshBasicMaterial({ map: moonTex });
      const moonMesh = new THREE.Mesh(moonGeom, moonMat);
      scene.add(moonMesh);
      refs.moonMesh = moonMesh; refs.moonGeom = moonGeom; refs.moonMat = moonMat; refs.moonTex = moonTex;

      // ── Unified RAF: ring rotation + moon orbit ──
      // IMPORTANT: use refs.ringMesh / refs.moonMesh — NOT closure vars.
      // Closure vars are stale if this effect cleanup runs and a new effect starts
      // (e.g. StrictMode double-mount). Using refs ensures we always access the
      // current mesh, and try/catch ensures a thrown error doesn't kill the loop.
      refs.shouldAnimate = true;
      const animate = () => {
        if (!refs.shouldAnimate) return;
        try {
          if (refs.ringMesh) refs.ringMesh.rotation.z += 0.001;
          if (refs.moonMesh) {
            const t = Date.now() * 0.00008;
            refs.moonMesh.position.set(Math.cos(t) * 165, Math.sin(t * 0.28) * 28, Math.sin(t) * 165);
          }
        } catch (_) { /* mesh temporarily unavailable — keep loop alive */ }
        refs.frame = requestAnimationFrame(animate);
      };
      animate();
    }, 600);

    return () => {
      // react-globe.gl destroys its WebGL context before our cleanup runs.
      // Calling .dispose() on geometries whose context is already gone throws WebGL errors.
      // Wrap everything in try-catch — the context being gone means resources are already freed.
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
      } catch (_) {
        // WebGL context already gone — resources freed by browser, safe to ignore
      } finally {
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

  // Trail arcs: origin port → current vessel position, updated on every refresh.
  // Simulated vessels use known srcLat/srcLng; live AIS vessels use nearest known port.
  const arcs = useMemo(() =>
    vessels.filter(v => v.lat && v.lng).map(v => trailArc(v, ports)).filter(Boolean),
  [vessels, ports]);

  // Pan globe when feed card vessel is clicked
  useEffect(() => {
    if (!focusTarget || !globeRef.current) return;
    globeRef.current.pointOfView({ lat: focusTarget.lat, lng: focusTarget.lng, altitude: 1.2 }, 1500);
  }, [focusTarget]);

  // Only disruption-status port rings + the 3 fixed disruption zones (max 8 rings total)
  const allRings = useMemo(() => {
    const portDisruptRings = ports
      .filter(p => p.status === 'disruption')
      .slice(0, 5)
      .map(p => ({
        lat: p.lat, lng: p.lng,
        maxRadius: 3.5, propagationSpeed: 2.5, repeatPeriod: 850,
        color: '#ef4444',
      }));
    return [...DISRUPTION_ZONES, ...portDisruptRings];
  }, [ports]);

  const portPoints = useMemo(() => ports.map(p => ({
    ...p, dotColor: portStatusColor(p.status),
  })), [ports]);

  const handleVesselClick = useCallback((point) => {
    const g = globeRef.current;
    if (g) {
      g.controls().autoRotate = false;
      g.pointOfView({ lat: point.lat, lng: point.lng, altitude: 1.2 }, 800);
    }
    onVesselClick?.(point);
  }, [onVesselClick]);

  const labelColor = useCallback(p => portStatusColor(p.status), []);

  const portLabel = useCallback((p) => {
    const c = portStatusColor(p.status);
    return `<div style="color:${c};font-size:10px;font-family:'JetBrains Mono',monospace;background:rgba(6,11,24,0.85);padding:2px 6px;border-radius:4px;border:1px solid ${c}40">${p.name}<br/><span style="font-size:9px;opacity:0.7">${p.status} · ${p.congestion}/10</span></div>`;
  }, []);

  const vesselLabel = useCallback((v) =>
    `<div style="color:#e2e8f0;font-size:11px;background:rgba(6,11,24,0.9);padding:4px 8px;border-radius:6px;border:1px solid rgba(0,212,255,0.25);font-family:'JetBrains Mono',monospace"><strong>${v.name || 'MMSI ' + v.mmsi}</strong><br/>${String(v.type || 'Unknown')} · ${(v.sog || 0).toFixed(1)} kn${v.dstName ? '<br/>' + (v.srcName || '') + ' → ' + v.dstName : ''}</div>`,
  []);

  return (
    <div style={{ position: 'relative', width, height }}>
      <Globe
        ref={globeRef}
        width={width}
        height={height}
        globeImageUrl="//unpkg.com/three-globe/example/img/earth-blue-marble.jpg"
        bumpImageUrl="//unpkg.com/three-globe/example/img/earth-topology.png"
        backgroundImageUrl="//unpkg.com/three-globe/example/img/night-sky.png"
        backgroundColor="rgba(0,0,0,0)"
        atmosphereColor="rgba(0,180,255,0.25)"
        atmosphereAltitude={0.25}
        customLayerData={vessels}
        customThreeObject={makeShipSprite}
        customThreeObjectUpdate={(sprite, vessel, globeRadius) => {
          const alt = 0.025;
          const phi = (90 - vessel.lat) * Math.PI / 180;
          const theta = (90 - vessel.lng) * Math.PI / 180;
          const r = globeRadius * (1 + alt);
          const ps = Math.sin(phi);
          sprite.position.set(r * ps * Math.cos(theta), r * Math.cos(phi), r * ps * Math.sin(theta));
          sprite.material.rotation = -((vessel.cog ?? vessel.heading ?? 0) * Math.PI / 180);
        }}
        onCustomLayerClick={handleVesselClick}
        customLayerLabel={vesselLabel}
        arcsData={arcs}
        arcColor="color"
        arcDashLength={0.5}
        arcDashGap={0.5}
        arcDashInitialGap={0}
        arcDashAnimateTime={4000}
        arcStroke={0.25}
        arcAltitudeAutoScale={0.18}
        arcCurveResolution={24}
        ringsData={allRings}
        ringColor="color"
        ringMaxRadius="maxRadius"
        ringPropagationSpeed="propagationSpeed"
        ringRepeatPeriod="repeatPeriod"
        labelsData={portPoints}
        labelLat="lat"
        labelLng="lng"
        labelText="name"
        labelSize={0.35}
        labelDotRadius={0.4}
        labelColor={labelColor}
        labelResolution={2}
        labelLabel={portLabel}
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
