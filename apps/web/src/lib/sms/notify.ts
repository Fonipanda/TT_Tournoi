/**
 * Envoi des SMS automatiques.
 *
 * Point d'entrée unique appelé par les routes de tournoi lorsqu'un événement
 * notifiable survient. La logique est volontairement défensive : un SMS ne
 * doit JAMAIS faire échouer l'opération métier qui l'a déclenché (affectation
 * de table, enregistrement d'un score…).
 *
 * Les interrupteurs et leurs métadonnées vivent dans `./triggers`, qui ne
 * dépend pas de BullMQ et peut donc être importé par l'UI.
 */

import { prisma } from '@tt/db';
import type { SmsTemplateContext } from '@tt/types';
import { renderTemplate } from '@tt/sms/templates';
import { resolveSubscribers, sendBulkSms } from '@tt/sms/engine';
import { isTriggerEnabled, type SmsTrigger } from './triggers';

/**
 * Envoie le SMS associé à un déclencheur, si celui-ci est activé.
 *
 * @param trigger   Événement à l'origine de l'envoi ; correspond au nom du
 *                  `SmsTemplate` utilisé.
 * @param playerIds Joueurs concernés (valeurs vides et doublons filtrés).
 * @param context   Variables du template, communes ou calculées par joueur.
 *
 * Ne lève jamais : toute erreur est journalisée côté serveur.
 */
export async function notifySms(
  trigger: SmsTrigger,
  playerIds: (string | null | undefined)[],
  context: SmsTemplateContext | ((playerId: string) => SmsTemplateContext),
): Promise<void> {
  try {
    const ids = [...new Set(playerIds.filter((id): id is string => Boolean(id)))];
    if (ids.length === 0) return;

    if (!(await isTriggerEnabled(trigger))) return;

    const template = await prisma.smsTemplate.findUnique({ where: { name: trigger } });
    if (!template || !template.isActive) {
      console.info(`[sms] Déclencheur ${trigger} ignoré : template absent ou désactivé.`);
      return;
    }

    for (const playerId of ids) {
      const recipients = await resolveSubscribers(playerId);
      if (recipients.length === 0) continue;

      const vars = typeof context === 'function' ? context(playerId) : context;
      const message = renderTemplate(template.content, vars);

      await sendBulkSms(recipients, message, { kind: 'auto', trigger });
    }
  } catch (e) {
    // Un échec SMS ne doit pas remonter dans la réponse HTTP de l'opération métier.
    console.error(
      `[sms] Déclencheur ${trigger} en échec : ${e instanceof Error ? e.message : String(e)}`,
    );
  }
}

export type { SmsTrigger };
