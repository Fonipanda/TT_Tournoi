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
const MATCH_WIDTH = 320;
const COLUMN_GAP = 56;

/**
 * Calcule le nom du tour selon la taille du tableau (FFTT).
 * roundIdx 0-based : 0 = 1er tour. totalRounds = nombre total de tours.
 */
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
      // Toujours dériver le nom du tour depuis le nombre total de tours
      // (FFTT : 1/16, 1/8, 1/4, 1/2, Finale). On ne fait PAS confiance au
      // roundName stocké en BDD car il peut être stale ("Tour 1", etc.).
      roundNames.push(computeRoundLabel(r - 1, totalRounds));
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
 * - Avatar (cercle initiale + couleur), nom, indicateur seed, checkmark
 * - 5 colonnes de sets en colonne fixe (monospace)
 * - Total sets en colonne séparée à droite
 * - Vainqueur : nom en gras + ligne fond clair + ✓
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

  // Match auto-fini avec un seul joueur (passage direct au tour suivant) :
  // affichage compact « → NOM », jamais le mot "bye". Le contenu est centré
  // verticalement dans le slot (max 36px) pour ne pas écraser visuellement.
  const isPass =
    isFinished && winnerId && (!match.player1 || !match.player2);
  if (isPass && match.winner) {
    return (
      <div className="w-full h-full flex items-center justify-center">
        <div className="w-full flex items-center gap-2 px-3 py-2 rounded-lg bg-bg-alt/60 border border-border/30 text-foreground" style={{ maxHeight: 36 }}>
          <span className="text-foreground-subtle text-xs flex-shrink-0">→</span>
          <span className="font-medium text-sm truncate flex-1">
            {match.winner.lastName} {match.winner.firstName[0]}.
          </span>
        </div>
      </div>
    );
  }

  const p1Win = highlightWinner && isFinished && winnerId === match.player1?.id;
  const p2Win = highlightWinner && isFinished && winnerId === match.player2?.id;
  const sets = Array.isArray(match.sets) ? match.sets : [];

  return (
    <div
      className={`w-full h-full rounded-xl overflow-hidden shadow-sm border bg-surface ${
        match.status === 'in_progress'
          ? 'border-primary ring-2 ring-primary/30'
          : 'border-border'
      }`}
    >
      <PlayerRow
        player={match.player1}
        sets={sets}
        playerSide="p1"
        isWinner={p1Win}
        totalSets={match.setsP1}
      />
      <div className="border-t border-border/40" />
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

/** Petite pastille initiale style Roland Garros (avatar de remplacement). */
function PlayerAvatar({ player }: { player?: PlayerLite | null }) {
  if (!player) {
    return (
      <span className="inline-flex w-5 h-5 rounded-full bg-bg-alt border border-border/60 flex-shrink-0" />
    );
  }
  const initial = (player.lastName?.[0] ?? '?').toUpperCase();
  const palette = ['bg-primary/20 text-primary', 'bg-warning/20 text-warning', 'bg-success/20 text-success', 'bg-foreground/10 text-foreground'];
  const color = palette[initial.charCodeAt(0) % palette.length] ?? palette[0]!;
  return (
    <span className={`inline-flex w-5 h-5 items-center justify-center rounded-full text-[10px] font-bold flex-shrink-0 ${color}`}>
      {initial}
    </span>
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
  // Toujours afficher 5 colonnes de sets (style RG), avec vide pour les sets non joués
  const fixedSets = Array.from({ length: 5 }, (_, i) => sets[i]);

  return (
    <div
      className={`flex items-center h-1/2 px-2.5 gap-1.5 ${
        isWinner ? 'bg-success-soft/40' : ''
      }`}
    >
      {/* Avatar */}
      <PlayerAvatar player={player} />

      {/* Checkmark vainqueur */}
      {isWinner ? (
        <span className="text-success text-sm flex-shrink-0" aria-label="Vainqueur">&#10003;</span>
      ) : (
        <span className="w-4 flex-shrink-0" />
      )}

      {/* Nom du joueur (italique grisé si en attente) */}
      <span
        className={`truncate text-sm flex-1 ${isWinner ? 'font-bold' : ''} ${
          !player ? 'text-foreground-subtle italic' : ''
        }`}
      >
        {player ? `${player.lastName} ${player.firstName[0]}.` : '—'}
        {player?.club && (
          <span className="text-[10px] text-foreground-muted ml-1">
            ({player.club.split(' ')[0]?.slice(0, 4)})
          </span>
        )}
      </span>

      {/* Scores des sets — 5 colonnes monospace fixes */}
      <div className="flex items-center gap-0.5 flex-shrink-0">
        {fixedSets.map((s, i) => {
          if (!s || (s.p1 === 0 && s.p2 === 0)) {
            return (
              <span
                key={i}
                className="font-mono text-[11px] tabular w-4 text-center text-foreground-subtle/40"
              >
                ·
              </span>
            );
          }
          const score = playerSide === 'p1' ? s.p1 : s.p2;
          const oppScore = playerSide === 'p1' ? s.p2 : s.p1;
          const won = score > oppScore;
          return (
            <span
              key={i}
              className={`font-mono text-[11px] tabular w-4 text-center ${
                won ? 'font-bold text-foreground' : 'text-foreground-muted'
              }`}
            >
              {score}
            </span>
          );
        })}
      </div>

      {/* Total sets gagnés (gros chiffre à droite) */}
      <span
        className={`font-mono tabular text-sm w-4 text-center flex-shrink-0 ${
          isWinner ? 'font-bold text-foreground' : 'text-foreground-muted'
        }`}
      >
        {totalSets || ''}
      </span>
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
