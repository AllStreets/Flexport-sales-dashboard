// frontend/src/pages/MarketMapPage.jsx
import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { RiFlashlightLine, RiArrowRightLine } from 'react-icons/ri';
import './MarketMapPage.css';

const API = import.meta.env.VITE_API_URL || 'http://localhost:5000';

// ── Static sector intelligence ────────────────────────────────────────────────
// TAMs reflect US freight forwarding addressable market by sector (2024-2025 trade data)
const SECTOR_META = {
  'e-commerce': {
    tam: '$38B', freight: '$180K avg/yr',
    products: ['Cross-Border', 'Duty Deferral', 'Ocean LCL', 'Tracking'],
    subsegments: ['DTC Apparel', 'DTC Beauty', 'DTC Home', 'Multi-Cat'],
    signal: 'Q2 peak season import surge underway — window to displace incumbents',
  },
  'apparel': {
    tam: '$22B', freight: '$220K avg/yr',
    products: ['Ocean FCL', 'Air Freight', 'Customs Brokerage'],
    subsegments: ['Fast Fashion', 'Activewear', 'Luxury', 'Accessories'],
    signal: 'Vietnam & Bangladesh sourcing shift accelerating — new lane complexity',
  },
  'beauty': {
    tam: '$8B', freight: '$95K avg/yr',
    products: ['Air Freight', 'Customs Brokerage', 'Duty Deferral'],
    subsegments: ['Skincare', 'Color Cosmetics', 'Hair Care', 'Wellness'],
    signal: 'K-beauty import volumes up 18% YoY — FDA compliance complexity rising',
  },
  'furniture': {
    tam: '$20B', freight: '$340K avg/yr',
    products: ['Ocean LCL', 'Ocean FCL', 'Warehousing'],
    subsegments: ['Home Furniture', 'Office Furniture', 'Outdoor', 'Lighting'],
    signal: 'China §301 tariffs at 25%+ — brands actively repricing Vietnam/Malaysia sourcing',
  },
  'cpg': {
    tam: '$45B', freight: '$280K avg/yr',
    products: ['Ocean FCL', 'Cross-Border', 'Duty Deferral'],
    subsegments: ['Food & Bev', 'Personal Care', 'Household', 'Pet'],
    signal: 'Supply chain resilience top CFO priority — visibility platforms in high demand',
  },
  'industrial': {
    tam: '$65B', freight: '$520K avg/yr',
    products: ['Air Freight', 'Project Cargo', 'Customs Brokerage'],
    subsegments: ['Capital Goods', 'Auto Parts', 'Electronics MFG', 'Machinery'],
    signal: 'Auto parts §301 tariffs raised to 25% in 2025 — duty deferral urgency high',
  },
  'pharma': {
    tam: '$18B', freight: '$310K avg/yr',
    products: ['Temperature Control', 'Air Freight', 'Compliance'],
    subsegments: ['OTC Products', 'Medical Devices', 'Supplements', 'Biotech'],
    signal: 'FDA cold chain traceability rules tightening — compliance-first forwarder demand up',
  },
  'electronics': {
    tam: '$62B', freight: '$410K avg/yr',
    products: ['Air Freight', 'Section 301 Mgmt', 'Duty Deferral'],
    subsegments: ['Consumer Elec.', 'Semiconductors', 'Industrial Equip.', 'Components'],
    signal: 'Section 301 at 25% on most China electronics — duty savings ROI compelling',
  },
  'activewear': {
    tam: '$12B', freight: '$180K avg/yr',
    products: ['Ocean FCL', 'Air Freight', 'Duty Deferral'],
    subsegments: ['Performance', 'Yoga & Studio', 'Running', 'Outdoor Sport'],
    signal: 'Vietnam & Cambodia near-shore sourcing growing fast — Flexport Asia lanes ideal',
  },
  'accessories': {
    tam: '$9B', freight: '$140K avg/yr',
    products: ['Ocean LCL', 'Air Freight', 'Customs Brokerage'],
    subsegments: ['Bags & Leather', 'Sunglasses', 'Hats & Belts', 'Tech Accessories'],
    signal: 'Italy & Turkey sourcing adds EU compliance complexity — brokerage value-add high',
  },
  'footwear': {
    tam: '$15B', freight: '$195K avg/yr',
    products: ['Ocean FCL', 'Air Freight', 'Customs Brokerage'],
    subsegments: ['Athletic', 'Casual', 'Luxury', 'Workwear'],
    signal: 'China §301 duties at 25–67% on footwear — Vietnam reshoring creating new lanes',
  },
  'home-goods': {
    tam: '$18B', freight: '$260K avg/yr',
    products: ['Ocean FCL', 'Ocean LCL', 'Warehousing'],
    subsegments: ['Cookware', 'Kitchen Storage', 'Home Decor', 'Small Appliances'],
    signal: 'China §301 tariffs on HTS 39/73/85 — Vietnam & India reshoring accelerating',
  },
  'home-textiles': {
    tam: '$11B', freight: '$210K avg/yr',
    products: ['Ocean FCL', 'Customs Brokerage', 'Duty Deferral'],
    subsegments: ['Bedding', 'Bath Linens', 'Rugs & Flooring', 'Window Treatments'],
    signal: 'India & Bangladesh share rising — long dwell times demand 3PL visibility tools',
  },
  'pet': {
    tam: '$7B', freight: '$155K avg/yr',
    products: ['Ocean FCL', 'Customs Brokerage', 'Cold Chain'],
    subsegments: ['Pet Food', 'Toys & Play', 'Health & Wellness', 'Habitat & Gear'],
    signal: 'Pet category grew 14% in 2024 — China-sourced compliance burden is rising',
  },
  'health': {
    tam: '$14B', freight: '$220K avg/yr',
    products: ['Air Freight', 'Temperature Control', 'Compliance'],
    subsegments: ['Supplements', 'Fitness Devices', 'Wellness Tech', 'Nutrition'],
    signal: 'FTC supplement crackdown + FDA traceability rules — compliance-first pitch wins',
  },
  'outdoor': {
    tam: '$16B', freight: '$240K avg/yr',
    products: ['Ocean FCL', 'Air Freight', 'Customs Brokerage'],
    subsegments: ['Camping & Hiking', 'Cycling', 'Water Sports', 'Snow Sports'],
    signal: 'Post-pandemic outdoor demand sustained — Asia-sourced gear reshoring to Vietnam',
  },
  'jewelry': {
    tam: '$6B', freight: '$110K avg/yr',
    products: ['Air Freight', 'Customs Brokerage', 'Duty Deferral'],
    subsegments: ['Fine Jewelry', 'Fashion Jewelry', 'Watches', 'Lab-Grown'],
    signal: 'High-value air shipments at risk from duty changes — FTZ bonded warehouse pitch',
  },
};

