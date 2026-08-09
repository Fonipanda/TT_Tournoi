/**
 * Mode maintenance.
 *
 * Piloté depuis `/admin/parametres`. Quand il est actif, les pages publiques
 * et l'espace joueur redirigent vers `/maintenance` ; l'espace staff reste
 * accessible, sinon l'administrateur ne pourrait plus désactiver le mode.
 *
 * Le contrôle est fait dans les layouts serveur et non dans le middleware :
 * ce dernier tourne en Edge Runtime, où Prisma n'est pas disponible.
 */

import { prisma } from '@tt/db';

export const MAINTENANCE_ENABLED_KEY = 'maintenance.enabled';
export const MAINTENANCE_MESSAGE_KEY = 'maintenance.message';

export const DEFAULT_MAINTENANCE_MESSAGE =
  'Le site est temporairement en maintenance. Merci de revenir dans quelques instants.';

export interface MaintenanceState {
  enabled: boolean;
  message: string;
}

/**
 * Lit l'état du mode maintenance.
 *
 * En cas d'erreur (table absente, base injoignable), on renvoie `enabled:
 * false` : une panne de lecture ne doit pas rendre le site inaccessible.
 */
export async function getMaintenanceState(): Promise<MaintenanceState> {
  try {
    const rows = await prisma.siteSetting.findMany({
      where: { key: { in: [MAINTENANCE_ENABLED_KEY, MAINTENANCE_MESSAGE_KEY] } },
    });
    const map = new Map(rows.map((r) => [r.key, r.value]));
    return {
      enabled: map.get(MAINTENANCE_ENABLED_KEY) === 'true',
      message: map.get(MAINTENANCE_MESSAGE_KEY)?.trim() || DEFAULT_MAINTENANCE_MESSAGE,
    };
  } catch {
    return { enabled: false, message: DEFAULT_MAINTENANCE_MESSAGE };
  }
}

/** Rôles autorisés à naviguer malgré le mode maintenance. */
const BYPASS_ROLES = new Set(['admin', 'juge_arbitre']);

export function canBypassMaintenance(role: string | null | undefined): boolean {
  return role ? BYPASS_ROLES.has(role) : false;
}
