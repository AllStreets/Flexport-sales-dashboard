// frontend/src/pages/Account360Page.jsx
import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import ICPBadge from '../components/ICPBadge';
import './Account360Page.css';

const API = import.meta.env.VITE_API_URL || 'http://localhost:5000';

const COUNTRY_FLAGS = {
  'China': '🇨🇳', 'Vietnam': '🇻🇳', 'India': '🇮🇳', 'Bangladesh': '🇧🇩',
  'Malaysia': '🇲🇾', 'South Korea': '🇰🇷', 'Italy': '🇮🇹', 'Portugal': '🇵🇹',
  'Spain': '🇪🇸', 'Netherlands': '🇳🇱', 'Sweden': '🇸🇪', 'Turkey': '🇹🇷',
  'Mexico': '🇲🇽', 'Philippines': '🇵🇭', 'Cambodia': '🇰🇭', 'Singapore': '🇸🇬',
  'Peru': '🇵🇪', 'Argentina': '🇦🇷', 'Indonesia': '🇮🇩', 'Thailand': '🇹🇭',
};

function StreamText({ text, speed = 4, delay = 18 }) {
  const [displayed, setDisplayed] = useState('');
  useEffect(() => {
    if (!text) { setDisplayed(''); return; }
    setDisplayed('');
    let i = 0;
    const id = setInterval(() => {
      i += speed;
      setDisplayed(text.slice(0, i));
      if (i >= text.length) clearInterval(id);
    }, delay);
    return () => clearInterval(id);
  }, [text, speed, delay]);
  return <span>{displayed || <span className="stream-cursor">▊</span>}</span>;
}

function SupplyChainDiagram({ origins = [], lanes = [] }) {
  const svgH = Math.max(160, origins.length * 44 + 40);
  const svgW = 520;
  const cx = 340, cy = svgH / 2;
  const usX = 470, usY = svgH / 2;

  return (
    <div className="supply-chain-wrap">
      <svg viewBox={`0 0 ${svgW} ${svgH}`} className="supply-chain-svg" preserveAspectRatio="xMidYMid meet">
        <defs>
          <marker id="arrow" markerWidth="6" markerHeight="6" refX="5" refY="3" orient="auto">
            <path d="M0,0 L0,6 L6,3 z" fill="rgba(0,212,255,0.5)" />
          </marker>
          <filter id="glow">
            <feGaussianBlur stdDeviation="2" result="blur" />
            <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
          </filter>
        </defs>

        {/* Source country nodes */}
        {origins.map((country, i) => {
          const y = (i + 1) * (svgH / (origins.length + 1));
          const flag = COUNTRY_FLAGS[country] || '🌏';
          return (
            <g key={country} className="sc-node" style={{ animationDelay: `${i * 0.08}s` }}>
              <circle cx={52} cy={y} r={22} fill="rgba(37,99,235,0.12)" stroke="rgba(37,99,235,0.4)" strokeWidth="1.5" />
              <text x={52} y={y + 2} textAnchor="middle" fontSize="18" dominantBaseline="middle">{flag}</text>
              <text x={52} y={y + 28} textAnchor="middle" fill="#64748b" fontSize="9" fontFamily="Inter">{country.slice(0, 8)}</text>
              {/* Flow line to port */}
              <path
                d={`M74,${y} Q${cx - 60},${y} ${cx - 28},${cy}`}
                fill="none"
                stroke="rgba(0,212,255,0.25)"
                strokeWidth="1.5"
                strokeDasharray="6 4"
                className="flow-line"
                style={{ animationDelay: `${i * 0.1}s` }}
                markerEnd="url(#arrow)"
              />
            </g>
          );
        })}

        {/* Port node */}
        <circle cx={cx} cy={cy} r={28} fill="rgba(0,212,255,0.08)" stroke="rgba(0,212,255,0.4)" strokeWidth="2" filter="url(#glow)" />
        <text x={cx} y={cy - 4} textAnchor="middle" fill="#00d4ff" fontSize="10" fontFamily="JetBrains Mono" fontWeight="700">PORT</text>
        <text x={cx} y={cy + 10} textAnchor="middle" fill="#475569" fontSize="9" fontFamily="Inter">LA / Long Beach</text>

        {/* Port to US */}
        <line x1={cx + 28} y1={cy} x2={usX - 22} y2={usY} stroke="rgba(16,185,129,0.5)" strokeWidth="2" strokeDasharray="6 3" className="flow-line" markerEnd="url(#arrow)" />

        {/* US node */}
        <circle cx={usX} cy={usY} r={22} fill="rgba(16,185,129,0.1)" stroke="rgba(16,185,129,0.5)" strokeWidth="1.5" />
        <text x={usX} y={usY - 3} textAnchor="middle" fill="#10b981" fontSize="10" fontFamily="JetBrains Mono" fontWeight="700">🏭</text>
        <text x={usX} y={usY + 12} textAnchor="middle" fill="#475569" fontSize="9" fontFamily="Inter">US DC</text>
      </svg>

      {lanes.length > 0 && (
        <div className="sc-lanes">
          {lanes.map((l, i) => <span key={i} className="sc-lane-tag">{l}</span>)}
        </div>
      )}
    </div>
  );
}

