'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from '@/components/ui/toast';
import { apiGet, apiPost, ApiError } from '@/lib/api-client';
import { BracketView } from '@/components/bracket/BracketView';
import { type BracketTreeMatch } from '@/lib/bracket-layout';

interface Player {
  id: string;
  firstName: string;
  lastName: string;
  club: string | null;
  points: number;
  licenseNumber: string | null;
}

interface Registration {
  id: string;
  paymentStatus: string;
  bracket: { id: string; name: string; tournament: { name: string } };
}

interface Props {
  player: Player;
  registrations: Registration[];
}

export function MonEspaceContent({ player: initialPlayer, registrations }: Props) {
  const router = useRouter();
  const [player, setPlayer] = useState(initialPlayer);
  const [syncing, setSyncing] = useState(false);

  const sync = async () => {
    if (!player.licenseNumber) {
      toast.error('Aucune licence FFTT renseignée');
      return;
    }
    setSyncing(true);
    try {
      const res = await apiPost<{ player: Player }>(`/api/players/${player.id}/sync-fftt`);
      setPlayer({
        ...player,
        firstName: res.player.firstName,
        lastName: res.player.lastName,
        club: res.player.club,
        points: res.player.points,
      });
      toast.success(`Points mis à jour : ${Math.round(res.player.points)} pts`);
      router.refresh();
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : 'Erreur sync FFTT');
    } finally {
      setSyncing(false);
    }
  };

  return (
    <div data-testid="mon-espace">
      <h1 className="font-heading text-3xl uppercase tracking-wide mb-6">Mon espace</h1>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <div className="card rounded-2xl">
          <p className="text-xs uppercase tracking-widest text-foreground-muted">Joueur</p>
          <p className="font-heading text-2xl mt-1">
            {player.lastName} {player.firstName}
          </p>
          <p className="text-foreground-muted text-sm">{player.club ?? '—'}</p>
        </div>
        <div className="card rounded-2xl text-center">
          <p className="text-xs uppercase tracking-widest text-foreground-muted">
            Points officiels
          </p>
          <p className="font-heading text-4xl tabular text-primary mt-1">
            {Math.round(player.points)}
          </p>
          {player.licenseNumber && (
            <button
              type="button"
              onClick={sync}
              disabled={syncing}
              className="text-xs text-primary hover:underline mt-1 disabled:opacity-50"
              data-testid="sync-fftt"
            >
              {syncing ? 'Sync FFTT…' : '↻ Sync FFTT'}
            </button>
          )}
        </div>
        <div className="card rounded-2xl text-center">
          <p className="text-xs uppercase tracking-widest text-foreground-muted">Licence</p>
          <p className="font-mono text-2xl tabular mt-1">{player.licenseNumber ?? '—'}</p>
        </div>
      </div>

      <h2 className="font-heading text-xl uppercase tracking-wide mb-3">Mes inscriptions</h2>
      {registrations.length === 0 ? (
        <p className="text-foreground-muted">Aucune inscription pour le moment.</p>
      ) : (
        <div className="card rounded-2xl">
          <ul className="divide-y divide-border">
            {registrations.map((r) => (
              <li
                key={r.id}
                className="py-3 flex items-center justify-between"
                data-testid={`registration-${r.id}`}
              >
                <div>
                  <p className="font-medium">{r.bracket.name}</p>
                  <p className="text-sm text-foreground-muted">{r.bracket.tournament.name}</p>
                </div>
                <span
                  className={`text-xs px-2 py-1 rounded-full ${
                    r.paymentStatus === 'paid'
                      ? 'bg-success-soft text-success'
                      : 'bg-warning-soft text-warning'
                  }`}
                >
                  {r.paymentStatus === 'paid' ? 'Payé' : 'En attente'}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <MyBracket player={player} registrations={registrations} />
    </div>
  );
}

/**
 * Tableau final d'une des inscriptions du joueur, son parcours mis en relief.
 *
 * Le chargement est différé côté client : afficher d'emblée l'arbre de chaque
 * inscription obligerait la page à ramener tous les matches de tous les
 * tableaux, alors qu'un joueur en regarde un à la fois.
 */
function MyBracket({
  player,
  registrations,
}: {
  player: Player;
  registrations: Registration[];
}) {
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

  if (registrations.length === 0) return null;

  return (
    <section className="mt-8" data-testid="mon-parcours">
      <div className="flex items-center justify-between flex-wrap gap-3 mb-3">
        <h2 className="font-heading text-xl uppercase tracking-wide">Mon parcours</h2>
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

      {loading && <p className="text-foreground-muted">Chargement du tableau…</p>}
      {failed && <p className="text-foreground-muted">Tableau momentanément indisponible.</p>}
      {!loading && !failed && matches && (
        <BracketView matches={matches} minePlayerId={player.id} />
      )}
    </section>
  );
}
