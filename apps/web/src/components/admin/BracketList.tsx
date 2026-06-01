'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { BracketFormModal, type BracketForm } from './BracketFormModal';
import { ConfirmDialog } from '@/components/ui/modal';
import { toast } from '@/components/ui/toast';
import { apiDelete, apiPost, ApiError } from '@/lib/api-client';

interface Bracket {
  id: string;
  tournamentId: string;
  name: string;
  category: string;
  startTime: string | null;
  day: string | null;
  poolQualifiers: number;
  isActive: boolean;
  tournament: { name: string };
  _count: { matches: number; registrations: number };
}

interface Tournament {
  id: string;
  name: string;
}

interface Props {
  brackets: Bracket[];
  tournaments: Tournament[];
  selectedTournamentId?: string;
}

export function BracketList({ brackets, tournaments, selectedTournamentId }: Props) {
  const router = useRouter();
  const [createOpen, setCreateOpen] = useState(false);
  const [editing, setEditing] = useState<BracketForm | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<Bracket | null>(null);
  const [working, setWorking] = useState<string | null>(null);

  const defaultTournamentId =
    selectedTournamentId ?? tournaments[0]?.id ?? '';

  const onEdit = (b: Bracket) => {
    setEditing({
      id: b.id,
      tournamentId: b.tournamentId,
      name: b.name,
      category: b.category,
      day: b.day ?? '',
      startTime: b.startTime ?? '',
      poolQualifiers: b.poolQualifiers,
    });
  };

  const onDelete = async () => {
    if (!confirmDelete) return;
    try {
      await apiDelete(`/api/brackets/${confirmDelete.id}`);
      toast.success('Tableau supprimé');
      router.refresh();
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : 'Erreur');
    } finally {
      setConfirmDelete(null);
    }
  };

  const generatePools = async (b: Bracket) => {
    setWorking(`pools-${b.id}`);
    try {
      const r = await apiPost<{ poolsCreated: number; matchesCreated: number }>(
        `/api/brackets/${b.id}/generate-pools`,
      );
      toast.success(`${r.poolsCreated} poules · ${r.matchesCreated} matches créés`);
      router.refresh();
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : 'Erreur');
    } finally {
      setWorking(null);
    }
  };

  const generateElimination = async (b: Bracket) => {
    setWorking(`elim-${b.id}`);
    try {
      const r = await apiPost<{ matchesCreated: number; rounds: number }>(
        `/api/brackets/${b.id}/generate-elimination`,
      );
      toast.success(`Élimination : ${r.rounds} rounds · ${r.matchesCreated} matches`);
      router.refresh();
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : 'Erreur');
    } finally {
      setWorking(null);
    }
  };

  return (
    <>
      <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
        <h1 className="font-heading text-3xl uppercase tracking-wide">Tableaux</h1>
        <div className="flex items-center gap-3">
          {tournaments.length > 0 && (
            <select
              value={selectedTournamentId ?? ''}
              onChange={(e) => {
                const url = e.target.value
                  ? `/admin/tableaux?tournamentId=${e.target.value}`
                  : '/admin/tableaux';
                router.push(url);
              }}
              className="input text-sm py-1"
              data-testid="filter-tournament"
            >
              <option value="">— Tous les tournois —</option>
              {tournaments.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
          )}
          {defaultTournamentId && (
            <button
              type="button"
              onClick={() => setCreateOpen(true)}
              className="btn-primary text-sm"
              data-testid="new-bracket"
            >
              + Nouveau tableau
            </button>
          )}
        </div>
      </div>

      <div className="card overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="text-xs uppercase tracking-widest text-foreground-muted">
            <tr className="border-b border-border">
              <th className="text-left py-2">Tournoi</th>
              <th className="text-left py-2">Tableau</th>
              <th className="text-left py-2">Catégorie</th>
              <th className="text-center py-2">Inscrits</th>
              <th className="text-center py-2">Matches</th>
              <th className="text-right py-2">Actions</th>
            </tr>
          </thead>
          <tbody>
            {brackets.map((b) => (
              <tr key={b.id} className="border-b border-border hover:bg-bg-alt">
                <td className="py-2 text-foreground-muted">{b.tournament.name}</td>
                <td className="py-2 font-medium">{b.name}</td>
                <td className="py-2 text-foreground-muted">{b.category}</td>
                <td className="py-2 text-center tabular">{b._count.registrations}</td>
                <td className="py-2 text-center tabular">{b._count.matches}</td>
                <td className="py-2 text-right space-x-2 whitespace-nowrap">
                  <Link
                    href={`/admin/tableaux/${b.id}`}
                    className="text-primary text-xs hover:underline"
                    title="Inscrits + génération"
                  >
                    Inscrits
                  </Link>
                  <button
                    type="button"
                    onClick={() => onEdit(b)}
                    className="text-primary text-xs hover:underline"
                    data-testid={`edit-bracket-${b.id}`}
                  >
                    Éditer
                  </button>
                  <button
                    type="button"
                    onClick={() => generatePools(b)}
                    disabled={working === `pools-${b.id}`}
                    className="text-primary text-xs hover:underline disabled:opacity-50"
                    title="Génère les poules selon FFTT I.301-303"
                  >
                    Poules
                  </button>
                  <button
                    type="button"
                    onClick={() => generateElimination(b)}
                    disabled={working === `elim-${b.id}`}
                    className="text-primary text-xs hover:underline disabled:opacity-50"
                    title="Génère le tableau d'élimination directe"
                  >
                    Élimination
                  </button>
                  <Link
                    href={`/progression/${b.id}`}
                    className="text-primary text-xs hover:underline"
                  >
                    Voir
                  </Link>
                  <button
                    type="button"
                    onClick={() => setConfirmDelete(b)}
                    className="text-danger text-xs hover:underline"
                  >
                    Suppr.
                  </button>
                </td>
              </tr>
            ))}
            {brackets.length === 0 && (
              <tr>
                <td colSpan={6} className="py-6 text-center text-foreground-muted">
                  {tournaments.length === 0
                    ? "Aucun tournoi. Créez d'abord un tournoi."
                    : 'Aucun tableau pour ce tournoi.'}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {defaultTournamentId && (
        <BracketFormModal
          open={createOpen}
          onClose={() => setCreateOpen(false)}
          tournamentId={defaultTournamentId}
        />
      )}
      {editing && (
        <BracketFormModal
          open={!!editing}
          onClose={() => setEditing(null)}
          tournamentId={editing.tournamentId}
          initial={editing}
        />
      )}
      <ConfirmDialog
        open={!!confirmDelete}
        title="Supprimer le tableau ?"
        message={
          <>
            Le tableau <strong>{confirmDelete?.name}</strong> et tous ses matchs/inscriptions
            seront supprimés. Cette action est irréversible.
          </>
        }
        confirmLabel="Supprimer"
        danger
        onConfirm={onDelete}
        onCancel={() => setConfirmDelete(null)}
      />
    </>
  );
}
