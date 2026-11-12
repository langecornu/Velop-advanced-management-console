// Status pill: colour dot plus text (never colour alone). Optional hint explains router/ping disagreements.
export default function StatusBadge({ status }) {
  const tone = status.isChecking ? 'checking' : status.tone;
  return (
    <span className={`badge badge-${tone}`} title={status.hint}>
      <span className="dot" aria-hidden="true" />
      {status.label}
      {status.key === 'verified' && <small>via ping</small>}
    </span>
  );
}
