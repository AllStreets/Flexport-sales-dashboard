// frontend/src/components/SignalTicker.jsx
import { useState, useEffect } from 'react';
import './SignalTicker.css';

const API = import.meta.env.VITE_API_URL || 'http://localhost:5000';

export default function SignalTicker({ onOpenOutreach }) {
  const [signals, setSignals] = useState([]);

  useEffect(() => {
    const load = () => {
      fetch(`${API}/api/signals`)
        .then(r => r.json())
        .then(d => setSignals(Array.isArray(d) ? d.slice(0, 12) : []))
        .catch(() => {});
    };
    load();
    const id = setInterval(load, 60 * 60 * 1000); // refresh every hour
    return () => clearInterval(id);
  }, []);

  if (!signals.length) return null;

  const urgencyColor = s => s >= 8 ? '#ef4444' : s >= 5 ? '#f59e0b' : '#10b981';

  // Duplicate for seamless loop
  const items = [...signals, ...signals];

  return (
    <div className="ticker-bar">
      <span className="ticker-label">LIVE SIGNALS</span>
      <div className="ticker-track-wrap">
        <div className="ticker-track" style={{ '--count': signals.length }}>
          {items.map((s, i) => (
            <span key={i} className="ticker-item">
              <span className="ticker-dot" style={{ background: urgencyColor(s.urgency_score) }} />
              <span className="ticker-text">{s.title || s.headline}</span>
              <span className="ticker-score" style={{ color: urgencyColor(s.urgency_score) }}>
                {s.urgency_score}/10
              </span>
              {onOpenOutreach && (
                <button
                  className="ticker-action"
                  onClick={() => onOpenOutreach(null, null, s)}
                >→ Outreach</button>
              )}
              <span className="ticker-sep">◆</span>
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}