function ObjectionDrawer({ prospect, analysis }) {
  const [open, setOpen] = useState(false);
  const [objection, setObjection] = useState('');
  const [response, setResponse] = useState(null);
  const [loading, setLoading] = useState(false);

  const QUICK = ['We already have a forwarder', "We're happy with our current rates", 'We don\'t need real-time visibility', 'The timing isn\'t right'];

  const handle = async (text) => {
    setLoading(true); setResponse(null);
    try {
      const r = await fetch(`${API}/api/objection`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ objection: text, companyName: prospect?.name, context: analysis })
      });
      setResponse(await r.json());
    } catch { }
    finally { setLoading(false); }
  };

  return (
    <>
      <button className="objection-toggle" onClick={() => setOpen(o => !o)}>
        {open ? '✕ Close' : '🥊 Objection Handler'}
      </button>
      {open && (
        <div className="objection-drawer glass-card">
          <h4 className="obj-title">Objection Handler</h4>
          <div className="obj-quick">
            {QUICK.map(q => (
              <button key={q} className="obj-quick-btn" onClick={() => { setObjection(q); handle(q); }}>{q}</button>
            ))}
          </div>
          <div className="obj-input-row">
            <input
              className="obj-input" placeholder="Or type a custom objection..."
              value={objection} onChange={e => setObjection(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && objection && handle(objection)}
            />
            <button className="obj-send" onClick={() => objection && handle(objection)} disabled={loading}>
              {loading ? '...' : '→'}
            </button>
          </div>
          {response && (
            <div className="obj-response">
              <p className="obj-counter">{response.response}</p>
              {response.follow_up_question && (
                <p className="obj-followup">💡 "{response.follow_up_question}"</p>
              )}
            </div>
          )}
        </div>
      )}
    </>
  );
}

