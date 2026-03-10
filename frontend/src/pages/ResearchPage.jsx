import { useState, useRef } from 'react';
import { RiSearchEyeLine, RiRefreshLine, RiDeleteBinLine } from 'react-icons/ri';
import './ResearchPage.css';

const API = import.meta.env.VITE_API_URL || 'http://localhost:5001';
const SECTIONS = ['SNAPSHOT', 'TRADE PROFILE', 'RECENT SIGNALS', 'WHY CONTACT NOW', 'OPENING HOOK'];

function parseSection(text, key) {
  const start = text.indexOf(`## ${key}`);
  if (start === -1) return '';
  const after = text.slice(start + `## ${key}`.length).trim();
  const next = after.search(/^## /m);
  return (next === -1 ? after : after.slice(0, next)).trim();
}

export default function ResearchPage() {
  const [query, setQuery] = useState('');
  const [output, setOutput] = useState('');
  const [loading, setLoading] = useState(false);
  const [history, setHistory] = useState(() => JSON.parse(localStorage.getItem('research_history') || '[]'));
  const outputRef = useRef('');

  const saveHistory = (company, text) => {
    const entry = { company, text, ts: Date.now() };
    const next = [entry, ...history].slice(0, 10);
    setHistory(next);
    localStorage.setItem('research_history', JSON.stringify(next));
  };

  const runResearch = async (company = query.trim()) => {
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
  };

  const sections = SECTIONS.map(s => ({ key: s, content: parseSection(output, s) })).filter(s => s.content);

  return (
    <div className="research-page">
      <div className="research-left">
        <div className="research-search-box">
          <RiSearchEyeLine size={16} className="research-search-icon" />
          <input
            className="research-input"
            placeholder="Company name..."
            value={query}
            onChange={e => setQuery(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && runResearch()}
          />
          <button className="research-scan-btn" onClick={() => runResearch()} disabled={!query.trim() || loading}>
            {loading ? <RiRefreshLine className="research-spin" size={14} /> : 'SCAN'}
          </button>
        </div>

        {history.length > 0 && (
          <div className="research-history">
            <div className="research-history-label">RECENT SCANS</div>
            {history.map((h, i) => (
              <div key={i} className="research-history-item" onClick={() => { setQuery(h.company); setOutput(h.text); }}>
                <span>{h.company}</span>
                <button className="research-history-del" onClick={e => {
                  e.stopPropagation();
                  const next = history.filter((_, j) => j !== i);
                  setHistory(next);
                  localStorage.setItem('research_history', JSON.stringify(next));
                }}><RiDeleteBinLine size={11} /></button>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="research-right">
        {!output && !loading && (
          <div className="research-empty">
            <RiSearchEyeLine size={40} className="research-empty-icon" />
            <p>Enter a company name and hit Scan to generate an AI intelligence brief.</p>
            <p className="research-empty-sub">Pulls live news, web signals, and Flexport-specific talking points.</p>
          </div>
        )}

        {(output || loading) && (
          <div className="research-output">
            {loading && !output && <div className="research-loading">Scanning...</div>}
            {sections.map(({ key, content }) => (
              <div key={key} className="research-section">
                <div className="research-section-header">
                  <span className="research-section-key">{key}</span>
                </div>
                <div className="research-section-body">{content}</div>
              </div>
            ))}
            {loading && <span className="research-cursor">|</span>}
          </div>
        )}
      </div>
    </div>
  );
}
