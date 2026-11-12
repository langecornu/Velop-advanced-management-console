// System Information: probes grouped into category tabs, each probe selectable as a pill.
import { useState } from 'react';

import { api } from '../api.js';
import { useAsync } from '../hooks/useAsync.js';
import Icon from './Icon.jsx';
import ProbePanel from './ProbePanel.jsx';
import State from './State.jsx';

export default function SystemTab() {
  const { data, error, isLoading, reload } = useAsync((signal) => api.systemCatalog(signal), []);
  const [categoryId, setCategoryId] = useState('internet');
  const [probeIds, setProbeIds] = useState({});

  if (isLoading || error) {
    return <State isLoading={isLoading} error={error} onRetry={reload} rows={3} />;
  }
  const category = data.categories.find((item) => item.id === categoryId) ?? data.categories[0];
  const probe = category.probes.find((item) => item.id === probeIds[category.id]) ?? category.probes[0];

  return (
    <div className="stack">
      <div className="sys-head">
        <div>
          <h2>System information</h2>
          <p className="muted">
            Read-only views of what the router reports about itself. Nothing here changes a setting.
          </p>
        </div>
      </div>

      <div className="seg seg-lg" role="tablist" aria-label="Categories">
        {data.categories.map((item) => (
          <button
            key={item.id}
            type="button"
            role="tab"
            aria-selected={item.id === category.id}
            aria-pressed={item.id === category.id}
            onClick={() => setCategoryId(item.id)}
          >
            <Icon name={item.icon} size={16} />
            {item.label}
            <span className="seg-count">{item.probes.length}</span>
          </button>
        ))}
      </div>

      <div className="pill-row" role="group" aria-label={`${category.label} probes`}>
        {category.probes.map((item) => (
          <button
            key={item.id}
            type="button"
            className={`probe-pill${item.id === probe.id ? ' is-active' : ''}`}
            aria-pressed={item.id === probe.id}
            onClick={() => setProbeIds({ ...probeIds, [category.id]: item.id })}
          >
            {item.label}
          </button>
        ))}
      </div>

      <ProbePanel key={probe.id} probe={probe} />
    </div>
  );
}
