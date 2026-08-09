/**
 * Résolution de la configuration SMS active.
 *
 * Deux sources coexistent, par ordre de priorité :
 *
 *  1. **Base de données** (`SmsAdapterConfig`), alimentée par l'UI admin
 *     `/admin/sms` — c'est la source de référence en exploitation ;
 *  2. **Variables d'environnement** `OVH_SMS_*` (Coolify), qui servent
 *     d'amorçage : elles complètent champ par champ les valeurs absentes en
 *     base, et permettent un fonctionnement immédiat après un premier
 *     déploiement, avant toute saisie dans l'interface.
 *
 * Ce module centralise cette résolution afin que l'engine (envoi synchrone)
 * et le worker BullMQ (envoi en masse) partagent exactement la même logique.
 */

import { prisma, type SmsAdapterConfig } from '@tt/db';
import type { AdapterType, SmsAdapter } from '@tt/types';
import { getAdapter } from './registry';

let cachedActiveConfig: SmsAdapterConfig | null = null;
let cachedActiveAt = 0;
const ACTIVE_CACHE_TTL_MS = 30_000;

/** Trace la source retenue une seule fois, pour le diagnostic dans Coolify. */
let lastLoggedSource: string | null = null;

/**
 * Configuration OVH issue des variables d'environnement.
 * Les clés absentes ou vides ne sont pas retournées.
 */
export function envOvhConfig(): Record<string, string> {
  const raw: Record<string, string | undefined> = {
    appKey: process.env.OVH_SMS_APP_KEY,
    appSecret: process.env.OVH_SMS_APP_SECRET,
    consumerKey: process.env.OVH_SMS_CONSUMER_KEY,
    serviceName: process.env.OVH_SMS_SERVICE_NAME,
  };

  const out: Record<string, string> = {};
  for (const [key, value] of Object.entries(raw)) {
    const trimmed = value?.trim();
    if (trimmed) out[key] = trimmed;
  }
  return out;
}

/** Expéditeur par défaut défini par l'environnement (ex. « ChellesTT »). */
export function envDefaultSender(): string {
  return process.env.OVH_SMS_DEFAULT_SENDER?.trim() ?? '';
}

/** Les 4 identifiants OVH sont-ils tous présents dans l'environnement ? */
function isEnvOvhComplete(env: Record<string, string>): boolean {
  return Boolean(env.appKey && env.appSecret && env.consumerKey && env.serviceName);
}

/**
 * Retourne la config de l'adaptateur SMS actif en base (cache mémoire 30 s).
 * Renvoie null si aucun adaptateur n'est marqué actif.
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

/** Vide les caches (à appeler après toute modification d'adaptateur). */
export function invalidateAdapterCache(): void {
  cachedActiveConfig = null;
  cachedActiveAt = 0;
  lastLoggedSource = null;
}

export interface ResolvedAdapter {
  adapter: SmsAdapter;
  /** Nom lisible, journalisé dans `SmsLog.adapterName`. */
  adapterName: string;
  adapterType: AdapterType;
  defaultSender: string;
  /** Provenance effective des identifiants, pour le diagnostic. */
  source: 'db' | 'env' | 'mixed';
}

/**
 * Fusionne la configuration stockée en base avec les variables
 * d'environnement : chaque champ vide en base est complété par sa variable
 * correspondante. La base reste donc toujours prioritaire.
 */
function mergeWithEnv(
  dbConfig: Record<string, unknown>,
  env: Record<string, string>,
): { config: Record<string, unknown>; usedEnv: boolean } {
  const config: Record<string, unknown> = { ...dbConfig };
  let usedEnv = false;

  for (const [key, envValue] of Object.entries(env)) {
    const current = config[key];
    const isEmpty = current == null || (typeof current === 'string' && current.trim() === '');
    if (isEmpty) {
      config[key] = envValue;
      usedEnv = true;
    }
  }

  return { config, usedEnv };
}

/**
 * Construit l'adaptateur SMS à utiliser pour un envoi.
 *
 * @returns `null` si aucune configuration exploitable n'est disponible, ni en
 *          base ni dans l'environnement.
 */
export async function resolveActiveAdapter(): Promise<ResolvedAdapter | null> {
  const dbConfig = await getActiveAdapterConfig();
  const env = envOvhConfig();

  // Cas 1 : un adaptateur est actif en base.
  if (dbConfig) {
    let config = (dbConfig.config ?? {}) as Record<string, unknown>;
    let source: ResolvedAdapter['source'] = 'db';

    // L'amorçage par variables d'environnement ne concerne que OVH.
    if (dbConfig.adapterType === 'ovh') {
      const merged = mergeWithEnv(config, env);
      config = merged.config;
      if (merged.usedEnv) source = 'mixed';
    }

    const resolved: ResolvedAdapter = {
      adapter: getAdapter(dbConfig.adapterType, config),
      adapterName: dbConfig.name,
      adapterType: dbConfig.adapterType,
      defaultSender: dbConfig.defaultSender || envDefaultSender(),
      source,
    };
    logSource(resolved);
    return resolved;
  }

  // Cas 2 : rien en base, mais l'environnement est complet → config virtuelle.
  if (isEnvOvhComplete(env)) {
    const resolved: ResolvedAdapter = {
      adapter: getAdapter('ovh', env),
      adapterName: 'OVH SMS Pro (env)',
      adapterType: 'ovh',
      defaultSender: envDefaultSender(),
      source: 'env',
    };
    logSource(resolved);
    return resolved;
  }

  return null;
}

function logSource(resolved: ResolvedAdapter): void {
  const key = `${resolved.adapterName}:${resolved.source}`;
  if (lastLoggedSource === key) return;
  lastLoggedSource = key;

  const label =
    resolved.source === 'db'
      ? 'base de données'
      : resolved.source === 'env'
        ? "variables d'environnement"
        : "base de données + variables d'environnement";

  console.info(
    `[sms] Adaptateur actif « ${resolved.adapterName} » (${resolved.adapterType}) — configuration issue de : ${label}.`,
  );
}
