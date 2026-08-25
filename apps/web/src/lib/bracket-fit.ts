/**
 * Lecture, pour le joueur, de la fenêtre de points d'un tableau.
 *
 * En tournoi homologué, un tableau définit une fenêtre de classement opposable
 * dans les deux sens : « Moins de 1099 points » n'accepte pas un joueur mieux
 * classé, et un tableau réservé aux 1500 points et plus n'accepte pas un joueur
 * de 900 points. Ce module ne fait qu'expliquer la règle appliquée par le
 * serveur — il ne l'assouplit jamais. Toute divergence entre les deux se
 * traduirait par un refus incompréhensible au moment de valider.
 *
 * S'y ajoute la condition d'origine du classement : un tableau borné exige un
 * classement vérifié auprès de la fédération. Les points d'une fiche jamais
 * synchronisée valent 500 par défaut ou une saisie manuelle, ce qui ne permet
 * d'affirmer ni le respect ni la violation de la fenêtre.
 *
 * Ces deux conditions tombent ensemble dès que le tableau atteint le seuil de
 * remplissage : un tableau assuré de se tenir accepte tous les classements.
 *
 * Le niveau « recommandé » n'est volontairement pas absolu, mais **relatif à
 * l'offre du tournoi** : parmi les tableaux ouverts au joueur une même journée,
 * le plus pertinent est celui dont le plafond serre au plus près son classement.
 * Un seuil fixe aurait recommandé « toutes séries » aussi bien que « ≤ 700 » à
 * un joueur de 650 points.
 *
 * Ce module ne dépend ni de Node ni de Prisma : il est consommé côté client.
 */

import { bracketScopeKey, isOpenByFill, FILL_OPEN_RATIO } from './registrations';

/**
 * Écart, en points, au-delà duquel un tableau est hors de portée plutôt que
 * simplement au-dessus. Environ deux tranches de tableau FFTT. Ne sert qu'à
 * nuancer le message : les deux cas sont refusés.
 */
export const STRETCH_GAP = 400;

/** Tableau réduit aux champs nécessaires au calcul. */
export interface BracketFitInput {
  id: string;
  tournamentId: string;
  day: string | null;
  minPoints: number | null;
  maxPoints: number | null;
  /** Jauge du tableau. */
  maxPlayers: number;
  /** Inscriptions actives déjà enregistrées. */
  registeredCount: number;
}

/** État du joueur au regard du classement officiel. */
export interface PlayerRankingState {
  points: number | null | undefined;
  /** Classement confronté à la base fédérale (`ffttSyncedAt` renseigné). */
  verified: boolean;
}

export type BracketFitLevel =
  /** Le tableau le plus proche du classement du joueur, ce jour-là. */
  | 'recommended'
  /** Ouvert à son classement, sans être le choix le plus ajusté. */
  | 'accessible'
  /** Hors fenêtre, mais le tableau est assez rempli pour accueillir tout le monde. */
  | 'open_fill'
  /** Sous le plancher du tableau, écart raisonnable. Refusé. */
  | 'stretch'
  /** Nettement sous le plancher du tableau. Refusé. */
  | 'far_stretch'
  /** Plafond de points dépassé. Refusé. */
  | 'closed'
  /** Tableau borné, classement jamais vérifié. Refusé. */
  | 'unverified';

export interface BracketFit {
  level: BracketFitLevel;
  /** Texte court, destiné à un badge. */
  label: string;
  /** Phrase d'explication affichée sur la carte. */
  detail: string;
  /** L'inscription serait refusée par le serveur. */
  blocking: boolean;
}

/** Le tableau demande un classement plus élevé que celui du joueur. */
export function isStretch(level: BracketFitLevel): boolean {
  return level === 'stretch' || level === 'far_stretch';
}

/** Description lisible de la fenêtre de points d'un tableau. */
export function describeRange(b: Pick<BracketFitInput, 'minPoints' | 'maxPoints'>): string {
  if (b.minPoints !== null && b.maxPoints !== null) {
    return `De ${b.minPoints} à ${b.maxPoints} pts`;
  }
  if (b.maxPoints !== null) return `Jusqu'à ${b.maxPoints} pts`;
  if (b.minPoints !== null) return `À partir de ${b.minPoints} pts`;
  return 'Ouvert à tous les classements';
}

