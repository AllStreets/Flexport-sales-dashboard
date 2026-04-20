// frontend/src/pages/AutonomousPanel.jsx
import { useState, useEffect, useRef } from 'react';

const API = import.meta.env.VITE_API_URL || 'http://localhost:5001';

const C = {
  bg:'#060b18', bgElev:'#0d1220', surface:'#111827', border:'#1f2d40', borderHover:'#2d3f58',
  accent:'#00d4ff', accentDim:'#00d4ff22', accentSoft:'#00d4ff0d', accentGlow:'#00d4ff44',
  text:'#e8eaf0', textStrong:'#ffffff', textMuted:'#6b7280', textDim:'#9ca3af',
  amber:'#fbbf24', amberDim:'#fbbf2422', orange:'#fb923c', orangeDim:'#fb923c22',
  blue:'#60a5fa', blueDim:'#60a5fa22', rose:'#fb7185', roseDim:'#fb718522', green:'#4ade80',
  greenDim:'#4ade8022',
};

function Label({ children, color }) {
  return <div style={{ fontSize:10, fontWeight:700, letterSpacing:'0.14em', color: color || C.textMuted, fontFamily:"'JetBrains Mono', monospace", marginBottom:6 }}>{children}</div>;
}

function Stat({ label, value, color }) {
  return (
    <div style={{ background:C.surface, border:`1px solid ${C.border}`, borderRadius:8, padding:'12px 16px', flex:1, minWidth:0 }}>
      <div style={{ fontSize:10, color:C.textMuted, letterSpacing:'0.12em', fontFamily:"'JetBrains Mono', monospace", marginBottom:4 }}>{label}</div>
      <div style={{ fontSize:26, fontWeight:700, color: color || C.textStrong, fontFamily:"'JetBrains Mono', monospace", lineHeight:1 }}>{value ?? '—'}</div>
    </div>
  );
}

function StatusDot({ active }) {
  return <span style={{ display:'inline-block', width:7, height:7, borderRadius:'50%', background: active ? C.green : C.rose, boxShadow: active ? `0 0 6px ${C.green}` : 'none', marginRight:6 }} />;
}

function ScoreBadge({ score }) {
  const color = score >= 9 ? C.green : score >= 7 ? C.amber : score >= 5 ? C.orange : C.textMuted;
  return (
    <span style={{ fontFamily:"'JetBrains Mono', monospace", fontSize:13, fontWeight:700, color, minWidth:20, display:'inline-block', textAlign:'center' }}>{score ?? '?'}</span>
  );
}

function TouchBadge({ n }) {
  const labels = { 1:'T1', 2:'T2', 3:'T3' };
  const colors = { 1: C.blue, 2: C.amber, 3: C.rose };
  return (
    <span style={{ fontSize:9, fontWeight:700, letterSpacing:'0.1em', color: colors[n] || C.textMuted, border:`1px solid ${colors[n] || C.border}`, borderRadius:3, padding:'1px 5px', fontFamily:"'JetBrains Mono', monospace" }}>
      {labels[n] || `T${n}`}
    </span>
  );
}

const STATUS_COLOR = { draft: C.accent, sent: C.blue, replied: C.green, deleted: C.textMuted, error: C.rose, skipped: C.textMuted };
const STATUS_LABEL = { draft: 'DRAFT', sent: 'SENT', replied: 'REPLIED', deleted: 'DELETED', error: 'ERROR', skipped: 'SKIPPED' };

