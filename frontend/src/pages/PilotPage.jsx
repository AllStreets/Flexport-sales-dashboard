// frontend/src/pages/PilotPage.jsx
import { useState, useEffect } from 'react';

const API = import.meta.env.VITE_API_URL || 'http://localhost:5001';

const C = {
  bg:'#060b18', bgElev:'#0d1220', surface:'#111827', border:'#1f2d40', borderHover:'#2d3f58',
  accent:'#00d4ff', accentDim:'#00d4ff22', accentSoft:'#00d4ff0d', accentGlow:'#00d4ff44',
  text:'#e8eaf0', textStrong:'#ffffff', textMuted:'#6b7280', textDim:'#9ca3af',
  amber:'#fbbf24', amberDim:'#fbbf2422', orange:'#fb923c', orangeDim:'#fb923c22',
  blue:'#60a5fa', blueDim:'#60a5fa22', rose:'#fb7185', roseDim:'#fb718522', green:'#4ade80',
};

const VOICE_GUIDE = `WRITING VOICE RULES (follow exactly):
1. ZERO em dashes. Use commas, semicolons, or periods.
2. Declarative openings. Start with a claim, build outward. No "In today's market..." preambles.
3. Sparse first person. Use "I" only for direct evaluative claims.
4. Conversational density. Long sentences connected by commas and semicolons are fine; short punchy sentences when sharp.
5. "This" and "these" carry ideas between sentences rather than formal transitions.
6. No corporate filler: avoid "leverage," "unlock," "empower," "journey," "solution," "synergize," "robust," "best-in-class."
7. Specific over abstract. Real numbers, named lanes, named companies.
8. Conclusions feel inevitable, not summarized. Push the argument one step further.
9. No exclamation points. No emojis.
10. Contractions are fine and often better.`;

const SP_MARKET = `You are Pilot, a freight market intelligence module in Connor Evans's Flexport sales dashboard. Connor is a new SDR at Flexport Chicago. His dad runs a tank truck oil and chemical transportation company.

Flexport is a tech-enabled freight forwarder: ocean, air, trucking, customs, fulfillment, supply chain visibility. Sweet spot: mid-market to enterprise importers/exporters, DTC/e-commerce brands with international supply chains, manufacturers sourcing from Asia or Europe.

Use web search aggressively. Pull latest FBX, SCFI, WCI, Drewry, air cargo data. Search: "FBX freight rates this week", "ocean freight rates current month", "transpacific container rates", "port congestion", "blank sailings."

Return STRUCTURED JSON (no markdown, no preamble):
{
  "headline": "One sharp sentence on the single most important condition.",
  "date_context": "As-of date from search results (e.g., 'Week of April 14, 2026').",
  "global_signal": {"fbx_level": "...", "fbx_change_pct": "+4.2% or 'Data unavailable'", "fbx_period": "week-over-week", "direction": "up|down|flat", "interpretation": "One sentence."},
  "trade_lanes": [{"name": "China to US West Coast", "rate_context": "$2,840 per FEU", "movement": "+18% MoM", "driver": "One sentence.", "sdr_relevance": "high|medium|low"}],
  "disruptions": [{"type": "port congestion|labor|weather|geopolitical|tariff|capacity|other", "region": "...", "description": "1-2 sentences.", "severity": "high|medium|low"}],
  "forward_look": "2-3 sentences on next 2-8 weeks.",
  "sdr_playbook": [{"hook": "Specific condition.", "target_profile": "Kind of company.", "opener": "One sentence opener."}],
  "sources": ["Source names"]
}

Rules:
- Every rate number from real search results. If not found, write "Data unavailable" rather than invent.
- 2-3 playbook hooks tied to conditions above.
- At least 3 trade_lanes and 1-3 disruptions.
- Return ONLY JSON, no code fences.

${VOICE_GUIDE}`;

const SP_CUSTOMER_UPDATE = `You are Pilot, drafting a customer market update for Connor, a Flexport SDR.

Use web search for latest freight data. Write a 3-5 sentence update Connor could send as a value-add touchpoint.

- Open with a concrete market condition, not pleasantry.
- Include at least one real rate number.
- End with a subtle value-add hook ("happy to pull a lane-specific benchmark for your Shanghai to Long Beach volume if useful").
- Professional but not stuffy. Read like a decade in freight.
- No subject line unless requested.

${VOICE_GUIDE}

Return ONLY the email body. No preamble.`;

const SP_PROSPECT = `You are Pilot, a prospect research and outreach module in Connor Evans's Flexport sales dashboard. Connor is a new SDR in Chicago. His dad runs a tank truck oil and chemical transportation company, giving Connor authentic freight familiarity.

Flexport: tech-enabled freight forwarder (ocean, air, trucking, customs, fulfillment, supply chain visibility software, AI-powered "Intelligence" natural language queries). Sweet spot: mid-market to enterprise importers/exporters, DTC/e-commerce with international supply chains, manufacturers sourcing from Asia or Europe, companies frustrated with fragmented forwarders.

Use web search aggressively. Research products, manufacturing/sourcing locations, recent news (funding, expansions, supply chain announcements, leadership), earnings mentions of logistics, trade press, shipping pain points. Multiple searches expected.

Return STRUCTURED JSON (no markdown, no preamble):
{
  "company": {"name":"...", "one_liner":"...", "size_signal":"revenue/employees/funding or 'Unknown'", "stage":"early-stage|growth-stage|mid-market|enterprise|public", "hq":"...", "recent_news":["Up to 3 items."]},
  "freight_profile": {"relevance_score":"1-10", "relevance_reasoning":"2-3 sentences.", "likely_modes":["ocean","air","truck","customs"], "likely_trade_lanes":["China to US West Coast"], "estimated_volume_signal":"Inferred from revenue, product, footprint.", "pain_points":["3-4 specific pains."], "trigger_events":["1-3 reasons NOW is good, tied to real news/market."]},
  "outreach": {
    "email_1": {"subject":"Researched, not templated. Lowercase or sentence case.", "body":"4-6 sentences, voice rules strict."},
    "email_2_followup": {"timing":"3 business days after email_1 if no reply", "subject":"re: or fresh angle", "body":"3-4 sentences, different angle, no guilt-trip."},
    "email_3_breakup": {"timing":"7-10 business days after email_2", "subject":"Short, e.g., 'closing the loop'", "body":"2-3 sentences, graceful."},
    "linkedin_note": "Under 300 chars. Sharp, specific, no links.",
    "call_opener": "30-45 sec verbal pitch with hook, relevance, soft time ask. Spoken dialogue."
  },
  "connor_angle": "If Connor's chemical transport background is genuinely relevant, one sentence on weaving in. Else null."
}

Outreach rules (for all text fields):
${VOICE_GUIDE}
- If market context provided, weave the most relevant rate data into email_1 opening hook.
- Subject lines feel human-in-a-rush, not marketing AI. Lowercase often better.
- NO "I hope this finds you well." "Quick question for you." "I'll cut to the chase." "Just circling back."
- Reference specific things about their business, not generic observations.
- Low-friction CTAs: "worth 15 minutes next week?" or "want me to pull a lane benchmark on your Vietnam volume?"

Return ONLY JSON. No preamble, no code fences.`;

async function callPilot({ model, system, messages, onChunk }) {
  const response = await fetch(`${API}/api/pilot-stream`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ model, system, messages }),
  });
  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.error || `HTTP ${response.status}`);
  }
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let full = '', buf = '';
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buf += decoder.decode(value, { stream: true });
    const lines = buf.split('\n');
    buf = lines.pop();
    for (const line of lines) {
      if (!line.startsWith('data: ')) continue;
      const data = line.slice(6).trim();
      if (data === '[DONE]') continue;
      try {
        const p = JSON.parse(data);
        if (p.error) throw new Error(p.error);
        const text = p.text || p.choices?.[0]?.delta?.content || '';
        if (text) { full += text; onChunk?.(full); }
      } catch {}
    }
  }
  return full;
}

