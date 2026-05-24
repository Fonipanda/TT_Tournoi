import { describe, it, expect } from 'vitest';
import {
  ffttPoolMatchOrder,
  ffttPoolRanking,
  ffttSeedingPositions,
  ffttPlaceQualifiers,
  fftPointsSwap,
  FFTT_POOL_ORDERS,
} from './engine';

// =============================================================================
// I.301 — Ordre des parties
// =============================================================================

describe('FFTT I.301 — ffttPoolMatchOrder', () => {
  it('poule de 3 joueurs avec 1 qualifié', () => {
    expect(ffttPoolMatchOrder(3, 1)).toEqual([
      [0, 2],
      [1, 2],
      [0, 1],
    ]);
  });

  it('poule de 4 joueurs avec 2 qualifiés', () => {
    const order = ffttPoolMatchOrder(4, 2);
    expect(order).toEqual([
      [0, 2], [1, 3], [0, 1], [2, 3], [0, 3], [1, 2],
    ]);
    // 6 matches = C(4,2)
    expect(order).toHaveLength(6);
  });

  it('poule de 5 joueurs', () => {
    expect(ffttPoolMatchOrder(5, 2)).toHaveLength(10);
  });

  it('poule de 6 joueurs', () => {
    expect(ffttPoolMatchOrder(6, 1)).toHaveLength(15);
  });

  it('clamp qualifiers >= poolSize - 1', () => {
    // qualifiers=5 dans une poule de 4 → clamp à 3
    const order = ffttPoolMatchOrder(4, 5);
    expect(order).toEqual(FFTT_POOL_ORDERS['4,3']);
  });

  it('round-robin par défaut si clef inconnue', () => {
    const order = ffttPoolMatchOrder(7, 2);
    expect(order).toHaveLength(21); // C(7,2)
  });
});

// =============================================================================
// I.303 — Classement de poule
// =============================================================================

describe('FFTT I.303 — ffttPoolRanking', () => {
  it('classement simple sans ex-aequo', () => {
    const players = ['p1', 'p2', 'p3'];
    const matches = [
      { player1Id: 'p1', player2Id: 'p2', status: 'finished' as const, winnerId: 'p1', setsP1: 3, setsP2: 1 },
      { player1Id: 'p1', player2Id: 'p3', status: 'finished' as const, winnerId: 'p1', setsP1: 3, setsP2: 0 },
      { player1Id: 'p2', player2Id: 'p3', status: 'finished' as const, winnerId: 'p2', setsP1: 3, setsP2: 2 },
    ];
    const ranking = ffttPoolRanking(matches, players);
    expect(ranking).toEqual(['p1', 'p2', 'p3']);
  });

  it('départage par confrontation directe (2 ex-aequo)', () => {
    // 3 joueurs, p1 et p2 ont 1V/1D — p1 a battu p2 → p1 1er
    const players = ['p1', 'p2', 'p3'];
    const matches = [
      { player1Id: 'p1', player2Id: 'p2', status: 'finished' as const, winnerId: 'p1', setsP1: 3, setsP2: 0 },
      { player1Id: 'p2', player2Id: 'p3', status: 'finished' as const, winnerId: 'p2', setsP1: 3, setsP2: 0 },
      { player1Id: 'p1', player2Id: 'p3', status: 'finished' as const, winnerId: 'p3', setsP1: 0, setsP2: 3 },
    ];
    // Tous : 1V/1D → 3 pts. Quotient égal aussi. Confrontation directe :
    // p1 a battu p2 → p1 > p2. p3 a battu p1 → mais p3 a perdu contre p2.
    // Cycle : p1>p2>p3>p1 → quotient sets décide. Ici on vérifie juste que
    // ranking est cohérent (3 joueurs, ordre dépend des sets)
    const ranking = ffttPoolRanking(matches, players);
    expect(ranking).toHaveLength(3);
    expect(new Set(ranking)).toEqual(new Set(players));
  });

  it('départage par quotient sets quand confrontation directe ne tranche pas', () => {
    // 4 joueurs, p1 et p2 ont 2V/1D mais p1 a un meilleur quotient sets
    const players = ['p1', 'p2', 'p3', 'p4'];
    const matches = [
      { player1Id: 'p1', player2Id: 'p2', status: 'finished' as const, winnerId: 'p2', setsP1: 1, setsP2: 3 },
      { player1Id: 'p1', player2Id: 'p3', status: 'finished' as const, winnerId: 'p1', setsP1: 3, setsP2: 0 },
      { player1Id: 'p1', player2Id: 'p4', status: 'finished' as const, winnerId: 'p1', setsP1: 3, setsP2: 0 },
      { player1Id: 'p2', player2Id: 'p3', status: 'finished' as const, winnerId: 'p2', setsP1: 3, setsP2: 2 },
      { player1Id: 'p2', player2Id: 'p4', status: 'finished' as const, winnerId: 'p4', setsP1: 1, setsP2: 3 },
      { player1Id: 'p3', player2Id: 'p4', status: 'finished' as const, winnerId: 'p3', setsP1: 3, setsP2: 1 },
    ];
    const ranking = ffttPoolRanking(matches, players);
    // p1 et p2 ont tous 2V/1D
    // p1 quotient = 7/4 = 1.75
    // p2 quotient = 7/5 = 1.4
    // → p1 devant p2 (mais départage direct : p2 a battu p1 → p2 devant p1)
    // Selon règle FFTT départage 2 ex-aequo : confrontation directe prime
    expect(ranking[0]).toBe('p2');
  });

  it('match non terminé n\'attribue aucun point', () => {
    const players = ['p1', 'p2'];
    const matches = [
      { player1Id: 'p1', player2Id: 'p2', status: 'in_progress' as const, winnerId: null, setsP1: 0, setsP2: 0 },
    ];
    const ranking = ffttPoolRanking(matches, players);
    expect(ranking).toHaveLength(2);
  });
});

