import { useState, useCallback, useEffect, useRef } from 'react';
import { RiSearchEyeLine, RiRefreshLine, RiDeleteBinLine, RiFileCopyLine, RiCheckLine, RiCloseLine, RiMicLine, RiMicOffLine } from 'react-icons/ri';
import '../pages/ResearchPage.css';
import './QuickResearchModal.css';

const API = import.meta.env.VITE_API_URL || 'http://localhost:5001';

function UrgencyRing({ score }) {
  const r = 42, cx = 54, cy = 54;
  const circ = 2 * Math.PI * r;
  const fill = (score / 10) * circ;
  const color = score >= 8 ? '#ef4444' : score >= 5 ? '#f59e0b' : '#10b981';
  return (
    <div className="rp-urgency-ring-wrap">
      <svg width={108} height={108} viewBox="0 0 108 108">
        <circle cx={cx} cy={cy} r={r} fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth={8} />
        <circle cx={cx} cy={cy} r={r} fill="none" stroke={color} strokeWidth={8}
          strokeDasharray={`${fill} ${circ}`} strokeLinecap="round"
          transform={`rotate(-90 ${cx} ${cy})`}
          style={{ transition: 'stroke-dasharray 0.8s ease', filter: `drop-shadow(0 0 6px ${color})` }} />
        <text x={cx} y={cy + 2} textAnchor="middle" dominantBaseline="middle"
          fill={color} fontSize={22} fontWeight={700} fontFamily="'JetBrains Mono',monospace">{score}</text>
        <text x={cx} y={cy + 20} textAnchor="middle" dominantBaseline="middle"
          fill="rgba(255,255,255,0.3)" fontSize={8} fontFamily="'JetBrains Mono',monospace" letterSpacing="0.1em">/10</text>
      </svg>
    </div>
  );
}

