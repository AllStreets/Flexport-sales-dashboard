import { useState } from 'react';
import { RiSave2Line, RiCheckLine } from 'react-icons/ri';
import './SaveAnalysisButton.css';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';

export default function SaveAnalysisButton({ companyName, analysisData, onSaved }) {
  const [isSaved, setIsSaved] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSave = async () => {
    if (isSaved) return;

    setIsLoading(true);
    setError('');

    try {
      const response = await fetch(`${API_BASE_URL}/api/save-analysis`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ companyName, analysisData })
      });

      if (!response.ok) throw new Error('Failed to save');

      const data = await response.json();
      setIsSaved(true);

      // Call parent callback to notify Favorites tab
      if (onSaved) {
        onSaved(data);
      }

      // Reset saved state after 3 seconds
      setTimeout(() => setIsSaved(false), 3000);
    } catch (err) {
      setError('Failed to save analysis');
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <button
      className={`save-button ${isSaved ? 'saved' : ''} ${isLoading ? 'loading' : ''}`}
      onClick={handleSave}
      disabled={isSaved || isLoading}
    >
      {isLoading && <span className="spinner"></span>}
      {isSaved
        ? <><RiCheckLine size={13} style={{ verticalAlign: 'middle', marginRight: 4 }} />Saved to Favorites</>
        : <><RiSave2Line size={13} style={{ verticalAlign: 'middle', marginRight: 4 }} />Save Analysis</>}
    </button>
  );
}
