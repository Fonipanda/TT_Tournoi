'use client';

/**
 * BracketTree — Roland Garros-style bracket display.
 *
 * Features:
 * - Horizontal column layout with round labels in a navigation bar
 * - Match cards with player name, checkmark for winner, set-by-set scores
 * - Connectors between rounds
 * - Navigation arrows < > for horizontal scrolling
 * - Responsive with soft rounded cards
 */

import { useMemo, useRef, useState } from 'react';

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
  sets?: { p1: number; p2: number }[] | null;
}

interface Props {
  matches: BracketTreeMatch[];
  highlightWinner?: boolean;
}

const MATCH_HEIGHT = 80;
const MATCH_WIDTH = 260;
const COLUMN_GAP = 48;

export function BracketTree({ matches, highlightWinner = true }: Props) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [activeRound, setActiveRound] = useState(0);

  const { columns, totalRounds, roundNames } = useMemo(() => {
    const byRound = new Map<number, BracketTreeMatch[]>();
    for (const m of matches) {
      const round = m.roundNumber || 1;
      if (!byRound.has(round)) byRound.set(round, []);
      byRound.get(round)!.push(m);
    }
    const totalRounds = byRound.size > 0 ? Math.max(...byRound.keys()) : 0;
    const columns: BracketTreeMatch[][] = [];
    const roundNames: string[] = [];
    for (let r = 1; r <= totalRounds; r++) {
      const col = byRound.get(r) ?? [];
      columns.push(col);
      roundNames.push(col[0]?.roundName ?? `Tour ${r}`);
    }
    return { columns, totalRounds, roundNames };
  }, [matches]);

  if (matches.length === 0) {
    return (
      <div className="card text-center py-12 text-foreground-muted rounded-2xl" data-testid="bracket-empty">
        Tableau final non encore généré.
      </div>
    );
  }

  const firstRoundCount = columns[0]?.length ?? 1;
  const totalHeight = Math.max(MATCH_HEIGHT * 2, firstRoundCount * (MATCH_HEIGHT + 12));

  const scrollTo = (direction: 'left' | 'right') => {
    if (!scrollRef.current) return;
    const scrollAmount = MATCH_WIDTH + COLUMN_GAP;
    scrollRef.current.scrollBy({
      left: direction === 'left' ? -scrollAmount : scrollAmount,
      behavior: 'smooth',
    });
  };

  const scrollToRound = (idx: number) => {
    setActiveRound(idx);
    if (!scrollRef.current) return;
    const scrollTarget = idx * (MATCH_WIDTH + COLUMN_GAP);
    scrollRef.current.scrollTo({ left: scrollTarget, behavior: 'smooth' });
  };

  return (
    <div data-testid="bracket-tree" className="space-y-4">
      {/* Round navigation bar */}
      <div className="flex items-center gap-2 overflow-x-auto pb-2 border-b border-border">
        {roundNames.map((name, idx) => (
          <button
            key={idx}
            type="button"
            onClick={() => scrollToRound(idx)}
            className={`text-xs px-3 py-1.5 rounded-full whitespace-nowrap transition-colors ${
              activeRound === idx
                ? 'bg-primary text-primary-fg font-medium'
                : 'text-foreground-muted hover:bg-bg-alt'
            }`}
          >
            {name}
          </button>
        ))}
      </div>

      {/* Bracket area with navigation arrows */}
      <div className="relative">
        {/* Left arrow */}
        <button
          type="button"
          onClick={() => scrollTo('left')}
          className="absolute left-0 top-1/2 -translate-y-1/2 z-10 w-10 h-10 rounded-full bg-primary text-primary-fg flex items-center justify-center shadow-lg hover:bg-primary/80 transition-colors"
          aria-label="Tour précédent"
        >
          &lt;
        </button>

        {/* Right arrow */}
        <button
          type="button"
          onClick={() => scrollTo('right')}
          className="absolute right-0 top-1/2 -translate-y-1/2 z-10 w-10 h-10 rounded-full bg-primary text-primary-fg flex items-center justify-center shadow-lg hover:bg-primary/80 transition-colors"
          aria-label="Tour suivant"
        >
          &gt;
        </button>

        {/* Scrollable bracket */}
        <div
          ref={scrollRef}
          className="overflow-x-auto mx-12 scroll-smooth"
          style={{ minHeight: totalHeight + 60 }}
          onScroll={() => {
            if (!scrollRef.current) return;
            const idx = Math.round(scrollRef.current.scrollLeft / (MATCH_WIDTH + COLUMN_GAP));
            setActiveRound(Math.min(idx, totalRounds - 1));
          }}
        >
          <div
            className="relative inline-flex gap-0"
            style={{
              height: totalHeight,
              paddingTop: 20,
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
                  className="absolute top-5"
                  style={{ left, width: MATCH_WIDTH, height: totalHeight }}
                  data-testid={`bracket-column-${colIdx}`}
                >
                  {col.map((m, i) => {
                    const top = slotHeight * i + slotHeight / 2 - MATCH_HEIGHT / 2;
                    return (
                      <div
                        key={m.id}
                        className="absolute"
                        style={{ top, left: 0, width: MATCH_WIDTH, height: MATCH_HEIGHT }}
                        data-testid={`bracket-match-${m.id}`}
                      >
                        <RGMatchCard match={m} highlightWinner={highlightWinner} />
                        {/* Connector to next round */}
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
      </div>
    </div>
  );
}

/**
 * Roland Garros-style match card:
 * - Light bg with rounded corners
 * - 2 rows (one per player)
 * - Checkmark for winner
 * - Set scores displayed
 * - Bye matches (auto-finished with one player) → compact single-player display
 */
function RGMatchCard({
  match,
  highlightWinner,
}: {
  match: BracketTreeMatch;
  highlightWinner: boolean;
}) {
  const isFinished = match.status === 'finished';
  const winnerId = match.winner?.id ?? null;

  // Bye = match auto-fini où un seul slot est occupé.
  // Affichage compact : juste le nom + flèche vers le tour suivant.
  const isAutoBye =
    isFinished && winnerId && (!match.player1 || !match.player2);
  if (isAutoBye && match.winner) {
    return (
      <div className="w-full h-full flex items-center gap-2 px-3 rounded-xl bg-surface border border-border/40 text-foreground">
        <span className="text-foreground-subtle text-xs flex-shrink-0">→</span>
        <span className="font-medium text-sm truncate flex-1">
          {match.winner.lastName} {match.winner.firstName[0]}.
        </span>
      </div>
    );
  }

  const p1Win = highlightWinner && isFinished && winnerId === match.player1?.id;
  const p2Win = highlightWinner && isFinished && winnerId === match.player2?.id;
  const sets = Array.isArray(match.sets) ? match.sets : [];

  return (
    <div
      className={`w-full h-full rounded-xl overflow-hidden shadow-sm border ${
        match.status === 'in_progress'
          ? 'border-primary ring-2 ring-primary/30 bg-surface'
          : 'border-border bg-surface'
      }`}
    >
      <PlayerRow
        player={match.player1}
        sets={sets}
        playerSide="p1"
        isWinner={p1Win}
        totalSets={match.setsP1}
      />
      <div className="border-t border-border/50" />
      <PlayerRow
        player={match.player2}
        sets={sets}
        playerSide="p2"
        isWinner={p2Win}
        totalSets={match.setsP2}
      />
    </div>
  );
}

function PlayerRow({
  player,
  sets,
  playerSide,
  isWinner,
  totalSets,
}: {
  player?: PlayerLite | null;
  sets: { p1: number; p2: number }[];
  playerSide: 'p1' | 'p2';
  isWinner: boolean;
  totalSets: number;
}) {
  return (
    <div
      className={`flex items-center h-1/2 px-3 gap-2 ${
        isWinner ? 'bg-success-soft/50' : ''
      }`}
    >
      {/* Winner check */}
      {isWinner && (
        <span className="text-success text-sm flex-shrink-0" aria-label="Vainqueur">&#10003;</span>
      )}
      {!isWinner && <span className="w-4 flex-shrink-0" />}

      {/* Player name (— if waiting opponent) */}
      <span className={`truncate text-sm flex-1 ${isWinner ? 'font-bold' : ''} ${!player ? 'text-foreground-subtle italic' : ''}`}>
        {player ? `${player.lastName} ${player.firstName[0]}.` : '—'}
      </span>

      {/* Set scores */}
      {sets.length > 0 ? (
        <div className="flex items-center gap-1">
          {sets.map((s, i) => {
            const score = playerSide === 'p1' ? s.p1 : s.p2;
            const oppScore = playerSide === 'p1' ? s.p2 : s.p1;
            const won = score > oppScore;
            return (
              <span
                key={i}
                className={`text-xs tabular font-mono w-5 text-center ${
                  won ? 'font-bold' : 'text-foreground-muted'
                }`}
              >
                {score}
              </span>
            );
          })}
        </div>
      ) : (
        <span className="font-mono tabular text-sm">{totalSets}</span>
      )}
    </div>
  );
}

/**
 * L-shaped connector between paired matches.
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
      <line
        x1={0} y1={0} x2={halfGap} y2={0}
        stroke="rgb(203 213 225)" strokeWidth="2"
      />
      {isUpper ? (
        <line
          x1={halfGap} y1={0} x2={halfGap} y2={verticalLen}
          stroke="rgb(203 213 225)" strokeWidth="2"
        />
      ) : (
        <line
          x1={halfGap} y1={0} x2={halfGap} y2={-verticalLen}
          stroke="rgb(203 213 225)" strokeWidth="2"
        />
      )}
      {isUpper && (
        <line
          x1={halfGap} y1={verticalLen} x2={gap} y2={verticalLen}
          stroke="rgb(203 213 225)" strokeWidth="2"
        />
      )}
    </svg>
  );
}
