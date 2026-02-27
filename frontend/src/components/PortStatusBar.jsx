// frontend/src/components/PortStatusBar.jsx
import { useState, useEffect } from 'react';
import './PortStatusBar.css';

const API = import.meta.env.VITE_API_URL || 'http://localhost:5000';

export default function PortStatusBar({ onPipelineClick, onBattleCardsClick }) {
  const [ports, setPorts] = useState([]);

  useEffect(() => {
    fetch(`${API}/api/globe-data`).then(r => r.json()).then(d => setPorts(d.ports || [])).catch(console.error);
  }, []);

  const statusColor = (status) => {
    if (status === 'disruption') return '#ef4444';
    if (status === 'congestion') return '#f59e0b';
    return '#10b981';
  };

  return (
    <header className="port-status-bar">
      <div className="bar-left">
        <span className="app-logo">FLEXPORT SDR</span>
        <span className="app-sub">Intelligence Hub</span>
      </div>

      <div className="ports-row">
        {ports.map((port, i) => (
          <div key={i} className="port-indicator" title={`${port.name}: Congestion ${port.congestion}/10`}>
            <span className="port-dot" style={{ background: statusColor(port.status) }} />
            <span className="port-name">{port.name}</span>
          </div>
        ))}
      </div>

      <div className="bar-right">
        <button className="bar-btn" onClick={onBattleCardsClick}>⚔ Battle Cards</button>
        <button className="bar-btn primary" onClick={onPipelineClick}>📋 Pipeline</button>
      </div>
    </header>
  );
}
