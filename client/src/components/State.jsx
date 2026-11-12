// Shared loading (skeleton), error (with retry) and empty states.
import Icon from './Icon.jsx';

export default function State({
  isLoading,
  error,
  isEmpty,
  emptyTitle = 'Nothing here',
  emptyText,
  rows = 5,
  onRetry,
}) {
  if (isLoading) {
    return (
      <div className="card" role="status" aria-label="Loading">
        {Array.from({ length: rows }, (_, index) => (
          <div key={index} className="skeleton skeleton-row" />
        ))}
      </div>
    );
  }
  if (error) {
    return (
      <div className="card empty" role="alert">
        <Icon name="alert" size={26} />
        <strong>Something went wrong</strong>
        <p className="muted">{error}</p>
        {onRetry && (
          <button type="button" className="btn" onClick={onRetry}>
            Try again
          </button>
        )}
      </div>
    );
  }
  if (isEmpty) {
    return (
      <div className="card empty">
        <Icon name="search" size={26} />
        <strong>{emptyTitle}</strong>
        {emptyText && <p className="muted">{emptyText}</p>}
      </div>
    );
  }
  return null;
}
