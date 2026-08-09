'use client';

/**
 * Espace « Mode TV » de la page Paramètres.
 *
 * Le mode TV n'est lançable que depuis ici : le bouton public de `/live` a été
 * retiré, et la route `/tv` est réservée au rôle admin.
 *
 * L'intervalle de rotation est persisté en base (`SiteSetting`) et non en
 * `localStorage` : l'écran du hall est un autre appareil que celui de
 * l'administrateur, un réglage local ne lui serait jamais appliqué.
 */

import { useEffect, useState } from 'react';
import { toast } from '@/components/ui/toast';
import { apiJson, ApiError } from '@/lib/api-client';
import {
  TV_INTERVAL_KEY,
  TV_INTERVAL_DEFAULT_MS,
  TV_INTERVAL_MIN_MS,
  TV_INTERVAL_MAX_MS,
  clampTvInterval,
} from '@/lib/tv.shared';

export function TvModeCard() {
  const [value, setValue] = useState(TV_INTERVAL_DEFAULT_MS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    fetch('/api/settings')
      .then((r) => r.json())
      .then((j) => {
        const raw = j.data?.[TV_INTERVAL_KEY];
        if (raw !== undefined) setValue(clampTvInterval(raw));
      })
      .catch(() => undefined)
      .finally(() => setLoading(false));
  }, []);

  const save = async () => {
    setSaving(true);
    try {
      await apiJson(`/api/settings/${TV_INTERVAL_KEY}`, {
        method: 'PUT',
        body: JSON.stringify({ value: String(value) }),
      });
      setDirty(false);
      toast.success(`Rotation réglée sur ${value / 1000} s`);
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : 'Erreur');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="card rounded-2xl" data-testid="tv-mode-card">
      <h2 className="font-heading text-xl uppercase tracking-wide mb-3">Mode TV</h2>
      <p className="text-sm text-foreground-muted mb-4">
        Affiche en plein écran les salles configurées dans{' '}
        <span className="font-medium">Salles</span>, avec le rendu exact de l&apos;éditeur
        visuel (tables, rotations, entrées, buvette, WC, flèches). Les salles défilent
        automatiquement. Réservé à l&apos;administrateur.
      </p>

      <label className="block text-xs font-medium text-foreground-muted mb-1">
        Temps d&apos;affichage de chaque salle
      </label>
      <div className="flex items-center gap-4">
        <span className="text-sm text-foreground-muted w-12">{TV_INTERVAL_MIN_MS / 1000}s</span>
        <input
          type="range"
          min={TV_INTERVAL_MIN_MS}
          max={TV_INTERVAL_MAX_MS}
          step={1000}
          value={value}
          disabled={loading}
          onChange={(e) => {
            setValue(Number(e.target.value));
            setDirty(true);
          }}
          className="flex-1 accent-primary"
          data-testid="tv-interval-range"
        />
        <span className="text-sm text-foreground-muted w-12">{TV_INTERVAL_MAX_MS / 1000}s</span>
      </div>
      <p className="text-center text-sm font-medium mt-2">{value / 1000}s</p>

      <div className="flex flex-wrap items-center gap-2 mt-4">
        <a
          href="/tv"
          target="_blank"
          rel="noreferrer"
          className="btn-primary text-sm px-4 py-2 rounded"
          data-testid="tv-launch"
        >
          Lancer le mode TV ↗
        </a>
        <button
          type="button"
          onClick={save}
          disabled={loading || saving || !dirty}
          className="btn-secondary text-sm px-4 py-2 rounded disabled:opacity-50"
          data-testid="tv-interval-save"
        >
          {saving ? 'Enregistrement…' : 'Enregistrer la rotation'}
        </button>
      </div>

      <p className="text-xs text-foreground-subtle mt-3">
        Sur l&apos;écran du hall : ouvrir <span className="font-mono">/tv</span>, puis
        « Plein écran ». Raccourcis : ← → changer de salle, Espace mettre en pause,
        F plein écran.
      </p>
    </div>
  );
}
