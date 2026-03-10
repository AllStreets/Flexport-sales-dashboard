import { useState, useEffect, useRef } from 'react';
import { RiMailSendLine, RiLinkedinLine, RiRefreshLine, RiFileCopyLine, RiCloseLine } from 'react-icons/ri';
import './EmailComposerModal.css';

const API = import.meta.env.VITE_API_URL || 'http://localhost:5001';
const TONES = ['direct', 'consultative', 'challenger'];

export default function EmailComposerModal({ isOpen, onClose, initialProspect = null, initialTrigger = '' }) {
  const [prospects, setProspects] = useState([]);
  const [selectedId, setSelectedId] = useState('');
  const [trigger, setTrigger] = useState(initialTrigger);
  const [tone, setTone] = useState('consultative');
  const [output, setOutput] = useState('');
  const [loading, setLoading] = useState(false);
  const [tab, setTab] = useState('email');
  const [copied, setCopied] = useState('');
  const outputRef = useRef('');

  useEffect(() => {
    if (isOpen) fetch(`${API}/api/prospects?limit=136`).then(r => r.json()).then(d => setProspects(d.prospects || []));
  }, [isOpen]);

  useEffect(() => {
    if (initialProspect) setSelectedId(String(initialProspect.id || ''));
    if (initialTrigger) setTrigger(initialTrigger);
  }, [initialProspect, initialTrigger]);

  if (!isOpen) return null;

  const prospect = prospects.find(p => String(p.id) === selectedId) || initialProspect;

  const generate = async () => {
    if (!prospect) return;
    setOutput('');
    outputRef.current = '';
    setLoading(true);
    try {
      const res = await fetch(`${API}/api/compose-email`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prospect, trigger, tone }),
      });
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const lines = decoder.decode(value).split('\n');
        for (const line of lines) {
          if (line.startsWith('data: ') && !line.includes('[DONE]')) {
            try {
              const { text } = JSON.parse(line.slice(6));
              outputRef.current += text;
              setOutput(outputRef.current);
            } catch {}
          }
        }
      }
    } finally {
      setLoading(false);
    }
  };

  const extract = (key) => {
    const sections = { email: '## EMAIL', linkedin: '## LINKEDIN' };
    const start = output.indexOf(sections[key]);
    if (start === -1) return '';
    const after = output.slice(start + sections[key].length).trim();
    const next = after.search(/^##\s/m);
    return next === -1 ? after.trim() : after.slice(0, next).trim();
  };

  const subjects = [1, 2, 3].map(n => {
    const start = output.indexOf(`## SUBJECT_${n}`);
    if (start === -1) return '';
    const after = output.slice(start + `## SUBJECT_${n}`.length).trim();
    const next = after.search(/^##\s/m);
    return (next === -1 ? after : after.slice(0, next)).trim();
  }).filter(Boolean);

  const copyText = (text, key) => {
    navigator.clipboard.writeText(text);
    setCopied(key);
    setTimeout(() => setCopied(''), 1500);
  };

  return (
    <div className="ec-overlay" onClick={onClose}>
      <div className="ec-modal" onClick={e => e.stopPropagation()}>
        <div className="ec-header">
          <RiMailSendLine size={16} />
          <span>AI EMAIL COMPOSER</span>
          <button className="ec-close" onClick={onClose}><RiCloseLine size={18} /></button>
        </div>

        <div className="ec-body">
          <div className="ec-left">
            <label className="ec-label">PROSPECT</label>
            <select className="ec-select" value={selectedId} onChange={e => setSelectedId(e.target.value)}>
              <option value="">Select prospect...</option>
              {prospects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
            {prospect && (
              <div className="ec-prospect-card">
                <div className="ec-pname">{prospect.name}</div>
                <div className="ec-pmeta">{prospect.industry || prospect.sector} · ICP {prospect.icp_score}</div>
                <div className="ec-pmeta">{(prospect.primary_lanes || []).join(', ')}</div>
              </div>
            )}

            <label className="ec-label" style={{ marginTop: 16 }}>TRIGGER / SIGNAL</label>
            <textarea
              className="ec-textarea"
              placeholder="e.g. Gymshark just expanded Vietnam sourcing..."
              value={trigger}
              onChange={e => setTrigger(e.target.value)}
              rows={3}
            />

            <label className="ec-label" style={{ marginTop: 16 }}>TONE</label>
            <div className="ec-tone-row">
              {TONES.map(t => (
                <button key={t} className={`ec-tone-btn${tone === t ? ' active' : ''}`} onClick={() => setTone(t)}>
                  {t}
                </button>
              ))}
            </div>

            <button className="ec-generate-btn" onClick={generate} disabled={!prospect || loading}>
              {loading ? <RiRefreshLine className="ec-spin" size={14} /> : <RiMailSendLine size={14} />}
              {loading ? 'Generating...' : 'Generate'}
            </button>
          </div>

          <div className="ec-right">
            {subjects.length > 0 && (
              <div className="ec-subjects">
                <div className="ec-section-label">SUBJECT LINES</div>
                {subjects.map((s, i) => (
                  <div key={i} className="ec-subject-row">
                    <span className="ec-subject-text">{s}</span>
                    <button className="ec-copy-btn" onClick={() => copyText(s, `s${i}`)}>
                      {copied === `s${i}` ? '✓' : <RiFileCopyLine size={12} />}
                    </button>
                  </div>
                ))}
              </div>
            )}

            <div className="ec-tabs">
              <button className={`ec-tab${tab === 'email' ? ' active' : ''}`} onClick={() => setTab('email')}>
                <RiMailSendLine size={12} /> Email
              </button>
              <button className={`ec-tab${tab === 'linkedin' ? ' active' : ''}`} onClick={() => setTab('linkedin')}>
                <RiLinkedinLine size={12} /> LinkedIn
              </button>
            </div>

            <div className="ec-output-wrap">
              {tab === 'email' && (
                <>
                  <pre className="ec-output">{extract('email') || (loading ? 'Generating...' : 'Generate to see email')}</pre>
                  {extract('email') && (
                    <button className="ec-copy-full" onClick={() => copyText(extract('email'), 'email')}>
                      {copied === 'email' ? '✓ Copied' : <><RiFileCopyLine size={12} /> Copy Email</>}
                    </button>
                  )}
                </>
              )}
              {tab === 'linkedin' && (
                <>
                  <pre className="ec-output">{extract('linkedin') || (loading ? 'Generating...' : 'Generate to see LinkedIn message')}</pre>
                  {extract('linkedin') && (
                    <button className="ec-copy-full" onClick={() => copyText(extract('linkedin'), 'linkedin')}>
                      {copied === 'linkedin' ? '✓ Copied' : <><RiFileCopyLine size={12} /> Copy Message</>}
                    </button>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
