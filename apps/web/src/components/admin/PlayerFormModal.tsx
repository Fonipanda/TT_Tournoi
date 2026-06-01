'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Modal } from '@/components/ui/modal';
import { TextField, NumberField } from '@/components/ui/fields';
import { toast } from '@/components/ui/toast';
import { apiPatch, apiPost, apiGet, ApiError } from '@/lib/api-client';

export interface PlayerForm {
  id?: string;
  firstName: string;
  lastName: string;
  licenseNumber?: string;
  ranking?: string;
  points?: number;
  club?: string;
  email?: string;
  phone?: string;
  isActive?: boolean;
}

interface Props {
  open: boolean;
  onClose: () => void;
  initial?: PlayerForm;
}

export function PlayerFormModal({ open, onClose, initial }: Props) {
  const router = useRouter();
  const isEdit = !!initial?.id;
  const [submitting, setSubmitting] = useState(false);
  const [looking, setLooking] = useState(false);
  const [form, setForm] = useState<PlayerForm>(
    initial ?? { firstName: '', lastName: '', points: 500 },
  );

  const update = <K extends keyof PlayerForm>(key: K, value: PlayerForm[K]) =>
    setForm((f) => ({ ...f, [key]: value }));

  const fftt = async () => {
    if (!form.licenseNumber || !/^\d{6,10}$/.test(form.licenseNumber)) {
      toast.error('Numéro de licence invalide');
      return;
    }
    setLooking(true);
    try {
      const data = await apiGet<{ nom: string; prenom: string; points: number; club: string | null }>(
        `/api/fftt/lookup/${form.licenseNumber}`,
      );
      setForm((f) => ({
        ...f,
        firstName: data.prenom,
        lastName: data.nom,
        points: data.points,
        club: data.club ?? '',
      }));
      toast.success(`Joueur trouvé : ${data.prenom} ${data.nom}`);
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : 'Lookup FFTT échoué');
    } finally {
      setLooking(false);
    }
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const payload = {
        ...form,
        licenseNumber: form.licenseNumber || undefined,
      };
      if (isEdit) {
        await apiPatch(`/api/players/${initial!.id}`, payload);
        toast.success('Joueur mis à jour');
      } else {
        await apiPost('/api/players', payload);
        toast.success('Joueur créé');
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
    <Modal open={open} onClose={onClose} title={isEdit ? 'Modifier le joueur' : 'Nouveau joueur'} size="md">
      <form onSubmit={submit} className="space-y-4" data-testid="player-form">
        {!isEdit && (
          <div className="card bg-bg-alt p-3">
            <p className="text-xs uppercase tracking-widest text-foreground-muted mb-2">
              Pré-remplir depuis FFTT
            </p>
            <div className="flex gap-2">
              <TextField
                value={form.licenseNumber ?? ''}
                onChange={(e) => update('licenseNumber', e.target.value.replace(/\D/g, ''))}
                placeholder="N° de licence (ex: 7711100001)"
                className="flex-1"
                inputMode="numeric"
                maxLength={10}
              />
              <button
                type="button"
                onClick={fftt}
                disabled={looking || !form.licenseNumber}
                className="btn-secondary text-sm whitespace-nowrap disabled:opacity-50"
                data-testid="fftt-lookup"
              >
                {looking ? '…' : 'Rechercher'}
              </button>
            </div>
          </div>
        )}

        <div className="grid grid-cols-2 gap-3">
          <TextField
            label="Prénom"
            required
            value={form.firstName}
            onChange={(e) => update('firstName', e.target.value)}
          />
          <TextField
            label="Nom"
            required
            value={form.lastName}
            onChange={(e) => update('lastName', e.target.value.toUpperCase())}
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <TextField
            label="Licence"
            value={form.licenseNumber ?? ''}
            onChange={(e) => update('licenseNumber', e.target.value)}
            placeholder="7711100001"
            disabled={isEdit}
            helper={isEdit ? 'Non modifiable' : undefined}
          />
          <NumberField
            label="Points"
            value={form.points ?? 500}
            onChange={(e) => update('points', Number(e.target.value))}
            min={0}
            step={1}
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <TextField
            label="Club"
            value={form.club ?? ''}
            onChange={(e) => update('club', e.target.value)}
            placeholder="Chelles TT"
          />
          <TextField
            label="Classement (optionnel)"
            value={form.ranking ?? ''}
            onChange={(e) => update('ranking', e.target.value)}
            placeholder="N5"
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <TextField
            label="Email"
            type="email"
            value={form.email ?? ''}
            onChange={(e) => update('email', e.target.value)}
          />
          <TextField
            label="Téléphone (pour SMS)"
            type="tel"
            value={form.phone ?? ''}
            onChange={(e) => update('phone', e.target.value)}
            placeholder="+33612345678"
            helper="Format international (+33...)"
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
            data-testid="submit-player"
          >
            {submitting ? '…' : isEdit ? 'Enregistrer' : 'Créer'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
