'use client';

/**
 * BracketView — point d'entrée unique pour afficher un tableau final.
 *
 * Deux rendus coexistent : `BracketFlow` (canevas React Flow, par défaut) et
 * `BracketTree` (rendu historique). Passer par ce composant permet de revenir
 * au rendu éprouvé sans modifier les pages appelantes :
 *
 *   - au cas par cas, avec la prop `variant` ;
 *   - globalement, avec `NEXT_PUBLIC_BRACKET_VARIANT=classic`.
 *
 * Ce repli existe parce que React Flow arrive avec React 19 en préversion : si
 * le canevas se comporte mal un jour de tournoi, l'affichage du tableau ne doit
 * pas s'arrêter avec lui.
 */

import { BracketTree } from '@/components/BracketTree';
import { BracketFlow, type BracketFlowProps } from './BracketFlow';

export type BracketVariant = 'flow' | 'classic';

export interface BracketViewProps extends BracketFlowProps {
  variant?: BracketVariant;
}

function resolveVariant(explicit?: BracketVariant): BracketVariant {
  if (explicit) return explicit;
  return process.env.NEXT_PUBLIC_BRACKET_VARIANT === 'classic' ? 'classic' : 'flow';
}

export function BracketView({ variant, ...props }: BracketViewProps) {
  if (resolveVariant(variant) === 'classic') {
    return <BracketTree matches={props.matches} highlightWinner={props.highlightWinner} />;
  }
  return <BracketFlow {...props} />;
}
