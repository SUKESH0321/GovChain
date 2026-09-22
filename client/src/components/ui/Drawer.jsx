import { useEffect } from 'react';

export default function Drawer({ open, onClose, title, children, footer, width = '480px' }) {
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
    <div className="gc-drawer-backdrop gc-animate-entrance" onMouseDown={onClose} role="presentation">
      <aside
        className="gc-drawer gc-animate-entrance"
        style={{ maxWidth: '100vw' }}
        role="dialog"
        aria-modal="true"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="gc-drawer-header">
          <h3 style={{ fontSize: 16 }}>{title}</h3>
          <button type="button" className="gc-modal-close" onClick={onClose} aria-label="Close">
            ×
          </button>
        </div>
        <div className="gc-drawer-body">{children}</div>
        {footer && <footer className="gc-drawer-footer">{footer}</footer>}
      </aside>
    </div>
  );
}