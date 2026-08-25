'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Modal } from '@/components/ui/modal';
import { TextField, NumberField } from '@/components/ui/fields';
import { toast } from '@/components/ui/toast';
import { apiPatch, apiPost, apiGet, ApiError } from '@/lib/api-client';
import { isOpenByFill } from '@/lib/registrations';

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
  /** Inscriptions actives du joueur, tous tournois confondus. */
  bracketIds?: string[];
}

export interface BracketOption {
  id: string;
  name: string;
  tournamentId: string;
  day: string | null;
  minPoints: number | null;
  maxPoints: number | null;
  maxPlayers: number;
  registeredCount: number;
  isActive: boolean;
}

export interface TournamentOption {
  id: string;
  name: string;
  isActive: boolean;
}

interface Props {
  open: boolean;
  onClose: () => void;
  initial?: PlayerForm;
  brackets?: BracketOption[];
  tournaments?: TournamentOption[];
}

const pointsWindowLabel = (b: BracketOption) => {
  if (b.minPoints != null && b.maxPoints != null) return `${b.minPoints}–${b.maxPoints} pts`;
  if (b.maxPoints != null) return `≤ ${b.maxPoints} pts`;
  if (b.minPoints != null) return `≥ ${b.minPoints} pts`;
  return 'Toutes séries';
};

export function PlayerFormModal({
  open,
  onClose,
  initial,
  brackets = [],
  tournaments = [],
}: Props) {
  const router = useRouter();
  const isEdit = !!initial?.id;
  const [submitting, setSubmitting] = useState(false);
  const [looking, setLooking] = useState(false);
  const [form, setForm] = useState<PlayerForm>(
    initial ?? { firstName: '', lastName: '', points: 500 },
  );

  // État complet des inscriptions (tous tournois). Le PATCH interprète
  // `bracketIds` comme l'état final : n'envoyer que les tableaux du tournoi
  // affiché désinscrirait le joueur de tous les autres tournois.
  const [selectedBrackets, setSelectedBrackets] = useState<string[]>(initial?.bracketIds ?? []);

  const [tournamentId, setTournamentId] = useState<string>(() => {
    const firstRegistered = brackets.find((b) => (initial?.bracketIds ?? []).includes(b.id));
    if (firstRegistered) return firstRegistered.tournamentId;
    return tournaments.find((t) => t.isActive)?.id ?? tournaments[0]?.id ?? '';
  });

  const visibleBrackets = brackets.filter((b) => b.tournamentId === tournamentId);
  const visibleIds = new Set(visibleBrackets.map((b) => b.id));
  const elsewhereCount = selectedBrackets.filter((id) => !visibleIds.has(id)).length;

  const toggleBracket = (bracketId: string) =>
    setSelectedBrackets((prev) =>
      prev.includes(bracketId) ? prev.filter((x) => x !== bracketId) : [...prev, bracketId],
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
      const fields: PlayerForm = { ...form };
      delete fields.bracketIds;
      const payload: Record<string, unknown> = {
        ...fields,
        licenseNumber: form.licenseNumber || undefined,
      };
      if (isEdit) {
        // `selectedBrackets` porte l'état final complet, tous tournois confondus.
        payload.bracketIds = selectedBrackets;
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
    <Modal
      open={open}
      onClose={onClose}
      title={isEdit ? 'Modifier le joueur' : 'Nouveau joueur'}
      size={isEdit ? 'lg' : 'md'}
    >
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

        {isEdit && (
          <div className="card bg-bg-alt p-3 space-y-3" data-testid="player-registrations">
            <div className="flex items-center justify-between gap-3">
              <p className="text-xs uppercase tracking-widest text-foreground-muted">
                Tournoi & tableaux
              </p>
              <span className="text-xs text-foreground-muted tabular">
                {selectedBrackets.length} inscription{selectedBrackets.length > 1 ? 's' : ''}
              </span>
            </div>

            {tournaments.length === 0 ? (
              <p className="text-sm text-foreground-muted">Aucun tournoi disponible.</p>
            ) : (
              <>
                <label className="block">
                  <span className="block text-sm mb-1">Tournoi</span>
                  <select
                    value={tournamentId}
                    onChange={(e) => setTournamentId(e.target.value)}
                    className="input text-sm w-full"
                    data-testid="player-tournament"
                  >
                    {tournaments.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.name}
                        {t.isActive ? ' (actif)' : ''}
                      </option>
                    ))}
                  </select>
                </label>

                <div className="max-h-56 overflow-y-auto border border-border rounded-lg divide-y divide-border">
                  {visibleBrackets.length === 0 && (
                    <p className="p-3 text-sm text-foreground-muted">
                      Aucun tableau sur ce tournoi.
                    </p>
                  )}
                  {visibleBrackets.map((b) => {
                    const open = isOpenByFill(b);
                    const rate =
                      b.maxPlayers > 0
                        ? Math.round((b.registeredCount / b.maxPlayers) * 100)
                        : 0;
                    return (
                      <label
                        key={b.id}
                        className={`flex items-center gap-2 px-3 py-2 text-sm cursor-pointer hover:bg-primary-soft/20 ${
                          b.isActive ? '' : 'opacity-60'
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={selectedBrackets.includes(b.id)}
                          onChange={() => toggleBracket(b.id)}
                          className="accent-primary"
                          data-testid={`bracket-${b.id}`}
                        />
                        <span className="flex-1 min-w-0 truncate">
                          {b.name}
                          {!b.isActive && (
                            <span className="ml-2 text-[10px] uppercase tracking-widest text-warning">
                              désactivé
                            </span>
                          )}
                        </span>
                        <span className="text-xs text-foreground-muted whitespace-nowrap">
                          {b.day ? `${b.day} · ` : ''}
                          {open ? 'ouvert à tous' : pointsWindowLabel(b)} · {b.registeredCount}/
                          {b.maxPlayers} ({rate} %)
                        </span>
                      </label>
                    );
                  })}
                </div>

                {elsewhereCount > 0 && (
                  <p className="text-xs text-foreground-muted">
                    {elsewhereCount} inscription{elsewhereCount > 1 ? 's' : ''} sur un autre tournoi
                    {elsewhereCount > 1 ? ' sont conservées' : ' est conservée'}.
                  </p>
                )}
                <p className="text-xs text-foreground-muted">
                  Un tableau désactivé reste décochable : décoche-le puis coche un autre tableau
                  pour réinscrire le joueur. Au-delà de 70 % de remplissage, un tableau accepte
                  tous les classements. En tant qu&apos;admin, tu peux de toute façon inscrire hors
                  fenêtre de points : la dérogation est journalisée côté serveur.
                </p>
              </>
            )}
          </div>
        )}

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
