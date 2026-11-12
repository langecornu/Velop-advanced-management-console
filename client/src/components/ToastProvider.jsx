// Renders a stack of auto-dismissing toasts in an aria-live region and exposes push() through context.
import { useCallback, useMemo, useState } from 'react';

import { ToastContext } from '../hooks/useToast.js';
import Icon from './Icon.jsx';

const LIFETIME_MS = 5500;

export default function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);

  const dismiss = useCallback((id) => setToasts((current) => current.filter((toast) => toast.id !== id)), []);
  const push = useCallback(
    (tone, text) => {
      const id = crypto.randomUUID();
      setToasts((current) => [...current, { id, tone, text }]);
      setTimeout(() => dismiss(id), LIFETIME_MS);
    },
    [dismiss],
  );
  const value = useMemo(() => push, [push]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="toasts" role="status" aria-live="polite">
        {toasts.map((toast) => (
          <div key={toast.id} className={`toast toast-${toast.tone}`}>
            <Icon name={toast.tone === 'error' ? 'alert' : 'check'} />
            <span>{toast.text}</span>
            <button type="button" className="icon-btn" aria-label="Dismiss" onClick={() => dismiss(toast.id)}>
              <Icon name="x" size={14} />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}
