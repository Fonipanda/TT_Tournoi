/**
 * Types pour les événements WebSocket diffusés par le service ws.
 *
 * Le bus Redis Pub/Sub publie sur le canal `live:<event-type>` ; le service
 * Fastify les rebroadcaste à tous les clients connectés.
 */

export type Role = 'visitor' | 'player' | 'admin' | 'juge_arbitre';

// -----------------------------------------------------------------------------
// DTO légers (juste ce qui est nécessaire au client live)
// -----------------------------------------------------------------------------

export interface MatchLiveDTO {
  id: string;
  bracketId: string;
  bracketName?: string;
  player1?: { id: string; firstName: string; lastName: string; club?: string | null } | null;
  player2?: { id: string; firstName: string; lastName: string; club?: string | null } | null;
  tableId?: string | null;
  tableNumber?: number | null;
  status: 'waiting' | 'in_progress' | 'finished' | 'blocked';
  scoreP1: number;
  scoreP2: number;
  setsP1: number;
  setsP2: number;
  startTime?: string | null;
  endTime?: string | null;
  version: number;
}

export interface TableLiveDTO {
  id: string;
  number: number;
  roomId: string;
  x: number;
  y: number;
  rotation: number;
  status: 'free' | 'occupied' | 'maintenance';
  currentMatchId?: string | null;
}

// -----------------------------------------------------------------------------
// Union des événements
// -----------------------------------------------------------------------------

export type LiveEvent =
  | { type: 'hello'; role: Role; serverTime: string }
  | { type: 'match_created'; match: MatchLiveDTO }
  | { type: 'match_started'; match: MatchLiveDTO }
  | {
      type: 'match_completed';
      match: MatchLiveDTO;
      winner?: { id: string; firstName: string; lastName: string } | null;
    }
  | { type: 'match_score_updated'; match: MatchLiveDTO }
  | { type: 'match_blocked'; matchId: string; reason?: string }
  | { type: 'match_unblocked'; matchId: string }
  | { type: 'table_updated'; table: TableLiveDTO }
  | { type: 'tables_repositioned'; tables: TableLiveDTO[] }
  | { type: 'elimination_generated'; bracketId: string }
  | { type: 'pools_generated'; bracketId: string };

export type LiveEventType = LiveEvent['type'];

// Canal Redis : `live:<type>` ; le subscriber WS écoute `live:*` (PSUBSCRIBE).
export const LIVE_CHANNEL_PREFIX = 'live:';
export const LIVE_CHANNEL_PATTERN = 'live:*';
