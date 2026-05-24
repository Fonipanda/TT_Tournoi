'use client';

import { useCallback, useEffect, useState } from 'react';
import { useLiveWebSocket } from '@/lib/live/useLiveWebSocket';
import type { LiveEvent } from '@tt/types';

interface LiveMatch {
  id: string;
  bracket: { name: string };
  player1: { firstName: string; lastName: string; club: string | null } | null;
  player2: { firstName: string; lastName: string; club: string | null } | null;
  table: { number: number } | null;
  scoreP1: number;
  scoreP2: number;
  setsP1: number;
  setsP2: number;
  status: string;
}

const ROTATION_MS = 30_000;

export default function LiveTvPage() {
  const [matches, setMatches] = useState<LiveMatch[]>([]);
  const [page, setPage] = useState(0);

  const refresh = useCallback(async () => {
    try {
      const r = await fetch('/api/live/matches?status=in_progress', { cache: 'no-store' });
      const j = await r.json();
      setMatches(j.data ?? []);
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

  // Auto-rotation toutes les 30s entre les pages
  const PAGE_SIZE = 6;
  const totalPages = Math.max(1, Math.ceil(matches.length / PAGE_SIZE));

  useEffect(() => {
    if (totalPages <= 1) return;
    const id = setInterval(() => setPage((p) => (p + 1) % totalPages), ROTATION_MS);
    return () => clearInterval(id);
  }, [totalPages]);

  useLiveWebSocket(
    useCallback(
      (event: LiveEvent) => {
        if (
          event.type === 'match_score_updated' ||
          event.type === 'match_completed' ||
          event.type === 'match_started'
        ) {
          refresh();
        }
      },
      [refresh],
    ),
  );

  const visible = matches.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

  return (
    <div
      className="min-h-screen w-full bg-tv-bg text-tv-fg p-8"
      data-testid="live-tv"
      style={{ fontFamily: 'var(--font-heading), sans-serif' }}
    >
      <header className="flex items-center justify-between mb-8 border-b border-white/10 pb-4">
        <h1 className="font-heading text-5xl uppercase tracking-widest text-tv-accent">
          TT Tournoi · Live
        </h1>
        <p className="font-mono text-2xl tabular">
          {new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
        </p>
      </header>

      {visible.length === 0 ? (
        <div className="text-center text-3xl text-white/40 py-32">
          Aucun match en cours
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {visible.map((m) => (
            <div
              key={m.id}
              className="bg-slate-800 border border-white/10 p-6"
              data-testid={`tv-match-${m.id}`}
            >
              <div className="flex justify-between items-center mb-4">
                <span className="text-sm uppercase tracking-widest text-white/60">
                  {m.bracket.name}
                </span>
                {m.table && (
                  <span className="text-sm uppercase tracking-widest text-tv-accent">
                    Table {m.table.number}
                  </span>
                )}
              </div>
              <div className="grid grid-cols-[1fr_auto] gap-x-6 items-center">
                <span className="text-3xl font-medium truncate">
                  {m.player1 ? `${m.player1.lastName} ${m.player1.firstName}` : '—'}
                </span>
                <span
                  className="text-score-tv font-bold text-tv-accent leading-none tabular"
                  data-testid={`tv-score-${m.id}-p1`}
                >
                  {m.setsP1}
                </span>
                <span className="text-3xl font-medium truncate">
                  {m.player2 ? `${m.player2.lastName} ${m.player2.firstName}` : '—'}
                </span>
                <span
                  className="text-score-tv font-bold text-white leading-none tabular"
                  data-testid={`tv-score-${m.id}-p2`}
                >
                  {m.setsP2}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}

      {totalPages > 1 && (
        <p className="text-center text-white/40 mt-8 text-sm">
          Page {page + 1} / {totalPages}
        </p>
      )}
    </div>
  );
}
