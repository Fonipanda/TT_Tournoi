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
  tournament: { name: string };
}

export default function InscriptionPage() {
  const router = useRouter();
  const [me, setMe] = useState<{ playerId: string | null } | null>(null);
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
      const tournRes = await fetch('/api/tournaments');
      const tournJson = await tournRes.json();
      const active = tournJson.data?.[0];
      if (active) {
        const bRes = await fetch(`/api/brackets?tournamentId=${active.id}`);
        const bJson = await bRes.json();
        setBrackets(
          (bJson.data ?? []).map((b: any) => ({
            ...b,
            tournament: { name: active.name },
          })),
        );
      }
      setLoading(false);
    })();
  }, [router]);

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
      <h1 className="font-heading text-3xl uppercase tracking-wide mb-6">Inscription</h1>
      <p className="text-foreground-muted mb-4 text-sm">
        Sélectionne jusqu'à 2 tableaux par jour (règle FFTT).
      </p>

      {message && (
        <p
          className="card border-primary text-primary mb-4"
          data-testid="inscription-message"
        >
          {message}
        </p>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3" data-testid="brackets-list">
        {brackets.map((b) => {
          const isSelected = selected.has(b.id);
          return (
            <button
              key={b.id}
              type="button"
              onClick={() => toggle(b.id)}
              data-testid={`bracket-${b.id}`}
              className={`card text-left transition-colors ${
                isSelected ? 'border-primary bg-primary-soft' : 'hover:border-primary'
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
                {b.day ?? ''} · {b.startTime ?? '?'}
              </p>
            </button>
          );
        })}
      </div>

      <button
        type="button"
        disabled={selected.size === 0 || submitting}
        onClick={submit}
        className="btn-primary mt-6 disabled:opacity-50"
        data-testid="submit-registration"
      >
        {submitting ? 'Envoi…' : `Confirmer (${selected.size} tableau${selected.size > 1 ? 'x' : ''})`}
      </button>
    </div>
  );
}
