/**
 * Quota d'inscription par joueur.
 *
 * Règle FFTT : un joueur ne peut pas s'inscrire à plus de 2 tableaux sur une
 * même journée. La limite est **journalière**, pas globale : un joueur peut
 * disputer 2 tableaux le samedi et 2 autres le dimanche.
 *
 * Elle est de surcroît **propre à chaque tournoi**. Deux tournois distincts se
 * tiennent à des dates distinctes ; leurs libellés de journée (« Samedi »,
 * « Dimanche ») se ressemblent mais ne désignent pas le même jour. Les
 * confondre ferait consommer à un tournoi le quota d'un autre.
 *
 * Ce module ne dépend ni de Node ni de Prisma : il est importé aussi bien par
 * les routes API que par la page d'inscription côté client, pour que les deux
 * appliquent exactement la même règle.
 */

export const MAX_BRACKETS_PER_DAY = 2;

/** Tableau réduit aux champs nécessaires au calcul du quota. */
export interface BracketDay {
  id: string;
  name: string;
  tournamentId: string;
  day: string | null;
}

/**
 * Clé de regroupement d'une journée de tournoi.
 *
 * Le tournoi fait partie de la clé : « Samedi » du tournoi de printemps et
 * « Samedi » du tournoi d'automne sont deux journées sans rapport.
 * Les tableaux sans journée renseignée forment leur propre groupe au sein de
 * leur tournoi : à défaut, ils seraient fusionnés avec une journée réelle.
 *
 * Le séparateur est un caractère nul, absent de tout identifiant comme de tout
 * libellé saisi : sans lui, deux couples différents pourraient produire la même
 * clé par recollement.
 */
export function bracketScopeKey(b: { tournamentId: string; day: string | null | undefined }): string {
  return `${b.tournamentId}\u0000${b.day ?? ''}`;
}

export interface DailyQuotaViolation {
  bracket: BracketDay;
  day: string | null;
}

/**
 * Vérifie que l'ajout de `incoming` aux inscriptions `existing` respecte le
 * quota journalier, tournoi par tournoi.
 *
 * Un tableau déjà présent dans `existing` n'est pas recompté : réinscrire un
 * joueur à un tableau où il figure déjà est idempotent et ne doit pas échouer.
 *
 * @returns le premier tableau fautif, ou `null` si tout passe.
 */
export function findDailyQuotaViolation(
  existing: readonly BracketDay[],
  incoming: readonly BracketDay[],
): DailyQuotaViolation | null {
  const perDay = new Map<string, number>();
  const counted = new Set<string>();

  for (const b of existing) {
    if (counted.has(b.id)) continue;
    counted.add(b.id);
    const key = bracketScopeKey(b);
    perDay.set(key, (perDay.get(key) ?? 0) + 1);
  }

  for (const b of incoming) {
    if (counted.has(b.id)) continue;
    counted.add(b.id);
    const key = bracketScopeKey(b);
    const next = (perDay.get(key) ?? 0) + 1;
    if (next > MAX_BRACKETS_PER_DAY) return { bracket: b, day: b.day };
    perDay.set(key, next);
  }

  return null;
}

/** Message d'erreur lisible pour l'utilisateur final. */
export function dailyQuotaMessage(violation: DailyQuotaViolation): string {
  const when = violation.day ? `le ${violation.day}` : 'sur cette journée';
  return `Maximum ${MAX_BRACKETS_PER_DAY} tableaux par jour : « ${violation.bracket.name} » dépasse le quota ${when}.`;
}

// ---------------------------------------------------------------------------
// Fenêtre de points (règle FFTT)
// ---------------------------------------------------------------------------

/**
 * En tournoi homologué, un tableau définit une fenêtre de classement que le
 * joueur ne doit pas franchir, dans un sens comme dans l'autre :
 *
 * - `maxPoints` — « Moins de 1099 points », « Série -1300 » : réservé aux
 *   joueurs classés **au plus** à cette valeur. Un joueur mieux classé
 *   écraserait la compétition.
 * - `minPoints` — un tableau réservé aux 1500 points et plus n'est pas
 *   ouvert à un joueur de 900 points.
 *
 * Les deux bornes sont opposables et vérifiées côté serveur. `minPoints` et
 * `maxPoints` à `null` décrivent un tableau « Toutes Séries » / Open, ouvert à
 * tous les classements et dispensé de tout contrôle.
 *
 * Une fois la jauge remplie à `FILL_OPEN_RATIO`, la fenêtre tombe : voir
 * `isOpenByFill`.
 */
export interface BracketPointsWindow {
  id: string;
  name: string;
  minPoints: number | null;
  maxPoints: number | null;
  /** Jauge du tableau. `0` = non renseignée, l'ouverture ne s'applique pas. */
  maxPlayers: number;
  /** Inscriptions actives déjà enregistrées sur ce tableau. */
  registeredCount: number;
}

