/**
 * Rate limiting — fenêtre fixe, Redis en primaire, mémoire locale en secours.
 *
 * Utilisé sur les routes d'authentification pour bloquer le brute-force et
 * limiter la charge CPU/RAM d'argon2 (chaque tentative coûte 64 Mo).
 *
 * Node.js only (ioredis) — ne pas importer dans le middleware Edge.
 */

import { NextResponse, type NextRequest } from 'next/server';
import { redis } from '@/lib/redis';

export interface RateLimitOptions {
  /** Nombre maximum de requêtes autorisées dans la fenêtre. */
  limit: number;
  /** Durée de la fenêtre, en secondes. */
  windowSec: number;
}

export interface RateLimitResult {
  ok: boolean;
  remaining: number;
  /** Secondes avant réinitialisation du compteur. */
  retryAfterSec: number;
}

// -----------------------------------------------------------------------------
// Fallback mémoire (si Redis indisponible) — par instance de process
// -----------------------------------------------------------------------------

const memoryStore = new Map<string, { count: number; resetAt: number }>();

function memoryHit(key: string, opts: RateLimitOptions): RateLimitResult {
  const now = Date.now();
  const entry = memoryStore.get(key);

  if (!entry || entry.resetAt <= now) {
    memoryStore.set(key, { count: 1, resetAt: now + opts.windowSec * 1000 });
    return { ok: true, remaining: opts.limit - 1, retryAfterSec: opts.windowSec };
  }

  entry.count += 1;
  const retryAfterSec = Math.max(1, Math.ceil((entry.resetAt - now) / 1000));
  return {
    ok: entry.count <= opts.limit,
    remaining: Math.max(0, opts.limit - entry.count),
    retryAfterSec,
  };
}

// Purge périodique pour éviter la fuite mémoire sur un process long.
if (typeof setInterval === 'function') {
  const timer = setInterval(() => {
    const now = Date.now();
    for (const [key, entry] of memoryStore) {
      if (entry.resetAt <= now) memoryStore.delete(key);
    }
  }, 60_000);
  // Ne pas maintenir le process en vie juste pour ce timer.
  if (typeof timer === 'object' && timer && 'unref' in timer) timer.unref();
}

// -----------------------------------------------------------------------------
// API publique
// -----------------------------------------------------------------------------

/**
 * Incrémente le compteur associé à `key` et indique si la requête passe.
 * En cas d'indisponibilité de Redis, bascule silencieusement en mémoire.
 */
export async function rateLimit(
  key: string,
  opts: RateLimitOptions,
): Promise<RateLimitResult> {
  // Échappatoire pour les suites E2E (à ne JAMAIS activer en production).
  if (process.env.RATE_LIMIT_DISABLED === 'true') {
    return { ok: true, remaining: opts.limit, retryAfterSec: 0 };
  }

  const redisKey = `rl:${key}`;
  try {
    const count = await redis.incr(redisKey);
    if (count === 1) {
      await redis.expire(redisKey, opts.windowSec);
    }
    const ttl = await redis.ttl(redisKey);
    const retryAfterSec = ttl > 0 ? ttl : opts.windowSec;
    return {
      ok: count <= opts.limit,
      remaining: Math.max(0, opts.limit - count),
      retryAfterSec,
    };
  } catch {
    return memoryHit(redisKey, opts);
  }
}

/** Remet le compteur à zéro (appelé après une authentification réussie). */
export async function resetRateLimit(key: string): Promise<void> {
  const redisKey = `rl:${key}`;
  memoryStore.delete(redisKey);
  try {
    await redis.del(redisKey);
  } catch {
    /* Redis indisponible : le fallback mémoire a déjà été purgé */
  }
}

/** Extrait l'IP client en tenant compte du reverse proxy (Traefik/Coolify). */
export function clientIp(req: NextRequest): string {
  const forwarded = req.headers.get('x-forwarded-for');
  if (forwarded) {
    const first = forwarded.split(',')[0]?.trim();
    if (first) return first;
  }
  return req.headers.get('x-real-ip')?.trim() || 'unknown';
}

/** Réponse 429 normalisée. */
export function tooManyRequests(result: RateLimitResult): NextResponse {
  return NextResponse.json(
    {
      error: `Trop de tentatives. Réessaie dans ${result.retryAfterSec} seconde(s).`,
      code: 'rate_limited',
    },
    { status: 429, headers: { 'Retry-After': String(result.retryAfterSec) } },
  );
}

/**
 * Applique plusieurs limites (ex : par IP + par identifiant) et retourne une
 * réponse 429 dès que l'une d'elles est dépassée, sinon `null`.
 */
export async function enforceRateLimits(
  entries: Array<{ key: string } & RateLimitOptions>,
): Promise<NextResponse | null> {
  for (const entry of entries) {
    const result = await rateLimit(entry.key, {
      limit: entry.limit,
      windowSec: entry.windowSec,
    });
    if (!result.ok) return tooManyRequests(result);
  }
  return null;
}
