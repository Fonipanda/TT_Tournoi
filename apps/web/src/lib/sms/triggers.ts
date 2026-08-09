/**
 * Déclencheurs SMS automatiques — métadonnées et interrupteurs.
 *
 * Module volontairement séparé de `notify.ts` : il ne dépend ni de BullMQ ni
 * de Redis, et peut donc être importé par les composants serveur (page
 * `/admin/sms`) sans ouvrir de connexion à la file d'attente.
 */

import { prisma } from '@tt/db';

export type SmsTrigger = 'table_assigned' | 'match_created' | 'result';

export const SMS_TRIGGERS: {
  key: SmsTrigger;
  label: string;
  description: string;
  defaultEnabled: boolean;
}[] = [
  {
    key: 'table_assigned',
    label: 'Appel à la table',
    description:
      "Prévient le joueur dès qu'une table lui est affectée. C'est l'usage principal pendant le tournoi.",
    defaultEnabled: true,
  },
  {
    key: 'match_created',
    label: 'Convocation (création de match)',
    description:
      "Prévient à la création d'un match unitaire. La génération d'un tableau complet n'envoie jamais de SMS.",
    defaultEnabled: false,
  },
  {
    key: 'result',
    label: 'Résultat enregistré',
    description: 'Confirme au joueur la saisie du score de son match.',
    defaultEnabled: false,
  },
];

/** Clé `SiteSetting` associée à un déclencheur. */
export function triggerSettingKey(trigger: SmsTrigger): string {
  return `sms.auto.${trigger}`;
}

function defaultEnabled(trigger: SmsTrigger): boolean {
  return SMS_TRIGGERS.find((t) => t.key === trigger)?.defaultEnabled ?? false;
}

/** Lit l'état d'un déclencheur (valeur par défaut si non renseigné en base). */
export async function isTriggerEnabled(trigger: SmsTrigger): Promise<boolean> {
  try {
    const setting = await prisma.siteSetting.findUnique({
      where: { key: triggerSettingKey(trigger) },
    });
    if (!setting) return defaultEnabled(trigger);
    return setting.value === 'true';
  } catch {
    // Table absente (base non migrée) : on retombe sur la valeur par défaut.
    return defaultEnabled(trigger);
  }
}

/** État de tous les déclencheurs, pour l'UI admin. */
export async function getTriggerStates(): Promise<Record<SmsTrigger, boolean>> {
  const entries = await Promise.all(
    SMS_TRIGGERS.map(async (t) => [t.key, await isTriggerEnabled(t.key)] as const),
  );
  return Object.fromEntries(entries) as Record<SmsTrigger, boolean>;
}
