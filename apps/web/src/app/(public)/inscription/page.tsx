'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ToastViewport } from '@/components/ui/toast';
import { apiPost, apiGet, ApiError } from '@/lib/api-client';
import { PaymentModal } from '@/components/PaymentModal';

interface Bracket {
  id: string;
  name: string;
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
  const [message, setMessage] = useState<string | null>(null);
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

  // Étape 2 : éligibilité tableaux selon points
  const isEligible = (b: Bracket): { ok: boolean; reason?: string } => {
    if (!player) return { ok: false, reason: 'Chargement…' };
    if (b.minPoints !== null && player.points < b.minPoints) {
      return { ok: false, reason: `Min ${b.minPoints} pts (tu as ${Math.round(player.points)})` };
    }
    if (b.maxPoints !== null && player.points > b.maxPoints) {
      return { ok: false, reason: `Max ${b.maxPoints} pts (tu as ${Math.round(player.points)})` };
    }
    if (b._count && b._count.registrations >= b.maxPlayers) {
      return { ok: false, reason: 'Tableau complet' };
    }
    return { ok: true };
  };

  /** Quota global : inscriptions déjà validées + nouveaux choix en cours. */
  const MAX_BRACKETS = 2;
  const totalPicked = alreadyRegistered.size + selected.size;
  const quotaReached = totalPicked >= MAX_BRACKETS;

  const toggle = (id: string) => {
    if (alreadyRegistered.has(id)) return; // déjà inscrit : non modifiable ici
    setSelected((prev) => {
      const n = new Set(prev);
      if (n.has(id)) n.delete(id);
      else if (alreadyRegistered.size + n.size < MAX_BRACKETS) n.add(id);
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
        setMessage('Inscription enregistrée !');
        setTimeout(() => router.push('/mon-espace'), 1500);
      }
    } catch (e) {
      setMessage(e instanceof ApiError ? e.message : 'Erreur');
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
        </p>
      )}
      <p className="text-foreground-muted mb-4 text-sm">
        Sélectionne jusqu'à {MAX_BRACKETS} tableaux par jour (règle FFTT). Seuls les tableaux
        compatibles avec ton classement sont sélectionnables.
      </p>

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
          className="card border-success bg-success-soft text-success mb-4 rounded-xl"
          data-testid="inscription-message"
        >
          ✓ {message}
        </p>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3" data-testid="brackets-list">
        {brackets.map((b) => {
          const isRegistered = alreadyRegistered.has(b.id);
          const eligibility = isEligible(b);
          const isSelected = selected.has(b.id);
          // Quota atteint : on grise les tableaux restants, sans masquer
          // ceux que le joueur vient de cocher (il doit pouvoir se raviser).
          const blockedByQuota = !isRegistered && !isSelected && quotaReached;
          const disabled = isRegistered || !eligibility.ok || blockedByQuota;
          const inscrits = b._count?.registrations ?? 0;
          const taux = b.maxPlayers > 0 ? Math.round((inscrits / b.maxPlayers) * 100) : 0;
          return (
            <button
              key={b.id}
              type="button"
              onClick={() => !disabled && toggle(b.id)}
              disabled={disabled}
              data-testid={`bracket-${b.id}`}
              className={`card text-left transition-all rounded-xl ${
                isRegistered
                  ? 'border-success bg-success-soft cursor-default'
                  : !eligibility.ok || blockedByQuota
                    ? 'opacity-50 cursor-not-allowed'
                    : isSelected
                      ? 'border-primary bg-primary-soft shadow-md'
                      : 'hover:border-primary hover:shadow-sm'
              }`}
            >
              <div className="flex items-start justify-between mb-2">
                <div>
                  <p className="font-heading text-xl uppercase tracking-wide">{b.name}</p>
                  <p className="text-sm text-foreground-muted">{b.category}</p>
                </div>
                <span className="font-mono tabular text-primary font-semibold">
                  {Number(b.entryFee).toFixed(2)} €
                </span>
              </div>
              <p className="text-xs text-foreground-subtle">
                {b.day ?? ''} · {b.startTime ?? '?'} · {inscrits}/{b.maxPlayers} ({taux}%)
              </p>
              {isRegistered ? (
                <p className="text-xs text-success mt-2 font-medium">✓ Déjà inscrit</p>
              ) : !eligibility.ok ? (
                <p className="text-xs text-danger mt-2">⚠ {eligibility.reason}</p>
              ) : blockedByQuota ? (
                <p className="text-xs text-foreground-subtle mt-2">
                  Quota de {MAX_BRACKETS} tableaux atteint
                </p>
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
