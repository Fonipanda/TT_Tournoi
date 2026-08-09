'use client';

/**
 * Système de toasts léger (sans dépendance externe).
 * Usage :
 *   import { toast } from '@/components/ui/toast';
 *   toast.success('Tournoi créé');
 *   toast.error('Erreur réseau');
 *
 * Comportement : le toast disparaît seul au bout de 2 s, en fondu.
 * Passer un `ttl` explicite permet d'allonger l'affichage ; `ttl = 0`
 * désactive la fermeture automatique (le toast attend alors un clic).
 */

import { useEffect, useState } from 'react';

type ToastKind = 'success' | 'error' | 'info' | 'warning';

/** Durée d'affichage par défaut, avant le début du fondu. */
export const TOAST_DEFAULT_TTL = 2000;
/** Durée du fondu de sortie — doit rester alignée sur `.toast-leave` dans globals.css. */
const TOAST_FADE_MS = 300;

interface ToastEntry {
  id: string;
  kind: ToastKind;
  message: string;
  /** Vrai pendant le fondu de sortie : l'entrée est encore rendue mais plus interactive. */
  leaving: boolean;
}

type Listener = (toasts: ToastEntry[]) => void;

class ToastBus {
  private toasts: ToastEntry[] = [];
  private listeners = new Set<Listener>();
  private timers = new Map<string, ReturnType<typeof setTimeout>>();

  subscribe(fn: Listener): () => void {
    this.listeners.add(fn);
    fn(this.toasts);
    return () => {
      this.listeners.delete(fn);
    };
  }

  push(kind: ToastKind, message: string, ttl = TOAST_DEFAULT_TTL): void {
    const id = `t-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    this.toasts = [...this.toasts, { id, kind, message, leaving: false }];
    this.emit();
    // ttl = 0 → pas d'auto-dismiss, l'utilisateur ferme manuellement.
    if (ttl > 0) {
      this.timers.set(
        id,
        setTimeout(() => this.dismiss(id), ttl),
      );
    }
  }

  /** Déclenche le fondu de sortie, puis retire l'entrée. Idempotent. */
  dismiss(id: string): void {
    const entry = this.toasts.find((t) => t.id === id);
    if (!entry || entry.leaving) return;

    const pending = this.timers.get(id);
    if (pending) clearTimeout(pending);

    this.toasts = this.toasts.map((t) => (t.id === id ? { ...t, leaving: true } : t));
    this.emit();

    this.timers.set(
      id,
      setTimeout(() => {
        this.timers.delete(id);
        this.toasts = this.toasts.filter((t) => t.id !== id);
        this.emit();
      }, TOAST_FADE_MS),
    );
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
          data-leaving={t.leaving ? 'true' : undefined}
          className={`card border-2 shadow-lg ${KIND_STYLES[t.kind]} ${
            t.leaving ? 'toast-leave' : 'toast-enter'
          } cursor-pointer`}
          onClick={() => bus.dismiss(t.id)}
          role="alert"
        >
          <div className="flex items-start justify-between gap-3">
            <p className="text-sm font-medium pr-2">{t.message}</p>
            <button
              type="button"
              className="text-lg leading-none opacity-70 hover:opacity-100"
              aria-label="Fermer"
              onClick={(e) => {
                e.stopPropagation();
                bus.dismiss(t.id);
              }}
            >
              ×
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}
