// Yes/no confirmation in the app's own style (replaces window.confirm).
import Modal from './Modal.jsx';

export default function ConfirmDialog({ title, message, confirmLabel, isDanger, isBusy, onConfirm, onClose }) {
  return (
    <Modal
      title={title}
      onClose={onClose}
      footer={
        <>
          <button type="button" className="btn" onClick={onClose}>
            Cancel
          </button>
          <button
            type="button"
            className={isDanger ? 'btn btn-danger' : 'btn btn-primary'}
            disabled={isBusy}
            onClick={onConfirm}
          >
            {isBusy ? 'Working…' : confirmLabel}
          </button>
        </>
      }
    >
      <p>{message}</p>
    </Modal>
  );
}
