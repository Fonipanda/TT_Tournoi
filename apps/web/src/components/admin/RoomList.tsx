'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { RoomFormModal, TableFormModal, type RoomForm, type TableForm } from './RoomFormModal';
import { ConfirmDialog } from '@/components/ui/modal';
import { toast } from '@/components/ui/toast';
import { apiDelete, apiPatch, ApiError } from '@/lib/api-client';

interface Table {
  id: string;
  number: number;
  status: string;
  x: number;
  y: number;
  rotation: number;
}

interface Room {
  id: string;
  name: string;
  description: string | null;
  width: number;
  height: number;
  isActive: boolean;
  tables: Table[];
}

interface Tournament {
  id: string;
  name: string;
}

export function RoomList({
  rooms,
  tournaments,
  showInactive,
}: {
  rooms: Room[];
  tournaments: Tournament[];
  showInactive?: boolean;
}) {
  const router = useRouter();
  const [createRoomOpen, setCreateRoomOpen] = useState(false);
  const [editingRoom, setEditingRoom] = useState<RoomForm | null>(null);
  const [createTableFor, setCreateTableFor] = useState<{ roomId: string; nextNumber: number } | null>(null);
  const [editingTable, setEditingTable] = useState<TableForm | null>(null);
  const [confirmDeleteRoom, setConfirmDeleteRoom] = useState<Room | null>(null);
  const [confirmDeleteTable, setConfirmDeleteTable] = useState<Table | null>(null);

  const allTableNumbers = rooms.flatMap((r) => r.tables.map((t) => t.number));
  const nextTableNumber = (allTableNumbers.length ? Math.max(...allTableNumbers) : 0) + 1;

  const reactivate = async (room: Room) => {
    try {
      await apiPatch(`/api/rooms/${room.id}`, { isActive: true });
      toast.success(`Salle ${room.name} réactivée`);
      router.refresh();
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : 'Erreur');
    }
  };

  const onDeleteRoom = async () => {
    if (!confirmDeleteRoom) return;
    try {
      await apiDelete(`/api/rooms/${confirmDeleteRoom.id}`);
      toast.success('Salle désactivée');
      router.refresh();
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : 'Erreur');
    } finally {
      setConfirmDeleteRoom(null);
    }
  };

  const onDeleteTable = async () => {
    if (!confirmDeleteTable) return;
    try {
      await apiDelete(`/api/tables/${confirmDeleteTable.id}`);
      toast.success('Table supprimée');
      router.refresh();
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : 'Erreur');
    } finally {
      setConfirmDeleteTable(null);
    }
  };

  const tournamentId = tournaments[0]?.id;

  return (
    <>
      <div className="flex items-center justify-between mb-6">
        <h1 className="font-heading text-3xl uppercase tracking-wide">Salles &amp; tables</h1>
        <div className="flex items-center gap-3">
          <Link
            href={showInactive ? '/admin/salles' : '/admin/salles?inactive=1'}
            className="text-sm text-foreground-muted hover:text-foreground"
          >
            {showInactive ? '✓ Inclure désactivées' : 'Afficher désactivées'}
          </Link>
          <button
            type="button"
            onClick={() => setCreateRoomOpen(true)}
            className="btn-primary text-sm rounded-full"
            data-testid="new-room"
            disabled={!tournamentId}
          >
            + Nouvelle salle
          </button>
        </div>
      </div>

      {!tournamentId && (
        <div className="card border-warning bg-warning-soft text-warning mb-4">
          ⚠ Crée d'abord un tournoi avant d'ajouter des salles.
        </div>
      )}

      <div className="space-y-4">
        {rooms.map((r) => (
          <div
            key={r.id}
            className={`card rounded-2xl ${!r.isActive ? 'opacity-60 border-warning' : ''}`}
            data-testid={`room-${r.id}`}
          >
            <div className="flex items-start justify-between mb-3 gap-3 flex-wrap">
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="font-heading text-2xl uppercase tracking-wide">{r.name}</h2>
                  {!r.isActive && (
                    <span className="text-xs bg-warning-soft text-warning px-2 py-0.5 rounded-full">
                      Désactivée
                    </span>
                  )}
                </div>
                {r.description && (
                  <p className="text-sm text-foreground-muted mt-1">{r.description}</p>
                )}
                <p className="text-xs text-foreground-subtle mt-1">
                  {r.tables.length} tables · {r.width}×{r.height}px
                </p>
              </div>
              <div className="flex gap-2 flex-wrap">
                {r.isActive ? (
                  <>
                    <Link
                      href={`/admin/salles/${r.id}`}
                      className="btn-secondary text-sm rounded-full"
                      title="Édition canvas drag & drop"
                    >
                      Éditeur visuel →
                    </Link>
                    <button
                      type="button"
                      onClick={() => setCreateTableFor({ roomId: r.id, nextNumber: nextTableNumber })}
                      className="btn-secondary text-sm rounded-full"
                    >
                      + Table
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        setEditingRoom({
                          id: r.id,
                          name: r.name,
                          description: r.description ?? '',
                          width: r.width,
                          height: r.height,
                        })
                      }
                      className="btn-secondary text-sm rounded-full"
                    >
                      Éditer
                    </button>
                    <button
                      type="button"
                      onClick={() => setConfirmDeleteRoom(r)}
                      className="text-sm text-danger hover:underline px-2"
                    >
                      Désactiver
                    </button>
                  </>
                ) : (
                  <button
                    type="button"
                    onClick={() => reactivate(r)}
                    className="btn-primary text-sm rounded-full"
                    data-testid={`reactivate-${r.id}`}
                  >
                    ↻ Réactiver
                  </button>
                )}
              </div>
            </div>
            <div className="grid grid-cols-3 sm:grid-cols-5 lg:grid-cols-8 gap-2">
              {r.tables.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() =>
                    setEditingTable({
                      id: t.id,
                      roomId: r.id,
                      number: t.number,
                      x: t.x,
                      y: t.y,
                      rotation: t.rotation,
                    })
                  }
                  className={`p-2 text-center text-xs font-medium ${
                    t.status === 'occupied'
                      ? 'bg-danger-soft text-danger border border-danger'
                      : t.status === 'maintenance'
                        ? 'bg-warning-soft text-warning border border-warning'
                        : 'bg-success-soft text-success border border-success'
                  } hover:opacity-80`}
                  data-testid={`table-${t.number}`}
                >
                  T{t.number}
                </button>
              ))}
              {r.tables.length === 0 && (
                <p className="col-span-full text-foreground-muted text-sm py-2">
                  Aucune table. Cliquez « + Table » pour en ajouter.
                </p>
              )}
            </div>
          </div>
        ))}
        {rooms.length === 0 && tournamentId && (
          <p className="text-foreground-muted card text-center py-8">
            Aucune salle. Cliquez « + Nouvelle salle » pour commencer.
          </p>
        )}
      </div>

      {tournamentId && (
        <RoomFormModal
          open={createRoomOpen}
          onClose={() => setCreateRoomOpen(false)}
          tournamentId={tournamentId}
        />
      )}
      {editingRoom && (
        <RoomFormModal
          open={!!editingRoom}
          onClose={() => setEditingRoom(null)}
          initial={editingRoom}
        />
      )}
      {createTableFor && (
        <TableFormModal
          open={!!createTableFor}
          onClose={() => setCreateTableFor(null)}
          roomId={createTableFor.roomId}
          defaultNumber={createTableFor.nextNumber}
        />
      )}
      {editingTable && (
        <TableFormModal
          open={!!editingTable}
          onClose={() => setEditingTable(null)}
          roomId={editingTable.roomId}
          initial={editingTable}
        />
      )}

      <ConfirmDialog
        open={!!confirmDeleteRoom}
        title="Désactiver la salle ?"
        message={
          <>
            La salle <strong>{confirmDeleteRoom?.name}</strong> sera désactivée et ses{' '}
            <strong>{confirmDeleteRoom?.tables.length ?? 0} tables seront supprimées</strong>{' '}
            (les numéros de tables seront libérés et pourront être réutilisés). La salle
            elle-même reste réactivable plus tard.
          </>
        }
        confirmLabel="Désactiver"
        danger
        onConfirm={onDeleteRoom}
        onCancel={() => setConfirmDeleteRoom(null)}
      />
      <ConfirmDialog
        open={!!confirmDeleteTable}
        title="Supprimer la table ?"
        message={
          <>
            La table <strong>T{confirmDeleteTable?.number}</strong> sera supprimée
            définitivement.
          </>
        }
        confirmLabel="Supprimer"
        danger
        onConfirm={onDeleteTable}
        onCancel={() => setConfirmDeleteTable(null)}
      />
    </>
  );
}
