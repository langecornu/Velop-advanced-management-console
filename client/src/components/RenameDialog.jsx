// Rename a device the way the Linksys app does (stored on the router, so it shows everywhere).
import { useState } from 'react';

import { api } from '../api.js';
import Modal from './Modal.jsx';

export default function RenameDialog({ device, onClose, onSaved }) {
  const [name, setName] = useState(device.name);
  const [error, setError] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  async function handleSubmit(event) {
    event.preventDefault();
    setIsSaving(true);
    setError('');
    try {
      await api.renameDevice(device.deviceId, name);
      onSaved(`Renamed to ${name.trim()}`);
    } catch (renameError) {
      setError(renameError.message);
      setIsSaving(false);
    }
  }

  return (
    <Modal
      title="Rename device"
      onClose={onClose}
      footer={
        <>
          <button type="button" className="btn" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" form="rename-form" className="btn btn-primary" disabled={isSaving || !name.trim()}>
            {isSaving ? 'Saving…' : 'Save name'}
          </button>
        </>
      }
    >
      <form id="rename-form" className="form" onSubmit={handleSubmit}>
        <p className="muted mono">{device.mac}</p>
        <label className="field">
          <span>Name</span>
          <input value={name} maxLength={32} onChange={(event) => setName(event.target.value)} autoFocus />
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
