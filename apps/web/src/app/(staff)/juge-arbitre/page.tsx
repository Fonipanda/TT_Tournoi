'use client';

import { useEffect, useState, useCallback } from 'react';
import { LiveStatusBadge } from '@/components/LiveStatusBadge';
import { enqueueOrSubmit } from '@/lib/pwa/sync-queue';

interface JaMatch {
  id: string;
  bracket: { name: string; category: string };
  player1: { firstName: string; lastName: string; club: string | null } | null;
  player1Id: string | null;
  player2: { firstName: string; lastName: string; club: string | null } | null;
  player2Id: string | null;
  table: { number: number } | null;
  status: 'waiting' | 'in_progress' | 'finished' | 'blocked';
  scoreP1: number;
  scoreP2: number;
  setsP1: number;
  setsP2: number;
  sets: { p1: number; p2: number }[];
  version: number;
}

function SetScoreInput({
  setIndex,
  p1Score,
  p2Score,
  onChange,
  disabled,
}: {
  setIndex: number;
  p1Score: number;
  p2Score: number;
  onChange: (p1: number, p2: number) => void;
  disabled: boolean;
}) {
  return (
    <div className="flex items-center gap-1 text-xs">
      <span className="text-foreground-muted w-5 text-right">S{setIndex + 1}</span>
      <input
        type="number"
        min={0}
        max={99}
        value={p1Score}
        onChange={(e) => onChange(Number(e.target.value) || 0, p2Score)}
        disabled={disabled}
        className="w-10 text-center border border-border rounded px-1 py-0.5 bg-bg tabular"
      />
      <span className="text-foreground-muted">-</span>
      <input
        type="number"
        min={0}
        max={99}
        value={p2Score}
        onChange={(e) => onChange(p1Score, Number(e.target.value) || 0)}
        disabled={disabled}
        className="w-10 text-center border border-border rounded px-1 py-0.5 bg-bg tabular"
      />
    </div>
  );
}

function MatchCard({
  match,
  onScoreUpdate,
  onFinish,
}: {
  match: JaMatch;
  onScoreUpdate: (m: JaMatch, sets: { p1: number; p2: number }[]) => void;
  onFinish: (m: JaMatch, winnerId: string) => void;
}) {
  const maxSets = 7; // max 7 sets (4 manches gagnantes en senior)
  const [sets, setSets] = useState<{ p1: number; p2: number }[]>(
    match.sets.length > 0
      ? [...match.sets]
      : Array.from({ length: 5 }, () => ({ p1: 0, p2: 0 })),
  );
  const [saving, setSaving] = useState(false);

  const playerName = (p: typeof match.player1) =>
    p ? `${p.lastName} ${p.firstName[0]}.` : '—';

  // Calculate sets won
  const setsWon = sets.reduce(
    (acc, s) => {
      if (s.p1 >= 11 && s.p1 - s.p2 >= 2) return { p1: acc.p1 + 1, p2: acc.p2 };
      if (s.p2 >= 11 && s.p2 - s.p1 >= 2) return { p1: acc.p1, p2: acc.p2 + 1 };
      return acc;
    },
    { p1: 0, p2: 0 },
  );

  const matchFinished = setsWon.p1 >= 3 || setsWon.p2 >= 3;
  const winnerId = matchFinished
    ? setsWon.p1 > setsWon.p2
      ? match.player1Id
      : match.player2Id
    : null;

  const updateSet = (index: number, p1: number, p2: number) => {
    const newSets = [...sets];
    newSets[index] = { p1, p2 };
    setSets(newSets);
  };

  const addSet = () => {
    if (sets.length < maxSets) setSets([...sets, { p1: 0, p2: 0 }]);
  };

  const handleSave = async () => {
    setSaving(true);
    await onScoreUpdate(match, sets);
    setSaving(false);
  };

  const handleFinish = () => {
    if (winnerId) onFinish(match, winnerId);
  };

  return (
    <div className="card rounded-xl" data-testid={`ja-match-${match.id}`}>
      <div className="flex justify-between items-center mb-3">
        <div>
          <p className="text-xs uppercase tracking-widest text-foreground-muted">
            {match.bracket.name} &middot; {match.bracket.category}
          </p>
          {match.table && (
            <p className="text-sm font-medium text-primary">Table {match.table.number}</p>
          )}
        </div>
        <span
          className={`text-xs px-2 py-1 rounded ${
            match.status === 'in_progress'
              ? 'bg-success-soft text-success'
              : 'bg-bg-alt text-foreground-muted'
          }`}
        >
          {match.status === 'in_progress' ? 'En cours' : 'En attente'}
        </span>
      </div>

      {/* Players header */}
      <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3 mb-4">
        <div className="text-left">
          <p className="font-medium text-sm truncate">{playerName(match.player1)}</p>
          <p className="text-xs text-foreground-muted">{match.player1?.club ?? ''}</p>
        </div>
        <div className="text-center">
          <div className="font-heading text-3xl tabular text-primary">
            {setsWon.p1} - {setsWon.p2}
          </div>
          <p className="text-xs text-foreground-muted">Sets</p>
        </div>
        <div className="text-right">
          <p className="font-medium text-sm truncate">{playerName(match.player2)}</p>
          <p className="text-xs text-foreground-muted">{match.player2?.club ?? ''}</p>
        </div>
      </div>

      {/* Set-by-set scores */}
      <div className="space-y-1.5 mb-4">
        {sets.map((s, i) => (
          <SetScoreInput
            key={i}
            setIndex={i}
            p1Score={s.p1}
            p2Score={s.p2}
            onChange={(p1, p2) => updateSet(i, p1, p2)}
            disabled={saving}
          />
        ))}
        {sets.length < maxSets && !matchFinished && (
          <button
            type="button"
            onClick={addSet}
            className="text-xs text-primary hover:underline mt-1"
          >
            + Ajouter un set
          </button>
        )}
      </div>

      {/* Actions */}
      <div className="flex gap-2">
        <button
          type="button"
          onClick={handleSave}
          disabled={saving}
          className="btn-secondary text-sm flex-1 disabled:opacity-50"
        >
          {saving ? 'Sauvegarde…' : 'Sauvegarder'}
        </button>
        {matchFinished && winnerId && (
          <button
            type="button"
            onClick={handleFinish}
            className="btn-primary text-sm flex-1"
          >
            Valider ({setsWon.p1 > setsWon.p2 ? match.player1?.lastName : match.player2?.lastName} gagne)
          </button>
        )}
      </div>
    </div>
  );
}

