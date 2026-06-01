'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { Modal } from '@/components/ui/modal';
import { TextField } from '@/components/ui/fields';
import { toast } from '@/components/ui/toast';
import { apiGet, apiPost, ApiError } from '@/lib/api-client';

interface Player {
  id: string;
  firstName: string;
  lastName: string;
  licenseNumber: string | null;
  club: string | null;
  points: number;
}

interface Props {
  open: boolean;
  onClose: () => void;
  bracketId: string;
  bracketName: string;
  alreadyRegistered: Set<string>;
}

export function PlayerRegistrationModal({
  open,
  onClose,
  bracketId,
  bracketName,
  alreadyRegistered,
}: Props) {
  const router = useRouter();
  const [search, setSearch] = useState('');
  const [results, setResults] = useState<Player[]>([]);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState<string | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (!open) return;
    debounceRef.current = setTimeout(async () => {
      setLoading(true);
      try {
        const res = await apiGet<{ data: Player[] }>(
          `/api/players?search=${encodeURIComponent(search)}&limit=30`,
        );
        setResults(res.data);
      } catch {
        setResults([]);
      } finally {
        setLoading(false);
      }
    }, 250);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [search, open]);

  const register = async (player: Player) => {
    setSubmitting(player.id);
    try {
      await apiPost(`/api/players/${player.id}/registrations`, { bracketIds: [bracketId] });
      toast.success(`${player.lastName} ${player.firstName} inscrit`);
      router.refresh();
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : 'Erreur');
    } finally {
      setSubmitting(null);
    }
  };

  return (
    <Modal open={open} onClose={onClose} title={`Inscrire des joueurs · ${bracketName}`} size="lg">
      <TextField
        label="Recherche"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Nom, prénom, licence ou club…"
        autoFocus
      />
      <div className="mt-4 max-h-96 overflow-y-auto border border-border" data-testid="players-list">
        {loading && <p className="p-4 text-foreground-muted text-sm">Recherche…</p>}
        {!loading && results.length === 0 && (
          <p className="p-4 text-foreground-muted text-sm">Aucun joueur trouvé.</p>
        )}
        <ul className="divide-y divide-border">
          {results.map((p) => {
            const registered = alreadyRegistered.has(p.id);
            return (
              <li key={p.id} className="flex items-center justify-between p-2">
                <div className="min-w-0 flex-1">
                  <p className="font-medium uppercase">
                    {p.lastName}{' '}
                    <span className="font-normal normal-case">{p.firstName}</span>
                  </p>
                  <p className="text-xs text-foreground-muted">
                    {p.licenseNumber ?? '—'} · {p.club ?? '—'} · {Math.round(p.points)} pts
                  </p>
                </div>
                {registered ? (
                  <span className="text-xs bg-success-soft text-success px-2 py-1">Inscrit</span>
                ) : (
                  <button
                    type="button"
                    onClick={() => register(p)}
                    disabled={submitting === p.id}
                    className="btn-primary text-xs disabled:opacity-50"
                    data-testid={`register-${p.id}`}
                  >
                    {submitting === p.id ? '…' : 'Inscrire'}
                  </button>
                )}
              </li>
            );
          })}
        </ul>
      </div>
      <div className="flex justify-end pt-3 border-t border-border mt-3">
        <button type="button" onClick={onClose} className="btn-secondary text-sm">
          Fermer
        </button>
      </div>
    </Modal>
  );
}
