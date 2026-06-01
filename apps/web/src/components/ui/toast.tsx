'use client';

/**
 * Système de toasts léger (sans dépendance externe).
 * Usage :
 *   import { toast } from '@/components/ui/toast';
 *   toast.success('Tournoi créé');
 *   toast.error('Erreur réseau');
 */

import { useEffect, useState } from 'react';

type ToastKind = 'success' | 'error' | 'info' | 'warning';

interface ToastEntry {
  id: string;
  kind: ToastKind;
  message: string;
  ttl: number;
}

type Listener = (toasts: ToastEntry[]) => void;

class ToastBus {
  private toasts: ToastEntry[] = [];
  private listeners = new Set<Listener>();

  subscribe(fn: Listener): () => void {
    this.listeners.add(fn);
    fn(this.toasts);
    return () => this.listeners.delete(fn);
  }

  push(kind: ToastKind, message: string, ttl = 4000): void {
    const id = `t-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    this.toasts = [...this.toasts, { id, kind, message, ttl }];
    this.emit();
    setTimeout(() => this.dismiss(id), ttl);
  }

  dismiss(id: string): void {
    this.toasts = this.toasts.filter((t) => t.id !== id);
    this.emit();
  }

  private emit(): void {
    for (const fn of this.listeners) fn(this.toasts);
  }
}

const bus = new ToastBus();

export const toast = {
  success: (msg: string, ttl?: number) => bus.push('success', msg, ttl),
  error: (msg: string, ttl?: number) => bus.push('error', msg, ttl),
  info: (msg: string, ttl?: number) => bus.push('info', msg, ttl),
  warning: (msg: string, ttl?: number) => bus.push('warning', msg, ttl),
  dismiss: (id: string) => bus.dismiss(id),
};

const KIND_STYLES: Record<ToastKind, string> = {
  success: 'bg-success-soft text-success border-success',
  error: 'bg-danger-soft text-danger border-danger',
  info: 'bg-primary-soft text-primary border-primary',
  warning: 'bg-warning-soft text-warning border-warning',
};

export function ToastViewport() {
  const [items, setItems] = useState<ToastEntry[]>([]);
  useEffect(() => bus.subscribe(setItems), []);

  if (items.length === 0) return null;
  return (
    <div
      className="fixed top-4 right-4 z-50 flex flex-col gap-2 max-w-sm"
      data-testid="toast-viewport"
      role="status"
      aria-live="polite"
    >
      {items.map((t) => (
        <div
          key={t.id}
          className={`card border-2 shadow-lg ${KIND_STYLES[t.kind]} animate-in fade-in slide-in-from-top-2`}
          onClick={() => bus.dismiss(t.id)}
          role="alert"
        >
          <p className="text-sm font-medium pr-6">{t.message}</p>
        </div>
      ))}
    </div>
  );
}
