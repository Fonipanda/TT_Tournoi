'use client';

import { useEffect, useState } from 'react';
import { apiGet } from '@/lib/api-client';
import {
  formatCoefficient,
  formatPoints,
  type MatchPointsExclusion,
  type MatchPointsKind,
} from '@/lib/fftt/points';

interface MatchLine {
  matchId: string;
  roundName: string | null;
  poolNumber: number | null;
  playedAt: string | null;
  opponentName: string | null;
  opponentClub: string | null;
  opponentPoints: number | null;
  playerPoints: number;
  victory: boolean;
  scoreLabel: string;
  gap: number;
  kind: MatchPointsKind;
  rawPoints: number;
  points: number;
  excluded: MatchPointsExclusion | null;
}

interface BracketGroup {
  bracketId: string;
  bracketName: string;
  tournamentName: string;
  basePoints: number;
  subtotal: number;
  matches: MatchLine[];
}

interface PointsReport {
  playerName: string;
  coefficient: number;
  basePoints: number;
  totalPoints: number;
  projectedPoints: number;
  currentPoints: number;
  victories: number;
  defeats: number;
  perfs: number;
  contres: number;
  groups: BracketGroup[];
}

const EXCLUSION_LABEL: Record<MatchPointsExclusion, string> = {
  forfait: 'Forfait',
  sans_adversaire: 'Passage direct',
};

/** Couleur du solde : vert s'il progresse, rouge s'il recule, neutre à zéro. */
function deltaClass(value: number): string {
  if (value > 0) return 'text-success';
  if (value < 0) return 'text-danger';
  return '';
}

function roundLabel(m: MatchLine): string {
  if (m.poolNumber !== null) return `Poule ${m.poolNumber}`;
  return m.roundName ?? 'Tableau';
}

