// Create or change a DHCP reservation. Pre-filled when opened from a device or lease row.
import { useState } from 'react';

import { api } from '../api.js';
import { sanitizeDescription } from '../lib/format.js';
import Modal from './Modal.jsx';

export default function ReserveDialog({ device, onClose, onSaved }) {
  const [mac, setMac] = useState(device.mac ?? '');
  const [ip, setIp] = useState(device.reservedIp || device.ip || '');
  const [description, setDescription] = useState(sanitizeDescription(device.name));
  const [error, setError] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  async function handleSubmit(event) {
    event.preventDefault();
    setIsSaving(true);
    setError('');
    try {
      await api.addReservation({ macAddress: mac, ipAddress: ip, description });
      onSaved(`Reserved ${ip} for ${mac.toUpperCase()}`);
    } catch (saveError) {
      setError(saveError.message);
      setIsSaving(false);
    }
  }

  return (
    <Modal
      title={device.reservedIp ? 'Edit reservation' : 'Reserve an IP address'}
      onClose={onClose}
      footer={
        <>
          <button type="button" className="btn" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" form="reserve-form" className="btn btn-primary" disabled={isSaving}>
            {isSaving ? 'Saving…' : 'Save reservation'}
          </button>
        </>
      }
    >
      <form id="reserve-form" className="form" onSubmit={handleSubmit}>
        {device.name && <p className="muted">{device.name}</p>}
        <label className="field">
          <span>MAC address</span>
          <input
            className="mono"
            value={mac}
            onChange={(event) => setMac(event.target.value)}
            readOnly={Boolean(device.mac)}
            placeholder="AA:BB:CC:DD:EE:FF"
            required
          />
        </label>
        <label className="field">
          <span>IP address</span>
          <input className="mono" value={ip} onChange={(event) => setIp(event.target.value)} required />
        </label>
        <label className="field">
          <span>Description</span>
          <input
            value={description}
            maxLength={63}
            onChange={(event) => setDescription(sanitizeDescription(event.target.value))}
          />
          <small className="muted">Letters and digits only. The router rejects spaces and punctuation.</small>
        </label>
        {error && (
          <p className="alert" role="alert">
            {error}
          </p>
        )}
      </form>
    </Modal>
  );
}
