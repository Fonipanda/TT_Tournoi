'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { PlayerRegistrationModal } from './PlayerRegistrationModal';
import { PoolSizeModal } from './PoolSizeModal';
import { ConfirmDialog } from '@/components/ui/modal';
import { toast } from '@/components/ui/toast';
import { apiPatch, apiDelete, apiPost, ApiError } from '@/lib/api-client';

interface Registration {
  id: string;
  player: {
    id: string;
    firstName: string;
    lastName: string;
    licenseNumber: string | null;
    club: string | null;
    points: number;
    phone: string | null;
  };
  paymentStatus: string;
  checkinStatus: string;
  dossardNumber: number | null;
}

interface MatchPlayer {
  id: string;
  firstName: string;
  lastName: string;
  points: number;
}

interface PoolMatch {
  id: string;
  poolNumber: number | null;
  poolMatchOrder: number | null;
  roundName: string | null;
  roundNumber: number | null;
  status: string;
  player1: MatchPlayer | null;
  player1Id: string | null;
  player2: MatchPlayer | null;
  player2Id: string | null;
  winnerId: string | null;
  setsP1: number | null;
  setsP2: number | null;
  tableId: string | null;
  table: { id: string; number: number; roomId: string } | null;
}

interface AvailableTable {
  id: string;
  number: number;
  room: { name: string };
}

interface Props {
  bracketId: string;
  bracketName: string;
  registrations: Registration[];
  matches?: PoolMatch[];
  availableTables?: AvailableTable[];
  busyPlayerIds?: string[];
}

