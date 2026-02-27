// frontend/src/components/BattleCardsModal.jsx
import { useState, useEffect } from 'react';
import './BattleCardsModal.css';

const API = import.meta.env.VITE_API_URL || 'http://localhost:5000';

export default function BattleCardsModal({ isOpen, onClose }) {
  const [cards, setCards] = useState([]);
  const [active, setActive] = useState(0);

  useEffect(() => {
    if (isOpen && cards.length === 0) {
      fetch(`${API}/api/battle-cards`).then(r => r.json()).then(setCards).catch(console.error);
    }
  }, [isOpen]);

  if (!isOpen || cards.length === 0) return null;

  const card = cards[active];

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-panel battle-panel" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h2>Competitive Battle Cards</h2>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>

        <div className="battle-tabs">
          {cards.map((c, i) => (
            <button key={i} className={`battle-tab ${active === i ? 'active' : ''}`} onClick={() => setActive(i)}>
              {c.competitor}
            </button>
          ))}
        </div>

        <div className="battle-card">
          <div className="battle-grid">
            <div className="battle-col">
              <h4 className="col-label weakness">Their Weaknesses</h4>
              <ul>{card.weaknesses?.map((w, i) => <li key={i}>{w}</li>)}</ul>
            </div>
            <div className="battle-col">
              <h4 className="col-label strength">Their Strengths</h4>
              <ul>{card.strengths?.map((s, i) => <li key={i}>{s}</li>)}</ul>
            </div>
          </div>

          <div className="battle-win">
            <h4 className="col-label win">How Flexport Wins</h4>
            <p>{card.flexport_wins}</p>
          </div>

          <div className="battle-triggers">
            <h4 className="col-label trigger">Listen For</h4>
            <div className="trigger-pills">
              {card.trigger_phrases?.map((t, i) => <span key={i} className="trigger-pill">"{t}"</span>)}
            </div>
          </div>

          <div className="battle-talktack">
            <h4 className="col-label">Talk Track</h4>
            <p>{card.talk_track}</p>
          </div>
        </div>
      </div>
    </div>
  );
}