export function MesPointsContent({ playerId }: { playerId: string }) {
  const [report, setReport] = useState<PointsReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setFailed(false);
    apiGet<PointsReport>(`/api/players/${playerId}/points`)
      .then((res) => {
        if (!cancelled) setReport(res);
      })
      .catch(() => {
        if (!cancelled) {
          setReport(null);
          setFailed(true);
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [playerId]);

  return (
    <div data-testid="mes-points">
      <h1 className="font-heading text-3xl uppercase tracking-wide mb-2">Mes points</h1>
      {report && (
        <p className="text-foreground-muted text-sm mb-6">
          Coefficient d&apos;épreuve appliqué :{' '}
          <span className="tabular">{formatCoefficient(report.coefficient)}</span>.
        </p>
      )}

      {loading && <p className="text-foreground-muted">Calcul en cours…</p>}
      {failed && <p className="text-foreground-muted">Calcul momentanément indisponible.</p>}

      {!loading && !failed && report && (
        <>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            <div className="card rounded-2xl text-center">
              <p className="text-xs uppercase tracking-widest text-foreground-muted">
                Points de départ
              </p>
              <p className="font-heading text-4xl tabular mt-1">
                {Math.round(report.basePoints)}
              </p>
              <p className="text-xs text-foreground-muted mt-1">Classement en début d&apos;épreuve</p>
            </div>
            <div className="card rounded-2xl text-center">
              <p className="text-xs uppercase tracking-widest text-foreground-muted">
                Gain / perte
              </p>
              <p className={`font-heading text-4xl tabular mt-1 ${deltaClass(report.totalPoints)}`}>
                {formatPoints(report.totalPoints, true)}
              </p>
              <p className="text-xs text-foreground-muted mt-1">
                {report.victories} V · {report.defeats} D
                {report.perfs > 0 && ` · ${report.perfs} perf`}
                {report.contres > 0 && ` · ${report.contres} contre`}
              </p>
            </div>
            <div className="card rounded-2xl text-center">
              <p className="text-xs uppercase tracking-widest text-foreground-muted">
                Points projetés
              </p>
              <p className="font-heading text-4xl tabular text-primary mt-1">
                {Math.round(report.projectedPoints)}
              </p>
              <p className="text-xs text-foreground-muted mt-1">Avant homologation FFTT</p>
            </div>
          </div>

          {report.groups.length === 0 ? (
            <p className="text-foreground-muted">
              Aucune partie terminée pour le moment. Le calcul apparaîtra dès votre premier match
              joué.
            </p>
          ) : (
            report.groups.map((g) => <BracketPoints key={g.bracketId} group={g} />)
          )}

          <p className="text-xs text-foreground-muted mt-6">
            Calcul indicatif. Seule l&apos;homologation FFTT fait foi. Les forfaits et les passages
            directs sont listés pour mémoire mais ne rapportent aucun point.
          </p>
        </>
      )}
    </div>
  );
}

/** Détail d'un tableau : une ligne par partie, plus le sous-total de l'épreuve. */
function BracketPoints({ group }: { group: BracketGroup }) {
  return (
    <section className="mb-6" data-testid={`points-bracket-${group.bracketId}`}>
      <div className="flex items-baseline justify-between flex-wrap gap-2 mb-3">
        <div>
          <h2 className="font-heading text-xl uppercase tracking-wide">{group.bracketName}</h2>
          <p className="text-sm text-foreground-muted">
            {group.tournamentName} · départ {Math.round(group.basePoints)} pts
          </p>
        </div>
        <p className={`font-heading text-2xl tabular ${deltaClass(group.subtotal)}`}>
          {formatPoints(group.subtotal, true)}
        </p>
      </div>

      <div className="card rounded-2xl overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-xs uppercase tracking-widest text-foreground-muted text-left">
              <th className="pb-2 font-normal">Tour</th>
              <th className="pb-2 font-normal">Adversaire</th>
              <th className="pb-2 font-normal text-right">Ses pts</th>
              <th className="pb-2 font-normal text-center">Résultat</th>
              <th className="pb-2 font-normal text-right">Écart</th>
              <th className="pb-2 font-normal">Nature</th>
              <th className="pb-2 font-normal text-right">Points</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {group.matches.map((m) => (
              <tr
                key={m.matchId}
                className={m.excluded ? 'opacity-50' : undefined}
                data-testid={`points-match-${m.matchId}`}
              >
                <td className="py-2 pr-3 whitespace-nowrap">{roundLabel(m)}</td>
                <td className="py-2 pr-3">
                  <span className="font-medium">{m.opponentName ?? '—'}</span>
                  {m.opponentClub && (
                    <span className="text-foreground-muted"> · {m.opponentClub}</span>
                  )}
                </td>
                <td className="py-2 pr-3 text-right tabular">
                  {m.opponentPoints === null ? '—' : Math.round(m.opponentPoints)}
                </td>
                <td className="py-2 pr-3 text-center whitespace-nowrap">
                  <span className={m.victory ? 'text-success' : 'text-danger'}>
                    {m.victory ? 'V' : 'D'}
                  </span>{' '}
                  <span className="tabular text-foreground-muted">{m.scoreLabel}</span>
                </td>
                <td className="py-2 pr-3 text-right tabular">
                  {m.excluded ? '—' : Math.round(m.gap)}
                </td>
                <td className="py-2 pr-3">
                  <NatureBadge line={m} />
                </td>
                <td
                  className={`py-2 text-right tabular font-medium ${
                    m.excluded ? '' : deltaClass(m.points)
                  }`}
                >
                  {m.excluded ? '—' : formatPoints(m.points, true)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

/**
 * Qualifie la partie : performance, contre, ou résultat conforme au classement.
 *
 * Les parties hors barème portent leur motif plutôt qu'une nature, afin que la
 * ligne à « — point » se lise sans explication supplémentaire.
 */
function NatureBadge({ line }: { line: MatchLine }) {
  if (line.excluded) {
    return (
      <span className="text-xs px-2 py-1 rounded-full bg-surface-muted text-foreground-muted whitespace-nowrap">
        {EXCLUSION_LABEL[line.excluded]}
      </span>
    );
  }
  if (line.kind === 'perf') {
    return (
      <span className="text-xs px-2 py-1 rounded-full bg-success-soft text-success whitespace-nowrap">
        Performance
      </span>
    );
  }
  if (line.kind === 'contre') {
    return (
      <span className="text-xs px-2 py-1 rounded-full bg-danger-soft text-danger whitespace-nowrap">
        Contre
      </span>
    );
  }
  return <span className="text-xs text-foreground-muted">Normale</span>;
}
