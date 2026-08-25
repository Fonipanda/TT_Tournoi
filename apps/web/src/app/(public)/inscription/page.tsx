'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ToastViewport } from '@/components/ui/toast';
import { apiPost, apiGet, ApiError } from '@/lib/api-client';
import { PaymentModal } from '@/components/PaymentModal';
import { MAX_BRACKETS_PER_DAY, bracketScopeKey } from '@/lib/registrations';
import { computeBracketFits, isStretch, type BracketFitLevel } from '@/lib/bracket-fit';

/**
 * Habillage du badge de fenêtre de points.
 *
 * « Recommandé » est en aplat plein : c'est la seule pastille qui doit se voir
 * au premier coup d'œil, et l'aplat évite de la confondre avec le fond clair
 * d'une carte sélectionnée. L'ambre distingue « tableau trop fort pour toi » du
 * rouge « plafond dépassé » : les deux sont refusés, mais pour des raisons
 * opposées que le joueur doit pouvoir lire d'un coup d'œil.
 */
const FIT_BADGE: Record<BracketFitLevel, { className: string; icon: string }> = {
  recommended: { className: 'bg-primary text-primary-fg border-primary', icon: '★' },
  accessible: { className: 'bg-bg-alt text-foreground-muted border-border-strong', icon: '' },
  open_fill: { className: 'bg-success-soft text-success border-success', icon: '↑' },
  stretch: { className: 'bg-warning-soft text-warning border-warning', icon: '↗' },
  far_stretch: { className: 'bg-warning-soft text-warning border-warning', icon: '↗↗' },
  closed: { className: 'bg-danger-soft text-danger border-danger', icon: '⚠' },
  unverified: { className: 'bg-bg-alt text-foreground-muted border-border-strong', icon: '🔒' },
};

interface Bracket {
  id: string;
  name: string;
  tournamentId: string;
  category: string;
  minPoints: number | null;
  maxPoints: number | null;
  entryFee: string;
  startTime: string | null;
  day: string | null;
  maxPlayers: number;
  _count?: { registrations: number };
}

interface Player {
  id: string;
  points: number;
  firstName: string;
  lastName: string;
  /** Dernière vérification FFTT. `null` = classement jamais confronté. */
  ffttSyncedAt: string | null;
}

interface Registration {
  id: string;
  bracketId: string;
}

