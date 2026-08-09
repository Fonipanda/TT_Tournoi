/**
 * BullMQ — file SMS avec rate limiting (40/min OVH safe).
 *
 * Le Worker démarre dans `apps/web/src/instrumentation.ts` (Next.js
 * instrumentation hook) au boot du serveur.
 */

import { Queue, Worker, UnrecoverableError, type Job } from 'bullmq';
import IORedis from 'ioredis';
import { prisma } from '@tt/db';
import { resolveActiveAdapter } from './config';
import { normalizePhone } from './phone';

export interface SmsJobPayload {
  to: string;
  message: string;
  sender?: string;
  playerId?: string;
  recipientName?: string;
  kind?: 'manual' | 'auto';
  trigger?: string;
}

const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';
const QUEUE_NAME = 'sms';

// Connexion partagée (BullMQ recommande maxRetriesPerRequest=null)
let connection: IORedis | null = null;
function getConnection(): IORedis {
  if (!connection) {
    connection = new IORedis(REDIS_URL, {
      maxRetriesPerRequest: null,
      enableReadyCheck: true,
    });
  }
  return connection;
}

export const smsQueue = new Queue<SmsJobPayload>(QUEUE_NAME, {
  connection: getConnection(),
});

/**
 * Démarre le Worker (à appeler une seule fois au boot).
 * Rate limiter : 40 SMS / 60s (OVH = 50/min, on garde une marge).
 */
export function startSmsWorker(): Worker<SmsJobPayload> {
  const worker = new Worker<SmsJobPayload>(
    QUEUE_NAME,
    async (job: Job<SmsJobPayload>) => {
      const { to, message, sender, playerId, recipientName, kind, trigger } = job.data;
      const resolved = await resolveActiveAdapter();

      const logFailure = (adapterName: string, errorMessage: string, phone: string) =>
        prisma.smsLog.create({
          data: {
            playerId,
            recipientPhone: phone,
            recipientName: recipientName ?? '',
            message,
            sender: sender ?? '',
            adapterName,
            status: 'failed',
            errorMessage,
            kind: kind ?? 'auto',
            trigger: trigger ?? '',
          },
        });

      if (!resolved) {
        await logFailure('none', 'Aucun adaptateur SMS actif', to);
        throw new Error('Aucun adaptateur SMS actif');
      }

      // Un numéro invalide le restera : inutile de consommer les 3 tentatives.
      const phone = normalizePhone(to);
      if (!phone.ok) {
        await logFailure(
          resolved.adapterName,
          `Numéro non normalisable : ${phone.reason}`,
          to,
        );
        throw new UnrecoverableError(`Numéro non normalisable : ${phone.reason}`);
      }

      const effectiveSender = sender || resolved.defaultSender || '';

      const log = await prisma.smsLog.create({
        data: {
          playerId,
          recipientPhone: phone.e164,
          recipientName: recipientName ?? '',
          message,
          sender: effectiveSender,
          adapterName: resolved.adapterName,
          status: 'pending',
          kind: kind ?? 'auto',
          trigger: trigger ?? '',
        },
      });

      const result = await resolved.adapter.send(phone.e164, message, effectiveSender);
      await prisma.smsLog.update({
        where: { id: log.id },
        data: {
          status: result.success ? 'sent' : 'failed',
          errorMessage: result.error ?? '',
          providerId: result.providerId,
        },
      });

      if (!result.success) {
        throw new Error(result.error ?? 'SMS échoué');
      }
      return { logId: log.id, providerId: result.providerId };
    },
    {
      connection: getConnection(),
      concurrency: 5,
      limiter: {
        max: 40,
        duration: 60_000, // 40 SMS / minute (marge sous OVH 50/min)
      },
    },
  );

  worker.on('failed', (job, err) => {
    console.error(`[SMS WORKER] job=${job?.id} failed: ${err.message}`);
  });
  worker.on('completed', (job) => {
    console.info(`[SMS WORKER] job=${job.id} sent`);
  });

  return worker;
}

export async function getQueueStats() {
  const [waiting, active, completed, failed, delayed] = await Promise.all([
    smsQueue.getWaitingCount(),
    smsQueue.getActiveCount(),
    smsQueue.getCompletedCount(),
    smsQueue.getFailedCount(),
    smsQueue.getDelayedCount(),
  ]);
  return { waiting, active, completed, failed, delayed };
}
