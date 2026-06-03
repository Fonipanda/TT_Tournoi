'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { PlayerRegistrationModal } from './PlayerRegistrationModal';
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
  player2: MatchPlayer | null;
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
}

export function BracketRegistrationsPage({
  bracketId,
  bracketName,
  registrations,
  matches = [],
  availableTables = [],
}: Props) {
  const router = useRouter();
  const [registerOpen, setRegisterOpen] = useState(false);
  const [confirmRemove, setConfirmRemove] = useState<Registration | null>(null);
  const [working, setWorking] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [assigningTable, setAssigningTable] = useState<string | null>(null);

  const alreadyRegisteredIds = new Set(registrations.map((r) => r.player.id));

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

  const assignTable = async (matchId: string, tableId: string) => {
    setAssigningTable(matchId);
    try {
      await apiPost(`/api/matches/${matchId}/assign-table`, { tableId });
      toast.success('Table attribuée');
      router.refresh();
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : 'Erreur');
    } finally {
      setAssigningTable(null);
    }
  };

  // Stats paiement
  const paid = registrations.filter((r) => r.paymentStatus === 'paid').length;
  const present = registrations.filter((r) => r.checkinStatus === 'P').length;

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
          <Link href={`/progression/${bracketId}`} className="btn-secondary text-sm">
            Voir progression
          </Link>
        </div>
      </div>

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

      {/* Pool matches with table assignment */}
      {poolsGrouped.size > 0 && (
        <div className="space-y-4">
          <h2 className="font-heading text-xl uppercase tracking-wide">Matches de poule</h2>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {[...poolsGrouped.entries()].map(([poolNum, pMatches]) => (
              <div key={poolNum} className="card rounded-xl p-4">
                <h3 className="font-heading text-sm uppercase tracking-wider mb-3 text-primary">
                  Poule {poolNum}
                </h3>
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
                      <div className="shrink-0">
                        {m.table ? (
                          <span className="bg-primary/10 text-primary text-xs px-2 py-0.5 rounded">
                            T{m.table.number}
                          </span>
                        ) : m.status !== 'finished' && availableTables.length > 0 ? (
                          <select
                            className="text-xs border border-border rounded px-1 py-0.5 bg-bg"
                            value=""
                            disabled={assigningTable === m.id}
                            onChange={(e) => {
                              if (e.target.value) assignTable(m.id, e.target.value);
                            }}
                          >
                            <option value="">Table…</option>
                            {availableTables.map((t) => (
                              <option key={t.id} value={t.id}>
                                T{t.number} ({t.room.name})
                              </option>
                            ))}
                          </select>
                        ) : null}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Elimination matches */}
      {elimMatches.length > 0 && (
        <div className="mt-6 space-y-4">
          <h2 className="font-heading text-xl uppercase tracking-wide">Élimination directe</h2>
          <div className="card overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-xs uppercase tracking-widest text-foreground-muted">
                <tr className="border-b border-border">
                  <th className="text-left py-2">Tour</th>
                  <th className="text-left py-2">Joueur 1</th>
                  <th className="text-left py-2">Joueur 2</th>
                  <th className="text-center py-2">Score</th>
                  <th className="text-center py-2">Table</th>
                </tr>
              </thead>
              <tbody>
                {elimMatches.map((m) => (
                  <tr key={m.id} className="border-b border-border hover:bg-bg-alt">
                    <td className="py-2 text-foreground-muted">{m.roundName}</td>
                    <td className={`py-2 ${m.winnerId === m.player1?.id ? 'font-bold' : ''}`}>
                      {m.player1 ? `${m.player1.lastName} ${m.player1.firstName}` : 'TBD'}
                    </td>
                    <td className={`py-2 ${m.winnerId === m.player2?.id ? 'font-bold' : ''}`}>
                      {m.player2 ? `${m.player2.lastName} ${m.player2.firstName}` : 'TBD'}
                    </td>
                    <td className="py-2 text-center tabular">
                      {m.setsP1 != null ? `${m.setsP1}-${m.setsP2}` : '—'}
                    </td>
                    <td className="py-2 text-center">
                      {m.table ? (
                        <span className="bg-primary/10 text-primary text-xs px-2 py-0.5 rounded">
                          T{m.table.number}
                        </span>
                      ) : m.status !== 'finished' && availableTables.length > 0 ? (
                        <select
                          className="text-xs border border-border rounded px-1 py-0.5 bg-bg"
                          value=""
                          disabled={assigningTable === m.id}
                          onChange={(e) => {
                            if (e.target.value) assignTable(m.id, e.target.value);
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