function extractJSON(text) {
  if (!text) return null;
  let c = text.trim().replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/```\s*$/i, '');
  const f = c.indexOf('{'), l = c.lastIndexOf('}');
  if (f === -1 || l === -1) return null;
  try { return JSON.parse(c.slice(f, l + 1)); } catch { return null; }
}

function Pulse({ color = C.accent, size = 6 }) {
  return <span style={{ display:'inline-block', width:size, height:size, borderRadius:'50%', background:color, boxShadow:`0 0 ${size*2}px ${color}`, animation:'pilot-pulse 2.2s ease-in-out infinite' }} />;
}

function TypingDots() {
  return (
    <span style={{ display:'inline-flex', gap:4, marginLeft:6, verticalAlign:'middle' }}>
      {[0,1,2].map(i => <span key={i} style={{ width:4, height:4, borderRadius:'50%', background:C.accent, animation:`pilot-typing 1.2s ease-in-out ${i*0.18}s infinite` }} />)}
    </span>
  );
}

function Label({ children, color = C.textMuted }) {
  return <div style={{ fontSize:10, fontWeight:700, letterSpacing:'0.14em', color, textTransform:'uppercase', fontFamily:"'JetBrains Mono', monospace" }}>{children}</div>;
}

function CopyBtn({ text, label = 'COPY' }) {
  const [done, setDone] = useState(false);
  return (
    <button onClick={async () => { await navigator.clipboard.writeText(text); setDone(true); setTimeout(() => setDone(false), 1500); }}
      style={{ background: done ? C.accentDim : 'transparent', border:`1px solid ${done ? C.accent : C.border}`, color: done ? C.accent : C.textMuted, padding:'4px 10px', borderRadius:4, cursor:'pointer', fontSize:10, letterSpacing:'0.12em', fontWeight:700, fontFamily:"'JetBrains Mono', monospace", transition:'all 0.15s' }}>
      {done ? 'COPIED' : label}
    </button>
  );
}

function Card({ children, accent = C.border, style = {} }) {
  return (
    <div style={{ background:C.surface, border:`1px solid ${C.border}`, borderRadius:10, overflow:'hidden', position:'relative', ...style }}>
      <div style={{ position:'absolute', top:0, left:0, right:0, height:2, background:`linear-gradient(90deg, ${accent} 0%, ${accent}00 100%)` }} />
      {children}
    </div>
  );
}

function Stat({ label, value, sub, accent = C.accent }) {
  return (
    <div style={{ background:C.surface, border:`1px solid ${C.border}`, borderRadius:8, padding:'14px 16px', flex:1, minWidth:0 }}>
      <Label color={C.textMuted}>{label}</Label>
      <div style={{ fontSize:22, fontWeight:700, color:accent, fontFamily:"'JetBrains Mono', monospace", marginTop:6, letterSpacing:'-0.02em' }}>{value}</div>
      {sub && <div style={{ fontSize:11, color:C.textDim, marginTop:4 }}>{sub}</div>}
    </div>
  );
}

function SeverityBadge({ level }) {
  const colors = { high:{bg:C.roseDim,fg:C.rose}, medium:{bg:C.amberDim,fg:C.amber}, low:{bg:C.blueDim,fg:C.blue} };
  const c = colors[level?.toLowerCase()] || colors.low;
  return <span style={{ background:c.bg, color:c.fg, padding:'2px 8px', borderRadius:3, fontSize:9, fontWeight:700, letterSpacing:'0.12em', textTransform:'uppercase', fontFamily:"'JetBrains Mono', monospace" }}>{level}</span>;
}

function ScoreRing({ score }) {
  const s = parseInt(score) || 0;
  const pct = (s/10)*100;
  const color = s >= 8 ? C.green : s >= 5 ? C.amber : C.rose;
  const circ = 2*Math.PI*22;
  return (
    <div style={{ position:'relative', width:56, height:56, flexShrink:0 }}>
      <svg width="56" height="56" style={{ transform:'rotate(-90deg)' }}>
        <circle cx="28" cy="28" r="22" stroke={C.border} strokeWidth="4" fill="none" />
        <circle cx="28" cy="28" r="22" stroke={color} strokeWidth="4" fill="none" strokeDasharray={circ} strokeDashoffset={circ - (pct/100)*circ} strokeLinecap="round" style={{ transition:'stroke-dashoffset 0.6s ease' }} />
      </svg>
      <div style={{ position:'absolute', inset:0, display:'flex', alignItems:'center', justifyContent:'center', fontSize:18, fontWeight:700, color, fontFamily:"'JetBrains Mono', monospace" }}>{s}</div>
    </div>
  );
}

function DirectionArrow({ dir }) {
  const d = dir?.toLowerCase();
  if (d === 'up') return <span style={{ color:C.rose, fontSize:18, fontWeight:700 }}>↑</span>;
  if (d === 'down') return <span style={{ color:C.green, fontSize:18, fontWeight:700 }}>↓</span>;
  return <span style={{ color:C.textMuted, fontSize:18, fontWeight:700 }}>→</span>;
}

function MarketBriefing({ data, onExport }) {
  if (!data) return null;
  return (
    <div style={{ display:'flex', flexDirection:'column', gap:14 }}>
      <Card accent={C.accent}>
        <div style={{ padding:'18px 20px' }}>
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', gap:12, marginBottom:10 }}>
            <Label color={C.accent}>MARKET BRIEFING · {data.date_context || 'TODAY'}</Label>
            <div style={{ display:'flex', gap:6 }}>
              <CopyBtn text={JSON.stringify(data, null, 2)} label="COPY JSON" />
              <button onClick={onExport} style={{ background:C.accentDim, border:`1px solid ${C.accent}`, color:C.accent, padding:'4px 10px', borderRadius:4, cursor:'pointer', fontSize:10, letterSpacing:'0.12em', fontWeight:700, fontFamily:"'JetBrains Mono', monospace" }}>EXPORT HTML</button>
            </div>
          </div>
          <div style={{ fontSize:17, fontWeight:600, color:C.textStrong, lineHeight:1.4 }}>{data.headline}</div>
        </div>
      </Card>

      {data.global_signal && (
        <div style={{ display:'flex', gap:10, flexWrap:'wrap' }}>
          <Stat label="FBX GLOBAL" value={data.global_signal.fbx_level || '—'} sub="index level" accent={C.text} />
          <Stat label={`CHANGE · ${data.global_signal.fbx_period?.toUpperCase() || ''}`}
            value={<span style={{ display:'inline-flex', alignItems:'center', gap:8 }}><DirectionArrow dir={data.global_signal.direction} />{data.global_signal.fbx_change_pct || '—'}</span>}
            accent={data.global_signal.direction === 'up' ? C.rose : data.global_signal.direction === 'down' ? C.green : C.textDim} />
        </div>
      )}

      {data.global_signal?.interpretation && (
        <div style={{ padding:'12px 16px', background:C.accentSoft, border:`1px solid ${C.accentGlow}`, borderRadius:8, fontSize:13, color:C.text, lineHeight:1.55, fontStyle:'italic' }}>
          {data.global_signal.interpretation}
        </div>
      )}

      {data.trade_lanes?.length > 0 && (
        <Card accent={C.blue}>
          <div style={{ padding:'14px 18px', borderBottom:`1px solid ${C.border}`, background:C.bgElev }}><Label color={C.blue}>TRADE LANE MOVEMENTS</Label></div>
          <div>
            {data.trade_lanes.map((lane, i) => (
              <div key={i} style={{ padding:'14px 18px', borderBottom: i < data.trade_lanes.length-1 ? `1px solid ${C.border}` : 'none', display:'grid', gridTemplateColumns:'1fr auto', gap:12, alignItems:'start' }}>
                <div style={{ minWidth:0 }}>
                  <div style={{ fontSize:13, fontWeight:600, color:C.textStrong, marginBottom:4 }}>{lane.name}</div>
                  <div style={{ display:'flex', gap:14, flexWrap:'wrap', marginBottom:6, fontSize:12 }}>
                    <span style={{ color:C.textDim, fontFamily:"'JetBrains Mono', monospace" }}>{lane.rate_context}</span>
                    <span style={{ color: lane.movement?.includes('+') ? C.rose : lane.movement?.includes('-') ? C.green : C.textDim, fontWeight:600, fontFamily:"'JetBrains Mono', monospace" }}>{lane.movement}</span>
                  </div>
                  <div style={{ fontSize:12, color:C.textDim, lineHeight:1.5 }}>{lane.driver}</div>
                </div>
                {lane.sdr_relevance && (
                  <div style={{ textAlign:'right', fontSize:9, fontWeight:700, letterSpacing:'0.12em', color: lane.sdr_relevance === 'high' ? C.accent : C.textMuted, fontFamily:"'JetBrains Mono', monospace" }}>
                    SDR · {lane.sdr_relevance?.toUpperCase()}
                  </div>
                )}
              </div>
            ))}
          </div>
        </Card>
      )}

      {data.disruptions?.length > 0 && (
        <Card accent={C.amber}>
          <div style={{ padding:'14px 18px', borderBottom:`1px solid ${C.border}`, background:C.bgElev }}><Label color={C.amber}>ACTIVE DISRUPTIONS</Label></div>
          <div>
            {data.disruptions.map((d, i) => (
              <div key={i} style={{ padding:'12px 18px', borderBottom: i < data.disruptions.length-1 ? `1px solid ${C.border}` : 'none' }}>
                <div style={{ display:'flex', gap:10, alignItems:'center', marginBottom:6 }}>
                  <SeverityBadge level={d.severity} />
                  <span style={{ fontSize:11, color:C.textMuted, fontWeight:600, letterSpacing:'0.04em' }}>{d.type?.toUpperCase()} · {d.region}</span>
                </div>
                <div style={{ fontSize:13, color:C.text, lineHeight:1.55 }}>{d.description}</div>
              </div>
            ))}
          </div>
        </Card>
      )}

      {data.forward_look && (
        <Card accent={C.orange}>
          <div style={{ padding:'14px 18px', borderBottom:`1px solid ${C.border}`, background:C.bgElev }}><Label color={C.orange}>2 TO 8 WEEK OUTLOOK</Label></div>
          <div style={{ padding:'14px 18px', fontSize:13, color:C.text, lineHeight:1.65 }}>{data.forward_look}</div>
        </Card>
      )}

      {data.sdr_playbook?.length > 0 && (
        <Card accent={C.accent}>
          <div style={{ padding:'14px 18px', borderBottom:`1px solid ${C.border}`, background:C.bgElev, display:'flex', justifyContent:'space-between', alignItems:'center' }}>
            <Label color={C.accent}>SDR PLAYBOOK</Label>
            <span style={{ fontSize:10, color:C.textMuted, fontFamily:"'JetBrains Mono', monospace" }}>{data.sdr_playbook.length} HOOKS</span>
          </div>
          <div>
            {data.sdr_playbook.map((p, i) => (
              <div key={i} style={{ padding:'14px 18px', borderBottom: i < data.sdr_playbook.length-1 ? `1px solid ${C.border}` : 'none' }}>
                <div style={{ display:'flex', gap:10, alignItems:'flex-start', marginBottom:8 }}>
                  <div style={{ width:20, height:20, borderRadius:4, background:C.accentDim, color:C.accent, display:'flex', alignItems:'center', justifyContent:'center', fontSize:11, fontWeight:700, flexShrink:0, fontFamily:"'JetBrains Mono', monospace", marginTop:1 }}>{i+1}</div>
                  <div style={{ flex:1, minWidth:0 }}>
                    <div style={{ fontSize:13, fontWeight:600, color:C.textStrong, marginBottom:4 }}>{p.hook}</div>
                    <div style={{ fontSize:11, color:C.textMuted, marginBottom:10 }}>Target: <span style={{ color:C.textDim }}>{p.target_profile}</span></div>
                    <div style={{ padding:'10px 12px', background:C.bgElev, borderRadius:6, border:`1px solid ${C.border}`, fontSize:13, color:C.text, lineHeight:1.5, fontStyle:'italic', position:'relative' }}>
                      <div style={{ position:'absolute', top:-7, left:10, background:C.surface, padding:'0 6px' }}><Label color={C.textMuted}>OPENER</Label></div>
                      {p.opener}
                      <div style={{ marginTop:8, textAlign:'right' }}><CopyBtn text={p.opener} /></div>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      {data.sources?.length > 0 && (
        <div style={{ fontSize:10, color:C.textMuted, fontFamily:"'JetBrains Mono', monospace", padding:'8px 0', letterSpacing:'0.06em' }}>
          SOURCES: {data.sources.join(' · ')}
        </div>
      )}
    </div>
  );
}

function EmailBlock({ step, timing, email, accentColor }) {
  const [expanded, setExpanded] = useState(step === '01');
  return (
    <div style={{ borderBottom:`1px solid ${C.border}` }}>
      <button onClick={() => setExpanded(!expanded)} style={{ width:'100%', padding:'14px 18px', background:'transparent', border:'none', color:C.text, cursor:'pointer', textAlign:'left', display:'flex', alignItems:'center', gap:12, fontFamily:'inherit' }}>
        <div style={{ width:28, height:28, borderRadius:4, background:`${accentColor}22`, color:accentColor, display:'flex', alignItems:'center', justifyContent:'center', fontSize:11, fontWeight:700, flexShrink:0, fontFamily:"'JetBrains Mono', monospace" }}>{step}</div>
        <div style={{ flex:1, minWidth:0, textAlign:'left' }}>
          <div style={{ fontSize:13, fontWeight:600, color:C.textStrong, marginBottom:2 }}>{email.subject}</div>
          <div style={{ fontSize:10, color:C.textMuted, fontFamily:"'JetBrains Mono', monospace", letterSpacing:'0.06em' }}>{timing?.toUpperCase()}</div>
        </div>
        <span style={{ color:C.textMuted, fontSize:14, transition:'transform 0.2s', transform: expanded ? 'rotate(90deg)' : 'rotate(0)' }}>›</span>
      </button>
      {expanded && (
        <div style={{ padding:'0 18px 16px' }}>
          <div style={{ padding:'14px 16px', background:C.bgElev, border:`1px solid ${C.border}`, borderRadius:6, fontSize:13, color:C.text, lineHeight:1.65, whiteSpace:'pre-wrap' }}>{email.body}</div>
          <div style={{ marginTop:8, display:'flex', gap:6, justifyContent:'flex-end' }}>
            <CopyBtn text={`Subject: ${email.subject}\n\n${email.body}`} label="COPY FULL" />
            <CopyBtn text={email.body} label="COPY BODY" />
          </div>
        </div>
      )}
    </div>
  );
}

function ProspectBriefing({ data, onExport }) {
  if (!data) return null;
  const { company, freight_profile, outreach, connor_angle } = data;
  return (
    <div style={{ display:'flex', flexDirection:'column', gap:14 }}>
      <Card accent={C.orange}>
        <div style={{ padding:'18px 20px' }}>
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', gap:16 }}>
            <div style={{ flex:1, minWidth:0 }}>
              <Label color={C.orange}>PROSPECT DOSSIER</Label>
              <div style={{ fontSize:22, fontWeight:700, color:C.textStrong, marginTop:6, letterSpacing:'-0.01em' }}>{company?.name}</div>
              <div style={{ fontSize:13, color:C.textDim, marginTop:6, lineHeight:1.5 }}>{company?.one_liner}</div>
              <div style={{ display:'flex', gap:14, marginTop:10, flexWrap:'wrap', fontSize:11, color:C.textMuted, fontFamily:"'JetBrains Mono', monospace" }}>
                {company?.stage && <span>{company.stage.toUpperCase()}</span>}
                {company?.hq && <span>· {company.hq}</span>}
                {company?.size_signal && company.size_signal !== 'Unknown' && <span>· {company.size_signal}</span>}
              </div>
            </div>
            <div style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:6 }}>
              <ScoreRing score={freight_profile?.relevance_score} />
              <Label color={C.textMuted}>FIT</Label>
            </div>
          </div>
          <div style={{ marginTop:14, display:'flex', gap:6, flexWrap:'wrap', justifyContent:'flex-end' }}>
            <CopyBtn text={JSON.stringify(data, null, 2)} label="COPY JSON" />
            <button onClick={onExport} style={{ background:C.orangeDim, border:`1px solid ${C.orange}`, color:C.orange, padding:'4px 10px', borderRadius:4, cursor:'pointer', fontSize:10, letterSpacing:'0.12em', fontWeight:700, fontFamily:"'JetBrains Mono', monospace" }}>EXPORT HTML</button>
          </div>
        </div>
      </Card>

      <Card accent={C.blue}>
        <div style={{ padding:'14px 18px', borderBottom:`1px solid ${C.border}`, background:C.bgElev }}><Label color={C.blue}>FREIGHT PROFILE</Label></div>
        <div style={{ padding:'16px 18px', display:'flex', flexDirection:'column', gap:14 }}>
          <div style={{ fontSize:13, color:C.text, lineHeight:1.6 }}>{freight_profile?.relevance_reasoning}</div>
          {freight_profile?.likely_modes?.length > 0 && (
            <div>
              <Label color={C.textMuted}>LIKELY MODES</Label>
              <div style={{ display:'flex', gap:6, marginTop:6, flexWrap:'wrap' }}>
                {freight_profile.likely_modes.map((m, i) => (
                  <span key={i} style={{ padding:'3px 10px', background:C.blueDim, color:C.blue, border:`1px solid ${C.blue}44`, borderRadius:3, fontSize:10, fontWeight:700, letterSpacing:'0.1em', textTransform:'uppercase', fontFamily:"'JetBrains Mono', monospace" }}>{m}</span>
                ))}
              </div>
            </div>
          )}
          {freight_profile?.likely_trade_lanes?.length > 0 && (
            <div>
              <Label color={C.textMuted}>PRIMARY TRADE LANES</Label>
              <div style={{ display:'flex', flexDirection:'column', gap:4, marginTop:6 }}>
                {freight_profile.likely_trade_lanes.map((l, i) => (
                  <div key={i} style={{ fontSize:12, color:C.text, fontFamily:"'JetBrains Mono', monospace" }}><span style={{ color:C.accent }}>›</span> {l}</div>
                ))}
              </div>
            </div>
          )}
          {freight_profile?.estimated_volume_signal && (
            <div>
              <Label color={C.textMuted}>VOLUME SIGNAL</Label>
              <div style={{ fontSize:12, color:C.textDim, marginTop:4, lineHeight:1.5 }}>{freight_profile.estimated_volume_signal}</div>
            </div>
          )}
          {freight_profile?.pain_points?.length > 0 && (
            <div>
              <Label color={C.textMuted}>PAIN POINTS</Label>
              <div style={{ display:'flex', flexDirection:'column', gap:6, marginTop:6 }}>
                {freight_profile.pain_points.map((p, i) => (
                  <div key={i} style={{ fontSize:12, color:C.text, display:'flex', gap:8 }}>
                    <span style={{ color:C.rose }}>◆</span>
                    <span style={{ flex:1, lineHeight:1.5 }}>{p}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
          {freight_profile?.trigger_events?.length > 0 && (
            <div>
              <Label color={C.accent}>TRIGGER EVENTS · WHY NOW</Label>
              <div style={{ display:'flex', flexDirection:'column', gap:6, marginTop:6 }}>
                {freight_profile.trigger_events.map((t, i) => (
                  <div key={i} style={{ padding:'8px 12px', background:C.accentSoft, border:`1px solid ${C.accentGlow}`, borderRadius:6, fontSize:12, color:C.text, lineHeight:1.5 }}>{t}</div>
                ))}
              </div>
            </div>
          )}
        </div>
      </Card>

      {company?.recent_news?.length > 0 && (
        <Card accent={C.textDim}>
          <div style={{ padding:'14px 18px', borderBottom:`1px solid ${C.border}`, background:C.bgElev }}><Label color={C.textDim}>RECENT INTELLIGENCE</Label></div>
          <div>
            {company.recent_news.map((n, i) => (
              <div key={i} style={{ padding:'10px 18px', fontSize:12, color:C.text, lineHeight:1.55, borderBottom: i < company.recent_news.length-1 ? `1px solid ${C.border}` : 'none', display:'flex', gap:10 }}>
                <span style={{ color:C.textMuted, fontFamily:"'JetBrains Mono', monospace", fontSize:10, marginTop:2 }}>0{i+1}</span>
                <span>{n}</span>
              </div>
            ))}
          </div>
        </Card>
      )}

      {connor_angle && (
        <div style={{ padding:'12px 16px', background:C.amberDim, border:`1px solid ${C.amber}44`, borderRadius:8, fontSize:12, color:C.text, lineHeight:1.55 }}>
          <Label color={C.amber}>PERSONAL ANGLE</Label>
          <div style={{ marginTop:6 }}>{connor_angle}</div>
        </div>
      )}

      {outreach && (
        <Card accent={C.accent}>
          <div style={{ padding:'14px 18px', borderBottom:`1px solid ${C.border}`, background:C.bgElev }}><Label color={C.accent}>OUTREACH SEQUENCE · 3-TOUCH</Label></div>
          <div>
            {outreach.email_1 && <EmailBlock step="01" timing="send now" email={outreach.email_1} accentColor={C.accent} />}
            {outreach.email_2_followup && <EmailBlock step="02" timing={outreach.email_2_followup.timing} email={outreach.email_2_followup} accentColor={C.amber} />}
            {outreach.email_3_breakup && <EmailBlock step="03" timing={outreach.email_3_breakup.timing} email={outreach.email_3_breakup} accentColor={C.rose} />}
          </div>
        </Card>
      )}

      {outreach?.linkedin_note && (
        <Card accent={C.blue}>
          <div style={{ padding:'14px 18px', borderBottom:`1px solid ${C.border}`, background:C.bgElev, display:'flex', justifyContent:'space-between', alignItems:'center' }}>
            <Label color={C.blue}>LINKEDIN CONNECTION NOTE</Label>
            <span style={{ fontSize:10, color:C.textMuted, fontFamily:"'JetBrains Mono', monospace" }}>{outreach.linkedin_note.length} / 300</span>
          </div>
          <div style={{ padding:'14px 18px', fontSize:13, color:C.text, lineHeight:1.6 }}>{outreach.linkedin_note}</div>
          <div style={{ padding:'0 18px 12px', textAlign:'right' }}><CopyBtn text={outreach.linkedin_note} /></div>
        </Card>
      )}

      {outreach?.call_opener && (
        <Card accent={C.orange}>
          <div style={{ padding:'14px 18px', borderBottom:`1px solid ${C.border}`, background:C.bgElev }}><Label color={C.orange}>COLD CALL OPENER · 30-45 SEC</Label></div>
          <div style={{ padding:'16px 18px', fontSize:13, color:C.text, lineHeight:1.75, fontStyle:'italic', background:`linear-gradient(180deg, ${C.orangeDim}08, transparent)` }}>"{outreach.call_opener}"</div>
          <div style={{ padding:'0 18px 12px', textAlign:'right' }}><CopyBtn text={outreach.call_opener} /></div>
        </Card>
      )}
    </div>
  );
}

function exportMarketAsHTML(data) {
  const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Freight Market Briefing · ${data.date_context || ''}</title><style>body{font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;background:#fafaf7;color:#1a1a1a;max-width:760px;margin:40px auto;padding:0 24px;line-height:1.6}.eyebrow{font-size:10px;font-weight:700;letter-spacing:0.18em;color:#0d9488;text-transform:uppercase;margin-bottom:8px}h1{font-family:Georgia,serif;font-size:32px;font-weight:600;line-height:1.2;margin:0 0 24px;color:#0a0a0a;letter-spacing:-0.02em}h2{font-size:11px;font-weight:700;letter-spacing:0.18em;text-transform:uppercase;color:#525252;margin:32px 0 12px;padding-bottom:8px;border-bottom:1px solid #d4d4d4}.stats{display:flex;gap:16px;margin:20px 0 24px}.stat{flex:1;padding:16px;background:#fff;border:1px solid #e5e5e5;border-radius:6px}.stat-label{font-size:10px;font-weight:700;letter-spacing:0.14em;color:#737373;text-transform:uppercase}.stat-value{font-size:22px;font-weight:700;margin-top:6px;font-family:'SF Mono',Menlo,monospace}.up{color:#dc2626}.down{color:#059669}.interp{background:#f0fdfa;border-left:3px solid #0d9488;padding:14px 18px;margin:16px 0;font-style:italic;color:#115e59}.lane{padding:14px 0;border-bottom:1px solid #e5e5e5}.lane-name{font-weight:600;font-size:14px;margin-bottom:4px}.lane-meta{font-family:'SF Mono',Menlo,monospace;font-size:12px;color:#525252;margin-bottom:6px}.lane-driver{font-size:13px;color:#404040}.disruption{padding:12px 0;border-bottom:1px solid #e5e5e5}.sev{display:inline-block;padding:2px 8px;border-radius:3px;font-size:9px;font-weight:700;letter-spacing:0.14em;text-transform:uppercase;font-family:'SF Mono',Menlo,monospace}.sev-high{background:#fee2e2;color:#b91c1c}.sev-medium{background:#fef3c7;color:#a16207}.sev-low{background:#dbeafe;color:#1e40af}.hook{background:#fff;border:1px solid #d4d4d4;border-radius:6px;padding:16px;margin:12px 0}.hook-title{font-weight:600;margin-bottom:6px}.hook-target{font-size:12px;color:#737373;margin-bottom:10px}.hook-opener{background:#f5f5f4;padding:10px 12px;border-radius:4px;font-style:italic;color:#292524;font-size:13px}.forward{background:#fff7ed;border-left:3px solid #ea580c;padding:14px 18px;margin:12px 0;color:#431407}.sources{margin-top:32px;font-size:11px;color:#737373;font-family:'SF Mono',Menlo,monospace;letter-spacing:0.08em;padding-top:16px;border-top:1px solid #e5e5e5}</style></head><body><div class="eyebrow">FREIGHT MARKET BRIEFING · ${data.date_context || 'TODAY'}</div><h1>${data.headline || ''}</h1>${data.global_signal ? `<div class="stats"><div class="stat"><div class="stat-label">FBX GLOBAL</div><div class="stat-value">${data.global_signal.fbx_level || '—'}</div></div><div class="stat"><div class="stat-label">CHANGE · ${data.global_signal.fbx_period || ''}</div><div class="stat-value ${data.global_signal.direction === 'up' ? 'up' : data.global_signal.direction === 'down' ? 'down' : ''}">${data.global_signal.direction === 'up' ? '↑ ' : data.global_signal.direction === 'down' ? '↓ ' : ''}${data.global_signal.fbx_change_pct || '—'}</div></div></div>${data.global_signal.interpretation ? `<div class="interp">${data.global_signal.interpretation}</div>` : ''}` : ''}${data.trade_lanes?.length ? `<h2>Trade lane movements</h2>${data.trade_lanes.map(l => `<div class="lane"><div class="lane-name">${l.name}</div><div class="lane-meta">${l.rate_context || ''} · <span class="${l.movement?.includes('+') ? 'up' : l.movement?.includes('-') ? 'down' : ''}">${l.movement || ''}</span></div><div class="lane-driver">${l.driver || ''}</div></div>`).join('')}` : ''}${data.disruptions?.length ? `<h2>Active disruptions</h2>${data.disruptions.map(d => `<div class="disruption"><span class="sev sev-${d.severity || 'low'}">${d.severity}</span> <strong>${(d.type || '').toUpperCase()} · ${d.region || ''}</strong><div style="margin-top:6px">${d.description}</div></div>`).join('')}` : ''}${data.forward_look ? `<h2>2 to 8 week outlook</h2><div class="forward">${data.forward_look}</div>` : ''}${data.sdr_playbook?.length ? `<h2>SDR playbook</h2>${data.sdr_playbook.map((p, i) => `<div class="hook"><div class="hook-title">${i+1}. ${p.hook}</div><div class="hook-target">Target: ${p.target_profile}</div><div class="hook-opener">"${p.opener}"</div></div>`).join('')}` : ''}${data.sources?.length ? `<div class="sources">SOURCES · ${data.sources.join(' · ')}</div>` : ''}</body></html>`;
  const blob = new Blob([html], { type: 'text/html' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = `pilot-market-briefing-${new Date().toISOString().slice(0, 10)}.html`; a.click();
  URL.revokeObjectURL(url);
}

function exportProspectAsHTML(data) {
  const { company, freight_profile, outreach, connor_angle } = data;
  const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Prospect Dossier · ${company?.name || ''}</title><style>body{font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;background:#fafaf7;color:#1a1a1a;max-width:760px;margin:40px auto;padding:0 24px;line-height:1.6}.eyebrow{font-size:10px;font-weight:700;letter-spacing:0.18em;color:#ea580c;text-transform:uppercase;margin-bottom:8px}h1{font-family:Georgia,serif;font-size:32px;font-weight:600;line-height:1.2;margin:0 0 12px;letter-spacing:-0.02em}h2{font-size:11px;font-weight:700;letter-spacing:0.18em;text-transform:uppercase;color:#525252;margin:28px 0 10px;padding-bottom:8px;border-bottom:1px solid #d4d4d4}.oneliner{font-size:16px;color:#404040;margin-bottom:12px}.meta{font-family:'SF Mono',Menlo,monospace;font-size:11px;color:#737373;letter-spacing:0.06em;margin-bottom:20px}.score-bar{display:flex;align-items:center;gap:16px;padding:16px;background:#fff;border:1px solid #e5e5e5;border-radius:6px;margin-bottom:20px}.score-num{font-size:36px;font-weight:700;font-family:'SF Mono',Menlo,monospace}.score-high{color:#059669}.score-mid{color:#a16207}.score-low{color:#b91c1c}.pills{display:flex;gap:6px;flex-wrap:wrap;margin:10px 0}.pill{padding:3px 10px;background:#dbeafe;color:#1e40af;border:1px solid #93c5fd;border-radius:3px;font-size:10px;font-weight:700;letter-spacing:0.1em;text-transform:uppercase;font-family:'SF Mono',Menlo,monospace}.pain{padding:8px 0;display:flex;gap:10px}.trigger{background:#f0fdfa;border-left:3px solid #0d9488;padding:10px 14px;margin:8px 0;font-size:13px}.email{background:#fff;border:1px solid #e5e5e5;border-radius:6px;padding:16px;margin:14px 0}.email-step{display:inline-block;width:26px;height:26px;background:#e5e5e5;color:#404040;border-radius:4px;text-align:center;line-height:26px;font-weight:700;font-family:'SF Mono',Menlo,monospace;font-size:11px;margin-right:10px;vertical-align:middle}.email-subject{font-weight:600;font-size:14px;vertical-align:middle}.email-body{padding:12px;background:#f5f5f4;border-radius:4px;font-size:13px;white-space:pre-wrap;line-height:1.7;margin-top:12px}.call{background:#fff7ed;border:1px solid #fed7aa;border-radius:6px;padding:16px;font-family:Georgia,serif;font-style:italic;font-size:14px;line-height:1.7}.angle{background:#fef3c7;border-left:3px solid #f59e0b;padding:12px 16px;font-size:13px;margin:12px 0}</style></head><body><div class="eyebrow">PROSPECT DOSSIER</div><h1>${company?.name || ''}</h1><div class="oneliner">${company?.one_liner || ''}</div><div class="meta">${[company?.stage, company?.hq, company?.size_signal !== 'Unknown' ? company?.size_signal : null].filter(Boolean).join(' · ').toUpperCase()}</div><div class="score-bar"><div class="score-num ${freight_profile?.relevance_score >= 8 ? 'score-high' : freight_profile?.relevance_score >= 5 ? 'score-mid' : 'score-low'}">${freight_profile?.relevance_score || '?'}</div><div><div style="font-weight:600;margin-bottom:4px">FREIGHT FIT SCORE</div><div style="font-size:13px;color:#525252">${freight_profile?.relevance_reasoning || ''}</div></div></div>${freight_profile?.likely_modes?.length ? `<h2>Likely modes</h2><div class="pills">${freight_profile.likely_modes.map(m => `<span class="pill">${m}</span>`).join('')}</div>` : ''}${freight_profile?.likely_trade_lanes?.length ? `<h2>Primary trade lanes</h2><div>${freight_profile.likely_trade_lanes.map(l => `<div style="font-family:'SF Mono',Menlo,monospace;font-size:13px;margin:4px 0">› ${l}</div>`).join('')}</div>` : ''}${freight_profile?.estimated_volume_signal ? `<h2>Volume signal</h2><div>${freight_profile.estimated_volume_signal}</div>` : ''}${freight_profile?.pain_points?.length ? `<h2>Pain points</h2>${freight_profile.pain_points.map(p => `<div class="pain"><span>${p}</span></div>`).join('')}` : ''}${freight_profile?.trigger_events?.length ? `<h2>Trigger events · why now</h2>${freight_profile.trigger_events.map(t => `<div class="trigger">${t}</div>`).join('')}` : ''}${company?.recent_news?.length ? `<h2>Recent intelligence</h2>${company.recent_news.map((n, i) => `<div style="padding:8px 0;border-bottom:1px solid #e5e5e5;font-size:13px">0${i+1} · ${n}</div>`).join('')}` : ''}${connor_angle ? `<h2>Personal angle</h2><div class="angle">${connor_angle}</div>` : ''}${outreach?.email_1 ? `<h2>Email 1 · send now</h2><div class="email"><span class="email-step">01</span><span class="email-subject">${outreach.email_1.subject}</span><div class="email-body">${outreach.email_1.body}</div></div>` : ''}${outreach?.email_2_followup ? `<h2>Email 2 · ${outreach.email_2_followup.timing}</h2><div class="email"><span class="email-step">02</span><span class="email-subject">${outreach.email_2_followup.subject}</span><div class="email-body">${outreach.email_2_followup.body}</div></div>` : ''}${outreach?.email_3_breakup ? `<h2>Email 3 · ${outreach.email_3_breakup.timing}</h2><div class="email"><span class="email-step">03</span><span class="email-subject">${outreach.email_3_breakup.subject}</span><div class="email-body">${outreach.email_3_breakup.body}</div></div>` : ''}${outreach?.linkedin_note ? `<h2>LinkedIn connection note</h2><div style="padding:12px;background:#fff;border:1px solid #e5e5e5;border-radius:6px">${outreach.linkedin_note}</div>` : ''}${outreach?.call_opener ? `<h2>Cold call opener</h2><div class="call">"${outreach.call_opener}"</div>` : ''}</body></html>`;
  const blob = new Blob([html], { type: 'text/html' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = `pilot-prospect-${(company?.name || 'dossier').toLowerCase().replace(/\s+/g, '-')}.html`; a.click();
  URL.revokeObjectURL(url);
}

function Toggle({ active, onClick, color, label, sub, disabled }) {
  return (
    <button onClick={onClick} disabled={disabled} style={{ padding:'8px 12px', borderRadius:5, border:`1px solid ${active ? color : C.border}`, background: active ? `${color}18` : 'transparent', color: disabled ? C.textMuted : (active ? color : C.textDim), cursor: disabled ? 'not-allowed' : 'pointer', fontFamily:'inherit', opacity: disabled ? 0.5 : 1, display:'flex', flexDirection:'column', gap:1, alignItems:'flex-start', transition:'all 0.15s', minWidth:0 }}>
      <span style={{ fontSize:10, fontWeight:700, letterSpacing:'0.1em' }}>{label}</span>
      <span style={{ fontSize:9, opacity:0.7 }}>{sub}</span>
    </button>
  );
}

function MarketPanel({ onContextReady, marketHistory, setMarketHistory }) {
  const [mode, setMode] = useState('global');
  const [selectedLanes, setSelectedLanes] = useState([]);
  const [customerCtx, setCustomerCtx] = useState('');
  const [data, setData] = useState(null);
  const [customerDraft, setCustomerDraft] = useState('');
  const [loading, setLoading] = useState(false);
  const [rawOutput, setRawOutput] = useState('');
  const [error, setError] = useState('');

  const LANES = ['Transpacific (Asia to US West Coast)', 'Transpacific (Asia to US East Coast)', 'Asia to North Europe', 'Asia to Mediterranean', 'Transatlantic (US East Coast to Europe)', 'Intra-Asia', 'Global Air Freight'];

  const toggleLane = (lane) => setSelectedLanes(prev => prev.includes(lane) ? prev.filter(l => l !== lane) : [...prev, lane]);

  const run = async () => {
    setLoading(true); setData(null); setCustomerDraft(''); setRawOutput(''); setError('');
    let prompt = '';
    if (mode === 'global') prompt = 'Pull latest global freight market intelligence. Search broadly for FBX, SCFI, WCI, air cargo indexes, and major news from past 2 weeks. Produce comprehensive global briefing.';
    else if (mode === 'lanes') {
      if (selectedLanes.length === 0) { setError('Pick at least one trade lane.'); setLoading(false); return; }
      prompt = `Produce focused freight market briefing for these lanes: ${selectedLanes.join(', ')}. Search for current rates, recent movements, drivers. Include global_signal for context.`;
    } else prompt = `Draft customer market update. ${customerCtx ? `Customer context: ${customerCtx}` : 'No specific context; general update.'}`;

    try {
      if (mode === 'customer') {
        const result = await callPilot({ model: 'gpt-5.4', system: SP_CUSTOMER_UPDATE, messages: [{ role: 'user', content: prompt }], onChunk: (t) => setCustomerDraft(t) });
        setCustomerDraft(result);
        setMarketHistory(prev => [{ id: Date.now(), type: 'customer_update', timestamp: new Date().toISOString(), content: result, context: customerCtx }, ...prev].slice(0, 20));
      } else {
        const result = await callPilot({ model: 'gpt-5.4', system: SP_MARKET, messages: [{ role: 'user', content: prompt }], onChunk: (t) => setRawOutput(t) });
        const parsed = extractJSON(result);
        if (!parsed) { setError('Response could not be parsed. Raw output below.'); setRawOutput(result); }
        else {
          setData(parsed); onContextReady(parsed);
          setMarketHistory(prev => [{ id: Date.now(), type: 'market_brief', timestamp: new Date().toISOString(), mode, lanes: selectedLanes, data: parsed }, ...prev].slice(0, 20));
        }
      }
    } catch (e) { setError(`Error: ${e.message}`); }
    setLoading(false);
  };

  const loadFromHistory = (item) => {
    if (item.type === 'market_brief') { setData(item.data); setMode(item.mode); setSelectedLanes(item.lanes || []); onContextReady(item.data); }
    else { setMode('customer'); setCustomerDraft(item.content); setCustomerCtx(item.context || ''); }
  };

  return (
    <div style={{ display:'flex', flexDirection:'column', gap:16 }}>
      <div style={{ display:'flex', gap:6, flexWrap:'wrap' }}>
        {[{id:'global',label:'Global Snapshot'},{id:'lanes',label:'Specific Lanes'},{id:'customer',label:'Customer Update'}].map(m => (
          <button key={m.id} onClick={() => setMode(m.id)} style={{ padding:'7px 14px', borderRadius:5, border:`1px solid ${mode === m.id ? C.accent : C.border}`, background: mode === m.id ? C.accentDim : 'transparent', color: mode === m.id ? C.accent : C.textMuted, cursor:'pointer', fontSize:12, fontWeight:600, letterSpacing:'0.02em', fontFamily:'inherit', transition:'all 0.15s' }}>{m.label}</button>
        ))}
      </div>

      {mode === 'lanes' && (
        <div style={{ display:'flex', gap:6, flexWrap:'wrap' }}>
          {LANES.map(lane => {
            const active = selectedLanes.includes(lane);
            return <button key={lane} onClick={() => toggleLane(lane)} style={{ padding:'6px 12px', borderRadius:4, border:`1px solid ${active ? C.blue : C.border}`, background: active ? C.blueDim : 'transparent', color: active ? C.blue : C.textDim, cursor:'pointer', fontSize:11, fontWeight:500, fontFamily:'inherit', transition:'all 0.15s' }}>{lane}</button>;
          })}
        </div>
      )}

      {mode === 'customer' && (
        <input value={customerCtx} onChange={(e) => setCustomerCtx(e.target.value)} placeholder="Optional: customer industry, trade lanes, freight mode..." style={{ background:C.surface, border:`1px solid ${C.border}`, color:C.text, padding:'10px 14px', borderRadius:6, fontSize:13, outline:'none', fontFamily:'inherit' }} />
      )}

      <button onClick={run} disabled={loading} style={{ background: loading ? 'transparent' : `linear-gradient(135deg, ${C.accent}22, ${C.accent}08)`, border:`1px solid ${loading ? C.border : C.accent}`, color: loading ? C.textMuted : C.accent, padding:'11px 22px', borderRadius:6, cursor: loading ? 'not-allowed' : 'pointer', fontSize:12, fontWeight:700, letterSpacing:'0.12em', fontFamily:'inherit', transition:'all 0.2s', alignSelf:'flex-start', display:'flex', alignItems:'center', gap:8 }}>
        {loading ? <>SEARCHING MARKET DATA<TypingDots /></> : '▶ RUN INTEL'}
      </button>

      {error && (
        <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
          <div style={{ padding:'10px 14px', background:C.roseDim, border:`1px solid ${C.rose}44`, borderRadius:6, fontSize:12, color:C.rose }}>{error}</div>
          {rawOutput && <div style={{ padding:'10px 14px', background:C.surface, border:`1px solid ${C.border}`, borderRadius:6, fontSize:11, color:C.textMuted, fontFamily:"'JetBrains Mono', monospace", whiteSpace:'pre-wrap', maxHeight:200, overflowY:'auto' }}>{rawOutput}</div>}
        </div>
      )}

      {mode === 'customer' && customerDraft && (
        <Card accent={C.accent}>
          <div style={{ padding:'14px 18px', borderBottom:`1px solid ${C.border}`, background:C.bgElev, display:'flex', justifyContent:'space-between', alignItems:'center' }}>
            <Label color={C.accent}>CUSTOMER MARKET UPDATE</Label>
            <CopyBtn text={customerDraft} />
          </div>
          <div style={{ padding:'16px 18px', fontSize:14, color:C.text, lineHeight:1.75, whiteSpace:'pre-wrap' }}>
            {customerDraft}{loading && <TypingDots />}
          </div>
        </Card>
      )}

      {data && mode !== 'customer' && <MarketBriefing data={data} onExport={() => exportMarketAsHTML(data)} />}

      {loading && !data && mode !== 'customer' && (
        <div style={{ padding:20, background:C.surface, border:`1px solid ${C.border}`, borderRadius:10, color:C.textDim, fontSize:13, fontFamily:"'JetBrains Mono', monospace" }}>
          Searching FBX · SCFI · WCI · Drewry · JOC · Reuters<TypingDots />
          <div style={{ marginTop:12, fontSize:11, color:C.textMuted }}>{rawOutput.length > 0 && `${rawOutput.length} chars received`}</div>
        </div>
      )}

      {marketHistory.length > 0 && (
        <div style={{ marginTop:12 }}>
          <Label color={C.textMuted}>RECENT BRIEFS</Label>
          <div style={{ marginTop:8, display:'flex', flexDirection:'column', gap:4 }}>
            {marketHistory.slice(0, 5).map(h => (
              <button key={h.id} onClick={() => loadFromHistory(h)} style={{ background:'transparent', border:`1px solid ${C.border}`, borderRadius:5, padding:'8px 12px', cursor:'pointer', textAlign:'left', color:C.textDim, fontFamily:'inherit', display:'flex', justifyContent:'space-between', alignItems:'center', gap:10, transition:'all 0.15s' }} onMouseEnter={e => e.currentTarget.style.borderColor = C.borderHover} onMouseLeave={e => e.currentTarget.style.borderColor = C.border}>
                <span style={{ fontSize:12, flex:1, minWidth:0, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{h.type === 'market_brief' ? (h.data?.headline || 'Market brief') : (h.content?.slice(0, 60) + '...')}</span>
                <span style={{ fontSize:10, color:C.textMuted, fontFamily:"'JetBrains Mono', monospace", flexShrink:0 }}>{new Date(h.timestamp).toLocaleDateString('en-US', { month:'short', day:'numeric' })}</span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function ProspectPanel({ marketContext, prospectHistory, setProspectHistory }) {
  const [company, setCompany] = useState('');
  const [persona, setPersona] = useState('');
  const [notes, setNotes] = useState('');
  const [useBackground, setUseBackground] = useState(true);
  const [useMarket, setUseMarket] = useState(true);
  const [useDeep, setUseDeep] = useState(true);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [rawOutput, setRawOutput] = useState('');
  const [error, setError] = useState('');

  const PERSONA_SUGGESTIONS = ['VP Supply Chain', 'Director of Logistics', 'Head of Procurement', 'COO', 'VP Operations', 'Director of Import/Export', 'Founder', 'CEO', 'Head of Freight'];

  const run = async () => {
    if (!company.trim()) return;
    setLoading(true); setData(null); setRawOutput(''); setError('');

    const marketBlock = (useMarket && marketContext) ? `\n\nCURRENT MARKET CONTEXT (weave most relevant rate data into email_1 as opening hook):\n${JSON.stringify(marketContext, null, 2).slice(0, 2500)}` : '';
    const backgroundBlock = useBackground ? `\n\nCONNOR'S BACKGROUND (use only if genuinely relevant):\n- Dad runs tank truck oil and chemical transportation company, giving Connor authentic freight familiarity\n- Recent UNC Chapel Hill grad, dual degrees in Management & Society and Sociology\n- Co-founded two companies (Ripple Technology Group, The Library Holdings)\n- RevOps internship in Barcelona using HubSpot and Apollo.AI\n- Recently started at Flexport Chicago as SDR` : '';

    const prompt = `Research this prospect and build complete dossier with 3-touch outreach sequence.\n\nCompany: ${company}\n${persona ? `Target persona: ${persona}` : 'Target persona: best-fit logistics or supply chain decision maker'}\n${notes ? `Additional context: ${notes}` : ''}${marketBlock}${backgroundBlock}`;

    try {
      const model = useDeep ? 'gpt-5.4' : 'gpt-5.4-mini';
      const result = await callPilot({ model, system: SP_PROSPECT, messages: [{ role: 'user', content: prompt }], onChunk: (t) => setRawOutput(t) });
      const parsed = extractJSON(result);
      if (!parsed) { setError('Response could not be parsed. Raw output below.'); setRawOutput(result); }
      else {
        setData(parsed);
        setProspectHistory(prev => [{ id: Date.now(), timestamp: new Date().toISOString(), company, data: parsed }, ...prev].slice(0, 30));
      }
    } catch (e) { setError(`Error: ${e.message}`); }
    setLoading(false);
  };

  const loadFromHistory = (item) => { setCompany(item.company); setData(item.data); };

  return (
    <div style={{ display:'flex', flexDirection:'column', gap:16 }}>
      <div style={{ display:'flex', gap:10, flexWrap:'wrap' }}>
        <input value={company} onChange={(e) => setCompany(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && run()} placeholder="Company name (e.g., Allbirds, Solo Stove, Brooklinen)" style={{ flex:'1 1 240px', minWidth:200, background:C.surface, border:`1px solid ${C.border}`, color:C.text, padding:'10px 14px', borderRadius:6, fontSize:14, outline:'none', fontFamily:'inherit' }} />
        <input value={persona} onChange={(e) => setPersona(e.target.value)} placeholder="Target title (type anything)" style={{ flex:'1 1 200px', minWidth:180, background:C.surface, border:`1px solid ${C.border}`, color:C.text, padding:'10px 14px', borderRadius:6, fontSize:13, outline:'none', fontFamily:'inherit' }} />
      </div>

      <div style={{ display:'flex', gap:5, flexWrap:'wrap' }}>
        {PERSONA_SUGGESTIONS.map(p => (
          <button key={p} onClick={() => setPersona(p)} style={{ padding:'4px 10px', borderRadius:3, border:`1px solid ${persona === p ? C.orange : C.border}`, background: persona === p ? C.orangeDim : 'transparent', color: persona === p ? C.orange : C.textMuted, cursor:'pointer', fontSize:11, fontWeight:500, fontFamily:'inherit', transition:'all 0.1s' }}>{p}</button>
        ))}
      </div>

      <input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Optional notes (e.g., 'just raised Series B', 'expanding to Europe', 'heavy importer from Vietnam')" style={{ background:C.surface, border:`1px solid ${C.border}`, color:C.text, padding:'10px 14px', borderRadius:6, fontSize:13, outline:'none', fontFamily:'inherit' }} />

      <div style={{ display:'flex', gap:8, flexWrap:'wrap' }}>
        <Toggle active={useDeep} onClick={() => setUseDeep(!useDeep)} color={C.amber} label={useDeep ? 'GPT-5.4' : 'GPT-5.4-MINI'} sub={useDeep ? '250k free/day · deep research' : '2.5M free/day · fast'} />
        <Toggle active={useBackground} onClick={() => setUseBackground(!useBackground)} color={C.blue} label="USE MY BACKGROUND" sub="weave in chemical transport" />
        <Toggle active={useMarket && !!marketContext} onClick={() => setUseMarket(!useMarket)} color={C.accent} label={marketContext ? 'USE MARKET INTEL' : 'NO MARKET INTEL LOADED'} sub={marketContext ? 'live rate hooks' : 'run market panel first'} disabled={!marketContext} />
      </div>

      <button onClick={run} disabled={loading || !company.trim()} style={{ background:(loading || !company.trim()) ? 'transparent' : `linear-gradient(135deg, ${C.orange}22, ${C.orange}08)`, border:`1px solid ${(loading || !company.trim()) ? C.border : C.orange}`, color:(loading || !company.trim()) ? C.textMuted : C.orange, padding:'11px 22px', borderRadius:6, cursor:(loading || !company.trim()) ? 'not-allowed' : 'pointer', fontSize:12, fontWeight:700, letterSpacing:'0.12em', fontFamily:'inherit', transition:'all 0.2s', alignSelf:'flex-start', display:'flex', alignItems:'center', gap:8 }}>
        {loading ? <>RESEARCHING · {useDeep ? 'GPT-5.4' : 'GPT-5.4-MINI'} <TypingDots /></> : '▶ BUILD DOSSIER'}
      </button>

      {error && (
        <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
          <div style={{ padding:'10px 14px', background:C.roseDim, border:`1px solid ${C.rose}44`, borderRadius:6, fontSize:12, color:C.rose }}>{error}</div>
          {rawOutput && <div style={{ padding:'10px 14px', background:C.surface, border:`1px solid ${C.border}`, borderRadius:6, fontSize:11, color:C.textMuted, fontFamily:"'JetBrains Mono', monospace", whiteSpace:'pre-wrap', maxHeight:200, overflowY:'auto' }}>{rawOutput}</div>}
        </div>
      )}

      {data && <ProspectBriefing data={data} onExport={() => exportProspectAsHTML(data)} />}

      {loading && !data && (
        <div style={{ padding:20, background:C.surface, border:`1px solid ${C.border}`, borderRadius:10, color:C.textDim, fontSize:13, fontFamily:"'JetBrains Mono', monospace" }}>
          Deep research on {company}<TypingDots />
          <div style={{ marginTop:12, fontSize:11, color:C.textMuted }}>{rawOutput.length > 0 && `${rawOutput.length} chars received`}</div>
        </div>
      )}

      {prospectHistory.length > 0 && (
        <div style={{ marginTop:12 }}>
          <Label color={C.textMuted}>RECENT DOSSIERS</Label>
          <div style={{ marginTop:8, display:'flex', flexDirection:'column', gap:4 }}>
            {prospectHistory.slice(0, 6).map(h => (
              <button key={h.id} onClick={() => loadFromHistory(h)} style={{ background:'transparent', border:`1px solid ${C.border}`, borderRadius:5, padding:'8px 12px', cursor:'pointer', textAlign:'left', color:C.textDim, fontFamily:'inherit', display:'flex', justifyContent:'space-between', alignItems:'center', gap:10, transition:'all 0.15s' }} onMouseEnter={e => e.currentTarget.style.borderColor = C.borderHover} onMouseLeave={e => e.currentTarget.style.borderColor = C.border}>
                <span style={{ display:'flex', gap:10, alignItems:'center', flex:1, minWidth:0 }}>
                  <span style={{ fontSize:13, color:C.text, fontWeight:600 }}>{h.company}</span>
                  <span style={{ fontSize:11, color:C.textMuted, padding:'1px 6px', border:`1px solid ${C.border}`, borderRadius:3, fontFamily:"'JetBrains Mono', monospace" }}>{h.data?.freight_profile?.relevance_score || '?'}/10</span>
                </span>
                <span style={{ fontSize:10, color:C.textMuted, fontFamily:"'JetBrains Mono', monospace", flexShrink:0 }}>{new Date(h.timestamp).toLocaleDateString('en-US', { month:'short', day:'numeric' })}</span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export default function PilotPage() {
  const [tab, setTab] = useState('market');
  const [marketContext, setMarketContext] = useState(null);
  const [marketHistory, setMarketHistory] = useState([]);
  const [prospectHistory, setProspectHistory] = useState([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    try { const mh = localStorage.getItem('pilot_market_history'); if (mh) setMarketHistory(JSON.parse(mh)); } catch {}
    try { const ph = localStorage.getItem('pilot_prospect_history'); if (ph) setProspectHistory(JSON.parse(ph)); } catch {}
    try { const mc = localStorage.getItem('pilot_market_context'); if (mc) setMarketContext(JSON.parse(mc)); } catch {}
    setLoaded(true);
  }, []);

  useEffect(() => {
    if (!loaded) return;
    try { localStorage.setItem('pilot_market_history', JSON.stringify(marketHistory)); } catch {}
  }, [marketHistory, loaded]);

  useEffect(() => {
    if (!loaded) return;
    try { localStorage.setItem('pilot_prospect_history', JSON.stringify(prospectHistory)); } catch {}
  }, [prospectHistory, loaded]);

  useEffect(() => {
    if (!loaded || !marketContext) return;
    try { localStorage.setItem('pilot_market_context', JSON.stringify(marketContext)); } catch {}
  }, [marketContext, loaded]);

  return (
    <>
      <style>{`
        @keyframes pilot-pulse { 0%, 100% { opacity: 0.35; transform: scale(0.85); } 50% { opacity: 1; transform: scale(1); } }
        @keyframes pilot-typing { 0%, 100% { opacity: 0.25; } 50% { opacity: 1; } }
        @keyframes pilot-fadeIn { from { opacity: 0; transform: translateY(6px); } to { opacity: 1; transform: translateY(0); } }
        .pilot-wrap input::placeholder { color: ${C.textMuted}; }
        .pilot-wrap input:focus { border-color: ${C.borderHover} !important; }
        .pilot-wrap button:focus { outline: none; }
        .pilot-wrap ::-webkit-scrollbar { width: 6px; height: 6px; }
        .pilot-wrap ::-webkit-scrollbar-track { background: ${C.bg}; }
        .pilot-wrap ::-webkit-scrollbar-thumb { background: ${C.border}; border-radius: 3px; }
        .pilot-wrap ::-webkit-scrollbar-thumb:hover { background: ${C.borderHover}; }
      `}</style>

      <div className="pilot-wrap" style={{ height:'100%', display:'flex', flexDirection:'column', background:C.bg, fontFamily:"'Space Grotesk', -apple-system, sans-serif", color:C.text, overflow:'hidden' }}>
        <div style={{ borderBottom:`1px solid ${C.border}`, background:`linear-gradient(180deg, ${C.bgElev} 0%, ${C.bg}00 100%)`, padding:'16px 28px 0', flexShrink:0 }}>
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:12 }}>
            <div>
              <div style={{ display:'flex', alignItems:'center', gap:12 }}>
                <Pulse color={C.accent} size={7} />
                <span style={{ fontSize:22, fontWeight:700, color:C.textStrong, letterSpacing:'-0.02em' }}>Pilot</span>
                <span style={{ fontSize:9, fontWeight:700, letterSpacing:'0.18em', color:C.textMuted, fontFamily:"'JetBrains Mono', monospace", padding:'2px 7px', border:`1px solid ${C.border}`, borderRadius:3 }}>FLEXPORT SDR MODULE</span>
              </div>
              <div style={{ fontSize:12, color:C.textMuted, marginTop:3, paddingLeft:19, letterSpacing:'0.02em' }}>freight intelligence, prospect research, and outreach drafting</div>
            </div>
            {marketContext && (
              <div style={{ display:'flex', alignItems:'center', gap:7, padding:'5px 10px', background:C.accentSoft, border:`1px solid ${C.accentGlow}`, borderRadius:4, fontSize:10, fontWeight:700, letterSpacing:'0.1em', color:C.accent, fontFamily:"'JetBrains Mono', monospace" }}>
                <Pulse color={C.accent} size={5} />MARKET CONTEXT LOADED
              </div>
            )}
          </div>

          <div style={{ display:'flex', gap:0 }}>
            {[{id:'market',label:'MARKET INTEL',color:C.accent},{id:'prospect',label:'PROSPECT',color:C.orange}].map(t => (
              <button key={t.id} onClick={() => setTab(t.id)} style={{ padding:'10px 22px', background:'transparent', border:'none', borderBottom:`2px solid ${tab === t.id ? t.color : 'transparent'}`, color: tab === t.id ? t.color : C.textMuted, cursor:'pointer', fontSize:11, fontWeight:700, letterSpacing:'0.14em', transition:'all 0.15s', fontFamily:"'JetBrains Mono', monospace" }}>{t.label}</button>
            ))}
          </div>
        </div>

        <div style={{ flex:1, overflowY:'auto', padding:'28px 28px 60px', animation:'pilot-fadeIn 0.3s ease' }}>
          <div style={{ maxWidth:880, margin:'0 auto' }}>
            {tab === 'market' ? (
              <MarketPanel onContextReady={setMarketContext} marketHistory={marketHistory} setMarketHistory={setMarketHistory} />
            ) : (
              <ProspectPanel marketContext={marketContext} prospectHistory={prospectHistory} setProspectHistory={setProspectHistory} />
            )}
          </div>
        </div>
      </div>
    </>
  );
}
