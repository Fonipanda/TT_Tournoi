/**
 * RBAC — Role-Based Access Control.
 *
 * Hiérarchie implicite :
 *   admin ⊃ juge_arbitre ⊃ player ⊃ visitor
 * mais pour un contrôle fin on utilise des listes explicites de rôles
 * autorisés par ressource.
 */

import type { Role } from '@tt/types';

export const ALL_ROLES: Role[] = ['visitor', 'player', 'admin', 'juge_arbitre'];

/**
 * Vérifie si un rôle donné a accès à une liste de rôles autorisés.
 * Le rôle `admin` est implicitement autorisé partout (super-utilisateur).
 */
export function hasRole(role: Role | undefined | null, allowed: readonly Role[]): boolean {
  if (!role) return allowed.includes('visitor');
  if (role === 'admin') return true; // admin = super-user
  return allowed.includes(role);
}

/**
 * Garde stricte (sans bypass admin) — utile pour des vérifications type
 * "seuls les juges-arbitres peuvent faire X, pas les admins".
 */
export function hasExactRole(role: Role | undefined | null, allowed: readonly Role[]): boolean {
  if (!role) return false;
  return allowed.includes(role);
}

/**
 * Lance une erreur si l'utilisateur n'a pas un rôle autorisé.
 */
export class ForbiddenError extends Error {
  constructor(message = 'Accès refusé') {
    super(message);
    this.name = 'ForbiddenError';
  }
}

export class UnauthorizedError extends Error {
  constructor(message = 'Authentification requise') {
    super(message);
    this.name = 'UnauthorizedError';
  }
}

export function assertRole(
  role: Role | undefined | null,
  allowed: readonly Role[],
): asserts role is Role {
  if (!role) throw new UnauthorizedError();
  if (!hasRole(role, allowed)) throw new ForbiddenError();
}

// -----------------------------------------------------------------------------
// Politique d'accès aux routes (utile pour le middleware Next.js)
// -----------------------------------------------------------------------------

export const ROUTE_POLICIES: Record<string, readonly Role[]> = {
  // Routes publiques
  '/': ['visitor', 'player', 'juge_arbitre', 'admin'],
  '/live': ['visitor', 'player', 'juge_arbitre', 'admin'],
  '/progression': ['visitor', 'player', 'juge_arbitre', 'admin'],
  '/buvette': ['visitor', 'player', 'juge_arbitre', 'admin'],
  '/reglement': ['visitor', 'player', 'juge_arbitre', 'admin'],

  // Joueur (mais inscription est publique pour permettre le pré-login licence)
  '/inscription': ['visitor', 'player', 'juge_arbitre', 'admin'],
  '/mon-espace': ['player'],
  '/notifications': ['player'],

  // Staff
  '/admin': ['admin'],
  '/juge-arbitre': ['juge_arbitre'],

  // Mode TV : écran de hall, lancé uniquement depuis /admin/parametres.
  '/tv': ['admin'],
};

/**
 * Trouve la politique applicable à un chemin donné.
 * Retourne `null` si aucune politique ne matche (route considérée comme publique).
 */
export function findRoutePolicy(pathname: string): readonly Role[] | null {
  // Match exact d'abord
  if (ROUTE_POLICIES[pathname]) return ROUTE_POLICIES[pathname]!;

  // Match par préfixe (ex: /admin/joueurs hérite de /admin)
  const sortedKeys = Object.keys(ROUTE_POLICIES).sort((a, b) => b.length - a.length);
  for (const key of sortedKeys) {
    if (pathname.startsWith(key + '/')) {
      return ROUTE_POLICIES[key] ?? null;
    }
  }
  return null;
}