export default function Account360Page({ onAddToPipeline, onOpenOutreach }) {
  const { id } = useParams();
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [analysis, setAnalysis] = useState(null);
  const [analysisLoading, setAnalysisLoading] = useState(false);
  const [loading, setLoading] = useState(true);
  const [callPrep, setCallPrep] = useState(null);
  const [callPrepLoading, setCallPrepLoading] = useState(false);
  const [showCallPrep, setShowCallPrep] = useState(false);
  const [pipelined, setPipelined] = useState(false);

  useEffect(() => {
    setLoading(true); setAnalysis(null); setData(null);
    fetch(`${API}/api/account360/${id}`)
      .then(r => r.json())
      .then(d => { setData(d); setLoading(false); })
      .catch(() => setLoading(false));
  }, [id]);

  const runAnalysis = async () => {
    if (!data?.prospect) return;
    setAnalysisLoading(true);
    try {
      const r = await fetch(`${API}/api/analyze`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ companyName: data.prospect.name, prospectId: data.prospect.id })
      });
      setAnalysis(await r.json());
    } catch { }
    finally { setAnalysisLoading(false); }
  };

  const generateCallPrep = async () => {
    if (!data?.prospect) return;
    setCallPrepLoading(true);
    try {
      const r = await fetch(`${API}/api/call-prep`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ companyName: data.prospect.name, prospectData: data.prospect, analysisData: analysis })
      });
      setCallPrep(await r.json());
      setShowCallPrep(true);
    } catch { }
    finally { setCallPrepLoading(false); }
  };

  const addToPipeline = async () => {
    if (!data?.prospect) return;
    await fetch(`${API}/api/pipeline`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prospect_id: data.prospect.id, company_name: data.prospect.name, stage: 'researched' })
    });
    setPipelined(true);
    onAddToPipeline?.();
  };

  const p = data?.prospect;

  if (loading) return (
    <div className="page-wrap a360-loading">
      <div className="a360-spinner" />
      <p>Loading account intelligence...</p>
    </div>
  );
  if (!p) return (
    <div className="page-wrap"><p className="a360-err">Prospect not found. <button onClick={() => navigate('/')}>← Back</button></p></div>
  );

  const urgencyColor = s => s >= 8 ? '#ef4444' : s >= 5 ? '#f59e0b' : '#10b981';

  return (
    <div className="a360-page page-wrap">
      {/* Header */}
      <div className="a360-header glass-card">
        <button className="a360-back" onClick={() => navigate(-1)}>← Back</button>
        <div className="a360-header-main">
          <div>
            <h1 className="a360-company">{p.name}</h1>
            <p className="a360-meta">{p.sector} · {p.hq_location} · {p.estimated_revenue}</p>
            <div className="a360-chips">
              <span className="a360-chip">Forwarder: {p.likely_forwarder || 'Unknown'}</span>
              <span className="a360-chip">Volume: {p.shipping_volume_estimate}</span>
              <span className="a360-chip">{p.employee_count}</span>
            </div>
          </div>
          <ICPBadge score={p.icp_score} />
        </div>

        {/* Supply chain diagram */}
        <SupplyChainDiagram origins={p.import_origins || []} lanes={p.primary_lanes || []} />
      </div>

      {/* 3-column body */}
      <div className="a360-body">
        {/* Left: AI analysis */}
        <div className="a360-col glass-card">
          <div className="a360-col-header">AI Intelligence</div>
          {!analysis && (
            <button className="btn-primary" onClick={runAnalysis} disabled={analysisLoading}>
              {analysisLoading ? 'Analyzing...' : '⚡ Run Full Analysis'}
            </button>
          )}
          {analysis && (
            <div className="a360-analysis">
              <section className="a360-section">
                <h4>Profile</h4>
                <p><StreamText text={analysis.profile} /></p>
              </section>
              <section className="a360-section">
                <h4>Pain Points</h4>
                <ul>{analysis.pain_points?.map((pt, i) => <li key={i}>{pt}</li>)}</ul>
              </section>
              <section className="a360-section">
                <h4>Outreach Angle</h4>
                <p className="a360-outreach">{analysis.outreach_angle}</p>
              </section>
              <section className="a360-section">
                <h4>Flexport Value Props</h4>
                <div className="vp-chips">
                  {analysis.flexport_value_props?.map((vp, i) => <span key={i} className="vp-chip">{vp}</span>)}
                </div>
              </section>
            </div>
          )}
        </div>

        {/* Center: Signal timeline */}
        <div className="a360-col glass-card">
          <div className="a360-col-header">Signal Timeline</div>
          {data?.news?.length > 0 ? (
            <div className="signal-timeline">
              {data.news.map((n, i) => (
                <div key={i} className="timeline-item" style={{ animationDelay: `${i * 0.06}s` }}>
                  <div className="timeline-dot" />
                  <div className="timeline-content">
                    <div className="timeline-date">{n.publishedAt ? new Date(n.publishedAt).toLocaleDateString() : 'Recent'}</div>
                    <a href={n.url} target="_blank" rel="noreferrer" className="timeline-headline">{n.title}</a>
                    {n.description && <p className="timeline-desc">{n.description?.slice(0, 120)}{n.description?.length > 120 ? '…' : ''}</p>}
                    {onOpenOutreach && (
                      <button className="timeline-outreach" onClick={() => onOpenOutreach(p, analysis)}>→ Outreach</button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="a360-empty">No recent signals found for this company.</p>
          )}
        </div>

        {/* Right: Decision makers + objection handler */}
        <div className="a360-col glass-card">
          <div className="a360-col-header">Decision Makers</div>
          {analysis?.decision_makers?.map((dm, i) => (
            <div key={i} className="dm-card">
              <div className="dm-title">{dm.title}</div>
              <ul className="dm-concerns">
                {dm.concerns?.map((c, j) => <li key={j}>{c}</li>)}
              </ul>
            </div>
          )) || (
            <p className="a360-empty">Run AI analysis to surface decision makers.</p>
          )}

          {/* Call prep */}
          <div className="a360-col-header" style={{ marginTop: 16 }}>Call Prep</div>
          <button className="btn-secondary" onClick={generateCallPrep} disabled={callPrepLoading}>
            {callPrepLoading ? 'Generating...' : '📋 Generate Call Prep Sheet'}
          </button>

          <ObjectionDrawer prospect={p} analysis={analysis} />
        </div>
      </div>

      {/* Call Prep Modal */}
      {showCallPrep && callPrep && (
        <div className="cp-overlay" onClick={() => setShowCallPrep(false)}>
          <div className="cp-modal glass-card" onClick={e => e.stopPropagation()}>
            <div className="cp-header">
              <h3>Call Prep — {p.name}</h3>
              <button onClick={() => setShowCallPrep(false)}>✕</button>
            </div>
            <div className="cp-body">
              {callPrep.opening_hook && (
                <section className="cp-section">
                  <h4>Opening Hook</h4>
                  <p className="cp-hook">"{callPrep.opening_hook}"</p>
                </section>
              )}
              {callPrep.discovery_questions && (
                <section className="cp-section">
                  <h4>Discovery Questions</h4>
                  <ol>{callPrep.discovery_questions.map((q, i) => <li key={i}>{q}</li>)}</ol>
                </section>
              )}
              {callPrep.pain_points_to_surface && (
                <section className="cp-section">
                  <h4>Pain Points to Surface</h4>
                  <ul>{callPrep.pain_points_to_surface.map((p, i) => <li key={i}>{p}</li>)}</ul>
                </section>
              )}
              {callPrep.flexport_value_props && (
                <section className="cp-section">
                  <h4>Flexport Value Props</h4>
                  <div className="vp-chips">{callPrep.flexport_value_props.map((v, i) => <span key={i} className="vp-chip">{v}</span>)}</div>
                </section>
              )}
              {callPrep.objection_responses && (
                <section className="cp-section">
                  <h4>Objection Responses</h4>
                  {callPrep.objection_responses.map((obj, i) => (
                    <div key={i} className="cp-objection">
                      <div className="cp-obj-q">"{obj.objection}"</div>
                      <div className="cp-obj-a">{obj.response}</div>
                    </div>
                  ))}
                </section>
              )}
              {callPrep.call_to_action && (
                <section className="cp-section">
                  <h4>Call to Action</h4>
                  <p className="a360-outreach">{callPrep.call_to_action}</p>
                </section>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Footer action bar */}
      <div className="a360-footer glass-card">
        {onOpenOutreach && (
          <button className="btn-primary" onClick={() => onOpenOutreach(p, analysis)}>✉ Outreach Sequence</button>
        )}
        <button className="btn-secondary" onClick={generateCallPrep} disabled={callPrepLoading}>
          {callPrepLoading ? '...' : '📋 Call Prep'}
        </button>
        <button className="btn-secondary" onClick={addToPipeline} disabled={pipelined}>
          {pipelined ? '✓ In Pipeline' : '+ Pipeline'}
        </button>
        {!analysis && (
          <button className="btn-secondary" onClick={runAnalysis} disabled={analysisLoading}>
            {analysisLoading ? 'Analyzing...' : '⚡ Run Analysis'}
          </button>
        )}
      </div>
    </div>
  );
}