/** Un tableau sans borne est ouvert à tous : aucun contrôle ne s'applique. */
function hasWindow(b: BracketFitInput): boolean {
  return b.minPoints !== null || b.maxPoints !== null;
}

/**
 * Évalue chaque tableau vis-à-vis du classement du joueur.
 *
 * @returns une table `id de tableau → verdict`. Vide si le classement est
 * inconnu : mieux vaut aucune indication qu'une indication fausse.
 */
export function computeBracketFits(
  brackets: readonly BracketFitInput[],
  ranking: PlayerRankingState,
): Map<string, BracketFit> {
  const fits = new Map<string, BracketFit>();
  const { points, verified } = ranking;
  if (points === null || points === undefined || !Number.isFinite(points)) return fits;

  const p = Math.round(points);
  const inRange: BracketFitInput[] = [];

  for (const b of brackets) {
    const bounded = hasWindow(b);

    // Un tableau assez rempli s'ouvre à tous les classements. Le joueur qui
    // entre malgré tout dans la fenêtre garde son verdict habituel : lui
    // afficher « ouvert à tous » masquerait le fait que ce tableau est,
    // pour lui, le choix ajusté.
    if (bounded && isOpenByFill(b)) {
      const withinWindow =
        verified &&
        (b.maxPoints === null || p <= b.maxPoints) &&
        (b.minPoints === null || p >= b.minPoints);
      if (!withinWindow) {
        const rate = Math.round((b.registeredCount / b.maxPlayers) * 100);
        fits.set(b.id, {
          level: 'open_fill',
          label: 'Ouvert à tous',
          detail: `Rempli à ${rate} % — au-delà de ${Math.round(FILL_OPEN_RATIO * 100)} %, ce tableau accepte tous les classements.`,
          blocking: false,
        });
        continue;
      }
    }

    // Un tableau borné exige un classement certifié, avant toute comparaison.
    if (!verified && bounded) {
      fits.set(b.id, {
        level: 'unverified',
        label: 'Classement à vérifier',
        detail: `${describeRange(b)} — synchronise ton classement FFTT pour ouvrir ce tableau.`,
        blocking: true,
      });
      continue;
    }

    if (b.maxPoints !== null && p > b.maxPoints) {
      fits.set(b.id, {
        level: 'closed',
        label: 'Plafond dépassé',
        detail: `Réservé aux joueurs de ${b.maxPoints} pts maximum — tu en as ${p}.`,
        blocking: true,
      });
      continue;
    }

    if (b.minPoints !== null && p < b.minPoints) {
      const gap = b.minPoints - p;
      const far = gap > STRETCH_GAP;
      fits.set(b.id, {
        level: far ? 'far_stretch' : 'stretch',
        label: far ? 'Bien au-dessus de ton niveau' : 'Au-dessus de ton niveau',
        detail: `Réservé aux joueurs d'au moins ${b.minPoints} pts, soit ${gap} de plus que toi.`,
        blocking: true,
      });
      continue;
    }

    inRange.push(b);
  }

  // Le meilleur choix se juge journée par journée, tournoi par tournoi : le
  // quota d'inscription a lui-même cette portée, comparer des tableaux du
  // samedi et du dimanche n'aurait aucun sens pour le joueur.
  const bestGapPerDay = new Map<string, number>();
  for (const b of inRange) {
    if (b.maxPoints === null) continue; // sans plafond, rien à comparer
    const key = bracketScopeKey(b);
    const gap = b.maxPoints - p;
    const best = bestGapPerDay.get(key);
    if (best === undefined || gap < best) bestGapPerDay.set(key, gap);
  }

  for (const b of inRange) {
    const best = bestGapPerDay.get(bracketScopeKey(b));
    const isBest = b.maxPoints !== null && best !== undefined && b.maxPoints - p === best;
    fits.set(
      b.id,
      isBest
        ? {
            level: 'recommended',
            label: 'Recommandé',
            detail: `${describeRange(b)} — le tableau le plus proche de tes ${p} pts.`,
            blocking: false,
          }
        : {
            level: 'accessible',
            label: 'Accessible',
            detail: `${describeRange(b)} — ouvert à ton classement.`,
            blocking: false,
          },
    );
  }

  return fits;
}
