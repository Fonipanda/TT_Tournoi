'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { TextField } from '@/components/ui/fields';
import { toast, ToastViewport } from '@/components/ui/toast';
import { apiPost, apiGet, ApiError } from '@/lib/api-client';

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
  const [step, setStep] = useState<'check' | 'pick'>('check');
  const [licence, setLicence] = useState('');
  const [checking, setChecking] = useState(false);
  const [me, setMe] = useState<{ playerId: string | null } | null>(null);
  const [player, setPlayer] = useState<Player | null>(null);
  const [brackets, setBrackets] = useState<Bracket[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Au chargement, vérifier si déjà loggé
  useEffect(() => {
    (async () => {
      try {
        const meData = await apiGet<{ user: { playerId: string | null } }>('/api/auth/me');
        if (meData.user?.playerId) {
          setMe(meData.user);
          await loadBrackets(meData.user.playerId);
          setStep('pick');
        }
      } catch {
        // pas loggé, on reste sur l'étape "check"
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

  // Étape 1 : vérifier la licence
  const checkLicence = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!/^\d{6,10}$/.test(licence)) {
      setError('Numéro de licence invalide (6 à 10 chiffres)');
      return;
    }
    setChecking(true);
    setError(null);
    try {
      const res = await apiPost<{ user: { playerId: string } }>('/api/auth/login-player', {
        licence,
      });
      setMe(res.user);
      await loadBrackets(res.user.playerId);
      setStep('pick');
      toast.success('Licence reconnue · Sélectionne tes tableaux');
    } catch (e) {
      if (e instanceof ApiError && e.status === 404) {
        // Licence inconnue → redirige vers /register
        toast.info('Licence inconnue · Crée un compte');
        router.push(`/register?licence=${licence}&reason=not_registered`);
        return;
      }
      setError(e instanceof ApiError ? e.message : 'Erreur réseau');
    } finally {
      setChecking(false);
    }
  };

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
      await apiPost(`/api/players/${me.playerId}/registrations`, {
        bracketIds: [...selected],
      });
      setMessage('Inscription enregistrée ! Redirection vers ton espace…');
      setSelected(new Set());
      setTimeout(() => {
        router.push('/mon-espace');
        router.refresh();
      }, 1500);
    } catch (e) {
      setMessage(e instanceof ApiError ? e.message : 'Erreur');
    } finally {
      setSubmitting(false);
    }
  };

  // ========================================================================
  // RENDU
  // ========================================================================

  // Étape 1 : pré-formulaire licence
  if (step === 'check') {
    return (
      <div className="max-w-md mx-auto" data-testid="inscription-precheck">
        <h1 className="font-heading text-3xl uppercase tracking-wide mb-3 text-center">
          Inscription au tournoi
        </h1>
        <p className="text-center text-foreground-muted text-sm mb-6">
          Saisis ton numéro de licence FFTT pour t'inscrire.
        </p>

        <div className="card rounded-2xl">
          <form onSubmit={checkLicence} className="space-y-4">
            <TextField
              label="Numéro de licence FFTT"
              required
              value={licence}
              onChange={(e) => setLicence(e.target.value.replace(/\D/g, ''))}
              inputMode="numeric"
              maxLength={10}
              placeholder="7711100001"
              autoFocus
            />

            {error && (
              <div className="card border-danger bg-danger-soft text-danger text-sm rounded-xl px-3 py-2">
                ⚠ {error}
              </div>
            )}

            <button
              type="submit"
              disabled={checking || !licence}
              className="btn-primary w-full disabled:opacity-50 rounded-full"
              data-testid="check-licence"
            >
              {checking ? '…' : 'Continuer →'}
            </button>
          </form>

          <p className="text-xs text-foreground-muted text-center mt-4">
            Pas encore de compte ?{' '}
            <Link href="/register" className="text-primary underline">
              Créer un compte
            </Link>
          </p>
        </div>

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

      <ToastViewport />
    </div>
  );
}
