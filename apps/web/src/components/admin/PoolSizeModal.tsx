'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from '@/components/ui/toast';
import { apiPost, ApiError } from '@/lib/api-client';

interface PoolSizeModalProps {
  bracket: { id: string; name: string; _count: { registrations: number } };
  onClose: () => void;
}

export function PoolSizeModal({ bracket, onClose }: PoolSizeModalProps) {
  const router = useRouter();
  const [poolSize, setPoolSize] = useState(4);
  const [loading, setLoading] = useState(false);
  const nbInscrits = bracket._count.registrations;
  const nbPools = Math.ceil(nbInscrits / poolSize);

  const onGenerate = async () => {
    setLoading(true);
    try {
      const r = await apiPost<{ poolsCreated: number; matchesCreated: number }>(
        `/api/brackets/${bracket.id}/generate-pools`,
        { poolSize },
      );
      toast.success(`${r.poolsCreated} poules · ${r.matchesCreated} matches créés`);
      router.refresh();
      onClose();
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : 'Erreur');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={onClose}>
      <div className="bg-bg rounded-2xl shadow-xl p-6 w-full max-w-md" onClick={(e) => e.stopPropagation()}>
        <h2 className="font-heading text-xl uppercase tracking-wide mb-4">
          Générer les poules — {bracket.name}
        </h2>
        <p className="text-sm text-foreground-muted mb-4">
          {nbInscrits} joueurs présents dans ce tableau.
        </p>

        <label className="block text-sm font-medium mb-2">Taille de poule</label>
        <div className="flex gap-2 mb-4">
          {[2, 3, 4, 5].map((size) => (
            <button
              key={size}
              type="button"
              onClick={() => setPoolSize(size)}
              className={`flex-1 py-2 rounded-lg text-sm font-medium border transition ${
                poolSize === size
                  ? 'bg-primary text-white border-primary'
                  : 'bg-bg-alt border-border hover:border-primary'
              }`}
            >
              {size} joueurs
            </button>
          ))}
        </div>

        <div className="bg-bg-alt rounded-lg p-3 mb-5 text-sm">
          <div className="flex justify-between">
            <span>Nombre de poules :</span>
            <span className="font-medium">{nbPools}</span>
          </div>
          <div className="flex justify-between mt-1">
            <span>Matches par poule :</span>
            <span className="font-medium">{(poolSize * (poolSize - 1)) / 2}</span>
          </div>
          <div className="flex justify-between mt-1">
            <span>Total matches :</span>
            <span className="font-medium">{nbPools * ((poolSize * (poolSize - 1)) / 2)}</span>
          </div>
        </div>

        <div className="flex gap-3">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 py-2 rounded-lg border border-border text-sm hover:bg-bg-alt"
          >
            Annuler
          </button>
          <button
            type="button"
            onClick={onGenerate}
            disabled={loading || nbInscrits < 2}
            className="flex-1 py-2 rounded-lg bg-primary text-white text-sm font-medium disabled:opacity-50"
          >
            {loading ? 'Génération…' : 'Générer'}
          </button>
        </div>
      </div>
    </div>
  );
}
