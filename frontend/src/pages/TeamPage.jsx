import { useState, useEffect } from 'react';
import { RiTeamLine, RiTrophyLine, RiArrowUpLine, RiArrowDownLine, RiSubtractLine } from 'react-icons/ri';
import './TeamPage.css';

const API = import.meta.env.VITE_API_URL || 'http://localhost:5001';

function QuotaRing({ pct, label, sub, color = '#00d4ff', size = 90 }) {
  const r = 36, circ = 2 * Math.PI * r;
  const fill = Math.min(pct || 0, 100);
  return (
    <div className="team-ring-wrap">
      <svg width={size} height={size} viewBox="0 0 90 90">
        <circle cx="45" cy="45" r={r} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="6" />
        <circle cx="45" cy="45" r={r} fill="none" stroke={color} strokeWidth="6"
          strokeDasharray={circ} strokeDashoffset={circ * (1 - fill / 100)}
          strokeLinecap="round" transform="rotate(-90 45 45)"
          style={{ transition: 'stroke-dashoffset 1s ease' }} />
        <text x="45" y="47" textAnchor="middle" fill="#e2e8f0" fontSize="13" fontFamily="JetBrains Mono" fontWeight="700">
          {Math.round(pct || 0)}%
        </text>
      </svg>
      <div className="team-ring-label">{label}</div>
      <div className="team-ring-sub">{sub}</div>
    </div>
  );
}

export default function TeamPage() {
  const [data, setData] = useState({ members: [] });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`${API}/api/team`)
      .then(r => r.json())
      .then(d => { setData(d); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  const trendIcon = t => t === '+' ? <RiArrowUpLine color="#10b981" size={13} />
    : t === '-' ? <RiArrowDownLine color="#ef4444" size={13} />
    : <RiSubtractLine color="#475569" size={13} />;

  if (loading) return <div className="team-loading">Loading team data...</div>;

  const members = data.members || [];

  const totals = members.reduce((a, m) => ({
    calls: a.calls + (m.calls || 0),
    demos: a.demos + (m.demos || 0),
    pipeline: a.pipeline + (m.pipeline_value || 0),
  }), { calls: 0, demos: 0, pipeline: 0 });

  // Use avg quota_pct for rings
  const avgQuota = members.length ? members.reduce((a, m) => a + (m.quota_pct || 0), 0) / members.length : 0;
  const topCaller = members.reduce((a, m) => (m.calls > (a?.calls || 0) ? m : a), null);
  const callPct = topCaller ? (topCaller.calls / (topCaller.calls * 1.2)) * 100 : 0; // relative

  return (
    <div className="team-page">
      <div className="team-header-row">
        <RiTeamLine size={18} className="team-header-icon" />
        <span className="team-header-title">TEAM INTELLIGENCE</span>
        <span className="team-header-sub">{members.length} reps · MTD</span>
      </div>

      <div className="team-rings-row">
        <QuotaRing pct={avgQuota} label="Avg Quota" sub={`${Math.round(avgQuota)}% attainment`} />
        <QuotaRing pct={Math.min((totals.calls / (members.length * 160)) * 100, 100)} label="Team Calls" sub={`${totals.calls} total`} color="#6366f1" />
        <QuotaRing pct={Math.min((totals.demos / (members.length * 22)) * 100, 100)} label="Team Demos" sub={`${totals.demos} total`} color="#10b981" />
        <QuotaRing pct={Math.min((totals.pipeline / (members.length * 415000)) * 100, 100)} label="Pipeline" sub={`$${(totals.pipeline/1000).toFixed(0)}k`} color="#f59e0b" />
      </div>

      <div className="team-grid">
        <div className="team-leaderboard">
          <div className="team-section-label">LEADERBOARD</div>
          <div className="team-table">
            <div className="team-table-head">
              <span>REP</span><span>CALLS</span><span>DEMOS</span><span>PIPELINE</span><span>QUOTA %</span><span>TREND</span>
            </div>
            {members.map((m, i) => (
              <div key={m.id} className={`team-table-row${m.is_you ? ' you' : ''}${i === 0 ? ' top' : ''}`}>
                <span className="team-rep-cell">
                  <span className="team-avatar">{m.avatar_initials}</span>
                  <span>{m.name}</span>
                  {i === 0 && <RiTrophyLine size={12} color="#f59e0b" />}
                  {m.is_you && <span className="team-you-badge">YOU</span>}
                </span>
                <span>{m.calls}</span>
                <span>{m.demos}</span>
                <span>${((m.pipeline_value || 0)/1000).toFixed(0)}k</span>
                <span style={{ color: m.quota_pct >= 100 ? '#10b981' : m.quota_pct >= 75 ? '#f59e0b' : '#ef4444' }}>
                  {m.quota_pct}%
                </span>
                <span>{trendIcon(m.trend)}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="team-coaching">
          <div className="team-section-label">AI COACH INSIGHTS</div>
          {members.map(m => (
            <div key={m.id} className="team-coach-card">
              <div className="team-coach-name">{m.name}</div>
              <div className="team-coach-text">{m.insight || 'Keep up the momentum.'}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
