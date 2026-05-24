'use client';

/**
 * BracketTree — affichage visuel d'un tableau d'élimination directe.
 *
 * Layout : colonnes de matches par tour, espacement vertical doublé à chaque tour,
 * connecteurs CSS géométriques entre les paires.
 *
 * Port simplifié du composant du dépôt B (`frontend/src/components/BracketTree.jsx`).
 */

import { useMemo } from 'react';

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
  player1?: PlayerLite | null;
  player2?: PlayerLite | null;
  winner?: PlayerLite | null;
  status: 'waiting' | 'in_progress' | 'finished' | 'blocked';
  setsP1: number;
  setsP2: number;
}

interface Props {
  matches: BracketTreeMatch[];
  highlightWinner?: boolean;
}

const MATCH_HEIGHT = 70;
const MATCH_WIDTH = 220;
const COLUMN_GAP = 60;

export function BracketTree({ matches, highlightWinner = true }: Props) {
  const { columns, totalRounds } = useMemo(() => {
    const byRound = new Map<number, BracketTreeMatch[]>();
    for (const m of matches) {
      const round = m.roundNumber || 1;
      if (!byRound.has(round)) byRound.set(round, []);
      byRound.get(round)!.push(m);
    }
    const totalRounds = byRound.size > 0 ? Math.max(...byRound.keys()) : 0;
    const columns: BracketTreeMatch[][] = [];
    for (let r = 1; r <= totalRounds; r++) {
      columns.push(byRound.get(r) ?? []);
    }
    return { columns, totalRounds };
  }, [matches]);

  if (matches.length === 0) {
    return (
      <div className="card text-center py-12 text-foreground-muted" data-testid="bracket-empty">
        Tableau d'élimination non encore généré.
      </div>
    );
  }

  // Hauteur totale = nb max de matches au 1er tour × espacement
  const firstRoundCount = columns[0]?.length ?? 0;
  const totalHeight = Math.max(MATCH_HEIGHT, firstRoundCount * MATCH_HEIGHT * 2);

  return (
    <div
      className="overflow-x-auto card"
      data-testid="bracket-tree"
      style={{ minHeight: totalHeight + 40 }}
    >
      <div
        className="relative inline-block min-w-full"
        style={{
          height: totalHeight,
          padding: '20px 0',
          minWidth: totalRounds * (MATCH_WIDTH + COLUMN_GAP),
        }}
      >
        {columns.map((col, colIdx) => {
          const matchesInRound = col.length || 1;
          const slotHeight = totalHeight / matchesInRound;
          const left = colIdx * (MATCH_WIDTH + COLUMN_GAP);
          return (
            <div
              key={colIdx}
              className="absolute top-0"
              style={{ left, width: MATCH_WIDTH, height: totalHeight }}
              data-testid={`bracket-column-${colIdx}`}
            >
              {/* Label du tour */}
              <p className="absolute -top-1 left-0 text-xs uppercase tracking-widest text-foreground-muted">
                {col[0]?.roundName ?? `Tour ${colIdx + 1}`}
              </p>

              {col.map((m, i) => {
                const top = slotHeight * i + slotHeight / 2 - MATCH_HEIGHT / 2;
                return (
                  <div
                    key={m.id}
                    className="absolute"
                    style={{ top, left: 0, width: MATCH_WIDTH, height: MATCH_HEIGHT }}
                    data-testid={`bracket-match-${m.id}`}
                  >
                    <MatchCard match={m} highlightWinner={highlightWinner} />
                    {/* Connecteur vers le tour suivant */}
                    {colIdx < totalRounds - 1 && (
                      <Connector
                        isUpper={i % 2 === 0}
                        slotHeight={slotHeight}
                        gap={COLUMN_GAP}
                      />
                    )}
                  </div>
                );
              })}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function MatchCard({
  match,
  highlightWinner,
}: {
  match: BracketTreeMatch;
  highlightWinner: boolean;
}) {
  const isFinished = match.status === 'finished';
  const winnerId = match.winner?.id ?? null;
  const p1Win = highlightWinner && isFinished && winnerId === match.player1?.id;
  const p2Win = highlightWinner && isFinished && winnerId === match.player2?.id;

  return (
    <div
      className={`bg-surface border ${
        match.status === 'in_progress' ? 'border-primary ring-1 ring-primary' : 'border-border-strong'
      } w-full h-full grid grid-rows-2`}
    >
      <Side
        player={match.player1}
        score={match.setsP1}
        winner={p1Win}
        bye={!match.player1 && match.status !== 'waiting'}
      />
      <div className="border-t border-border" />
      <Side
        player={match.player2}
        score={match.setsP2}
        winner={p2Win}
        bye={!match.player2 && match.status !== 'waiting'}
      />
    </div>
  );
}

function Side({
  player,
  score,
  winner,
  bye,
}: {
  player?: PlayerLite | null;
  score: number;
  winner: boolean;
  bye: boolean;
}) {
  return (
    <div
      className={`flex items-center justify-between px-2 ${
        winner ? 'bg-success-soft text-success font-semibold' : ''
      } ${bye ? 'text-foreground-subtle italic' : ''}`}
    >
      <span className="truncate text-sm">
        {player ? `${player.lastName} ${player.firstName}` : bye ? 'Bye' : '—'}
      </span>
      <span className="font-mono tabular text-sm">{score}</span>
    </div>
  );
}

/**
 * Connecteur en L : sort à droite de la card, monte ou descend, puis va à droite.
 */
function Connector({
  isUpper,
  slotHeight,
  gap,
}: {
  isUpper: boolean;
  slotHeight: number;
  gap: number;
}) {
  const halfGap = gap / 2;
  const verticalLen = slotHeight / 2;
  return (
    <svg
      className="absolute pointer-events-none"
      style={{
        top: MATCH_HEIGHT / 2,
        left: MATCH_WIDTH,
        width: gap,
        height: slotHeight,
        overflow: 'visible',
      }}
      aria-hidden="true"
    >
      {/* Trait horizontal court depuis la card */}
      <line
        x1={0}
        y1={0}
        x2={halfGap}
        y2={0}
        stroke="rgb(203 213 225)"
        strokeWidth="2"
      />
      {/* Trait vertical : monte si match impair (upper), descend sinon */}
      {isUpper ? (
        <line
          x1={halfGap}
          y1={0}
          x2={halfGap}
          y2={verticalLen}
          stroke="rgb(203 213 225)"
          strokeWidth="2"
        />
      ) : (
        <line
          x1={halfGap}
          y1={0}
          x2={halfGap}
          y2={-verticalLen}
          stroke="rgb(203 213 225)"
          strokeWidth="2"
        />
      )}
      {/* Trait horizontal vers la prochaine card (uniquement pour upper) */}
      {isUpper && (
        <line
          x1={halfGap}
          y1={verticalLen}
          x2={gap}
          y2={verticalLen}
          stroke="rgb(203 213 225)"
          strokeWidth="2"
        />
      )}
    </svg>
  );
}
