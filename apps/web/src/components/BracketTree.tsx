'use client';

/**
 * BracketTree — affichage Roland-Garros style.
 *
 * Inspiré du fichier de référence `bracket.html` :
 *   - Colonnes (= tours) avec libellés en haut
 *   - Centrage vertical : R1 stacked, R2+ centre = midpoint des 2 feeders
 *   - Connecteurs SVG en L (paths)
 *   - Cellules : 1 joueur (passage direct, 1 ligne) ou 2 joueurs (match, 2 lignes)
 *   - Vainqueur : fond vert clair + nom gras + scores foncés ; perdant grisé
 */

import { useMemo, useRef } from 'react';

interface PlayerLite {
  id: string;
  firstName: string;
  lastName: string;
  club?: string | null;
}

export interface BracketTreeMatch {
  id: string;
  roundNumber: number;
  roundName?: string | null;
  poolMatchOrder?: number | null;
  player1?: PlayerLite | null;
  player2?: PlayerLite | null;
  winner?: PlayerLite | null;
  status: 'waiting' | 'in_progress' | 'finished' | 'blocked';
  setsP1: number;
  setsP2: number;
  sets?: { p1: number; p2: number }[] | null;
}

interface Props {
  matches: BracketTreeMatch[];
  highlightWinner?: boolean;
}

// ─── Layout constants (RG style) ──────────────────────────────────────────────
const COL_W = 260;
const COL_GAP = 36;
const MATCH_H_FULL = 54; // 2-row match (real)
const MATCH_H_PASS = 26; // 1-row pass
const LABEL_H = 30;
const BASE_GAP = 6;

function computeRoundLabel(roundIdx: number, totalRounds: number): string {
  const remaining = totalRounds - roundIdx;
  if (remaining <= 1) return 'Finale';
  if (remaining === 2) return 'Demi-finale';
  if (remaining === 3) return 'Quart de finale';
  if (remaining === 4) return '8ème de finale';
  if (remaining === 5) return '16ème de finale';
  if (remaining === 6) return '32ème de finale';
  if (remaining === 7) return '64ème de finale';
  if (remaining === 8) return '128ème de finale';
  return `Tour ${roundIdx + 1}`;
}

function isPassMatch(m: BracketTreeMatch): boolean {
  return (
    m.status === 'finished' &&
    !!m.winner &&
    (!m.player1 || !m.player2)
  );
}

function matchHeight(m: BracketTreeMatch | undefined): number {
  if (!m) return MATCH_H_FULL;
  return isPassMatch(m) ? MATCH_H_PASS : MATCH_H_FULL;
}

