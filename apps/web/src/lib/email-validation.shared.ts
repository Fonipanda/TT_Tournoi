/**
 * Validation d'adresse email — partie exécutable côté client ET serveur.
 *
 * Ce module ne dépend NI de `node:dns` NI de Redis : il peut donc être importé
 * par un composant client. Le contrôle de délivrabilité (enregistrements MX),
 * qui exige le réseau, reste dans `email-validation.ts` — côté serveur
 * uniquement.
 *
 * Répartition des contrôles :
 *   - syntaxe et caractères autorisés  → ici (immédiat, sans réseau) ;
 *   - fournisseurs jetables            → ici ;
 *   - faute de frappe sur un domaine connu → ici (suggestion, non bloquant) ;
 *   - existence du domaine (MX/A/AAAA) → serveur, à la soumission.
 */

/**
 * Structure d'adresse. Volontairement stricte mais sans excès :
 * - partie locale : caractères autorisés usuels, pas de point en tête/fin,
 *   pas de double point ;
 * - domaine : labels alphanumériques séparés par des points, TLD de 2+ lettres.
 */
export const EMAIL_REGEX =
  /^[a-zA-Z0-9!#$%&'*+/=?^_`{|}~-]+(?:\.[a-zA-Z0-9!#$%&'*+/=?^_`{|}~-]+)*@(?:[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?\.)+[a-zA-Z]{2,}$/;

export const EMAIL_MAX_LENGTH = 254; // RFC 5321
const LOCAL_PART_MAX_LENGTH = 64;

/**
 * Fournisseurs d'adresses jetables / temporaires les plus répandus.
 * Liste volontairement courte et maintenable : elle couvre l'essentiel du
 * trafic d'inscription frauduleux sans dépendance externe.
 */
export const DISPOSABLE_DOMAINS = new Set([
  '0-mail.com',
  '10minutemail.com',
  '10minutemail.net',
  '20minutemail.com',
  '33mail.com',
  'anonbox.net',
  'armyspy.com',
  'bloq.ro',
  'burnermail.io',
  'cuvox.de',
  'dayrep.com',
  'discard.email',
  'discardmail.com',
  'dispostable.com',
  'dropmail.me',
  'einrot.com',
  'emailondeck.com',
  'fakeinbox.com',
  'fakemail.net',
  'fleckens.hu',
  'getairmail.com',
  'getnada.com',
  'grr.la',
  'guerrillamail.biz',
  'guerrillamail.com',
  'guerrillamail.de',
  'guerrillamail.info',
  'guerrillamail.net',
  'guerrillamail.org',
  'guerrillamailblock.com',
  'harakirimail.com',
  'inboxbear.com',
  'inboxkitten.com',
  'jetable.org',
  'mail-temporaire.fr',
  'mail.tm',
  'mail7.io',
  'mailcatch.com',
  'maildrop.cc',
  'mailasq.com',
  'mailinator.com',
  'mailnesia.com',
  'mailsac.com',
  'mintemail.com',
  'moakt.com',
  'mohmal.com',
  'mytemp.email',
  'nowmymail.com',
  'pokemail.net',
  'rhyta.com',
  'sharklasers.com',
  'spam4.me',
  'spamgourmet.com',
  'superrito.com',
  'temp-mail.io',
  'temp-mail.org',
  'tempail.com',
  'tempinbox.com',
  'tempmail.com',
  'tempmail.net',
  'tempmailo.com',
  'tempr.email',
  'throwawaymail.com',
  'trashmail.com',
  'trashmail.de',
  'trbvm.com',
  'wegwerfmail.de',
  'yopmail.com',
  'yopmail.fr',
  'yopmail.net',
]);

/**
 * Domaines les plus utilisés par les licenciés : fournisseurs indépendants
 * (Gmail, Outlook…) et fournisseurs liés à un FAI français (Orange, Free,
 * SFR, Bouygues…). Sert uniquement à proposer une correction en cas de faute
 * de frappe — la liste n'est jamais utilisée pour refuser une adresse.
 */
export const COMMON_DOMAINS = [
  // Fournisseurs indépendants
  'gmail.com',
  'googlemail.com',
  'outlook.com',
  'outlook.fr',
  'hotmail.com',
  'hotmail.fr',
  'live.fr',
  'live.com',
  'msn.com',
  'yahoo.com',
  'yahoo.fr',
  'icloud.com',
  'me.com',
  'protonmail.com',
  'proton.me',
  'gmx.fr',
  'zoho.com',
  // Fournisseurs liés à un FAI
  'orange.fr',
  'wanadoo.fr',
  'free.fr',
  'sfr.fr',
  'neuf.fr',
  'bbox.fr',
  'bouyguestelecom.fr',
  'laposte.net',
  'numericable.fr',
  'aliceadsl.fr',
  'club-internet.fr',
];

export type EmailValidationCode =
  | 'ok'
  | 'invalid_format'
  | 'too_long'
  | 'disposable'
  | 'no_mx';

export interface EmailValidationResult {
  ok: boolean;
  code: EmailValidationCode;
  /** Message affichable à l'utilisateur (vide si `ok`). */
  message: string;
}

export const EMAIL_OK: EmailValidationResult = { ok: true, code: 'ok', message: '' };

/** Niveau 1 — structure seule, synchrone. */
export function isValidEmailFormat(email: string): boolean {
  const value = (email ?? '').trim();
  if (!value || value.length > EMAIL_MAX_LENGTH) return false;
  const [local] = value.split('@');
  if (!local || local.length > LOCAL_PART_MAX_LENGTH) return false;
  return EMAIL_REGEX.test(value);
}

export function emailDomain(email: string): string {
  return (email.split('@')[1] ?? '').toLowerCase();
}

/** Niveau 2 — fournisseur d'email temporaire. */
export function isDisposableEmail(email: string): boolean {
  const domain = emailDomain(email);
  if (!domain) return false;
  if (DISPOSABLE_DOMAINS.has(domain)) return true;
  // Sous-domaines : mail.guerrillamail.com → guerrillamail.com
  return [...DISPOSABLE_DOMAINS].some((d) => domain.endsWith(`.${d}`));
}

/** Distance de Levenshtein, bornée pour rester bon marché. */
function levenshtein(a: string, b: string): number {
  if (a === b) return 0;
  if (Math.abs(a.length - b.length) > 2) return 99;

  // Int32Array : accès indexé toujours `number`, pas de `undefined` à gérer.
  let previous = new Int32Array(b.length + 1);
  let current = new Int32Array(b.length + 1);
  for (let j = 0; j <= b.length; j++) previous[j] = j;

  for (let i = 1; i <= a.length; i++) {
    current[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const substitution = previous[j - 1]! + (a[i - 1] === b[j - 1] ? 0 : 1);
      current[j] = Math.min(previous[j]! + 1, current[j - 1]! + 1, substitution);
    }
    [previous, current] = [current, previous];
  }

  return previous[b.length]!;
}

/**
 * Propose la correction d'un domaine manifestement mal orthographié
 * (`gmial.com` → `gmail.com`). Renvoie `null` si le domaine est déjà connu ou
 * trop éloigné de tout domaine courant pour qu'une suggestion soit fiable.
 */
export function suggestDomainFix(email: string): string | null {
  const domain = emailDomain(email);
  if (!domain || COMMON_DOMAINS.includes(domain)) return null;

  for (const candidate of COMMON_DOMAINS) {
    if (levenshtein(domain, candidate) <= 2) return candidate;
  }
  return null;
}

/**
 * Contrôles réalisables sans réseau. À utiliser pour un retour immédiat dans
 * le formulaire ; le serveur refera la validation complète (MX compris).
 *
 * @param email Adresse saisie.
 * @returns `ok: true` si aucun défaut détectable côté client.
 */
export function validateEmailOffline(email: string): EmailValidationResult {
  const value = (email ?? '').trim();

  if (!value) return EMAIL_OK; // champ vide : géré par l'attribut `required`

  if (value.length > EMAIL_MAX_LENGTH) {
    return {
      ok: false,
      code: 'too_long',
      message: `Adresse email trop longue (${EMAIL_MAX_LENGTH} caractères maximum).`,
    };
  }

  if (!isValidEmailFormat(value)) {
    return {
      ok: false,
      code: 'invalid_format',
      message: value.includes('@')
        ? "Format invalide : vérifie le domaine après le « @ » (exemple : prenom.nom@gmail.com)."
        : "Format invalide : l'adresse doit contenir un « @ » (exemple : prenom.nom@gmail.com).",
    };
  }

  if (isDisposableEmail(value)) {
    return {
      ok: false,
      code: 'disposable',
      message:
        'Les adresses email temporaires ne sont pas acceptées. Utilise une adresse personnelle.',
    };
  }

  return EMAIL_OK;
}
