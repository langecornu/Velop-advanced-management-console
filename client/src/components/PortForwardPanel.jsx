// Port forwarding: list, add, edit, switch on or off, remove. Other rule types are shown as counts only.
import { useState } from 'react';

import { api } from '../api.js';
import { useAsync } from '../hooks/useAsync.js';
import { useToast } from '../hooks/useToast.js';
import { RISKY_PORTS } from '../lib/format.js';
import ConfirmDialog from './ConfirmDialog.jsx';
import Icon from './Icon.jsx';
import RuleDialog from './RuleDialog.jsx';
import State from './State.jsx';
import ToggleSwitch from './ToggleSwitch.jsx';

export default function PortForwardPanel() {
  const toast = useToast();
  const { data, error, isLoading, reload } = useAsync((signal) => api.portForwarding(signal), []);
  const devices = useAsync((signal) => api.devices('', signal), []);
  const [editing, setEditing] = useState(null);
  const [removing, setRemoving] = useState(null);
  const [enabling, setEnabling] = useState(null);
  const [busyIndex, setBusyIndex] = useState(-1);

  async function run(index, action, success) {
    setBusyIndex(index);
    try {
      await action();
      toast('ok', success);
      reload();
    } catch (actionError) {
      toast('error', actionError.message);
    } finally {
      setBusyIndex(-1);
      setRemoving(null);
      setEnabling(null);
    }
  }
  const toBody = (rule, isEnabled) => ({ ...rule, isEnabled });

  if (isLoading && !data) {
    return <State isLoading rows={4} />;
  }
  if (error) {
    return <State error={error} onRetry={reload} />;
  }
  const risky = data.rules.filter((rule) => rule.isEnabled && RISKY_PORTS[rule.internalPort]);
  const others = data.others;
  return (
    <div className="stack">
      {risky.map((rule) => (
        <p key={rule.index} className="alert">
          Port {rule.externalPort} is open to the internet and forwards to {rule.internalIp}:{rule.internalPort}:{' '}
          {RISKY_PORTS[rule.internalPort]}.
        </p>
      ))}
      <section className="card">
        <div className="section-head pad-head">
          <h2>
            Port forwarding <span className="count">{data.rules.length}</span>
            {data.maxRules && <span className="muted"> of {data.maxRules}</span>}
          </h2>
          <button type="button" className="btn btn-primary" onClick={() => setEditing({})}>
            <Icon name="plus" />
            Add rule
          </button>
        </div>
        <State
          isEmpty={data.rules.length === 0}
          emptyTitle="No port forwards"
          emptyText="Nothing from the internet can reach a device on your network through a forwarded port."
        />
        {data.rules.length > 0 && (
          <ul className="rows">
            {data.rules.map((rule) => (
              <li key={rule.index} className="row-item">
                <div>
                  <strong>{rule.description || 'Unnamed rule'}</strong>
                  <p className="muted mono">
                    {rule.protocol} {rule.externalPort} → {rule.internalIp}:{rule.internalPort}
                  </p>
                </div>
                <div className="row-actions">
                  <ToggleSwitch
                    checked={rule.isEnabled}
                    label={`Rule ${rule.description || rule.externalPort}`}
                    isBusy={busyIndex === rule.index}
                    onChange={(value) =>
                      value
                        ? setEnabling(rule)
                        : run(
                            rule.index,
                            () => api.updateRule(rule.index, toBody(rule, false)),
                            `Port ${rule.externalPort} switched off`,
                          )
                    }
                  />
                  <button
                    type="button"
                    className="btn btn-sm"
                    aria-label={`Edit rule ${rule.description}`}
                    onClick={() => setEditing(rule)}
                  >
                    <Icon name="edit" size={14} />
                    Edit
                  </button>
                  <button
                    type="button"
                    className="btn btn-sm btn-ghost-danger"
                    aria-label={`Remove rule ${rule.description}`}
                    onClick={() => setRemoving(rule)}
                  >
                    <Icon name="trash" size={14} />
                    Remove
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="card pad">
        <h3>Other rules on this router</h3>
        <p className="muted">These are shown for awareness. Open them in System information to read the details.</p>
        <div className="chips">
          <span className="tag no-gap">Port range forwarding: {others.rangeForwarding}</span>
          <span className="tag no-gap">Port triggering: {others.rangeTriggering}</span>
          <span className="tag no-gap">IPv6 firewall rules: {others.ipv6Firewall}</span>
          <span className={`tag no-gap${others.isDmzEnabled ? ' tag-warn' : ''}`}>
            DMZ: {others.isDmzEnabled ? 'ON (one device fully exposed)' : 'off'}
          </span>
        </div>
      </section>

      {editing && (
        <RuleDialog
          rule={editing.index === undefined ? null : editing}
          devices={(devices.data?.devices ?? []).filter((device) => device.ip)}
          onClose={() => setEditing(null)}
          onSaved={(message) => {
            setEditing(null);
            toast('ok', message);
            reload();
          }}
        />
      )}
      {enabling && (
        <ConfirmDialog
          title="Turn this rule on?"
          message={`Port ${enabling.externalPort} will be open to the internet and forwarded to ${enabling.internalIp}:${enabling.internalPort}. Your previous setting is backed up first.`}
          confirmLabel="Turn on"
          isBusy={busyIndex === enabling.index}
          onConfirm={() =>
            run(
              enabling.index,
              () => api.updateRule(enabling.index, toBody(enabling, true)),
              `Port ${enabling.externalPort} switched on`,
            )
          }
          onClose={() => setEnabling(null)}
        />
      )}
      {removing && (
        <ConfirmDialog
          title="Remove this port forward?"
          message={`Port ${removing.externalPort} will stop reaching ${removing.internalIp}. You can undo this from History.`}
          confirmLabel="Remove rule"
          isDanger
          isBusy={busyIndex === removing.index}
          onConfirm={() =>
            run(removing.index, () => api.deleteRule(removing.index), `Port ${removing.externalPort} removed`)
          }
          onClose={() => setRemoving(null)}
        />
      )}
    </div>
  );
}
