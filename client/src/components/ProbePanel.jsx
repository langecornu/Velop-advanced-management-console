// One probe in its own container: title, what it is, live result badge, refresh, and the Visual / JSON viewer.
import { api } from '../api.js';
import { useAsync } from '../hooks/useAsync.js';
import Icon from './Icon.jsx';
import ResponseView from './ResponseView.jsx';
import State from './State.jsx';

export default function ProbePanel({ probe }) {
  const { data, error, isLoading, reload } = useAsync((signal) => api.systemProbe(probe.id, signal), [probe.id]);
  const isUnsupported = data && data.result === '_ErrorUnknownAction';
  const isFailed = data && data.result !== 'OK';

  return (
    <article className="card panel" aria-label={probe.label}>
      <header className="panel-head">
        <div>
          <h2>{probe.label}</h2>
          <p className="muted">{probe.about}</p>
        </div>
        <div className="panel-actions">
          {data && (
            <span className={`badge badge-${isFailed ? 'bad' : 'ok'}`}>
              <span className="dot" aria-hidden="true" />
              {isFailed ? 'Unavailable' : 'OK'}
            </span>
          )}
          <button type="button" className="btn btn-sm" onClick={reload} disabled={isLoading}>
            <Icon name="refresh" size={14} />
            {isLoading ? 'Loading…' : 'Refresh'}
          </button>
        </div>
      </header>
      <div className="panel-meta">
        <code className="chip-static">{probe.action}</code>
        {data && <span className="muted">fetched {new Date(data.fetchedAt).toLocaleTimeString()}</span>}
      </div>
      <div className="panel-body">
        {(isLoading && !data) || error ? (
          <State isLoading={isLoading && !data} error={error} onRetry={reload} rows={3} />
        ) : null}
        {isUnsupported && (
          <div className="empty">
            <Icon name="alert" size={26} />
            <strong>Not supported on this firmware</strong>
            <p className="muted">The router does not recognise this action.</p>
          </div>
        )}
        {isFailed && !isUnsupported && <p className="alert">{data.error ?? data.result}</p>}
        {data && !isFailed && (
          <ResponseView
            key={`${probe.id}-${data.fetchedAt}`}
            data={data.output}
            action={probe.action}
            label={probe.label}
          />
        )}
      </div>
    </article>
  );
}
