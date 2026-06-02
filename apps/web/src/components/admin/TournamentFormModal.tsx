'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Modal } from '@/components/ui/modal';
import { TextField, TextAreaField, CheckboxField } from '@/components/ui/fields';
import { toast } from '@/components/ui/toast';
import { apiPatch, apiPost, ApiError } from '@/lib/api-client';

export interface TournamentForm {
  id?: string;
  name: string;
  description?: string;
  date?: string;
  startDate?: string;
  endDate?: string;
  location?: string;
  contact?: string;
  hours?: string;
  assoConnectUrl?: string;
  publicUrl?: string;
  smsAutoOnTableAssigned?: boolean;
  smsAutoOnMatchCreated?: boolean;
  smsAutoOnResult?: boolean;
  isActive?: boolean;
}

interface Props {
  open: boolean;
  onClose: () => void;
  initial?: TournamentForm;
}

function toIsoOrUndef(s?: string): string | undefined {
  if (!s) return undefined;
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) return undefined;
  return d.toISOString();
}

export function TournamentFormModal({ open, onClose, initial }: Props) {
  const router = useRouter();
  const isEdit = !!initial?.id;
  const [submitting, setSubmitting] = useState(false);

  const [form, setForm] = useState<TournamentForm>(
    initial ?? {
      name: '',
      date: '',
      location: '',
      contact: '',
      hours: '',
      smsAutoOnTableAssigned: true,
    },
  );

  const update = <K extends keyof TournamentForm>(key: K, value: TournamentForm[K]) =>
    setForm((f) => ({ ...f, [key]: value }));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const payload = {
        ...form,
        startDate: toIsoOrUndef(form.startDate),
        endDate: toIsoOrUndef(form.endDate),
      };
      if (isEdit) {
        await apiPatch(`/api/tournaments/${initial!.id}`, payload);
        toast.success('Tournoi mis à jour');
      } else {
        await apiPost('/api/tournaments', payload);
        toast.success('Tournoi créé');
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
    <Modal open={open} onClose={onClose} title={isEdit ? 'Modifier le tournoi' : 'Nouveau tournoi'} size="lg">
      <form onSubmit={submit} className="space-y-4" data-testid="tournament-form">
        <TextAreaField
          label="Nom du tournoi"
          required
          value={form.name}
          onChange={(e) => update('name', e.target.value)}
          placeholder="Tournoi Open de Chelles 2026"
          rows={2}
          className="!min-h-[60px]"
          helper="Peut tenir sur 2 lignes (titre long ou multiligne)"
        />

        <div className="grid grid-cols-2 gap-3">
          <TextField
            label="Date (libellé public)"
            value={form.date ?? ''}
            onChange={(e) => update('date', e.target.value)}
            placeholder="23-24 mars 2026"
            helper="Affichage libre sur la page d'accueil"
          />
          <TextField
            label="Lieu"
            value={form.location ?? ''}
            onChange={(e) => update('location', e.target.value)}
            placeholder="Gymnase de Chelles, 77500"
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <TextField
            label="Date début (technique)"
            type="datetime-local"
            value={form.startDate ?? ''}
            onChange={(e) => update('startDate', e.target.value)}
          />
          <TextField
            label="Date fin (technique)"
            type="datetime-local"
            value={form.endDate ?? ''}
            onChange={(e) => update('endDate', e.target.value)}
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <TextField
            label="Horaires (libre)"
            value={form.hours ?? ''}
            onChange={(e) => update('hours', e.target.value)}
            placeholder="Sam 8h-19h, Dim 9h-18h"
          />
          <TextField
            label="Contact"
            value={form.contact ?? ''}
            onChange={(e) => update('contact', e.target.value)}
            placeholder="contact@chellestt.fr"
          />
        </div>

        <TextAreaField
          label="Description"
          value={form.description ?? ''}
          onChange={(e) => update('description', e.target.value)}
          placeholder="Tournoi homologué FFTT, ouvert à tous les licenciés…"
        />

        <div className="grid grid-cols-2 gap-3">
          <TextField
            label="URL inscription externe (HelloAsso)"
            type="url"
            value={form.assoConnectUrl ?? ''}
            onChange={(e) => update('assoConnectUrl', e.target.value)}
            placeholder="https://www.helloasso.com/..."
          />
          <TextField
            label="URL publique"
            type="url"
            value={form.publicUrl ?? ''}
            onChange={(e) => update('publicUrl', e.target.value)}
            placeholder="https://tournoi-chellestt.fr"
          />
        </div>

        <fieldset className="border border-border p-3">
          <legend className="text-sm font-medium px-2">Notifications SMS automatiques</legend>
          <div className="space-y-2 mt-2">
            <CheckboxField
              label="Sur attribution de table"
              checked={form.smsAutoOnTableAssigned ?? false}
              onChange={(e) => update('smsAutoOnTableAssigned', e.target.checked)}
            />
            <CheckboxField
              label="Sur création de match"
              checked={form.smsAutoOnMatchCreated ?? false}
              onChange={(e) => update('smsAutoOnMatchCreated', e.target.checked)}
            />
            <CheckboxField
              label="Sur résultat de match"
              checked={form.smsAutoOnResult ?? false}
              onChange={(e) => update('smsAutoOnResult', e.target.checked)}
            />
          </div>
        </fieldset>

        {isEdit && (
          <CheckboxField
            label="Tournoi actif"
            helper="Désactiver pour archiver (sans supprimer les données)"
            checked={form.isActive ?? true}
            onChange={(e) => update('isActive', e.target.checked)}
          />
        )}

        <div className="flex gap-2 justify-end pt-3 border-t border-border">
          <button type="button" onClick={onClose} className="btn-secondary text-sm">
            Annuler
          </button>
          <button
            type="submit"
            disabled={submitting}
            className="btn-primary text-sm disabled:opacity-50"
            data-testid="submit-tournament"
          >
            {submitting ? '…' : isEdit ? 'Enregistrer' : 'Créer'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
