/**
 * Barème officiel FFTT de gain et de perte de points.
 *
 * À l'issue d'une partie, chaque joueur voit son classement évoluer selon
 * l'écart qui le sépare de son adversaire et selon la nature du résultat :
 *
 *  - partie **normale**  — le mieux classé s'impose : le gain est faible, la
 *    perte du battu l'est tout autant ;
 *  - partie **anormale** — le moins bien classé s'impose : c'est une
 *    performance pour lui, un contre pour l'autre. L'écart de points devient
 *    alors déterminant, jusqu'à 40 points pour une victoire à plus de 500
 *    points d'écart.
 *
 * La valeur lue dans la table est ensuite pondérée par le coefficient de
 * l'épreuve : toutes les compétitions ne pèsent pas le même poids au
 * classement. Un tournoi homologué vaut 0,75.
 *
 * Module pur, sans dépendance Prisma ni Node : il est importé aussi bien par
 * la route qui clôture un match que par la page joueur qui affiche le détail
 * du calcul. Les deux doivent produire exactement les mêmes valeurs, sans
 * quoi le joueur lirait un décompte que sa fiche ne reflète pas.
 */

/**
 * Coefficient appliqué à défaut de réglage.
 *
 * 0,75 est celui des tournois nationaux et internationaux, ainsi que des
 * épreuves au choix des ligues et des départements — le cas de figure de la
 * plateforme.
 */
export const DEFAULT_POINTS_COEFFICIENT = 0.75;

/** Clef du réglage global, éditable depuis `/admin/parametres`. */
export const POINTS_COEFFICIENT_KEY = 'points.coefficient';

/**
 * Bornes du coefficient acceptées.
 *
 * Un coefficient nul viderait le calcul de sa substance, un coefficient
 * démesuré ferait exploser les classements sur une faute de frappe. Le
 * barème fédéral culmine à 1,5 (Championnats de France seniors) ; on laisse
 * une marge sans ouvrir la porte à l'absurde.
 */
export const MIN_POINTS_COEFFICIENT = 0.25;
export const MAX_POINTS_COEFFICIENT = 3;

/**
 * Nature du résultat au regard du classement des deux joueurs.
 *
 *  - `perf`    — victoire sur mieux classé
 *  - `contre`  — défaite contre moins bien classé
 *  - `normal`  — le classement a été respecté
 */
export type MatchPointsKind = 'perf' | 'contre' | 'normal';

/**
 * Raison pour laquelle une partie ne rapporte ni ne coûte de points.
 *
 *  - `forfait`      — l'article IV.202 traite le forfait à part ; il ne
 *                     relève pas du barème de gain et de perte.
 *  - `sans_adversaire` — entrée de tableau où le joueur est seul (qualifié
 *                     d'office). Aucune partie n'a été jouée.
 */
export type MatchPointsExclusion = 'forfait' | 'sans_adversaire';

export interface MatchPointsInput {
  /** Points du joueur en début d'épreuve. */
  playerPoints: number;
  /** Points de l'adversaire en début d'épreuve. `null` = pas d'adversaire. */
  opponentPoints: number | null;
  /** `true` si le joueur a gagné la partie. */
  victory: boolean;
  /** Coefficient de l'épreuve. */
  coefficient?: number;
  /** Partie gagnée ou perdue par forfait. */
  isForfeit?: boolean;
}

export interface MatchPointsResult {
  /** Points effectivement acquis ou perdus, coefficient appliqué. */
  points: number;
  /** Valeur brute lue dans la table, avant coefficient. */
  rawPoints: number;
  /** Coefficient retenu pour ce calcul. */
  coefficient: number;
  /** Écart de classement entre les deux joueurs, en valeur absolue. */
  gap: number;
  /** La partie s'est-elle jouée à contre-courant du classement ? */
  isAbnormal: boolean;
  kind: MatchPointsKind;
  /** Non `null` lorsque la partie est hors barème : `points` vaut alors 0. */
  excluded: MatchPointsExclusion | null;
}

/**
 * Une partie est « anormale » lorsque son issue contredit le classement :
 * victoire du moins bien classé, ou défaite du mieux classé.
 *
 * L'égalité stricte de points n'est jamais anormale — aucun des deux joueurs
 * n'était annoncé favori.
 */
export function isAbnormalResult(
  playerPoints: number,
  opponentPoints: number,
  victory: boolean,
): boolean {
  return victory ? opponentPoints > playerPoints : opponentPoints < playerPoints;
}

/**
 * Tranches du barème fédéral, bornes hautes incluses et ordonnées.
 *
 * `maxGap: Infinity` couvre la dernière tranche, « 500 points et plus ».
 */
