'use client';

import { useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { PlayerFormModal, type PlayerForm, type BracketOption, type TournamentOption } from './PlayerFormModal';
import { ConfirmDialog } from '@/components/ui/modal';
import { toast } from '@/components/ui/toast';
import { apiDelete, apiPatch, ApiError } from '@/lib/api-client';

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
  bracketIds?: string[];
}

interface PlayerListProps {
  players: Player[];
  allBrackets?: BracketOption[];
  tournaments?: TournamentOption[];
}

export function PlayerList({
  players: initial,
  allBrackets = [],
  tournaments = [],
}: PlayerListProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [createOpen, setCreateOpen] = useState(false);
  const [editing, setEditing] = useState<PlayerForm | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<Player | null>(null);
  const [confirmHardDelete, setConfirmHardDelete] = useState<Player | null>(null);
  const [search, setSearch] = useState(searchParams.get('search') ?? '');
  const [editingCell, setEditingCell] = useState<{ id: string; field: string } | null>(null);
  const [editValue, setEditValue] = useState('');
  const [editingBrackets, setEditingBrackets] = useState<{ id: string; selected: string[] } | null>(null);

  const startInlineEdit = (playerId: string, field: string, currentValue: string) => {
    setEditingCell({ id: playerId, field });
    setEditValue(currentValue);
  };

  const commitInlineEdit = async () => {
    if (!editingCell) return;
    const { id, field } = editingCell;
    const player = initial.find((p) => p.id === id);
    if (!player) return;
    // Only commit if value changed
    const oldValue = String((player as unknown as Record<string, unknown>)[field] ?? '');
    if (editValue === oldValue) {
      setEditingCell(null);
      return;
    }
    try {
      const patch: Record<string, unknown> = {};
      if (field === 'points') patch[field] = Number(editValue) || 0;
      else patch[field] = editValue;
      await apiPatch(`/api/players/${id}`, patch);
      router.refresh();
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : 'Erreur');
    } finally {
      setEditingCell(null);
    }
  };

  const cancelInlineEdit = () => setEditingCell(null);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') commitInlineEdit();
    else if (e.key === 'Escape') cancelInlineEdit();
  };

  const renderEditableCell = (
    player: Player,
    field: keyof Player,
    value: string,
    className: string,
  ) => {
    const isEditing = editingCell?.id === player.id && editingCell?.field === field;
    if (isEditing) {
      return (
        <td className={className}>
          <input
            autoFocus
            type={field === 'points' ? 'number' : 'text'}
            value={editValue}
            onChange={(e) => setEditValue(e.target.value)}
            onBlur={commitInlineEdit}
            onKeyDown={handleKeyDown}
            className="w-full bg-bg border border-primary rounded px-1 py-0.5 text-sm outline-none"
          />
        </td>
      );
    }
    return (
      <td
        className={`${className} cursor-pointer hover:bg-primary-soft/20`}
        onDoubleClick={() => startInlineEdit(player.id, field, value)}
        title="Double-clic pour éditer"
      >
        {value || '—'}
      </td>
    );
  };

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
      bracketIds: p.bracketIds ?? [],
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

  const onHardDelete = async () => {
    if (!confirmHardDelete) return;
    try {
      await apiDelete(`/api/players/${confirmHardDelete.id}?hard=true`);
      toast.success('Joueur supprimé définitivement');
      router.refresh();
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : 'Erreur');
    } finally {
      setConfirmHardDelete(null);
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
                {renderEditableCell(
                  p,
                  'licenseNumber',
                  p.licenseNumber ?? '',
                  'px-3 py-2 font-mono tabular text-xs border-r border-border',
                )}
                {renderEditableCell(
                  p,
                  'lastName',
                  p.lastName,
                  'px-3 py-2 font-medium uppercase border-r border-border',
                )}
                {renderEditableCell(
                  p,
                  'firstName',
                  p.firstName,
                  'px-3 py-2 border-r border-border',
                )}
                {renderEditableCell(
                  p,
                  'club',
                  p.club ?? '',
                  'px-3 py-2 text-foreground-muted border-r border-border',
                )}
                {renderEditableCell(
                  p,
                  'points',
                  String(Math.round(p.points)),
                  'px-3 py-2 text-right tabular font-semibold text-primary border-r border-border',
                )}
                {renderEditableCell(
                  p,
                  'phone',
                  p.phone ?? '',
                  'px-3 py-2 font-mono text-xs text-foreground-muted border-r border-border',
                )}
                {renderEditableCell(
                  p,
                  'email',
                  p.email || '',
                  'px-3 py-2 text-xs text-foreground-muted truncate max-w-[200px] border-r border-border',
                )}
                <td className="px-3 py-2 text-xs border-r border-border relative">
                  {editingBrackets?.id === p.id ? (
                    <div className="absolute top-0 left-0 z-20 bg-bg border border-border rounded-lg shadow-lg p-2 min-w-[180px]">
                      {allBrackets.map((b) => (
                        <label key={b.id} className="flex items-center gap-1.5 py-0.5 text-xs cursor-pointer hover:bg-bg-alt px-1 rounded">
                          <input
                            type="checkbox"
                            checked={editingBrackets.selected.includes(b.id)}
                            onChange={(e) => {
                              setEditingBrackets((prev) => {
                                if (!prev) return prev;
                                const sel = e.target.checked
                                  ? [...prev.selected, b.id]
                                  : prev.selected.filter((x) => x !== b.id);
                                return { ...prev, selected: sel };
                              });
                            }}
                            className="accent-primary"
                          />
                          {b.name}
                        </label>
                      ))}
                      <div className="flex gap-1 mt-2 border-t border-border pt-2">
                        <button
                          type="button"
                          className="btn-primary text-[10px] px-2 py-0.5 flex-1"
                          onClick={async () => {
                            try {
                              await apiPatch(`/api/players/${p.id}`, { bracketIds: editingBrackets.selected });
                              router.refresh();
                              toast.success('Tableaux mis à jour');
                            } catch (e) {
                              toast.error(e instanceof ApiError ? e.message : 'Erreur');
                            }
                            setEditingBrackets(null);
                          }}
                        >
                          OK
                        </button>
                        <button
                          type="button"
                          className="text-[10px] px-2 py-0.5 border border-border rounded"
                          onClick={() => setEditingBrackets(null)}
                        >
                          Annuler
                        </button>
                      </div>
                    </div>
                  ) : null}
                  <div
                    className="cursor-pointer hover:bg-primary-soft/20 rounded p-0.5 min-h-[20px]"
                    onClick={() => setEditingBrackets({ id: p.id, selected: p.bracketIds ?? [] })}
                    title="Cliquer pour éditer les tableaux"
                  >
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
                  </div>
                </td>
                <td className="px-3 py-2 text-right space-x-2 whitespace-nowrap">
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
                    className="text-warning text-xs hover:underline font-medium"
                    title="Désactivation (réversible)"
                  >
                    Désact.
                  </button>
                  <button
                    type="button"
                    onClick={() => setConfirmHardDelete(p)}
                    className="text-danger text-xs hover:underline font-medium"
                    title="Suppression définitive"
                  >
                    Suppr.
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
        <PlayerFormModal
          open={!!editing}
          onClose={() => setEditing(null)}
          initial={editing}
          brackets={allBrackets}
          tournaments={tournaments}
        />
      )}
      <ConfirmDialog
        open={!!confirmDelete}
        title="Désactiver ce joueur ?"
        message={
          <>
            Le joueur <strong>{confirmDelete?.lastName} {confirmDelete?.firstName}</strong> sera
            désactivé (soft-delete : ses données et historiques sont conservés). Réversible.
          </>
        }
        confirmLabel="Désactiver"
        danger
        onConfirm={onDelete}
        onCancel={() => setConfirmDelete(null)}
      />
      <ConfirmDialog
        open={!!confirmHardDelete}
        title="⚠ Supprimer DÉFINITIVEMENT ?"
        message={
          <>
            <p>
              <strong>
                {confirmHardDelete?.lastName} {confirmHardDelete?.firstName}
              </strong>{' '}
              et toutes ses inscriptions, notifications, matchs seront{' '}
              <strong className="text-danger">supprimés irréversiblement</strong>.
            </p>
            <p className="mt-2 text-danger">Cette action est IRRÉVERSIBLE.</p>
          </>
        }
        confirmLabel="Supprimer définitivement"
        danger
        onConfirm={onHardDelete}
        onCancel={() => setConfirmHardDelete(null)}
      />
    </>
  );
}
