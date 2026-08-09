/**
 * Quota d'inscription par joueur.
 *
 * Règle FFTT : un joueur ne peut pas s'inscrire à plus de 2 tableaux sur une
 * même journée. La limite est **journalière**, pas globale : un joueur peut
 * disputer 2 tableaux le samedi et 2 autres le dimanche.
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
  day: string | null;
}

/**
 * Clé de regroupement par journée.
 * Les tableaux sans journée renseignée forment leur propre groupe : à défaut,
 * ils seraient tous fusionnés avec une journée réelle et fausseraient le compte.
 */
export function bracketDayKey(day: string | null | undefined): string {
  return day ?? '';
}

export interface DailyQuotaViolation {
  bracket: BracketDay;
  day: string | null;
}

/**
 * Vérifie que l'ajout de `incoming` aux inscriptions `existing` respecte le
 * quota journalier.
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
    const key = bracketDayKey(b.day);
    perDay.set(key, (perDay.get(key) ?? 0) + 1);
  }

  for (const b of incoming) {
    if (counted.has(b.id)) continue;
    counted.add(b.id);
    const key = bracketDayKey(b.day);
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
