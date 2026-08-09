/**
 * Normalisation des numéros de téléphone au format E.164.
 *
 * L'API OVH SMS n'accepte que des numéros internationaux (`+33612345678`).
 * Les numéros saisis par les joueurs ou importés depuis SPID arrivent en
 * format national avec des séparateurs variés (« 06 12 34 56 78 »,
 * « 06.12.34.56.78 », « 0033 6 12 34 56 78 »…). Sans cette conversion,
 * l'envoi est refusé par OVH sans message exploitable.
 */

/** Indicatif utilisé quand le numéro est saisi au format national. */
const DEFAULT_DIAL_CODES: Record<string, string> = {
  FR: '33',
};

export type PhoneNormalizationResult =
  | { ok: true; e164: string }
  | { ok: false; reason: string };

/**
 * Retire tout ce qui n'est ni un chiffre ni le `+` de tête : espaces (y
 * compris insécables et fines), points, tirets, parenthèses, barres obliques.
 */
function stripSeparators(raw: string): string {
  const trimmed = raw.trim();
  const hasPlus = trimmed.startsWith('+');
  const digits = trimmed.replace(/\D/g, '');
  return hasPlus ? `+${digits}` : digits;
}

/**
 * Convertit un numéro en E.164.
 *
 * Règles appliquées, dans l'ordre :
 * - `+…`      → conservé tel quel après validation de longueur ;
 * - `00…`     → le préfixe international `00` devient `+` ;
 * - `0X…`     → format national : `0` remplacé par l'indicatif du pays ;
 * - autre     → rejeté avec un motif explicite.
 *
 * @param raw            Numéro tel que saisi.
 * @param defaultCountry Pays supposé pour les numéros au format national.
 */
export function normalizePhone(
  raw: string | null | undefined,
  defaultCountry = 'FR',
): PhoneNormalizationResult {
  if (raw == null || raw.trim() === '') {
    return { ok: false, reason: 'numéro vide' };
  }

  const cleaned = stripSeparators(raw);

  if (cleaned === '' || cleaned === '+') {
    return { ok: false, reason: `aucun chiffre exploitable dans « ${raw} »` };
  }

  const dialCode = DEFAULT_DIAL_CODES[defaultCountry.toUpperCase()];
  if (!dialCode) {
    return { ok: false, reason: `pays non supporté : ${defaultCountry}` };
  }

  let candidate: string;

  if (cleaned.startsWith('+')) {
    candidate = cleaned;
  } else if (cleaned.startsWith('00')) {
    candidate = `+${cleaned.slice(2)}`;
  } else if (cleaned.startsWith('0')) {
    candidate = `+${dialCode}${cleaned.slice(1)}`;
  } else {
    return {
      ok: false,
      reason: `format non reconnu (« ${raw} ») : utiliser 0X… ou +indicatif`,
    };
  }

  const digits = candidate.slice(1);

  if (digits.startsWith('0')) {
    return { ok: false, reason: `indicatif pays invalide dans « ${raw} »` };
  }

  // Plage E.164 : 8 chiffres (numéros courts nationaux) à 15 chiffres (maximum absolu).
  if (digits.length < 8 || digits.length > 15) {
    return {
      ok: false,
      reason: `longueur invalide (${digits.length} chiffres) pour « ${raw} »`,
    };
  }

  return { ok: true, e164: candidate };
}

/**
 * Variante tolérante pour les chemins d'écriture : renvoie le numéro
 * normalisé, ou `null` si l'entrée est vide/inexploitable.
 */
export function normalizePhoneOrNull(
  raw: string | null | undefined,
  defaultCountry = 'FR',
): string | null {
  const result = normalizePhone(raw, defaultCountry);
  return result.ok ? result.e164 : null;
}

/** Indique si un numéro est déjà exploitable pour un envoi SMS. */
export function isValidPhone(raw: string | null | undefined, defaultCountry = 'FR'): boolean {
  return normalizePhone(raw, defaultCountry).ok;
}
