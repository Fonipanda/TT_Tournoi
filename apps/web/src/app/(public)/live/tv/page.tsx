'use client';

import { useCallback, useEffect, useState } from 'react';
import { useLiveWebSocket } from '@/lib/live/useLiveWebSocket';
import { RoomCanvas, type RoomCanvasRoom, type RoomCanvasTable } from '@/components/RoomCanvas';
import type { LiveEvent } from '@tt/types';

interface RoomData extends RoomCanvasRoom {
  tables: RoomCanvasTable[];
}

const DEFAULT_INTERVAL_MS = 5000;
const SETTINGS_KEY = 'tt_tv_interval_ms';

export default function LiveTvPage() {
  const [rooms, setRooms] = useState<RoomData[]>([]);
  const [currentRoomIndex, setCurrentRoomIndex] = useState(0);
  const [clock, setClock] = useState('');
  const [intervalMs, setIntervalMs] = useState<number>(DEFAULT_INTERVAL_MS);

  // Client-side only initialization
  useEffect(() => {
    const saved = localStorage.getItem(SETTINGS_KEY);
    if (saved) setIntervalMs(parseInt(saved, 10) || DEFAULT_INTERVAL_MS);
  }, []);

  // Clock update
  useEffect(() => {
    const update = () => setClock(new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }));
    update();
    const id = setInterval(update, 10000);
    return () => clearInterval(id);
  }, []);

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
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    document.body.dataset.mode = 'tv';
    document.documentElement.style.cursor = 'none';
    refresh();
    const id = setInterval(refresh, 15_000);
    return () => {
      clearInterval(id);
      delete document.body.dataset.mode;
      document.documentElement.style.cursor = '';
    };
  }, [refresh]);

  // Auto-rotation between rooms
  useEffect(() => {
    if (rooms.length <= 1) return;
    const id = setInterval(() => {
      setCurrentRoomIndex((i) => (i + 1) % rooms.length);
    }, intervalMs);
    return () => clearInterval(id);
  }, [rooms.length, intervalMs]);

  // Listen to live events
  useLiveWebSocket(
    useCallback(
      (event: LiveEvent) => {
        if (
          event.type === 'match_score_updated' ||
          event.type === 'match_completed' ||
          event.type === 'match_started' ||
          event.type === 'table_updated'
        ) {
          refresh();
        }
      },
      [refresh],
    ),
  );

  // Fullscreen via user gesture (button)
  const goFullscreen = useCallback(() => {
    try { document.documentElement.requestFullscreen?.(); } catch { /* ignore */ }
  }, []);

  const currentRoom = rooms[currentRoomIndex];

  return (
    <div
      className="min-h-screen w-full bg-tv-bg text-tv-fg p-4 flex flex-col"
      data-testid="live-tv"
    >
      {/* Header */}
      <header className="flex items-center justify-between mb-4 border-b border-white/10 pb-2">
        <h1 className="font-heading text-3xl uppercase tracking-widest text-tv-accent">
          {currentRoom?.name ?? 'Live'}
        </h1>
        <div className="flex items-center gap-4">
          {rooms.length > 1 && (
            <span className="text-sm text-white/50">
              Salle {currentRoomIndex + 1}/{rooms.length}
            </span>
          )}
          <button
            type="button"
            onClick={goFullscreen}
            className="text-xs text-white/60 hover:text-white border border-white/20 rounded px-2 py-1"
          >
            Plein écran
          </button>
          <p className="font-mono text-xl tabular">
            {clock}
          </p>
        </div>
      </header>

      {/* Room canvas fullscreen */}
      <div className="flex-1 flex items-center justify-center">
        {rooms.length === 0 ? (
          <div className="text-center text-3xl text-white/40">
            Aucune salle configurée
          </div>
        ) : currentRoom ? (
          <div className="w-full h-full max-h-[85vh]">
            <RoomCanvas
              room={currentRoom}
              tables={currentRoom.tables}
              editable={false}
            />
          </div>
        ) : null}
      </div>
    </div>
  );
}
