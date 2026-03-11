// frontend/src/components/LiveCallModal.jsx
import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  RiPhoneLine, RiPhoneFill, RiSearchLine, RiLightbulbLine,
  RiCloseLine, RiFileTextLine, RiFlashlightLine, RiTimerLine,
  RiAddCircleLine, RiUser3Line, RiMailSendLine,
  RiMicLine, RiMicOffLine,
} from 'react-icons/ri';
import './LiveCallModal.css';

const API = import.meta.env.VITE_API_URL || 'http://localhost:5001';

const QUICK_OBJECTIONS = [
  'We already have a forwarder',
  "Rates seem too high",
  "Not the right time",
  "Need to talk to my boss",
];

function formatTime(s) {
  return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
}

export default function LiveCallModal({ isOpen, onClose, initialProspect = null, onAddToPipeline, onOpenOutreach, onEndCall }) {
  const navigate = useNavigate();

  const [mode, setMode] = useState('search');
  const [prospect, setProspect] = useState(null);
  const [accountData, setAccountData] = useState(null);

  // Search
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [searchLoading, setSearchLoading] = useState(false);

  // Timer
  const [elapsed, setElapsed] = useState(0);
  const [timerRunning, setTimerRunning] = useState(false);

  // Talk track
  const [callPrep, setCallPrep] = useState(null);
  const [callPrepLoading, setCallPrepLoading] = useState(false);

  // Objection
  const [objText, setObjText] = useState('');
  const [objResp, setObjResp] = useState(null);
  const [objLoading, setObjLoading] = useState(false);

  // Capture
  const [notes, setNotes] = useState('');
  const [pipelined, setPipelined] = useState(false);

  // Microphone AI
  const [micActive, setMicActive] = useState(false);
  const [micTranscript, setMicTranscript] = useState('');
  const [micPrediction, setMicPrediction] = useState(null);
  const recognitionRef = useRef(null);
  const predictTimerRef = useRef(null);
  const transcriptRef = useRef('');

  // Reset when modal opens or initialProspect changes
  useEffect(() => {
    // Always stop mic when modal state changes
    recognitionRef.current?.stop();
    clearInterval(predictTimerRef.current);
    setMicActive(false);
    setMicPrediction(null);
    setMicTranscript('');
    transcriptRef.current = '';

    if (!isOpen) return;
    setAccountData(null);
    setQuery('');
    setResults([]);
    setElapsed(0);
    setTimerRunning(false);
    setCallPrep(null);
    setObjText('');
    setObjResp(null);
    setNotes('');
    setPipelined(false);

    if (initialProspect) {
      setProspect(initialProspect);
      setMode('call');
      setTimerRunning(true);
    } else {
      setProspect(null);
      setMode('search');
    }
  }, [isOpen, initialProspect]);

  // Load account data when prospect is set
  useEffect(() => {
    if (!prospect) return;
    fetch(`${API}/api/account360/${prospect.id}`)
      .then(r => r.json())
      .then(d => setAccountData(d))
      .catch(() => {});
  }, [prospect]);

  // Timer
  useEffect(() => {
    if (!timerRunning) return;
    const id = setInterval(() => setElapsed(e => e + 1), 1000);
    return () => clearInterval(id);
  }, [timerRunning]);

  // Search debounce
  useEffect(() => {
    if (!query || query.length < 2) { setResults([]); return; }
    setSearchLoading(true);
    const t = setTimeout(() => {
      fetch(`${API}/api/prospects?search=${encodeURIComponent(query)}&limit=6`)
        .then(r => r.json())
        .then(d => setResults(Array.isArray(d) ? d : []))
        .catch(() => {})
        .finally(() => setSearchLoading(false));
    }, 300);
    return () => clearTimeout(t);
  }, [query]);

  const selectProspect = (p) => {
    setProspect(p);
    setMode('call');
    setTimerRunning(true);
  };

  const generateCallPrep = async () => {
    if (!prospect) return;
    setCallPrepLoading(true);
    try {
      const aiModel = localStorage.getItem('sdr_ai_model') || 'gpt-4.1-mini';
      const r = await fetch(`${API}/api/call-prep`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ companyName: prospect.name, prospectData: prospect, model: aiModel }),
      });
      setCallPrep(await r.json());
    } catch {} finally { setCallPrepLoading(false); }
  };

  const handleObjection = async (text) => {
    setObjText(text);
    setObjLoading(true); setObjResp(null);
    try {
      const aiModel = localStorage.getItem('sdr_ai_model') || 'gpt-4.1-mini';
      const r = await fetch(`${API}/api/objection`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ objection: text, companyName: prospect?.name, model: aiModel }),
      });
      setObjResp(await r.json());
    } catch {} finally { setObjLoading(false); }
  };

  const addToPipeline = async () => {
    if (!prospect || pipelined) return;
    await fetch(`${API}/api/pipeline`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prospect_id: prospect.id, company_name: prospect.name, stage: 'called' }),
    }).catch(() => {});
    setPipelined(true);
    onAddToPipeline?.();
  };

  const endCall = () => {
    setTimerRunning(false);
    if (onEndCall && prospect) {
      onEndCall({ prospectId: prospect.id, notes: notes.trim(), timestamp: Date.now() });
    }
    onClose();
  };

  const toggleMic = () => {
    if (micActive) {
      recognitionRef.current?.stop();
      clearInterval(predictTimerRef.current);
      setMicActive(false);
      return;
    }
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      alert('Speech recognition is not supported in this browser. Use Chrome or Edge.');
      return;
    }
    const recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = 'en-US';
    recognitionRef.current = recognition;

    recognition.onresult = (event) => {
      const transcript = Array.from(event.results)
        .map(r => r[0].transcript)
        .join(' ');
      transcriptRef.current = transcript;
      setMicTranscript(transcript);
    };

    recognition.onerror = () => { setMicActive(false); };
    recognition.onend = () => {
      // Auto-restart on end if still active (Chrome stops after ~60s silence)
      if (recognitionRef.current && micActive) {
        try { recognitionRef.current.start(); } catch (_) {}
      }
    };

    recognition.start();
    setMicActive(true);

    const freqMs = parseInt(localStorage.getItem('sdr_mic_frequency') || '20', 10) * 1000;
    predictTimerRef.current = setInterval(async () => {
      const currentTranscript = transcriptRef.current;
      if (!currentTranscript.trim() || !prospect) return;
      try {
        const aiModel = localStorage.getItem('sdr_ai_model') || 'gpt-4.1-mini';
        const r = await fetch(`${API}/api/call-predict`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ transcript: currentTranscript, companyName: prospect?.name, model: aiModel }),
        });
        if (r.ok) setMicPrediction(await r.json());
      } catch (_) {}
    }, freqMs);
  };

  if (!isOpen) return null;

  const p = prospect;

  return (
    <div className="lcm-overlay" onClick={endCall}>
      <div className="lcm-modal" onClick={e => e.stopPropagation()}>

        {/* Header */}
        <div className="lcm-header">
          <div className="lcm-header-left">
            <span className={`lcm-phone-icon ${mode === 'call' && timerRunning ? 'active' : ''}`}>
              <RiPhoneLine size={15} />
            </span>
            <span className="lcm-title">
              {mode === 'search' ? 'Live Call Mode' : `Live Call — ${p?.name}`}
            </span>
            {mode === 'call' && (
              <span className="lcm-timer">{formatTime(elapsed)}</span>
            )}
          </div>
          <div className="lcm-header-right">
            {mode === 'call' && (
              <>
                <button
                  className={`lcm-timer-btn ${timerRunning ? 'running' : ''}`}
                  onClick={() => setTimerRunning(t => !t)}
                >
                  <RiTimerLine size={13} /> {timerRunning ? 'Pause' : 'Resume'}
                </button>
                <button className="lcm-end-btn" onClick={endCall}>
                  <RiPhoneFill size={13} /> End Call
                </button>
              </>
            )}
            <button className="lcm-close" onClick={onClose} aria-label="Close"><RiCloseLine size={18} /></button>
          </div>
        </div>

        {/* Search Mode */}
        {mode === 'search' && (
          <div className="lcm-search-mode">
            <p className="lcm-search-hint">Search for a prospect to start your live call session.</p>
            <div className="lcm-search-wrap">
              <RiSearchLine size={15} className="lcm-search-icon" />
              <input
                className="lcm-search-input"
                placeholder="Type company or prospect name..."
                value={query}
                onChange={e => setQuery(e.target.value)}
                autoFocus
              />
            </div>
            {searchLoading && <div className="lcm-search-status">Searching...</div>}
            {results.length > 0 && (
              <div className="lcm-search-results">
                {results.map(r => (
                  <div key={r.id} className="lcm-result-row" onClick={() => selectProspect(r)}>
                    <div className="lcm-result-info">
                      <span className="lcm-result-name">{r.name}</span>
                      <span className="lcm-result-meta">{r.sector} · {r.hq_location}</span>
                    </div>
                    <span className="lcm-result-icp">ICP {r.icp_score}</span>
                    <button className="lcm-result-call-btn">
                      <RiPhoneLine size={11} /> Start Call
                    </button>
                  </div>
                ))}
              </div>
            )}
            {query.length >= 2 && !searchLoading && results.length === 0 && (
              <div className="lcm-search-status">No prospects found for "{query}"</div>
            )}
          </div>
        )}

        {/* Active Call Mode */}
        {mode === 'call' && p && (
          <div className="lcm-body">

            {/* Left: Context */}
            <div className="lcm-panel lcm-context">
              <div className="lcm-panel-title">Prospect Context</div>
              <div className="lcm-context-card">
                <div className="lcm-co-name">{p.name}</div>
                <div className="lcm-co-meta">{p.sector} · {p.hq_location}</div>
                <div className="lcm-chips">
                  {p.icp_score && <span className="lcm-chip icp">ICP {p.icp_score}</span>}
                  {p.shipping_volume_estimate && <span className="lcm-chip">{p.shipping_volume_estimate}</span>}
                  {p.likely_forwarder && <span className="lcm-chip fwd">Fwd: {p.likely_forwarder}</span>}
                </div>
              </div>

              {p.import_origins?.length > 0 && (
                <div className="lcm-fact-block">
                  <div className="lcm-fact-label">Import Origins</div>
                  <div className="lcm-fact-tags">
                    {p.import_origins.slice(0, 4).map(o => (
                      <span key={o} className="lcm-fact-tag">{o}</span>
                    ))}
                  </div>
                </div>
              )}

              {p.primary_lanes?.length > 0 && (
                <div className="lcm-fact-block">
                  <div className="lcm-fact-label">Primary Lanes</div>
                  <div className="lcm-fact-tags">
                    {p.primary_lanes.slice(0, 3).map(l => (
                      <span key={l} className="lcm-fact-tag lane">{l}</span>
                    ))}
                  </div>
                </div>
              )}

              {accountData?.news?.length > 0 && (
                <div className="lcm-fact-block">
                  <div className="lcm-fact-label">Recent Signals</div>
                  {accountData.news.slice(0, 3).map((n, i) => (
                    <div key={i} className="lcm-signal-item">
                      <span className="lcm-signal-dot" />
                      <span className="lcm-signal-text">
                        {n.title?.length > 90 ? n.title.slice(0, 90) + '…' : n.title}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Center: Talk Track + Objection Handler */}
            <div className="lcm-panel lcm-talk-track">
              <div className="lcm-panel-title">Talk Track</div>

              {!callPrep && (
                <div className="lcm-gen-row">
                  <button className="lcm-gen-btn" onClick={generateCallPrep} disabled={callPrepLoading}>
                    <RiFlashlightLine size={13} />
                    {callPrepLoading ? 'Generating talk track...' : 'Generate Talk Track'}
                  </button>
                  <button
                    className={`lcm-mic-btn${micActive ? ' active' : ''}`}
                    onClick={toggleMic}
                    title={micActive ? 'Stop AI listening' : 'Start AI listening — AI predicts what to say next'}
                  >
                    {micActive ? <RiMicLine size={15} /> : <RiMicOffLine size={15} />}
                  </button>
                </div>
              )}

              {callPrep && (
                <>
                <button
                  className={`lcm-mic-btn${micActive ? ' active' : ''}`}
                  onClick={toggleMic}
                  style={{ marginBottom: 8 }}
                  title={micActive ? 'Stop AI listening' : 'Start AI listening'}
                >
                  {micActive ? <RiMicLine size={15} /> : <RiMicOffLine size={15} />}
                  <span style={{ fontSize: 11, marginLeft: 6 }}>{micActive ? 'AI Listening...' : 'Start AI Listening'}</span>
                </button>
                <div className="lcm-talk-content">
                  {callPrep.opening_hook && (
                    <div className="lcm-talk-block">
                      <div className="lcm-talk-label">Opening Hook</div>
                      <p className="lcm-hook">"{callPrep.opening_hook}"</p>
                    </div>
                  )}
                  {callPrep.discovery_questions?.length > 0 && (
                    <div className="lcm-talk-block">
                      <div className="lcm-talk-label">Discovery Questions</div>
                      <ol className="lcm-dq-list">
                        {callPrep.discovery_questions.slice(0, 4).map((q, i) => (
                          <li key={i}>{q}</li>
                        ))}
                      </ol>
                    </div>
                  )}
                </div>
                </>
              )}

              {/* Objection Handler */}
              <div className="lcm-obj-section">
                <div className="lcm-panel-title lcm-obj-title">Objection Handler</div>
                <div className="lcm-obj-quick">
                  {QUICK_OBJECTIONS.map(q => (
                    <button key={q} className="lcm-obj-btn" onClick={() => handleObjection(q)}>{q}</button>
                  ))}
                </div>
                <div className="lcm-obj-input-row">
                  <input
                    className="lcm-obj-input"
                    placeholder="Type custom objection..."
                    value={objText}
                    onChange={e => setObjText(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && objText && handleObjection(objText)}
                  />
                  <button className="lcm-obj-send" onClick={() => objText && handleObjection(objText)} disabled={objLoading}>
                    {objLoading ? '…' : '→'}
                  </button>
                </div>
                {objResp && (
                  <div className="lcm-obj-response">
                    <p className="lcm-obj-counter">{objResp.response}</p>
                    {objResp.follow_up_question && (
                      <p className="lcm-obj-followup">
                        <RiLightbulbLine size={12} style={{ verticalAlign: 'middle', marginRight: 4 }} />
                        "{objResp.follow_up_question}"
                      </p>
                    )}
                  </div>
                )}
              </div>

              {/* Mic status indicator */}
              {micActive && (
                <div className="lcm-mic-status">
                  <RiMicLine size={10} className="lcm-mic-pulse" />
                  Listening
                  {micTranscript && (
                    <span className="lcm-mic-excerpt">
                      …{micTranscript.slice(-80)}
                    </span>
                  )}
                </div>
              )}

              {/* AI Prediction output */}
              {micPrediction && !micPrediction.error && (
                <div className="lcm-prediction-card">
                  <div className="lcm-prediction-header">AI Prediction</div>
                  {micPrediction.prediction && (
                    <p className="lcm-prediction-body">{micPrediction.prediction}</p>
                  )}
                  {micPrediction.suggested_response && (
                    <div className="lcm-prediction-say">
                      <span className="lcm-say-label">Say: </span>
                      "{micPrediction.suggested_response}"
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Right: Capture + Actions */}
            <div className="lcm-panel lcm-capture">
              <div className="lcm-panel-title">Call Capture</div>
              <textarea
                className="lcm-notes"
                placeholder="Real-time call notes..."
                value={notes}
                onChange={e => setNotes(e.target.value)}
                rows={8}
              />

              <div className="lcm-actions">
                <button
                  className={`lcm-action-btn ${pipelined ? 'done' : 'primary'}`}
                  onClick={addToPipeline}
                  disabled={pipelined}
                >
                  <RiAddCircleLine size={13} />
                  {pipelined ? 'In Pipeline' : 'Add to Pipeline'}
                </button>
                <button
                  className="lcm-action-btn"
                  onClick={() => { endCall(); navigate(`/account/${p.id}`); }}
                >
                  <RiUser3Line size={13} />
                  Full Profile
                </button>
                {onOpenOutreach && (
                  <button
                    className="lcm-action-btn"
                    onClick={() => { endCall(); onOpenOutreach(p, null); }}
                  >
                    <RiMailSendLine size={13} />
                    Outreach
                  </button>
                )}
                <button
                  className="lcm-action-btn secondary"
                  onClick={() => setMode('search')}
                >
                  <RiSearchLine size={13} />
                  Switch Prospect
                </button>
              </div>
            </div>

          </div>
        )}
      </div>
    </div>
  );
}
