/**
 * Classement FFTT déduit du nombre de points.
 *
 * L'échelle fédérale progresse par tranches de 100 points : 762 points
 * correspondent au classement 7, 1050 au classement 10.
 *
 * Module pur, importable côté client comme côté serveur.
 */

/** Classement le plus bas de l'échelle fédérale. */
export const MIN_RANKING = 5;

/**
 * Convertit des points en classement.
 *
 * Le plancher n'est pas cosmétique : les fiches sont créées à 500 points par
 * défaut et le classement 4 n'existe pas. Sans lui, une donnée aberrante
 * afficherait publiquement un classement inexistant.
 */
export function rankingFromPoints(points: number): number {
  if (!Number.isFinite(points)) return MIN_RANKING;
  return Math.max(MIN_RANKING, Math.floor(points / 100));
}
