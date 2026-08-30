'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from '@/components/ui/toast';
import { apiJson, ApiError } from '@/lib/api-client';
import {
  DEFAULT_POINTS_COEFFICIENT,
  MAX_POINTS_COEFFICIENT,
  MIN_POINTS_COEFFICIENT,
  POINTS_COEFFICIENT_KEY,
  parsePointsCoefficient,
} from '@/lib/fftt/points';

/**
 * Coefficients du barème fédéral, proposés en raccourci.
 *
 * La saisie libre reste possible : la liste couvre les cas courants sans
 * enfermer l'organisateur si sa ligue applique une valeur particulière.
 */
const PRESETS = [
  { value: 0.5, label: 'Critérium fédéral · 0,5' },
  { value: 0.75, label: 'Tournoi homologué · 0,75' },
  { value: 1, label: 'Championnat par équipes · 1' },
  { value: 1.5, label: 'Championnats de France · 1,5' },
] as const;

/**
 * Réglage du coefficient d'épreuve appliqué au barème FFTT.
 *
 * Il pondère chaque gain et chaque perte de points : un tournoi homologué
 * vaut 0,75, un championnat de France 1,5. Le réglage est global et prend
 * effet immédiatement, aussi bien sur les matchs clôturés ensuite que sur le
 * détail affiché aux joueurs dans « Mes points ».
 */
export function PointsCoefficientCard() {
  const router = useRouter();
  const [value, setValue] = useState(String(DEFAULT_POINTS_COEFFICIENT).replace('.', ','));
  const [saved, setSaved] = useState(DEFAULT_POINTS_COEFFICIENT);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetch('/api/settings')
      .then((r) => r.json())
      .then((j) => {
        const current = parsePointsCoefficient(j.data?.[POINTS_COEFFICIENT_KEY]);
        setSaved(current);
        setValue(String(current).replace('.', ','));
      })
      .catch(() => undefined)
      .finally(() => setLoading(false));
  }, []);

  const save = async () => {
    const raw = value.trim().replace(',', '.');
    const parsed = Number(raw);
    // On refuse explicitement plutôt que de laisser `parsePointsCoefficient`
    // ramener silencieusement au défaut : l'organisateur doit savoir que sa
    // saisie n'a pas été retenue.
    if (
      !Number.isFinite(parsed) ||
      parsed < MIN_POINTS_COEFFICIENT ||
      parsed > MAX_POINTS_COEFFICIENT
    ) {
      toast.error(`Coefficient attendu entre ${MIN_POINTS_COEFFICIENT} et ${MAX_POINTS_COEFFICIENT}`);
      return;
    }
    setSaving(true);
    try {
      await apiJson(`/api/settings/${POINTS_COEFFICIENT_KEY}`, {
        method: 'PUT',
        body: JSON.stringify({ value: String(parsed) }),
      });
      setSaved(parsed);
      setValue(String(parsed).replace('.', ','));
      toast.success(`Coefficient enregistré : ${String(parsed).replace('.', ',')}`);
      router.refresh();
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : 'Erreur');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="card rounded-2xl" data-testid="points-coefficient">
      <div className="flex items-center justify-between gap-3 mb-3">
        <h2 className="font-heading text-xl uppercase tracking-wide">Coefficient de points</h2>
        <span className="text-xs px-2 py-1 rounded-full bg-bg-alt text-foreground-muted tabular">
          {loading ? '…' : String(saved).replace('.', ',')}
        </span>
      </div>

      <p className="text-sm text-foreground-muted mb-4">
        Pondère le barème FFTT de gain et de perte de points. Appliqué à la clôture de chaque match
        et au détail affiché aux joueurs dans « Mes points ». Valeur par défaut :{' '}
        {String(DEFAULT_POINTS_COEFFICIENT).replace('.', ',')} (tournoi homologué).
      </p>

      <div className="flex flex-wrap gap-2 mb-3">
        {PRESETS.map((p) => (
          <button
            key={p.value}
            type="button"
            onClick={() => setValue(String(p.value).replace('.', ','))}
            disabled={loading || saving}
            className="text-xs px-3 py-1.5 rounded border border-border bg-bg-alt hover:bg-bg-alt/80 disabled:opacity-50"
          >
            {p.label}
          </button>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <label htmlFor="points-coefficient-input" className="sr-only">
          Coefficient d&apos;épreuve
        </label>
        <input
          id="points-coefficient-input"
          type="text"
          inputMode="decimal"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          disabled={loading}
          className="w-24 text-sm border border-border rounded px-2 py-1.5 bg-bg tabular"
          data-testid="points-coefficient-input"
        />
        <button
          type="button"
          onClick={save}
          disabled={loading || saving}
          className="btn-primary text-sm px-4 py-2 rounded disabled:opacity-50"
          data-testid="points-coefficient-save"
        >
          {saving ? 'Enregistrement…' : 'Enregistrer'}
        </button>
      </div>

      <p className="text-xs text-foreground-muted mt-3">
        Modifier le coefficient ne recalcule pas les matchs déjà clôturés : les points déjà crédités
        restent acquis, seul le détail affiché aux joueurs est recalculé.
      </p>
    </div>
  );
}
