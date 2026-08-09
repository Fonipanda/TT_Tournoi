/**
 * Champ Zod partagé pour les numéros de téléphone.
 *
 * Les numéros sont normalisés en E.164 dès l'écriture : c'est le seul format
 * accepté par l'API OVH SMS. Sans cela, un « 06 12 34 56 78 » est stocké tel
 * quel et l'envoi échoue silencieusement au moment du tournoi.
 *
 * Sémantique conservée pour rester compatible avec les mises à jour partielles :
 *   - champ absent      → `undefined` (Prisma ne modifie pas la colonne) ;
 *   - chaîne vide       → `null` (effacement explicite du numéro) ;
 *   - numéro exploitable → chaîne E.164 ;
 *   - numéro invalide   → erreur de validation 400 avec un motif lisible.
 */

import { z } from 'zod';
import { normalizePhone } from '@tt/sms/phone';

export const optionalPhoneField = z
  .string()
  .max(30)
  .optional()
  .transform((value, ctx) => {
    if (value === undefined) return undefined;
    if (value.trim() === '') return null;

    const result = normalizePhone(value);
    if (!result.ok) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `Numéro de téléphone invalide : ${result.reason}`,
      });
      return z.NEVER;
    }
    return result.e164;
  });
