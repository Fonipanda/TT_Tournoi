'use client';

import { useEffect, useState } from 'react';
import { apiGet } from '@/lib/api-client';
import { BracketView } from '@/components/bracket/BracketView';
import { type BracketTreeMatch } from '@/lib/bracket-layout';

interface Registration {
  id: string;
  bracket: { id: string; name: string; tournament: { name: string } };
}

interface Props {
  playerId: string;
  registrations: Registration[];
}

/**
 * Tableau final d'une des inscriptions du joueur, son parcours mis en relief.
 *
 * Le chargement est différé côté client : afficher d'emblée l'arbre de chaque
 * inscription obligerait la page à ramener tous les matches de tous les
 * tableaux, alors qu'un joueur en regarde un à la fois.
 */
export function MonParcoursContent({ playerId, registrations }: Props) {
  const [bracketId, setBracketId] = useState(registrations[0]?.bracket.id ?? '');
  const [matches, setMatches] = useState<BracketTreeMatch[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (!bracketId) return;
    let cancelled = false;
    setLoading(true);
    setFailed(false);
    apiGet<{ data: BracketTreeMatch[] }>(`/api/brackets/${bracketId}/tree`)
      .then((res) => {
        if (!cancelled) setMatches(res.data);
      })
      .catch(() => {
        if (!cancelled) {
          setMatches(null);
          setFailed(true);
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [bracketId]);

  return (
    <div data-testid="mon-parcours">
      <div className="flex items-center justify-between flex-wrap gap-3 mb-6">
        <h1 className="font-heading text-3xl uppercase tracking-wide">Mon parcours</h1>
        {registrations.length > 1 && (
          <select
            className="input w-auto text-sm"
            value={bracketId}
            onChange={(e) => setBracketId(e.target.value)}
            aria-label="Choisir un tableau"
          >
            {registrations.map((r) => (
              <option key={r.bracket.id} value={r.bracket.id}>
                {r.bracket.name} — {r.bracket.tournament.name}
              </option>
            ))}
          </select>
        )}
      </div>

      {registrations.length === 0 && (
        <p className="text-foreground-muted">
          Aucune inscription pour le moment : votre parcours s&apos;affichera ici dès que vous
          serez inscrit à un tableau.
        </p>
      )}
      {loading && <p className="text-foreground-muted">Chargement du tableau…</p>}
      {failed && <p className="text-foreground-muted">Tableau momentanément indisponible.</p>}
      {!loading && !failed && matches && (
        <BracketView matches={matches} minePlayerId={playerId} />
      )}
    </div>
  );
}
