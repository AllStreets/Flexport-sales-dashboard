// frontend/src/pages/Account360Page.jsx
import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { RiFileTextLine, RiMailSendLine, RiBoxingLine, RiLightbulbLine, RiFlashlightLine, RiRoadMapLine, RiCloseCircleLine } from 'react-icons/ri';
import ICPBadge from '../components/ICPBadge';
import './Account360Page.css';

const API = import.meta.env.VITE_API_URL || 'http://localhost:5000';

const COUNTRY_FLAGS = {
  // Asia-Pacific
  'China': '🇨🇳', 'Vietnam': '🇻🇳', 'India': '🇮🇳', 'Bangladesh': '🇧🇩',
  'Malaysia': '🇲🇾', 'South Korea': '🇰🇷', 'Philippines': '🇵🇭', 'Cambodia': '🇰🇭',
  'Singapore': '🇸🇬', 'Japan': '🇯🇵', 'Taiwan': '🇹🇼', 'Thailand': '🇹🇭',
  'Indonesia': '🇮🇩', 'Sri Lanka': '🇱🇰', 'New Zealand': '🇳🇿',
  // Europe
  'Italy': '🇮🇹', 'Portugal': '🇵🇹', 'Spain': '🇪🇸', 'Netherlands': '🇳🇱',
  'Sweden': '🇸🇪', 'Turkey': '🇹🇷', 'France': '🇫🇷', 'Germany': '🇩🇪',
  'Finland': '🇫🇮', 'Belgium': '🇧🇪', 'Austria': '🇦🇹', 'Switzerland': '🇨🇭',
  // Americas
  'Mexico': '🇲🇽', 'Peru': '🇵🇪', 'Argentina': '🇦🇷', 'Brazil': '🇧🇷',
  'Colombia': '🇨🇴', 'Chile': '🇨🇱', 'USA': '🇺🇸',
  // Africa / Middle East
  'Morocco': '🇲🇦',
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
          const flag = COUNTRY_FLAGS[country] || '??';
          return (
            <g key={country} className="sc-node" style={{ animationDelay: `${i * 0.08}s` }}>
              <circle cx={52} cy={y} r={22} fill="rgba(37,99,235,0.12)" stroke="rgba(37,99,235,0.4)" strokeWidth="1.5" />
              <text x={52} y={y + 2} textAnchor="middle" fontSize="18" dominantBaseline="middle">{flag}</text>
              <text x={52} y={y + 28} textAnchor="middle" fill="#64748b" fontSize="9" fontFamily="Inter">{country}</text>
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
        <text x={usX} y={usY + 4} textAnchor="middle" fill="#10b981" fontSize="9" fontFamily="JetBrains Mono" fontWeight="700">WH</text>
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

  useEffect(() => {
    setResponse(null);
    setObjection('');
  }, [prospect?.id]);

  const QUICK = ['We already have a forwarder', "We're happy with our current rates", 'We don\'t need real-time visibility', 'The timing isn\'t right'];

  const handle = async (text) => {
    setLoading(true); setResponse(null);
    try {
      const aiModel = localStorage.getItem('sdr_ai_model') || 'gpt-4.1-mini';
      const r = await fetch(`${API}/api/objection`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ objection: text, companyName: prospect?.name, context: analysis, model: aiModel })
      });
      setResponse(await r.json());
    } catch { }
    finally { setLoading(false); }
  };

  return (
    <>
      <button className="objection-toggle" onClick={() => setOpen(o => !o)}>
        {open ? '✕ Close' : <><RiBoxingLine size={13} style={{ verticalAlign: 'middle', marginRight: 5 }} />Objection Handler</>}
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
                <p className="obj-followup"><RiLightbulbLine size={12} style={{ verticalAlign: 'middle', marginRight: 4 }} />"{response.follow_up_question}"</p>
              )}
            </div>
          )}
        </div>
      )}
    </>
  );
}

