/**
 * Lecture du coefficient d'épreuve appliqué au barème FFTT.
 *
 * Le réglage est global et vit dans `SiteSetting`, comme le mode maintenance
 * ou le logo : il vaut pour toute la plateforme et se pilote depuis
 * `/admin/parametres`.
 *
 * Module serveur uniquement (il importe Prisma). Le calcul lui-même reste
 * dans `points.ts`, qui doit rester importable côté client.
 */

import { prisma } from '@tt/db';
import {
  DEFAULT_POINTS_COEFFICIENT,
  POINTS_COEFFICIENT_KEY,
  parsePointsCoefficient,
} from './points';

/**
 * Coefficient en vigueur.
 *
 * En cas d'erreur (table absente, base injoignable), on retombe sur le
 * défaut : une panne de lecture doit dégrader le calcul, pas l'interrompre —
 * la clôture d'un match ne peut pas échouer parce qu'un réglage cosmétique
 * est illisible.
 */
export async function getPointsCoefficient(): Promise<number> {
  try {
    const row = await prisma.siteSetting.findUnique({
      where: { key: POINTS_COEFFICIENT_KEY },
    });
    return parsePointsCoefficient(row?.value);
  } catch {
    return DEFAULT_POINTS_COEFFICIENT;
  }
}
