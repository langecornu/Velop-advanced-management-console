// Browse and search the router's hidden support bundle (system logs, Wi-Fi debug, node info).
// The first load takes about 35 seconds because the router assembles the bundle on demand.
import { useState } from 'react';

import { api } from '../api.js';
import { useAsync } from '../hooks/useAsync.js';
import { useToast } from '../hooks/useToast.js';
import Icon from './Icon.jsx';
import State from './State.jsx';

export default function LogsTab() {
  const toast = useToast();
  const [refresh, setRefresh] = useState(false);
  const { data, error, isLoading, reload } = useAsync((signal) => api.sysinfo(refresh, signal), [refresh]);
  const [query, setQuery] = useState('');
  const [hits, setHits] = useState(null);
  const [section, setSection] = useState(null);

  async function handleSearch(event) {
    event.preventDefault();
    try {
      const result = await api.sysinfoSearch(query);
      setSection(null);
      setHits(result);
    } catch (searchError) {
      toast('error', searchError.message);
    }
  }

  async function handleOpen(name) {
    try {
      const result = await api.sysinfoSection(name);
      setHits(null);
      setSection(result);
    } catch (openError) {
      toast('error', openError.message);
    }
  }

  if (isLoading) {
    return (
      <div className="card empty" role="status">
        <div className="spinner" aria-hidden="true" />
        <strong>Asking the router for its support bundle</strong>
        <p className="muted">The router builds this on demand, so the first load takes about 35 seconds.</p>
      </div>
    );
  }
  if (error) {
    return <State error={error} onRetry={reload} />;
  }
  return (
    <div className="stack">
      <div className="toolbar">
        <form className="search" onSubmit={handleSearch}>
          <Icon name="search" />
          <input
            type="search"
            aria-label="Search the logs"
            placeholder="Search every section: a MAC, an IP, an error word…"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
        </form>
        <button
          type="button"
          className="btn"
          onClick={() => {
            setRefresh(true);
            reload();
          }}
        >
          <Icon name="refresh" />
          Fetch fresh copy
        </button>
      </div>
      <p className="muted">
        {data.totalLines.toLocaleString()} lines · fetched {new Date(data.fetchedAt).toLocaleTimeString()}
      </p>
      <div className="split">
        <nav className="card section-list" aria-label="Log sections">
          {data.sections.map((item) => (
            <button
              key={item.startLine}
              type="button"
              className={section?.name === item.name ? 'is-active' : ''}
              onClick={() => handleOpen(item.name)}
            >
              <span>{item.name}</span>
              <small>{item.lineCount}</small>
            </button>
          ))}
        </nav>
        <div className="viewer">
          {!hits && !section && (
            <div className="card empty">
              <Icon name="logs" size={26} />
              <strong>Pick a section or run a search</strong>
              <p className="muted">Search looks through all {data.sections.length} sections at once.</p>
            </div>
          )}
          {hits && (
            <div className="card">
              <h3 className="viewer-title">
                {hits.hits.length} matching lines{hits.isTruncated ? ' (showing the first 300)' : ''}
              </h3>
              {hits.hits.length === 0 && <p className="muted">No matching lines.</p>}
              <ul className="hits">
                {hits.hits.map((hit) => (
                  <li key={`${hit.section}-${hit.line}`}>
                    <button type="button" className="tag" onClick={() => handleOpen(hit.section)}>
                      {hit.section}
                    </button>
                    <code>{hit.text}</code>
                  </li>
                ))}
              </ul>
            </div>
          )}
          {section && (
            <div className="card">
              <h3 className="viewer-title">{section.name}</h3>
              <pre className="code" aria-label={section.name}>
                {section.text || '(empty section)'}
              </pre>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