/**
 * Taux de remplissage à partir duquel un tableau s'ouvre à tous les
 * classements. Le tournoi privilégie alors la tenue effective du tableau sur
 * la stricte homogénéité du niveau.
 */
export const FILL_OPEN_RATIO = 0.7;

/**
 * Le tableau est-il suffisamment rempli pour accueillir n'importe quel
 * classement ?
 *
 * L'ouverture lève la fenêtre de points **et** l'exigence de classement
 * vérifié : cette exigence n'existait que pour appliquer la fenêtre, la
 * maintenir seule refuserait un joueur sans qu'aucune borne ne soit opposée.
 *
 * Une jauge nulle ou absurde ne déclenche rien : sans dénominateur fiable, le
 * taux ne veut rien dire et l'ouverture serait accordée à un tableau vide.
 */
export function isOpenByFill(b: Pick<BracketPointsWindow, 'maxPlayers' | 'registeredCount'>): boolean {
  if (!Number.isFinite(b.maxPlayers) || b.maxPlayers <= 0) return false;
  if (!Number.isFinite(b.registeredCount) || b.registeredCount < 0) return false;
  return b.registeredCount / b.maxPlayers >= FILL_OPEN_RATIO;
}

/** État du joueur au regard du classement officiel. */
export interface PlayerRanking {
  points: number;
  /** Date de la dernière vérification FFTT. `null` = jamais vérifié. */
  ffttSyncedAt: Date | null;
}

export type PointsWindowReason =
  /** Mieux classé que le plafond du tableau. */
  | 'above_max'
  /** Moins bien classé que le plancher du tableau. */
  | 'below_min'
  /** Classement jamais confronté à la base fédérale. */
  | 'unverified';

export interface PointsWindowViolation {
  bracket: BracketPointsWindow;
  reason: PointsWindowReason;
  /** Classement retenu, arrondi. */
  points: number;
}

/** Un tableau sans borne est ouvert à tous : aucun contrôle ne s'applique. */
export function hasPointsWindow(b: BracketPointsWindow): boolean {
  return b.minPoints !== null || b.maxPoints !== null;
}

/**
 * Cherche le premier tableau dont la fenêtre de points n'est pas respectée.
 *
 * Le classement de référence est celui porté par la fiche au moment de
 * l'appel — « le classement à la date de validation de l'inscription fait
 * foi ». Encore faut-il qu'il vienne de la fédération : un classement jamais
 * synchronisé vaut 500 points par défaut ou une saisie manuelle, et ne permet
 * d'affirmer ni qu'il respecte la fenêtre, ni qu'il la viole. Le tableau borné
 * est donc refusé tant que la vérification n'a pas eu lieu.
 *
 * Un tableau rempli à `FILL_OPEN_RATIO` échappe entièrement au contrôle : à ce
 * stade il est assuré de se tenir, et l'ouvrir à tous prime sur l'homogénéité.
 *
 * @returns le premier tableau fautif, ou `null` si tout passe.
 */
export function findPointsWindowViolation(
  brackets: readonly BracketPointsWindow[],
  player: PlayerRanking,
): PointsWindowViolation | null {
  const verified = player.ffttSyncedAt !== null && Number.isFinite(player.points);
  const p = Math.round(player.points);

  for (const b of brackets) {
    if (!hasPointsWindow(b)) continue;
    // Seuil de remplissage atteint : plus aucune condition de classement.
    if (isOpenByFill(b)) continue;
    // Sans classement certifié, on ne compare rien : on refuse.
    if (!verified) return { bracket: b, reason: 'unverified', points: p };
    if (b.maxPoints !== null && p > b.maxPoints) {
      return { bracket: b, reason: 'above_max', points: p };
    }
    if (b.minPoints !== null && p < b.minPoints) {
      return { bracket: b, reason: 'below_min', points: p };
    }
  }
  return null;
}

/** Message d'erreur lisible pour l'utilisateur final. */
export function pointsWindowMessage(violation: PointsWindowViolation): string {
  const { bracket, points, reason } = violation;
  if (reason === 'unverified') {
    return `Classement non vérifié : « ${bracket.name} » impose une fenêtre de points. Lance la synchronisation FFTT depuis ton espace avant de t'inscrire.`;
  }
  if (reason === 'above_max') {
    return `Classement trop élevé pour « ${bracket.name} » : ce tableau est limité à ${bracket.maxPoints} pts, le classement retenu est de ${points} pts.`;
  }
  return `Classement insuffisant pour « ${bracket.name} » : ce tableau est réservé aux joueurs d'au moins ${bracket.minPoints} pts, le classement retenu est de ${points} pts.`;
}
