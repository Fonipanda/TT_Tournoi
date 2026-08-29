import { describe, it, expect } from 'vitest';
import {
  formatDotation,
  deriveDotation,
  dotationProfileFromPoints,
  defaultWinnerAmount,
} from './dotation';

describe('formatDotation', () => {
  it('rend le récapitulatif attendu', () => {
    expect(formatDotation({ winner: 80, finalist: 40, semi: 20, quarter: 10 })).toBe(
      '1er 80€ / 2ème 40€ / 3ème-4ème 20€ / 5ème à 8ème 10€',
    );
  });

  it('conserve les rangs non dotés', () => {
    // Omettre un rang à 0 laisserait croire qu'il n'est pas prévu au règlement.
    expect(formatDotation({ winner: 50, finalist: 25, semi: 0, quarter: 0 })).toBe(
      '1er 50€ / 2ème 25€ / 3ème-4ème 0€ / 5ème à 8ème 0€',
    );
  });

  it('affiche les centimes uniquement quand ils existent', () => {
    const s = formatDotation({ winner: 12.5, finalist: 40, semi: 0, quarter: 0 });
    expect(s).toContain('1er 12,50€');
    expect(s).toContain('2ème 40€');
  });

  it('ramène une valeur aberrante à zéro', () => {
    // Le récap est une information publique : mieux vaut 0€ qu'un NaN affiché.
    const s = formatDotation({
      winner: Number.NaN,
      finalist: -10,
      semi: Number.POSITIVE_INFINITY,
      quarter: 5,
    });
    expect(s).toBe('1er 0€ / 2ème 0€ / 3ème-4ème 0€ / 5ème à 8ème 5€');
  });

  it('cite toujours les quatre rangs', () => {
    const s = formatDotation({ winner: 0, finalist: 0, semi: 0, quarter: 0 });
    expect(s.split(' / ')).toHaveLength(4);
  });
});

describe('dotationProfileFromPoints', () => {
  it('classe en élite un tableau sans plafond', () => {
    // « Toutes catégories » se définit précisément par l'absence de plafond.
    expect(dotationProfileFromPoints(null)).toBe('elite');
    expect(dotationProfileFromPoints(undefined)).toBe('elite');
  });

  it('sépare petit et intermédiaire au seuil des 1000 points', () => {
    expect(dotationProfileFromPoints(999)).toBe('small');
    expect(dotationProfileFromPoints(1000)).toBe('intermediate');
    expect(dotationProfileFromPoints(1999)).toBe('intermediate');
  });

  it('propose un montant de départ par profil', () => {
    expect(defaultWinnerAmount('elite')).toBe(500);
    expect(defaultWinnerAmount('intermediate')).toBe(170);
    expect(defaultWinnerAmount('small')).toBe(80);
  });
});

describe('deriveDotation', () => {
  it('reproduit la répartition élite', () => {
    expect(deriveDotation(500, 'elite')).toEqual({
      winner: 500,
      finalist: 250,
      semi: 100,
      quarter: 12.5,
    });
  });

  it('reproduit la répartition intermédiaire', () => {
    expect(deriveDotation(170, 'intermediate')).toEqual({
      winner: 170,
      finalist: 90,
      semi: 50,
      quarter: 10,
    });
  });

  it('reproduit la répartition d’un petit tableau', () => {
    // Les quarts ne sont pas dotés : mieux vaut rien que des pièces.
    expect(deriveDotation(82, 'small')).toEqual({
      winner: 82,
      finalist: 37.5,
      semi: 15,
      quarter: 0,
    });
  });

  it('arrondit au demi-euro', () => {
    // 80 × 25/55 = 36,36 → 36,50 ; 80 × 10/55 = 14,55 → 14,50.
    expect(deriveDotation(80, 'small')).toEqual({
      winner: 80,
      finalist: 36.5,
      semi: 14.5,
      quarter: 0,
    });
  });

  it('reste dégressif quel que soit le profil', () => {
    for (const p of ['elite', 'intermediate', 'small'] as const) {
      const d = deriveDotation(300, p);
      expect(d.winner).toBeGreaterThan(d.finalist);
      expect(d.finalist).toBeGreaterThan(d.semi);
      expect(d.semi).toBeGreaterThanOrEqual(d.quarter);
    }
  });

  it('renvoie quatre zéros pour un montant inexploitable', () => {
    const zero = { winner: 0, finalist: 0, semi: 0, quarter: 0 };
    expect(deriveDotation(0, 'elite')).toEqual(zero);
    expect(deriveDotation(-50, 'elite')).toEqual(zero);
    expect(deriveDotation(Number.NaN, 'intermediate')).toEqual(zero);
  });
});
