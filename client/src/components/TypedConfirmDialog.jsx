// For risky actions: the button stays disabled until the exact phrase is typed.
import { useState } from 'react';

import Modal from './Modal.jsx';

export default function TypedConfirmDialog({ title, children, phrase, confirmLabel, isBusy, onConfirm, onClose }) {
  const [typed, setTyped] = useState('');
  const isReady = typed.trim() === phrase;
  return (
    <Modal
      title={title}
      onClose={onClose}
      footer={
        <>
          <button type="button" className="btn" onClick={onClose}>
            Cancel
          </button>
          <button type="button" className="btn btn-danger" disabled={!isReady || isBusy} onClick={onConfirm}>
            {isBusy ? 'Working…' : confirmLabel}
          </button>
        </>
      }
    >
      {children}
      <label className="field">
        <span>
          Type <strong className="mono">{phrase}</strong> to continue
        </span>
        <input value={typed} onChange={(event) => setTyped(event.target.value)} autoComplete="off" spellCheck={false} />
      </label>
    </Modal>
  );
}
