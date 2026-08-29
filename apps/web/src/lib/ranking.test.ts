import { describe, it, expect } from 'vitest';
import { rankingFromPoints, MIN_RANKING } from './ranking';

describe('rankingFromPoints', () => {
  it('déduit le classement par tranche de 100 points', () => {
    expect(rankingFromPoints(762)).toBe(7);
    expect(rankingFromPoints(1050)).toBe(10);
    expect(rankingFromPoints(1999)).toBe(19);
  });

  it('ne descend jamais sous le classement 5', () => {
    // Les fiches naissent à 500 points ; le classement 4 n'existe pas.
    expect(rankingFromPoints(500)).toBe(5);
    expect(rankingFromPoints(499)).toBe(MIN_RANKING);
    expect(rankingFromPoints(0)).toBe(MIN_RANKING);
    expect(rankingFromPoints(-100)).toBe(MIN_RANKING);
  });

  it('encaisse une valeur non exploitable', () => {
    expect(rankingFromPoints(Number.NaN)).toBe(MIN_RANKING);
  });

  it('arrondit vers le bas, jamais au plus proche', () => {
    // 799 points reste classé 7 : passer à 8 anticiperait une progression.
    expect(rankingFromPoints(799)).toBe(7);
    expect(rankingFromPoints(800)).toBe(8);
  });
});
