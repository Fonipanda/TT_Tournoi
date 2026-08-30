'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from '@/components/ui/toast';
import { apiPost, ApiError } from '@/lib/api-client';
import { computePoolPlan, countPoolMatches, matchesForPoolSize } from '@/lib/fftt/pool-layout';

interface PoolSizeModalProps {
  bracket: { id: string; name: string; _count: { registrations: number } };
  onClose: () => void;
}

/** `null` = mode automatique : le moteur choisit lui-même la taille. */
type PreferredSize = number | null;

const SIZE_CHOICES: { value: PreferredSize; label: string }[] = [
  { value: null, label: 'Automatique' },
  { value: 2, label: '2 joueurs' },
  { value: 3, label: '3 joueurs' },
  { value: 4, label: '4 joueurs' },
];

export function PoolSizeModal({ bracket, onClose }: PoolSizeModalProps) {
  const router = useRouter();
  const [poolSize, setPoolSize] = useState<PreferredSize>(null);
  const [loading, setLoading] = useState(false);
  const nbInscrits = bracket._count.registrations;
  // Les poules font 2, 3 ou 4 joueurs : on calcule la répartition réelle pour
  // que l'aperçu corresponde exactement à ce que génère le moteur.
  const plan = computePoolPlan(nbInscrits, poolSize ?? undefined);
  const nbPools = plan.numPools;
  const totalMatches = countPoolMatches(plan.sizes);
  const minPerPool = nbPools > 0 ? matchesForPoolSize(Math.min(...plan.sizes)) : 0;
  const maxPerPool = nbPools > 0 ? matchesForPoolSize(Math.max(...plan.sizes)) : 0;
  const perPoolLabel = minPerPool === maxPerPool ? `${maxPerPool}` : `${minPerPool} – ${maxPerPool}`;

  const onGenerate = async () => {
    setLoading(true);
    try {
      const r = await apiPost<{ poolsCreated: number; matchesCreated: number }>(
        `/api/brackets/${bracket.id}/generate-pools`,
        poolSize === null ? {} : { poolSize },
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

        <label className="block text-sm font-medium mb-2">Taille de poule privilégiée</label>
        <div className="flex gap-2 mb-2">
          {SIZE_CHOICES.map((choice) => (
            <button
              key={choice.label}
              type="button"
              onClick={() => setPoolSize(choice.value)}
              className={`flex-1 py-2 rounded-lg text-sm font-medium border transition ${
                poolSize === choice.value
                  ? 'bg-primary text-white border-primary'
                  : 'bg-bg-alt border-border hover:border-primary'
              }`}
            >
              {choice.label}
            </button>
          ))}
        </div>
        <p className="text-xs text-foreground-muted mb-4">
          Les poules comptent toujours entre 2 et 4 joueurs. La répartition est calculée
          automatiquement pour éviter les poules de 2.
        </p>

        <div className="bg-bg-alt rounded-lg p-3 mb-5 text-sm">
          <div className="flex justify-between">
            <span>Nombre de poules :</span>
            <span className="font-medium">{nbPools}</span>
          </div>
          <div className="flex justify-between mt-1">
            <span>Matches par poule :</span>
            <span className="font-medium">{perPoolLabel}</span>
          </div>
          <div className="flex justify-between mt-1">
            <span>Total matches :</span>
            <span className="font-medium">{totalMatches}</span>
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
