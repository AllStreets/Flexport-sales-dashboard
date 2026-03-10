// frontend/src/components/SignalFeed.jsx
import { useState, useEffect } from 'react';
import { RiSparklingLine, RiMailSendLine } from 'react-icons/ri';
import './SignalFeed.css';

const API = import.meta.env.VITE_API_URL || 'http://localhost:5000';

export default function SignalFeed({ onOpenOutreach, selectedProspect, onOpenEmailComposer }) {
  const [signals, setSignals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [matchSignal, setMatchSignal] = useState(null);
  const [matchResult, setMatchResult] = useState(null);
  const [matchLoading, setMatchLoading] = useState(false);

  const signalAlertsOn = localStorage.getItem('sdr_notif_signals') !== 'false';
  const aiEnabled = localStorage.getItem('sdr_ai_enabled') !== 'false';
  const aiModel = localStorage.getItem('sdr_ai_model') || 'gpt-4.1-mini';

  useEffect(() => {
    fetch(`${API}/api/signals`)
      .then(r => r.json())
      .then(data => {
        const list = Array.isArray(data) ? data : [];
        setSignals(list);
        setLoading(false);
        if (localStorage.getItem('sdr_notif_sound') === 'true') {
          const hasUrgent = list.some(s => s.urgency_score >= 8);
          if (hasUrgent) {
            try {
              const ctx = new (window.AudioContext || window.webkitAudioContext)();
              const osc = ctx.createOscillator();
              const gain = ctx.createGain();
              osc.connect(gain);
              gain.connect(ctx.destination);
              osc.type = 'sine';
              osc.frequency.setValueAtTime(880, ctx.currentTime);
              gain.gain.setValueAtTime(0.25, ctx.currentTime);
              gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.4);
              osc.start(ctx.currentTime);
              osc.stop(ctx.currentTime + 0.4);
            } catch { /* AudioContext not available */ }
          }
        }
      })
      .catch(() => setLoading(false));
  }, []);

  const runSignalMatch = async (signal) => {
    setMatchSignal(signal);
    setMatchResult(null);
    setMatchLoading(true);
    try {
      const r = await fetch(`${API}/api/signal-match`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ signal: signal.title || signal.headline, model: aiModel }),
      });
      setMatchResult(await r.json());
    } catch { setMatchResult({ error: 'Match failed' }); }
    finally { setMatchLoading(false); }
  };

  const urgencyColor = (score) => {
    if (score >= 8) return '#ef4444';
    if (score >= 5) return '#f59e0b';
    return '#10b981';
  };

  const urgencyLabel = (score) => {
    if (score >= 8) return 'ACT NOW';
    if (score >= 5) return 'MONITOR';
    return 'POSITIVE';
  };

  return (
    <div className="signal-feed">
      <div className="feed-header">
        <h3>Supply Chain Signals</h3>
        <span className="live-badge">LIVE</span>
      </div>

      {loading && <div className="feed-loading">Fetching signals...</div>}

      <div className="signal-list">
        {signals.map((s, i) => (
          <a key={i} href={s.url} target="_blank" rel="noreferrer" className="signal-card" style={{ animationDelay: `${i * 60}ms` }}>
            <div className="signal-top">
              {signalAlertsOn && (
                <span className="urgency-badge" style={{ color: urgencyColor(s.urgency_score), borderColor: urgencyColor(s.urgency_score) }}>
                  {urgencyLabel(s.urgency_score)} {s.urgency_score}/10
                </span>
              )}
              <span className="signal-source">{s.source || s.name}</span>
            </div>
            <p className="signal-headline">{s.title || s.headline}</p>
            {s.urgency_reason && <p className="signal-reason">{s.urgency_reason}</p>}
            {s.affected_sectors?.length > 0 && (
              <div className="signal-tags">
                {s.affected_sectors.map((sec, j) => <span key={j} className="signal-tag">{sec}</span>)}
              </div>
            )}
            <div className="signal-actions">
              {onOpenOutreach && (
                <button className="signal-outreach-btn" onClick={e => { e.preventDefault(); onOpenOutreach(selectedProspect, null); }}>
                  → Outreach
                </button>
              )}
              {aiEnabled && (
                <button className="signal-match-btn" onClick={e => { e.preventDefault(); runSignalMatch(s); }}>
                  <RiSparklingLine size={10} style={{ marginRight: 3 }} />AI Match
                </button>
              )}
              <button
                className="signal-email-btn"
                title="Compose email from this signal"
                onClick={e => { e.preventDefault(); onOpenEmailComposer?.(null, s.title || s.headline); }}
                style={{ background: 'none', border: 'none', color: '#475569', cursor: 'pointer', padding: '2px 4px' }}
              >
                <RiMailSendLine size={11} />
              </button>
            </div>
          </a>
        ))}
      </div>

      {/* AI Signal Match Panel */}
      {matchSignal && (
        <div className="smp-panel">
          <div className="smp-header">
            <RiSparklingLine size={12} style={{ marginRight: 6 }} />
            Signal Intelligence — AI Match
            <button className="smp-close" onClick={() => { setMatchSignal(null); setMatchResult(null); }}>✕</button>
          </div>
          <div className="smp-signal">"{(matchSignal.title || matchSignal.headline)?.slice(0, 100)}..."</div>
          {matchLoading && <div className="smp-loading">Analyzing signal...</div>}
          {matchResult && !matchResult.error && (
            <>
              {matchResult.affected_sectors?.length > 0 && (
                <div className="smp-row">
                  <span className="smp-label">Affected Sectors</span>
                  <div className="smp-chips">
                    {matchResult.affected_sectors.map((s, i) => <span key={i} className="smp-chip">{s}</span>)}
                  </div>
                </div>
              )}
              {matchResult.flexport_angle && (
                <div className="smp-row">
                  <span className="smp-label">Flexport Angle</span>
                  <p className="smp-angle">{matchResult.flexport_angle}</p>
                </div>
              )}
              {matchResult.talking_points?.length > 0 && (
                <div className="smp-row">
                  <span className="smp-label">Talking Points</span>
                  <ul className="smp-points">
                    {matchResult.talking_points.map((pt, i) => <li key={i}>{pt}</li>)}
                  </ul>
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}
