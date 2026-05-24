/**
 * Rendu des templates SMS avec variables nommées.
 *
 * Variables : {joueur}, {table}, {tableau}, {adversaire}, {heure}, {salle}, {message}
 * (cf. SMS_TEMPLATE_VARIABLES dans @tt/types)
 */

import { SMS_TEMPLATE_VARIABLES, type SmsTemplateContext } from '@tt/types';

export { SMS_TEMPLATE_VARIABLES };

/**
 * Remplace les variables {var} dans le template par les valeurs du contexte.
 * Variables non fournies remplacées par chaîne vide.
 */
export function renderTemplate(content: string, context: SmsTemplateContext = {}): string {
  return content.replace(/\{(\w+)\}/g, (_, key: string) => {
    const value = context[key as keyof SmsTemplateContext];
    if (value === undefined || value === null) return '';
    return String(value);
  });
}

/**
 * Calcule le nombre de segments SMS (utile pour l'UI compteur).
 * - GSM-7 : 160 chars / segment, 153 chars en multi-segment
 * - UCS-2 (avec emoji/accents non-GSM) : 70 / 67
 */
export function countSegments(message: string): { segments: number; chars: number; encoding: 'GSM-7' | 'UCS-2' } {
  // Détection GSM-7 simplifiée : tous les chars dans le set GSM
  // eslint-disable-next-line no-control-regex
  const gsm7Regex = /^[\u0000-\u007F€£¥èéùìòÇØøÅåÆæßÉ§¿¡ÄÖÑÜäöñüà ]*$/;
  const isGsm7 = gsm7Regex.test(message);
  const chars = message.length;

  if (isGsm7) {
    if (chars <= 160) return { segments: 1, chars, encoding: 'GSM-7' };
    return { segments: Math.ceil(chars / 153), chars, encoding: 'GSM-7' };
  }
  if (chars <= 70) return { segments: 1, chars, encoding: 'UCS-2' };
  return { segments: Math.ceil(chars / 67), chars, encoding: 'UCS-2' };
}
