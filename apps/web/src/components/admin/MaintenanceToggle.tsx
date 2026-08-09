'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from '@/components/ui/toast';
import { apiJson, ApiError } from '@/lib/api-client';

const ENABLED_KEY = 'maintenance.enabled';
const MESSAGE_KEY = 'maintenance.message';

const DEFAULT_MESSAGE =
  'Le site est temporairement en maintenance. Merci de revenir dans quelques instants.';

/**
 * Bascule du mode maintenance.
 *
 * Quand il est actif, les visiteurs et les joueurs sont redirigés vers
 * `/maintenance`. Les comptes d'organisation (admin, juge-arbitre) conservent
 * l'accès complet au site, ce qui permet de désactiver le mode ensuite.
 */
export function MaintenanceToggle() {
  const router = useRouter();
  const [enabled, setEnabled] = useState(false);
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetch('/api/settings')
      .then((r) => r.json())
      .then((j) => {
        setEnabled(j.data?.[ENABLED_KEY] === 'true');
        setMessage(j.data?.[MESSAGE_KEY] ?? '');
      })
      .catch(() => undefined)
      .finally(() => setLoading(false));
  }, []);

  const persist = async (nextEnabled: boolean, nextMessage: string) => {
    setSaving(true);
    try {
      await apiJson(`/api/settings/${ENABLED_KEY}`, {
        method: 'PUT',
        body: JSON.stringify({ value: nextEnabled ? 'true' : 'false' }),
      });
      await apiJson(`/api/settings/${MESSAGE_KEY}`, {
        method: 'PUT',
        body: JSON.stringify({ value: nextMessage }),
      });
      setEnabled(nextEnabled);
      toast.success(nextEnabled ? 'Mode maintenance ACTIVÉ' : 'Mode maintenance désactivé');
      router.refresh();
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : 'Erreur');
    } finally {
      setSaving(false);
    }
  };

  const toggle = async () => {
    const next = !enabled;
    if (
      next &&
      !confirm(
        'Activer le mode maintenance ?\n\n' +
          "Les visiteurs et les joueurs n'auront plus accès au site. " +
          "Les comptes d'organisation gardent l'accès.",
      )
    ) {
      return;
    }
    await persist(next, message);
  };

  return (
    <div className="card rounded-2xl" data-testid="maintenance-toggle">
      <div className="flex items-center justify-between gap-3 mb-3">
        <h2 className="font-heading text-xl uppercase tracking-wide">Mode maintenance</h2>
        <span
          className={`text-xs px-2 py-1 rounded-full font-medium ${
            enabled ? 'bg-danger text-white' : 'bg-bg-alt text-foreground-muted'
          }`}
          data-testid="maintenance-status"
        >
          {loading ? '…' : enabled ? 'ACTIF' : 'Inactif'}
        </span>
      </div>

      <p className="text-sm text-foreground-muted mb-4">
        Redirige les visiteurs et les joueurs vers une page d&apos;attente. Les comptes
        d&apos;organisation (admin, juge-arbitre) continuent d&apos;accéder normalement au site.
      </p>

      <label className="block text-xs font-medium text-foreground-muted mb-1">
        Message affiché aux visiteurs
      </label>
      <textarea
        value={message}
        onChange={(e) => setMessage(e.target.value)}
        rows={3}
        disabled={loading}
        placeholder={DEFAULT_MESSAGE}
        className="w-full text-sm border border-border rounded-lg p-2 bg-bg resize-y mb-3"
        data-testid="maintenance-message"
      />

      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={toggle}
          disabled={loading || saving}
          className={`text-sm px-4 py-2 rounded-full disabled:opacity-50 ${
            enabled ? 'btn-secondary' : 'btn-primary'
          }`}
          data-testid="maintenance-button"
        >
          {saving ? 'Enregistrement…' : enabled ? 'Désactiver la maintenance' : 'Activer la maintenance'}
        </button>

        {enabled && (
          <button
            type="button"
            onClick={() => persist(true, message)}
            disabled={saving}
            className="text-sm text-foreground-muted hover:underline"
          >
            Enregistrer le message
          </button>
        )}

        <a
          href="/maintenance"
          target="_blank"
          rel="noreferrer"
          className="text-sm text-primary hover:underline ml-auto"
        >
          Prévisualiser ↗
        </a>
      </div>
    </div>
  );
}
