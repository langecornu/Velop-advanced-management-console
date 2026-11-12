// Access control: the MAC filter (allow / deny list) and parental-control rules.
import { useEffect, useState } from 'react';

import { api } from '../api.js';
import { useAsync } from '../hooks/useAsync.js';
import { useToast } from '../hooks/useToast.js';
import ConfirmDialog from './ConfirmDialog.jsx';
import Icon from './Icon.jsx';
import State from './State.jsx';

const MODES = [
  { id: 'Disabled', label: 'Off', about: 'Every device may connect.' },
  { id: 'Allow', label: 'Allow list', about: 'ONLY the devices below may connect. Everything else is blocked.' },
  { id: 'Deny', label: 'Block list', about: 'The devices below are blocked. Everything else may connect.' },
];
const MAC = /^([0-9A-Fa-f]{2}[:-]?){5}[0-9A-Fa-f]{2}$/;

export default function AccessPanel() {
  const toast = useToast();
  const { data, error, isLoading, reload } = useAsync((signal) => api.adminAccess(signal), []);
  const [mode, setMode] = useState('Disabled');
  const [macs, setMacs] = useState([]);
  const [newMac, setNewMac] = useState('');
  const [confirming, setConfirming] = useState(null);
  const [isBusy, setIsBusy] = useState(false);

  useEffect(() => {
    if (data) {
      setMode(data.macFilter.mode ?? 'Disabled');
      setMacs(data.macFilter.macAddresses);
    }
  }, [data]);

  if (isLoading && !data) {
    return <State isLoading rows={4} />;
  }
  if (error) {
    return <State error={error} onRetry={reload} />;
  }

  const isDirty = mode !== data.macFilter.mode || JSON.stringify(macs) !== JSON.stringify(data.macFilter.macAddresses);
  const needsDevices = mode === 'Allow' && macs.length === 0;
  const upperMac = newMac.trim().toUpperCase().replace(/-/g, ':');

  async function run(action, success) {
    setIsBusy(true);
    try {
      await action();
      toast('ok', success);
      reload();
    } catch (actionError) {
      toast('error', actionError.message);
    } finally {
      setIsBusy(false);
      setConfirming(null);
    }
  }

  return (
    <div className="stack">
      <section className="card pad">
        <h2>MAC address filter</h2>
        <div className="mode-grid" role="radiogroup" aria-label="Filter mode">
          {MODES.map((item) => (
            <button
              key={item.id}
              type="button"
              role="radio"
              aria-checked={mode === item.id}
              className={`mode${mode === item.id ? ' is-active' : ''}`}
              onClick={() => setMode(item.id)}
            >
              <strong>{item.label}</strong>
              <span className="muted">{item.about}</span>
            </button>
          ))}
        </div>
        {mode !== 'Disabled' && (
          <>
            <ul className="rows">
              {macs.length === 0 && <li className="muted">No devices in the list yet.</li>}
              {macs.map((mac) => (
                <li key={mac} className="row-item">
                  <code>{mac}</code>
                  <button
                    type="button"
                    className="btn btn-sm btn-ghost-danger"
                    aria-label={`Remove ${mac}`}
                    onClick={() => setMacs(macs.filter((item) => item !== mac))}
                  >
                    <Icon name="trash" size={14} />
                    Remove
                  </button>
                </li>
              ))}
            </ul>
            <form
              className="toolbar"
              onSubmit={(event) => {
                event.preventDefault();
                if (MAC.test(newMac.trim()) && !macs.includes(upperMac)) {
                  setMacs([...macs, upperMac]);
                  setNewMac('');
                }
              }}
            >
              <input
                className="mono"
                value={newMac}
                onChange={(event) => setNewMac(event.target.value)}
                placeholder="AA:BB:CC:DD:EE:FF"
                aria-label="MAC address to add"
              />
              <button type="submit" className="btn" disabled={!MAC.test(newMac.trim())}>
                <Icon name="plus" size={16} />
                Add
              </button>
            </form>
          </>
        )}
        {needsDevices && (
          <p className="alert">
            An allow list needs at least one device, or it would block everything, including this computer.
          </p>
        )}
        <div>
          <button
            type="button"
            className="btn btn-primary"
            disabled={!isDirty || needsDevices}
            onClick={() => setConfirming({ kind: 'filter' })}
          >
            Review and save
          </button>
        </div>
      </section>

      <section className="card pad">
        <div className="row-between">
          <h2>Parental control rules</h2>
          <span className={`badge badge-${data.parental.isEnabled ? 'ok' : 'muted'}`}>
            <span className="dot" aria-hidden="true" />
            {data.parental.isEnabled ? 'Active' : 'Switched off'}
          </span>
        </div>
        <p className="muted">Switch the feature on or off under Switches. Rules can be removed here.</p>
        <State isEmpty={data.parental.rules.length === 0} emptyTitle="No rules" />
        <ul className="rows">
          {data.parental.rules.map((rule) => (
            <li key={rule.index} className="row-item">
              <div>
                <strong>{rule.description || 'Unnamed rule'}</strong>
                <p className="muted">
                  {rule.macAddresses.length} device{rule.macAddresses.length === 1 ? '' : 's'} ·{' '}
                  {rule.blockedUrls.length} blocked site{rule.blockedUrls.length === 1 ? '' : 's'} ·{' '}
                  {rule.isScheduled ? 'internet schedule set' : 'no schedule'}
                </p>
              </div>
              <button
                type="button"
                className="btn btn-sm btn-ghost-danger"
                aria-label={`Remove rule ${rule.description}`}
                onClick={() => setConfirming({ kind: 'rule', rule })}
              >
                <Icon name="trash" size={14} />
                Remove
              </button>
            </li>
          ))}
        </ul>
      </section>

      {confirming?.kind === 'filter' && (
        <ConfirmDialog
          title="Save MAC filter?"
          message={`${MODES.find((item) => item.id === mode).about} ${mode === 'Allow' ? 'Make sure this computer is on the list or you may lose access to the router.' : ''} The current filter is backed up first.`}
          confirmLabel="Save filter"
          isDanger={mode === 'Allow'}
          isBusy={isBusy}
          onClose={() => setConfirming(null)}
          onConfirm={() => run(() => api.setMacFilter({ mode, macAddresses: macs, confirm: true }), 'MAC filter saved')}
        />
      )}
      {confirming?.kind === 'rule' && (
        <ConfirmDialog
          title="Remove this rule?"
          message={`"${confirming.rule.description}" and its schedule will be deleted. All rules are backed up first, so you can undo this from History.`}
          confirmLabel="Remove rule"
          isDanger
          isBusy={isBusy}
          onClose={() => setConfirming(null)}
          onConfirm={() => run(() => api.removeRule(confirming.rule.index), 'Rule removed')}
        />
      )}
    </div>
  );
}