export default function InscriptionPage() {
  const router = useRouter();

  // États
  // 'loading' : on vérifie la session ; 'pick' : sélection des tableaux.
  // Un visiteur non authentifié est redirigé vers /register.
  const [step, setStep] = useState<'loading' | 'pick'>('loading');
  const [me, setMe] = useState<{ playerId: string | null } | null>(null);
  const [player, setPlayer] = useState<Player | null>(null);
  const [brackets, setBrackets] = useState<Bracket[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  /** Tableaux auxquels le joueur est DÉJÀ inscrit (source : serveur). */
  const [alreadyRegistered, setAlreadyRegistered] = useState<Set<string>>(new Set());
  const [submitting, setSubmitting] = useState(false);
  const [syncing, setSyncing] = useState(false);
  // Un refus serveur (plafond de points, quota) transite par ce même canal :
  // il doit se distinguer d'une confirmation, sans quoi un rejet s'afficherait
  // en vert précédé d'une coche.
  const [message, setMessage] = useState<{ kind: 'success' | 'error'; text: string } | null>(
    null,
  );
  const [paymentOpen, setPaymentOpen] = useState(false);
  const [createdRegistrations, setCreatedRegistrations] = useState<
    Array<{ id: string; registrationId: string; name: string; entryFee: number }>
  >([]);

  // L'inscription au tournoi suppose un compte joueur : sans session valide,
  // on envoie l'utilisateur créer son compte sur /register.
  useEffect(() => {
    (async () => {
      try {
        const meData = await apiGet<{ user: { playerId: string | null } }>('/api/auth/me');
        if (meData.user?.playerId) {
          setMe(meData.user);
          await loadBrackets(meData.user.playerId);
          setStep('pick');
          return;
        }
        router.replace('/register');
      } catch {
        router.replace('/register');
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function loadBrackets(playerId: string) {
    const pData = await apiGet<Player>(`/api/players/${playerId}`);
    setPlayer(pData);
    const tournRes = await apiGet<{ data: { id: string; isActive: boolean }[] }>(
      '/api/tournaments',
    );
    const active = tournRes.data?.find((t) => t.isActive);
    if (!active) {
      setBrackets([]);
      setSelected(new Set());
      setAlreadyRegistered(new Set());
      return;
    }

    const bRes = await apiGet<{ data: Bracket[] }>(`/api/brackets?tournamentId=${active.id}`);
    const list = bRes.data ?? [];
    setBrackets(list);

    // On repart systématiquement de l'état renvoyé par le serveur : l'API ne
    // liste que les inscriptions actives, donc celles supprimées par l'admin
    // disparaissent d'elles-mêmes et les tableaux redeviennent sélectionnables.
    const regs = await apiGet<{ data: Registration[] }>(
      `/api/players/${playerId}/registrations`,
    );
    const visibleBracketIds = new Set(list.map((b) => b.id));
    const current = new Set(
      (regs.data ?? [])
        .map((r) => r.bracketId)
        // Un tableau que l'admin a désactivé n'apparaît plus dans la liste.
        .filter((id) => visibleBracketIds.has(id)),
    );

    setAlreadyRegistered(current);
    setSelected(new Set()); // la sélection ne porte que sur les NOUVEAUX choix
  }

  /** Le classement a-t-il été confronté à la base fédérale ? */
  const rankingVerified = player?.ffttSyncedAt != null;

  // Verdict par tableau, recalculé à chaque changement de liste ou de
  // classement. Vide tant que le joueur n'est pas chargé.
  const fits = useMemo(
    () =>
      computeBracketFits(
        // Le taux de remplissage fait partie de la règle : au-delà du seuil,
        // le tableau s'ouvre à tous les classements.
        brackets.map((b) => ({
          id: b.id,
          tournamentId: b.tournamentId,
          day: b.day,
          minPoints: b.minPoints,
          maxPoints: b.maxPoints,
          maxPlayers: b.maxPlayers,
          registeredCount: b._count?.registrations ?? 0,
        })),
        {
          points: player?.points ?? null,
          verified: rankingVerified,
        },
      ),
    [brackets, player, rankingVerified],
  );

  /**
   * Ce qui empêche de cocher un tableau.
   *
   * Le verdict de `bracket-fit` reproduit exactement la règle serveur (fenêtre
   * de points et classement vérifié) ; s'y ajoute ici la jauge du tableau, qui
   * ne relève pas du classement.
   */
  const blockReason = (b: Bracket): string | null => {
    if (!player) return 'Chargement…';
    const fit = fits.get(b.id);
    if (fit?.blocking) return fit.detail;
    if (b._count && b._count.registrations >= b.maxPlayers) return 'Tableau complet';
    return null;
  };

  /**
   * Quota FFTT : 2 tableaux **par journée de tournoi**, et non 2 au total. Un
   * joueur peut donc disputer 2 tableaux le samedi et 2 autres le dimanche.
   *
   * On compte, pour chaque journée, les inscriptions déjà validées plus les
   * nouveaux choix en cours.
   */
  const pickedPerDay = useMemo(() => {
    const counts = new Map<string, number>();
    for (const b of brackets) {
      if (!alreadyRegistered.has(b.id) && !selected.has(b.id)) continue;
      const key = bracketScopeKey(b);
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
    return counts;
  }, [brackets, alreadyRegistered, selected]);

  const pickedOnDayOf = (b: Bracket) => pickedPerDay.get(bracketScopeKey(b)) ?? 0;

  /** Tableaux rendus inaccessibles faute de classement vérifié. */
  const lockedByVerification = useMemo(
    () => brackets.filter((b) => fits.get(b.id)?.level === 'unverified').length,
    [brackets, fits],
  );

  /**
   * Confronte le classement à la base fédérale.
   *
   * Sans cette action à portée de clic, le refus « synchronise ton classement »
   * laisserait le joueur sans issue : la page n'offrait aucun autre chemin.
   */
  async function syncFftt() {
    if (!player || syncing) return;
    setSyncing(true);
    setMessage(null);
    try {
      await apiPost(`/api/players/${player.id}/sync-fftt`, {});
      // Le classement a changé : les tableaux ouverts aussi, et la sélection
      // en cours peut être devenue caduque. On repart de l'état serveur.
      await loadBrackets(player.id);
      setMessage({ kind: 'success', text: 'Classement mis à jour depuis la FFTT.' });
    } catch (e) {
      setMessage({
        kind: 'error',
        text: e instanceof ApiError ? e.message : 'Synchronisation FFTT impossible.',
      });
    } finally {
      setSyncing(false);
    }
  }

  const toggle = (id: string) => {
    if (alreadyRegistered.has(id)) return; // déjà inscrit : non modifiable ici
    const target = brackets.find((b) => b.id === id);
    if (!target) return;
    setSelected((prev) => {
      const n = new Set(prev);
      if (n.has(id)) {
        n.delete(id);
        return n;
      }
      // Recompté depuis `prev` : le mémo peut être en retard d'un rendu.
      const key = bracketScopeKey(target);
      const onThatDay = brackets.filter(
        (b) => bracketScopeKey(b) === key && (alreadyRegistered.has(b.id) || n.has(b.id)),
      ).length;
      if (onThatDay >= MAX_BRACKETS_PER_DAY) return prev;
      n.add(id);
      return n;
    });
  };

  const submit = async () => {
    if (!me?.playerId || selected.size === 0) return;
    setSubmitting(true);
    setMessage(null);
    try {
      const result = await apiPost<{ data: Array<{ id: string; bracketId: string }> }>(
        `/api/players/${me.playerId}/registrations`,
        { bracketIds: [...selected] },
      );
      // Mapper avec entryFee + name
      const items = result.data.map((r) => {
        const b = brackets.find((bb) => bb.id === r.bracketId);
        return {
          id: r.bracketId,
          registrationId: r.id,
          name: b?.name ?? 'Tableau',
          entryFee: b ? Number(b.entryFee) : 0,
        };
      });
      setCreatedRegistrations(items);
      // Ouvrir le pop-up de paiement
      if (items.some((i) => i.entryFee > 0)) {
        setPaymentOpen(true);
      } else {
        // Aucun paiement nécessaire (gratuit) → direct mon-espace
        setMessage({ kind: 'success', text: 'Inscription enregistrée !' });
        setTimeout(() => router.push('/mon-espace'), 1500);
      }
    } catch (e) {
      setMessage({
        kind: 'error',
        text: e instanceof ApiError ? e.message : "Impossible d'enregistrer l'inscription.",
      });
    } finally {
      setSubmitting(false);
    }
  };

  const onPaymentSuccess = () => {
    setPaymentOpen(false);
    router.push('/mon-espace');
    router.refresh();
  };

  // ========================================================================
  // RENDU
  // ========================================================================

  // Session en cours de vérification → écran d'attente avant redirection
  // éventuelle vers /register.
  if (step === 'loading') {
    return (
      <div className="max-w-md mx-auto text-center py-16" data-testid="inscription-loading">
        <p className="text-foreground-muted text-sm">Chargement…</p>
        <ToastViewport />
      </div>
    );
  }

  // Étape 2 : choix des tableaux
  return (
    <div data-testid="inscription-page">
      <h1 className="font-heading text-3xl uppercase tracking-wide mb-2">
        Choisis tes tableaux
      </h1>
      {player && (
        <p className="text-foreground-muted mb-2 text-sm">
          {player.firstName} {player.lastName} —{' '}
          <span className="font-semibold text-primary">{Math.round(player.points)} pts</span>
          {rankingVerified ? (
            <span className="text-success"> · classement vérifié FFTT</span>
          ) : (
            <span className="text-warning"> · classement non vérifié</span>
          )}
        </p>
      )}
      <p className="text-foreground-muted mb-4 text-sm">
        Sélectionne jusqu'à {MAX_BRACKETS_PER_DAY} tableaux <strong>par journée</strong> (règle
        FFTT). Chaque tableau impose une fenêtre de classement : tu ne peux t'inscrire qu'aux
        tableaux dont la fenêtre contient tes points.
      </p>

      {player && !rankingVerified && lockedByVerification > 0 && (
        <div
          className="card border-warning bg-warning-soft text-sm mb-4 rounded-xl"
          data-testid="fftt-sync-notice"
        >
          <p className="mb-3">
            🔒 {lockedByVerification} tableau
            {lockedByVerification > 1 ? 'x' : ''} avec fenêtre de points {' '}
            {lockedByVerification > 1 ? 'sont verrouillés' : 'est verrouillé'} : ton classement
            n'a jamais été confronté à la base fédérale. Une synchronisation suffit à les ouvrir.
          </p>
          <button
            type="button"
            onClick={syncFftt}
            disabled={syncing}
            className="btn-primary rounded-full disabled:opacity-50"
            data-testid="sync-fftt"
          >
            {syncing ? 'Synchronisation…' : 'Synchroniser mon classement FFTT'}
          </button>
        </div>
      )}

      {alreadyRegistered.size > 0 && (
        <p
          className="card border-primary bg-primary-soft text-sm mb-4 rounded-xl"
          data-testid="already-registered-notice"
        >
          Tu es déjà inscrit à {alreadyRegistered.size} tableau
          {alreadyRegistered.size > 1 ? 'x' : ''}. Pour annuler une inscription, contacte
          l'organisation.
        </p>
      )}

      {message && (
        <p
          className={`card mb-4 rounded-xl text-sm ${
            message.kind === 'success'
              ? 'border-success bg-success-soft text-success'
              : 'border-danger bg-danger-soft text-danger'
          }`}
          data-testid="inscription-message"
          data-kind={message.kind}
          role={message.kind === 'error' ? 'alert' : 'status'}
        >
          {message.kind === 'success' ? '✓' : '⚠'} {message.text}
        </p>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3" data-testid="brackets-list">
        {brackets.map((b) => {
          const isRegistered = alreadyRegistered.has(b.id);
          const blocked = blockReason(b);
          const fit = fits.get(b.id);
          const isSelected = selected.has(b.id);
          // Quota atteint pour la journée du tableau : on grise les tableaux
          // restants de cette journée, sans masquer ceux que le joueur vient
          // de cocher (il doit pouvoir se raviser).
          const blockedByQuota =
            !isRegistered && !isSelected && pickedOnDayOf(b) >= MAX_BRACKETS_PER_DAY;
          const disabled = isRegistered || blocked !== null || blockedByQuota;
          // Le refus prend la couleur de son motif : ambre pour « tableau trop
          // fort », neutre pour « classement à vérifier », rouge pour un vrai
          // dépassement de plafond ou un tableau complet.
          const blockedTone =
            fit && isStretch(fit.level)
              ? 'text-warning'
              : fit?.level === 'unverified'
                ? 'text-foreground-muted'
                : 'text-danger';
          const inscrits = b._count?.registrations ?? 0;
          const taux = b.maxPlayers > 0 ? Math.round((inscrits / b.maxPlayers) * 100) : 0;
          const badge = fit ? FIT_BADGE[fit.level] : null;
          return (
            <button
              key={b.id}
              type="button"
              onClick={() => !disabled && toggle(b.id)}
              disabled={disabled}
              data-testid={`bracket-${b.id}`}
              data-fit={fit?.level ?? 'unknown'}
              className={`card text-left transition-all rounded-xl ${
                isRegistered
                  ? 'border-success bg-success-soft cursor-default'
                  : blocked !== null || blockedByQuota
                    ? 'opacity-50 cursor-not-allowed'
                    : isSelected
                      ? 'border-primary bg-primary-soft shadow-md'
                      : 'hover:border-primary hover:shadow-sm'
              }`}
            >
              <div className="flex items-start justify-between gap-2 mb-2">
                <div className="min-w-0">
                  <p className="font-heading text-xl uppercase tracking-wide">{b.name}</p>
                  <p className="text-sm text-foreground-muted">{b.category}</p>
                </div>
                <div className="flex flex-col items-end gap-1 shrink-0">
                  <span className="font-mono tabular text-primary font-semibold">
                    {Number(b.entryFee).toFixed(2)} €
                  </span>
                  {fit && badge && (
                    <span
                      className={`text-[11px] leading-tight border px-2 py-0.5 rounded-full whitespace-nowrap ${badge.className}`}
                      data-testid={`fit-badge-${b.id}`}
                    >
                      {badge.icon ? `${badge.icon} ` : ''}
                      {fit.label}
                    </span>
                  )}
                </div>
              </div>
              <p className="text-xs text-foreground-subtle">
                {b.day ?? ''} · {b.startTime ?? '?'} · {inscrits}/{b.maxPlayers} ({taux}%)
              </p>
              {isRegistered ? (
                <p className="text-xs text-success mt-2 font-medium">✓ Déjà inscrit</p>
              ) : blocked !== null ? (
                <p className={`text-xs mt-2 ${blockedTone}`}>⚠ {blocked}</p>
              ) : blockedByQuota ? (
                <p className="text-xs text-foreground-subtle mt-2">
                  Quota de {MAX_BRACKETS_PER_DAY} tableaux atteint
                  {b.day ? ` pour ${b.day}` : ' pour cette journée'}
                </p>
              ) : fit && fit.level !== 'accessible' ? (
                // « Accessible » n'apporte rien de plus que son badge : une
                // phrase sur chaque carte noierait les vrais conseils.
                <p className="text-xs mt-2 text-foreground-muted">{fit.detail}</p>
              ) : null}
            </button>
          );
        })}
      </div>

      {brackets.length === 0 && (
        <p className="card text-foreground-muted text-center py-8">Aucun tableau disponible.</p>
      )}

      <button
        type="button"
        disabled={selected.size === 0 || submitting}
        onClick={submit}
        className="btn-primary mt-6 disabled:opacity-50 rounded-full"
        data-testid="submit-registration"
      >
        {submitting
          ? 'Envoi…'
          : `Confirmer (${selected.size} tableau${selected.size > 1 ? 'x' : ''})`}
      </button>

      <PaymentModal
        open={paymentOpen}
        registrations={createdRegistrations}
        onCancel={() => {
          setPaymentOpen(false);
          // Inscription créée mais pas payée → on peut aller à mon-espace
          router.push('/mon-espace');
        }}
        onSuccess={onPaymentSuccess}
      />

      <ToastViewport />
    </div>
  );
}
