// frontend/src/components/AnalysisPanel.jsx
import { useState } from 'react';
import ICPBadge from './ICPBadge';
import './AnalysisPanel.css';

const API = import.meta.env.VITE_API_URL || 'http://localhost:5000';

export default function AnalysisPanel({ prospect, onOpenOutreach }) {
  const [analysis, setAnalysis] = useState(null);
  const [loading, setLoading] = useState(false);
  const [saved, setSaved] = useState(false);

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
  };

  if (!prospect) return (
    <div className="analysis-empty">
      <p>Select a prospect to view intelligence</p>
    </div>
  );

  return (
    <div className="analysis-panel">
      <div className="analysis-header">
        <div>
          <h2 className="analysis-company-name">{prospect.name}</h2>
          <p className="analysis-meta">{prospect.sector} · {prospect.hq_location} · {prospect.estimated_revenue}</p>
        </div>
        <ICPBadge score={prospect.icp_score} />
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
          <button className="btn-secondary" onClick={addToPipeline}>+ Pipeline</button>
          <button className="btn-secondary" onClick={() => onOpenOutreach?.(prospect, analysis)}>✉ Outreach Sequence</button>
        </>}
      </div>

      {analysis && (
        <div className="analysis-results">
          <section className="analysis-section">
            <h3>Company Profile</h3>
            <p>{analysis.profile}</p>
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