export function BracketTree({ matches, highlightWinner = true }: Props) {
  const scrollRef = useRef<HTMLDivElement>(null);

  const layout = useMemo(() => {
    // 1. Group matches by round (sorted by poolMatchOrder for deterministic order)
    const byRound = new Map<number, BracketTreeMatch[]>();
    for (const m of matches) {
      const r = m.roundNumber || 1;
      if (!byRound.has(r)) byRound.set(r, []);
      byRound.get(r)!.push(m);
    }
    for (const arr of byRound.values()) {
      arr.sort(
        (a, b) =>
          (a.poolMatchOrder ?? 0) - (b.poolMatchOrder ?? 0),
      );
    }

    const totalRounds = byRound.size > 0 ? Math.max(...byRound.keys()) : 0;
    const columns: BracketTreeMatch[][] = [];
    for (let r = 1; r <= totalRounds; r++) {
      columns.push(byRound.get(r) ?? []);
    }

    // 2. Compute Y-centers per round
    //    R1 : stacked from top (chaque match prend sa hauteur réelle)
    //    R2+ : center of each match = midpoint of its 2 feeder centers
    const centers: number[][] = [];
    if (columns.length === 0) {
      return { columns, totalRounds, centers: [] as number[][], totalH: 0, totalW: 0 };
    }

    // R1 stacking
    const r1Centers: number[] = [];
    let y = LABEL_H;
    for (let i = 0; i < columns[0]!.length; i++) {
      const h = matchHeight(columns[0]![i]);
      r1Centers.push(y + h / 2);
      y += h + (i < columns[0]!.length - 1 ? BASE_GAP : 0);
    }
    centers.push(r1Centers);

    // R2+ midpoints
    for (let r = 1; r < columns.length; r++) {
      const prev = centers[r - 1]!;
      const cur: number[] = [];
      const colSize = columns[r]!.length;
      for (let i = 0; i < colSize; i++) {
        const a = prev[i * 2] ?? prev[prev.length - 1] ?? 0;
        const b = i * 2 + 1 < prev.length ? prev[i * 2 + 1]! : a;
        cur.push((a + b) / 2);
      }
      centers.push(cur);
    }

    const lastRound = centers[centers.length - 1] ?? [];
    const lastY = lastRound.length > 0 ? lastRound[lastRound.length - 1]! : LABEL_H;
    const totalH = Math.max(
      lastY + MATCH_H_FULL / 2 + 16,
      (r1Centers[r1Centers.length - 1] ?? 0) + MATCH_H_FULL / 2 + 16,
    );
    const totalW = totalRounds * (COL_W + COL_GAP) - COL_GAP;

    return { columns, totalRounds, centers, totalH, totalW };
  }, [matches]);

  if (matches.length === 0) {
    return (
      <div
        className="card text-center py-12 text-foreground-muted rounded-2xl"
        data-testid="bracket-empty"
      >
        Tableau final non encore généré.
      </div>
    );
  }

  const { columns, totalRounds, centers, totalH, totalW } = layout;

  // SVG connector paths
  const paths: string[] = [];
  const ec = 'rgb(203 213 225)';
  for (let r = 0; r < totalRounds - 1; r++) {
    const leftX = r * (COL_W + COL_GAP) + COL_W;
    const rightX = (r + 1) * (COL_W + COL_GAP);
    const midX = (leftX + rightX) / 2;
    const prevC = centers[r]!;
    const nextC = centers[r + 1]!;
    for (let m = 0; m < columns[r + 1]!.length; m++) {
      const yOut = nextC[m]!;
      const i1 = m * 2;
      const i2 = m * 2 + 1;
      const y1 = prevC[i1] ?? null;
      const y2 = i2 < prevC.length ? prevC[i2]! : null;
      if (y1 === null) continue;
      const yMid = y2 !== null ? (y1 + y2) / 2 : y1;
      paths.push(`M${leftX},${y1} H${midX} V${yMid}`);
      if (y2 !== null) {
        paths.push(`M${leftX},${y2} H${midX} V${yMid}`);
      }
      paths.push(`M${midX},${yMid} V${yOut} H${rightX}`);
    }
  }

  return (
    <div data-testid="bracket-tree" className="w-full">
      <div ref={scrollRef} className="overflow-x-auto pb-2">
        <div
          className="relative"
          style={{ width: totalW, height: totalH, minWidth: totalW }}
        >
          {/* SVG connectors */}
          <svg
            className="absolute top-0 left-0 pointer-events-none"
            width={totalW}
            height={totalH}
          >
            {paths.map((d, i) => (
              <path
                key={i}
                d={d}
                fill="none"
                stroke={ec}
                strokeWidth={1}
              />
            ))}
          </svg>

          {/* Round labels */}
          {columns.map((_, r) => {
            const x = r * (COL_W + COL_GAP);
            return (
              <div
                key={`lbl-${r}`}
                className="absolute text-[11px] uppercase tracking-wider font-semibold text-foreground-muted text-center"
                style={{ left: x, top: 0, width: COL_W }}
              >
                {computeRoundLabel(r, totalRounds)}
              </div>
            );
          })}

          {/* Match cells */}
          {columns.map((col, r) =>
            col.map((m, i) => {
              const cy = centers[r]![i]!;
              const h = matchHeight(m);
              const top = cy - h / 2;
              const left = r * (COL_W + COL_GAP);
              return (
                <div
                  key={m.id}
                  className="absolute"
                  style={{ left, top, width: COL_W }}
                  data-testid={`bracket-match-${m.id}`}
                >
                  <RGMatchCell match={m} highlightWinner={highlightWinner} />
                </div>
              );
            }),
          )}
        </div>
      </div>
    </div>
  );
}

/** Cellule de match (RG style) : 1 ou 2 lignes selon match réel ou passage. */
function RGMatchCell({
  match,
  highlightWinner,
}: {
  match: BracketTreeMatch;
  highlightWinner: boolean;
}) {
  const isFinished = match.status === 'finished';
  const winnerId = match.winner?.id ?? null;
  const isPass = isPassMatch(match);

  // Calcul des numéros de position FFTT (1..nextPower) pour le 1er tour.
  // poolMatchOrder = numéro de paire dans le round. Position du slot p1 = 2k-1,
  // position du slot p2 = 2k (k = poolMatchOrder).
  const isFirstRound = match.roundNumber === 1;
  const k = match.poolMatchOrder ?? 0;
  const posP1 = isFirstRound && k > 0 ? 2 * k - 1 : null;
  const posP2 = isFirstRound && k > 0 ? 2 * k : null;

  if (isPass && match.winner) {
    // Cellule passage : 1 seule ligne, numéro de position en gauche
    const passPos = match.player1 ? posP1 : posP2;
    return (
      <div className="rounded-md border border-border/40 bg-bg-alt/30 px-2 py-1 flex items-center gap-1.5 h-full">
        {passPos !== null && (
          <span className="text-[10px] tabular text-foreground-subtle font-mono w-5 text-right flex-shrink-0">
            {passPos}
          </span>
        )}
        <PlayerAvatar player={match.winner} />
        <span className="text-[13px] font-medium truncate flex-1 text-foreground">
          {match.winner.lastName} {match.winner.firstName[0]}.
        </span>
        {match.winner.club && (
          <span className="text-[10px] text-foreground-subtle flex-shrink-0">
            {match.winner.club.split(' ')[0]?.slice(0, 4)}
          </span>
        )}
      </div>
    );
  }

  const p1Win = highlightWinner && isFinished && winnerId === match.player1?.id;
  const p2Win = highlightWinner && isFinished && winnerId === match.player2?.id;
  const sets = Array.isArray(match.sets) ? match.sets : [];
  const inProgress = match.status === 'in_progress';

  return (
    <div
      className={`rounded-md overflow-hidden border ${
        inProgress ? 'border-primary ring-1 ring-primary/30' : 'border-border/50'
      }`}
    >
      <PlayerRow
        player={match.player1}
        sets={sets}
        side="p1"
        isWinner={p1Win}
        totalSets={match.setsP1}
        position="top"
        seedPos={posP1}
      />
      <PlayerRow
        player={match.player2}
        sets={sets}
        side="p2"
        isWinner={p2Win}
        totalSets={match.setsP2}
        position="bot"
        seedPos={posP2}
      />
    </div>
  );
}

