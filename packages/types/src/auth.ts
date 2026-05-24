/**
 * Types pour le système d'authentification.
 */

import type { Role } from './live-events.js';

export interface JwtAccessClaims {
  /** UserAccount.id */
  sub: string;
  role: Role;
  /** Identifiant lisible (username, licence, ou email) */
  username?: string;
  /** Player.id si role === 'player' (sinon null) */
  playerId?: string | null;
  iat?: number;
  exp?: number;
}

export interface JwtRefreshClaims {
  sub: string;
  /** ID du RefreshToken en base (pour révocation) */
  jti: string;
  iat?: number;
  exp?: number;
}

export interface AuthenticatedUser {
  userId: string;
  role: Role;
  username?: string;
  playerId?: string | null;
}

export interface LoginInput {
  /** username, email ou licence FFTT */
  identifier: string;
  password?: string;
  /** Pour login licence FFTT (sans password si auto-creation) */
  licence?: string;
  /** Hint optionnel : 'admin' | 'player' */
  mode?: 'admin' | 'player';
}

export interface LoginResponse {
  user: {
    id: string;
    username: string;
    role: Role;
    playerId?: string | null;
    passwordNeedsReset?: boolean;
  };
}

export type { Role };