export default function JugeArbitrePage() {
  const [matches, setMatches] = useState<JaMatch[]>([]);
  const [loading, setLoading] = useState(true);
  const [pendingCount, setPendingCount] = useState(0);
  const [online, setOnline] = useState(true);

  const refresh = useCallback(async () => {
    try {
      const r = await fetch('/api/matches?status=in_progress', { cache: 'no-store' });
      const j = await r.json();
      const inProg = j.data ?? [];
      const r2 = await fetch('/api/matches?status=waiting', { cache: 'no-store' });
      const j2 = await r2.json();
      setMatches([...inProg, ...(j2.data ?? [])]);
    } catch {
      /* offline */
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    setOnline(navigator.onLine);
    refresh();
    const id = setInterval(refresh, 15_000);
    const onOnline = () => { setOnline(true); refresh(); };
    const onOffline = () => setOnline(false);
    window.addEventListener('online', onOnline);
    window.addEventListener('offline', onOffline);
    return () => {
      clearInterval(id);
      window.removeEventListener('online', onOnline);
      window.removeEventListener('offline', onOffline);
    };
  }, [refresh]);

  const handleScoreUpdate = async (m: JaMatch, sets: { p1: number; p2: number }[]) => {
    const setsWon = sets.reduce(
      (acc, s) => {
        if (s.p1 >= 11 && s.p1 - s.p2 >= 2) return { p1: acc.p1 + 1, p2: acc.p2 };
        if (s.p2 >= 11 && s.p2 - s.p1 >= 2) return { p1: acc.p1, p2: acc.p2 + 1 };
        return acc;
      },
      { p1: 0, p2: 0 },
    );

    const optimisticId = `score-${m.id}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const body = {
      scoreP1: m.scoreP1,
      scoreP2: m.scoreP2,
      setsP1: setsWon.p1,
      setsP2: setsWon.p2,
      sets,
      version: m.version,
      optimisticId,
    };

    // Optimistic update
    setMatches((prev) =>
      prev.map((x) =>
        x.id === m.id
          ? { ...x, setsP1: setsWon.p1, setsP2: setsWon.p2, sets, version: x.version + 1 }
          : x,
      ),
    );

    const result = await enqueueOrSubmit(`/api/matches/${m.id}/score`, 'PATCH', body);
    if (result.queued) setPendingCount((c) => c + 1);
    else if (!result.ok) refresh();
  };

  const handleFinish = async (m: JaMatch, winnerId: string) => {
    const sets = m.sets.length > 0 ? m.sets : [];
    const setsWon = sets.reduce(
      (acc, s) => {
        if (s.p1 >= 11 && s.p1 - s.p2 >= 2) return { p1: acc.p1 + 1, p2: acc.p2 };
        if (s.p2 >= 11 && s.p2 - s.p1 >= 2) return { p1: acc.p1, p2: acc.p2 + 1 };
        return acc;
      },
      { p1: 0, p2: 0 },
    );

    const optimisticId = `finish-${m.id}-${Date.now()}`;
    const body = {
      winnerId,
      scoreP1: m.scoreP1,
      scoreP2: m.scoreP2,
      setsP1: setsWon.p1,
      setsP2: setsWon.p2,
      sets,
      version: m.version,
      optimisticId,
    };

    // Remove from list optimistically
    setMatches((prev) => prev.filter((x) => x.id !== m.id));

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
            className={`text-xs px-2 py-1 rounded ${
              online ? 'bg-success-soft text-success' : 'bg-warning-soft text-warning'
            }`}
          >
            {online ? 'En ligne' : 'Hors ligne'}
          </span>
          {pendingCount > 0 && (
            <span className="text-xs px-2 py-1 bg-primary-soft text-primary rounded">
              {pendingCount} en attente
            </span>
          )}
        </div>
      </div>

      {loading && <p className="text-foreground-muted">Chargement…</p>}
      {!loading && matches.length === 0 && (
        <p className="card text-foreground-muted text-center py-8 rounded-xl">
          Aucun match en cours ou en attente.
        </p>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {matches.map((m) => (
          <MatchCard
            key={m.id}
            match={m}
            onScoreUpdate={handleScoreUpdate}
            onFinish={handleFinish}
          />
        ))}
      </div>
    </div>
  );
}