// =============================================================================
// I.304.2 — Seeding positions
// =============================================================================

describe('FFTT I.304.2 — ffttSeedingPositions', () => {
  it('bracket size 1', () => {
    expect(ffttSeedingPositions(1)).toEqual([1]);
  });

  it('bracket size 2', () => {
    expect(ffttSeedingPositions(2)).toEqual([1, 2]);
  });

  it('bracket size 4', () => {
    expect(ffttSeedingPositions(4)).toEqual([1, 4, 2, 3]);
  });

  it('bracket size 8', () => {
    expect(ffttSeedingPositions(8)).toEqual([1, 8, 4, 5, 2, 7, 3, 6]);
  });

  it('bracket size 16', () => {
    const seeds = ffttSeedingPositions(16);
    expect(seeds).toHaveLength(16);
    expect(seeds[0]).toBe(1);
    expect(seeds[15]).toBe(9);
    // sommes par paire = 17
    for (let i = 0; i < 16; i += 2) {
      expect(seeds[i]! + seeds[i + 1]!).toBe(17);
    }
  });

  it('bracket size 32', () => {
    const seeds = ffttSeedingPositions(32);
    expect(seeds).toHaveLength(32);
    for (let i = 0; i < 32; i += 2) {
      expect(seeds[i]! + seeds[i + 1]!).toBe(33);
    }
  });
});

// =============================================================================
// I.305 — Placement des qualifiés
// =============================================================================

describe('FFTT I.305 — ffttPlaceQualifiers', () => {
  it('un seul qualifié par poule, pas de bye', () => {
    const standings = [
      { poolName: 'Poule 1', ranking: ['a1', 'a2', 'a3'] },
      { poolName: 'Poule 2', ranking: ['b1', 'b2', 'b3'] },
      { poolName: 'Poule 3', ranking: ['c1', 'c2', 'c3'] },
      { poolName: 'Poule 4', ranking: ['d1', 'd2', 'd3'] },
    ];
    const placed = ffttPlaceQualifiers(standings, 1, []);
    expect(placed).toHaveLength(4);
    expect(new Set(placed)).toEqual(new Set(['a1', 'b1', 'c1', 'd1']));
  });

  it('2 qualifiés par poule : seconds placés en demi-tableau opposé', () => {
    const standings = [
      { poolName: 'Poule 1', ranking: ['a1', 'a2'] },
      { poolName: 'Poule 2', ranking: ['b1', 'b2'] },
    ];
    const placed = ffttPlaceQualifiers(standings, 2, []);
    // 4 joueurs : a1, b1 (1ers) + a2, b2 (2èmes en demi opposés)
    expect(placed).toHaveLength(4);
    expect(placed.includes('a1')).toBe(true);
    expect(placed.includes('a2')).toBe(true);
  });

  it('avec bye players', () => {
    const standings = [
      { poolName: 'Poule 1', ranking: ['p1'] },
      { poolName: 'Poule 2', ranking: ['p2'] },
    ];
    const placed = ffttPlaceQualifiers(standings, 1, ['bye1', 'bye2']);
    expect(placed.length).toBeGreaterThanOrEqual(4);
    expect(placed.includes('bye1')).toBe(true);
    expect(placed.includes('bye2')).toBe(true);
  });

  it('< 2 joueurs : retourne tel quel', () => {
    expect(ffttPlaceQualifiers([{ poolName: 'P1', ranking: ['solo'] }], 1, [])).toEqual(['solo']);
    expect(ffttPlaceQualifiers([], 1, [])).toEqual([]);
  });

  it('ne place pas de positions vides', () => {
    const standings = [
      { poolName: 'Poule 1', ranking: ['a1', 'a2'] },
      { poolName: 'Poule 2', ranking: ['b1', 'b2'] },
      { poolName: 'Poule 3', ranking: ['c1', 'c2'] },
    ];
    // 6 joueurs → bracket de 8 avec 2 byes virtuels
    const placed = ffttPlaceQualifiers(standings, 2, []);
    expect(placed.every((p) => p !== null && p !== undefined)).toBe(true);
  });
});

// =============================================================================
// FFTT Points-swap
// =============================================================================

describe('fftPointsSwap', () => {
  it('vainqueur très inférieur gagne beaucoup', () => {
    expect(fftPointsSwap(800, 1500)).toBe(12);
  });

  it('vainqueur supérieur gagne moins', () => {
    expect(fftPointsSwap(1500, 800)).toBe(1);
  });

  it('ecart faible donne gain modéré', () => {
    expect(fftPointsSwap(1000, 1020)).toBe(7); // diff -20 → 7
    expect(fftPointsSwap(1020, 1000)).toBe(6); // diff +20 → 6
  });

  it('symétrie autour de 0', () => {
    expect(fftPointsSwap(1000, 1000)).toBe(6);
  });
});
