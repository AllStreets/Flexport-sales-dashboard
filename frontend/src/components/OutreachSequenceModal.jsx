// frontend/src/components/OutreachSequenceModal.jsx
import { useState } from 'react';
import { RiMailLine, RiLinkedinBoxLine, RiPhoneLine, RiPushpin2Line, RiFlashlightLine } from 'react-icons/ri';
import './OutreachSequenceModal.css';

const API = import.meta.env.VITE_API_URL || 'http://localhost:5000';

export default function OutreachSequenceModal({ prospect, analysis, isOpen, onClose }) {
  const [touches, setTouches] = useState([]);
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(null);

  const generate = async () => {
    setLoading(true);
    setTouches([]);
    const aiModel = localStorage.getItem('sdr_ai_model') || 'gpt-4.1-mini';
    const sdrIdentity = {
      name:  localStorage.getItem('sdr_profile_name')  || '',
      email: localStorage.getItem('sdr_profile_email') || '',
      phone: localStorage.getItem('sdr_profile_phone') || '',
      title: localStorage.getItem('sdr_profile_title') || 'SDR',
      team:  localStorage.getItem('sdr_profile_team')  || '',
    };
    try {
      const r = await fetch(`${API}/api/generate-sequence`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ companyName: prospect.name, prospectData: prospect, analysisData: analysis, model: aiModel, sdrIdentity })
      });
      const data = await r.json();
      setTouches(data.touches || []);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  };

  const copyTouch = (text, i) => {
    navigator.clipboard.writeText(text);
    setCopied(i);
    setTimeout(() => setCopied(null), 1500);
  };

  const exportAll = () => {
    const text = touches.map((t, i) =>
      `=== Touch ${i + 1}: ${t.type?.toUpperCase()} (Day ${t.day}) ===\n${t.subject ? `Subject: ${t.subject}\n\n` : ''}${t.body}`
    ).join('\n\n---\n\n');
    const blob = new Blob([text], { type: 'text/plain' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `${prospect.name}-outreach-sequence.txt`;
    a.click();
  };

  if (!isOpen) return null;

  const TOUCH_ICON_MAP = { email: RiMailLine, linkedin: RiLinkedinBoxLine, call: RiPhoneLine };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-panel outreach-panel" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h2>Outreach Sequence — {prospect.name}</h2>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>

        <div className="outreach-actions">
          <button className="btn-primary" onClick={generate} disabled={loading}>
            {loading ? 'Generating...' : <><RiFlashlightLine size={13} style={{ verticalAlign: 'middle', marginRight: 5 }} />Generate 4-Touch Sequence</>}
          </button>
          {touches.length > 0 && <button className="btn-secondary" onClick={exportAll}>↓ Export .txt</button>}
        </div>

        {touches.length > 0 && (
          <div className="touches-list">
            {touches.map((t, i) => (
              <div key={i} className="touch-card">
                <div className="touch-header">
                  <span className="touch-icon">{(() => { const Icon = TOUCH_ICON_MAP[t.type] || RiPushpin2Line; return <Icon size={14} />; })()}</span>
                  <span className="touch-type">{t.type?.toUpperCase()}</span>
                  <span className="touch-day">Day {t.day}</span>
                  <button className="copy-btn" onClick={() => copyTouch(`${t.subject ? `Subject: ${t.subject}\n\n` : ''}${t.body}`, i)}>
                    {copied === i ? '✓ Copied' : 'Copy'}
                  </button>
                </div>
                {t.subject && <div className="touch-subject">Subject: {t.subject}</div>}
                <div className="touch-body">{t.body}</div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
