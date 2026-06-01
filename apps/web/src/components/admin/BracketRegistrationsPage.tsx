'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { PlayerRegistrationModal } from './PlayerRegistrationModal';
import { ConfirmDialog } from '@/components/ui/modal';
import { toast } from '@/components/ui/toast';
import { apiDelete, apiPost, ApiError } from '@/lib/api-client';

interface Registration {
  id: string;
  player: {
    id: string;
    firstName: string;
    lastName: string;
    licenseNumber: string | null;
    club: string | null;
    points: number;
    phone: string | null;
  };
  paymentStatus: string;
  checkinStatus: string;
  dossardNumber: number | null;
}

interface Props {
  bracketId: string;
  bracketName: string;
  registrations: Registration[];
}

export function BracketRegistrationsPage({ bracketId, bracketName, registrations }: Props) {
  const router = useRouter();
  const [registerOpen, setRegisterOpen] = useState(false);
  const [confirmRemove, setConfirmRemove] = useState<Registration | null>(null);
  const [working, setWorking] = useState(false);

  const alreadyRegisteredIds = new Set(registrations.map((r) => r.player.id));

  const onRemove = async () => {
    if (!confirmRemove) return;
    try {
      // Pas d'API DELETE registration → on désactive via API alternative ?
      // Pour l'instant on utilise l'API existante (à étendre si besoin)
      toast.error('Suppression d\'inscription non encore implémentée côté API');
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : 'Erreur');
    } finally {
      setConfirmRemove(null);
    }
  };

  const generatePools = async () => {
    setWorking(true);
    try {
      const r = await apiPost<{ poolsCreated: number; matchesCreated: number }>(
        `/api/brackets/${bracketId}/generate-pools`,
      );
      toast.success(`${r.poolsCreated} poules · ${r.matchesCreated} matches`);
      router.refresh();
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : 'Erreur');
    } finally {
      setWorking(false);
    }
  };

  return (
    <>
      <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
        <div>
          <Link href="/admin/tableaux" className="text-sm text-primary hover:underline">
            ← Tableaux
          </Link>
          <h1 className="font-heading text-3xl uppercase tracking-wide mt-1">{bracketName}</h1>
          <p className="text-foreground-muted text-sm">
            {registrations.length} joueurs inscrits
          </p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <button
            type="button"
            onClick={() => setRegisterOpen(true)}
            className="btn-primary text-sm"
          >
            + Inscrire un joueur
          </button>
          <button
            type="button"
            onClick={generatePools}
            disabled={working || registrations.length < 3}
            className="btn-secondary text-sm disabled:opacity-50"
            title={registrations.length < 3 ? 'Minimum 3 joueurs' : 'Génère poules + matches'}
          >
            {working ? '…' : 'Générer poules'}
          </button>
          <Link href={`/progression/${bracketId}`} className="btn-secondary text-sm">
            Voir progression
          </Link>
        </div>
      </div>

      <div className="card overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="text-xs uppercase tracking-widest text-foreground-muted">
            <tr className="border-b border-border">
              <th className="text-left py-2">Licence</th>
              <th className="text-left py-2">Nom</th>
              <th className="text-left py-2">Prénom</th>
              <th className="text-left py-2">Club</th>
              <th className="text-right py-2">Points</th>
              <th className="text-center py-2">Paiement</th>
              <th className="text-center py-2">Présence</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {registrations
              .slice()
              .sort((a, b) => b.player.points - a.player.points)
              .map((r) => (
                <tr key={r.id} className="border-b border-border hover:bg-bg-alt">
                  <td className="py-2 font-mono tabular text-xs">{r.player.licenseNumber ?? '—'}</td>
                  <td className="py-2 font-medium uppercase">{r.player.lastName}</td>
                  <td className="py-2">{r.player.firstName}</td>
                  <td className="py-2 text-foreground-muted">{r.player.club ?? '—'}</td>
                  <td className="py-2 text-right tabular">{Math.round(r.player.points)}</td>
                  <td className="py-2 text-center">
                    <span
                      className={`text-xs px-2 py-0.5 ${
                        r.paymentStatus === 'paid'
                          ? 'bg-success-soft text-success'
                          : 'bg-warning-soft text-warning'
                      }`}
                    >
                      {r.paymentStatus === 'paid' ? '✓' : 'En attente'}
                    </span>
                  </td>
                  <td className="py-2 text-center">
                    <span className="text-xs">
                      {r.checkinStatus === 'P' ? '✓ Présent' : r.checkinStatus === 'A' ? '✗ Absent' : '—'}
                    </span>
                  </td>
                  <td className="py-2 text-right">
                    <button
                      type="button"
                      onClick={() => setConfirmRemove(r)}
                      className="text-danger text-xs hover:underline"
                    >
                      Retirer
                    </button>
                  </td>
                </tr>
              ))}
            {registrations.length === 0 && (
              <tr>
                <td colSpan={8} className="py-6 text-center text-foreground-muted">
                  Aucun joueur inscrit.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <PlayerRegistrationModal
        open={registerOpen}
        onClose={() => setRegisterOpen(false)}
        bracketId={bracketId}
        bracketName={bracketName}
        alreadyRegistered={alreadyRegisteredIds}
      />
      <ConfirmDialog
        open={!!confirmRemove}
        title="Retirer ce joueur ?"
        message={
          <>
            <strong>
              {confirmRemove?.player.lastName} {confirmRemove?.player.firstName}
            </strong>{' '}
            sera retiré de ce tableau.
          </>
        }
        confirmLabel="Retirer"
        danger
        onConfirm={onRemove}
        onCancel={() => setConfirmRemove(null)}
      />
    </>
  );
}
