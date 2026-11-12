// One headline number with a caption.
export default function StatCard({ label, value, caption, isLoading }) {
  return (
    <div className="card stat">
      <span className="stat-label">{label}</span>
      <span className={`stat-value${isLoading ? ' skeleton' : ''}`}>{isLoading ? '\u00a0' : value}</span>
      {caption && <span className="stat-caption">{caption}</span>}
    </div>
  );
}
