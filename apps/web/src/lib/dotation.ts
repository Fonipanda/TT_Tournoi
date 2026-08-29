/**
 * Récapitulatif public des dotations d'un tableau.
 *
 * Le texte affiché n'est plus une saisie mais une projection des quatre
 * montants : un libellé rédigé à la main pouvait diverger des sommes
 * réellement enregistrées, et c'est ce libellé que le public lit.
 *
 * Module pur, sans dépendance Prisma ni Node : il est importé aussi bien par
 * les routes serveur, qui maintiennent `Bracket.prize`, que par les composants
 * client, qui recalculent le texte à l'affichage.
 */

export interface DotationAmounts {
  winner: number;
  finalist: number;
  semi: number;
  quarter: number;
}

/**
 * Met en forme un montant en euros.
 *
 * Les colonnes sont en `Decimal(8,2)` : un montant peut porter des centimes.
 * On n'affiche les décimales que lorsqu'elles existent — « 80,00€ » sur une
 * carte de tournoi alourdit la lecture sans rien apporter.
 *
 * Une valeur aberrante (absente, négative, non finie) est ramenée à zéro
 * plutôt qu'affichée telle quelle : le récap est une information publique.
 */
function amount(value: number): string {
  const v = Number.isFinite(value) && value > 0 ? value : 0;
  return Number.isInteger(v) ? `${v}€` : `${v.toFixed(2).replace('.', ',')}€`;
}

/**
 * Construit le récapitulatif, par exemple :
 * `1er 80€ / 2ème 40€ / 3ème-4ème 20€ / 5ème à 8ème 10€`.
 *
 * Les quatre rangs sont toujours présents, y compris à `0€` : l'absence d'une
 * ligne laisserait croire que le rang n'est pas doté alors qu'il peut l'être
 * plus tard, et rendrait la comparaison entre tableaux malaisée.
 */
export function formatDotation(d: DotationAmounts): string {
  return [
    `1er ${amount(d.winner)}`,
    `2ème ${amount(d.finalist)}`,
    `3ème-4ème ${amount(d.semi)}`,
    `5ème à 8ème ${amount(d.quarter)}`,
  ].join(' / ');
}

/**
 * Profil de répartition des prix.
 *
 * La logique est dégressive et pyramidale, mais son ampleur dépend de
 * l'ambition du tableau : un tableau élite doit offrir un premier prix
 * massif pour justifier le déplacement de joueurs numérotés, là où un petit
 * tableau s'arrête au podium sous peine de distribuer des pièces.
 */
export type DotationProfile = 'elite' | 'intermediate' | 'small';

/**
 * Plafond de points sous lequel un tableau relève du profil « petit ».
 *
 * Constante isolée parce que c'est un curseur de politique sportive, pas une
 * vérité : la frontière se situe quelque part entre les tableaux « moins de
 * 900 » et « moins de 1200 ».
 */
export const POINTS_SMALL_CEILING = 1000;

/**
 * Parts de chaque rang dans l'enveloppe totale du tableau, telles que les
 * énoncent les règlements. Elles ne servent qu'à dériver les ratios ci-dessous.
 */
const ENVELOPE_SHARES: Record<DotationProfile, DotationAmounts> = {
  elite: { winner: 50, finalist: 25, semi: 10, quarter: 1.25 },
  intermediate: { winner: 42.5, finalist: 22.5, semi: 12.5, quarter: 2.5 },
  small: { winner: 55, finalist: 25, semi: 10, quarter: 0 },
};

/** Montant proposé pour le vainqueur, à défaut de saisie. */
const DEFAULT_WINNER: Record<DotationProfile, number> = {
  elite: 500,
  intermediate: 170,
  small: 80,
};

const PROFILE_LABEL: Record<DotationProfile, string> = {
  elite: 'Élite / Toutes catégories',
  intermediate: 'Intermédiaire',
  small: 'Jeunes, vétérans ou doubles',
};

/**
 * Déduit le profil du plafond de points du tableau.
 *
 * Un tableau sans plafond relève de l'élite : c'est la définition même d'un
 * tableau « Toutes catégories », il peut accueillir des joueurs numérotés.
 *
 * Limite connue : un tableau vétérans ou doubles de niveau moyen sera classé
 * intermédiaire, faute de champ décrivant la nature du tableau. Le barème
 * proposé sera alors trop généreux sur les quarts — d'où des montants qui
 * restent corrigeables à la main.
 */
export function dotationProfileFromPoints(maxPoints: number | null | undefined): DotationProfile {
  if (maxPoints === null || maxPoints === undefined || !Number.isFinite(maxPoints)) return 'elite';
  return maxPoints < POINTS_SMALL_CEILING ? 'small' : 'intermediate';
}

export function defaultWinnerAmount(profile: DotationProfile): number {
  return DEFAULT_WINNER[profile];
}

export function dotationProfileLabel(profile: DotationProfile): string {
  return PROFILE_LABEL[profile];
}

/**
 * Arrondit au demi-euro.
 *
 * Ni à l'euro, qui gommerait les 12,50 € des quarts d'un tableau élite, ni au
 * centime, qui produirait des montants impossibles à remettre en espèces.
 */
function roundToHalf(value: number): number {
  return Math.round(value * 2) / 2;
}

/**
 * Répartit une dotation à partir du seul montant du vainqueur.
 *
 * Les règlements expriment les parts en pourcentage de l'enveloppe totale ;
 * comme seul le vainqueur est saisi, chaque part est ramenée à une fraction
 * de celle du vainqueur. Les fractions restent exactes jusqu'au bout :
 * arrondir les ratios avant de les appliquer décalerait les montants.
 *
 * Un vainqueur nul ou aberrant produit quatre zéros plutôt qu'une cascade de
 * `NaN` — le résultat est affiché publiquement.
 */
export function deriveDotation(winner: number, profile: DotationProfile): DotationAmounts {
  if (!Number.isFinite(winner) || winner <= 0) {
    return { winner: 0, finalist: 0, semi: 0, quarter: 0 };
  }
  const share = ENVELOPE_SHARES[profile];
  return {
    winner: roundToHalf(winner),
    finalist: roundToHalf((winner * share.finalist) / share.winner),
    semi: roundToHalf((winner * share.semi) / share.winner),
    quarter: roundToHalf((winner * share.quarter) / share.winner),
  };
}
