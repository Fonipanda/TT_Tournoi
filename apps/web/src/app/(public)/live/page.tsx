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

  const refresh = useCallback(async () => {
    try {
      const r = await fetch('/api/rooms', { cache: 'no-store' });
      const j = await r.json();
      setRooms(
        (j.data ?? []).map((room: any) => ({
          id: room.id,
          name: room.name,
          width: room.width,
          height: room.height,
          entranceMarkers: room.entranceMarkers,
          buvetteMarkers: room.buvetteMarkers,
          wcMarkers: room.wcMarkers,
          arrowMarkers: room.arrowMarkers,
          tables: (room.tables ?? []).map((t: any) => ({
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

      <div className="space-y-6">
        {rooms.map((r) => (
          <RoomCanvas
            key={r.id}
            room={r}
            tables={r.tables}
            editable={false}
          />
        ))}
      </div>
    </div>
  );
}
