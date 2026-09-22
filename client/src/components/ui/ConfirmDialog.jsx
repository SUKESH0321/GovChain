import Modal from './Modal';

export default function ConfirmDialog({
  open,
  onCancel,
  onConfirm,
  title = 'Are you sure?',
  message,
  confirmLabel = 'Confirm',
  danger = false,
  busy = false,
}) {
  return (
    <Modal
      open={open}
      onClose={onCancel}
      title={title}
      width="420px"
      footer={
        <>
          <button type="button" className="gc-btn gc-btn-outline" onClick={onCancel} disabled={busy}>
            Cancel
          </button>
          <button
            type="button"
            className={`gc-btn ${danger ? 'gc-btn-danger' : 'gc-btn-primary'}`}
            onClick={onConfirm}
            disabled={busy}
          >
            {busy ? 'Working…' : confirmLabel}
          </button>
        </>
      }
    >
      <p>{message}</p>
    </Modal>
  );
}