function FreightBar({ ocean, air, land }) {
  const total = (ocean + air + land) || 100;
  const bars = [
    { label: 'OCEAN', pct: ocean / total * 100, color: '#00d4ff' },
    { label: 'AIR',   pct: air   / total * 100, color: '#a78bfa' },
    { label: 'LAND',  pct: land  / total * 100, color: '#34d399' },
  ];
  return (
    <div className="rp-freight-bar">
      <div className="rp-freight-bar-track">
        {bars.map(b => <div key={b.label} className="rp-freight-bar-seg" style={{ width: `${b.pct}%`, background: b.color }} title={`${b.label}: ${Math.round(b.pct)}%`} />)}
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

function LoadingGrid() {
  return (
    <div className="rp-grid">
      <div className="rp-tile rp-tile-full">
        <SkeletonLine w="30%" h={9} mb={14} />
        <div style={{ display:'flex', gap:8, marginBottom:12 }}>
          {[80,90,70,85].map((w,i) => <SkeletonLine key={i} w={w} h={26} mb={0} />)}
        </div>
        <SkeletonLine /><SkeletonLine w="90%" /><SkeletonLine w="75%" />
      </div>
      <div className="rp-tile rp-tile-full">
        <SkeletonLine w="30%" h={9} mb={14} />
        <SkeletonLine h={8} mb={10} />
        <SkeletonLine /><SkeletonLine w="85%" /><SkeletonLine w="70%" />
      </div>
      <div className="rp-tile rp-tile-half">
        <SkeletonLine w="40%" h={9} mb={14} />
        <SkeletonLine /><SkeletonLine w="90%" /><SkeletonLine w="80%" />
      </div>
      <div className="rp-tile rp-tile-half">
        <SkeletonLine w="40%" h={9} mb={14} />
        <SkeletonLine /><SkeletonLine w="85%" />
      </div>
      <div className="rp-tile rp-tile-full">
        <SkeletonLine w="30%" h={9} mb={14} />
        {[1,2,3,4].map(i => <SkeletonLine key={i} w={`${75+i*5}%`} h={38} mb={6} />)}
      </div>
    </div>
  );
}

function signalTone(text) {
  const l = text.toLowerCase();
  if (/expan|grow|launch|partner|award|win|fund|hire|record|surge|boost|open|new|strong|raise|acqui/.test(l)) return 'positive';
  if (/risk|warn|loss|layoff|cut|decline|drop|miss|churn|delay|problem|issue|disrupt|slow|sanction|fine/.test(l)) return 'risk';
  return 'neutral';
}

export default function QuickResearchModal({ isOpen, onClose }) {
  const [query, setQuery]     = useState('');
  const [data, setData]       = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState('');
  const [copied, setCopied]   = useState(false);
  const [history, setHistory] = useState(() => {
    try { return JSON.parse(localStorage.getItem('research_history') || '[]'); } catch { return []; }
  });
  const [micActive, setMicActive] = useState(false);
  const [micSupported] = useState(() => !!(window.SpeechRecognition || window.webkitSpeechRecognition));
  const inputRef = useRef(null);
  const recognitionRef = useRef(null);
  const micActiveRef = useRef(false);

  useEffect(() => {
    if (isOpen) setTimeout(() => inputRef.current?.focus(), 80);
    // Stop mic when modal closes
    if (!isOpen) stopMic();
  }, [isOpen]);

  const stopMic = () => {
    micActiveRef.current = false;
    recognitionRef.current?.stop();
    setMicActive(false);
  };

  const toggleMic = () => {
    if (micActiveRef.current) { stopMic(); return; }
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) return;
    const recognition = new SR();
    recognition.continuous = false;
    recognition.interimResults = true;
    recognition.lang = 'en-US';
    recognitionRef.current = recognition;
    recognition.onresult = (e) => {
      const transcript = Array.from(e.results).map(r => r[0].transcript).join('');
      setQuery(transcript);
      if (e.results[e.results.length - 1].isFinal) {
        stopMic();
        // Auto-run after a short pause on final result
        setTimeout(() => {
          if (transcript.trim()) runResearch(transcript.trim());
        }, 300);
      }
    };
    recognition.onerror = (e) => { if (e.error !== 'no-speech') stopMic(); };
    recognition.onend = () => { if (micActiveRef.current) stopMic(); };
    recognition.start();
    micActiveRef.current = true;
    setMicActive(true);
  };

  const saveHistory = (company, d) => {
    const entry = { company, data: d, ts: Date.now() };
    const next = [entry, ...history.filter(h => h.company.toLowerCase() !== company.toLowerCase())].slice(0, 10);
    setHistory(next);
    localStorage.setItem('research_history', JSON.stringify(next));
  };

  const runResearch = useCallback(async (company = query.trim()) => {
    if (!company) return;
    setData(null); setError(''); setLoading(true);
    try {
      const res = await fetch(`${API}/api/research`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ company }),
      });
      const json = await res.json();
      if (json.error) throw new Error(json.error);
      setData(json);
      saveHistory(company, json);
    } catch (e) {
      setError(e.message || 'Research failed');
    } finally {
      setLoading(false);
    }
  }, [query, history]);

  const loadHistory = (h) => {
    setQuery(h.company);
    if (h.data && typeof h.data === 'object' && h.data.snapshot) {
      setData(h.data);
    } else {
      runResearch(h.company);
    }
  };

  const copyHook = () => {
    if (!data?.openingHook) return;
    navigator.clipboard.writeText(data.openingHook).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  if (!isOpen) return null;

  const chips = data ? [
    data.employees && { key: 'EMPLOYEES', value: data.employees },
    data.founded   && { key: 'FOUNDED',   value: data.founded   },
    data.hq        && { key: 'HQ',        value: data.hq        },
    data.revenue   && { key: 'REVENUE',   value: data.revenue   },
  ].filter(Boolean) : [];

  const signals  = Array.isArray(data?.signals)  ? data.signals  : [];
  const whyNow   = Array.isArray(data?.whyNow)   ? data.whyNow   : [];
  const hasData  = !!data && !error;

  return (
    <div className="qr-overlay" onClick={onClose}>
      <div className="qr-panel" onClick={e => e.stopPropagation()}>

        <div className="qr-header">
          <RiSearchEyeLine size={16} style={{ color: '#00d4ff' }} />
          <span className="qr-title">Quick Research</span>
          <span className="qr-hint">Ctrl+Shift+Q</span>
          <button className="qr-close" onClick={onClose}><RiCloseLine size={18} /></button>
        </div>

        <div className="rp-page" style={{ flex: 1, minHeight: 0 }}>
          <div className="rp-sidebar">
            <div className={`rp-search-box${micActive ? ' rp-search-box--listening' : ''}`}>
              <RiSearchEyeLine size={15} className="rp-search-icon" />
              <input
                ref={inputRef}
                className="rp-input"
                placeholder={micActive ? 'Listening...' : 'Company name...'}
                value={query}
                onChange={e => setQuery(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && runResearch()}
              />
              {micSupported && (
                <button
                  className={`rp-mic-btn${micActive ? ' rp-mic-btn--on' : ''}`}
                  onClick={toggleMic}
                  title={micActive ? 'Stop listening' : 'Voice search'}
                >
                  {micActive ? <RiMicLine size={13} /> : <RiMicOffLine size={13} />}
                </button>
              )}
              <button className="rp-scan-btn" onClick={() => runResearch()} disabled={!query.trim() || loading}>
                {loading ? <RiRefreshLine className="rp-spin" size={13} /> : 'SCAN'}
              </button>
            </div>

            {history.length > 0 && (
              <div className="rp-history">
                <div className="rp-history-label">RECENT SCANS</div>
                {history.map((h, i) => (
                  <div key={i} className="rp-history-item" onClick={() => loadHistory(h)}>
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

          <div className="rp-main">
            {!hasData && !loading && !error && (
              <div className="rp-empty">
                <RiSearchEyeLine size={36} className="rp-empty-icon" />
                <div className="rp-empty-title">INTELLIGENCE BRIEF</div>
                <p className="rp-empty-sub">Enter a company name to generate a scannable brief — freight profile, signals, urgency score, and opening hook.</p>
              </div>
            )}

            {error && (
              <div className="rp-empty">
                <div className="rp-empty-title" style={{ color: '#ef4444' }}>GENERATION FAILED</div>
                <p className="rp-empty-sub">{error}</p>
              </div>
            )}

            {loading && <LoadingGrid />}

            {hasData && (
              <div className="rp-grid">
                <div className="rp-tile rp-tile-full">
                  <div className="rp-tile-header"><span className="rp-tile-label">SNAPSHOT</span></div>
                  {chips.length > 0 && (
                    <div className="rp-chips">
                      {chips.map(c => (
                        <span key={c.key} className="rp-chip">
                          <span className="rp-chip-key">{c.key}</span>
                          <span className="rp-chip-val">{c.value}</span>
                        </span>
                      ))}
                    </div>
                  )}
                  <p className="rp-snapshot-body">{data.snapshot}</p>
                </div>

                <div className="rp-tile rp-tile-full">
                  <div className="rp-tile-header"><span className="rp-tile-label">TRADE PROFILE</span></div>
                  <FreightBar ocean={data.freightOcean ?? 60} air={data.freightAir ?? 30} land={data.freightLand ?? 10} />
                  <p className="rp-trade-body">{data.tradeProfile}</p>
                </div>

                <div className="rp-tile rp-tile-half">
                  <div className="rp-tile-header"><span className="rp-tile-label">URGENCY SCORE</span></div>
                  <div className="rp-urgency-wrap">
                    {data.urgencyScore != null && <UrgencyRing score={data.urgencyScore} />}
                    {whyNow.length > 0 && (
                      <ul className="rp-why-list">
                        {whyNow.map((b, i) => <li key={i} className="rp-why-item">{b}</li>)}
                      </ul>
                    )}
                  </div>
                </div>

                <div className="rp-tile rp-tile-half rp-tile-hook">
                  <div className="rp-tile-header">
                    <span className="rp-tile-label">OPENING HOOK</span>
                    <button className="rp-copy-btn" onClick={copyHook}>
                      {copied ? <RiCheckLine size={13} /> : <RiFileCopyLine size={13} />}
                      <span>{copied ? 'COPIED' : 'COPY'}</span>
                    </button>
                  </div>
                  <blockquote className="rp-hook-text">"{data.openingHook}"</blockquote>
                </div>

                <div className="rp-tile rp-tile-full">
                  <div className="rp-tile-header"><span className="rp-tile-label">RECENT SIGNALS</span></div>
                  {signals.length > 0 ? (
                    <div className="rp-signals">
                      {signals.map((s, i) => {
                        const tone = signalTone(s);
                        return (
                          <div key={i} className={`rp-signal rp-signal-${tone}`}>
                            <span className="rp-signal-dot" />
                            <span className="rp-signal-text">{s}</span>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="rp-unavailable"><span className="rp-unavailable-dot" />no recent signals found</div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>

      </div>
    </div>
  );
}
