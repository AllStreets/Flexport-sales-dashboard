// frontend/src/components/PortStatusBar.jsx
import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { RiSearchEyeLine, RiKanbanView, RiMenuLine, RiPhoneLine } from 'react-icons/ri';
import './PortStatusBar.css';

const API = import.meta.env.VITE_API_URL || 'http://localhost:5000';

export default function PortStatusBar({ onPipelineClick, onQuickResearchClick, onMenuToggle, onLiveCallClick, pipelineRefresh }) {
  const [ports, setPorts] = useState([]);
  const [pipelineCount, setPipelineCount] = useState(null);

  useEffect(() => {
    fetch(`${API}/api/globe-data`).then(r => r.json()).then(d => setPorts(d.ports || [])).catch(console.error);
  }, []);

  useEffect(() => {
    fetch(`${API}/api/pipeline/count`)
      .then(r => r.json())
      .then(d => setPipelineCount(d.count ?? null))
      .catch(() => {});
  }, [pipelineRefresh]);

  const statusColor = (status) => {
    if (status === 'disruption') return '#ef4444';
    if (status === 'congestion') return '#f59e0b';
    return '#10b981';
  };

  return (
    <header className="port-status-bar">
      <div className="bar-left">
        <button className="menu-toggle" onClick={onMenuToggle} aria-label="Toggle sidebar"><RiMenuLine size={18} /></button>
        <Link to="/" className="app-logo">FLEXPORT SDR</Link>
        <span className="app-sub">Intelligence Hub</span>
      </div>

      <div className="ports-row">
        {ports.slice(0, ports.length > 1 ? ports.length - 1 : ports.length).map((port, i) => (
          <div key={i} className="port-indicator" title={`${port.name}: Congestion ${port.congestion}/10`}>
            <span className="port-dot" style={{ background: statusColor(port.status) }} />
            <span className="port-name">{port.name}</span>
          </div>
        ))}
      </div>

      <div className="bar-right">
        <button className="bar-btn call" onClick={onLiveCallClick}><RiPhoneLine size={14} /> Live Call</button>
        <button className="bar-btn" onClick={onQuickResearchClick}><RiSearchEyeLine size={14} /> Quick Research</button>
        <button className="bar-btn primary" onClick={onPipelineClick}>
          <RiKanbanView size={14} /> Pipeline
          {pipelineCount > 0 && <span className="pipeline-count-badge">{pipelineCount}</span>}
        </button>
      </div>
    </header>
  );
}