function PlayerAvatar({ player }: { player?: PlayerLite | null }) {
  if (!player) {
    return <span className="inline-flex w-5 h-5 rounded-full bg-bg-alt border border-border/60 flex-shrink-0" />;
  }
  const initial = (player.lastName?.[0] ?? '?').toUpperCase();
  const palette = [
    'bg-primary/20 text-primary',
    'bg-warning/20 text-warning',
    'bg-success/20 text-success',
    'bg-foreground/10 text-foreground',
  ];
  const color = palette[initial.charCodeAt(0) % palette.length] ?? palette[0]!;
  return (
    <span
      className={`inline-flex w-5 h-5 items-center justify-center rounded-full text-[10px] font-bold flex-shrink-0 ${color}`}
    >
      {initial}
    </span>
  );
}

function PlayerRow({
  player,
  sets,
  side,
  isWinner,
  totalSets,
  position,
  seedPos,
}: {
  player?: PlayerLite | null;
  sets: { p1: number; p2: number }[];
  side: 'p1' | 'p2';
  isWinner: boolean;
  totalSets: number;
  position: 'top' | 'bot';
  seedPos?: number | null;
}) {
  // Toujours 5 colonnes de scores (placeholder · si non joué)
  const cells = Array.from({ length: 5 }, (_, i) => sets[i]);
  const club = player?.club?.split(' ')[0]?.slice(0, 4);

  return (
    <div
      className={`flex items-center gap-1.5 px-2 py-0.5 bg-surface ${
        position === 'top' ? 'border-b border-border/30' : ''
      } ${isWinner ? 'bg-success-soft/40' : ''}`}
      style={{ height: MATCH_H_FULL / 2 }}
    >
      {seedPos !== null && seedPos !== undefined && (
        <span className="text-[10px] tabular text-foreground-subtle font-mono w-5 text-right flex-shrink-0">
          {seedPos}
        </span>
      )}
      <PlayerAvatar player={player} />
      {isWinner ? (
        <span className="text-success text-xs flex-shrink-0">✓</span>
      ) : (
        <span className="w-3 flex-shrink-0" />
      )}
      <span
        className={`truncate text-[13px] flex-1 ${
          isWinner
            ? 'font-semibold text-foreground'
            : player
              ? 'text-foreground-muted'
              : 'italic text-foreground-subtle'
        }`}
      >
        {player ? `${player.lastName} ${player.firstName[0]}.` : '—'}
        {club && (
          <span className="text-[10px] text-foreground-subtle ml-1">
            ({club})
          </span>
        )}
      </span>
      <div className="flex items-center gap-0.5 flex-shrink-0">
        {cells.map((s, i) => {
          if (!s || (s.p1 === 0 && s.p2 === 0)) {
            return (
              <span
                key={i}
                className="font-mono text-[10px] tabular w-3 text-center text-foreground-subtle/30"
              >
                ·
              </span>
            );
          }
          const score = side === 'p1' ? s.p1 : s.p2;
          const oppScore = side === 'p1' ? s.p2 : s.p1;
          const won = score > oppScore;
          return (
            <span
              key={i}
              className={`font-mono text-[10px] tabular w-3 text-center ${
                won ? 'font-bold text-foreground' : 'text-foreground-muted'
              }`}
            >
              {score}
            </span>
          );
        })}
      </div>
      <span
        className={`font-mono tabular text-[12px] w-3 text-center flex-shrink-0 ${
          isWinner ? 'font-bold text-foreground' : 'text-foreground-subtle'
        }`}
      >
        {totalSets || ''}
      </span>
    </div>
  );
}
