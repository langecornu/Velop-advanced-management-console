// Every change is saved first. This lists them newest first and can put any one of them back.
import { useState } from 'react';

import { api } from '../api.js';
import { useAsync } from '../hooks/useAsync.js';
import { useToast } from '../hooks/useToast.js';
import ConfirmDialog from './ConfirmDialog.jsx';
import Icon from './Icon.jsx';
import State from './State.jsx';

export default function HistoryPanel() {
  const toast = useToast();
  const { data, error, isLoading, reload } = useAsync((signal) => api.backups(signal), []);
  const [target, setTarget] = useState(null);
  const [isBusy, setIsBusy] = useState(false);

  async function handleRestore() {
    setIsBusy(true);
    try {
      const result = await api.restore(target.file);
      toast('ok', `Restored: ${result.restored}`);
      reload();
    } catch (restoreError) {
      toast('error', restoreError.message);
    } finally {
      setIsBusy(false);
      setTarget(null);
    }
  }

  return (
    <div className="stack">
      <State
        isLoading={isLoading && !data}
        error={error}
        onRetry={reload}
        isEmpty={data?.backups.length === 0}
        emptyTitle="No changes yet"
        emptyText="Anything you change here is saved first and appears in this list."
      />
      {data?.backups.length > 0 && (
        <section className="card">
          <ul className="rows">
            {data.backups.map((item) => (
              <li key={item.file} className="row-item">
                <div>
                  <strong>{item.label}</strong>
                  <p className="muted">{new Date(item.time).toLocaleString()}</p>
                </div>
                {!item.label.startsWith('Restart') && (
                  <button
                    type="button"
                    className="btn btn-sm"
                    aria-label={`Undo: ${item.label}`}
                    onClick={() => setTarget(item)}
                  >
                    <Icon name="history" size={14} />
                    Undo
                  </button>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}
      {target && (
        <ConfirmDialog
          title="Put the old settings back?"
          message={`This restores the settings as they were just before "${target.label}" on ${new Date(target.time).toLocaleString()}. Anything changed since then in the same area is overwritten.`}
          confirmLabel="Restore"
          isBusy={isBusy}
          onConfirm={handleRestore}
          onClose={() => setTarget(null)}
        />
      )}
    </div>
  );
}
