'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Modal } from '@/components/ui/modal';
import { TextField, NumberField, TextAreaField } from '@/components/ui/fields';
import { toast } from '@/components/ui/toast';
import { apiPatch, apiPost, ApiError } from '@/lib/api-client';

export interface RoomForm {
  id?: string;
  tournamentId?: string;
  name: string;
  description?: string;
  width?: number;
  height?: number;
}

interface Props {
  open: boolean;
  onClose: () => void;
  tournamentId?: string;
  initial?: RoomForm;
}

export function RoomFormModal({ open, onClose, tournamentId, initial }: Props) {
  const router = useRouter();
  const isEdit = !!initial?.id;
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState<RoomForm>(
    initial ?? {
      tournamentId,
      name: '',
      description: '',
      width: 900,
      height: 550,
    },
  );

  const update = <K extends keyof RoomForm>(key: K, value: RoomForm[K]) =>
    setForm((f) => ({ ...f, [key]: value }));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      if (isEdit) {
        await apiPatch(`/api/rooms/${initial!.id}`, form);
        toast.success('Salle mise à jour');
      } else {
        await apiPost('/api/rooms', form);
        toast.success('Salle créée');
      }
      router.refresh();
      onClose();
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : 'Erreur réseau');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={isEdit ? 'Modifier la salle' : 'Nouvelle salle'}
      size="md"
    >
      <form onSubmit={submit} className="space-y-4" data-testid="room-form">
        <TextField
          label="Nom"
          required
          value={form.name}
          onChange={(e) => update('name', e.target.value)}
          placeholder="Salle Principale"
        />
        <TextAreaField
          label="Description"
          value={form.description ?? ''}
          onChange={(e) => update('description', e.target.value)}
          placeholder="6 tables, 200m², chauffée"
        />
        <div className="grid grid-cols-2 gap-3">
          <NumberField
            label="Largeur (px)"
            value={form.width ?? 900}
            onChange={(e) => update('width', Number(e.target.value))}
            min={400}
            max={3000}
            helper="Canvas pour le placement des tables"
          />
          <NumberField
            label="Hauteur (px)"
            value={form.height ?? 550}
            onChange={(e) => update('height', Number(e.target.value))}
            min={300}
            max={2000}
          />
        </div>
        <div className="flex gap-2 justify-end pt-3 border-t border-border">
          <button type="button" onClick={onClose} className="btn-secondary text-sm">
            Annuler
          </button>
          <button
            type="submit"
            disabled={submitting}
            className="btn-primary text-sm disabled:opacity-50"
          >
            {submitting ? '…' : isEdit ? 'Enregistrer' : 'Créer'}
          </button>
        </div>
      </form>
    </Modal>
  );
}

// =============================================================================
// Form Modal Table
// =============================================================================

export interface TableForm {
  id?: string;
  roomId: string;
  number: number;
  x?: number;
  y?: number;
  rotation?: number;
}

interface TableProps {
  open: boolean;
  onClose: () => void;
  roomId: string;
  initial?: TableForm;
  defaultNumber?: number;
}

export function TableFormModal({ open, onClose, roomId, initial, defaultNumber }: TableProps) {
  const router = useRouter();
  const isEdit = !!initial?.id;
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState<TableForm>(
    initial ?? { roomId, number: defaultNumber ?? 1, x: 100, y: 100, rotation: 0 },
  );

  const update = <K extends keyof TableForm>(key: K, value: TableForm[K]) =>
    setForm((f) => ({ ...f, [key]: value }));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      if (isEdit) {
        await apiPatch(`/api/tables/${initial!.id}`, form);
        toast.success('Table mise à jour');
      } else {
        await apiPost('/api/tables', form);
        toast.success('Table créée');
      }
      router.refresh();
      onClose();
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : 'Erreur réseau');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal open={open} onClose={onClose} title={isEdit ? 'Modifier la table' : 'Nouvelle table'} size="sm">
      <form onSubmit={submit} className="space-y-4" data-testid="table-form">
        <NumberField
          label="Numéro de table"
          required
          value={form.number}
          onChange={(e) => update('number', Number(e.target.value))}
          min={1}
          max={999}
          helper="Doit être unique dans tout le tournoi"
        />
        <div className="grid grid-cols-3 gap-3">
          <NumberField
            label="X (px)"
            value={form.x ?? 100}
            onChange={(e) => update('x', Number(e.target.value))}
          />
          <NumberField
            label="Y (px)"
            value={form.y ?? 100}
            onChange={(e) => update('y', Number(e.target.value))}
          />
          <NumberField
            label="Rotation (°)"
            value={form.rotation ?? 0}
            onChange={(e) => update('rotation', Number(e.target.value))}
            step={90}
          />
        </div>
        <p className="text-xs text-foreground-muted">
          Position initiale ; vous pourrez la changer ensuite via drag &amp; drop dans la
          vue salle.
        </p>
        <div className="flex gap-2 justify-end pt-3 border-t border-border">
          <button type="button" onClick={onClose} className="btn-secondary text-sm">
            Annuler
          </button>
          <button
            type="submit"
            disabled={submitting}
            className="btn-primary text-sm disabled:opacity-50"
          >
            {submitting ? '…' : isEdit ? 'Enregistrer' : 'Créer'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
