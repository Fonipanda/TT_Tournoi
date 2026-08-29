import { describe, it, expect } from 'vitest';
import { formatDotation } from './dotation';

describe('formatDotation', () => {
  it('rend le récapitulatif attendu', () => {
    expect(formatDotation({ winner: 80, finalist: 40, semi: 20, quarter: 10 })).toBe(
      '1er 80€ / 2è 40€ / 3è-4è 20€ / 5è à 8è 10€',
    );
  });

  it('conserve les rangs non dotés', () => {
    // Omettre un rang à 0 laisserait croire qu'il n'est pas prévu au règlement.
    expect(formatDotation({ winner: 50, finalist: 25, semi: 0, quarter: 0 })).toBe(
      '1er 50€ / 2è 25€ / 3è-4è 0€ / 5è à 8è 0€',
    );
  });

  it('affiche les centimes uniquement quand ils existent', () => {
    const s = formatDotation({ winner: 12.5, finalist: 40, semi: 0, quarter: 0 });
    expect(s).toContain('1er 12,50€');
    expect(s).toContain('2è 40€');
  });

  it('ramène une valeur aberrante à zéro', () => {
    // Le récap est une information publique : mieux vaut 0€ qu'un NaN affiché.
    const s = formatDotation({
      winner: Number.NaN,
      finalist: -10,
      semi: Number.POSITIVE_INFINITY,
      quarter: 5,
    });
    expect(s).toBe('1er 0€ / 2è 0€ / 3è-4è 0€ / 5è à 8è 5€');
  });

  it('cite toujours les quatre rangs', () => {
    const s = formatDotation({ winner: 0, finalist: 0, semi: 0, quarter: 0 });
    expect(s.split(' / ')).toHaveLength(4);
  });
});
