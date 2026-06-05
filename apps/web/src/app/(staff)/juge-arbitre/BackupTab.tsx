'use client';

/**
 * BackupTab — Onglet "Sauvegardes" du Juge-Arbitre.
 *
 * Inspiré de OTC Sauvegardes :
 * - Sauvegarde JSON manuelle complète du tournoi actif
 * - Restauration depuis fichier JSON
 * - Sauvegarde automatique périodique (LocalStorage)
 */

import { useEffect, useState } from 'react';

const AUTO_KEY = 'tt_backup_auto_minutes';

export function BackupTab() {
  const [autoMinutes, setAutoMinutes] = useState<number>(0);
  const [restoreLoading, setRestoreLoading] = useState(false);
  const [lastBackup, setLastBackup] = useState<string | null>(null);
  const [restoreReport, setRestoreReport] = useState<{ ok: boolean; matchesUpdated?: number; error?: string } | null>(null);

  // Hydrate from localStorage
  useEffect(() => {
    const v = localStorage.getItem(AUTO_KEY);
    if (v) setAutoMinutes(parseInt(v, 10) || 0);
    const last = localStorage.getItem('tt_last_backup_at');
    if (last) setLastBackup(last);
  }, []);

  // Auto-backup interval
  useEffect(() => {
    if (autoMinutes <= 0) return;
    const tick = async () => {
      await doBackup(true);
    };
    const id = setInterval(tick, autoMinutes * 60_000);
    return () => clearInterval(id);
  }, [autoMinutes]);

  const doBackup = async (silent = false) => {
    try {
      const r = await fetch('/api/spid/backup', { cache: 'no-store' });
      if (!r.ok) throw new Error('Échec de la sauvegarde');
      const blob = await r.blob();
      const filename = r.headers.get('Content-Disposition')?.match(/filename="([^"]+)"/)?.[1]
        ?? `backup_${new Date().toISOString().slice(0, 16).replace(/[:T]/g, '-')}.json`;
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      a.click();
      URL.revokeObjectURL(url);
      const stamp = new Date().toLocaleString('fr-FR');
      localStorage.setItem('tt_last_backup_at', stamp);
      setLastBackup(stamp);
      if (!silent) alert('Sauvegarde téléchargée');
    } catch (e) {
      if (!silent) alert('Erreur de sauvegarde : ' + (e instanceof Error ? e.message : 'inconnu'));
    }
  };

  const handleAutoChange = (mins: number) => {
    setAutoMinutes(mins);
    localStorage.setItem(AUTO_KEY, String(mins));
  };

  const handleRestore = async (file: File) => {
    if (!confirm('La restauration écrasera les résultats actuels du tournoi. Continuer ?')) return;
    setRestoreLoading(true);
    setRestoreReport(null);
    try {
      const text = await file.text();
      const data = JSON.parse(text);
      const r = await fetch('/api/spid/restore', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tournament: data.tournament }),
      });
      const j = await r.json();
      if (!r.ok) {
        setRestoreReport({ ok: false, error: j.error ?? 'Échec' });
      } else {
        setRestoreReport({ ok: true, matchesUpdated: j.matchesUpdated });
      }
    } catch (e) {
      setRestoreReport({ ok: false, error: e instanceof Error ? e.message : 'Fichier invalide' });
    } finally {
      setRestoreLoading(false);
    }
  };

  return (
    <div className="flex flex-col gap-6 max-w-3xl">
      <section className="card p-4 rounded-xl">
        <h2 className="font-heading text-lg uppercase tracking-wide mb-3">Sauvegarde manuelle</h2>
        <p className="text-sm text-foreground-muted mb-4">
          Télécharge un fichier JSON contenant l'intégralité du tournoi actif (joueurs,
          inscriptions, matches, salles, tables). Conservez ce fichier sur clé USB ou dans le cloud.
        </p>
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => doBackup(false)}
            className="btn-primary text-sm px-4 py-2 rounded"
          >
            Sauvegarder maintenant
          </button>
          {lastBackup && (
            <span className="text-xs text-foreground-muted">
              Dernière sauvegarde : {lastBackup}
            </span>
          )}
        </div>
      </section>

      <section className="card p-4 rounded-xl">
        <h2 className="font-heading text-lg uppercase tracking-wide mb-3">
          Sauvegarde automatique
        </h2>
        <p className="text-sm text-foreground-muted mb-4">
          Lance un téléchargement périodique tant que cette page reste ouverte.
          0 = désactivé.
        </p>
        <div className="flex items-center gap-3">
          <label className="text-sm">Intervalle (minutes) :</label>
          <input
            type="number"
            min={0}
            max={120}
            value={autoMinutes}
            onChange={(e) => handleAutoChange(parseInt(e.target.value, 10) || 0)}
            className="w-24 px-3 py-1.5 rounded border border-border bg-bg text-sm tabular"
          />
          {autoMinutes > 0 && (
            <span className="text-xs text-success">● actif</span>
          )}
        </div>
      </section>

      <section className="card p-4 rounded-xl">
        <h2 className="font-heading text-lg uppercase tracking-wide mb-3">Restauration</h2>
        <p className="text-sm text-foreground-muted mb-4">
          Restaure les <strong>résultats des matches</strong> (scores, vainqueurs, statuts)
          depuis un fichier de sauvegarde JSON. Les joueurs/inscriptions ne sont pas écrasés.
        </p>
        <input
          type="file"
          accept=".json,application/json"
          disabled={restoreLoading}
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) handleRestore(f);
          }}
          className="text-sm"
        />
        {restoreLoading && <p className="text-foreground-muted text-sm mt-2">Restauration en cours…</p>}
        {restoreReport && (
          <div className={`mt-3 text-sm p-3 rounded ${restoreReport.ok ? 'bg-success-soft text-success' : 'bg-danger-soft text-danger'}`}>
            {restoreReport.ok
              ? `Restauration réussie : ${restoreReport.matchesUpdated} matches mis à jour.`
              : `Échec : ${restoreReport.error}`}
          </div>
        )}
      </section>
    </div>
  );
}
