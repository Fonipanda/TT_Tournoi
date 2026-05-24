'use client';

import { useEffect, useState, useCallback } from 'react';
import { LiveStatusBadge } from '@/components/LiveStatusBadge';
import { enqueueOrSubmit } from '@/lib/pwa/sync-queue';

interface JaMatch {
  id: string;
  bracket: { name: string; category: string };
  player1: { firstName: string; lastName: string; club: string | null } | null;
  player2: { firstName: string; lastName: string; club: string | null } | null;
  table: { number: number } | null;
  status: 'waiting' | 'in_progress' | 'finished' | 'blocked';
  scoreP1: number;
  scoreP2: number;
  setsP1: number;
  setsP2: number;
  version: number;
}

export default function JugeArbitrePage() {
  const [matches, setMatches] = useState<JaMatch[]>([]);
  const [loading, setLoading] = useState(true);
  const [pendingCount, setPendingCount] = useState(0);
  const [online, setOnline] = useState(
    typeof navigator !== 'undefined' ? navigator.onLine : true,
  );

  const refresh = useCallback(async () => {
    try {
      const r = await fetch('/api/matches?status=in_progress', { cache: 'no-store' });
      const j = await r.json();
      const inProg = j.data ?? [];
      const r2 = await fetch('/api/matches?status=waiting', { cache: 'no-store' });
      const j2 = await r2.json();
      setMatches([...inProg, ...(j2.data ?? [])]);
    } catch {
      /* offline : on garde les données en cache */
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
    const id = setInterval(refresh, 15_000);
    const onOnline = () => {
      setOnline(true);
      refresh();
    };
    const onOffline = () => setOnline(false);
    window.addEventListener('online', onOnline);
    window.addEventListener('offline', onOffline);
    return () => {
      clearInterval(id);
      window.removeEventListener('online', onOnline);
      window.removeEventListener('offline', onOffline);
    };
  }, [refresh]);

  const updateScore = async (m: JaMatch, deltaP1: number, deltaP2: number) => {
    const newSetsP1 = Math.max(0, m.setsP1 + deltaP1);
    const newSetsP2 = Math.max(0, m.setsP2 + deltaP2);

    const optimisticId = `score-${m.id}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const body = {
      scoreP1: m.scoreP1,
      scoreP2: m.scoreP2,
      setsP1: newSetsP1,
      setsP2: newSetsP2,
      version: m.version,
      optimisticId,
    };

    // Optimistic update local
    setMatches((prev) =>
      prev.map((x) =>
        x.id === m.id
          ? { ...x, setsP1: newSetsP1, setsP2: newSetsP2, version: x.version + 1 }
          : x,
      ),
    );

    const result = await enqueueOrSubmit(`/api/matches/${m.id}/score`, 'PATCH', body);
    if (result.queued) {
      setPendingCount((c) => c + 1);
    } else if (!result.ok) {
      // Conflit version : on recharge
      refresh();
    }
  };

  const finishMatch = async (m: JaMatch, winnerId: string) => {
    const optimisticId = `finish-${m.id}-${Date.now()}`;
    const body = {
      winnerId,
      scoreP1: m.scoreP1,
      scoreP2: m.scoreP2,
      setsP1: m.setsP1,
      setsP2: m.setsP2,
      version: m.version,
      optimisticId,
    };
    const result = await enqueueOrSubmit(`/api/matches/${m.id}/finish`, 'POST', body);
    if (result.queued) setPendingCount((c) => c + 1);
    else refresh();
  };

  return (
    <div data-testid="juge-arbitre-page">
      <div className="flex items-center justify-between mb-6">
        <h1 className="font-heading text-3xl uppercase tracking-wide">Juge-Arbitre</h1>
        <div className="flex items-center gap-4">
          <LiveStatusBadge />
          <span
            className={`text-xs px-2 py-1 ${
              online ? 'bg-success-soft text-success' : 'bg-warning-soft text-warning'
            }`}
            data-testid="online-badge"
          >
            {online ? 'En ligne' : 'Hors ligne'}
          </span>
          {pendingCount > 0 && (
            <span
              className="text-xs px-2 py-1 bg-primary-soft text-primary"
              data-testid="pending-count"
            >
              {pendingCount} en attente
            </span>
          )}
        </div>
      </div>

      {loading && <p className="text-foreground-muted">Chargement…</p>}
      {!loading && matches.length === 0 && (
        <p className="card text-foreground-muted text-center py-8">
          Aucun match à arbitrer.
        </p>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {matches.map((m) => {
          const playerName = (p: typeof m.player1) =>
            p ? `${p.lastName} ${p.firstName}` : '—';
          return (
            <div key={m.id} className="card" data-testid={`ja-match-${m.id}`}>
              <div className="flex justify-between items-center mb-3">
                <div>
                  <p className="text-xs uppercase tracking-widest text-foreground-muted">
                    {m.bracket.name} · {m.bracket.category}
                  </p>
                  {m.table && (
                    <p className="text-sm text-primary">Table {m.table.number}</p>
                  )}
                </div>
                <span
                  className={`text-xs px-2 py-1 ${
                    m.status === 'in_progress'
                      ? 'bg-success-soft text-success'
                      : 'bg-bg-alt text-foreground-muted'
                  }`}
                >
                  {m.status === 'in_progress' ? 'En cours' : 'En attente'}
                </span>
              </div>

              {/* Score sets */}
              <div className="grid grid-cols-[1fr_auto_auto_1fr] gap-3 items-center mb-4">
                <span className="font-medium truncate">{playerName(m.player1)}</span>
                <span
                  className="font-heading text-5xl tabular text-primary leading-none"
                  data-testid={`ja-sets-p1-${m.id}`}
                >
                  {m.setsP1}
                </span>
                <span className="text-foreground-subtle">/</span>
                <span className="font-medium truncate text-right">{playerName(m.player2)}</span>
                <div></div>
                <button
                  type="button"
                  data-testid={`ja-plus-p1-${m.id}`}
                  onClick={() => updateScore(m, 1, 0)}
                  className="btn-primary px-3 py-2 text-sm"
                >
                  +1
                </button>
                <button
                  type="button"
                  data-testid={`ja-plus-p2-${m.id}`}
                  onClick={() => updateScore(m, 0, 1)}
                  className="btn-primary px-3 py-2 text-sm"
                >
                  +1
                </button>
                <div></div>
              </div>

              {/* Actions terminer */}
              {m.player1 && m.player2 && (
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => finishMatch(m, (m as any).player1Id ?? '')}
                    className="btn-secondary text-sm"
                    data-testid={`ja-win-p1-${m.id}`}
                  >
                    Vainqueur : {m.player1.lastName}
                  </button>
                  <button
                    type="button"
                    onClick={() => finishMatch(m, (m as any).player2Id ?? '')}
                    className="btn-secondary text-sm"
                    data-testid={`ja-win-p2-${m.id}`}
                  >
                    Vainqueur : {m.player2.lastName}
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
