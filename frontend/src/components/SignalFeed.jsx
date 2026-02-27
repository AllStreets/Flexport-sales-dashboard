// frontend/src/components/SignalFeed.jsx
import { useState, useEffect } from 'react';
import './SignalFeed.css';

const API = import.meta.env.VITE_API_URL || 'http://localhost:5000';

export default function SignalFeed() {
  const [signals, setSignals] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`${API}/api/signals`)
      .then(r => r.json())
      .then(data => { setSignals(Array.isArray(data) ? data : []); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

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
              <span className="urgency-badge" style={{ color: urgencyColor(s.urgency_score), borderColor: urgencyColor(s.urgency_score) }}>
                {urgencyLabel(s.urgency_score)} {s.urgency_score}/10
              </span>
              <span className="signal-source">{s.source || s.name}</span>
            </div>
            <p className="signal-headline">{s.title || s.headline}</p>
            {s.urgency_reason && <p className="signal-reason">{s.urgency_reason}</p>}
            {s.affected_sectors?.length > 0 && (
              <div className="signal-tags">
                {s.affected_sectors.map((sec, j) => <span key={j} className="signal-tag">{sec}</span>)}
              </div>
            )}
          </a>
        ))}
      </div>
    </div>
  );
}
