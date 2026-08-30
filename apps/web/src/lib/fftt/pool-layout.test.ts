import { describe, it, expect } from 'vitest';
import {
  computePoolPlan,
  computePoolCount,
  computePoolSizes,
  countPoolMatches,
  matchesForPoolSize,
  snakePoolSizes,
} from './pool-layout';

const desc = (a: number[]) => [...a].sort((x, y) => y - x);
const sum = (a: number[]) => a.reduce((s, n) => s + n, 0);

describe('computePoolPlan — répartition de référence', () => {
  it('32 joueurs → 8 poules de 3 + 2 poules de 4 = 10 poules', () => {
    const plan = computePoolPlan(32);
    expect(plan).toMatchObject({ p2: 0, p3: 8, p4: 2, numPools: 10 });
    expect(desc(plan.sizes)).toEqual([4, 4, 3, 3, 3, 3, 3, 3, 3, 3]);
  });

  it('31 joueurs → 9 poules de 3 + 1 poule de 4 = 10 poules', () => {
    expect(computePoolPlan(31)).toMatchObject({ p2: 0, p3: 9, p4: 1, numPools: 10 });
  });

  it('30 joueurs → 10 poules de 3', () => {
    expect(computePoolPlan(30)).toMatchObject({ p2: 0, p3: 10, p4: 0, numPools: 10 });
  });

  it('7 joueurs → 1 poule de 3 + 1 poule de 4', () => {
    expect(computePoolPlan(7)).toMatchObject({ p2: 0, p3: 1, p4: 1, numPools: 2 });
  });

  it('moins de 2 joueurs → aucune poule', () => {
    expect(computePoolPlan(1).numPools).toBe(0);
    expect(computePoolPlan(0).numPools).toBe(0);
    expect(computePoolSizes(1)).toEqual([]);
  });
});

describe('poules de 2 — uniquement quand elles sont inévitables', () => {
  it('2 joueurs → 1 poule de 2', () => {
    expect(computePoolPlan(2)).toMatchObject({ p2: 1, p3: 0, p4: 0, numPools: 1 });
  });

  it('5 joueurs → 1 poule de 3 + 1 poule de 2', () => {
    // 5 n'est décomposable ni en sommes de 3 ni de 4
    expect(computePoolPlan(5)).toMatchObject({ p2: 1, p3: 1, p4: 0, numPools: 2 });
  });

  it('aucun autre effectif n\'impose une poule de 2', () => {
    const withPoolOfTwo: number[] = [];
    for (let n = 2; n <= 300; n++) {
      if (computePoolPlan(n).p2 > 0) withPoolOfTwo.push(n);
    }
    expect(withPoolOfTwo).toEqual([2, 5]);
  });
});

describe('taille privilégiée demandée par l\'organisateur', () => {
  it('privilégier 4 → 32 joueurs en 8 poules de 4', () => {
    expect(computePoolPlan(32, 4)).toMatchObject({ p2: 0, p3: 0, p4: 8, numPools: 8 });
  });

  it('privilégier 2 → 32 joueurs en 16 poules de 2', () => {
    expect(computePoolPlan(32, 2)).toMatchObject({ p2: 16, p3: 0, p4: 0, numPools: 16 });
  });

  it('privilégier 3 équivaut au mode automatique', () => {
    expect(computePoolPlan(32, 3)).toEqual(computePoolPlan(32));
  });

  it('une valeur hors 2/3/4 retombe sur le mode automatique', () => {
    expect(computePoolPlan(32, 5)).toEqual(computePoolPlan(32));
    expect(computePoolPlan(32, 0)).toEqual(computePoolPlan(32));
  });

  it('la taille demandée reste indicative : jamais de poule hors [2,4]', () => {
    for (const pref of [2, 3, 4]) {
      for (let n = 2; n <= 200; n++) {
        const sizes = computePoolPlan(n, pref).sizes;
        expect(Math.max(...sizes), `n=${n} pref=${pref}`).toBeLessThanOrEqual(4);
        expect(Math.min(...sizes), `n=${n} pref=${pref}`).toBeGreaterThanOrEqual(2);
      }
    }
  });
});

describe('invariants généraux', () => {
  it('la somme des tailles vaut toujours l\'effectif', () => {
    for (const pref of [undefined, 2, 3, 4]) {
      for (let n = 2; n <= 200; n++) {
        expect(sum(computePoolPlan(n, pref).sizes), `n=${n} pref=${pref}`).toBe(n);
      }
    }
  });

  it('les tailles produites correspondent au décompte P2/P3/P4 annoncé', () => {
    for (let n = 2; n <= 200; n++) {
      const { p2, p3, p4, sizes, numPools } = computePoolPlan(n);
      expect(sizes).toHaveLength(numPools);
      expect(sizes.filter((s) => s === 2)).toHaveLength(p2);
      expect(sizes.filter((s) => s === 3)).toHaveLength(p3);
      expect(sizes.filter((s) => s === 4)).toHaveLength(p4);
    }
  });

  it('le résultat est déterministe : deux appels donnent le même plan', () => {
    for (let n = 2; n <= 200; n++) {
      expect(computePoolPlan(n)).toEqual(computePoolPlan(n));
    }
  });

  it('computePoolCount et computePoolSizes restent cohérents avec le plan', () => {
    for (let n = 2; n <= 120; n++) {
      const plan = computePoolPlan(n);
      expect(computePoolCount(n)).toBe(plan.numPools);
      expect(computePoolSizes(n)).toEqual(plan.sizes);
    }
  });
});

describe('serpent — position des poules les plus grandes', () => {
  it('32 joueurs : les poules de 4 sont les deux dernières', () => {
    expect(computePoolPlan(32).sizes).toEqual([3, 3, 3, 3, 3, 3, 3, 3, 4, 4]);
  });

  it('les poules de 4 se placent en fin de liste (7, 11, 14, 31 joueurs)', () => {
    for (const n of [7, 11, 14, 31]) {
      const sizes = computePoolPlan(n).sizes;
      const firstFour = sizes.indexOf(4);
      if (firstFour === -1) continue;
      // à partir de la première poule de 4, toutes les suivantes en sont aussi
      expect(sizes.slice(firstFour).every((s) => s === 4), `n=${n} → ${sizes}`).toBe(true);
    }
  });

  it('snakePoolSizes répartit bien tous les joueurs', () => {
    expect(snakePoolSizes(32, 10)).toEqual([3, 3, 3, 3, 3, 3, 3, 3, 4, 4]);
    expect(sum(snakePoolSizes(37, 11))).toBe(37);
    expect(snakePoolSizes(0, 3)).toEqual([]);
    expect(snakePoolSizes(10, 0)).toEqual([]);
  });
});

describe('countPoolMatches', () => {
  it('round-robin par taille de poule', () => {
    expect(matchesForPoolSize(2)).toBe(1);
    expect(matchesForPoolSize(3)).toBe(3);
    expect(matchesForPoolSize(4)).toBe(6);
    expect(matchesForPoolSize(1)).toBe(0);
  });

  it('32 joueurs → 36 matches de poule (8×3 + 2×6)', () => {
    expect(countPoolMatches(computePoolSizes(32))).toBe(36);
  });

  it('total nul quand il n\'y a pas de poule', () => {
    expect(countPoolMatches(computePoolSizes(1))).toBe(0);
  });
});
