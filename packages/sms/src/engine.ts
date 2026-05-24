/**
 * Engine SMS — orchestration envoi unitaire + bulk.
 *
 * Ce module utilise l'adaptateur ACTIF (DB) et logge chaque tentative dans
 * `SmsLog`. L'envoi en masse est délégué à BullMQ (cf. queue.ts).
 */

import { prisma, type Player, type SmsAdapterConfig, type SmsLog } from '@tt/db';
import type { BulkRecipient, BulkSendResult, SmsAdapter, SmsSendResult } from '@tt/types';
import { getAdapter } from './registry.js';
import { smsQueue } from './queue.js';

let cachedActiveConfig: SmsAdapterConfig | null = null;
let cachedActiveAt = 0;
const ACTIVE_CACHE_TTL_MS = 30_000;

/**
 * Retourne la config de l'adaptateur SMS actif (avec cache mémoire 30s).
 * Renvoie null si aucun n'est actif.
 */
export async function getActiveAdapterConfig(): Promise<SmsAdapterConfig | null> {
  const now = Date.now();
  if (cachedActiveConfig && now - cachedActiveAt < ACTIVE_CACHE_TTL_MS) {
    return cachedActiveConfig;
  }
  cachedActiveConfig = await prisma.smsAdapterConfig.findFirst({
    where: { isActive: true },
  });
  cachedActiveAt = now;
  return cachedActiveConfig;
}

export function invalidateAdapterCache(): void {
  cachedActiveConfig = null;
  cachedActiveAt = 0;
}

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
  const config = await getActiveAdapterConfig();

  if (!config) {
    return prisma.smsLog.create({
      data: {
        playerId: options.player?.id,
        recipientPhone: to,
        recipientName: options.player ? `${options.player.lastName} ${options.player.firstName}` : '',
        message,
        sender: options.sender ?? '',
        adapterName: 'none',
        status: 'failed',
        errorMessage: 'Aucun adaptateur SMS actif',
        kind: options.kind ?? 'manual',
        trigger: options.trigger ?? '',
      },
    });
  }

  const adapter = getAdapter(config.adapterType, config.config as Record<string, unknown>);
  const effectiveSender = options.sender || config.defaultSender || '';

  const log = await prisma.smsLog.create({
    data: {
      playerId: options.player?.id,
      recipientPhone: to,
      recipientName: options.player ? `${options.player.lastName} ${options.player.firstName}` : '',
      message,
      sender: effectiveSender,
      adapterName: config.name,
      status: 'pending',
      kind: options.kind ?? 'manual',
      trigger: options.trigger ?? '',
    },
  });

  let result: SmsSendResult;
  try {
    result = await adapter.send(to, message, effectiveSender);
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
