// Sticky top bar: brand, live router pill, theme toggle and the section navigation.
import { useEffect, useState } from 'react';

import { api } from '../api.js';
import { useAsync } from '../hooks/useAsync.js';
import Icon from './Icon.jsx';

function readTheme() {
  try {
    return localStorage.getItem('velop-theme');
  } catch {
    return null;
  }
}

export default function Header({ tabs, active, onSelect }) {
  const { data, error } = useAsync((signal) => api.info(signal), []);
  const [theme, setTheme] = useState(readTheme);

  useEffect(() => {
    if (theme) {
      document.documentElement.dataset.theme = theme;
    } else {
      delete document.documentElement.dataset.theme;
    }
  }, [theme]);

  function handleToggleTheme() {
    const isDark = document.documentElement.dataset.theme
      ? document.documentElement.dataset.theme === 'dark'
      : window.matchMedia('(prefers-color-scheme: dark)').matches;
    const next = isDark ? 'light' : 'dark';
    setTheme(next);
    try {
      localStorage.setItem('velop-theme', next);
    } catch {
      // Storage can be blocked; the theme still applies for this visit.
    }
  }

  return (
    <header className="topbar">
      <div className="topbar-inner">
        <div className="brand">
          <span className="logo" aria-hidden="true">
            <Icon name="wifi" size={20} />
          </span>
          <div>
            <h1>Velop Toolkit</h1>
            <span className="brand-sub">Local control for your mesh</span>
          </div>
        </div>
        <div className="topbar-right">
          <span
            className={`pill ${error ? 'pill-bad' : 'pill-ok'}`}
            title={data ? `Router ${data.routerHost}` : undefined}
          >
            <span className="dot" aria-hidden="true" />
            {error ? 'Router unreachable' : data ? `${data.model} · v${data.firmware}` : 'Connecting…'}
          </span>
          <button
            type="button"
            className="icon-btn"
            aria-label="Toggle light or dark theme"
            onClick={handleToggleTheme}
          >
            <Icon name="moon" />
          </button>
        </div>
      </div>
      <nav className="tabs" aria-label="Sections">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            type="button"
            aria-current={tab.id === active ? 'page' : undefined}
            onClick={() => onSelect(tab.id)}
          >
            <Icon name={tab.icon} size={16} />
            {tab.label}
          </button>
        ))}
      </nav>
    </header>
  );
}
