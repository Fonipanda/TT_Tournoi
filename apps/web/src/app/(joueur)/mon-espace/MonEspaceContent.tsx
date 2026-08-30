'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from '@/components/ui/toast';
import { apiPost, ApiError } from '@/lib/api-client';

interface Player {
  id: string;
  firstName: string;
  lastName: string;
  club: string | null;
  points: number;
  licenseNumber: string | null;
  /** `null` = classement jamais confronté à la fédération. */
  ffttSyncedAt: string | null;
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
  const autoSyncDone = useRef(false);

  /**
   * @param silent Synchronisation déclenchée par la page et non par le joueur :
   *   les messages d'erreur sont alors tus. Une licence introuvable côté
   *   fédération afficherait sinon un bandeau rouge à chaque visite, pour une
   *   action que le joueur n'a pas demandée.
   */
  const sync = async (silent = false) => {
    if (!player.licenseNumber) {
      if (!silent) toast.error('Aucune licence FFTT renseignée');
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
        ffttSyncedAt: res.player.ffttSyncedAt ?? new Date().toISOString(),
      });
      toast.success(`Points mis à jour : ${Math.round(res.player.points)} pts`);
      router.refresh();
    } catch (e) {
      if (!silent) toast.error(e instanceof ApiError ? e.message : 'Erreur sync FFTT');
    } finally {
      setSyncing(false);
    }
  };

  /**
   * Synchronisation forcée à l'ouverture tant que le classement n'a jamais été
   * confronté à la fédération.
   *
   * C'est ce marqueur qui ouvre les tableaux à borne de points : le joueur
   * jamais synchronisé est précisément celui que l'inscription refuse. Une
   * fois la date posée, plus aucun appel automatique — rafraîchir à chaque
   * visite solliciterait l'API fédérale sans rien changer au classement.
   */
  useEffect(() => {
    if (autoSyncDone.current) return;
    if (!initialPlayer.licenseNumber || initialPlayer.ffttSyncedAt) return;
    autoSyncDone.current = true;
    void sync(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialPlayer.licenseNumber, initialPlayer.ffttSyncedAt]);

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
              onClick={() => sync()}
              disabled={syncing}
              className="text-xs text-primary hover:underline mt-1 disabled:opacity-50"
              data-testid="sync-fftt"
            >
              {syncing ? 'Synchronisation du classement…' : '↻ Sync FFTT'}
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
    </div>
  );
}
