/**
 * @tt/db — Client Prisma singleton + types re-exportés
 *
 * Usage :
 *   import { prisma, type Player, MatchStatus } from '@tt/db';
 *
 * Le client est instancié en singleton pour éviter de saturer la pool de
 * connexions Postgres en mode dev (hot-reload Next.js).
 */

import { PrismaClient } from './generated/index';

declare global {
  // eslint-disable-next-line no-var
  var __ttPrisma: PrismaClient | undefined;
}

function createPrismaClient(): PrismaClient {
  return new PrismaClient({
    log:
      process.env.NODE_ENV === 'development'
        ? ['query', 'warn', 'error']
        : ['warn', 'error'],
  });
}

export const prisma: PrismaClient =
  globalThis.__ttPrisma ?? createPrismaClient();

if (process.env.NODE_ENV !== 'production') {
  globalThis.__ttPrisma = prisma;
}

// Re-export complet du client généré (types + enums + Prisma namespace)
export * from './generated/index';
export { Prisma } from './generated/index';

// Helpers utiles
export type { PrismaClient } from './generated/index';
