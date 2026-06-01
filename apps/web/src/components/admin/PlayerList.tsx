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
  bracketNames?: string[];
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

      <div className="card rounded-2xl overflow-x-auto p-0">
        <table className="w-full text-sm">
          <thead className="text-xs uppercase tracking-widest text-foreground-muted bg-bg-alt">
            <tr>
              <th className="text-left px-3 py-3 border-r border-border">Licence</th>
              <th className="text-left px-3 py-3 border-r border-border">Nom</th>
              <th className="text-left px-3 py-3 border-r border-border">Prénom</th>
              <th className="text-left px-3 py-3 border-r border-border">Club</th>
              <th className="text-right px-3 py-3 border-r border-border">Points</th>
              <th className="text-left px-3 py-3 border-r border-border">Téléphone</th>
              <th className="text-left px-3 py-3 border-r border-border">Email</th>
              <th className="text-left px-3 py-3 border-r border-border">Tableaux</th>
              <th className="text-right px-3 py-3">Actions</th>
            </tr>
          </thead>
          <tbody>
            {initial.map((p, idx) => (
              <tr
                key={p.id}
                className={`border-t border-border hover:bg-primary-soft/30 transition-colors ${
                  idx % 2 === 0 ? 'bg-surface' : 'bg-bg-alt/50'
                }`}
              >
                <td className="px-3 py-2 font-mono tabular text-xs border-r border-border">
                  {p.licenseNumber ?? '—'}
                </td>
                <td className="px-3 py-2 font-medium uppercase border-r border-border">
                  {p.lastName}
                </td>
                <td className="px-3 py-2 border-r border-border">{p.firstName}</td>
                <td className="px-3 py-2 text-foreground-muted border-r border-border">
                  {p.club ?? '—'}
                </td>
                <td className="px-3 py-2 text-right tabular font-semibold text-primary border-r border-border">
                  {Math.round(p.points)}
                </td>
                <td className="px-3 py-2 font-mono text-xs text-foreground-muted border-r border-border">
                  {p.phone ?? '—'}
                </td>
                <td
                  className="px-3 py-2 text-xs text-foreground-muted truncate max-w-[200px] border-r border-border"
                  title={p.email}
                >
                  {p.email || '—'}
                </td>
                <td className="px-3 py-2 text-xs border-r border-border">
                  {p.bracketNames && p.bracketNames.length > 0 ? (
                    <div className="flex flex-wrap gap-1">
                      {p.bracketNames.map((b, i) => (
                        <span
                          key={i}
                          className="bg-primary-soft text-primary px-1.5 py-0.5 text-[10px] font-medium rounded-full"
                        >
                          {b}
                        </span>
                      ))}
                    </div>
                  ) : (
                    <span className="text-foreground-subtle">—</span>
                  )}
                </td>
                <td className="px-3 py-2 text-right space-x-2">
                  <button
                    type="button"
                    onClick={() => onEdit(p)}
                    className="text-primary text-xs hover:underline font-medium"
                  >
                    Éditer
                  </button>
                  <button
                    type="button"
                    onClick={() => setConfirmDelete(p)}
                    className="text-danger text-xs hover:underline font-medium"
                  >
                    Désact.
                  </button>
                </td>
              </tr>
            ))}
            {initial.length === 0 && (
              <tr>
                <td colSpan={9} className="py-6 text-center text-foreground-muted">
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