export function BracketRegistrationsPage({
  bracketId,
  bracketName,
  registrations,
  matches = [],
  availableTables = [],
  busyPlayerIds = [],
}: Props) {
  const router = useRouter();
  const [registerOpen, setRegisterOpen] = useState(false);
  const [confirmRemove, setConfirmRemove] = useState<Registration | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [assigningPool, setAssigningPool] = useState<number | null>(null);
  const [poolSizeModalOpen, setPoolSizeModalOpen] = useState(false);
  const [genElim, setGenElim] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [swapMode, setSwapMode] = useState(false);
  const [swapFirst, setSwapFirst] = useState<{ playerId: string; poolNumber: number } | null>(null);

  const alreadyRegisteredIds = new Set(registrations.map((r) => r.player.id));
  const busySet = new Set(busyPlayerIds);

  // Stats
  const paid = registrations.filter((r) => r.paymentStatus === 'paid').length;
  const present = registrations.filter((r) => r.checkinStatus === 'P').length;
  const allPresent = registrations.every((r) => r.checkinStatus === 'P');

  const togglePayment = async (r: Registration) => {
    setBusy(`pay-${r.id}`);
    try {
      const newStatus = r.paymentStatus === 'paid' ? 'pending' : 'paid';
      await apiPatch(`/api/registrations/${r.id}`, { paymentStatus: newStatus });
      router.refresh();
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : 'Erreur');
    } finally {
      setBusy(null);
    }
  };

  const cycleCheckin = async (r: Registration) => {
    setBusy(`chk-${r.id}`);
    try {
      const next = r.checkinStatus === '' ? 'P' : r.checkinStatus === 'P' ? 'A' : '';
      await apiPatch(`/api/registrations/${r.id}`, { checkinStatus: next });
      router.refresh();
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : 'Erreur');
    } finally {
      setBusy(null);
    }
  };

  const onRemove = async () => {
    if (!confirmRemove) return;
    try {
      await apiDelete(`/api/registrations/${confirmRemove.id}`);
      toast.success('Joueur retiré');
      router.refresh();
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : 'Erreur');
    } finally {
      setConfirmRemove(null);
    }
  };

  // Assign a table to an entire pool (all pending matches of that pool)
  const assignPoolTable = async (poolNumber: number, tableId: string) => {
    setAssigningPool(poolNumber);
    try {
      const poolM = poolMatches.filter(
        (m) => m.poolNumber === poolNumber && m.status !== 'finished' && !m.tableId,
      );
      // Check if any player in this pool is already busy
      const poolPlayerIds = new Set(
        poolM.flatMap((m) => [m.player1Id, m.player2Id].filter(Boolean) as string[]),
      );
      const conflicting = [...poolPlayerIds].filter((pid) => busySet.has(pid));
      if (conflicting.length > 0) {
        toast.error('Un joueur de cette poule est déjà en match sur une autre table');
        return;
      }
      // Assign to all pending matches
      for (const m of poolM) {
        await apiPost(`/api/matches/${m.id}/assign-table`, { tableId });
      }
      toast.success(`Table attribuée à la poule ${poolNumber}`);
      router.refresh();
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : 'Erreur');
    } finally {
      setAssigningPool(null);
    }
  };

  // Assign table to a single elimination match
  const assignMatchTable = async (matchId: string, tableId: string, match: PoolMatch) => {
    // Check busy players
    const playerIds = [match.player1Id, match.player2Id].filter(Boolean) as string[];
    const conflicting = playerIds.filter((pid) => busySet.has(pid));
    if (conflicting.length > 0) {
      toast.error('Un joueur de ce match est déjà en jeu sur une autre table');
      return;
    }
    setBusy(`table-${matchId}`);
    try {
      await apiPost(`/api/matches/${matchId}/assign-table`, { tableId });
      toast.success('Table attribuée');
      router.refresh();
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : 'Erreur');
    } finally {
      setBusy(null);
    }
  };

  // Swap two players between pools
  const handlePoolSwapClick = async (playerId: string, poolNumber: number) => {
    if (!swapFirst) {
      setSwapFirst({ playerId, poolNumber });
      return;
    }
    if (swapFirst.poolNumber === poolNumber) {
      toast.error('Sélectionnez un joueur dans une poule différente');
      setSwapFirst({ playerId, poolNumber });
      return;
    }
    setBusy('swap');
    try {
      await apiPost(`/api/brackets/${bracketId}/swap-pool-players`, {
        playerAId: swapFirst.playerId,
        playerBId: playerId,
      });
      toast.success('Joueurs échangés');
      setSwapMode(false);
      setSwapFirst(null);
      router.refresh();
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : 'Erreur');
    } finally {
      setBusy(null);
    }
  };

  const generateElimination = async () => {
    setGenElim(true);
    try {
      const r = await apiPost<{ matchesCreated: number }>(
        `/api/brackets/${bracketId}/generate-elimination`,
      );
      toast.success(`${r.matchesCreated} matches d'élimination créés`);
      router.refresh();
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : 'Erreur');
    } finally {
      setGenElim(false);
    }
  };

  const deletePoolMatches = async () => {
    setDeleting('pools');
    try {
      await apiDelete(`/api/brackets/${bracketId}/matches?type=pool`);
      toast.success('Poules supprimées');
      router.refresh();
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : 'Erreur');
    } finally {
      setDeleting(null);
    }
  };

  const deleteElimMatches = async () => {
    setDeleting('elim');
    try {
      await apiDelete(`/api/brackets/${bracketId}/matches?type=elimination`);
      toast.success('Élimination supprimée');
      router.refresh();
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : 'Erreur');
    } finally {
      setDeleting(null);
    }
  };

  const deleteAllMatches = async () => {
    setDeleting('all');
    try {
      await apiDelete(`/api/brackets/${bracketId}/matches`);
      toast.success('Tous les matches supprimés');
      router.refresh();
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : 'Erreur');
    } finally {
      setDeleting(null);
    }
  };

  // Group matches by pool
  const poolMatches = matches.filter((m) => m.poolNumber != null);
  const elimMatches = matches.filter((m) => m.poolNumber == null);
  const poolsGrouped = new Map<number, PoolMatch[]>();
  for (const m of poolMatches) {
    const pn = m.poolNumber!;
    if (!poolsGrouped.has(pn)) poolsGrouped.set(pn, []);
    poolsGrouped.get(pn)!.push(m);
  }

  return (
    <>
      <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
        <div>
          <Link href="/admin/tableaux" className="text-sm text-primary hover:underline">
            &larr; Tableaux
          </Link>
          <h1 className="font-heading text-3xl uppercase tracking-wide mt-1">{bracketName}</h1>
          <p className="text-foreground-muted text-sm">
            {registrations.length} inscrits &middot; {paid} payés &middot; {present} présents
          </p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <button
            type="button"
            onClick={() => setRegisterOpen(true)}
            className="btn-primary text-sm"
          >
            + Inscrire un joueur
          </button>
          <button
            type="button"
            onClick={() => setPoolSizeModalOpen(true)}
            disabled={present < 2}
            className="btn-secondary text-sm disabled:opacity-50"
            title={present < 2 ? 'Tous les joueurs doivent être marqués Présent' : 'Générer poules'}
          >
            Générer poules
          </button>
          <button
            type="button"
            onClick={generateElimination}
            disabled={genElim || poolMatches.length === 0}
            className="btn-secondary text-sm disabled:opacity-50"
            title="Générer le tableau final depuis les résultats des poules"
          >
            {genElim ? '…' : 'Générer tableau final'}
          </button>
          <Link href={`/progression/${bracketId}`} className="btn-secondary text-sm">
            Voir progression
          </Link>
        </div>
      </div>

      {/* Delete generated data buttons */}
      {(poolMatches.length > 0 || elimMatches.length > 0) && (
        <div className="flex gap-2 flex-wrap mb-4 p-3 bg-danger-soft/20 rounded-xl border border-danger/20">
          <span className="text-xs text-danger font-medium self-center mr-2">Supprimer :</span>
          {poolMatches.length > 0 && (
            <button
              type="button"
              onClick={deletePoolMatches}
              disabled={deleting === 'pools'}
              className="text-xs px-3 py-1 rounded-lg bg-danger text-white hover:bg-danger/90 disabled:opacity-50"
            >
              {deleting === 'pools' ? '…' : 'Poules'}
            </button>
          )}
          {elimMatches.length > 0 && (
            <button
              type="button"
              onClick={deleteElimMatches}
              disabled={deleting === 'elim'}
              className="text-xs px-3 py-1 rounded-lg bg-danger text-white hover:bg-danger/90 disabled:opacity-50"
            >
              {deleting === 'elim' ? '…' : 'Élimination'}
            </button>
          )}
          <button
            type="button"
            onClick={deleteAllMatches}
            disabled={deleting === 'all'}
            className="text-xs px-3 py-1 rounded-lg border border-danger text-danger hover:bg-danger hover:text-white disabled:opacity-50"
          >
            {deleting === 'all' ? '…' : 'Tout supprimer'}
          </button>
        </div>
      )}

      {/* Registrations table */}
      <div className="card overflow-x-auto mb-6">
        <table className="w-full text-sm">
          <thead className="text-xs uppercase tracking-widest text-foreground-muted">
            <tr className="border-b border-border">
              <th className="text-left py-2">Licence</th>
              <th className="text-left py-2">Nom</th>
              <th className="text-left py-2">Prénom</th>
              <th className="text-left py-2">Club</th>
              <th className="text-right py-2">Points</th>
              <th className="text-center py-2">Paiement</th>
              <th className="text-center py-2">Présence</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {registrations
              .slice()
              .sort((a, b) => b.player.points - a.player.points)
              .map((r) => (
                <tr key={r.id} className="border-b border-border hover:bg-bg-alt">
                  <td className="py-2 font-mono tabular text-xs">{r.player.licenseNumber ?? '—'}</td>
                  <td className="py-2 font-medium uppercase">{r.player.lastName}</td>
                  <td className="py-2">{r.player.firstName}</td>
                  <td className="py-2 text-foreground-muted">{r.player.club ?? '—'}</td>
                  <td className="py-2 text-right tabular">{Math.round(r.player.points)}</td>
                  <td className="py-2 text-center">
                    <button
                      type="button"
                      onClick={() => togglePayment(r)}
                      disabled={busy === `pay-${r.id}`}
                      className={`text-xs px-2 py-0.5 cursor-pointer rounded ${
                        r.paymentStatus === 'paid'
                          ? 'bg-success-soft text-success hover:bg-success-soft/80'
                          : 'bg-warning-soft text-warning hover:bg-warning-soft/80'
                      } disabled:opacity-50`}
                    >
                      {r.paymentStatus === 'paid' ? 'Payé' : 'En attente'}
                    </button>
                  </td>
                  <td className="py-2 text-center">
                    <button
                      type="button"
                      onClick={() => cycleCheckin(r)}
                      disabled={busy === `chk-${r.id}`}
                      className={`text-xs px-2 py-0.5 cursor-pointer rounded ${
                        r.checkinStatus === 'P'
                          ? 'bg-success-soft text-success'
                          : r.checkinStatus === 'A'
                            ? 'bg-danger-soft text-danger'
                            : 'bg-bg-alt text-foreground-subtle'
                      } disabled:opacity-50`}
                      title="Clic pour cycler : — → Présent → Absent → —"
                    >
                      {r.checkinStatus === 'P' ? 'Présent' : r.checkinStatus === 'A' ? 'Absent' : '—'}
                    </button>
                  </td>
                  <td className="py-2 text-right">
                    <button
                      type="button"
                      onClick={() => setConfirmRemove(r)}
                      className="text-danger text-xs hover:underline"
                    >
                      Retirer
                    </button>
                  </td>
                </tr>
              ))}
            {registrations.length === 0 && (
              <tr>
                <td colSpan={8} className="py-6 text-center text-foreground-muted">
                  Aucun joueur inscrit.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Pool matches with table assignment per POOL */}
      {poolsGrouped.size > 0 && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="font-heading text-xl uppercase tracking-wide">Matches de poule</h2>
            <div className="flex items-center gap-2">
              {swapMode && (
                <span className="text-xs text-warning">
                  {swapFirst
                    ? `Cliquez un joueur dans une autre poule pour échanger`
                    : `Cliquez un joueur à déplacer`}
                </span>
              )}
              <button
                type="button"
                onClick={() => { setSwapMode(!swapMode); setSwapFirst(null); }}
                className={`btn text-xs px-3 py-1 rounded ${
                  swapMode
                    ? 'bg-warning text-white'
                    : 'bg-bg-alt border border-border hover:bg-primary/10'
                }`}
              >
                {swapMode ? 'Annuler' : 'Modifier les poules'}
              </button>
            </div>
          </div>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {[...poolsGrouped.entries()].map(([poolNum, pMatches]) => {
              const poolHasTable = pMatches.some((m) => m.table != null);
              const poolAllFinished = pMatches.every((m) => m.status === 'finished');
              const assignedTable = pMatches.find((m) => m.table)?.table;
              // Get unique players in this pool
              const poolPlayersMap = new Map<string, { id: string; lastName: string; firstName?: string; club?: string }>();
              for (const m of pMatches) {
                if (m.player1) poolPlayersMap.set(m.player1.id, m.player1 as { id: string; lastName: string; firstName?: string; club?: string });
                if (m.player2) poolPlayersMap.set(m.player2.id, m.player2 as { id: string; lastName: string; firstName?: string; club?: string });
              }
              const poolPlayers = [...poolPlayersMap.values()];
              return (
                <div key={poolNum} className="card rounded-xl p-4">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="font-heading text-sm uppercase tracking-wider text-primary">
                      Poule {poolNum}
                    </h3>
                    {/* Pool-level table assignment */}
                    {poolHasTable && assignedTable ? (
                      <span className="bg-primary/10 text-primary text-xs px-2 py-0.5 rounded font-medium">
                        Table {assignedTable.number}
                      </span>
                    ) : !poolAllFinished && availableTables.length > 0 ? (
                      <select
                        className="text-xs border border-border rounded px-1.5 py-0.5 bg-bg"
                        value=""
                        disabled={assigningPool === poolNum}
                        onChange={(e) => {
                          if (e.target.value) assignPoolTable(poolNum, e.target.value);
                        }}
                      >
                        <option value="">Attrib. table…</option>
                        {availableTables.map((t) => (
                          <option key={t.id} value={t.id}>
                            T{t.number} ({t.room.name})
                          </option>
                        ))}
                      </select>
                    ) : poolAllFinished ? (
                      <span className="text-xs text-success font-medium">Terminée</span>
                    ) : null}
                  </div>
                  {/* Pool players (swap mode) */}
                  {swapMode && (
                    <div className="flex flex-wrap gap-1 mb-2">
                      {poolPlayers.map((p) => (
                        <button
                          key={p.id}
                          type="button"
                          onClick={() => handlePoolSwapClick(p.id, poolNum)}
                          disabled={busy === 'swap'}
                          className={`text-xs px-2 py-1 rounded border transition-colors ${
                            swapFirst?.playerId === p.id
                              ? 'bg-primary text-white border-primary'
                              : 'bg-bg-alt border-border hover:bg-primary/10 hover:border-primary'
                          }`}
                        >
                          {p.lastName} {p.firstName ? p.firstName[0] + '.' : ''}
                          {p.club ? ` (${p.club})` : ''}
                        </button>
                      ))}
                    </div>
                  )}
                  <div className="space-y-2">
                    {pMatches.map((m) => (
                      <div
                        key={m.id}
                        className={`flex items-center gap-2 text-xs p-2 rounded-lg ${
                          m.status === 'finished'
                            ? 'bg-success-soft/30'
                            : m.status === 'in_progress'
                              ? 'bg-warning-soft/30'
                              : 'bg-bg-alt'
                        }`}
                      >
                        <div className="flex-1 min-w-0">
                          <span className={m.winnerId === m.player1?.id ? 'font-bold' : ''}>
                            {m.player1?.lastName ?? '?'}
                          </span>
                          <span className="text-foreground-muted mx-1">vs</span>
                          <span className={m.winnerId === m.player2?.id ? 'font-bold' : ''}>
                            {m.player2?.lastName ?? '?'}
                          </span>
                          {m.setsP1 != null && m.setsP2 != null && (
                            <span className="text-foreground-muted ml-1">
                              ({m.setsP1}-{m.setsP2})
                            </span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Elimination matches — groupés par tour */}
      {elimMatches.length > 0 && (
        <div className="mt-6 space-y-6">
          <h2 className="font-heading text-xl uppercase tracking-wide">Élimination directe</h2>
          {(() => {
            // Groupe les matchs par roundNumber, trie chaque groupe par poolMatchOrder
            const byRound = new Map<number, typeof elimMatches>();
            for (const m of elimMatches) {
              const r = m.roundNumber || 1;
              if (!byRound.has(r)) byRound.set(r, []);
              byRound.get(r)!.push(m);
            }
            for (const arr of byRound.values()) {
              arr.sort((a, b) => (a.poolMatchOrder ?? 0) - (b.poolMatchOrder ?? 0));
            }
            const totalRounds = byRound.size > 0 ? Math.max(...byRound.keys()) : 0;
            const roundLabel = (idx: number): string => {
              const remaining = totalRounds - idx;
              if (remaining <= 1) return 'Finale';
              if (remaining === 2) return 'Demi-finale';
              if (remaining === 3) return 'Quart de finale';
              if (remaining === 4) return '8ème de finale';
              if (remaining === 5) return '16ème de finale';
              if (remaining === 6) return '32ème de finale';
              if (remaining === 7) return '64ème de finale';
              if (remaining === 8) return '128ème de finale';
              return `Tour ${idx + 1}`;
            };
            const sortedRounds = [...byRound.keys()].sort((a, b) => a - b);
            return sortedRounds.map((roundNum) => {
              const matches = byRound.get(roundNum)!;
              return (
                <div key={roundNum} className="space-y-2">
                  <h3 className="font-heading text-sm uppercase tracking-widest text-foreground-muted">
                    {roundLabel(roundNum - 1)}
                    <span className="ml-2 text-xs text-foreground-subtle">
                      · {matches.length} match{matches.length > 1 ? 's' : ''}
                    </span>
                  </h3>
                  <div className="card overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead className="text-xs uppercase tracking-widest text-foreground-muted">
                        <tr className="border-b border-border">
                          <th className="text-left py-2 w-12">#</th>
                          <th className="text-left py-2">Joueur 1</th>
                          <th className="text-left py-2">Joueur 2</th>
                          <th className="text-center py-2">Score</th>
                          <th className="text-center py-2 w-40">Table</th>
                        </tr>
                      </thead>
                      <tbody>
                        {matches.map((m) => (
                          <tr key={m.id} className="border-b border-border hover:bg-bg-alt">
                            <td className="py-2 text-foreground-subtle font-mono text-xs">
                              {m.poolMatchOrder ?? '—'}
                            </td>
                            <td className={`py-2 ${m.winnerId === m.player1?.id ? 'font-bold' : ''}`}>
                              {m.player1 ? `${m.player1.lastName} ${m.player1.firstName}` : '—'}
                            </td>
                            <td className={`py-2 ${m.winnerId === m.player2?.id ? 'font-bold' : ''}`}>
                              {m.player2 ? `${m.player2.lastName} ${m.player2.firstName}` : '—'}
                            </td>
                            <td className="py-2 text-center tabular">
                              {m.setsP1 != null ? `${m.setsP1}-${m.setsP2}` : '—'}
                            </td>
                            <td className="py-2 text-center">
                              {m.table ? (
                                <span className="bg-primary/10 text-primary text-xs px-2 py-0.5 rounded">
                                  T{m.table.number}
                                </span>
                              ) : m.status !== 'finished' && m.player1 && m.player2 && availableTables.length > 0 ? (
                                <select
                                  className="text-xs border border-border rounded px-1 py-0.5 bg-bg"
                                  value=""
                                  disabled={busy === `table-${m.id}`}
                                  onChange={(e) => {
                                    if (e.target.value) assignMatchTable(m.id, e.target.value, m);
                                  }}
                                >
                                  <option value="">Table…</option>
                                  {availableTables.map((t) => (
                                    <option key={t.id} value={t.id}>
                                      T{t.number} ({t.room.name})
                                    </option>
                                  ))}
                                </select>
                              ) : (
                                <span className="text-foreground-muted">—</span>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              );
            });
          })()}
        </div>
      )}

      {poolSizeModalOpen && (
        <PoolSizeModal
          bracket={{ id: bracketId, name: bracketName, _count: { registrations: present } }}
          onClose={() => setPoolSizeModalOpen(false)}
        />
      )}
      <PlayerRegistrationModal
        open={registerOpen}
        onClose={() => setRegisterOpen(false)}
        bracketId={bracketId}
        bracketName={bracketName}
        alreadyRegistered={alreadyRegisteredIds}
      />
      <ConfirmDialog
        open={!!confirmRemove}
        title="Retirer ce joueur ?"
        message={
          <>
            <strong>
              {confirmRemove?.player.lastName} {confirmRemove?.player.firstName}
            </strong>{' '}
            sera retiré de ce tableau.
          </>
        }
        confirmLabel="Retirer"
        danger
        onConfirm={onRemove}
        onCancel={() => setConfirmRemove(null)}
      />
    </>
  );
}
