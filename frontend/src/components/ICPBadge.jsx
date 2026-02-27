// frontend/src/components/ICPBadge.jsx
export default function ICPBadge({ score }) {
  const color = score >= 85 ? '#10b981' : score >= 70 ? '#f59e0b' : '#94a3b8';
  return (
    <span style={{ color, fontFamily: 'JetBrains Mono, monospace', fontWeight: 700, fontSize: 13 }}>
      ICP {score}
    </span>
  );
}
