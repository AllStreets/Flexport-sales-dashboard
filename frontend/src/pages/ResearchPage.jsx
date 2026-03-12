import { useState, useRef, useCallback } from 'react';
import { RiSearchEyeLine, RiRefreshLine, RiDeleteBinLine, RiFileCopyLine, RiCheckLine } from 'react-icons/ri';
import './ResearchPage.css';

const API = import.meta.env.VITE_API_URL || 'http://localhost:5001';

// ─── parsers ────────────────────────────────────────────────────────────────

function parseSection(text, key) {
  const start = text.indexOf(`## ${key}`);
  if (start === -1) return '';
  const after = text.slice(start + `## ${key}`.length).trim();
  const next = after.search(/^## /m);
  return (next === -1 ? after : after.slice(0, next)).trim();
}

function parseFreightModes(text) {
  const raw = parseSection(text, 'FREIGHT_MODES');
  if (!raw) return null;
  const m = raw.match(/ocean=(\d+)\s+air=(\d+)\s+land=(\d+)/i);
  if (!m) return null;
  return { ocean: +m[1], air: +m[2], land: +m[3] };
}

function parseUrgencyScore(text) {
  const raw = parseSection(text, 'URGENCY_SCORE');
  if (!raw) return null;
  const n = parseInt(raw.trim(), 10);
  return isNaN(n) ? null : Math.min(10, Math.max(1, n));
}

function parseStatChips(snapshotText) {
  const chips = [];
  const patterns = [
    { key: 'Revenue',   re: /\$[\d,.]+[BMK]?\s*(?:billion|million|B|M)?(?:\s+(?:annual|revenue|ARR|in revenue))?/i },
    { key: 'Employees', re: /[\d,]+\+?\s*(?:employees|staff|people|headcount)/i },
    { key: 'Founded',   re: /(?:founded|est\.?|established)\s*(?:in\s*)?\d{4}/i },
    { key: 'HQ',        re: /(?:headquartered|based|HQ)\s+(?:in\s+)?([A-Z][A-Za-z\s,]+?)(?:\.|,|\n|$)/i },
  ];
  for (const { key, re } of patterns) {
    const m = snapshotText.match(re);
    if (m) chips.push({ key, value: m[0].trim().replace(/^(?:founded|est\.?|established|headquartered|based|HQ)\s+(?:in\s+)?/i, '').replace(/\.$/, '') });
  }
  return chips;
}

function parseSignalBullets(text) {
  return text
    .split('\n')
    .map(l => l.replace(/^[-•*]\s*/, '').trim())
    .filter(Boolean)
    .map(line => {
      const lower = line.toLowerCase();
      let tone = 'neutral';
      if (/expan|grow|launch|partner|award|win|fund|hire|record|surge|boost|open|new|strong|positive|raise|acqui/.test(lower)) tone = 'positive';
      if (/risk|warn|loss|layoff|cut|decline|drop|miss|churn|delay|problem|issue|disrupt|slow|concern|sanction|penalt|fine|investig|sue|lawsuit/.test(lower)) tone = 'risk';
      return { line, tone };
    });
}

function parseHook(text) {
  return text.replace(/^["']|["']$/g, '').trim();
}

// ─── SVG components ──────────────────────────────────────────────────────────

function UrgencyRing({ score }) {
  const r = 42, cx = 54, cy = 54;
  const circ = 2 * Math.PI * r;
  const fill = (score / 10) * circ;
  const color = score >= 8 ? '#ef4444' : score >= 5 ? '#f59e0b' : '#10b981';
  return (
    <div className="rp-urgency-ring-wrap">
      <svg width={108} height={108} viewBox="0 0 108 108">
        <circle cx={cx} cy={cy} r={r} fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth={8} />
        <circle
          cx={cx} cy={cy} r={r} fill="none"
          stroke={color} strokeWidth={8}
          strokeDasharray={`${fill} ${circ}`}
          strokeLinecap="round"
          transform={`rotate(-90 ${cx} ${cy})`}
          style={{ transition: 'stroke-dasharray 0.8s ease', filter: `drop-shadow(0 0 6px ${color})` }}
        />
        <text x={cx} y={cy + 2} textAnchor="middle" dominantBaseline="middle"
          fill={color} fontSize={22} fontWeight={700} fontFamily="'JetBrains Mono',monospace">
          {score}
        </text>
        <text x={cx} y={cy + 20} textAnchor="middle" dominantBaseline="middle"
          fill="rgba(255,255,255,0.3)" fontSize={8} fontFamily="'JetBrains Mono',monospace" letterSpacing="0.1em">
          /10
        </text>
      </svg>
    </div>
  );
}

function FreightBar({ modes }) {
  const total = modes.ocean + modes.air + modes.land || 100;
  const bars = [
    { label: 'OCEAN', pct: modes.ocean / total * 100, color: '#00d4ff' },
    { label: 'AIR',   pct: modes.air   / total * 100, color: '#a78bfa' },
    { label: 'LAND',  pct: modes.land  / total * 100, color: '#34d399' },
  ];
  return (
    <div className="rp-freight-bar">
      <div className="rp-freight-bar-track">
        {bars.map(b => (
          <div key={b.label} className="rp-freight-bar-seg"
            style={{ width: `${b.pct}%`, background: b.color, transition: 'width 0.8s ease' }}
            title={`${b.label}: ${Math.round(b.pct)}%`}
          />
        ))}
      </div>
      <div className="rp-freight-bar-legend">
        {bars.map(b => (
          <span key={b.label} className="rp-freight-bar-item">
            <span className="rp-freight-dot" style={{ background: b.color }} />
            <span style={{ color: b.color }}>{b.label}</span>
            <span className="rp-freight-pct">{Math.round(b.pct)}%</span>
          </span>
        ))}
      </div>
    </div>
  );
}

function SkeletonLine({ w = '100%', h = 13, mb = 8 }) {
  return <div className="rp-skeleton" style={{ width: w, height: h, marginBottom: mb }} />;
}

function TileSkeleton() {
  return (
    <div className="rp-skeleton-tile">
      <SkeletonLine w="40%" h={10} mb={14} />
      <SkeletonLine w="100%" />
      <SkeletonLine w="90%" />
      <SkeletonLine w="80%" />
    </div>
  );
}

// ─── main component ──────────────────────────────────────────────────────────

export default function ResearchPage() {
  const [query, setQuery]     = useState('');
  const [output, setOutput]   = useState('');
  const [loading, setLoading] = useState(false);
  const [copied, setCopied]   = useState(false);
  const [history, setHistory] = useState(() => JSON.parse(localStorage.getItem('research_history') || '[]'));
  const outputRef = useRef('');

  const saveHistory = (company, text) => {
    const entry = { company, text, ts: Date.now() };
    const next = [entry, ...history].slice(0, 10);
    setHistory(next);
    localStorage.setItem('research_history', JSON.stringify(next));
  };

  const runResearch = useCallback(async (company = query.trim()) => {
    if (!company) return;
    setOutput('');
    outputRef.current = '';
    setLoading(true);
    try {
      const res = await fetch(`${API}/api/research`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ company }),
      });
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        for (const line of decoder.decode(value).split('\n')) {
          if (line.startsWith('data: ') && !line.includes('[DONE]')) {
            try {
              const { text } = JSON.parse(line.slice(6));
              outputRef.current += text;
              setOutput(outputRef.current);
            } catch {}
          }
        }
      }
      saveHistory(company, outputRef.current);
    } finally {
      setLoading(false);
    }
  }, [query]);

  const snapshot    = parseSection(output, 'SNAPSHOT');
  const tradeText   = parseSection(output, 'TRADE PROFILE');
  const whyContact  = parseSection(output, 'WHY CONTACT NOW');
  const signals     = parseSection(output, 'RECENT SIGNALS');
  const hookRaw     = parseSection(output, 'OPENING HOOK');
  const freightModes = parseFreightModes(output);
  const urgency     = parseUrgencyScore(output);
  const statChips   = snapshot ? parseStatChips(snapshot) : [];
  const signalBullets = signals ? parseSignalBullets(signals) : [];
  const hookText    = hookRaw ? parseHook(hookRaw) : '';
  const whyBullets  = whyContact ? whyContact.split('\n').map(l => l.replace(/^[-•*]\s*/, '').trim()).filter(Boolean) : [];

  const hasAnyContent = !!(snapshot || tradeText || signals || whyContact || hookRaw);
  const isStreaming   = loading;

  const copyHook = () => {
    if (!hookText) return;
    navigator.clipboard.writeText(hookText).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  return (
    <div className="rp-page">

      {/* ── left sidebar ── */}
      <div className="rp-sidebar">
        <div className="rp-search-box">
          <RiSearchEyeLine size={15} className="rp-search-icon" />
          <input
            className="rp-input"
            placeholder="Company name..."
            value={query}
            onChange={e => setQuery(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && runResearch()}
          />
          <button className="rp-scan-btn" onClick={() => runResearch()} disabled={!query.trim() || loading}>
            {loading ? <RiRefreshLine className="rp-spin" size={13} /> : 'SCAN'}
          </button>
        </div>

        {history.length > 0 && (
          <div className="rp-history">
            <div className="rp-history-label">RECENT SCANS</div>
            {history.map((h, i) => (
              <div key={i} className="rp-history-item"
                onClick={() => { setQuery(h.company); setOutput(h.text); }}>
                <span className="rp-history-name">{h.company}</span>
                <button className="rp-history-del" onClick={e => {
                  e.stopPropagation();
                  const next = history.filter((_, j) => j !== i);
                  setHistory(next);
                  localStorage.setItem('research_history', JSON.stringify(next));
                }}><RiDeleteBinLine size={10} /></button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── main content ── */}
      <div className="rp-main">
        {!hasAnyContent && !loading && (
          <div className="rp-empty">
            <RiSearchEyeLine size={36} className="rp-empty-icon" />
            <div className="rp-empty-title">INTELLIGENCE BRIEF</div>
            <p className="rp-empty-sub">Enter a company name to generate a scannable brief — freight profile, signals, urgency score, and opening hook in under 60 seconds.</p>
          </div>
        )}

        {(hasAnyContent || loading) && (
          <div className="rp-grid">

            {/* SNAPSHOT tile */}
            <div className="rp-tile rp-tile-full">
              <div className="rp-tile-header">
                <span className="rp-tile-label">SNAPSHOT</span>
                {isStreaming && !snapshot && <span className="rp-streaming-dot" />}
              </div>
              {snapshot ? (
                <>
                  {statChips.length > 0 && (
                    <div className="rp-chips">
                      {statChips.map(c => (
                        <span key={c.key} className="rp-chip">
                          <span className="rp-chip-key">{c.key}</span>
                          <span className="rp-chip-val">{c.value}</span>
                        </span>
                      ))}
                    </div>
                  )}
                  <p className="rp-snapshot-body">{snapshot}</p>
                </>
              ) : <TileSkeleton />}
            </div>

            {/* TRADE PROFILE tile */}
            <div className="rp-tile rp-tile-half">
              <div className="rp-tile-header">
                <span className="rp-tile-label">TRADE PROFILE</span>
                {isStreaming && !tradeText && <span className="rp-streaming-dot" />}
              </div>
              {tradeText ? (
                <>
                  {freightModes && <FreightBar modes={freightModes} />}
                  <p className="rp-trade-body">{tradeText.replace(/ocean=\d+\s+air=\d+\s+land=\d+/gi, '').trim()}</p>
                </>
              ) : <TileSkeleton />}
            </div>

            {/* URGENCY tile */}
            <div className="rp-tile rp-tile-half">
              <div className="rp-tile-header">
                <span className="rp-tile-label">URGENCY SCORE</span>
                {isStreaming && urgency === null && <span className="rp-streaming-dot" />}
              </div>
              {(urgency !== null || whyBullets.length > 0) ? (
                <div className="rp-urgency-wrap">
                  {urgency !== null && <UrgencyRing score={urgency} />}
                  {whyBullets.length > 0 && (
                    <ul className="rp-why-list">
                      {whyBullets.map((b, i) => (
                        <li key={i} className="rp-why-item">{b}</li>
                      ))}
                    </ul>
                  )}
                </div>
              ) : <TileSkeleton />}
            </div>

            {/* RECENT SIGNALS tile */}
            <div className="rp-tile rp-tile-full">
              <div className="rp-tile-header">
                <span className="rp-tile-label">RECENT SIGNALS</span>
                {isStreaming && !signals && <span className="rp-streaming-dot" />}
              </div>
              {signalBullets.length > 0 ? (
                <div className="rp-signals">
                  {signalBullets.map((s, i) => (
                    <div key={i} className={`rp-signal rp-signal-${s.tone}`}>
                      <span className="rp-signal-dot" />
                      <span className="rp-signal-text">{s.line}</span>
                    </div>
                  ))}
                </div>
              ) : signals === '' ? null : <TileSkeleton />}
            </div>

            {/* OPENING HOOK tile */}
            {(hookText || (loading && !hookRaw)) && (
              <div className="rp-tile rp-tile-full rp-tile-hook">
                <div className="rp-tile-header">
                  <span className="rp-tile-label">OPENING HOOK</span>
                  {isStreaming && !hookText && <span className="rp-streaming-dot" />}
                  {hookText && (
                    <button className="rp-copy-btn" onClick={copyHook} title="Copy hook">
                      {copied ? <RiCheckLine size={13} /> : <RiFileCopyLine size={13} />}
                      <span>{copied ? 'COPIED' : 'COPY'}</span>
                    </button>
                  )}
                </div>
                {hookText ? (
                  <blockquote className="rp-hook-text">"{hookText}"</blockquote>
                ) : <TileSkeleton />}
              </div>
            )}

            {loading && <span className="rp-cursor" />}
          </div>
        )}
      </div>
    </div>
  );
}
