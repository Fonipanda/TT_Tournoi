/**
 * Hook d'instrumentation Next.js (server-side init).
 * Démarre le Worker BullMQ SMS au boot du serveur.
 *
 * @see https://nextjs.org/docs/app/building-your-application/optimizing/instrumentation
 */

export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    const { startSmsWorker } = await import('@tt/sms/queue');
    startSmsWorker();
    console.info('[boot] SMS worker démarré.');
  }
}
