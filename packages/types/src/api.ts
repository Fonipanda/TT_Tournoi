/**
 * Types DTO pour les Route Handlers REST.
 *
 * Les types Prisma sont disponibles via `@tt/db` ; on définit ici les DTOs
 * publics, c'est-à-dire sans champs internes (passwordHash, etc.) et avec
 * éventuellement quelques relations préchargées.
 */

import type { LiveEventType } from './live-events.js';

// -----------------------------------------------------------------------------
// Réponses standard
// -----------------------------------------------------------------------------

export interface ApiError {
  error: string;
  code?: string;
  details?: unknown;
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  pageSize: number;
}

// -----------------------------------------------------------------------------
// Match — finish/score input avec optimistic concurrency
// -----------------------------------------------------------------------------

export interface MatchScoreInput {
  scoreP1: number;
  scoreP2: number;
  setsP1: number;
  setsP2: number;
  sets?: { p1: number; p2: number }[];
  /** Version connue par le client (concurrence optimiste) */
  version: number;
  /** Idempotency key pour la PWA offline */
  optimisticId?: string;
}

export interface MatchFinishInput extends MatchScoreInput {
  winnerId: string;
  isForfeit?: boolean;
  forfeitPlayerId?: string;
}

export interface MatchConflictResponse {
  error: 'version_conflict';
  currentVersion: number;
  serverState: unknown;
}

// -----------------------------------------------------------------------------
// Tables — bulk reposition (drag & drop)
// -----------------------------------------------------------------------------

export interface TableBulkPositionUpdate {
  id: string;
  x: number;
  y: number;
  rotation?: number;
}

export interface TableBulkPositionInput {
  tables: TableBulkPositionUpdate[];
}

// -----------------------------------------------------------------------------
// FFTT
// -----------------------------------------------------------------------------

export interface FfttPlayerLookup {
  licence: string;
  nom: string;
  prenom: string;
  points: number;
  club?: string | null;
}

// -----------------------------------------------------------------------------
// Live snapshot (fallback polling)
// -----------------------------------------------------------------------------

export interface LiveSnapshotResponse {
  serverTime: string;
  events: LiveEventType[];
}

// -----------------------------------------------------------------------------
// Health
// -----------------------------------------------------------------------------

export interface HealthCheckResponse {
  ok: boolean;
  uptime: number;
  services: {
    db: 'up' | 'down';
    redis: 'up' | 'down';
  };
  version: string;
}
