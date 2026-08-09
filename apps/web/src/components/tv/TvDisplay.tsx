'use client';

/**
 * TvDisplay — affichage plein écran des salles pour un écran de hall.
 *
 * Les salles sont rendues avec `RoomCanvas` en lecture seule : c'est
 * exactement le composant utilisé par l'éditeur visuel de `/admin/salles`,
 * donc le plan affiché est strictement identique à celui édité (dimensions,
 * tables, rotations, marqueurs entrée / buvette / WC / flèches).
 *
 * Rotation automatique entre les salles, plein écran natif, rafraîchissement
 * live (WebSocket) et de sécurité (30 s).
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { RoomCanvas, type RoomCanvasRoom, type RoomCanvasTable } from '@/components/RoomCanvas';
import { useLiveWebSocket } from '@/lib/live/useLiveWebSocket';
import type { LiveEvent } from '@tt/types';

interface RoomData extends RoomCanvasRoom {
  tables: RoomCanvasTable[];
}

interface Props {
  /** Durée d'affichage de chaque salle, réglée dans /admin/parametres. */
  intervalMs: number;
}

/** Filet de sécurité si le WebSocket est indisponible. */
const FALLBACK_REFRESH_MS = 30_000;

export function TvDisplay({ intervalMs }: Props) {
  const [rooms, setRooms] = useState<RoomData[]>([]);
  const [loading, setLoading] = useState(true);
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [now, setNow] = useState<string>('');
  const rootRef = useRef<HTMLDivElement | null>(null);

  // Chrome sombre : réutilise le style TV déjà défini dans globals.css.
  useEffect(() => {
    document.body.dataset.mode = 'tv';
    return () => {
      delete document.body.dataset.mode;
    };
  }, []);

  const refresh = useCallback(async () => {
    try {
      const r = await fetch(`/api/rooms?_t=${Date.now()}`, { cache: 'no-store' });
      const j = await r.json();
      const fetched = (j.data ?? []) as Array<
        RoomCanvasRoom & { tables?: RoomCanvasTable[] }
      >;
      setRooms(
        fetched
          .filter((room) => (room.tables ?? []).length > 0)
          .map((room) => ({
            id: room.id,
            name: room.name,
            width: room.width,
            height: room.height,
            entranceMarkers: room.entranceMarkers,
            buvetteMarkers: room.buvetteMarkers,
            wcMarkers: room.wcMarkers,
            arrowMarkers: room.arrowMarkers,
            tables: room.tables ?? [],
          })),
      );
    } catch {
      /* on garde l'affichage précédent : un écran figé vaut mieux qu'un écran vide */
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
    const id = setInterval(() => void refresh(), FALLBACK_REFRESH_MS);
    return () => clearInterval(id);
  }, [refresh]);

  useLiveWebSocket(
    useCallback(
      (event: LiveEvent) => {
        if (
          event.type === 'match_started' ||
          event.type === 'match_completed' ||
          event.type === 'match_score_updated' ||
          event.type === 'table_updated' ||
          event.type === 'tables_repositioned'
        ) {
          void refresh();
        }
      },
      [refresh],
    ),
  );

  // Horloge (affichée dans le bandeau haut).
  useEffect(() => {
    const tick = () =>
      setNow(new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }));
    tick();
    const id = setInterval(tick, 15_000);
    return () => clearInterval(id);
  }, []);

  // Rotation automatique — inutile s'il n'y a qu'une salle.
  useEffect(() => {
    if (paused || rooms.length < 2) return;
    const id = setInterval(() => setIndex((i) => (i + 1) % rooms.length), intervalMs);
    return () => clearInterval(id);
  }, [paused, rooms.length, intervalMs]);

  // L'index doit rester valide si une salle disparaît.
  useEffect(() => {
    if (rooms.length > 0 && index >= rooms.length) setIndex(0);
  }, [rooms.length, index]);

  const toggleFullscreen = useCallback(() => {
    const el = rootRef.current;
    if (!el) return;
    if (document.fullscreenElement) {
      void document.exitFullscreen().catch(() => undefined);
    } else {
      void el.requestFullscreen().catch(() => undefined);
    }
  }, []);

  useEffect(() => {
    const onChange = () => setIsFullscreen(Boolean(document.fullscreenElement));
    document.addEventListener('fullscreenchange', onChange);
    return () => document.removeEventListener('fullscreenchange', onChange);
  }, []);

  // En plein écran, le pointeur n'a plus d'utilité sur un écran de hall.
  useEffect(() => {
    document.documentElement.style.cursor = isFullscreen ? 'none' : '';
    return () => {
      document.documentElement.style.cursor = '';
    };
  }, [isFullscreen]);

  // Raccourcis clavier : pratique avec une télécommande ou un clavier sans fil.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight') setIndex((i) => (rooms.length ? (i + 1) % rooms.length : 0));
      else if (e.key === 'ArrowLeft')
        setIndex((i) => (rooms.length ? (i - 1 + rooms.length) % rooms.length : 0));
      else if (e.key === ' ') {
        e.preventDefault();
        setPaused((p) => !p);
      } else if (e.key.toLowerCase() === 'f') toggleFullscreen();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [rooms.length, toggleFullscreen]);

  const room = rooms[index];

  return (
    <div
      ref={rootRef}
      data-testid="tv-display"
      className="min-h-screen w-full bg-tv-bg text-tv-fg flex flex-col"
    >
      {/* Bandeau haut */}
      <header className="flex items-center justify-between gap-4 px-6 py-3 border-b border-white/10">
        <h1 className="font-heading text-2xl md:text-4xl uppercase tracking-wide truncate">
          {room?.name ?? 'Mode TV'}
        </h1>
        <div className="flex items-center gap-4 shrink-0">
          {rooms.length > 1 && (
            <span className="text-tv-accent font-mono text-lg md:text-2xl tabular">
              {index + 1}/{rooms.length}
            </span>
          )}
          <span className="font-mono text-lg md:text-2xl tabular opacity-80">{now}</span>
        </div>
      </header>

      {/* Plan de salle */}
      <main className="flex-1 flex items-center justify-center p-4 md:p-6 overflow-hidden">
        {loading && <p className="opacity-70 text-xl">Chargement…</p>}

        {!loading && rooms.length === 0 && (
          <p className="opacity-70 text-xl text-center" data-testid="tv-empty">
            Aucune salle avec des tables.
            <br />
            <span className="text-base">
              Configure une salle dans Admin → Salles pour alimenter le mode TV.
            </span>
          </p>
        )}

        {!loading && room && (
          <div
            key={room.id}
            className="w-full h-full flex items-center justify-center"
            data-testid="tv-room"
          >
            <div
              className="w-full"
              style={{
                // Conserve l'aspect-ratio de la salle sans jamais déborder :
                // la largeur est plafonnée par la hauteur réellement disponible.
                maxWidth: `min(100%, calc((100vh - 9rem) * ${room.width / room.height}))`,
              }}
            >
              <RoomCanvas room={room} tables={room.tables} editable={false} />
            </div>
          </div>
        )}
      </main>

      {/* Bandeau bas : indicateurs + commandes (masquées en plein écran) */}
      <footer className="flex items-center justify-between gap-4 px-6 py-3 border-t border-white/10">
        <div className="flex items-center gap-2">
          {rooms.map((r, i) => (
            <button
              key={r.id}
              type="button"
              onClick={() => setIndex(i)}
              aria-label={`Afficher ${r.name}`}
              className={`h-2 rounded-full transition-all ${
                i === index ? 'w-8 bg-tv-accent' : 'w-2 bg-white/30 hover:bg-white/60'
              }`}
            />
          ))}
        </div>

        <div className="flex items-center gap-3 text-sm">
          {paused && <span className="text-tv-accent uppercase tracking-wide">En pause</span>}
          <button
            type="button"
            onClick={() => setPaused((p) => !p)}
            className="px-3 py-1.5 rounded border border-white/20 hover:bg-white/10"
            data-testid="tv-pause"
          >
            {paused ? 'Reprendre' : 'Pause'}
          </button>
          <button
            type="button"
            onClick={toggleFullscreen}
            className="px-3 py-1.5 rounded border border-white/20 hover:bg-white/10"
            data-testid="tv-fullscreen"
          >
            {isFullscreen ? 'Quitter le plein écran' : 'Plein écran'}
          </button>
          <span className="hidden lg:inline opacity-50">
            ← → salle · Espace pause · F plein écran
          </span>
        </div>
      </footer>
    </div>
  );
}
