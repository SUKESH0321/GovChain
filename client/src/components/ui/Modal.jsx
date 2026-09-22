import { useEffect } from 'react';

export default function Modal({ open, onClose, title, children, footer, width = '500px' }) {
  useEffect(() => {
    if (!open) {
      return;
    }
    function onKey(event) {
      if (event.key === 'Escape') {
        onClose();
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) {
    return null;
  }

  return (
    <div className="gc-modal-backdrop gc-animate-entrance" onMouseDown={onClose} role="presentation">
      <div
        className="gc-modal gc-animate-entrance"
        style={{ maxWidth: width }}
        role="dialog"
        aria-modal="true"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <header className="gc-modal-header">
          <h3>{title}</h3>
          <button type="button" className="gc-modal-close" onClick={onClose} aria-label="Close">
            ×
          </button>
        </header>
        <div className="gc-modal-body">{children}</div>
        {footer && <footer className="gc-modal-footer">{footer}</footer>}
      </div>
    </div>
  );
}