const TABLE: ReadonlyArray<{
  maxGap: number;
  winNormal: number;
  winAbnormal: number;
  lossNormal: number;
  lossAbnormal: number;
}> = [
  { maxGap: 24, winNormal: 6, winAbnormal: 6, lossNormal: -5, lossAbnormal: -5 },
  { maxGap: 49, winNormal: 5.5, winAbnormal: 7, lossNormal: -4.5, lossAbnormal: -6 },
  { maxGap: 99, winNormal: 5, winAbnormal: 8, lossNormal: -4, lossAbnormal: -7 },
  { maxGap: 149, winNormal: 4, winAbnormal: 10, lossNormal: -3, lossAbnormal: -8 },
  { maxGap: 199, winNormal: 3, winAbnormal: 13, lossNormal: -2, lossAbnormal: -10 },
  { maxGap: 299, winNormal: 2, winAbnormal: 17, lossNormal: -1, lossAbnormal: -12.5 },
  { maxGap: 399, winNormal: 1, winAbnormal: 22, lossNormal: -0.5, lossAbnormal: -16 },
  { maxGap: 499, winNormal: 0.5, winAbnormal: 28, lossNormal: 0, lossAbnormal: -20 },
  { maxGap: Infinity, winNormal: 0, winAbnormal: 40, lossNormal: 0, lossAbnormal: -29 },
];

/**
 * Valeur brute du barème, avant application du coefficient.
 *
 * `gap` est l'écart **absolu** entre les deux classements : c'est
 * `isAbnormal` qui porte le sens du résultat, pas le signe de l'écart.
 */
export function ffttTablePoints(gap: number, victory: boolean, isAbnormal: boolean): number {
  const g = Number.isFinite(gap) ? Math.abs(gap) : 0;
  const row = TABLE.find((r) => g <= r.maxGap) ?? TABLE[TABLE.length - 1]!;
  if (victory) return isAbnormal ? row.winAbnormal : row.winNormal;
  return isAbnormal ? row.lossAbnormal : row.lossNormal;
}

/**
 * Ramène un coefficient saisi à une valeur exploitable.
 *
 * Accepte la virgule décimale : le réglage est saisi par un utilisateur
 * francophone, `0,75` doit valoir `0.75`. Toute valeur illisible ou hors
 * bornes retombe sur le défaut plutôt que de propager un `NaN` jusqu'aux
 * fiches joueurs.
 */
export function parsePointsCoefficient(raw: string | number | null | undefined): number {
  if (raw === null || raw === undefined) return DEFAULT_POINTS_COEFFICIENT;
  const value = typeof raw === 'number' ? raw : Number(String(raw).trim().replace(',', '.'));
  if (!Number.isFinite(value)) return DEFAULT_POINTS_COEFFICIENT;
  if (value < MIN_POINTS_COEFFICIENT || value > MAX_POINTS_COEFFICIENT) {
    return DEFAULT_POINTS_COEFFICIENT;
  }
  return value;
}

/**
 * Arrondit au centième.
 *
 * Le produit d'une valeur du barème par un coefficient tombe rarement juste
 * (`-12.5 × 0.75 = -9.375`). Sans arrondi, les flottants accumuleraient des
 * traînées de décimales dans `Player.points` au fil des matchs.
 */
function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

/**
 * Points gagnés ou perdus par un joueur sur une partie.
 *
 * Les parties hors barème (forfait, entrée de tableau sans adversaire) sont
 * renvoyées avec `points: 0` et un motif d'exclusion plutôt que d'être
 * écartées silencieusement : le joueur doit comprendre pourquoi une ligne de
 * son parcours ne pèse rien.
 */
export function ffttMatchPoints(input: MatchPointsInput): MatchPointsResult {
  const coefficient = parsePointsCoefficient(input.coefficient);

  const excluded: MatchPointsExclusion | null = input.isForfeit
    ? 'forfait'
    : input.opponentPoints === null || !Number.isFinite(input.opponentPoints)
      ? 'sans_adversaire'
      : null;

  if (excluded) {
    return {
      points: 0,
      rawPoints: 0,
      coefficient,
      gap: 0,
      isAbnormal: false,
      kind: 'normal',
      excluded,
    };
  }

  const playerPoints = Number.isFinite(input.playerPoints) ? input.playerPoints : 0;
  const opponentPoints = input.opponentPoints as number;
  const gap = Math.abs(opponentPoints - playerPoints);
  const isAbnormal = isAbnormalResult(playerPoints, opponentPoints, input.victory);
  const rawPoints = ffttTablePoints(gap, input.victory, isAbnormal);

  return {
    points: round2(rawPoints * coefficient),
    rawPoints,
    coefficient,
    gap,
    isAbnormal,
    kind: isAbnormal ? (input.victory ? 'perf' : 'contre') : 'normal',
    excluded: null,
  };
}

/**
 * Met en forme un nombre de points pour l'affichage.
 *
 * Le barème produit des demis (`5,5`) et des quarts une fois pondérés
 * (`9,38`) : on n'affiche les décimales que lorsqu'elles existent, sinon la
 * colonne se remplit de « 6,00 » sans rien apporter.
 */
export function formatPoints(value: number, withSign = false): string {
  if (!Number.isFinite(value)) return '0';
  const rounded = round2(value);
  const body = Number.isInteger(rounded)
    ? String(Math.abs(rounded))
    : Math.abs(rounded).toFixed(2).replace(/0$/, '').replace('.', ',');
  if (rounded < 0) return `−${body}`;
  return withSign && rounded > 0 ? `+${body}` : body;
}

/** Libellé français du coefficient (`0,75`). */
export function formatCoefficient(coefficient: number): string {
  return String(parsePointsCoefficient(coefficient)).replace('.', ',');
}
