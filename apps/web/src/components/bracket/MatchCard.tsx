'use client';

/**
 * Cellule de match du tableau final — rendu FFTT/SPID.
 *
 * Composant partagé par les deux rendus d'arbre (`BracketTree`, historique, et
 * `BracketFlow`, React Flow) : le format attendu par les juges-arbitres ne doit
 * exister qu'à un seul endroit.
 *
 * Invariants FFTT, à ne pas assouplir :
 *   - toutes les cellules font deux lignes, même un passage direct ;
 *   - la ligne de l'adversaire absent reste vide — le mot « bye » n'est jamais
 *     écrit ;
 *   - le premier tour affiche les numéros de position 1..N du tirage ;
 *   - cinq colonnes de scores de sets, remplies par un point tant que le set
 *     n'est pas joué ;
 *   - le vainqueur est marqué d'une coche.
 *
 * Les états `live`, `mine` et `dim` sont purement décoratifs et désactivés par
 * défaut : le rendu historique reste ainsi strictement inchangé.
 */

import { MATCH_H, isPassMatch, type BracketTreeMatch, type PlayerLite } from '@/lib/bracket-layout';

export function PlayerAvatar({ player }: { player?: PlayerLite | null }) {
  if (!player) {
    return (
      <span className="inline-flex w-5 h-5 rounded-full bg-bg-alt border border-border/60 flex-shrink-0" />
    );
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

export function PlayerRow({
  player,
  sets,
  side,
  isWinner,
  totalSets,
  position,
  seedPos,
  emptySlot,
}: {
  player?: PlayerLite | null;
  sets: { p1: number; p2: number }[];
  side: 'p1' | 'p2';
  isWinner: boolean;
  totalSets: number;
  position: 'top' | 'bot';
  seedPos?: number | null;
  emptySlot?: boolean;
}) {
  // Toujours 5 colonnes de scores (placeholder · si non joué)
  const cells = Array.from({ length: 5 }, (_, i) => sets[i]);
  const club = player?.club?.split(' ')[0]?.slice(0, 4);

  // Slot vide (passage direct, opposant inexistant) : ligne complètement vide,
  // juste le numéro de position en gauche. Jamais le mot "bye".
  if (emptySlot) {
    return (
      <div
        className={`flex items-center gap-1.5 px-2 py-0.5 bg-bg-alt/20 ${
          position === 'top' ? 'border-b border-border/30' : ''
        }`}
        style={{ height: MATCH_H / 2 }}
      >
        {seedPos !== null && seedPos !== undefined && (
          <span className="text-[10px] tabular text-foreground-subtle/40 font-mono w-5 text-right flex-shrink-0">
            {seedPos}
          </span>
        )}
        <span className="flex-1" />
      </div>
    );
  }

  return (
    <div
      className={`flex items-center gap-1.5 px-2 py-0.5 bg-surface ${
        position === 'top' ? 'border-b border-border/30' : ''
      } ${isWinner ? 'bg-success-soft/40' : ''}`}
      style={{ height: MATCH_H / 2 }}
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
        {club && <span className="text-[10px] text-foreground-subtle ml-1">({club})</span>}
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

export interface MatchCardProps {
  match: BracketTreeMatch;
  highlightWinner?: boolean;
  /** Liseré vert : match en cours. Décoratif, réservé au rendu React Flow. */
  live?: boolean;
  /** Match du joueur consulté : mis en relief. */
  mine?: boolean;
  /** Match d'un autre joueur, atténué quand un parcours est suivi. */
  dim?: boolean;
}

/** Cellule de match (style RG) : toujours 2 lignes (joueur ou vide). */
export function MatchCard({
  match,
  highlightWinner = true,
  live = false,
  mine = false,
  dim = false,
}: MatchCardProps) {
  const isFinished = match.status === 'finished';
  const winnerId = match.winner?.id ?? null;
  const isPass = isPassMatch(match);

  // Calcul des numéros de position FFTT (1..nextPower) pour le 1er tour.
  const isFirstRound = match.roundNumber === 1;
  const k = match.poolMatchOrder ?? 0;
  const posP1 = isFirstRound && k > 0 ? 2 * k - 1 : null;
  const posP2 = isFirstRound && k > 0 ? 2 * k : null;

  const p1Win = highlightWinner && isFinished && winnerId === match.player1?.id;
  const p2Win = highlightWinner && isFinished && winnerId === match.player2?.id;
  const sets = Array.isArray(match.sets) ? match.sets : [];
  const inProgress = match.status === 'in_progress';

  // Pour les passages directs : le joueur reste dans SA ligne d'origine
  // (top si player1 set, bottom si player2 set). L'autre ligne est vide.
  const isP1Empty = isPass && !match.player1;
  const isP2Empty = isPass && !match.player2;
  const p1IsWinner = isPass ? !!match.player1 : p1Win;
  const p2IsWinner = isPass ? !!match.player2 : p2Win;

  const border = mine
    ? 'border-primary ring-4 ring-primary/25'
    : inProgress
      ? 'border-primary ring-1 ring-primary/30'
      : 'border-border/50';

  return (
    <div
      className={`relative rounded-md overflow-hidden border ${border} ${dim ? 'opacity-40' : ''}`}
    >
      {live && inProgress && (
        <span
          aria-hidden
          className="absolute left-0 top-2 bottom-2 w-[3px] rounded-r-sm bg-success z-10"
        />
      )}
      <PlayerRow
        player={match.player1}
        sets={sets}
        side="p1"
        isWinner={p1IsWinner}
        totalSets={isPass ? 0 : match.setsP1}
        position="top"
        seedPos={posP1}
        emptySlot={isP1Empty}
      />
      <PlayerRow
        player={match.player2}
        sets={sets}
        side="p2"
        isWinner={p2IsWinner}
        totalSets={isPass ? 0 : match.setsP2}
        position="bot"
        seedPos={posP2}
        emptySlot={isP2Empty}
      />
    </div>
  );
}