function MutualActionPlanModal({ prospect, onClose }) {
  const [plan, setPlan] = useState(null);
  const [loading, setLoading] = useState(false);

  const OWNER_COLORS = { SDR: '#00d4ff', Prospect: '#8b5cf6', Both: '#10b981', Flexport: '#f59e0b' };

  const generate = async () => {
    setLoading(true);
    try {
      const aiModel = localStorage.getItem('sdr_ai_model') || 'gpt-4.1-mini';
      const r = await fetch(`${API}/api/map-plan`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ companyName: prospect.name, prospectData: prospect, model: aiModel }),
      });
      setPlan(await r.json());
    } catch { }
    finally { setLoading(false); }
  };

  return (
    <div className="cp-overlay" onClick={onClose}>
      <div className="cp-modal glass-card map-modal" onClick={e => e.stopPropagation()}>
        <div className="cp-header">
          <h3><RiRoadMapLine size={16} style={{ verticalAlign: 'middle', marginRight: 8 }} />Mutual Action Plan — {prospect.name}</h3>
          <button onClick={onClose}><RiCloseCircleLine size={18} /></button>
        </div>

        {!plan && (
          <button className="btn-primary" onClick={generate} disabled={loading} style={{ margin: '16px 0' }}>
            {loading
              ? 'Generating…'
              : <><RiFlashlightLine size={13} style={{ verticalAlign: 'middle', marginRight: 5 }} />Generate MAP</>}
          </button>
        )}

        {plan && (
          <div className="map-body">
            <div className="map-timeline">
              {(plan.milestones || []).map((m, i) => {
                const color = OWNER_COLORS[m.owner] || '#94a3b8';
                return (
                  <div key={i} className="map-milestone">
                    <div className="map-day-col">
                      <div className="map-day-pill">Day {m.day}</div>
                      {i < (plan.milestones.length - 1) && <div className="map-connector" />}
                    </div>
                    <div className="map-content">
                      <span className="map-owner-badge" style={{ background: `${color}18`, color, borderColor: `${color}40` }}>
                        {m.owner}
                      </span>
                      <p className="map-action">{m.action}</p>
                    </div>
                  </div>
                );
              })}
            </div>
            {plan.success_criteria && (
              <div className="map-success">
                <div className="map-success-label">90-Day Success Criteria</div>
                <p className="map-success-text">{plan.success_criteria}</p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export default function Account360Page({ onAddToPipeline, onOpenOutreach }) {
  const { id } = useParams();
  const navigate = useNavigate();
  const aiEnabled = localStorage.getItem('sdr_ai_enabled') !== 'false';
  const aiModel = localStorage.getItem('sdr_ai_model') || 'gpt-4.1-mini';
  const [data, setData] = useState(null);
  const [analysis, setAnalysis] = useState(null);
  const [analysisLoading, setAnalysisLoading] = useState(false);
  const [loading, setLoading] = useState(true);
  const [callPrep, setCallPrep] = useState(null);
  const [callPrepLoading, setCallPrepLoading] = useState(false);
  const [showCallPrep, setShowCallPrep] = useState(false);
  const [pipelined, setPipelined] = useState(false);
  const [showMapPlan, setShowMapPlan] = useState(false);
  const [callNotes, setCallNotes] = useState('');
  const [callIntel, setCallIntel] = useState(null);
  const [callIntelLoading, setCallIntelLoading] = useState(false);
  const [callIntelOpen, setCallIntelOpen] = useState(false);

  useEffect(() => {
    setLoading(true); setAnalysis(null); setData(null);
    setPipelined(false);
    setCallNotes('');
    setCallIntel(null);
    setCallIntelOpen(false);
    setCallPrep(null);
    setShowCallPrep(false);
    setShowMapPlan(false);
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
        body: JSON.stringify({ companyName: data.prospect.name, prospectId: data.prospect.id, model: aiModel })
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
        body: JSON.stringify({ companyName: data.prospect.name, prospectData: data.prospect, analysisData: analysis, model: aiModel })
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

  const analyzeCall = async () => {
    if (!callNotes.trim()) return;
    setCallIntelLoading(true); setCallIntel(null);
    try {
      const r = await fetch(`${API}/api/call-intelligence`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ notes: callNotes, companyName: data?.prospect?.name, model: aiModel }),
      });
      setCallIntel(await r.json());
    } catch { }
    finally { setCallIntelLoading(false); }
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
          {!analysis && aiEnabled && (
            <button className="btn-primary" onClick={runAnalysis} disabled={analysisLoading}>
              {analysisLoading ? 'Analyzing...' : <><RiFlashlightLine size={13} style={{ verticalAlign: 'middle', marginRight: 5 }} />Run Full Analysis</>}
            </button>
          )}
          {!analysis && !aiEnabled && (
            <p className="a360-empty">AI features disabled in Settings.</p>
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
          {aiEnabled && (
            <button className="btn-secondary" onClick={generateCallPrep} disabled={callPrepLoading}>
              {callPrepLoading ? 'Generating...' : <><RiFileTextLine size={13} style={{ verticalAlign: 'middle', marginRight: 5 }} />Generate Call Prep Sheet</>}
            </button>
          )}

          <ObjectionDrawer prospect={p} analysis={analysis} />
        </div>
      </div>

      {/* Call Intelligence Parser */}
      <div className="glass-card ci-panel">
        <button className="ci-toggle" onClick={() => setCallIntelOpen(o => !o)}>
          <RiFileTextLine size={13} style={{ verticalAlign: 'middle', marginRight: 6 }} />
          Call Intelligence Parser
          <span className="ci-toggle-hint">{callIntelOpen ? '▲ collapse' : '▼ expand'}</span>
        </button>
        {callIntelOpen && (
          <div className="ci-body">
            <p className="ci-desc">Paste raw call notes below. AI extracts pain points, objections, signals, and next steps.</p>
            <textarea
              className="ci-textarea"
              placeholder="Paste call notes here..."
              value={callNotes}
              onChange={e => setCallNotes(e.target.value)}
              rows={5}
            />
            {aiEnabled ? (
              <button className="btn-primary ci-btn" onClick={analyzeCall} disabled={callIntelLoading || !callNotes.trim()}>
                {callIntelLoading ? 'Analyzing...' : <><RiFlashlightLine size={12} style={{ verticalAlign: 'middle', marginRight: 5 }} />Analyze Call</>}
              </button>
            ) : (
              <p className="a360-empty" style={{ marginTop: 8 }}>AI features disabled in Settings.</p>
            )}
            {callIntel && !callIntel.error && (
              <div className="ci-results">
                <div className="ci-submitted-notes">
                  <div className="ci-result-label">Submitted Notes</div>
                  <p className="ci-notes-text">{callNotes}</p>
                </div>
                <div className="ci-result-grid">
                  {callIntel.pain_points?.length > 0 && (
                    <div className="ci-result-block">
                      <div className="ci-result-label">Pain Points</div>
                      <ul>{callIntel.pain_points.map((p, i) => <li key={i}>{p}</li>)}</ul>
                    </div>
                  )}
                  {callIntel.signals?.length > 0 && (
                    <div className="ci-result-block">
                      <div className="ci-result-label">Buying Signals</div>
                      <ul>{callIntel.signals.map((s, i) => <li key={i}>{s}</li>)}</ul>
                    </div>
                  )}
                  {callIntel.objections?.length > 0 && (
                    <div className="ci-result-block">
                      <div className="ci-result-label">Objections</div>
                      <ul>{callIntel.objections.map((o, i) => <li key={i}>{o}</li>)}</ul>
                    </div>
                  )}
                  {callIntel.next_steps?.length > 0 && (
                    <div className="ci-result-block">
                      <div className="ci-result-label">Next Steps</div>
                      <ul>{callIntel.next_steps.map((s, i) => <li key={i}>{s}</li>)}</ul>
                    </div>
                  )}
                </div>
                <div className="ci-meta-row">
                  {callIntel.sentiment && (
                    <span className="ci-meta-chip" style={{ color: callIntel.sentiment === 'positive' ? '#10b981' : callIntel.sentiment === 'negative' ? '#ef4444' : '#f59e0b' }}>
                      Sentiment: {callIntel.sentiment}
                    </span>
                  )}
                  {callIntel.deal_probability !== undefined && (
                    <span className="ci-meta-chip" style={{ color: callIntel.deal_probability >= 60 ? '#10b981' : callIntel.deal_probability >= 30 ? '#f59e0b' : '#ef4444' }}>
                      Deal probability: {callIntel.deal_probability}%
                    </span>
                  )}
                  {callIntel.recommended_follow_up && (
                    <span className="ci-followup">{callIntel.recommended_follow_up}</span>
                  )}
                </div>
              </div>
            )}
          </div>
        )}
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
          <button className="btn-primary" onClick={() => onOpenOutreach(p, analysis)}><RiMailSendLine size={13} style={{ verticalAlign: 'middle', marginRight: 5 }} />Outreach Sequence</button>
        )}
        <button className="btn-secondary" onClick={generateCallPrep} disabled={callPrepLoading}>
          {callPrepLoading ? '...' : <><RiFileTextLine size={13} style={{ verticalAlign: 'middle', marginRight: 4 }} />Call Prep</>}
        </button>
        <button className="btn-secondary" onClick={() => setShowMapPlan(true)}>
          <RiRoadMapLine size={13} style={{ verticalAlign: 'middle', marginRight: 4 }} />Mutual Action Plan
        </button>
        <button className="btn-secondary" onClick={addToPipeline} disabled={pipelined}>
          {pipelined ? '✓ In Pipeline' : '+ Pipeline'}
        </button>
        {!analysis && (
          <button className="btn-secondary" onClick={runAnalysis} disabled={analysisLoading}>
            {analysisLoading ? 'Analyzing...' : <><RiFlashlightLine size={13} style={{ verticalAlign: 'middle', marginRight: 5 }} />Run Analysis</>}
          </button>
        )}
      </div>

      {showMapPlan && <MutualActionPlanModal prospect={p} onClose={() => setShowMapPlan(false)} />}
    </div>
  );
}
