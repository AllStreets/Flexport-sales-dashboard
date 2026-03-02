// frontend/src/pages/PerformancePage.jsx
import { useState, useEffect, useLayoutEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import axios from 'axios';

const API = import.meta.env.VITE_API_URL || 'http://localhost:5000';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend, Cell } from 'recharts';
import {
  RiPhoneLine, RiMailSendLine, RiCalendarCheckLine, RiMoneyDollarCircleLine,
  RiAddLine, RiTrophyLine, RiCloseCircleLine, RiTimeLine, RiAlertLine,
  RiCheckLine, RiArrowRightLine
} from 'react-icons/ri';
import './PerformancePage.css';

// ── Local date helper — avoids UTC offset shifting the date ───────────────────
function localDateStr(d = new Date()) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

// ── Quota targets — reads from Settings localStorage, falls back to defaults ──
function readQuota() {
  return {
    calls:  parseInt(localStorage.getItem('sdr_quota_calls'),  10) || 50,
    emails: parseInt(localStorage.getItem('sdr_quota_emails'), 10) || 100,
    demos:  parseInt(localStorage.getItem('sdr_quota_demos'),  10) || 5,
  };
}
const HEATMAP_LEVELS = [
  'rgba(255,255,255,0.05)',
  'rgba(0,212,255,0.18)',
  'rgba(0,212,255,0.38)',
  'rgba(0,212,255,0.62)',
  'rgba(0,212,255,0.88)',
];

