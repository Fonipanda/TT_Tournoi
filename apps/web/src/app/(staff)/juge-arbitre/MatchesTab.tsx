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
  poolNumber: number | null;
  status: 'waiting' | 'in_progress' | 'finished' | 'blocked';
  scoreP1: number;
  scoreP2: number;
  setsP1: number;
  setsP2: number;
  sets: { p1: number; p2: number }[];
  version: number;
}

// ─── Score Cell (editable input or readonly badge) ────────────────────────────
function ScoreCell({
  value,
  won,
  editing,
  onChange,
}: {
  value: number;
  won: boolean | null;
  editing: boolean;
  onChange: (v: number) => void;
}) {
  const bg =
    won === null
      ? 'bg-gray-200 text-gray-700'
      : won
        ? 'bg-emerald-500 text-white'
        : 'bg-red-500 text-white';
  if (!editing) {
    return (
      <span className={`inline-flex items-center justify-center w-11 h-8 rounded text-sm font-bold ${bg}`}>
        {value > 0 ? value : '-'}
      </span>
    );
  }
  return (
    <input
      type="number"
      min={0}
      max={99}
      value={value || ''}
      onChange={(e) => onChange(Number(e.target.value) || 0)}
      className={`w-11 h-8 rounded text-sm font-bold text-center tabular border-0 outline-none focus:ring-2 focus:ring-primary appearance-none [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none [-moz-appearance:textfield] ${bg}`}
      aria-label="Score"
    />
  );
}

function MatchCard({
  match,
  onValidate,
  onEdit,
  canEdit,
  editTooltip,
}: {
  match: JaMatch;
  onValidate: (m: JaMatch, sets: { p1: number; p2: number }[], winnerId: string) => void;
  onEdit: (m: JaMatch) => void;
  canEdit: boolean;
  editTooltip: string;
}) {
  const [sets, setSets] = useState<{ p1: number; p2: number }[]>(
    match.sets.length > 0
      ? [...match.sets, ...Array.from({ length: Math.max(0, 5 - match.sets.length) }, () => ({ p1: 0, p2: 0 }))].slice(0, 5)
      : Array.from({ length: 5 }, () => ({ p1: 0, p2: 0 })),
  );
  const [editing, setEditing] = useState(match.status !== 'finished');

  const playerName = (p: typeof match.player1) =>
    p ? `${p.lastName} ${p.firstName[0]}.` : '—';

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
    ? setsWon.p1 > setsWon.p2 ? match.player1Id : match.player2Id
    : null;

  const updateSet = (index: number, field: 'p1' | 'p2', value: number) => {
    const newSets = [...sets];
    newSets[index] = { ...newSets[index]!, [field]: value };
    setSets(newSets);
  };

  const handleValidate = () => {
    if (winnerId) onValidate(match, sets, winnerId);
  };

  return (
    <div className="card rounded-lg p-3 flex flex-col gap-2 text-xs">
      <div className="flex justify-between items-center">
        <span className="font-heading text-xs uppercase tracking-wider text-foreground-muted truncate">
          {match.bracket.name}
        </span>
        {match.table && (
          <span className="bg-primary/10 text-primary font-bold text-xs px-1.5 py-0.5 rounded">
            {match.table.number}
          </span>
        )}
      </div>

      <div className="flex items-center justify-center gap-2">
        <span className={`font-heading text-2xl tabular ${setsWon.p1 > setsWon.p2 ? 'text-emerald-600' : 'text-foreground'}`}>
          {setsWon.p1}
        </span>
        <span className="text-foreground-muted text-lg">-</span>
        <span className={`font-heading text-2xl tabular ${setsWon.p2 > setsWon.p1 ? 'text-emerald-600' : 'text-foreground'}`}>
          {setsWon.p2}
        </span>
      </div>

      <div className="flex items-center gap-1.5">
        <span className="font-medium truncate flex-1 text-xs" title={playerName(match.player1)}>
          {playerName(match.player1)}
        </span>
        <div className="flex gap-0.5">
          {sets.map((s, i) => {
            const won =
              s.p1 === 0 && s.p2 === 0
                ? null
                : s.p1 >= 11 && s.p1 - s.p2 >= 2
                  ? true
                  : s.p2 >= 11 && s.p2 - s.p1 >= 2
                    ? false
                    : null;
            return (
              <ScoreCell
                key={i}
                value={s.p1}
                won={won}
                editing={editing}
                onChange={(v) => updateSet(i, 'p1', v)}
              />
            );
          })}
        </div>
      </div>

      <div className="flex items-center gap-1.5">
        <span className="font-medium truncate flex-1 text-xs" title={playerName(match.player2)}>
          {playerName(match.player2)}
        </span>
        <div className="flex gap-0.5">
          {sets.map((s, i) => {
            const won =
              s.p1 === 0 && s.p2 === 0
                ? null
                : s.p2 >= 11 && s.p2 - s.p1 >= 2
                  ? true
                  : s.p1 >= 11 && s.p1 - s.p2 >= 2
                    ? false
                    : null;
            return (
              <ScoreCell
                key={i}
                value={s.p2}
                won={won}
                editing={editing}
                onChange={(v) => updateSet(i, 'p2', v)}
              />
            );
          })}
        </div>
      </div>

      <div className="flex gap-1.5 mt-1">
        {editing && matchFinished && winnerId && (
          <button
            type="button"
            onClick={handleValidate}
            className="btn-primary text-xs py-1 px-2 flex-1 rounded"
          >
            Valider
          </button>
        )}
        {!editing && (
          <button
            type="button"
            onClick={() => { if (canEdit) { setEditing(true); onEdit(match); } }}
            disabled={!canEdit}
            title={canEdit ? 'Modifier le résultat' : editTooltip}
            className="btn-secondary text-xs py-1 px-2 flex-1 rounded disabled:opacity-40 disabled:cursor-not-allowed"
          >
            Modifier
          </button>
        )}
      </div>
    </div>
  );
}

