'use client';

/**
 * BracketTree — affichage Roland-Garros style (rendu historique).
 *
 * Conservé comme repli du rendu React Flow (`BracketFlow`) : la bascule se fait
 * par `BracketView`, ce qui permet de revenir au rendu éprouvé sans toucher au
 * code appelant.
 *
 * Inspiré du fichier de référence `bracket.html` :
 *   - Colonnes (= tours) avec libellés en haut
 *   - Centrage vertical : R1 stacked, R2+ centre = midpoint des 2 feeders
 *   - Connecteurs SVG en L (paths)
 *   - Cellules : 1 joueur (passage direct, 1 ligne) ou 2 joueurs (match, 2 lignes)
 *   - Vainqueur : fond vert clair + nom gras + scores foncés ; perdant grisé
 *
 * La géométrie vit dans `lib/bracket-layout` et la cellule dans
 * `components/bracket/MatchCard` : les deux rendus partagent exactement le même
 * calcul de positions et le même format FFTT.
 */

import { useMemo, useRef } from 'react';
import {
  COL_W,
  MATCH_H,
  columnX,
  computeRoundLabel,
  connectorPath,
  layoutBracket,
  type BracketTreeMatch,
} from '@/lib/bracket-layout';
import { MatchCard } from '@/components/bracket/MatchCard';

export type { BracketTreeMatch, PlayerLite } from '@/lib/bracket-layout';

interface Props {
  matches: BracketTreeMatch[];
  highlightWinner?: boolean;
}

export function BracketTree({ matches, highlightWinner = true }: Props) {
  const scrollRef = useRef<HTMLDivElement>(null);

  const layout = useMemo(() => layoutBracket(matches), [matches]);

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

  const { columns, centers, connectors, totalRounds, totalW, totalH } = layout;
  const ec = 'rgb(203 213 225)';

  return (
    <div data-testid="bracket-tree" className="w-full">
      <div ref={scrollRef} className="overflow-x-auto pb-2">
        <div className="relative" style={{ width: totalW, height: totalH, minWidth: totalW }}>
          {/* SVG connectors */}
          <svg
            className="absolute top-0 left-0 pointer-events-none"
            width={totalW}
            height={totalH}
          >
            {connectors.map((c, i) => (
              <path key={i} d={connectorPath(c)} fill="none" stroke={ec} strokeWidth={1} />
            ))}
          </svg>

          {/* Round labels */}
          {columns.map((_, r) => (
            <div
              key={`lbl-${r}`}
              className="absolute text-[11px] uppercase tracking-wider font-semibold text-foreground-muted text-center"
              style={{ left: columnX(r), top: 0, width: COL_W }}
            >
              {computeRoundLabel(r, totalRounds)}
            </div>
          ))}

          {/* Match cells */}
          {columns.map((col, r) =>
            col.map((m, i) => (
              <div
                key={m.id}
                className="absolute"
                style={{ left: columnX(r), top: centers[r]![i]! - MATCH_H / 2, width: COL_W }}
                data-testid={`bracket-match-${m.id}`}
              >
                <MatchCard match={m} highlightWinner={highlightWinner} />
              </div>
            )),
          )}
        </div>
      </div>
    </div>
  );
}
