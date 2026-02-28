// frontend/src/components/AnalysisPanel.jsx
import { useState, useEffect } from 'react';
import ICPBadge from './ICPBadge';
import './AnalysisPanel.css';

const API = import.meta.env.VITE_API_URL || 'http://localhost:5000';

function ICPGauge({ score }) {
  const r = 30;
  const circ = 2 * Math.PI * r;
  const filled = Math.min((score / 100), 1) * circ;
  const color = score >= 75 ? '#10b981' : score >= 50 ? '#f59e0b' : '#ef4444';
  return (
    <svg viewBox="0 0 70 70" width="70" height="70" className="icp-gauge">
      <circle cx="35" cy="35" r={r} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="5" />
      <circle
        cx="35" cy="35" r={r} fill="none" stroke={color} strokeWidth="5"
        strokeDasharray={`${filled} ${circ - filled}`}
        strokeDashoffset={circ * 0.25}
        strokeLinecap="round"
        className="gauge-arc"
      />
      <text x="35" y="39" textAnchor="middle" fill={color} fontSize="13" fontFamily="JetBrains Mono" fontWeight="700">{score}</text>
    </svg>
  );
}

function StreamText({ text }) {
  const [displayed, setDisplayed] = useState('');
  useEffect(() => {
    if (!text) { setDisplayed(''); return; }
    setDisplayed('');
    let i = 0;
    const id = setInterval(() => {
      i += 4;
      setDisplayed(text.slice(0, i));
      if (i >= text.length) clearInterval(id);
    }, 18);
    return () => clearInterval(id);
  }, [text]);
  return <span>{displayed}</span>;
}

export default function AnalysisPanel({ prospect, onOpenOutreach, onAddToPipeline, onViewProfile }) {
  const [analysis, setAnalysis] = useState(null);
  const [loading, setLoading] = useState(false);
  const [saved, setSaved] = useState(false);
  const [pipelined, setPipelined] = useState(false);
  const [firstLine, setFirstLine] = useState('');
  const [firstLineLoading, setFirstLineLoading] = useState(false);

  const runAnalysis = async () => {
    setLoading(true);
    setSaved(false);
    try {
      const r = await fetch(`${API}/api/analyze`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ companyName: prospect.name, prospectId: prospect.id })
      });
      setAnalysis(await r.json());
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  };

  const saveAnalysis = async () => {
    if (!analysis) return;
    await fetch(`${API}/api/analyses`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prospectId: prospect.id, companyName: prospect.name, analysisData: analysis })
    });
    setSaved(true);
  };

  const addToPipeline = async () => {
    await fetch(`${API}/api/pipeline`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prospect_id: prospect.id, company_name: prospect.name, stage: 'researched' })
    });
    setPipelined(true);
    onAddToPipeline?.();
  };

  const generateFirstLine = async () => {
    setFirstLineLoading(true);
    try {
      const r = await fetch(`${API}/api/first-line`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ companyName: prospect.name, prospectData: prospect })
      });
      const d = await r.json();
      setFirstLine(d.first_line || '');
    } catch (e) { console.error(e); }
    finally { setFirstLineLoading(false); }
  };

  if (!prospect) return (
    <div className="analysis-empty"><p>Select a prospect to view intelligence</p></div>
  );

  return (
    <div className="analysis-panel">
      <div className="analysis-header">
        <div>
          <h2 className="analysis-company-name">{prospect.name}</h2>
          <p className="analysis-meta">{prospect.sector} · {prospect.hq_location} · {prospect.estimated_revenue}</p>
        </div>
        <div className="analysis-header-right">
          <ICPGauge score={prospect.icp_score || 0} />
          <ICPBadge score={prospect.icp_score} />
        </div>
      </div>

      <div className="analysis-meta-row">
        <div className="meta-chip">
          <span className="meta-label">Import Origins</span>
          <span className="meta-value">{prospect.import_origins?.join(', ')}</span>
        </div>
        <div className="meta-chip">
          <span className="meta-label">Primary Lanes</span>
          <span className="meta-value">{prospect.primary_lanes?.join(', ')}</span>
        </div>
        <div className="meta-chip">
          <span className="meta-label">Current Forwarder</span>
          <span className="meta-value">{prospect.likely_forwarder}</span>
        </div>
        <div className="meta-chip">
          <span className="meta-label">Volume</span>
          <span className="meta-value">{prospect.shipping_volume_estimate}</span>
        </div>
      </div>

      <div className="analysis-actions">
        <button className="btn-primary" onClick={runAnalysis} disabled={loading}>
          {loading ? 'Analyzing...' : '⚡ Run AI Analysis'}
        </button>
        {analysis && <>
          <button className="btn-secondary" onClick={saveAnalysis} disabled={saved}>{saved ? '✓ Saved' : 'Save'}</button>
          <button className="btn-secondary" onClick={addToPipeline} disabled={pipelined}>{pipelined ? '✓ Pipeline' : '+ Pipeline'}</button>
          <button className="btn-secondary" onClick={() => onOpenOutreach?.(prospect, analysis)}>✉ Outreach</button>
        </>}
        {onViewProfile && (
          <button className="btn-ghost" onClick={onViewProfile}>Account 360 →</button>
        )}
      </div>

      {/* First-line generator */}
      <div className="first-line-section">
        <button className="btn-ghost small" onClick={generateFirstLine} disabled={firstLineLoading}>
          {firstLineLoading ? 'Generating...' : '✨ Generate Cold Email First Line'}
        </button>
        {firstLine && <p className="first-line-result">"{firstLine}"</p>}
      </div>

      {analysis && (
        <div className="analysis-results">
          <section className="analysis-section">
            <h3>Company Profile</h3>
            <p><StreamText text={analysis.profile} /></p>
          </section>
          <section className="analysis-section">
            <h3>Supply Chain Pain Points</h3>
            <ul>{analysis.pain_points?.map((p, i) => <li key={i}>{p}</li>)}</ul>
          </section>
          <section className="analysis-section">
            <h3>Outreach Angle</h3>
            <p className="outreach-angle">{analysis.outreach_angle}</p>
          </section>
          <section className="analysis-section">
            <h3>ICP Breakdown</h3>
            <p>{analysis.icp_breakdown?.reasoning}</p>
            <ul>{analysis.icp_breakdown?.key_signals?.map((s, i) => <li key={i}>{s}</li>)}</ul>
          </section>
          <section className="analysis-section">
            <h3>Decision Makers</h3>
            {analysis.decision_makers?.map((dm, i) => (
              <div key={i} className="decision-maker">
                <strong>{dm.title}</strong>
                <ul>{dm.concerns?.map((c, j) => <li key={j}>{c}</li>)}</ul>
              </div>
            ))}
          </section>
          <section className="analysis-section">
            <h3>Relevant Flexport Features</h3>
            <ul>{analysis.flexport_value_props?.map((p, i) => <li key={i}>{p}</li>)}</ul>
          </section>
        </div>
      )}
    </div>
  );
}
