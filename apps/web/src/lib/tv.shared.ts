/**
 * Mode TV — constantes partagées client / serveur.
 *
 * Aucun import Node ni Prisma ici : ce module est importé par le composant
 * client `TvModeCard`. La lecture en base vit dans `tv.ts` (serveur).
 */

export const TV_INTERVAL_KEY = 'tv.interval.ms';

export const TV_INTERVAL_DEFAULT_MS = 5000;
export const TV_INTERVAL_MIN_MS = 3000;
export const TV_INTERVAL_MAX_MS = 30000;

/** Ramène une valeur quelconque dans la plage autorisée. */
export function clampTvInterval(raw: unknown): number {
  const n = typeof raw === 'number' ? raw : Number.parseInt(String(raw ?? ''), 10);
  if (!Number.isFinite(n)) return TV_INTERVAL_DEFAULT_MS;
  return Math.min(TV_INTERVAL_MAX_MS, Math.max(TV_INTERVAL_MIN_MS, Math.round(n)));
}
