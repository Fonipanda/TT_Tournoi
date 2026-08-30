/**
 * Dimensionnement et répartition des poules.
 *
 * Module PUR : aucun import de `@tt/db` / prisma, car il est partagé entre le
 * moteur serveur (`engine.ts`) et l'aperçu admin côté client (`PoolSizeModal`).
 *
 * ─── Règle de dimensionnement ──────────────────────────────────────────────
 * Une poule contient STRICTEMENT 2, 3 ou 4 joueurs. Pour N participants, on
 * cherche des entiers P2, P3, P4 ≥ 0 tels que :
 *
 *     2·P2 + 3·P3 + 4·P4 = N
 *
 * Parmi toutes les solutions, on retient la meilleure selon un score
 * LEXICOGRAPHIQUE, donc totalement déterministe et reproductible :
 *
 *   1. minimiser le nombre de poules de 2 (sauf si la taille privilégiée est 2) ;
 *   2. maximiser le nombre de poules de la taille privilégiée (3 par défaut) ;
 *   3. minimiser le nombre total de poules ;
 *   4. minimiser l'écart entre la plus grande et la plus petite poule ;
 *   5. départage final : le plus grand nombre de poules de 4.
 *
 * Exemples de référence :
 *   32 → 8 poules de 3 + 2 poules de 4 = 10 poules
 *   31 → 9 poules de 3 + 1 poule  de 4 = 10 poules
 *   30 → 10 poules de 3                = 10 poules
 *    7 → 1 poule  de 3 + 1 poule  de 4 =  2 poules
 *
 * Seuls N = 2 et N = 5 imposent une poule de 2 : 5 n'est décomposable ni en
 * sommes de 3 ni de 4.
 */

/** Tailles de poule autorisées, de la plus petite à la plus grande. */
export const ALLOWED_POOL_SIZES = [2, 3, 4] as const;

/** Taille de poule privilégiée quand l'admin laisse le mode « Automatique ». */
export const DEFAULT_PREFERRED_POOL_SIZE = 3;

export interface PoolPlan {
  /** Nombre de poules de 2 joueurs. */
  p2: number;
  /** Nombre de poules de 3 joueurs. */
  p3: number;
  /** Nombre de poules de 4 joueurs. */
  p4: number;
  /** Nombre total de poules (p2 + p3 + p4). */
  numPools: number;
  /** Tailles réellement produites par le serpent, dans l'ordre des poules. */
  sizes: number[];
}

const EMPTY_PLAN: PoolPlan = { p2: 0, p3: 0, p4: 0, numPools: 0, sizes: [] };

function normalizePreferred(preferred?: number): number {
  return preferred === 2 || preferred === 3 || preferred === 4
    ? preferred
    : DEFAULT_PREFERRED_POOL_SIZE;
}

/**
 * Tailles des poules produites par le serpent de `generatePools` pour `total`
 * joueurs répartis sur `numPools` poules, dans l'ordre des poules.
 *
 * Le serpent alterne le sens de remplissage à chaque rangée : la dernière
 * rangée, incomplète, garnit donc les DERNIÈRES poules quand son indice est
 * impair — cas nominal des répartitions 3/4, où les poules de 4 se retrouvent
 * en fin de liste.
 */
export function snakePoolSizes(total: number, numPools: number): number[] {
  if (numPools <= 0 || total <= 0) return [];
  const sizes = Array.from({ length: numPools }, () => 0);
  for (let i = 0; i < total; i++) {
    const round = Math.floor(i / numPools);
    const idx = round % 2 === 0 ? i % numPools : numPools - 1 - (i % numPools);
    sizes[idx]! += 1;
  }
  return sizes;
}

/** Comparaison lexicographique de deux scores de même longueur. */
function isLowerScore(a: number[], b: number[]): boolean {
  for (let i = 0; i < a.length; i++) {
    if (a[i]! !== b[i]!) return a[i]! < b[i]!;
  }
  return false;
}

/**
 * Détermine la répartition optimale des poules pour `total` joueurs.
 *
 * @param total - Nombre de joueurs à répartir.
 * @param preferred - Taille de poule privilégiée (2, 3 ou 4). Par défaut 3.
 */
export function computePoolPlan(total: number, preferred?: number): PoolPlan {
  if (!Number.isInteger(total) || total < 2) return EMPTY_PLAN;
  const pref = normalizePreferred(preferred);

  let best: { p2: number; p3: number; p4: number } | null = null;
  let bestScore: number[] | null = null;

  for (let p4 = 0; p4 * 4 <= total; p4++) {
    for (let p3 = 0; p3 * 3 + p4 * 4 <= total; p3++) {
      const rest = total - 4 * p4 - 3 * p3;
      if (rest % 2 !== 0) continue;
      const p2 = rest / 2;
      const numPools = p2 + p3 + p4;
      if (numPools === 0) continue;

      const present: number[] = [];
      if (p2 > 0) present.push(2);
      if (p3 > 0) present.push(3);
      if (p4 > 0) present.push(4);
      const spread = Math.max(...present) - Math.min(...present);
      const preferredCount = pref === 2 ? p2 : pref === 3 ? p3 : p4;

      const score = [
        pref === 2 ? 0 : p2, // 1. éviter les poules de 2
        -preferredCount, //     2. privilégier la taille demandée
        numPools, //            3. minimiser le nombre de poules
        spread, //              4. tailles aussi homogènes que possible
        -p4, //                 5. départage déterministe
      ];

      if (bestScore === null || isLowerScore(score, bestScore)) {
        bestScore = score;
        best = { p2, p3, p4 };
      }
    }
  }

  if (!best) return EMPTY_PLAN;
  const numPools = best.p2 + best.p3 + best.p4;
  return { ...best, numPools, sizes: snakePoolSizes(total, numPools) };
}

/** Nombre de poules à créer pour `total` joueurs. */
export function computePoolCount(total: number, preferred?: number): number {
  return computePoolPlan(total, preferred).numPools;
}

/** Tailles des poules, dans l'ordre des poules. */
export function computePoolSizes(total: number, preferred?: number): number[] {
  return computePoolPlan(total, preferred).sizes;
}

/** Nombre de matches d'une poule de `n` joueurs (round-robin complet). */
export function matchesForPoolSize(n: number): number {
  return n >= 2 ? (n * (n - 1)) / 2 : 0;
}

/** Nombre total de matches de poule pour un jeu de tailles. */
export function countPoolMatches(sizes: number[]): number {
  return sizes.reduce((sum, n) => sum + matchesForPoolSize(n), 0);
}
