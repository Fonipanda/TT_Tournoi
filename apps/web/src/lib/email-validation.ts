/**
 * Validation d'adresse email — orchestration complète (serveur uniquement).
 *
 *  1. Format      : expression régulière (structure RFC 5322 simplifiée).
 *  2. Jetable     : blocage des fournisseurs d'emails temporaires connus.
 *  3. Délivrabilité : résolution DNS des enregistrements MX du domaine.
 *
 * Les niveaux 1 et 2 vivent dans `email-validation.shared.ts` afin d'être
 * rejouables côté client (retour immédiat dans le formulaire). Ce module y
 * ajoute le niveau 3, qui exige le réseau, et réexporte l'ensemble pour que
 * les appelants serveur n'aient qu'un seul import.
 *
 * La confirmation réelle de la boîte se fait par lien cliquable
 * (cf. `lib/auth/email-verification.ts`) — on n'utilise volontairement PAS la
 * commande SMTP VRFY, désactivée par la quasi-totalité des serveurs et
 * assimilée à du spam.
 *
 * Node.js only (dns/promises) — ne pas importer dans le middleware Edge ni
 * dans un composant client.
 */

import { resolveMx, resolve4, resolve6 } from 'node:dns/promises';
import { redis } from '@/lib/redis';
import {
  EMAIL_MAX_LENGTH,
  EMAIL_OK,
  emailDomain,
  isDisposableEmail,
  isValidEmailFormat,
  type EmailValidationResult,
} from './email-validation.shared';

export {
  DISPOSABLE_DOMAINS,
  EMAIL_MAX_LENGTH,
  EMAIL_REGEX,
  emailDomain,
  isDisposableEmail,
  isValidEmailFormat,
  suggestDomainFix,
  validateEmailOffline,
  type EmailValidationCode,
  type EmailValidationResult,
} from './email-validation.shared';

// -----------------------------------------------------------------------------
// Niveau 3 — enregistrements MX
// -----------------------------------------------------------------------------

const MX_CACHE_TTL_SEC = 24 * 3600;
const memoryMxCache = new Map<string, { value: boolean; expiresAt: number }>();

/**
 * Codes DNS signifiant « le domaine n'a pas cet enregistrement » (réponse
 * légitime du résolveur). Tout autre code est une panne : timeout, refus,
 * échec serveur… et ne doit pas être interprété comme un domaine invalide.
 */
const DNS_NEGATIVE_CODES = new Set(['ENOTFOUND', 'ENODATA', 'NXDOMAIN']);

function isDnsNegativeAnswer(err: unknown): boolean {
  const code = (err as { code?: string } | null)?.code;
  return typeof code === 'string' && DNS_NEGATIVE_CODES.has(code);
}

/**
 * Indique si le domaine peut recevoir du courrier.
 *
 * Un MX est le cas normal. À défaut, la RFC 5321 §5.1 autorise la remise sur
 * l'enregistrement A/AAAA du domaine : on teste donc ce repli avant de
 * conclure à un domaine invalide.
 *
 * En cas de panne DNS (timeout, SERVFAIL…), on renvoie `true` (fail-open) et
 * on ne met rien en cache : mieux vaut accepter une inscription douteuse que
 * bloquer tout le monde — le lien de confirmation reste, lui, obligatoire.
 */
export async function hasMxRecord(domain: string): Promise<boolean> {
  if (!domain) return false;

  const cacheKey = `mx:${domain}`;
  const now = Date.now();

  const cached = memoryMxCache.get(cacheKey);
  if (cached && cached.expiresAt > now) return cached.value;

  try {
    const fromRedis = await redis.get(cacheKey);
    if (fromRedis !== null) {
      const value = fromRedis === '1';
      memoryMxCache.set(cacheKey, { value, expiresAt: now + 60_000 });
      return value;
    }
  } catch {
    /* Redis indisponible : on interroge le DNS directement */
  }

  let value: boolean;
  try {
    const records = await resolveMx(domain);
    value = records.length > 0 && records.some((r) => r.exchange);
  } catch (mxErr) {
    if (!isDnsNegativeAnswer(mxErr)) return true; // panne DNS → fail-open, sans cache

    // Pas de MX publié → repli sur A/AAAA (RFC 5321 §5.1).
    try {
      const a = await resolve4(domain).catch((e) => {
        if (!isDnsNegativeAnswer(e)) throw e;
        return [] as string[];
      });
      if (a.length > 0) {
        value = true;
      } else {
        const aaaa = await resolve6(domain).catch((e) => {
          if (!isDnsNegativeAnswer(e)) throw e;
          return [] as string[];
        });
        value = aaaa.length > 0;
      }
    } catch {
      return true; // panne pendant le repli → fail-open, sans cache
    }
  }

  memoryMxCache.set(cacheKey, { value, expiresAt: now + MX_CACHE_TTL_SEC * 1000 });
  try {
    await redis.set(cacheKey, value ? '1' : '0', 'EX', MX_CACHE_TTL_SEC);
  } catch {
    /* cache best-effort */
  }

  return value;
}

// -----------------------------------------------------------------------------
// Validation complète
// -----------------------------------------------------------------------------

/**
 * Enchaîne les trois contrôles. À utiliser côté serveur avant de créer un
 * compte ou d'envoyer un email.
 */
export async function validateEmail(email: string): Promise<EmailValidationResult> {
  const value = (email ?? '').trim();

  if (value.length > EMAIL_MAX_LENGTH) {
    return { ok: false, code: 'too_long', message: 'Adresse email trop longue.' };
  }
  if (!isValidEmailFormat(value)) {
    return {
      ok: false,
      code: 'invalid_format',
      message: "Le format de l'adresse email est invalide.",
    };
  }
  if (isDisposableEmail(value)) {
    return {
      ok: false,
      code: 'disposable',
      message:
        "Les adresses email temporaires ne sont pas acceptées. Utilise une adresse personnelle.",
    };
  }
  if (!(await hasMxRecord(emailDomain(value)))) {
    return {
      ok: false,
      code: 'no_mx',
      message:
        "Le domaine de cette adresse email ne peut pas recevoir de courrier. Vérifie l'orthographe.",
    };
  }

  return EMAIL_OK;
}
