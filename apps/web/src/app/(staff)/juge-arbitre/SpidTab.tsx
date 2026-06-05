'use client';

/**
 * SpidTab — Onglet "SPID" du Juge-Arbitre.
 *
 * Regroupe les fonctionnalités d'échange et de saisie SPID :
 * - Export XML SPID des résultats (existant)
 * - Export CSV pointage par tableau (format SPIDD/OTC)
 * - Niveaux de saisie : tableau de bord d'avancement par bracket
 * - Vérification des licences en masse (re-sync FFTT)
 *
 * Inspiré des modules OTCv2.5 (Inscriptions, Gestion des tables, Sauvegardes).
 */

import { useEffect, useState, useCallback } from 'react';

interface BracketStat {
  id: string;
  name: string;
  category: string;
  registered: number;
  total: number;
  finished: number;
  inProgress: number;
  waiting: number;
  blocked: number;
  poolMatches: number;
  elimMatches: number;
  progress: number;
}

interface VerifyReport {
  ok: boolean;
  checked: number;
  updated: number;
  unchanged: number;
  errors: { licenseNumber: string; name: string; message: string }[];
}

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export function SpidTab() {
  const [stats, setStats] = useState<BracketStat[]>([]);
  const [loading, setLoading] = useState(true);
  const [verifyRunning, setVerifyRunning] = useState(false);
  const [verifyReport, setVerifyReport] = useState<VerifyReport | null>(null);

  const refresh = useCallback(async () => {
    try {
      const r = await fetch('/api/spid/niveaux', { cache: 'no-store' });
      const j = await r.json();
      setStats(j.data ?? []);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
    const id = setInterval(refresh, 30_000);
    return () => clearInterval(id);
  }, [refresh]);

  const handleExportSPID = async () => {
    try {
      const r = await fetch('/api/export/spid', { cache: 'no-store' });
      if (!r.ok) throw new Error('Export failed');
      const blob = await r.blob();
      downloadBlob(blob, `export-spid-${new Date().toISOString().slice(0, 10)}.xml`);
    } catch {
      alert("Erreur lors de l'export SPID");
    }
  };

  const handleExportPointage = async (bracketId: string, bracketName: string) => {
    try {
      const r = await fetch(`/api/export/pointage/${bracketId}`, { cache: 'no-store' });
      if (!r.ok) throw new Error('Export failed');
      const blob = await r.blob();
      const safeName = bracketName.replace(/[^\w\-]+/g, '_');
      downloadBlob(blob, `inscritsPresentsDossardsTab_${safeName}.csv`);
    } catch {
      alert("Erreur lors de l'export pointage");
    }
  };

  const handleVerifyLicenses = async () => {
    if (!confirm('Lancer la vérification de toutes les licences ? Peut prendre quelques minutes.')) return;
    setVerifyRunning(true);
    setVerifyReport(null);
    try {
      const r = await fetch('/api/spid/verify-licenses', { method: 'POST' });
      const j = (await r.json()) as VerifyReport;
      setVerifyReport(j);
    } catch {
      alert('Erreur lors de la vérification');
    } finally {
      setVerifyRunning(false);
    }
  };

  return (
    <div className="flex flex-col gap-6">
      {/* Section: Échanges SPID */}
      <section className="card p-4 rounded-xl">
        <h2 className="font-heading text-lg uppercase tracking-wide mb-3">Échanges SPID</h2>
        <p className="text-sm text-foreground-muted mb-4">
          Exports compatibles avec SPIDD / OTC pour transfert par clé USB ou réseau.
        </p>
        <div className="flex flex-wrap gap-3">
          <button
            type="button"
            onClick={handleExportSPID}
            className="btn-primary text-sm px-4 py-2 rounded"
          >
            Exporter résultats (XML SPID)
          </button>
          <button
            type="button"
            onClick={handleVerifyLicenses}
            disabled={verifyRunning}
            className="btn-secondary text-sm px-4 py-2 rounded disabled:opacity-50"
          >
            {verifyRunning ? 'Vérification…' : 'Vérifier toutes les licences'}
          </button>
        </div>

        {verifyReport && (
          <div className="mt-4 text-sm bg-bg-alt rounded-lg p-3">
            <p className="font-medium mb-1">
              Vérification terminée : {verifyReport.checked} licences contrôlées
            </p>
            <p className="text-foreground-muted">
              {verifyReport.updated} mise(s) à jour · {verifyReport.unchanged} inchangée(s)
              {verifyReport.errors.length > 0 && ` · ${verifyReport.errors.length} erreur(s)`}
            </p>
            {verifyReport.errors.length > 0 && (
              <details className="mt-2">
                <summary className="cursor-pointer text-warning text-xs">
                  Voir les erreurs
                </summary>
                <ul className="mt-2 text-xs space-y-1">
                  {verifyReport.errors.map((e, i) => (
                    <li key={i}>
                      <span className="font-mono">{e.licenseNumber}</span> {e.name} — {e.message}
                    </li>
                  ))}
                </ul>
              </details>
            )}
          </div>
        )}
      </section>

      {/* Section: Niveaux de saisie + pointage */}
      <section className="card p-4 rounded-xl">
        <h2 className="font-heading text-lg uppercase tracking-wide mb-3">
          Niveaux de saisie / Pointage
        </h2>
        <p className="text-sm text-foreground-muted mb-4">
          Avancement de la saisie des résultats par tableau. Bouton « CSV » pour exporter la
          liste des inscrits présents au format SPIDD (clé USB).
        </p>

        {loading && <p className="text-foreground-muted">Chargement…</p>}
        {!loading && stats.length === 0 && (
          <p className="text-foreground-muted">Aucun tableau pour ce tournoi.</p>
        )}

        {!loading && stats.length > 0 && (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left text-xs text-foreground-muted uppercase">
                  <th className="py-2 pr-3">Tableau</th>
                  <th className="py-2 pr-3 text-center">Inscrits</th>
                  <th className="py-2 pr-3 text-center">Poules</th>
                  <th className="py-2 pr-3 text-center">Élimination</th>
                  <th className="py-2 pr-3 text-center">Faits</th>
                  <th className="py-2 pr-3 text-center">En cours</th>
                  <th className="py-2 pr-3 text-center">En attente</th>
                  <th className="py-2 pr-3">Avancement</th>
                  <th className="py-2 text-right">Pointage</th>
                </tr>
              </thead>
              <tbody>
                {stats.map((s) => (
                  <tr key={s.id} className="border-b border-border/40 hover:bg-bg-alt/50">
                    <td className="py-2 pr-3 font-medium">
                      {s.name}
                      {s.category && (
                        <span className="text-xs text-foreground-muted ml-2">{s.category}</span>
                      )}
                    </td>
                    <td className="py-2 pr-3 text-center tabular">{s.registered}</td>
                    <td className="py-2 pr-3 text-center tabular">{s.poolMatches}</td>
                    <td className="py-2 pr-3 text-center tabular">{s.elimMatches}</td>
                    <td className="py-2 pr-3 text-center tabular text-success">{s.finished}</td>
                    <td className="py-2 pr-3 text-center tabular text-warning">{s.inProgress}</td>
                    <td className="py-2 pr-3 text-center tabular text-foreground-muted">{s.waiting}</td>
                    <td className="py-2 pr-3 min-w-[100px]">
                      <div className="flex items-center gap-2">
                        <div className="flex-1 h-2 bg-bg-alt rounded-full overflow-hidden">
                          <div
                            className="h-full bg-primary"
                            style={{ width: `${s.progress}%` }}
                          />
                        </div>
                        <span className="text-xs tabular w-9 text-right">{s.progress}%</span>
                      </div>
                    </td>
                    <td className="py-2 text-right">
                      <button
                        type="button"
                        onClick={() => handleExportPointage(s.id, s.name)}
                        className="text-xs px-2 py-1 rounded bg-bg-alt hover:bg-bg-alt/80 border border-border"
                        title="Exporter la liste des inscrits présents (CSV SPIDD)"
                      >
                        CSV
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
