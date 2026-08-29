'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Modal } from '@/components/ui/modal';
import { TextField, NumberField, SelectField } from '@/components/ui/fields';
import { toast } from '@/components/ui/toast';
import { apiPatch, apiPost, ApiError } from '@/lib/api-client';
import {
  formatDotation,
  deriveDotation,
  dotationProfileFromPoints,
  dotationProfileLabel,
  defaultWinnerAmount,
} from '@/lib/dotation';

export interface BracketForm {
  id?: string;
  tournamentId: string;
  name: string;
  category?: string;
  minPoints?: number | null;
  maxPoints?: number | null;
  maxPlayers?: number;
  entryFee?: number;
  day?: string;
  checkinEnd?: string;
  startTime?: string;
  poolQualifiers?: number;
  byePlayers?: string;
  dotationWinner?: number;
  dotationFinalist?: number;
  dotationSemi?: number;
  dotationQuarter?: number;
  prize?: string;
}

interface Props {
  open: boolean;
  onClose: () => void;
  tournamentId: string;
  initial?: BracketForm;
}

export function BracketFormModal({ open, onClose, tournamentId, initial }: Props) {
  const router = useRouter();
  const isEdit = !!initial?.id;
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState<BracketForm>(
    initial ?? {
      tournamentId,
      name: '',
      category: '',
      maxPlayers: 16,
      entryFee: 8,
      poolQualifiers: 2,
      dotationWinner: 0,
      dotationFinalist: 0,
      dotationSemi: 0,
      dotationQuarter: 0,
    },
  );

  const update = <K extends keyof BracketForm>(key: K, value: BracketForm[K]) =>
    setForm((f) => ({ ...f, [key]: value }));

  // Aperçu du texte public, reconstruit à chaque frappe. Le serveur applique
  // la même fonction à l'enregistrement : l'aperçu ne peut pas mentir.
  const dotationRecap = formatDotation({
    winner: form.dotationWinner ?? 0,
    finalist: form.dotationFinalist ?? 0,
    semi: form.dotationSemi ?? 0,
    quarter: form.dotationQuarter ?? 0,
  });

  const profile = dotationProfileFromPoints(form.maxPoints);

  /**
   * Saisir le vainqueur suffit : les trois autres rangs en découlent.
   * Ils restent modifiables ensuite — la dérivation ne se déclenche qu'ici.
   */
  const updateWinner = (winner: number) => {
    const derived = deriveDotation(winner, profile);
    setForm((f) => ({
      ...f,
      dotationWinner: winner,
      dotationFinalist: derived.finalist,
      dotationSemi: derived.semi,
      dotationQuarter: derived.quarter,
    }));
  };

  /**
   * Rétablit la répartition du barème, en écrasant les retouches manuelles.
   * Sans montant saisi, le défaut du profil sert d'amorce : c'est ainsi que
   * la valeur par défaut est proposée sans jamais s'imposer.
   */
  const applyScale = () => {
    const base = form.dotationWinner || defaultWinnerAmount(profile);
    updateWinner(base);
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      // `prize` n'est pas transmis : il est dérivé des montants côté serveur.
      const fields: BracketForm = { ...form };
      delete fields.prize;
      const payload = {
        ...fields,
        minPoints: form.minPoints ?? null,
        maxPoints: form.maxPoints ?? null,
      };
      if (isEdit) {
        await apiPatch(`/api/brackets/${initial!.id}`, payload);
        toast.success('Tableau mis à jour');
      } else {
        await apiPost('/api/brackets', payload);
        toast.success('Tableau créé');
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
      title={isEdit ? 'Modifier le tableau' : 'Nouveau tableau'}
      size="lg"
    >
      <form onSubmit={submit} className="space-y-4" data-testid="bracket-form">
        <div className="grid grid-cols-2 gap-3">
          <TextField
            label="Nom"
            required
            value={form.name}
            onChange={(e) => update('name', e.target.value)}
            placeholder="Tableau A"
          />
          <TextField
            label="Catégorie (libellé public)"
            value={form.category ?? ''}
            onChange={(e) => update('category', e.target.value)}
            placeholder="< 1000 pts"
          />
        </div>

        <div className="grid grid-cols-3 gap-3">
          <NumberField
            label="Points min."
            value={form.minPoints ?? ''}
            onChange={(e) => update('minPoints', e.target.value ? Number(e.target.value) : null)}
            placeholder="500"
          />
          <NumberField
            label="Points max."
            value={form.maxPoints ?? ''}
            onChange={(e) => update('maxPoints', e.target.value ? Number(e.target.value) : null)}
            placeholder="999"
          />
          <NumberField
            label="Inscrits max."
            value={form.maxPlayers ?? 16}
            onChange={(e) => update('maxPlayers', Number(e.target.value))}
            min={2}
            max={256}
          />
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <NumberField
            label="Frais d'inscription (€)"
            value={form.entryFee ?? 0}
            onChange={(e) => update('entryFee', Number(e.target.value))}
            min={0}
            step={0.5}
          />
          <SelectField
            label="Jour"
            value={form.day ?? ''}
            onChange={(e) => update('day', e.target.value)}
            options={[
              { value: '', label: '—' },
              { value: 'Samedi', label: 'Samedi' },
              { value: 'Dimanche', label: 'Dimanche' },
            ]}
          />
          <TextField
            label="Fin de pointage"
            type="time"
            value={form.checkinEnd ?? ''}
            onChange={(e) => update('checkinEnd', e.target.value)}
            helper="Clôture des présences"
          />
          <TextField
            label="Heure début"
            value={form.startTime ?? ''}
            onChange={(e) => update('startTime', e.target.value)}
            placeholder="09:00"
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <NumberField
            label="Qualifiés par poule"
            value={form.poolQualifiers ?? 2}
            onChange={(e) => update('poolQualifiers', Number(e.target.value))}
            min={1}
            max={4}
            helper="2 = 1er + 2ème de chaque poule"
          />
          <TextField
            label="Têtes de série (bye)"
            value={form.byePlayers ?? ''}
            onChange={(e) => update('byePlayers', e.target.value)}
            placeholder="7711100015,7711100016"
            helper="Licences séparées par virgules"
          />
        </div>

        <fieldset className="border border-border p-3">
          <legend className="text-sm font-medium px-2">Dotations (€)</legend>
          <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
            <p className="text-xs text-foreground-muted">
              Barème détecté : <span className="text-foreground">{dotationProfileLabel(profile)}</span>
              {' · '}
              {form.maxPoints == null ? 'sans plafond' : `plafond ${form.maxPoints} pts`}
            </p>
            <button
              type="button"
              onClick={applyScale}
              className="btn-secondary text-xs"
              data-testid="dotation-recompute"
            >
              Recalculer{' '}
              {!form.dotationWinner ? `(défaut ${defaultWinnerAmount(profile)} €)` : ''}
            </button>
          </div>
          <div className="grid grid-cols-4 gap-3 mt-2">
            <NumberField
              label="Vainqueur"
              value={form.dotationWinner ?? 0}
              onChange={(e) => updateWinner(Number(e.target.value))}
              min={0}
              step={0.5}
            />
            <NumberField
              label="Finaliste"
              value={form.dotationFinalist ?? 0}
              onChange={(e) => update('dotationFinalist', Number(e.target.value))}
              min={0}
              step={0.5}
            />
            <NumberField
              label="Demi-finaliste"
              value={form.dotationSemi ?? 0}
              onChange={(e) => update('dotationSemi', Number(e.target.value))}
              min={0}
              step={0.5}
            />
            <NumberField
              label="Quart"
              value={form.dotationQuarter ?? 0}
              onChange={(e) => update('dotationQuarter', Number(e.target.value))}
              min={0}
              step={0.5}
            />
          </div>
          <p className="text-xs text-foreground-muted mt-2">
            Saisir le vainqueur suffit : les trois autres suivent le barème. Ils restent
            modifiables à la main, « Recalculer » rétablit la répartition.
          </p>
          <TextField
            label="Récap dotation (texte affiché)"
            value={dotationRecap}
            readOnly
            tabIndex={-1}
            className="mt-3 bg-bg-alt cursor-default"
            helper="Construit à partir des quatre montants ci-dessus, et affiché tel quel au public."
          />
        </fieldset>

        <div className="flex gap-2 justify-end pt-3 border-t border-border">
          <button type="button" onClick={onClose} className="btn-secondary text-sm">
            Annuler
          </button>
          <button
            type="submit"
            disabled={submitting}
            className="btn-primary text-sm disabled:opacity-50"
            data-testid="submit-bracket"
          >
            {submitting ? '…' : isEdit ? 'Enregistrer' : 'Créer'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
