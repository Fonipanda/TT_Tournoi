'use client';

import { useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { PlayerFormModal, type PlayerForm } from './PlayerFormModal';
import { ConfirmDialog } from '@/components/ui/modal';
import { toast } from '@/components/ui/toast';
import { apiDelete, ApiError } from '@/lib/api-client';

interface Player {
  id: string;
  firstName: string;
  lastName: string;
  licenseNumber: string | null;
  ranking: string | null;
  points: number;
  club: string | null;
  email: string;
  phone: string | null;
  isActive: boolean;
}

export function PlayerList({ players: initial }: { players: Player[] }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [createOpen, setCreateOpen] = useState(false);
  const [editing, setEditing] = useState<PlayerForm | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<Player | null>(null);
  const [search, setSearch] = useState(searchParams.get('search') ?? '');

  const onSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const params = new URLSearchParams(searchParams.toString());
    if (search) params.set('search', search);
    else params.delete('search');
    router.push(`/admin/joueurs?${params.toString()}`);
  };

  const onEdit = (p: Player) => {
    setEditing({
      id: p.id,
      firstName: p.firstName,
      lastName: p.lastName,
      licenseNumber: p.licenseNumber ?? '',
      ranking: p.ranking ?? '',
      points: p.points,
      club: p.club ?? '',
      email: p.email,
      phone: p.phone ?? '',
      isActive: p.isActive,
    });
  };

  const onDelete = async () => {
    if (!confirmDelete) return;
    try {
      await apiDelete(`/api/players/${confirmDelete.id}`);
      toast.success('Joueur désactivé');
      router.refresh();
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : 'Erreur');
    } finally {
      setConfirmDelete(null);
    }
  };

  return (
    <>
      <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
        <h1 className="font-heading text-3xl uppercase tracking-wide">Joueurs</h1>
        <div className="flex items-center gap-3">
          <form onSubmit={onSearchSubmit} className="flex gap-2">
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Recherche nom / licence / club"
              className="input text-sm py-1 w-64"
              data-testid="search-input"
            />
            <button type="submit" className="btn-secondary text-sm">
              🔍
            </button>
          </form>
          <button
            type="button"
            onClick={() => setCreateOpen(true)}
            className="btn-primary text-sm"
            data-testid="new-player"
          >
            + Nouveau joueur
          </button>
        </div>
      </div>

      <div className="card overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="text-xs uppercase tracking-widest text-foreground-muted">
            <tr className="border-b border-border">
              <th className="text-left py-2">Licence</th>
              <th className="text-left py-2">Nom</th>
              <th className="text-left py-2">Prénom</th>
              <th className="text-left py-2">Club</th>
              <th className="text-right py-2">Points</th>
              <th className="text-left py-2">Téléphone</th>
              <th className="text-right py-2">Actions</th>
            </tr>
          </thead>
          <tbody>
            {initial.map((p) => (
              <tr key={p.id} className="border-b border-border hover:bg-bg-alt">
                <td className="py-2 font-mono tabular text-xs">{p.licenseNumber ?? '—'}</td>
                <td className="py-2 font-medium uppercase">{p.lastName}</td>
                <td className="py-2">{p.firstName}</td>
                <td className="py-2 text-foreground-muted">{p.club ?? '—'}</td>
                <td className="py-2 text-right tabular">{Math.round(p.points)}</td>
                <td className="py-2 font-mono text-xs text-foreground-muted">{p.phone ?? '—'}</td>
                <td className="py-2 text-right space-x-2">
                  <button
                    type="button"
                    onClick={() => onEdit(p)}
                    className="text-primary text-xs hover:underline"
                  >
                    Éditer
                  </button>
                  <button
                    type="button"
                    onClick={() => setConfirmDelete(p)}
                    className="text-danger text-xs hover:underline"
                  >
                    Désact.
                  </button>
                </td>
              </tr>
            ))}
            {initial.length === 0 && (
              <tr>
                <td colSpan={7} className="py-6 text-center text-foreground-muted">
                  Aucun joueur. Cliquez « + Nouveau joueur » pour commencer.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <PlayerFormModal open={createOpen} onClose={() => setCreateOpen(false)} />
      {editing && (
        <PlayerFormModal open={!!editing} onClose={() => setEditing(null)} initial={editing} />
      )}
      <ConfirmDialog
        open={!!confirmDelete}
        title="Désactiver ce joueur ?"
        message={
          <>
            Le joueur <strong>{confirmDelete?.lastName} {confirmDelete?.firstName}</strong> sera
            désactivé (soft-delete : ses données et historiques sont conservés).
          </>
        }
        confirmLabel="Désactiver"
        danger
        onConfirm={onDelete}
        onCancel={() => setConfirmDelete(null)}
      />
    </>
  );
}
