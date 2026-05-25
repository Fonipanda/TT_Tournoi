/**
 * Client FFTT — lookup licence avec cache Redis (TTL 24h par défaut).
 *
 * API publique non officielle utilisée : http://fftt.dafunker.com/v1/joueur/{licence}
 * (port direct du dépôt B `backend/server.py:359-383`)
 */

import type { FfttPlayerLookup } from '@tt/types';
import { redis } from '../redis';

const CACHE_PREFIX = 'fftt:player:';
const CACHE_TTL = Number(process.env.FFTT_CACHE_TTL ?? 86400);

export class FfttError extends Error {
  constructor(
    message: string,
    public readonly status: number = 502,
  ) {
    super(message);
  }
}

export async function lookupFfttPlayer(licence: string): Promise<FfttPlayerLookup> {
  const cleaned = licence.trim();
  if (!/^\d{6,10}$/.test(cleaned) || cleaned === '0'.repeat(cleaned.length)) {
    throw new FfttError('Numéro de licence invalide', 400);
  }

  // Cache hit ?
  const cached = await redis.get(CACHE_PREFIX + cleaned).catch(() => null);
  if (cached) {
    try {
      return JSON.parse(cached) as FfttPlayerLookup;
    } catch {
      // cache corrompu, on continue
    }
  }

  const base = process.env.FFTT_API_BASE || 'http://fftt.dafunker.com/v1';
  const url = `${base}/joueur/${cleaned}`;

  let res: Response;
  try {
    res = await fetch(url, { signal: AbortSignal.timeout(8000) });
  } catch (e) {
    throw new FfttError(
      `Service FFTT indisponible: ${e instanceof Error ? e.message : 'erreur réseau'}`,
      502,
    );
  }
  if (res.status === 404 || !res.ok) {
    throw new FfttError('Licence FFTT introuvable', 404);
  }
  const data = (await res.json().catch(() => null)) as Record<string, unknown> | null;
  if (!data || !data.nom || !data.prenom) {
    throw new FfttError('Licence FFTT introuvable', 404);
  }

  const result: FfttPlayerLookup = {
    licence: String(data.licence ?? cleaned),
    nom: String(data.nom),
    prenom: String(data.prenom),
    points: Number(data.point ?? data.initm ?? 500),
    club: data.club ? String(data.club) : null,
  };

  // Cache pour 24h
  redis.set(CACHE_PREFIX + cleaned, JSON.stringify(result), 'EX', CACHE_TTL).catch(() => undefined);

  return result;
}
