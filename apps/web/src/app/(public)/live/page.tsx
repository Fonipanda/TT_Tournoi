'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { LiveStatusBadge } from '@/components/LiveStatusBadge';
import { RoomCanvas, type RoomCanvasRoom, type RoomCanvasTable } from '@/components/RoomCanvas';
import type { LiveEvent } from '@tt/types';

interface RoomData extends RoomCanvasRoom {
  tables: RoomCanvasTable[];
}

export default function LivePage() {
  const [rooms, setRooms] = useState<RoomData[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentRoomIndex, setCurrentRoomIndex] = useState(0);

  const refresh = useCallback(async () => {
    try {
      // cache-busting via querystring + cache: 'no-store' pour bypass SW cache
      const r = await fetch(`/api/rooms?_t=${Date.now()}`, { cache: 'no-store' });
      const j = await r.json();
      const fetched = (j.data ?? []) as Array<{
        id: string;
        name: string;
        width: number;
        height: number;
        entranceMarkers: unknown;
        buvetteMarkers: unknown;
        wcMarkers: unknown;
        arrowMarkers: unknown;
        tables: Array<{
          id: string;
          number: number;
          x: number;
          y: number;
          rotation: number;
          status: 'free' | 'occupied' | 'maintenance';
          currentMatch?: {
            player1?: { lastName: string; firstName: string } | null;
            player2?: { lastName: string; firstName: string } | null;
            setsP1: number;
            setsP2: number;
          } | null;
        }>;
      }>;
      // Filtre : on n'affiche que les salles avec au moins 1 table
      const filtered = fetched.filter((room) => (room.tables ?? []).length > 0);
      setRooms(
        filtered.map((room) => ({
          id: room.id,
          name: room.name,
          width: room.width,
          height: room.height,
          entranceMarkers: room.entranceMarkers,
          buvetteMarkers: room.buvetteMarkers,
          wcMarkers: room.wcMarkers,
          arrowMarkers: room.arrowMarkers,
          tables: (room.tables ?? []).map((t) => ({
            id: t.id,
            number: t.number,
            x: t.x,
            y: t.y,
            rotation: t.rotation,
            status: t.status,
            currentMatch: t.currentMatch
              ? {
                  player1: t.currentMatch.player1,
                  player2: t.currentMatch.player2,
                  setsP1: t.currentMatch.setsP1 ?? 0,
                  setsP2: t.currentMatch.setsP2 ?? 0,
                }
              : null,
          })),
        })),
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
    const id = setInterval(refresh, 30_000);
    return () => clearInterval(id);
  }, [refresh]);

  // Clamp currentRoomIndex when rooms array changes (avoids stale out-of-bounds)
  useEffect(() => {
    if (rooms.length > 0 && currentRoomIndex >= rooms.length) {
      setCurrentRoomIndex(0);
    }
  }, [rooms.length, currentRoomIndex]);

  const onLive = useCallback(
    (event: LiveEvent) => {
      if (
        event.type === 'match_started' ||
        event.type === 'match_completed' ||
        event.type === 'match_score_updated' ||
        event.type === 'table_updated' ||
        event.type === 'tables_repositioned'
      ) {
        refresh();
      }
    },
    [refresh],
  );

  const prevRoom = () => setCurrentRoomIndex((i) => Math.max(0, i - 1));
  const nextRoom = () => setCurrentRoomIndex((i) => Math.min(rooms.length - 1, i + 1));

  const currentRoom = rooms[currentRoomIndex];

  return (
    <div data-testid="live-page">
      <div className="flex items-center justify-between mb-4">
        <h1 className="font-heading text-3xl uppercase tracking-wide">Live</h1>
        <div className="flex items-center gap-4">
          <LiveStatusBadge onEvent={onLive} />
          <Link href="/live/tv" className="btn-secondary text-sm" data-testid="live-tv-link">
            Mode TV
          </Link>
        </div>
      </div>

      {loading && <p className="text-foreground-muted">Chargement…</p>}
      {!loading && rooms.length === 0 && (
        <div className="card text-center py-12 text-foreground-muted">
          Aucune salle configurée pour ce tournoi.
        </div>
      )}

      {!loading && rooms.length > 0 && currentRoom && (
        <div>
          {/* Navigation arrows + room name */}
          <div className="flex items-center justify-center gap-4 mb-4">
            <button
              type="button"
              onClick={prevRoom}
              disabled={currentRoomIndex === 0}
              className="btn-secondary w-10 h-10 flex items-center justify-center rounded-full disabled:opacity-30"
              aria-label="Salle précédente"
            >
              &lt;
            </button>
            <span className="font-heading text-lg uppercase tracking-wide">
              {currentRoom.name}
              <span className="text-foreground-muted text-sm ml-2">
                ({currentRoomIndex + 1}/{rooms.length})
              </span>
              <span className="text-foreground-subtle text-xs ml-2">
                · {currentRoom.tables.length} tables
              </span>
            </span>
            <button
              type="button"
              onClick={nextRoom}
              disabled={currentRoomIndex === rooms.length - 1}
              className="btn-secondary w-10 h-10 flex items-center justify-center rounded-full disabled:opacity-30"
              aria-label="Salle suivante"
            >
              &gt;
            </button>
          </div>

          {/* Wrapper : la salle s'adapte automatiquement à l'espace dispo
              sans déborder en hauteur ni en largeur. Le RoomCanvas conserve
              son aspect-ratio mais respecte un maxHeight basé sur la viewport. */}
          <div
            className="w-full mx-auto flex items-center justify-center"
            style={{ maxHeight: 'calc(100vh - 240px)' }}
          >
            <div
              className="w-full"
              key={currentRoom.id /* force re-mount on room change */}
              style={{
                maxWidth: 'min(100%, calc((100vh - 240px) * ' + (currentRoom.width / currentRoom.height) + '))',
              }}
            >
              <RoomCanvas
                room={currentRoom}
                tables={currentRoom.tables}
                editable={false}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
