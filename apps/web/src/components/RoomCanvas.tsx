'use client';

/**
 * RoomCanvas — éditeur visuel de salle avec drag & drop natif (Pointer Events).
 *
 * Compatible souris + tactile. Sauvegarde debounced 600ms via PATCH bulk.
 * Émet `tables_repositioned` côté serveur pour propager aux autres clients.
 *
 * Usage :
 *   <RoomCanvas room={room} editable={isAdmin} />
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { useLiveWebSocket } from '@/lib/live/useLiveWebSocket';
import type { LiveEvent } from '@tt/types';

interface MarkerPoint {
  x: number;
  y: number;
  label?: string;
  rotation?: number;
}

export interface RoomCanvasTable {
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
}

export interface RoomCanvasRoom {
  id: string;
  name: string;
  width: number;
  height: number;
  entranceMarkers: unknown;
  buvetteMarkers: unknown;
  wcMarkers: unknown;
  arrowMarkers: unknown;
}

interface Props {
  room: RoomCanvasRoom;
  tables: RoomCanvasTable[];
  editable?: boolean;
}

const TABLE_W = 180;
const TABLE_H = 100;
const SAVE_DEBOUNCE_MS = 600;

function asMarkerArray(raw: unknown): MarkerPoint[] {
  if (!Array.isArray(raw)) return [];
  return raw.filter(
    (m): m is MarkerPoint =>
      typeof m === 'object' && m !== null && typeof (m as MarkerPoint).x === 'number',
  );
}

export function RoomCanvas({ room, tables: initialTables, editable = false }: Props) {
  const [tables, setTables] = useState<RoomCanvasTable[]>(initialTables);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const dirtyRef = useRef(new Map<string, { x: number; y: number; rotation: number }>());
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const dragOffsetRef = useRef<{ x: number; y: number } | null>(null);
  const canvasRef = useRef<HTMLDivElement | null>(null);

  // Réception live : si un autre client repositionne, mettre à jour
  useLiveWebSocket(
    useCallback((event: LiveEvent) => {
      if (event.type === 'tables_repositioned') {
        setTables((prev) => {
          const next = [...prev];
          for (const u of event.tables) {
            const idx = next.findIndex((t) => t.id === u.id);
            if (idx >= 0) {
              next[idx] = { ...next[idx]!, x: u.x, y: u.y, rotation: u.rotation, status: u.status };
            }
          }
          return next;
        });
      } else if (event.type === 'table_updated') {
        setTables((prev) =>
          prev.map((t) =>
            t.id === event.table.id
              ? { ...t, x: event.table.x, y: event.table.y, rotation: event.table.rotation, status: event.table.status }
              : t,
          ),
        );
      }
    }, []),
  );

  const flushSave = useCallback(async () => {
    if (dirtyRef.current.size === 0) return;
    const payload = {
      tables: Array.from(dirtyRef.current.entries()).map(([id, p]) => ({ id, ...p })),
    };
    dirtyRef.current.clear();
    try {
      await fetch('/api/tables/bulk-positions', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
    } catch (e) {
      console.error('[RoomCanvas] save failed:', e);
    }
  }, []);

  const scheduleSave = useCallback(() => {
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(flushSave, SAVE_DEBOUNCE_MS);
  }, [flushSave]);

  useEffect(
    () => () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
      // Flush au démontage
      void flushSave();
    },
    [flushSave],
  );

  const onPointerDown = (e: React.PointerEvent<HTMLDivElement>, table: RoomCanvasTable) => {
    if (!editable) return;
    const target = e.currentTarget;
    target.setPointerCapture(e.pointerId);
    const canvasRect = canvasRef.current?.getBoundingClientRect();
    if (!canvasRect) return;
    const tableRect = target.getBoundingClientRect();
    dragOffsetRef.current = {
      x: e.clientX - tableRect.left,
      y: e.clientY - tableRect.top,
    };
    setDraggingId(table.id);
  };

  const onPointerMove = (e: React.PointerEvent<HTMLDivElement>, tableId: string) => {
    if (draggingId !== tableId || !dragOffsetRef.current) return;
    const canvasRect = canvasRef.current?.getBoundingClientRect();
    if (!canvasRect) return;
    const x = Math.round(e.clientX - canvasRect.left - dragOffsetRef.current.x);
    const y = Math.round(e.clientY - canvasRect.top - dragOffsetRef.current.y);
    const clampedX = Math.max(0, Math.min(room.width - TABLE_W, x));
    const clampedY = Math.max(0, Math.min(room.height - TABLE_H, y));
    setTables((prev) =>
      prev.map((t) => (t.id === tableId ? { ...t, x: clampedX, y: clampedY } : t)),
    );
  };

  const onPointerUp = (_e: React.PointerEvent<HTMLDivElement>, tableId: string) => {
    if (draggingId !== tableId) return;
    setDraggingId(null);
    dragOffsetRef.current = null;
    const t = tables.find((x) => x.id === tableId);
    if (t) {
      dirtyRef.current.set(tableId, { x: t.x, y: t.y, rotation: t.rotation });
      scheduleSave();
    }
  };

  const rotateTable = (id: string) => {
    if (!editable) return;
    setTables((prev) =>
      prev.map((t) =>
        t.id === id ? { ...t, rotation: (t.rotation + 90) % 360 } : t,
      ),
    );
    const t = tables.find((x) => x.id === id);
    if (t) {
      dirtyRef.current.set(id, { x: t.x, y: t.y, rotation: (t.rotation + 90) % 360 });
      scheduleSave();
    }
  };

  const entranceMarkers = asMarkerArray(room.entranceMarkers);
  const buvetteMarkers = asMarkerArray(room.buvetteMarkers);
  const wcMarkers = asMarkerArray(room.wcMarkers);
  const arrowMarkers = asMarkerArray(room.arrowMarkers);

  return (
    <div data-testid={`room-canvas-${room.id}`} className={editable ? 'card' : ''}>
      {editable && (
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-heading text-xl uppercase tracking-wide">{room.name}</h3>
          <span className="text-xs text-foreground-muted font-mono">
            {room.width} × {room.height} px · {tables.length} tables
          </span>
        </div>
      )}

      <div
        ref={canvasRef}
        className="relative bg-bg-alt border border-border-strong overflow-hidden touch-none select-none mx-auto"
        style={{
          width: '100%',
          maxWidth: editable ? room.width : '100%',
          aspectRatio: `${room.width} / ${room.height}`,
        }}
        data-testid="room-canvas-area"
      >
        {/* Marqueurs : entrées (vert) */}
        {entranceMarkers.map((m, i) => (
          <Marker
            key={`ent-${i}`}
            type="entrance"
            x={m.x}
            y={m.y}
            label={m.label ?? 'Entrée'}
            roomW={room.width}
            roomH={room.height}
          />
        ))}
        {buvetteMarkers.map((m, i) => (
          <Marker
            key={`buv-${i}`}
            type="buvette"
            x={m.x}
            y={m.y}
            label={m.label ?? 'Buvette'}
            roomW={room.width}
            roomH={room.height}
          />
        ))}
        {wcMarkers.map((m, i) => (
          <Marker
            key={`wc-${i}`}
            type="wc"
            x={m.x}
            y={m.y}
            label={m.label ?? 'WC'}
            roomW={room.width}
            roomH={room.height}
          />
        ))}
        {arrowMarkers.map((m, i) => (
          <Marker
            key={`arr-${i}`}
            type="arrow"
            x={m.x}
            y={m.y}
            label={m.label ?? '→'}
            rotation={m.rotation ?? 0}
            roomW={room.width}
            roomH={room.height}
          />
        ))}

        {/* Tables */}
        {tables.map((t) => {
          const xPct = (t.x / room.width) * 100;
          const yPct = (t.y / room.height) * 100;
          const wPct = (TABLE_W / room.width) * 100;
          const hPct = (TABLE_H / room.height) * 100;
          const isDragging = draggingId === t.id;
          // Couleurs selon statut
          const bgColor =
            t.status === 'occupied'
              ? '#7f1d1d' // rouge sombre = match en cours
              : t.status === 'maintenance'
                ? '#78350f' // ambre sombre
                : '#1e3a8a'; // bleu profond classique TT
          const borderColor =
            t.status === 'occupied'
              ? '#dc2626'
              : t.status === 'maintenance'
                ? '#d97706'
                : '#3b82f6';
          return (
            <div
              key={t.id}
              data-testid={`canvas-table-${t.number}`}
              onPointerDown={(e) => onPointerDown(e, t)}
              onPointerMove={(e) => onPointerMove(e, t.id)}
              onPointerUp={(e) => onPointerUp(e, t.id)}
              onDoubleClick={() => rotateTable(t.id)}
              className={`absolute ${editable ? 'cursor-move' : 'cursor-default'} ${
                isDragging ? 'shadow-lg z-10 ring-2 ring-primary' : ''
              }`}
              style={{
                left: `${xPct}%`,
                top: `${yPct}%`,
                width: `${wPct}%`,
                height: `${hPct}%`,
                transform: `rotate(${t.rotation}deg)`,
                transformOrigin: 'center',
                touchAction: 'none',
                userSelect: 'none',
              }}
            >
              {/* Plateau de table TT vu du dessus */}
              <div
                className="relative w-full h-full overflow-hidden"
                style={{
                  background: bgColor,
                  border: `2px solid ${borderColor}`,
                  borderRadius: '4px',
                  boxShadow: isDragging
                    ? '0 8px 24px rgba(0,0,0,0.4)'
                    : '0 2px 4px rgba(0,0,0,0.2)',
                }}
              >
                {/* Lignes blanches sur les bords (lignes de la table) */}
                <div className="absolute inset-1 border border-white/80" />

                {/* Ligne centrale horizontale (ligne de service) */}
                <div className="absolute top-1/2 left-1 right-1 h-px bg-white/60 -translate-y-1/2" />

                {/* Filet au milieu VERTICAL (perpendiculaire à la ligne de service) */}
                <div className="absolute left-1/2 top-0 bottom-0 -translate-x-1/2 w-1.5 bg-gradient-to-r from-slate-200 via-white to-slate-300 border-x border-slate-400 shadow-sm" />
              </div>

              {/* Numéro de table sur la bordure haute — toujours horizontal */}
              <div
                className="absolute left-0 right-0 flex justify-center pointer-events-none"
                style={{
                  top: '2px',
                  transform: t.rotation ? `rotate(-${t.rotation}deg)` : undefined,
                }}
              >
                <span className="text-white font-heading font-bold text-sm drop-shadow-md bg-black/40 px-1.5 rounded">
                  T{t.number}
                </span>
              </div>

              {/* Score sur la bordure basse — toujours horizontal */}
              {t.currentMatch && (
                <div
                  className="absolute left-0 right-0 flex justify-center pointer-events-none"
                  style={{
                    bottom: '2px',
                    transform: t.rotation ? `rotate(-${t.rotation}deg)` : undefined,
                  }}
                >
                  <span className="text-white text-xs font-medium tabular bg-black/50 px-1.5 rounded">
                    {t.currentMatch.setsP1}-{t.currentMatch.setsP2}
                  </span>
                </div>
              )}

              {/* Player names below the table (visible in live/non-editable mode) */}
              {!editable && t.currentMatch && t.currentMatch.player1 && t.currentMatch.player2 && (
                <div
                  className="absolute left-0 right-0 text-center pointer-events-none"
                  style={{
                    top: '100%',
                    marginTop: '2px',
                    transform: t.rotation ? `rotate(-${t.rotation}deg)` : undefined,
                  }}
                >
                  <p className="text-[10px] font-medium text-foreground bg-bg/80 backdrop-blur-sm rounded px-1 py-0.5 inline-block whitespace-nowrap">
                    {t.currentMatch.player1.lastName} vs {t.currentMatch.player2.lastName}
                  </p>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {editable && (
        <p className="text-xs text-foreground-muted mt-2">
          Glisse les tables pour les repositionner. Double-clic pour les pivoter de 90°.
          Sauvegarde automatique après {SAVE_DEBOUNCE_MS}ms.
        </p>
      )}
    </div>
  );
}

// -----------------------------------------------------------------------------
// Marqueurs SVG en overlay
// -----------------------------------------------------------------------------

interface MarkerProps {
  type: 'entrance' | 'buvette' | 'wc' | 'arrow';
  x: number;
  y: number;
  label: string;
  rotation?: number;
  roomW: number;
  roomH: number;
}

function Marker({ type, x, y, label, rotation = 0, roomW, roomH }: MarkerProps) {
  const xPct = (x / roomW) * 100;
  const yPct = (y / roomH) * 100;
  const colors = {
    entrance: 'bg-success text-white',
    buvette: 'bg-warning text-white',
    wc: 'bg-foreground-subtle text-white',
    arrow: 'bg-primary text-white',
  } as const;
  const icons = { entrance: '🚪', buvette: '☕', wc: '🚻', arrow: '→' } as const;
  return (
    <div
      className={`absolute ${colors[type]} px-2 py-1 text-xs font-medium pointer-events-none`}
      style={{
        left: `${xPct}%`,
        top: `${yPct}%`,
        transform: `translate(-50%, -50%) rotate(${rotation}deg)`,
      }}
      data-testid={`marker-${type}`}
    >
      <span aria-hidden="true">{icons[type]}</span> {label}
    </div>
  );
}
