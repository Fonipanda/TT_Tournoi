/**
 * Masquage des identifiants sensibles des adaptateurs SMS.
 *
 * Les clés OVH (`appSecret`, `consumerKey`) permettent d'émettre des SMS
 * facturés : elles ne doivent jamais quitter le serveur, ni dans une réponse
 * JSON, ni dans le HTML transmis au navigateur.
 *
 * Le formulaire d'administration affiche donc une sentinelle à la place de la
 * valeur réelle ; si l'administrateur ne modifie pas le champ, la sentinelle
 * revient telle quelle et `mergeAdapterConfig` restaure la valeur enregistrée.
 */

import type { AdapterType } from '@tt/types';
import { getAdapterFields } from './registry';

/** Valeur affichée à la place d'un secret enregistré. */
export const SECRET_PLACEHOLDER = '••••••••';

/** Noms des champs déclarés `secret` pour un type d'adaptateur donné. */
export function secretFieldNames(type: AdapterType): string[] {
  try {
    return getAdapterFields(type)
      .filter((f) => f.secret === true)
      .map((f) => f.name);
  } catch {
    // Type inconnu : on ne masque rien plutôt que de casser l'affichage.
    return [];
  }
}

/**
 * Remplace la valeur de chaque champ secret renseigné par la sentinelle.
 * Un champ vide reste vide, pour que l'UI sache qu'il n'est pas configuré.
 */
export function maskAdapterConfig(
  type: AdapterType,
  config: Record<string, unknown> | null | undefined,
): Record<string, unknown> {
  const source = (config ?? {}) as Record<string, unknown>;
  const masked: Record<string, unknown> = { ...source };

  for (const name of secretFieldNames(type)) {
    const value = masked[name];
    const hasValue = typeof value === 'string' ? value.trim() !== '' : value != null;
    masked[name] = hasValue ? SECRET_PLACEHOLDER : '';
  }

  return masked;
}

/**
 * Fusionne une configuration reçue du client avec celle enregistrée :
 * tout champ secret encore égal à la sentinelle conserve sa valeur en base.
 */
export function mergeAdapterConfig(
  type: AdapterType,
  incoming: Record<string, unknown> | null | undefined,
  existing: Record<string, unknown> | null | undefined,
): Record<string, unknown> {
  const next = { ...((incoming ?? {}) as Record<string, unknown>) };
  const previous = (existing ?? {}) as Record<string, unknown>;

  for (const name of secretFieldNames(type)) {
    if (next[name] === SECRET_PLACEHOLDER) {
      if (previous[name] === undefined) {
        delete next[name];
      } else {
        next[name] = previous[name];
      }
    }
  }

  return next;
}