export default function AutonomousPanel() {
  const [status, setStatus] = useState(null);
  const [jobs, setJobs] = useState([]);
  const [drafts, setDrafts] = useState([]);
  const [queue, setQueue] = useState([]);
  const [draftTab, setDraftTab] = useState('draft');
  const [expandedDraft, setExpandedDraft] = useState(null);
  const [expandedJob, setExpandedJob] = useState(null);
  const [configOpen, setConfigOpen] = useState(false);
  const [jobsOpen, setJobsOpen] = useState(false);
  const [queueInput, setQueueInput] = useState('');
  const [addingToQueue, setAddingToQueue] = useState(false);
  const [runLog, setRunLog] = useState([]);
  const [running, setRunning] = useState(false);
  const [followingUp, setFollowingUp] = useState(null);
  const [polling, setPolling] = useState(false);
  const runLogRef = useRef(null);

  const load = async () => {
    try {
      const [s, j, d, q] = await Promise.all([
        fetch(`${API}/api/agent/status`).then(r => r.json()).catch(() => null),
        fetch(`${API}/api/agent/jobs?limit=10`).then(r => r.json()).catch(() => []),
        fetch(`${API}/api/agent/drafts`).then(r => r.json()).catch(() => []),
        fetch(`${API}/api/agent/queue`).then(r => r.json()).catch(() => []),
      ]);
      if (s) setStatus(s);
      if (Array.isArray(j)) setJobs(j);
      if (Array.isArray(d)) setDrafts(d);
      if (Array.isArray(q)) setQueue(q);
    } catch {}
  };

  useEffect(() => {
    load();
    const interval = setInterval(load, 30000);
    return () => clearInterval(interval);
  }, []);

  // Poll faster when a job is running
  useEffect(() => {
    const runningJob = jobs.find(j => j.status === 'running');
    if (!runningJob) return;
    const interval = setInterval(load, 5000);
    return () => clearInterval(interval);
  }, [jobs]);

  // Scroll run log to bottom
  useEffect(() => {
    if (runLogRef.current) runLogRef.current.scrollTop = runLogRef.current.scrollHeight;
  }, [runLog]);

  const toggleAgent = async () => {
    if (!status) return;
    const newVal = status.enabled ? '0' : '1';
    await fetch(`${API}/api/agent/config`, {
      method: 'PUT', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ key: 'enabled', value: newVal }),
    });
    setStatus(s => ({ ...s, enabled: newVal === '1' }));
  };

  const updateConfig = async (key, value) => {
    await fetch(`${API}/api/agent/config`, {
      method: 'PUT', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ key, value }),
    });
    setStatus(s => s ? { ...s, config: { ...s.config, [key]: typeof value === 'number' ? value : parseInt(value) || value } } : s);
  };

  const addToQueue = async () => {
    const companies = queueInput.split('\n').map(c => c.trim()).filter(c => c.length > 1);
    if (!companies.length) return;
    setAddingToQueue(true);
    await fetch(`${API}/api/agent/queue/add`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ companies }),
    });
    setQueueInput('');
    setAddingToQueue(false);
    load();
  };

  const removeFromQueue = async (id) => {
    await fetch(`${API}/api/agent/queue/${id}`, { method: 'DELETE' });
    setQueue(prev => prev.filter(q => q.id !== id));
  };

  const runNow = async () => {
    if (running) return;
    setRunning(true);
    setRunLog([]);
    try {
      const res = await fetch(`${API}/api/agent/run`, { method: 'POST' });
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buf = '';
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += decoder.decode(value, { stream: true });
        const lines = buf.split('\n');
        buf = lines.pop();
        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const obj = JSON.parse(line.slice(6));
              const msg = formatProgressMessage(obj);
              if (msg) setRunLog(prev => [...prev, msg]);
            } catch {}
          }
        }
      }
    } catch (e) {
      setRunLog(prev => [...prev, `Error: ${e.message}`]);
    }
    setRunning(false);
    load();
  };

  const pollReplies = async () => {
    setPolling(true);
    try {
      const res = await fetch(`${API}/api/agent/poll-replies`, { method: 'POST' });
      const data = await res.json();
      setRunLog(prev => [...prev, `Reply poll: checked ${data.checked}, found ${data.replies} replies`]);
      load();
    } catch {}
    setPolling(false);
  };

  const generateFollowUp = async (draftId) => {
    setFollowingUp(draftId);
    try {
      const res = await fetch(`${API}/api/agent/drafts/${draftId}/followup`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({}) });
      if (res.ok) load();
    } catch {}
    setFollowingUp(null);
  };

  function formatProgressMessage(obj) {
    if (!obj) return null;
    if (obj.step === 'start') return `[${obj.index}/${obj.total}] Starting: ${obj.company}`;
    if (obj.step === 'research') return `  Researching ${obj.company}...`;
    if (obj.step === 'draft') return `  Drafting for ${obj.company} (fit: ${obj.score})`;
    if (obj.step === 'done') return `  Done: ${obj.company} — score ${obj.score}${obj.gmail ? ' · Gmail draft created' : ' · saved locally'}`;
    if (obj.step === 'skipped') return `  Skipped: ${obj.company} — score ${obj.score} (below threshold)`;
    if (obj.step === 'error') return `  Error: ${obj.company} — ${obj.error}`;
    if (obj.type === 'complete') return `\nBatch complete — drafted:${obj.drafted} skipped:${obj.skipped} errors:${obj.errors}`;
    if (obj.type === 'error') return `Error: ${obj.error}`;
    return null;
  }

  const filteredDrafts = drafts.filter(d => d.status === draftTab);
  const queuePending = queue.filter(q => q.status === 'pending');
  const queueDone = queue.filter(q => q.status === 'done');
  const queueErrors = queue.filter(q => q.status === 'error');

  const gmailConnected = status?.gmail?.connected;
  const agentEnabled = status?.enabled;
  const dc = status?.draft_counts || {};

  return (
    <div style={{ display:'flex', flexDirection:'column', gap:16 }}>

      {/* ── Status bar ───────────────────────────────────────────────────── */}
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'12px 16px', background:C.surface, border:`1px solid ${C.border}`, borderRadius:10 }}>
        <div style={{ display:'flex', alignItems:'center', gap:20 }}>
          <div style={{ display:'flex', alignItems:'center' }}>
            <StatusDot active={gmailConnected} />
            <span style={{ fontSize:11, color: gmailConnected ? C.green : C.textMuted, fontFamily:"'JetBrains Mono', monospace" }}>
              {gmailConnected ? status.gmail.email || 'Gmail connected' : 'Gmail not connected'}
            </span>
          </div>
          {status?.last_job && (
            <span style={{ fontSize:10, color:C.textMuted, fontFamily:"'JetBrains Mono', monospace" }}>
              Last run: {new Date(status.last_job.created_at).toLocaleDateString('en-US', { month:'short', day:'numeric', hour:'2-digit', minute:'2-digit' })}
              {status.last_job.result_summary ? ` · ${(() => { try { const s = JSON.parse(status.last_job.result_summary); return `${s.drafted} drafted`; } catch { return ''; } })()}` : ''}
            </span>
          )}
        </div>

        <div style={{ display:'flex', alignItems:'center', gap:8 }}>
          {!gmailConnected ? (
            <a href={`${API}/api/agent/oauth/start`}
              style={{ padding:'6px 12px', border:`1px solid ${C.accent}`, background:C.accentDim, color:C.accent, textDecoration:'none', fontSize:10, fontWeight:700, letterSpacing:'0.1em', fontFamily:'inherit', borderRadius:4 }}>
              CONNECT GMAIL
            </a>
          ) : (
            <button onClick={toggleAgent}
              style={{ padding:'6px 12px', border:`1px solid ${agentEnabled ? C.green : C.border}`, background: agentEnabled ? C.greenDim : 'transparent', color: agentEnabled ? C.green : C.textMuted, fontSize:10, fontWeight:700, letterSpacing:'0.1em', fontFamily:'inherit', cursor:'pointer', borderRadius:4 }}>
              {agentEnabled ? 'AGENT ACTIVE' : 'AGENT PAUSED'}
            </button>
          )}
          <button onClick={runNow} disabled={running}
            style={{ padding:'6px 12px', border:`1px solid ${running ? C.border : C.amber}`, background: running ? 'transparent' : C.amberDim, color: running ? C.textMuted : C.amber, cursor: running ? 'not-allowed' : 'pointer', fontSize:10, fontWeight:700, letterSpacing:'0.1em', fontFamily:'inherit', borderRadius:4 }}>
            {running ? 'RUNNING...' : 'RUN NOW'}
          </button>
          <button onClick={pollReplies} disabled={polling}
            style={{ padding:'6px 12px', border:`1px solid ${C.border}`, background:'transparent', color:C.textMuted, cursor: polling ? 'not-allowed' : 'pointer', fontSize:10, fontWeight:700, letterSpacing:'0.1em', fontFamily:'inherit', borderRadius:4 }}>
            {polling ? 'POLLING...' : 'POLL REPLIES'}
          </button>
        </div>
      </div>

      {/* ── Gmail setup notice ───────────────────────────────────────────── */}
      {!gmailConnected && (
        <div style={{ padding:'14px 16px', background:'#1a1000', border:`1px solid ${C.amber}33`, borderRadius:8, fontSize:12, color:C.amber, lineHeight:1.6 }}>
          <strong>Setup required:</strong> Connect Gmail to create draft emails automatically. Emails will <strong>never send without your approval</strong> — they appear as drafts in your Gmail inbox. You click Send when ready.
          <br /><br />
          You also need to add <code style={{ background:'#ffffff11', padding:'1px 5px', borderRadius:3 }}>GMAIL_CLIENT_ID</code> and <code style={{ background:'#ffffff11', padding:'1px 5px', borderRadius:3 }}>GMAIL_CLIENT_SECRET</code> to your backend <code style={{ background:'#ffffff11', padding:'1px 5px', borderRadius:3 }}>.env</code>. Get these from Google Cloud Console → APIs &amp; Services → Credentials → OAuth2 Client. Scopes: <code style={{ background:'#ffffff11', padding:'1px 5px', borderRadius:3 }}>gmail.compose</code> + <code style={{ background:'#ffffff11', padding:'1px 5px', borderRadius:3 }}>gmail.readonly</code>.
        </div>
      )}

      {/* ── Stats row ────────────────────────────────────────────────────── */}
      <div style={{ display:'flex', gap:10 }}>
        <Stat label="DRAFTS" value={dc.draft || 0} color={C.accent} />
        <Stat label="SENT" value={dc.sent || 0} color={C.blue} />
        <Stat label="REPLIED" value={dc.replied || 0} color={C.green} />
        <Stat label="IN QUEUE" value={status?.queue_counts?.pending || 0} color={C.amber} />
        <Stat label="SKIPPED" value={status?.queue_counts?.skipped || 0} color={C.textMuted} />
      </div>

      {/* ── Add to queue ─────────────────────────────────────────────────── */}
      <div style={{ padding:'16px', background:C.surface, border:`1px solid ${C.border}`, borderRadius:10 }}>
        <Label>ADD TO AUTONOMOUS QUEUE · ONE COMPANY PER LINE</Label>
        <div style={{ display:'flex', gap:8, alignItems:'flex-start' }}>
          <textarea value={queueInput} onChange={e => setQueueInput(e.target.value)}
            placeholder={"Patagonia\nAllbirds\nWarby Parker"}
            rows={3}
            style={{ flex:1, background:C.bgElev, border:`1px solid ${C.border}`, color:C.text, padding:'10px 12px', borderRadius:6, fontSize:13, outline:'none', fontFamily:"'JetBrains Mono', monospace", resize:'vertical', lineHeight:1.5 }} />
          <button onClick={addToQueue} disabled={!queueInput.trim() || addingToQueue}
            style={{ padding:'10px 14px', borderRadius:6, border:`1px solid ${!queueInput.trim() ? C.border : C.accent}`, background: !queueInput.trim() ? 'transparent' : C.accentDim, color: !queueInput.trim() ? C.textMuted : C.accent, cursor: !queueInput.trim() ? 'not-allowed' : 'pointer', fontSize:11, fontWeight:700, letterSpacing:'0.1em', fontFamily:'inherit', whiteSpace:'nowrap' }}>
            ADD TO<br />QUEUE
          </button>
        </div>
        <div style={{ marginTop:8, fontSize:10, color:C.textMuted, fontFamily:"'JetBrains Mono', monospace" }}>
          Runs automatically Mon–Fri at 08:00 · gpt-4.1-mini for scoring · gpt-4.1 for high-fit prospects (score ≥ {status?.config?.high_fit_min ?? 9})
        </div>
      </div>

      {/* ── Run log ──────────────────────────────────────────────────────── */}
      {runLog.length > 0 && (
        <div style={{ padding:'12px 14px', background:C.bgElev, border:`1px solid ${C.border}`, borderRadius:8 }}>
          <Label color={running ? C.amber : C.green}>{running ? 'RUNNING' : 'LAST RUN LOG'}</Label>
          <div ref={runLogRef} style={{ fontFamily:"'JetBrains Mono', monospace", fontSize:11, color:C.textDim, lineHeight:1.8, maxHeight:160, overflowY:'auto', whiteSpace:'pre-wrap' }}>
            {runLog.map((line, i) => (
              <div key={i} style={{ color: line.includes('Error') ? C.rose : line.includes('complete') ? C.green : line.includes('Done') ? C.accent : C.textDim }}>{line}</div>
            ))}
          </div>
        </div>
      )}

      {/* ── Queue overview ───────────────────────────────────────────────── */}
      {queuePending.length > 0 && (
        <div style={{ background:C.surface, border:`1px solid ${C.border}`, borderRadius:10, overflow:'hidden' }}>
          <div style={{ padding:'10px 14px', borderBottom:`1px solid ${C.border}` }}>
            <Label color={C.amber}>PENDING QUEUE · {queuePending.length} COMPANIES</Label>
          </div>
          <div style={{ maxHeight:180, overflowY:'auto' }}>
            {queuePending.map(item => (
              <div key={item.id} style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'8px 14px', borderBottom:`1px solid ${C.border}33` }}>
                <span style={{ fontSize:13, color:C.text }}>{item.company_name}</span>
                <div style={{ display:'flex', gap:8, alignItems:'center' }}>
                  {item.sector && <span style={{ fontSize:10, color:C.textMuted, fontFamily:"'JetBrains Mono', monospace" }}>{item.sector}</span>}
                  <button onClick={() => removeFromQueue(item.id)}
                    style={{ padding:'2px 8px', border:`1px solid ${C.border}`, background:'transparent', color:C.textMuted, cursor:'pointer', fontSize:10, fontFamily:'inherit', borderRadius:3 }}>
                    REMOVE
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Draft inbox ──────────────────────────────────────────────────── */}
      <div style={{ background:C.surface, border:`1px solid ${C.border}`, borderRadius:10, overflow:'hidden' }}>
        <div style={{ padding:'12px 14px', borderBottom:`1px solid ${C.border}`, display:'flex', alignItems:'center', justifyContent:'space-between' }}>
          <Label>DRAFT INBOX</Label>
          <div style={{ display:'flex', gap:0 }}>
            {[['draft','DRAFTS'], ['sent','SENT'], ['replied','REPLIED'], ['deleted','DELETED']].map(([id, label]) => (
              <button key={id} onClick={() => setDraftTab(id)}
                style={{ padding:'4px 10px', background:'transparent', border:'none', borderBottom:`2px solid ${draftTab === id ? STATUS_COLOR[id] : 'transparent'}`, color: draftTab === id ? STATUS_COLOR[id] : C.textMuted, cursor:'pointer', fontSize:10, fontWeight:700, letterSpacing:'0.1em', fontFamily:"'JetBrains Mono', monospace" }}>
                {label}{dc[id] > 0 ? ` · ${dc[id]}` : ''}
              </button>
            ))}
          </div>
        </div>

        {filteredDrafts.length === 0 ? (
          <div style={{ padding:'32px', textAlign:'center', color:C.textMuted, fontSize:12 }}>
            {draftTab === 'draft' ? 'No drafts yet — add companies to the queue and run the agent.' : `No ${draftTab} emails.`}
          </div>
        ) : (
          <div>
            {filteredDrafts.map(draft => (
              <div key={draft.id} style={{ borderBottom:`1px solid ${C.border}33` }}>
                <div
                  onClick={() => setExpandedDraft(expandedDraft === draft.id ? null : draft.id)}
                  style={{ padding:'12px 14px', display:'flex', alignItems:'center', gap:12, cursor:'pointer' }}
                >
                  <ScoreBadge score={queue.find(q => q.id === draft.queue_id)?.fit_score} />
                  <div style={{ flex:1, minWidth:0 }}>
                    <div style={{ fontSize:13, color:C.textStrong, fontWeight:600, marginBottom:2 }}>{draft.company_name}</div>
                    <div style={{ fontSize:11, color:C.textMuted, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{draft.subject}</div>
                  </div>
                  <div style={{ display:'flex', alignItems:'center', gap:8, flexShrink:0 }}>
                    <TouchBadge n={draft.touch_number} />
                    {draft.gmail_draft_id && (
                      <span style={{ fontSize:9, color:C.green, border:`1px solid ${C.green}44`, borderRadius:3, padding:'1px 5px', fontFamily:"'JetBrains Mono', monospace" }}>GMAIL</span>
                    )}
                    <span style={{ fontSize:9, fontWeight:700, letterSpacing:'0.1em', color: STATUS_COLOR[draft.status], fontFamily:"'JetBrains Mono', monospace" }}>{STATUS_LABEL[draft.status]}</span>
                    <span style={{ fontSize:10, color:C.textMuted }}>{new Date(draft.created_at).toLocaleDateString('en-US', { month:'short', day:'numeric' })}</span>
                    <span style={{ color:C.textMuted, fontSize:12, transform: expandedDraft === draft.id ? 'rotate(90deg)' : 'none', transition:'transform 0.15s', display:'inline-block' }}>›</span>
                  </div>
                </div>

                {expandedDraft === draft.id && (
                  <div style={{ padding:'0 14px 14px', borderTop:`1px solid ${C.border}33` }}>
                    <div style={{ marginTop:12, marginBottom:8, fontSize:11, color:C.textMuted }}>
                      To: <span style={{ color:C.text }}>{draft.contact_email}</span>
                      {draft.contact_title && <span style={{ marginLeft:12 }}>Role: <span style={{ color:C.text }}>{draft.contact_title}</span></span>}
                    </div>
                    <div style={{ background:C.bgElev, border:`1px solid ${C.border}`, borderRadius:6, padding:'14px' }}>
                      <div style={{ fontSize:13, fontWeight:600, color:C.textStrong, marginBottom:10 }}>Subject: {draft.subject}</div>
                      <div style={{ fontSize:12, color:C.textDim, whiteSpace:'pre-wrap', lineHeight:1.7 }}>{draft.body}</div>
                    </div>

                    {draft.reply_body && (
                      <div style={{ marginTop:10, background:'#0d1a0d', border:`1px solid ${C.green}33`, borderRadius:6, padding:'12px' }}>
                        <div style={{ fontSize:10, color:C.green, letterSpacing:'0.12em', fontFamily:"'JetBrains Mono', monospace", marginBottom:6 }}>REPLY RECEIVED</div>
                        <div style={{ fontSize:12, color:C.textDim, whiteSpace:'pre-wrap', lineHeight:1.6 }}>{draft.reply_body}</div>
                      </div>
                    )}

                    <div style={{ display:'flex', gap:8, marginTop:10 }}>
                      {draft.gmail_draft_id && (
                        <a href={`https://mail.google.com/mail/u/0/#drafts/${draft.gmail_draft_id}`} target="_blank" rel="noopener noreferrer"
                          style={{ padding:'6px 12px', border:`1px solid ${C.green}`, background:C.greenDim, color:C.green, textDecoration:'none', fontSize:10, fontWeight:700, letterSpacing:'0.1em', fontFamily:'inherit', borderRadius:4 }}>
                          REVIEW &amp; SEND IN GMAIL
                        </a>
                      )}
                      {(draft.status === 'replied' && !draft.follow_up_draft_id) && (
                        <button onClick={() => generateFollowUp(draft.id)} disabled={followingUp === draft.id}
                          style={{ padding:'6px 12px', border:`1px solid ${C.amber}`, background:C.amberDim, color:C.amber, cursor:'pointer', fontSize:10, fontWeight:700, letterSpacing:'0.1em', fontFamily:'inherit', borderRadius:4 }}>
                          {followingUp === draft.id ? 'GENERATING...' : 'GENERATE FOLLOW-UP DRAFT'}
                        </button>
                      )}
                      {draft.follow_up_draft_id && (
                        <span style={{ fontSize:10, color:C.green, fontFamily:"'JetBrains Mono', monospace", padding:'6px 0' }}>Follow-up draft created (see DRAFTS tab)</span>
                      )}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── Job log ──────────────────────────────────────────────────────── */}
      {jobs.length > 0 && (
        <div style={{ background:C.surface, border:`1px solid ${C.border}`, borderRadius:10, overflow:'hidden' }}>
          <button onClick={() => setJobsOpen(o => !o)}
            style={{ width:'100%', padding:'10px 14px', background:'transparent', border:'none', display:'flex', justifyContent:'space-between', alignItems:'center', cursor:'pointer', color:C.textMuted }}>
            <Label>JOB HISTORY · {jobs.length} RUNS</Label>
            <span style={{ fontSize:12, transform: jobsOpen ? 'rotate(90deg)' : 'none', transition:'transform 0.15s', display:'inline-block' }}>›</span>
          </button>
          {jobsOpen && (
            <div>
              {jobs.map(job => (
                <div key={job.id} style={{ padding:'8px 14px', borderTop:`1px solid ${C.border}33`, display:'flex', alignItems:'center', gap:12 }}>
                  <span style={{ fontSize:9, fontWeight:700, letterSpacing:'0.1em', color: job.status === 'done' ? C.green : job.status === 'running' ? C.amber : C.rose, fontFamily:"'JetBrains Mono', monospace" }}>{job.status.toUpperCase()}</span>
                  <span style={{ fontSize:11, color:C.textDim, fontFamily:"'JetBrains Mono', monospace", flex:1 }}>{job.job_type}</span>
                  <span style={{ fontSize:10, color:C.textMuted }}>{new Date(job.created_at).toLocaleDateString('en-US', { month:'short', day:'numeric', hour:'2-digit', minute:'2-digit' })}</span>
                  {job.result_summary && (() => { try { const s = JSON.parse(job.result_summary); return <span style={{ fontSize:10, color:C.textMuted, fontFamily:"'JetBrains Mono', monospace" }}>{s.drafted}d · {s.skipped}s · {s.errors}e</span>; } catch { return null; } })()}
                  <span style={{ fontSize:9, color:C.textMuted, fontFamily:"'JetBrains Mono', monospace" }}>{job.triggered_by}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── Config ───────────────────────────────────────────────────────── */}
      <div style={{ background:C.surface, border:`1px solid ${C.border}`, borderRadius:10, overflow:'hidden' }}>
        <button onClick={() => setConfigOpen(o => !o)}
          style={{ width:'100%', padding:'10px 14px', background:'transparent', border:'none', display:'flex', justifyContent:'space-between', alignItems:'center', cursor:'pointer', color:C.textMuted }}>
          <Label>AGENT CONFIGURATION</Label>
          <span style={{ fontSize:12, transform: configOpen ? 'rotate(90deg)' : 'none', transition:'transform 0.15s', display:'inline-block' }}>›</span>
        </button>
        {configOpen && status?.config && (
          <div style={{ padding:'14px', display:'flex', flexDirection:'column', gap:14, borderTop:`1px solid ${C.border}` }}>
            <ConfigRow label="FROM NAME" value={status.config.from_name} type="text"
              onChange={v => updateConfig('from_name', v)} />
            <ConfigRow label="BATCH SIZE" value={status.config.batch_size} type="range" min={1} max={25}
              onChange={v => updateConfig('batch_size', v)} />
            <ConfigRow label={`MIN FIT SCORE (current: ${status.config.fit_score_min})`} value={status.config.fit_score_min} type="range" min={5} max={9}
              onChange={v => updateConfig('fit_score_min', v)} />
            <ConfigRow label={`HIGH-FIT THRESHOLD (current: ${status.config.high_fit_min}) — uses gpt-4.1 full`} value={status.config.high_fit_min} type="range" min={8} max={10}
              onChange={v => updateConfig('high_fit_min', v)} />
            <div style={{ fontSize:11, color:C.textMuted }}>Reply poll interval: every {status.config.reply_poll_hours}h (set in server cron)</div>
            {gmailConnected && (
              <button onClick={async () => { await fetch(`${API}/api/agent/oauth/disconnect`, { method: 'POST' }); load(); }}
                style={{ padding:'6px 12px', border:`1px solid ${C.rose}`, background:'transparent', color:C.rose, cursor:'pointer', fontSize:10, fontWeight:700, letterSpacing:'0.1em', fontFamily:'inherit', borderRadius:4, alignSelf:'flex-start' }}>
                DISCONNECT GMAIL
              </button>
            )}
          </div>
        )}
      </div>

    </div>
  );
}

function ConfigRow({ label, value, type, min, max, onChange }) {
  const [local, setLocal] = useState(value);
  useEffect(() => setLocal(value), [value]);
  return (
    <div>
      <div style={{ fontSize:10, color:C.textMuted, letterSpacing:'0.12em', fontFamily:"'JetBrains Mono', monospace", marginBottom:6 }}>{label}</div>
      {type === 'text' ? (
        <input value={local} onChange={e => setLocal(e.target.value)}
          onBlur={() => { if (local !== value) onChange(local); }}
          style={{ background:C.bgElev, border:`1px solid ${C.border}`, color:C.text, padding:'6px 10px', borderRadius:4, fontSize:13, outline:'none', fontFamily:'inherit', width:'100%', boxSizing:'border-box' }} />
      ) : (
        <div style={{ display:'flex', alignItems:'center', gap:10 }}>
          <input type="range" min={min} max={max} value={local}
            onChange={e => { setLocal(parseInt(e.target.value)); onChange(parseInt(e.target.value)); }}
            style={{ flex:1 }} />
          <span style={{ fontSize:14, fontWeight:700, color:C.textStrong, fontFamily:"'JetBrains Mono', monospace", minWidth:24, textAlign:'right' }}>{local}</span>
        </div>
      )}
    </div>
  );
}
