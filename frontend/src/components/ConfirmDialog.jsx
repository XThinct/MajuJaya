import { useEffect, useId, useRef } from 'react';
import { createPortal } from 'react-dom';
import { AlertCircle, LoaderCircle, X } from 'lucide-react';

export default function ConfirmDialog({ open, title, description, confirmLabel, icon: Icon, danger = false, busy = false, error, onClose, onConfirm, children }) {
  const dialogRef = useRef(null);
  const cancelRef = useRef(null);
  const titleId = useId();
  const descriptionId = useId();
  useEffect(() => {
    if (!open) return;
    const dialog = dialogRef.current;
    const previousFocus = document.activeElement;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    dialog.showModal();
    cancelRef.current?.focus({ preventScroll: true });
    return () => {
      dialog.close();
      document.body.style.overflow = previousOverflow;
      if (previousFocus?.isConnected) previousFocus.focus({ preventScroll: true });
    };
  }, [open]);
  return createPortal(<dialog ref={dialogRef} className="confirmation-dialog" tabIndex={-1} aria-labelledby={titleId} aria-describedby={descriptionId} aria-busy={busy}
    onKeyDown={event => {
      if (event.key !== 'Tab') return;
      const controls = [...event.currentTarget.querySelectorAll('button:not([disabled]), a[href], input:not([disabled]), textarea:not([disabled]), select:not([disabled]), [tabindex="0"]')].filter(element => element.getClientRects().length);
      const first = controls[0], last = controls.at(-1);
      if (!first) { event.preventDefault(); event.currentTarget.focus(); return; }
      const active = document.activeElement;
      if (event.shiftKey && (active === first || !controls.includes(active))) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && (active === last || !controls.includes(active))) { event.preventDefault(); first.focus(); }
    }}
    onCancel={event => { event.preventDefault(); if (!busy) onClose(); }}
    onClick={event => {
      if (busy || event.target !== event.currentTarget) return;
      const box = event.currentTarget.getBoundingClientRect();
      if (event.clientX < box.left || event.clientX > box.right || event.clientY < box.top || event.clientY > box.bottom) onClose();
    }}>
    <div className="confirmation-content">
      <button type="button" className="confirmation-close" aria-label="Close confirmation" disabled={busy} onClick={onClose}><X size={20}/></button>
      <span className={`confirmation-icon${danger ? ' confirmation-danger' : ''}`}>{Icon && <Icon size={25} aria-hidden="true"/>}</span>
      <h2 id={titleId}>{title}</h2>
      <p id={descriptionId} className="confirmation-description">{description}</p>
      {children}
      {error && <div className="error-banner" role="alert"><AlertCircle size={18}/><span>{error}</span></div>}
      <div className="confirmation-actions">
        <button ref={cancelRef} type="button" className="button secondary" disabled={busy} onClick={onClose}>Go back</button>
        <button type="button" className={`button ${danger ? 'confirmation-danger-button' : 'primary'}`} disabled={busy} onClick={onConfirm}>
          {busy ? <><LoaderCircle size={17} className="spin" aria-hidden="true"/> Processing...</> : confirmLabel}
        </button>
      </div>
      {busy && <span role="status" className="sr-only">Saving your action. Please wait.</span>}
    </div>
  </dialog>, document.body);
}
