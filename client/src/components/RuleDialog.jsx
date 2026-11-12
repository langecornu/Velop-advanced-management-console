// Add or edit a port-forwarding rule. Opening a port makes a device reachable from the internet, so the
// dialog says so, flags well-known dangerous ports, and asks for an explicit acknowledgement.
import { useState } from 'react';

import { api } from '../api.js';
import { RISKY_PORTS } from '../lib/format.js';
import Modal from './Modal.jsx';

const PROTOCOLS = ['TCP', 'UDP', 'Both'];

export default function RuleDialog({ rule, devices, onClose, onSaved }) {
  const isEdit = Boolean(rule);
  const [form, setForm] = useState({
    isEnabled: rule?.isEnabled ?? true,
    externalPort: String(rule?.externalPort ?? ''),
    protocol: rule?.protocol ?? 'TCP',
    internalIp: rule?.internalIp ?? '',
    internalPort: String(rule?.internalPort ?? ''),
    description: rule?.description ?? '',
  });
  const [understood, setUnderstood] = useState(false);
  const [error, setError] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const set = (name) => (event) => setForm({ ...form, [name]: event.target.value });
  const risk = RISKY_PORTS[Number(form.internalPort)];

  async function handleSubmit(event) {
    event.preventDefault();
    setIsSaving(true);
    setError('');
    const body = { ...form, externalPort: Number(form.externalPort), internalPort: Number(form.internalPort) };
    try {
      await (isEdit ? api.updateRule(rule.index, body) : api.addRule(body));
      onSaved(`Port ${body.externalPort} ${isEdit ? 'updated' : 'forwarded'}`);
    } catch (saveError) {
      setError(saveError.message);
      setIsSaving(false);
    }
  }

  return (
    <Modal
      title={isEdit ? 'Edit port forward' : 'Add a port forward'}
      onClose={onClose}
      footer={
        <>
          <button type="button" className="btn" onClick={onClose}>
            Cancel
          </button>
          <button
            type="submit"
            form="rule-form"
            className="btn btn-primary"
            disabled={isSaving || (form.isEnabled && !understood)}
          >
            {isSaving ? 'Saving…' : 'Save rule'}
          </button>
        </>
      }
    >
      <form id="rule-form" className="form" onSubmit={handleSubmit}>
        <div className="two-col form">
          <label className="field">
            <span>External port</span>
            <input
              className="mono"
              inputMode="numeric"
              value={form.externalPort}
              onChange={set('externalPort')}
              required
            />
          </label>
          <label className="field">
            <span>Protocol</span>
            <select value={form.protocol} onChange={set('protocol')}>
              {PROTOCOLS.map((item) => (
                <option key={item}>{item}</option>
              ))}
            </select>
          </label>
          <label className="field">
            <span>Forward to (device IP)</span>
            <input className="mono" list="rule-devices" value={form.internalIp} onChange={set('internalIp')} required />
            <datalist id="rule-devices">
              {devices.map((device) => (
                <option key={device.mac} value={device.ip}>
                  {device.name}
                </option>
              ))}
            </datalist>
          </label>
          <label className="field">
            <span>Internal port</span>
            <input
              className="mono"
              inputMode="numeric"
              value={form.internalPort}
              onChange={set('internalPort')}
              required
            />
          </label>
        </div>
        <label className="field">
          <span>Description</span>
          <input value={form.description} maxLength={32} onChange={set('description')} />
          <small className="muted">Letters, digits, spaces, dots, dashes and underscores.</small>
        </label>
        <label className="check">
          <input
            type="checkbox"
            checked={form.isEnabled}
            onChange={(event) => setForm({ ...form, isEnabled: event.target.checked })}
          />
          <span>Rule is on</span>
        </label>
        {form.isEnabled && (
          <>
            {risk && (
              <p className="alert">
                Port {form.internalPort}: {risk}. Exposing it to the internet is risky.
              </p>
            )}
            <label className="check">
              <input type="checkbox" checked={understood} onChange={(event) => setUnderstood(event.target.checked)} />
              <span>I understand this makes that device reachable from the internet.</span>
            </label>
          </>
        )}
        {error && (
          <p className="alert" role="alert">
            {error}
          </p>
        )}
      </form>
    </Modal>
  );
}