const DEFAULT_META = {
  tam: '$10B', freight: '$200K avg/yr',
  products: ['Ocean Freight', 'Customs Brokerage', 'Duty Deferral'],
  subsegments: ['Segment A', 'Segment B', 'Segment C', 'Segment D'],
  signal: 'Multiple high-ICP prospects identified',
};

const STAGE_COLORS = {
  demo_booked: '#10b981',
  closed_won:  '#f59e0b',
  called:      '#8b5cf6',
  researched:  '#6366f1',
  new:         '#2563eb',
  closed_lost: '#475569',
};

const ICP_COLOR = s => s >= 85 ? '#10b981' : s >= 70 ? '#f59e0b' : '#ef4444';

// ── Node Graph ────────────────────────────────────────────────────────────────
function NodeGraph({ sector, onProspectClick }) {
  const [visible, setVisible]     = useState(false);
  const [scale, setScale]         = useState(1);
  const [offset, setOffset]       = useState({ x: 0, y: 0 });
  const containerRef              = useRef(null);
  const isPanning                 = useRef(false);
  const panStart                  = useRef(null);
  const dragMoved                 = useRef(false);

  // Reset view when sector changes
  useEffect(() => {
    setVisible(false);
    setScale(1);
    setOffset({ x: 0, y: 0 });
    const t = setTimeout(() => setVisible(true), 60);
    return () => clearTimeout(t);
  }, [sector?.sector]);

  // Attach wheel listener as non-passive so we can preventDefault
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const onWheel = (e) => {
      e.preventDefault();
      // Two-finger scroll OR pinch (ctrlKey) → zoom in/out (matches globe behavior)
      if (Math.abs(e.deltaY) > Math.abs(e.deltaX) || e.ctrlKey) {
        const factor = e.deltaY > 0 ? 0.93 : 1.07;
        setScale(prev => Math.min(5, Math.max(0.25, prev * factor)));
      } else {
        // Predominantly horizontal scroll → pan horizontally
        setOffset(prev => ({ x: prev.x - e.deltaX, y: prev.y }));
      }
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, []);

  // Click-drag to pan
  const onMouseDown = (e) => {
    if (e.button !== 0) return;
    isPanning.current  = true;
    dragMoved.current  = false;
    panStart.current   = { mx: e.clientX, my: e.clientY, ox: offset.x, oy: offset.y };
    e.currentTarget.style.cursor = 'grabbing';
  };

  const onMouseMove = (e) => {
    if (!isPanning.current || !panStart.current) return;
    const dx = e.clientX - panStart.current.mx;
    const dy = e.clientY - panStart.current.my;
    if (Math.abs(dx) + Math.abs(dy) > 3) dragMoved.current = true;
    setOffset({ x: panStart.current.ox + dx, y: panStart.current.oy + dy });
  };

  const onMouseUp = (e) => {
    isPanning.current = false;
    if (e.currentTarget) e.currentTarget.style.cursor = 'grab';
  };

  const resetView = () => { setScale(1); setOffset({ x: 0, y: 0 }); };

  if (!sector) return null;

  const meta = SECTOR_META[sector.sector?.toLowerCase()] || DEFAULT_META;
  const allProspects = sector.prospects || [];
  const subs = meta.subsegments;

  const W = 680, H = 600;
  const cx = W / 2, cy = H / 2;
  const R1 = 148;
  const R2 = 82;

  // Assign prospects to sub-segments round-robin, up to 5 per sub (= 20 max visible)
  const subGroups = subs.map((sub, si) => ({
    sub,
    si,
    angle: (si / subs.length) * Math.PI * 2 - Math.PI / 2,
    prospects: allProspects.filter((_, pi) => pi % subs.length === si).slice(0, 5),
  }));

  return (
    <div
      ref={containerRef}
      className="ng-container"
      onMouseDown={onMouseDown}
      onMouseMove={onMouseMove}
      onMouseUp={onMouseUp}
      onMouseLeave={onMouseUp}
    >
      {(scale !== 1 || offset.x !== 0 || offset.y !== 0) && (
        <button className="ng-reset-btn" onClick={resetView} title="Reset zoom">1:1</button>
      )}
    <svg
      width="100%"
      height="100%"
      viewBox={`0 0 ${W} ${H}`}
      preserveAspectRatio="xMidYMid meet"
      className="ng-svg"
      style={{
        transform: `translate(${offset.x}px, ${offset.y}px) scale(${scale})`,
        transformOrigin: 'center center',
        transition: isPanning.current ? 'none' : 'transform 0.08s ease-out',
        overflow: 'visible',
      }}
    >
      <defs>
        <filter id="ng-glow" x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur in="SourceGraphic" stdDeviation="3" result="b" />
          <feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge>
        </filter>
        <filter id="ng-glow-sm" x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur in="SourceGraphic" stdDeviation="2" result="b" />
          <feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge>
        </filter>
      </defs>

      {subGroups.map(({ sub, si, angle, prospects: pGroup }) => {
        const sx = cx + R1 * Math.cos(angle);
        const sy = cy + R1 * Math.sin(angle);

        return (
          <g key={sub}>
            {/* Connector line */}
            <line x1={cx} y1={cy} x2={sx} y2={sy}
              stroke="rgba(99,102,241,0.3)" strokeWidth="1.5" strokeDasharray="5 4"
              className={`ng-line ${visible ? 'visible' : ''}`}
              style={{ '--d': `${si * 60}ms` }}
            />

            {/* Sub-segment node */}
            <g className={`ng-node ${visible ? 'visible' : ''}`} style={{ '--d': `${si * 80}ms` }}>
              <circle cx={sx} cy={sy} r={26}
                fill="rgba(99,102,241,0.08)" stroke="rgba(99,102,241,0.45)" strokeWidth="1.5"
              />
              <text x={sx} y={sy + 1} textAnchor="middle" dominantBaseline="middle"
                fill="#a5b4fc" fontSize="7.5" fontFamily="'Space Grotesk', sans-serif" fontWeight="600"
              >{sub.length > 16 ? sub.slice(0, 15) + '…' : sub}</text>
            </g>

            {/* Prospect nodes */}
            {pGroup.map((p, pi) => {
              // Tighten spread as group grows to keep adjacent sub-groups from overlapping
              const spread = pGroup.length <= 1 ? 0 : pGroup.length <= 3 ? 0.52 : 0.40;
              const pAngle = angle + (pi - (pGroup.length - 1) / 2) * spread;
              const px = sx + R2 * Math.cos(pAngle);
              const py = sy + R2 * Math.sin(pAngle);
              const pr = 5 + Math.round((p.icp_score || 70) / 22);
              const color = STAGE_COLORS[p.pipeline_stage] || STAGE_COLORS.new;

              return (
                <g key={p.id}
                  className={`ng-node ng-prospect ${visible ? 'visible' : ''}`}
                  style={{ '--d': `${si * 80 + pi * 70 + 180}ms`, cursor: 'pointer' }}
                  onClick={(e) => { if (dragMoved.current) { e.stopPropagation(); return; } onProspectClick(p.id); }}
                >
                  <line x1={sx} y1={sy} x2={px} y2={py}
                    stroke={`${color}35`} strokeWidth="1"
                  />
                  <circle cx={px} cy={py} r={pr + 5}
                    fill={`${color}10`} stroke="none" className="ng-halo"
                  />
                  <circle cx={px} cy={py} r={pr}
                    fill={`${color}20`} stroke={color} strokeWidth="1.5"
                    filter="url(#ng-glow-sm)"
                  />
                  <text x={px} y={py + pr + 9} textAnchor="middle"
                    fill="#94a3b8" fontSize="6" fontFamily="'Space Grotesk', sans-serif"
                  >{p.name?.split(' ').slice(0, 2).join(' ') ?? ''}</text>
                </g>
              );
            })}
          </g>
        );
      })}

      {/* Center sector node */}
      <circle cx={cx} cy={cy} r={44}
        fill="rgba(0,212,255,0.07)" stroke="rgba(0,212,255,0.35)" strokeWidth="2"
        filter="url(#ng-glow)"
      />
      <circle cx={cx} cy={cy} r={38} fill="none" stroke="rgba(0,212,255,0.12)" strokeWidth="1" />
      <text x={cx} y={cy - 4} textAnchor="middle" dominantBaseline="middle"
        fill="#00d4ff" fontSize="10" fontFamily="'Space Grotesk', sans-serif" fontWeight="700"
        letterSpacing="0.06"
      >{sector.sector?.toUpperCase()}</text>
      <text x={cx} y={cy + 12} textAnchor="middle"
        fill="#475569" fontSize="8" fontFamily="'JetBrains Mono', monospace"
      >{sector.count} prospects</text>
    </svg>
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function MarketMapPage() {
  const [sectors, setSectors] = useState([]);
  const [selected, setSelected] = useState(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    axios.get(`${API}/api/market-map`)
      .then(r => {
        const data = Array.isArray(r.data) ? r.data : [];
        setSectors(data);
        if (data.length > 0) setSelected(data[0]);
      })
      .catch(() => setSectors([]))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="mm-loading">
        <div className="mm-spinner" />
        <span>Loading market map…</span>
      </div>
    );
  }

  const meta = selected ? (SECTOR_META[selected.sector?.toLowerCase()] || DEFAULT_META) : null;
  const sectorProspects = selected?.prospects || [];

  return (
    <div className="mm-page">

      {/* ── Left: Sector Explorer ───────────────────────────────────────── */}
      <div className="mm-left">
        <div className="mm-panel-title">Sector Explorer</div>
        <div className="mm-sectors-list">
          {sectors.length === 0 && (
            <div className="mm-empty-hint">No sectors — seed the database to populate prospects.</div>
          )}
          {sectors.map(s => (
            <button
              key={s.sector}
              className={`mm-sector-card${selected?.sector === s.sector ? ' active' : ''}`}
              onClick={() => setSelected(s)}
            >
              {selected?.sector === s.sector && <div className="mm-active-bar" />}
              <div className="mm-sector-name">{s.sector}</div>
              <div className="mm-sector-row">
                <span className="mm-sector-count">{s.count} prospects</span>
                <span className="mm-sector-icp" style={{ color: ICP_COLOR(s.avgIcp) }}>ICP {s.avgIcp}</span>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* ── Center: Node Graph ──────────────────────────────────────────── */}
      <div className="mm-center">
        {selected ? (
          <>
            <div className="mm-panel-title">{selected.sector} — node map</div>
            <div className="mm-graph-wrap">
              <NodeGraph
                sector={selected}
                onProspectClick={id => navigate(`/account/${id}`)}
              />
            </div>
            <div className="mm-legend-row">
              {Object.entries(STAGE_COLORS).map(([stage, color]) => (
                <span key={stage} className="mm-legend-item">
                  <span className="mm-legend-dot" style={{ background: color }} />
                  {stage.replace('_', ' ')}
                </span>
              ))}
            </div>
          </>
        ) : (
          <div className="mm-empty">Select a sector to explore the node map</div>
        )}
      </div>

      {/* ── Right: Sector Intelligence ──────────────────────────────────── */}
      <div className="mm-right">
        {selected && meta ? (
          <>
            <div className="mm-panel-title">Sector Intelligence</div>

            <div className="mm-stat-grid">
              <div className="mm-stat-card">
                <div className="mm-stat-label">Est. TAM</div>
                <div className="mm-stat-val" style={{ color: '#00d4ff' }}>{meta.tam}</div>
              </div>
              <div className="mm-stat-card">
                <div className="mm-stat-label">Avg Freight Spend</div>
                <div className="mm-stat-val" style={{ color: '#10b981' }}>{meta.freight}</div>
              </div>
            </div>

            <div className="mm-section-card">
              <div className="mm-section-label">Flexport Products</div>
              <div className="mm-chips">
                {meta.products.map(p => (
                  <span key={p} className="mm-chip">{p}</span>
                ))}
              </div>
            </div>

            {meta.signal && (
              <div className="mm-signal">
                <RiFlashlightLine size={13} color="#f59e0b" style={{ flexShrink: 0 }} />
                <span>{meta.signal}</span>
              </div>
            )}

            <div className="mm-section-card mm-prospects-card">
              <div className="mm-section-label">
                All Prospects
                <span className="mm-prospect-count">{sectorProspects.length}</span>
              </div>
              {sectorProspects.length === 0 && (
                <div className="mm-empty-hint">No prospects in this sector yet.</div>
              )}
              <div className="mm-prospects-scroll">
                {sectorProspects.map(p => (
                  <button
                    key={p.id}
                    className="mm-prospect-row"
                    onClick={() => navigate(`/account/${p.id}`)}
                  >
                    <span className="mm-prospect-stage-dot"
                      style={{ background: STAGE_COLORS[p.pipeline_stage] || STAGE_COLORS.new }}
                    />
                    <span className="mm-prospect-name">{p.name}</span>
                    <span className="mm-prospect-right">
                      <span style={{ fontFamily: 'JetBrains Mono', fontSize: 11, fontWeight: 700, color: ICP_COLOR(p.icp_score) }}>
                        {p.icp_score}
                      </span>
                      <RiArrowRightLine size={12} color="#475569" />
                    </span>
                  </button>
                ))}
              </div>
            </div>
          </>
        ) : (
          <div className="mm-empty">Select a sector</div>
        )}
      </div>
    </div>
  );
}
