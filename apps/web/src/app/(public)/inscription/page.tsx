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
    if (active) {
      const bRes = await apiGet<{ data: Bracket[] }>(`/api/brackets?tournamentId=${active.id}`);
      setBrackets(bRes.data ?? []);
    }
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

  const toggle = (id: string) => {
    setSelected((prev) => {
      const n = new Set(prev);
      if (n.has(id)) n.delete(id);
      else if (n.size < 2) n.add(id);
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
        Sélectionne jusqu'à 2 tableaux par jour (règle FFTT). Seuls les tableaux compatibles avec
        ton classement sont sélectionnables.
      </p>

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
          const eligibility = isEligible(b);
          const isSelected = selected.has(b.id);
          const inscrits = b._count?.registrations ?? 0;
          const taux = b.maxPlayers > 0 ? Math.round((inscrits / b.maxPlayers) * 100) : 0;
          return (
            <button
              key={b.id}
              type="button"
              onClick={() => eligibility.ok && toggle(b.id)}
              disabled={!eligibility.ok}
              data-testid={`bracket-${b.id}`}
              className={`card text-left transition-all rounded-xl ${
                !eligibility.ok
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
              {!eligibility.ok && (
                <p className="text-xs text-danger mt-2">⚠ {eligibility.reason}</p>
              )}
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