// ── Count-up hook ─────────────────────────────────────────────────────────────
function useCountUp(target, delay = 0) {
  const [val, setVal] = useState(0);
  useEffect(() => {
    const t = setTimeout(() => {
      if (!target) return;
      let start = null;
      const DUR = 1400;
      const tick = (ts) => {
        if (!start) start = ts;
        const p = Math.min((ts - start) / DUR, 1);
        const e = 1 - (1 - p) ** 3;
        setVal(Math.round(e * target));
        if (p < 1) requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    }, delay);
    return () => clearTimeout(t);
  }, [target, delay]);
  return val;
}

// ── KPI Tile ──────────────────────────────────────────────────────────────────
function KpiTile({ label, value, format, Icon, color, delay }) {
  const n = useCountUp(value, delay);
  let display;
  if (format === 'currency') {
    if (n >= 1_000_000) display = `$${(n / 1_000_000).toFixed(1)}M`;
    else if (n >= 1_000) display = `$${(n / 1_000).toFixed(0)}K`;
    else display = `$${n}`;
  } else {
    display = n.toLocaleString();
  }
  return (
    <div className="kpi-tile">
      <div className="kpi-icon-wrap" style={{ background: `${color}18`, border: `1px solid ${color}30` }}>
        <Icon size={20} color={color} />
      </div>
      <div className="kpi-value" style={{ color }}>{display}</div>
      <div className="kpi-label">{label}</div>
    </div>
  );
}

// ── Activity Heatmap ──────────────────────────────────────────────────────────
function ActivityHeatmap({ activities }) {
  const [tooltip, setTooltip] = useState(null);

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // Build date-to-count map
  const countMap = {};
  activities.forEach(a => {
    countMap[a.date] = (countMap[a.date] || 0) + 1;
  });

  // Build 364-day grid (52 full weeks, starting from Monday 52 weeks ago)
  const gridStart = new Date(today);
  gridStart.setDate(today.getDate() - 363);
  // Shift back to Monday
  const dow = gridStart.getDay();
  gridStart.setDate(gridStart.getDate() - (dow === 0 ? 6 : dow - 1));

  const weeks = [];
  let cursor = new Date(gridStart);
  for (let w = 0; w < 53; w++) {
    const week = [];
    for (let d = 0; d < 7; d++) {
      const iso = localDateStr(cursor);
      const count = countMap[iso] || 0;
      week.push({ date: iso, count, future: cursor > today });
      cursor.setDate(cursor.getDate() + 1);
    }
    weeks.push(week);
  }

  const maxCount = Math.max(1, ...Object.values(countMap));

  function getLevel(count) {
    if (count === 0) return 0;
    if (count <= maxCount * 0.25) return 1;
    if (count <= maxCount * 0.5) return 2;
    if (count <= maxCount * 0.75) return 3;
    return 4;
  }

  const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  // Month labels: figure out which week each month starts
  const monthLabels = [];
  weeks.forEach((week, wi) => {
    const firstDay = new Date(week[0].date);
    if (firstDay.getDate() <= 7) {
      monthLabels.push({ wi, label: MONTHS[firstDay.getMonth()] });
    }
  });

  const DAYS = ['M','T','W','T','F','S','S'];

  return (
    <div className="heatmap-wrap">
      <div className="heatmap-month-row">
        {monthLabels.map(({ wi, label }) => (
          <span key={`${wi}-${label}`} className="heatmap-month" style={{ left: wi * 12 }}>{label}</span>
        ))}
      </div>
      <div className="heatmap-grid-row">
        <div className="heatmap-days">
          {DAYS.map((d, i) => <span key={i} className="heatmap-day">{d}</span>)}
        </div>
        <div className="heatmap-grid">
          {weeks.map((week, wi) => (
            <div key={wi} className="heatmap-col">
              {week.map((cell) => (
                <div
                  key={cell.date}
                  className="heatmap-cell"
                  style={{
                    background: cell.future ? 'transparent' : HEATMAP_LEVELS[getLevel(cell.count)],
                    border: cell.future ? '1px dashed rgba(255,255,255,0.04)' : `1px solid rgba(0,212,255,${getLevel(cell.count) * 0.08})`,
                  }}
                  onMouseEnter={e => !cell.future && setTooltip({ x: e.clientX, y: e.clientY, ...cell })}
                  onMouseLeave={() => setTooltip(null)}
                />
              ))}
            </div>
          ))}
        </div>
      </div>
      <div className="heatmap-legend">
        <span className="heatmap-legend-label">Less</span>
        {HEATMAP_LEVELS.map((c, i) => (
          <div key={i} className="heatmap-cell" style={{ background: c, border: '1px solid rgba(255,255,255,0.08)', flexShrink: 0 }} />
        ))}
        <span className="heatmap-legend-label">More</span>
      </div>
      {tooltip && createPortal(
        <div className="heatmap-tooltip" style={{ left: tooltip.x + 12, top: tooltip.y - 40 }}>
          <strong>{tooltip.date}</strong>
          <span>{tooltip.count} {tooltip.count === 1 ? 'activity' : 'activities'}</span>
        </div>,
        document.body
      )}
    </div>
  );
}

// ── Conversion Funnel ─────────────────────────────────────────────────────────
function ConversionFunnel({ pipeline }) {
  const [animated, setAnimated] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setAnimated(true), 300);
    return () => clearTimeout(t);
  }, []);

  const stages = [
    { label: 'Prospects in DB',    value: pipeline.totalProspects || 0, color: '#6366f1' },
    { label: 'Added to Pipeline',  value: pipeline.totalPipeline || 0,  color: '#8b5cf6' },
    { label: 'Contacted',          value: pipeline.calledPlus || 0,     color: '#00d4ff' },
    { label: 'Demo Booked',        value: pipeline.demoBooked || 0,     color: '#10b981' },
    { label: 'Closed Won',         value: pipeline.closedWon || 0,      color: '#f59e0b' },
  ];

  const max = Math.max(1, stages[0].value);

  return (
    <div className="funnel-wrap">
      {stages.map((stage, i) => {
        const pct = max > 0 ? (stage.value / max) * 100 : 0;
        const prev = i > 0 ? stages[i - 1].value : null;
        const conv = prev && prev > 0 ? ((stage.value / prev) * 100).toFixed(0) : null;
        return (
          <div key={stage.label} className="funnel-row">
            {conv !== null && (
              <div className="funnel-conv">
                <span style={{ color: '#94a3b8', fontSize: 10 }}>↓ {conv}%</span>
              </div>
            )}
            <div className="funnel-bar-wrap">
              <div
                className="funnel-bar"
                style={{
                  width: animated ? `${pct}%` : '0%',
                  background: stage.color,
                  boxShadow: `0 0 12px ${stage.color}50`,
                  transitionDelay: `${i * 120}ms`,
                }}
              />
              <span className="funnel-bar-label">{stage.label}</span>
              <span className="funnel-bar-value" style={{ color: stage.color }}>{stage.value.toLocaleString()}</span>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ── Quota Ring ────────────────────────────────────────────────────────────────
function QuotaRing({ pct }) {
  const [drawn, setDrawn] = useState(0);
  useEffect(() => {
    const t = setTimeout(() => setDrawn(pct), 400);
    return () => clearTimeout(t);
  }, [pct]);

  const R = 54;
  const CIRC = 2 * Math.PI * R;
  const dash = (drawn / 100) * CIRC;
  const color = drawn >= 80 ? '#10b981' : drawn >= 50 ? '#f59e0b' : '#ef4444';

  return (
    <div className="quota-ring-wrap">
      <svg width={130} height={130} viewBox="0 0 130 130">
        <circle cx={65} cy={65} r={R} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth={10} />
        <circle
          cx={65} cy={65} r={R}
          fill="none"
          stroke={color}
          strokeWidth={10}
          strokeLinecap="round"
          strokeDasharray={`${dash} ${CIRC}`}
          transform="rotate(-90 65 65)"
          style={{ transition: 'stroke-dasharray 1.2s cubic-bezier(0.34,1.56,0.64,1)', filter: `drop-shadow(0 0 6px ${color})` }}
        />
        <text x={65} y={60} textAnchor="middle" fill={color} fontSize={22} fontFamily="'JetBrains Mono', monospace" fontWeight={700}>
          {Math.round(drawn)}%
        </text>
        <text x={65} y={78} textAnchor="middle" fill="#64748b" fontSize={10} fontFamily="'Space Grotesk', sans-serif">
          ATTAINMENT
        </text>
      </svg>
    </div>
  );
}

// ── Log Activity Modal ────────────────────────────────────────────────────────
function LogActivityModal({ onClose, onLogged }) {
  const [form, setForm] = useState({
    type: 'call',
    company_name: '',
    date: localDateStr(),
    notes: '',
  });
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    if (!form.company_name.trim()) return;
    setSaving(true);
    try {
      await axios.post(`${API}/api/performance/activity`, form);
      onLogged();
      onClose();
    } catch {
      setSaving(false);
    }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="log-modal" onClick={e => e.stopPropagation()}>
        <div className="log-modal-header">
          <h3>Log Activity</h3>
          <button className="modal-close-btn" onClick={onClose}><RiCloseCircleLine size={20} /></button>
        </div>
        <form onSubmit={handleSubmit} className="log-form">
          <div className="lf-row">
            <label>Type</label>
            <div className="lf-type-pills">
              {['call','email','demo','linkedin'].map(t => (
                <button
                  key={t}
                  type="button"
                  className={`lf-pill${form.type === t ? ' active' : ''}`}
                  onClick={() => setForm(f => ({ ...f, type: t }))}
                >{t}</button>
              ))}
            </div>
          </div>
          <div className="lf-row">
            <label>Company</label>
            <input
              className="lf-input"
              value={form.company_name}
              onChange={e => setForm(f => ({ ...f, company_name: e.target.value }))}
              placeholder="e.g. Allbirds"
              required
            />
          </div>
          <div className="lf-row">
            <label>Date</label>
            <input
              className="lf-input"
              type="date"
              value={form.date}
              onChange={e => setForm(f => ({ ...f, date: e.target.value }))}
            />
          </div>
          <div className="lf-row">
            <label>Notes</label>
            <textarea
              className="lf-input lf-textarea"
              value={form.notes}
              onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
              placeholder="Optional..."
              rows={2}
            />
          </div>
          <button type="submit" className="btn-accent" disabled={saving}>
            {saving ? 'Logging…' : 'Log Activity'}
          </button>
        </form>
      </div>
    </div>
  );
}

// ── Outreach Stats ────────────────────────────────────────────────────────────
function OutreachStats({ activities, winLossRecords }) {
  const won  = winLossRecords.filter(r => r.outcome === 'won');
  const lost = winLossRecords.filter(r => r.outcome === 'lost');
  const total   = won.length + lost.length;
  const winRate = total > 0 ? Math.round((won.length / total) * 100) : 0;
  const avgDeal = won.length > 0
    ? Math.round(won.reduce((s, r) => s + (r.deal_value || 0), 0) / won.length)
    : 0;

  // Most common competitor from losses
  const compMap = {};
  lost.forEach(r => { if (r.competitor) compMap[r.competitor] = (compMap[r.competitor] || 0) + 1; });
  const topComp = Object.entries(compMap).sort((a, b) => b[1] - a[1])[0]?.[0] || null;

  // Current active day streak (ending on most recent active day)
  const activityDays = new Set(activities.map(a => a.date));
  let streak = 0;
  if (activityDays.size > 0) {
    const today = localDateStr();
    const sortedDays = Array.from(activityDays).sort().reverse();
    const latest = sortedDays[0];
    const daysDiff = Math.floor((new Date(today) - new Date(latest)) / 86400000);
    if (daysDiff <= 1) {
      let cursor = new Date(latest + 'T12:00:00');
      while (activityDays.has(cursor.toISOString().slice(0, 10))) {
        streak++;
        cursor.setDate(cursor.getDate() - 1);
      }
    }
  }

  // All-time activity breakdown
  const byType = { call: 0, email: 0, demo: 0, linkedin: 0 };
  activities.forEach(a => { if (a.type in byType) byType[a.type]++; });
  const totalActs = Object.values(byType).reduce((s, v) => s + v, 0);

  const TYPE_META = [
    { key: 'call',     color: '#00d4ff', label: 'Calls' },
    { key: 'email',    color: '#8b5cf6', label: 'Emails' },
    { key: 'demo',     color: '#10b981', label: 'Demos' },
    { key: 'linkedin', color: '#f59e0b', label: 'LinkedIn' },
  ];

  return (
    <div className="os-wrap">
      <div className="os-stat-grid">
        <div className="os-stat">
          <div className="os-stat-val" style={{ color: winRate >= 50 ? '#10b981' : '#f59e0b' }}>
            {winRate}<span style={{ fontSize: 14 }}>%</span>
          </div>
          <div className="os-stat-label">Win Rate</div>
        </div>
        <div className="os-stat">
          <div className="os-stat-val" style={{ color: '#00d4ff' }}>{total}</div>
          <div className="os-stat-label">Deals Logged</div>
        </div>
        <div className="os-stat">
          <div className="os-stat-val" style={{ color: '#10b981' }}>
            {avgDeal >= 1000 ? `$${Math.round(avgDeal / 1000)}K` : avgDeal ? `$${avgDeal}` : '—'}
          </div>
          <div className="os-stat-label">Avg Deal Won</div>
        </div>
        <div className="os-stat">
          <div className="os-stat-val" style={{ color: '#a78bfa' }}>{streak}</div>
          <div className="os-stat-label">Day Streak</div>
        </div>
      </div>

      <div className="os-breakdown">
        <div className="os-breakdown-label">All-Time Breakdown</div>
        {TYPE_META.map(({ key, color, label }) => {
          const count = byType[key];
          const pct   = totalActs > 0 ? (count / totalActs) * 100 : 0;
          return (
            <div key={key} className="os-bar-row">
              <span style={{ color, fontFamily: 'Space Grotesk', fontSize: 11, width: 58 }}>{label}</span>
              <div className="os-bar-bg">
                <div className="os-bar" style={{ width: `${pct}%`, background: color }} />
              </div>
              <span className="os-bar-count">{count}</span>
            </div>
          );
        })}
      </div>

      {topComp && (
        <div className="os-competitor">
          Top competitor lost to: <span style={{ color: '#ef4444', fontWeight: 600 }}>{topComp}</span>
        </div>
      )}
      {!topComp && total === 0 && (
        <div className="os-empty">Log wins and losses to see stats</div>
      )}

      {/* Recent activity notes */}
      {activities.filter(a => a.notes?.trim()).length > 0 && (
        <div className="os-notes-log">
          <div className="os-breakdown-label" style={{ marginTop: 12 }}>Recent Activity Notes</div>
          {activities.filter(a => a.notes?.trim()).slice(-5).reverse().map((a, i) => (
            <div key={i} className="os-note-row">
              <div className="os-note-meta">
                <span style={{ color: '#00d4ff', textTransform: 'capitalize' }}>{a.type}</span>
                {a.company_name && <span style={{ color: '#64748b' }}> · {a.company_name}</span>}
                <span style={{ color: '#334155' }}> · {a.date}</span>
              </div>
              <p className="os-note-text">{a.notes}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Win/Loss Log Form ─────────────────────────────────────────────────────────
function WinLossForm({ onAdded }) {
  const [form, setForm] = useState({
    company_name: '', outcome: 'won', stage_reached: '',
    competitor: '', reason: '', deal_value: '',
  });
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    if (!form.company_name.trim()) return;
    setSaving(true);
    try {
      await axios.post(`${API}/api/win-loss`, { ...form, deal_value: Number(form.deal_value) || 0 });
      setForm({ company_name: '', outcome: 'won', stage_reached: '', competitor: '', reason: '', deal_value: '' });
      onAdded();
    } finally {
      setSaving(false);
    }
  }

  const field = (key, placeholder, type = 'text') => (
    <input
      className="lf-input"
      type={type}
      placeholder={placeholder}
      value={form[key]}
      onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))}
    />
  );

  return (
    <form onSubmit={handleSubmit} className="wl-form">
      <h4 className="wl-form-title">Log Win / Loss</h4>
      <div className="lf-row">
        <label>Company</label>
        {field('company_name', 'Company name', 'text')}
      </div>
      <div className="lf-row">
        <label>Outcome</label>
        <div className="lf-type-pills">
          {['won','lost'].map(o => (
            <button
              key={o}
              type="button"
              className={`lf-pill${form.outcome === o ? ' active' : ''} ${o === 'won' ? 'pill-green' : 'pill-red'}`}
              onClick={() => setForm(f => ({ ...f, outcome: o }))}
            >
              {o === 'won' ? <RiTrophyLine size={11} /> : <RiCloseCircleLine size={11} />}
              {o === 'won' ? 'Won' : 'Lost'}
            </button>
          ))}
        </div>
      </div>
      <div className="lf-row">
        <label>Stage</label>
        {field('stage_reached', 'e.g. demo_booked')}
      </div>
      <div className="lf-row">
        <label>Competitor</label>
        {field('competitor', 'e.g. Flexport, Forto')}
      </div>
      <div className="lf-row">
        <label>Reason</label>
        {field('reason', 'Why won/lost?')}
      </div>
      <div className="lf-row">
        <label>Deal $</label>
        {field('deal_value', '0', 'number')}
      </div>
      <button type="submit" className="btn-accent" disabled={saving} style={{ marginTop: 4 }}>
        {saving ? 'Saving…' : 'Record'}
      </button>
    </form>
  );
}

// ── Win/Loss Bar Chart ────────────────────────────────────────────────────────
function WinLossChart({ records }) {
  const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

  // Build last 6 months
  const now = new Date();
  const monthData = Array.from({ length: 6 }, (_, i) => {
    const d = new Date(now.getFullYear(), now.getMonth() - 5 + i, 1);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    return { month: MONTHS[d.getMonth()], key, won: 0, lost: 0 };
  });

  records.forEach(r => {
    const key = r.created_at?.slice(0, 7);
    const slot = monthData.find(m => m.key === key);
    if (slot) {
      if (r.outcome === 'won') slot.won++;
      else slot.lost++;
    }
  });

  const CustomTooltip = ({ active, payload, label }) => {
    if (!active || !payload?.length) return null;
    return (
      <div style={{ background: 'rgba(6,11,24,0.95)', border: '1px solid rgba(255,255,255,0.1)', padding: '8px 12px', borderRadius: 6, fontSize: 12 }}>
        <div style={{ color: '#f1f5f9', marginBottom: 4 }}>{label}</div>
        {payload.map(p => (
          <div key={p.name} style={{ color: p.color }}>{p.name}: {p.value}</div>
        ))}
      </div>
    );
  };

  return (
    <ResponsiveContainer width="100%" height={160}>
      <BarChart data={monthData} barGap={4} margin={{ top: 4, right: 4, bottom: 0, left: -20 }}>
        <XAxis dataKey="month" tick={{ fill: '#64748b', fontSize: 11, fontFamily: 'Space Grotesk' }} axisLine={false} tickLine={false} />
        <YAxis tick={{ fill: '#64748b', fontSize: 11, fontFamily: 'JetBrains Mono' }} axisLine={false} tickLine={false} />
        <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(255,255,255,0.04)' }} />
        <Bar dataKey="won" name="Won" fill="#10b981" radius={[3,3,0,0]} maxBarSize={20} />
        <Bar dataKey="lost" name="Lost" fill="#ef4444" radius={[3,3,0,0]} maxBarSize={20} />
      </BarChart>
    </ResponsiveContainer>
  );
}

// ── Weekly Breakdown Table ────────────────────────────────────────────────────
function WeeklyTable({ activities }) {
  const LABELS = ['Mon','Tue','Wed','Thu','Fri'];
  const today = new Date();
  const dow = today.getDay();
  const monday = new Date(today);
  monday.setDate(today.getDate() - (dow === 0 ? 6 : dow - 1));

  const todayStr = localDateStr(today);

  const days = Array.from({ length: 5 }, (_, i) => {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    return localDateStr(d);
  });

  const rows = days.map((date, i) => {
    const dayActivities = activities.filter(a => a.date === date);
    return {
      day: LABELS[i],
      calls:    dayActivities.filter(a => a.type === 'call').length,
      emails:   dayActivities.filter(a => a.type === 'email').length,
      demos:    dayActivities.filter(a => a.type === 'demo').length,
      linkedin: dayActivities.filter(a => a.type === 'linkedin').length,
      isToday:  date === todayStr,
    };
  });

  return (
    <table className="weekly-table">
      <thead>
        <tr>
          <th>Day</th>
          <th>Calls</th>
          <th>Emails</th>
          <th>Demos</th>
          <th>LI</th>
        </tr>
      </thead>
      <tbody>
        {rows.map(r => (
          <tr key={r.day} className={r.isToday ? 'today-row' : ''}>
            <td>{r.day}{r.isToday && <span className="today-dot" />}</td>
            <td style={{ color: r.calls > 0 ? '#00d4ff' : '#475569' }}>{r.calls}</td>
            <td style={{ color: r.emails > 0 ? '#8b5cf6' : '#475569' }}>{r.emails}</td>
            <td style={{ color: r.demos > 0 ? '#10b981' : '#475569' }}>{r.demos}</td>
            <td style={{ color: r.linkedin > 0 ? '#f59e0b' : '#475569' }}>{r.linkedin}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

// ── Hex → rgb helper ──────────────────────────────────────────────────────────
function hexRgb(hex) {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `${r},${g},${b}`;
}

// ── 7-Day Outreach Cadence Heatmap ────────────────────────────────────────────
function OutreachCadenceHeatmap({ activities }) {
  const TYPES = [
    { key: 'call',     label: 'Calls',    color: '#00d4ff' },
    { key: 'email',    label: 'Emails',   color: '#8b5cf6' },
    { key: 'demo',     label: 'Demos',    color: '#10b981' },
    { key: 'linkedin', label: 'LinkedIn', color: '#f59e0b' },
  ];

  const DAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  const days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - (6 - i));
    return { date: localDateStr(d), label: DAY_LABELS[d.getDay()], isToday: i === 6 };
  });

  // Build count matrix [type][date]
  const matrix = {};
  TYPES.forEach(t => {
    matrix[t.key] = {};
    days.forEach(d => { matrix[t.key][d.date] = 0; });
  });
  activities.forEach(a => {
    if (matrix[a.type] && matrix[a.type][a.date] !== undefined) {
      matrix[a.type][a.date]++;
    }
  });

  // Weekly totals per type
  const totals = {};
  TYPES.forEach(t => {
    totals[t.key] = days.reduce((s, d) => s + matrix[t.key][d.date], 0);
  });

  const maxCount = Math.max(1, ...TYPES.flatMap(t => days.map(d => matrix[t.key][d.date])));

  return (
    <div className="och-wrap">
      <div className="och-grid">
        {/* Header row */}
        <div className="och-header-row">
          <div className="och-corner" />
          {days.map(d => (
            <div key={d.date} className={`och-day-header${d.isToday ? ' och-today' : ''}`}>
              {d.label}
            </div>
          ))}
        </div>

        {/* Type rows */}
        {TYPES.map(t => (
          <div key={t.key} className="och-row-contents">
            <div className="och-type-label" style={{ color: t.color }}>
              {t.label}
              <span className="och-type-total" style={{ color: t.color }}>{totals[t.key]}</span>
            </div>
            {days.map(d => {
              const count = matrix[t.key][d.date];
              const opacity = count === 0 ? 0.05 : 0.12 + (count / maxCount) * 0.76;
              return (
                <div
                  key={d.date}
                  className={`och-cell${d.isToday ? ' och-cell-today' : ''}`}
                  style={{
                    background: `rgba(${hexRgb(t.color)}, ${opacity})`,
                    border: `1px solid rgba(${hexRgb(t.color)}, ${count > 0 ? 0.28 : 0.06})`,
                  }}
                  title={`${t.label} — ${d.date}: ${count}`}
                >
                  {count > 0 && <span className="och-count">{count}</span>}
                </div>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Recent Activity Feed ──────────────────────────────────────────────────────
const ACTIVITY_TYPE_META = {
  call:     { color: '#00d4ff', label: 'Call' },
  email:    { color: '#8b5cf6', label: 'Email' },
  demo:     { color: '#10b981', label: 'Demo' },
  linkedin: { color: '#f59e0b', label: 'LinkedIn' },
};

function getTodayEST() {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/New_York' }).format(new Date());
}

function getMsUntilMidnightEST() {
  const now = new Date();
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/New_York',
    hour: 'numeric', minute: 'numeric', second: 'numeric', hour12: false,
  }).formatToParts(now);
  const h = parseInt(parts.find(p => p.type === 'hour').value);
  const m = parseInt(parts.find(p => p.type === 'minute').value);
  const s = parseInt(parts.find(p => p.type === 'second').value);
  const secsElapsed = h * 3600 + m * 60 + s;
  return (86400 - secsElapsed) * 1000;
}

function RecentActivityFeed({ activities }) {
  const [, tick] = useState(0);

  // Re-render at midnight EST each day so the date filter resets automatically
  useEffect(() => {
    let timer;
    function schedule() {
      timer = setTimeout(() => {
        tick(n => n + 1);
        schedule(); // schedule next midnight
      }, getMsUntilMidnightEST());
    }
    schedule();
    return () => clearTimeout(timer);
  }, []);

  const todayEST = getTodayEST();
  const sorted = activities
    .filter(a => a.date === todayEST)
    .sort((a, b) => (b.id || 0) - (a.id || 0));

  if (sorted.length === 0) {
    return <div className="raf-empty">No activities logged today — use Log Activity to get started</div>;
  }

  return (
    <div className="raf-list">
      {sorted.map((a, i) => {
        const meta = ACTIVITY_TYPE_META[a.type] || { color: '#64748b', label: a.type };
        return (
          <div key={i} className="raf-row">
            <span className="raf-dot" style={{ background: meta.color }} />
            <div className="raf-content">
              <div className="raf-meta">
                <span className="raf-type" style={{ color: meta.color }}>{meta.label}</span>
                {a.company_name && <span className="raf-company">{a.company_name}</span>}
                <span className="raf-date">{a.date}</span>
              </div>
              {a.notes?.trim() && <p className="raf-notes">{a.notes}</p>}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ── Stage meta shared across both new tiles ───────────────────────────────────
const STAGE_META = {
  new:          { label: 'New',          color: '#94a3b8' },
  researched:   { label: 'Researched',   color: '#60a5fa' },
  called:       { label: 'Called',       color: '#a78bfa' },
  demo_booked:  { label: 'Demo Booked',  color: '#34d399' },
};

// ── Follow-up Radar ───────────────────────────────────────────────────────────
function FollowupRadar({ refreshKey }) {
  const [items, setItems] = useState(null);

  useEffect(() => {
    fetch(`${API}/api/followup-radar`)
      .then(r => r.json())
      .then(setItems)
      .catch(() => setItems([]));
  }, [refreshKey]);

  function urgencyColor(days) {
    if (days >= 999) return '#ef4444';   // never contacted
    if (days >= 7)   return '#ef4444';   // red
    if (days >= 4)   return '#f59e0b';   // amber
    return '#94a3b8';                    // 3 days — mild
  }

  function daysLabel(days) {
    if (days >= 999) return 'Never contacted';
    if (days === 1)  return '1 day ago';
    return `${days}d ago`;
  }

  if (!items) {
    return <div className="fr-empty">Loading...</div>;
  }

  const neverCount  = items.filter(i => i.days_since >= 999).length;
  const overdueCount = items.length;

  return (
    <div className="fr-wrap">
      {overdueCount === 0 ? (
        <div className="fr-all-clear">
          <RiCheckLine size={20} color="#10b981" />
          <span>All pipeline companies contacted within 3 days</span>
        </div>
      ) : (
        <>
          <div className="fr-summary">
            <span className="fr-summary-chip fr-chip-red">
              <RiAlertLine size={11} />
              {overdueCount} overdue
            </span>
            {neverCount > 0 && (
              <span className="fr-summary-chip fr-chip-dark">
                {neverCount} never touched
              </span>
            )}
          </div>
          <div className="fr-list">
            {items.map((item, i) => {
              const sm = STAGE_META[item.stage] || { label: item.stage, color: '#64748b' };
              const icp = item.icp_score || 0;
              const color = urgencyColor(item.days_since);
              return (
                <div key={item.id} className="fr-row" style={{ animationDelay: `${i * 40}ms` }}>
                  <span className="fr-stage-dot" style={{ background: sm.color }} />
                  <span className="fr-name">{item.company_name}</span>
                  <span className="fr-stage-label" style={{ color: sm.color }}>{sm.label}</span>
                  {icp > 0 && (
                    <span className="fr-icp">ICP {icp}</span>
                  )}
                  <span className="fr-days" style={{ color }}>
                    <RiTimeLine size={10} />
                    {daysLabel(item.days_since)}
                  </span>
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}

// ── Pipeline Velocity ─────────────────────────────────────────────────────────
function PipelineVelocity({ refreshKey }) {
  const [stages, setStages] = useState(null);

  useEffect(() => {
    fetch(`${API}/api/pipeline-velocity`)
      .then(r => r.json())
      .then(setStages)
      .catch(() => setStages([]));
  }, [refreshKey]);

  if (!stages) return <div className="fr-empty">Loading...</div>;

  if (stages.length === 0) {
    return <div className="fr-empty">No active pipeline deals</div>;
  }

  const maxDays = Math.max(1, ...stages.map(s => s.avg_days || 0));
  const totalStuck = stages.reduce((s, r) => s + (r.stuck_count || 0), 0);
  const totalActive = stages.reduce((s, r) => s + (r.count || 0), 0);

  function velocityColor(days) {
    if (days > 7)  return '#ef4444';
    if (days > 3)  return '#f59e0b';
    return '#10b981';
  }

  return (
    <div className="pv-wrap">
      <div className="pv-summary">
        <div className="pv-summary-stat">
          <span className="pv-summary-val" style={{ color: '#00d4ff' }}>{totalActive}</span>
          <span className="pv-summary-label">Active Deals</span>
        </div>
        <div className="pv-summary-stat">
          <span className="pv-summary-val" style={{ color: totalStuck > 0 ? '#ef4444' : '#10b981' }}>
            {totalStuck}
          </span>
          <span className="pv-summary-label">Stuck &gt;7d</span>
        </div>
      </div>

      <div className="pv-stages">
        {stages.map((s, i) => {
          const sm = STAGE_META[s.stage] || { label: s.stage, color: '#64748b' };
          const days = s.avg_days || 0;
          const barPct = (days / maxDays) * 100;
          const vColor = velocityColor(days);
          return (
            <div key={s.stage} className="pv-stage-row" style={{ animationDelay: `${i * 60}ms` }}>
              <div className="pv-stage-header">
                <span className="pv-stage-dot" style={{ background: sm.color }} />
                <span className="pv-stage-name">{sm.label}</span>
                <span className="pv-stage-count">{s.count}</span>
                {s.stuck_count > 0 && (
                  <span className="pv-stuck-badge">
                    <RiAlertLine size={9} />
                    {s.stuck_count} stuck
                  </span>
                )}
                <span className="pv-stage-days" style={{ color: vColor }}>
                  {days.toFixed(1)}d avg
                </span>
              </div>
              <div className="pv-bar-bg">
                <div
                  className="pv-bar"
                  style={{ width: `${barPct}%`, background: vColor, boxShadow: `0 0 8px ${vColor}50` }}
                />
              </div>
            </div>
          );
        })}
      </div>

      <div className="pv-legend">
        <span className="pv-legend-item" style={{ color: '#10b981' }}><span className="pv-legend-dot" style={{ background: '#10b981' }} />Fast (&lt;3d)</span>
        <span className="pv-legend-item" style={{ color: '#f59e0b' }}><span className="pv-legend-dot" style={{ background: '#f59e0b' }} />Moderate (3–7d)</span>
        <span className="pv-legend-item" style={{ color: '#ef4444' }}><span className="pv-legend-dot" style={{ background: '#ef4444' }} />Slow (&gt;7d)</span>
      </div>
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function PerformancePage() {
  const [QUOTA, setQUOTA] = useState(readQuota);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showLogModal, setShowLogModal] = useState(false);
  const [winLossRecords, setWinLossRecords] = useState([]);
  const [radarKey, setRadarKey] = useState(0);

  // Re-read quota when user navigates back from Settings (storage event fires cross-tab;
  // same-tab navigation remounts the component so useState(readQuota) handles it).
  useEffect(() => {
    const handler = (e) => { if (e?.key?.startsWith('sdr_quota_')) setQUOTA(readQuota()); };
    window.addEventListener('storage', handler);
    return () => window.removeEventListener('storage', handler);
  }, []);

  // Mirror right column height → left column so raf-list scrolls at the right boundary.
  // useLayoutEffect with [loading] ensures we run after the real layout renders (not the spinner).
  const rightColRef = useRef(null);
  const leftColRef  = useRef(null);
  useLayoutEffect(() => {
    const rightEl = rightColRef.current;
    const leftEl  = leftColRef.current;
    if (!rightEl || !leftEl) return;
    function sync() { leftEl.style.height = rightEl.offsetHeight + 'px'; }
    const ro = new ResizeObserver(sync);
    ro.observe(rightEl);
    sync(); // immediate sync on first run
    return () => ro.disconnect();
  }, [loading]); // re-runs when loading flips false and real DOM is in place

  // Sync Follow-up Radar card height to Pipeline Velocity card height so the
  // FR list scrolls rather than the card growing taller than PV.
  const pvCardRef = useRef(null);
  const frCardRef = useRef(null);
  useLayoutEffect(() => {
    const pvEl = pvCardRef.current;
    const frEl = frCardRef.current;
    if (!pvEl || !frEl) return;
    function sync() { frEl.style.height = pvEl.offsetHeight + 'px'; }
    const ro = new ResizeObserver(sync);
    ro.observe(pvEl);
    sync();
    return () => ro.disconnect();
  }, [loading]);

  async function load() {
    try {
      const [perfRes, wlRes] = await Promise.all([
        axios.get(`${API}/api/performance`),
        axios.get(`${API}/api/win-loss`),
      ]);
      setData(perfRes.data);
      setWinLossRecords(Array.isArray(wlRes.data) ? wlRes.data : (perfRes.data?.winLoss || []));
      setRadarKey(k => k + 1);
    } catch {
      setData(null);
      setWinLossRecords([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  if (loading) {
    return (
      <div className="perf-loading">
        <div className="perf-spinner" />
        <span>Loading dashboard…</span>
      </div>
    );
  }

  const kpis = data?.kpis || {};
  const pipeline = data?.pipeline || {};
  const activities = data?.activities || [];

  // Quota attainment (composite of calls + emails toward weekly targets)
  const callPct   = Math.min(100, ((kpis.callsThisWeek  || 0) / QUOTA.calls)  * 100);
  const emailPct  = Math.min(100, ((kpis.emailsThisWeek || 0) / QUOTA.emails) * 100);
  const demoPct   = Math.min(100, ((kpis.demosBooked    || 0) / QUOTA.demos)  * 100);
  const attainment = Math.round((callPct + emailPct + demoPct) / 3) || 0;

  return (
    <div className="perf-page">
      {/* ── KPI Bar ──────────────────────────────────────────────────── */}
      <div className="kpi-bar">
        <KpiTile
          label="Calls This Week" value={kpis.callsThisWeek || 0}
          Icon={RiPhoneLine} color="#00d4ff" delay={0}
        />
        <KpiTile
          label="Emails Sent" value={kpis.emailsThisWeek || 0}
          Icon={RiMailSendLine} color="#8b5cf6" delay={100}
        />
        <KpiTile
          label="Demos Booked" value={kpis.demosBooked || 0}
          Icon={RiCalendarCheckLine} color="#10b981" delay={200}
        />
        <KpiTile
          label="Pipeline Value" value={kpis.pipelineValue || 0}
          format="currency"
          Icon={RiMoneyDollarCircleLine} color="#f59e0b" delay={300}
        />
      </div>

      {/* ── ROW 2: Heatmap+Cadence (left) | FR+PV+QA (right) ─────────── */}
      <div className="row2-grid">

        {/* Left: Activity Heatmap + 7-Day Cadence stacked */}
        <div className="perf-left-col" ref={leftColRef}>
          <div className="perf-card heatmap-panel">
            <div className="panel-header">
              <span className="panel-title">Activity Heatmap</span>
              <span className="panel-sub">{activities.length} total logged</span>
            </div>
            <ActivityHeatmap activities={activities} />
          </div>
          <div className="perf-card">
            <div className="panel-header">
              <span className="panel-title">7-Day Cadence</span>
              <span className="panel-sub">outreach by type · last 7 days</span>
            </div>
            <OutreachCadenceHeatmap activities={activities} />
          </div>
          <div className="perf-card raf-card">
            <div className="panel-header">
              <span className="panel-title">Recent Activity</span>
              <span className="panel-sub">today · resets midnight EST</span>
            </div>
            <RecentActivityFeed activities={activities} />
          </div>
        </div>

        {/* Right: Follow-up Radar + Pipeline Velocity (top), Quota Attainment (bottom) */}
        <div className="perf-right-col" ref={rightColRef}>
          <div className="fr-pv-row">
            <div className="perf-card fr-pv-fr-card" ref={frCardRef}>
              <div className="panel-header">
                <span className="panel-title">Follow-up Radar</span>
                <span className="panel-sub">pipeline companies overdue for contact</span>
              </div>
              <FollowupRadar refreshKey={radarKey} />
            </div>
            <div className="perf-card" ref={pvCardRef}>
              <div className="panel-header">
                <span className="panel-title">Pipeline Velocity</span>
                <span className="panel-sub">avg days per stage</span>
              </div>
              <PipelineVelocity refreshKey={radarKey} />
            </div>
          </div>

          <div className="perf-card quota-panel">
            <div className="panel-header">
              <span className="panel-title">Quota Attainment</span>
            </div>
            <QuotaRing pct={attainment} />
            <div className="quota-targets">
              <div className="qt-row">
                <span style={{ color: '#00d4ff' }}>Calls</span>
                <div className="qt-bar-bg">
                  <div className="qt-bar" style={{ width: `${callPct}%`, background: '#00d4ff' }} />
                </div>
                <span className="qt-val">{kpis.callsThisWeek || 0}<span className="qt-max">/{QUOTA.calls}</span></span>
              </div>
              <div className="qt-row">
                <span style={{ color: '#8b5cf6' }}>Emails</span>
                <div className="qt-bar-bg">
                  <div className="qt-bar" style={{ width: `${emailPct}%`, background: '#8b5cf6' }} />
                </div>
                <span className="qt-val">{kpis.emailsThisWeek || 0}<span className="qt-max">/{QUOTA.emails}</span></span>
              </div>
              <div className="qt-row">
                <span style={{ color: '#10b981' }}>Demos</span>
                <div className="qt-bar-bg">
                  <div className="qt-bar" style={{ width: `${demoPct}%`, background: '#10b981' }} />
                </div>
                <span className="qt-val">{kpis.demosBooked || 0}<span className="qt-max">/{QUOTA.demos}</span></span>
              </div>
            </div>
            <WeeklyTable activities={activities} />
            <button className="btn-accent log-activity-btn" onClick={() => setShowLogModal(true)}>
              <RiAddLine size={15} />
              Log Activity
            </button>
          </div>
        </div>
      </div>

      {/* ── ROW 3: Outreach Stats | Win/Loss Chart+Table | Log Win/Loss ── */}
      <div className="row3-grid">

        {/* Col 1: Outreach Stats */}
        <div className="perf-card">
          <div className="panel-header">
            <span className="panel-title">Outreach Stats</span>
            <span className="panel-sub">{activities.length} activities</span>
          </div>
          <OutreachStats activities={activities} winLossRecords={winLossRecords} />
        </div>

        {/* Col 2: Win/Loss chart + records */}
        <div className="perf-card wl-data-card">
          <div className="panel-header">
            <span className="panel-title">Win / Loss by Month</span>
          </div>
          <WinLossChart records={winLossRecords} />
          <div className="wl-table-wrap">
            <table className="wl-table">
              <thead>
                <tr>
                  <th>Company</th>
                  <th>Outcome</th>
                  <th>Stage</th>
                  <th>Competitor</th>
                  <th>Reason</th>
                  <th>Deal</th>
                </tr>
              </thead>
              <tbody>
                {winLossRecords.length === 0 && (
                  <tr><td colSpan={6} className="wl-empty">No records yet — log your first win or loss.</td></tr>
                )}
                {winLossRecords.slice(0, 12).map(r => (
                  <tr key={r.id}>
                    <td>{r.company_name}</td>
                    <td>
                      <span className={`outcome-badge ${r.outcome === 'won' ? 'badge-won' : 'badge-lost'}`}>
                        {r.outcome === 'won' ? <RiTrophyLine size={11} /> : <RiCloseCircleLine size={11} />}
                        {r.outcome}
                      </span>
                    </td>
                    <td style={{ color: '#64748b' }}>{r.stage_reached || '—'}</td>
                    <td style={{ color: '#64748b' }}>{r.competitor || '—'}</td>
                    <td style={{ color: '#94a3b8', maxWidth: 160 }}>{r.reason || '—'}</td>
                    <td style={{ color: r.outcome === 'won' ? '#10b981' : '#64748b', fontFamily: 'JetBrains Mono' }}>
                      {r.deal_value ? `$${Number(r.deal_value).toLocaleString()}` : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Col 3: Log Win/Loss form */}
        <div className="perf-card wl-form-card">
          <WinLossForm onAdded={load} />
        </div>
      </div>

      {showLogModal && (
        <LogActivityModal
          onClose={() => setShowLogModal(false)}
          onLogged={load}
        />
      )}
    </div>
  );
}
