/**
 * Mode TV — lecture serveur des réglages.
 *
 * L'intervalle de rotation est stocké dans `SiteSetting` (et non en
 * `localStorage`) : le mode TV tourne sur un écran dédié, pas sur le
 * navigateur de l'administrateur. Un réglage local ne serait jamais
 * appliqué à l'écran de la salle.
 */

import { prisma } from '@tt/db';
import { TV_INTERVAL_KEY, TV_INTERVAL_DEFAULT_MS, clampTvInterval } from './tv.shared';

export * from './tv.shared';

/**
 * Lit l'intervalle de rotation. En cas d'erreur de lecture, la valeur par
 * défaut est renvoyée : le mode TV doit toujours pouvoir démarrer.
 */
export async function getTvIntervalMs(): Promise<number> {
  try {
    const row = await prisma.siteSetting.findUnique({ where: { key: TV_INTERVAL_KEY } });
    if (!row) return TV_INTERVAL_DEFAULT_MS;
    return clampTvInterval(row.value);
  } catch {
    return TV_INTERVAL_DEFAULT_MS;
  }
}
