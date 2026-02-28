// frontend/src/pages/PerformancePage.jsx
import { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend, Cell } from 'recharts';
import {
  RiPhoneLine, RiMailSendLine, RiCalendarCheckLine, RiMoneyDollarCircleLine,
  RiAddLine, RiTrophyLine, RiCloseCircleLine
} from 'react-icons/ri';
import './PerformancePage.css';

// ── Quota targets ─────────────────────────────────────────────────────────────
const QUOTA = { calls: 50, emails: 100, demos: 5 };
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
      const iso = cursor.toISOString().slice(0, 10);
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
      {tooltip && (
        <div className="heatmap-tooltip" style={{ left: tooltip.x + 12, top: tooltip.y - 40 }}>
          <strong>{tooltip.date}</strong>
          <span>{tooltip.count} {tooltip.count === 1 ? 'activity' : 'activities'}</span>
        </div>
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
    date: new Date().toISOString().slice(0, 10),
    notes: '',
  });
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    if (!form.company_name.trim()) return;
    setSaving(true);
    try {
      await axios.post('/api/performance/activity', form);
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
      await axios.post('/api/win-loss', { ...form, deal_value: Number(form.deal_value) || 0 });
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

  const days = Array.from({ length: 5 }, (_, i) => {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    return d.toISOString().slice(0, 10);
  });

  const rows = days.map((date, i) => {
    const dayActivities = activities.filter(a => a.date === date);
    return {
      day: LABELS[i],
      calls:    dayActivities.filter(a => a.type === 'call').length,
      emails:   dayActivities.filter(a => a.type === 'email').length,
      demos:    dayActivities.filter(a => a.type === 'demo').length,
      linkedin: dayActivities.filter(a => a.type === 'linkedin').length,
      isToday:  date === today.toISOString().slice(0, 10),
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

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function PerformancePage() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showLogModal, setShowLogModal] = useState(false);
  const [winLossRecords, setWinLossRecords] = useState([]);

  async function load() {
    try {
      const [perfRes, wlRes] = await Promise.all([
        axios.get('/api/performance'),
        axios.get('/api/win-loss'),
      ]);
      setData(perfRes.data);
      setWinLossRecords(Array.isArray(wlRes.data) ? wlRes.data : (perfRes.data?.winLoss || []));
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

      {/* ── Main 3-column row ─────────────────────────────────────────── */}
      <div className="perf-main">

        {/* Left — Heatmap */}
        <div className="perf-card heatmap-panel">
          <div className="panel-header">
            <span className="panel-title">Activity Heatmap</span>
            <span className="panel-sub">{activities.length} total logged</span>
          </div>
          <ActivityHeatmap activities={activities} />
        </div>

        {/* Center — Funnel */}
        <div className="perf-card funnel-panel">
          <div className="panel-header">
            <span className="panel-title">Conversion Funnel</span>
          </div>
          <ConversionFunnel pipeline={pipeline} />
        </div>

        {/* Right — Quota + Weekly breakdown */}
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

      {/* ── Win / Loss ────────────────────────────────────────────────── */}
      <div className="winloss-section">
        <div className="perf-card wl-form-card">
          <WinLossForm onAdded={load} />
        </div>

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
                  <th>Deal</th>
                </tr>
              </thead>
              <tbody>
                {winLossRecords.length === 0 && (
                  <tr><td colSpan={5} className="wl-empty">No records yet — log your first win or loss.</td></tr>
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
                    <td style={{ color: r.outcome === 'won' ? '#10b981' : '#64748b', fontFamily: 'JetBrains Mono' }}>
                      {r.deal_value ? `$${Number(r.deal_value).toLocaleString()}` : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
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
