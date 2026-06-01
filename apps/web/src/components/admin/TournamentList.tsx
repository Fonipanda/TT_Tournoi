'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { TournamentFormModal, type TournamentForm } from './TournamentFormModal';
import { ConfirmDialog } from '@/components/ui/modal';
import { toast } from '@/components/ui/toast';
import { apiDelete, ApiError } from '@/lib/api-client';

interface Tournament {
  id: string;
  name: string;
  date: string;
  location: string;
  isActive: boolean;
  _count: { brackets: number };
}

export function TournamentList({ tournaments }: { tournaments: Tournament[] }) {
  const router = useRouter();
  const [createOpen, setCreateOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [editing, setEditing] = useState<TournamentForm | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<Tournament | null>(null);

  const onEdit = (t: Tournament) => {
    setEditing({
      id: t.id,
      name: t.name,
      date: t.date,
      location: t.location,
      isActive: t.isActive,
    });
    setEditOpen(true);
  };

  const onDelete = async () => {
    if (!confirmDelete) return;
    try {
      await apiDelete(`/api/tournaments/${confirmDelete.id}`);
      toast.success('Tournoi supprimé');
      router.refresh();
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : 'Erreur');
    } finally {
      setConfirmDelete(null);
    }
  };

  return (
    <>
      <div className="flex items-center justify-between mb-6">
        <h1 className="font-heading text-3xl uppercase tracking-wide">Tournois</h1>
        <button
          type="button"
          onClick={() => setCreateOpen(true)}
          className="btn-primary text-sm"
          data-testid="new-tournament"
        >
          + Nouveau tournoi
        </button>
      </div>

      <div className="card overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="text-xs uppercase tracking-widest text-foreground-muted">
            <tr className="border-b border-border">
              <th className="text-left py-2">Nom</th>
              <th className="text-left py-2">Date</th>
              <th className="text-left py-2">Lieu</th>
              <th className="text-center py-2">Tableaux</th>
              <th className="text-center py-2">Statut</th>
              <th className="text-right py-2">Actions</th>
            </tr>
          </thead>
          <tbody>
            {tournaments.map((t) => (
              <tr key={t.id} className="border-b border-border hover:bg-bg-alt">
                <td className="py-2 font-medium">{t.name}</td>
                <td className="py-2 text-foreground-muted">{t.date || '—'}</td>
                <td className="py-2 text-foreground-muted">{t.location || '—'}</td>
                <td className="py-2 text-center tabular">{t._count.brackets}</td>
                <td className="py-2 text-center">
                  <span
                    className={`text-xs px-2 py-1 ${
                      t.isActive
                        ? 'bg-success-soft text-success'
                        : 'bg-bg-alt text-foreground-subtle'
                    }`}
                  >
                    {t.isActive ? 'Actif' : 'Archivé'}
                  </span>
                </td>
                <td className="py-2 text-right space-x-2">
                  <button
                    type="button"
                    onClick={() => onEdit(t)}
                    className="text-primary text-sm hover:underline"
                    data-testid={`edit-${t.id}`}
                  >
                    Éditer
                  </button>
                  <Link
                    href={`/admin/tableaux?tournamentId=${t.id}`}
                    className="text-primary text-sm hover:underline"
                  >
                    Tableaux →
                  </Link>
                  <button
                    type="button"
                    onClick={() => setConfirmDelete(t)}
                    className="text-danger text-sm hover:underline"
                    data-testid={`delete-${t.id}`}
                  >
                    Supprimer
                  </button>
                </td>
              </tr>
            ))}
            {tournaments.length === 0 && (
              <tr>
                <td colSpan={6} className="py-6 text-center text-foreground-muted">
                  Aucun tournoi. Cliquez « + Nouveau tournoi » pour commencer.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <TournamentFormModal open={createOpen} onClose={() => setCreateOpen(false)} />
      {editing && (
        <TournamentFormModal
          open={editOpen}
          onClose={() => {
            setEditOpen(false);
            setEditing(null);
          }}
          initial={editing}
        />
      )}

      <ConfirmDialog
        open={!!confirmDelete}
        title="Supprimer le tournoi ?"
        message={
          <>
            <p>
              Le tournoi <strong>{confirmDelete?.name}</strong> et tous ses tableaux/matchs
              associés seront <strong>définitivement supprimés</strong>.
            </p>
            <p className="mt-2 text-danger">Cette action est irréversible.</p>
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