export function MatchesTab() {
  const [matches, setMatches] = useState<JaMatch[]>([]);
  const [loading, setLoading] = useState(true);
  const [pendingCount, setPendingCount] = useState(0);
  const [online, setOnline] = useState(true);

  const refresh = useCallback(async () => {
    try {
      const [r1, r2] = await Promise.all([
        fetch('/api/matches?status=in_progress', { cache: 'no-store' }),
        fetch('/api/matches?status=waiting', { cache: 'no-store' }),
      ]);
      const [j1, j2] = await Promise.all([r1.json(), r2.json()]);
      // N'affiche QUE les matchs avec une table attribuée (le juge-arbitre
      // n'a pas à voir les matchs en attente de table).
      const allMatches = [...(j1.data ?? []), ...(j2.data ?? [])] as JaMatch[];
      setMatches(allMatches.filter((m) => m.table != null));
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

  const handleValidate = async (m: JaMatch, sets: { p1: number; p2: number }[], winnerId: string) => {
    const setsWon = sets.reduce(
      (acc, s) => {
        if (s.p1 >= 11 && s.p1 - s.p2 >= 2) return { p1: acc.p1 + 1, p2: acc.p2 };
        if (s.p2 >= 11 && s.p2 - s.p1 >= 2) return { p1: acc.p1, p2: acc.p2 + 1 };
        return acc;
      },
      { p1: 0, p2: 0 },
    );

    const body = {
      winnerId,
      scoreP1: m.scoreP1,
      scoreP2: m.scoreP2,
      setsP1: setsWon.p1,
      setsP2: setsWon.p2,
      sets,
      version: m.version,
      optimisticId: `finish-${m.id}-${Date.now()}`,
    };

    setMatches((prev) => prev.filter((x) => x.id !== m.id));

    const result = await enqueueOrSubmit(`/api/matches/${m.id}/finish`, 'POST', body);
    if (result.queued) setPendingCount((c) => c + 1);
    else refresh();
  };

  const handleEdit = (_m: JaMatch) => {
    /* enables editing in the card */
  };

  const canEditMatch = (_m: JaMatch): { allowed: boolean; reason: string } => {
    return { allowed: true, reason: '' };
  };

  return (
    <div>
      <div className="flex items-center justify-end gap-3 mb-3">
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

      {loading && <p className="text-foreground-muted">Chargement…</p>}
      {!loading && matches.length === 0 && (
        <p className="card text-foreground-muted text-center py-6 rounded-xl">
          Aucun match en cours ou en attente.
        </p>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
        {matches.map((m) => {
          const { allowed, reason } = canEditMatch(m);
          return (
            <MatchCard
              key={m.id}
              match={m}
              onValidate={handleValidate}
              onEdit={handleEdit}
              canEdit={allowed}
              editTooltip={reason}
            />
          );
        })}
      </div>
    </div>
  );
}
