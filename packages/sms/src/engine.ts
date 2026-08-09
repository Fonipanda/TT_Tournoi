/**
 * Engine SMS — orchestration envoi unitaire + bulk.
 *
 * L'adaptateur utilisé est résolu par `resolveActiveAdapter()` (base de
 * données prioritaire, variables d'environnement en amorçage) et chaque
 * tentative est journalisée dans `SmsLog`. L'envoi en masse est délégué à
 * BullMQ (cf. queue.ts).
 */

import { prisma, type Player, type SmsLog } from '@tt/db';
import type { BulkRecipient, BulkSendResult, SmsAdapter, SmsSendResult } from '@tt/types';
import { resolveActiveAdapter } from './config';
import { normalizePhone } from './phone';
import { smsQueue } from './queue';

export interface SendSmsOptions {
  player?: Pick<Player, 'id' | 'firstName' | 'lastName' | 'phone'> | null;
  sender?: string;
  kind?: 'manual' | 'auto';
  trigger?: string;
}

/**
 * Envoi unitaire (synchrone) — log en DB.
 * Utilisé pour les SMS de test ou quand on veut feedback immédiat.
 */
export async function sendSmsSync(
  to: string,
  message: string,
  options: SendSmsOptions = {},
): Promise<SmsLog> {
  const recipientName = options.player
    ? `${options.player.lastName} ${options.player.firstName}`
    : '';

  const fail = (adapterName: string, errorMessage: string, phone: string) =>
    prisma.smsLog.create({
      data: {
        playerId: options.player?.id,
        recipientPhone: phone,
        recipientName,
        message,
        sender: options.sender ?? '',
        adapterName,
        status: 'failed',
        errorMessage,
        kind: options.kind ?? 'manual',
        trigger: options.trigger ?? '',
      },
    });

  const resolved = await resolveActiveAdapter();
  if (!resolved) {
    return fail('none', 'Aucun adaptateur SMS actif', to);
  }

  // Garde-fou : l'API OVH n'accepte que le format international.
  const phone = normalizePhone(to);
  if (!phone.ok) {
    return fail(resolved.adapterName, `Numéro non normalisable : ${phone.reason}`, to);
  }

  const effectiveSender = options.sender || resolved.defaultSender || '';

  const log = await prisma.smsLog.create({
    data: {
      playerId: options.player?.id,
      recipientPhone: phone.e164,
      recipientName,
      message,
      sender: effectiveSender,
      adapterName: resolved.adapterName,
      status: 'pending',
      kind: options.kind ?? 'manual',
      trigger: options.trigger ?? '',
    },
  });

  let result: SmsSendResult;
  try {
    result = await resolved.adapter.send(phone.e164, message, effectiveSender);
  } catch (e) {
    result = { success: false, error: e instanceof Error ? e.message : String(e) };
  }

  return prisma.smsLog.update({
    where: { id: log.id },
    data: {
      status: result.success ? 'sent' : 'failed',
      errorMessage: result.error ?? '',
      providerId: result.providerId,
    },
  });
}

/**
 * Envoi en masse — pousse les jobs dans BullMQ et retourne immédiatement.
 * Le worker traitera selon le rate limiter (40 SMS/min OVH).
 */
export async function sendBulkSms(
  recipients: BulkRecipient[],
  message: string,
  options: SendSmsOptions = {},
): Promise<BulkSendResult> {
  const jobIds: string[] = [];
  for (const r of recipients) {
    const job = await smsQueue.add(
      'send',
      {
        to: r.phone,
        message,
        sender: options.sender,
        playerId: r.playerId,
        recipientName: r.name,
        kind: options.kind ?? 'manual',
        trigger: options.trigger ?? '',
      },
      {
        removeOnComplete: { age: 3600, count: 1000 },
        removeOnFail: { age: 86400, count: 500 },
        attempts: 3,
        backoff: { type: 'exponential', delay: 5000 },
      },
    );
    if (job.id) jobIds.push(job.id);
  }
  return { sent: 0, failed: 0, total: recipients.length, jobIds };
}

/**
 * Résolution des destinataires SMS pour un joueur :
 *  - tout abonné dans `PlayerNotificationSubscription` avec smsEnabled
 *  - fallback : le numéro du joueur si pas d'abonné
 */
export async function resolveSubscribers(playerId: string): Promise<BulkRecipient[]> {
  const player = await prisma.player.findUnique({
    where: { id: playerId },
    include: { notificationSubs: { where: { smsEnabled: true } } },
  });
  if (!player) return [];

  const recipients: BulkRecipient[] = [];
  for (const sub of player.notificationSubs) {
    const phone = sub.subscriberPhone || player.phone || '';
    if (phone) {
      recipients.push({
        phone,
        name: sub.subscriberName || `${player.lastName} ${player.firstName}`,
        playerId: player.id,
      });
    }
  }
  if (recipients.length === 0 && player.phone) {
    recipients.push({
      phone: player.phone,
      name: `${player.lastName} ${player.firstName}`,
      playerId: player.id,
    });
  }
  return recipients;
}

export type { SmsAdapter };
