'use client';

import { useEffect, useRef, type ReactNode } from 'react';

interface Props {
  open: boolean;
  onClose: () => void;
  title?: ReactNode;
  children: ReactNode;
  size?: 'sm' | 'md' | 'lg' | 'xl';
}

const SIZE_CLASS: Record<NonNullable<Props['size']>, string> = {
  sm: 'max-w-sm',
  md: 'max-w-md',
  lg: 'max-w-2xl',
  xl: 'max-w-4xl',
};

/**
 * Modal accessible (HTML <dialog>) avec close on Esc + click backdrop.
 */
export function Modal({ open, onClose, title, children, size = 'md' }: Props) {
  const ref = useRef<HTMLDialogElement | null>(null);

  useEffect(() => {
    const dlg = ref.current;
    if (!dlg) return;
    if (open && !dlg.open) dlg.showModal();
    else if (!open && dlg.open) dlg.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      onClose={onClose}
      onClick={(e) => {
        if (e.target === ref.current) onClose();
      }}
      className={`backdrop:bg-slate-900/60 bg-surface border border-border-strong p-0 ${SIZE_CLASS[size]} w-full mx-auto`}
      data-testid="modal"
    >
      {title && (
        <div className="px-5 py-3 border-b border-border flex items-center justify-between">
          <h2 className="font-heading text-xl uppercase tracking-wide">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            className="text-foreground-muted hover:text-foreground text-2xl leading-none"
            aria-label="Fermer"
          >
            ×
          </button>
        </div>
      )}
      <div className="p-5">{children}</div>
    </dialog>
  );
}

interface ConfirmProps {
  open: boolean;
  title: string;
  message?: ReactNode;
  confirmLabel?: string;
  danger?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel = 'Confirmer',
  danger = false,
  onConfirm,
  onCancel,
}: ConfirmProps) {
  return (
    <Modal open={open} onClose={onCancel} title={title} size="sm">
      {message && <div className="text-sm text-foreground-muted mb-4">{message}</div>}
      <div className="flex gap-2 justify-end">
        <button type="button" onClick={onCancel} className="btn-secondary text-sm">
          Annuler
        </button>
        <button
          type="button"
          onClick={onConfirm}
          className={`text-sm px-4 py-2 font-medium ${
            danger ? 'bg-danger text-white hover:bg-red-700' : 'btn-primary'
          }`}
          data-testid="confirm-btn"
        >
          {confirmLabel}
        </button>
      </div>
    </Modal>
  );
}
