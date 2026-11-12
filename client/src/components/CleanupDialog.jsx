// Remove stale offline entries from the router's device list. Entries come back by themselves if the device
// ever reconnects, but their custom name is lost, and this cannot be undone from History.
import { useState } from 'react';

import { api } from '../api.js';
import { useToast } from '../hooks/useToast.js';
import TypedConfirmDialog from './TypedConfirmDialog.jsx';

export default function CleanupDialog({ devices, onClose, onDone }) {
  const toast = useToast();
  const [selected, setSelected] = useState(() => new Set(devices.map((device) => device.deviceId)));
  const [isBusy, setIsBusy] = useState(false);

  function toggle(id) {
    const next = new Set(selected);
    if (next.has(id)) {
      next.delete(id);
    } else {
      next.add(id);
    }
    setSelected(next);
  }

  async function handleConfirm() {
    setIsBusy(true);
    try {
      const result = await api.deleteDevices([...selected]);
      onDone(
        `Removed ${result.deleted} device${result.deleted === 1 ? '' : 's'}${result.failed ? `, ${result.failed} failed` : ''}`,
      );
    } catch (cleanError) {
      toast('error', cleanError.message);
      setIsBusy(false);
    }
  }

  return (
    <TypedConfirmDialog
      title={`Remove ${selected.size} offline device${selected.size === 1 ? '' : 's'}?`}
      phrase="DELETE DEVICES"
      confirmLabel={`Remove ${selected.size}`}
      isBusy={isBusy || selected.size === 0}
      onClose={onClose}
      onConfirm={handleConfirm}
    >
      <p className="muted">
        These did not answer a ping and have no active connection. Removing an entry clears its name and settings on the
        router. A device that reconnects later simply reappears. This cannot be undone from History.
      </p>
      <div className="check-list">
        <button
          type="button"
          className="btn btn-sm"
          onClick={() => setSelected(selected.size ? new Set() : new Set(devices.map((device) => device.deviceId)))}
        >
          {selected.size ? 'Select none' : 'Select all'}
        </button>
        <ul className="rows">
          {devices.map((device) => (
            <li key={device.deviceId} className="row-item compact">
              <label className="check">
                <input
                  type="checkbox"
                  checked={selected.has(device.deviceId)}
                  onChange={() => toggle(device.deviceId)}
                />
                <span>
                  <strong>{device.name}</strong> <span className="muted mono">{device.mac}</span>
                </span>
              </label>
            </li>
          ))}
        </ul>
      </div>
    </TypedConfirmDialog>
  );
}
