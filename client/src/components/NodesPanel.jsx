// Mesh nodes: firmware versions and update status, plus check, update and refresh actions.
// It also explains in plain words whether the nodes are really up to date.
import { useState } from 'react';

import { api } from '../api.js';
import { useAsync } from '../hooks/useAsync.js';
import { useToast } from '../hooks/useToast.js';
import { summarizeUpdates } from '../lib/updates.js';
import Icon from './Icon.jsx';
import State from './State.jsx';
import TypedConfirmDialog from './TypedConfirmDialog.jsx';

export default function NodesPanel() {
  const toast = useToast();
  const { data, error, isLoading, reload } = useAsync((signal) => api.nodes(signal), []);
  const schedules = useAsync((signal) => api.adminSchedules(signal), []);
  const [busy, setBusy] = useState('');
  const [asking, setAsking] = useState(false);

  async function run(name, action, success, delayedReload = false) {
    setBusy(name);
    try {
      await action();
      toast('ok', success);
      if (delayedReload) {
        setTimeout(reload, 6000);
      } else {
        reload();
      }
    } catch (runError) {
      toast('error', runError.message);
    } finally {
      setBusy('');
      setAsking(false);
    }
  }

  if (isLoading && !data) {
    return <State isLoading rows={4} />;
  }
  if (error) {
    return <State error={error} onRetry={reload} />;
  }
  const summary = summarizeUpdates(data.nodes, schedules.data);
  const hasPending = data.nodes.some((node) => node.availableUpdate);
  return (
    <div className="stack">
      <p className={`alert alert-${summary.tone}`}>{summary.text}</p>
      <div className="toolbar">
        <button
          type="button"
          className="btn"
          disabled={Boolean(busy)}
          onClick={() => run('check', api.checkNodes, 'Asked the nodes to check for updates', true)}
        >
          <Icon name="refresh" />
          Check for updates
        </button>
        <button
          type="button"
          className="btn"
          disabled={Boolean(busy)}
          onClick={() => run('refresh', api.refreshNodes, 'Asked the nodes for fresh Wi-Fi and link data', true)}
        >
          <Icon name="wifi" />
          Refresh node data
        </button>
        <button
          type="button"
          className="btn btn-danger"
          disabled={Boolean(busy) || !hasPending}
          title={hasPending ? undefined : 'No node has an update waiting'}
          onClick={() => setAsking(true)}
        >
          <Icon name="power" />
          Update nodes now…
        </button>
      </div>
      <div className="card table-wrap">
        <table>
          <thead>
            <tr>
              <th>Node</th>
              <th>Model</th>
              <th>Firmware</th>
              <th>Last checked</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {data.nodes.map((node) => (
              <tr key={node.deviceId}>
                <td data-label="Node">
                  <strong>{node.name}</strong>
                  <small className="muted block mono">{node.ip || 'no address'}</small>
                </td>
                <td data-label="Model">
                  {node.model}
                  {node.hardwareVersion && <small className="muted block">hardware v{node.hardwareVersion}</small>}
                </td>
                <td data-label="Firmware">
                  <span className="mono">{node.firmware}</span>
                  {node.firmwareBuilt && (
                    <small className="muted block">
                      build date {new Date(node.firmwareBuilt).toLocaleDateString()}
                    </small>
                  )}
                </td>
                <td data-label="Last checked">{node.lastCheck ? new Date(node.lastCheck).toLocaleString() : '—'}</td>
                <td data-label="Status">
                  <span className={`badge badge-${node.isOnline ? 'ok' : 'muted'}`}>
                    <span className="dot" aria-hidden="true" />
                    {node.isOnline ? 'Online' : 'Offline'}
                  </span>
                  {node.availableUpdate && <span className="tag tag-warn">Update waiting</span>}
                  {node.backhaul && <small className="muted block">{node.backhaul}</small>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="muted">
        The build date is when that firmware was compiled, not when it was installed. The version number is what tells
        you whether a node is current.
      </p>
      {asking && (
        <TypedConfirmDialog
          title="Update the nodes now?"
          phrase="UPDATE NODES"
          confirmLabel="Update now"
          isBusy={busy === 'update'}
          onClose={() => setAsking(false)}
          onConfirm={() => run('update', api.updateNodes, 'Update started. Nodes restart when it finishes.', true)}
        >
          <p>
            Each node that has an update installs it and restarts, so parts of your Wi-Fi go down for a few minutes.
            This cannot be undone.
          </p>
        </TypedConfirmDialog>
      )}
    </div>
  );
}
