'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

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
  const [me, setMe] = useState<{ playerId: string | null } | null>(null);
  const [player, setPlayer] = useState<Player | null>(null);
  const [brackets, setBrackets] = useState<Bracket[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const meRes = await fetch('/api/auth/me');
      const meData = await meRes.json();
      if (!meData.user?.playerId) {
        router.push('/login?redirect=/inscription');
        return;
      }
      setMe(meData.user);

      // Récupérer les infos du joueur (pour points)
      const pRes = await fetch(`/api/players/${meData.user.playerId}`);
      const pData = await pRes.json();
      setPlayer(pData);

      const tournRes = await fetch('/api/tournaments');
      const tournJson = await tournRes.json();
      const active = tournJson.data?.find((t: { isActive: boolean }) => t.isActive);
      if (active) {
        const bRes = await fetch(`/api/brackets?tournamentId=${active.id}`);
        const bJson = await bRes.json();
        setBrackets(bJson.data ?? []);
      }
      setLoading(false);
    })();
  }, [router]);

  const isEligible = (b: Bracket): { ok: boolean; reason?: string } => {
    if (!player) return { ok: false, reason: 'Chargement…' };
    if (b.minPoints !== null && player.points < b.minPoints) {
      return { ok: false, reason: `Min ${b.minPoints} pts requis (tu as ${Math.round(player.points)})` };
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
      const res = await fetch(`/api/players/${me.playerId}/registrations`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ bracketIds: [...selected] }),
      });
      if (res.ok) {
        setMessage('Inscription enregistrée. Rendez-vous sur Mon espace.');
        setSelected(new Set());
        router.refresh();
      } else {
        const j = await res.json();
        setMessage(j.error ?? 'Erreur');
      }
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) return <p className="text-foreground-muted">Chargement…</p>;

  return (
    <div data-testid="inscription-page">
      <h1 className="font-heading text-3xl uppercase tracking-wide mb-2">Inscription</h1>
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
          className="card border-primary text-primary mb-4 rounded-xl"
          data-testid="inscription-message"
        >
          {message}
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
    </div>
  );
}

