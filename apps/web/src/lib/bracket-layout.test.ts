import { describe, expect, it } from 'vitest';
import {
  BASE_GAP,
  COL_GAP,
  COL_W,
  LABEL_H,
  MATCH_H,
  computeRoundLabel,
  connectorPath,
  isPassMatch,
  layoutBracket,
  minePathIds,
  type BracketTreeMatch,
} from './bracket-layout';

/** Fabrique un match d'élimination minimal. */
function match(
  id: string,
  roundNumber: number,
  poolMatchOrder: number,
  over: Partial<BracketTreeMatch> = {},
): BracketTreeMatch {
  return {
    id,
    roundNumber,
    poolMatchOrder,
    status: 'waiting',
    setsP1: 0,
    setsP2: 0,
    ...over,
  };
}

/** Tableau complet de 8 joueurs : 4 + 2 + 1 matches. */
function bracket8(): BracketTreeMatch[] {
  return [
    match('r1m1', 1, 1),
    match('r1m2', 1, 2),
    match('r1m3', 1, 3),
    match('r1m4', 1, 4),
    match('r2m1', 2, 1),
    match('r2m2', 2, 2),
    match('r3m1', 3, 1),
  ];
}

describe('layoutBracket', () => {
  it('ne produit rien pour un tableau vide', () => {
    const l = layoutBracket([]);
    expect(l.totalRounds).toBe(0);
    expect(l.nodes).toHaveLength(0);
    expect(l.connectors).toHaveLength(0);
    expect(l.totalW).toBe(0);
    expect(l.totalH).toBe(0);
  });

  it('empile le premier tour depuis le haut, sous les libellés', () => {
    const l = layoutBracket(bracket8());
    const step = MATCH_H + BASE_GAP;
    expect(l.centers[0]).toEqual([
      LABEL_H + MATCH_H / 2,
      LABEL_H + MATCH_H / 2 + step,
      LABEL_H + MATCH_H / 2 + step * 2,
      LABEL_H + MATCH_H / 2 + step * 3,
    ]);
  });

  it('centre chaque match sur le milieu de ses deux alimentateurs', () => {
    const l = layoutBracket(bracket8());
    const [a, b, c, d] = l.centers[0]!;
    expect(l.centers[1]).toEqual([(a! + b!) / 2, (c! + d!) / 2]);
    const [e, f] = l.centers[1]!;
    expect(l.centers[2]).toEqual([(e! + f!) / 2]);
  });

  it('range les tours en colonnes régulièrement espacées', () => {
    const l = layoutBracket(bracket8());
    expect(l.totalRounds).toBe(3);
    expect(l.columns.map((c) => c.length)).toEqual([4, 2, 1]);
    expect(l.nodes.filter((n) => n.round === 0).every((n) => n.x === 0)).toBe(true);
    expect(l.nodes.filter((n) => n.round === 1).every((n) => n.x === COL_W + COL_GAP)).toBe(true);
    expect(l.totalW).toBe(3 * (COL_W + COL_GAP) - COL_GAP);
  });

  it('trie chaque tour par poolMatchOrder, quel que soit l ordre d entrée', () => {
    const shuffled = [match('b', 1, 2), match('c', 1, 3), match('a', 1, 1)];
    const l = layoutBracket(shuffled);
    expect(l.columns[0]!.map((m) => m.id)).toEqual(['a', 'b', 'c']);
  });

  it('relie chaque alimentateur à sa cible', () => {
    const l = layoutBracket(bracket8());
    // 4 alimentateurs vers le tour 2, 2 vers le tour 3
    expect(l.connectors).toHaveLength(6);
    const toR2m1 = l.connectors.filter((c) => c.toId === 'r2m1');
    expect(toR2m1.map((c) => c.fromId)).toEqual(['r1m1', 'r1m2']);
  });

  it('fait partir et arriver les connecteurs sur les bords des colonnes', () => {
    const l = layoutBracket(bracket8());
    const c = l.connectors.find((x) => x.fromId === 'r1m1')!;
    expect(c.points[0]!.x).toBe(COL_W);
    expect(c.points.at(-1)!.x).toBe(COL_W + COL_GAP);
    // départ aligné sur le centre de l'alimentateur, arrivée sur celui de la cible
    expect(c.points[0]!.y).toBe(l.centers[0]![0]);
    expect(c.points.at(-1)!.y).toBe(l.centers[1]![0]);
  });

  it('retombe sur l alimentateur unique quand le tour est incomplet', () => {
    const l = layoutBracket([
      match('r1m1', 1, 1),
      match('r1m2', 1, 2),
      match('r1m3', 1, 3),
      match('r2m1', 2, 1),
      match('r2m2', 2, 2),
    ]);
    const [a, b, c] = l.centers[0]!;
    expect(l.centers[1]).toEqual([(a! + b!) / 2, c!]);
    // r2m2 n'a qu'un seul alimentateur : un seul connecteur
    expect(l.connectors.filter((x) => x.toId === 'r2m2')).toHaveLength(1);
    expect(l.connectors).toHaveLength(3);
  });

  it('réserve la hauteur du tour le plus long', () => {
    const l = layoutBracket(bracket8());
    const lastR1 = l.centers[0]!.at(-1)!;
    expect(l.totalH).toBe(lastR1 + MATCH_H / 2 + 16);
  });
});

describe('connectorPath', () => {
  it('produit un chemin SVG orthogonal', () => {
    const d = connectorPath({
      fromId: 'a',
      toId: 'b',
      points: [
        { x: 0, y: 10 },
        { x: 5, y: 10 },
        { x: 5, y: 20 },
      ],
    });
    expect(d).toBe('M0 10 L5 10 L5 20');
  });
});

describe('computeRoundLabel', () => {
  it('nomme les tours depuis la finale', () => {
    expect(computeRoundLabel(2, 3)).toBe('Finale');
    expect(computeRoundLabel(1, 3)).toBe('Demi-finale');
    expect(computeRoundLabel(0, 3)).toBe('Quart de finale');
    expect(computeRoundLabel(0, 4)).toBe('8ème de finale');
    expect(computeRoundLabel(0, 8)).toBe('128ème de finale');
  });

  it('retombe sur un numéro de tour au-delà des tables connues', () => {
    expect(computeRoundLabel(0, 12)).toBe('Tour 1');
  });
});

describe('isPassMatch', () => {
  const p = { id: 'p1', firstName: 'Jean', lastName: 'Durand' };

  it('reconnaît un match acquis faute d adversaire', () => {
    expect(isPassMatch(match('m', 1, 1, { status: 'finished', winner: p, player1: p }))).toBe(true);
  });

  it('ne confond pas avec un match réellement joué', () => {
    const p2 = { id: 'p2', firstName: 'Marie', lastName: 'Petit' };
    expect(
      isPassMatch(match('m', 1, 1, { status: 'finished', winner: p, player1: p, player2: p2 })),
    ).toBe(false);
    expect(isPassMatch(match('m', 1, 1, { player1: p }))).toBe(false);
  });
});

describe('minePathIds', () => {
  const me = { id: 'me', firstName: 'Alex', lastName: 'Martin' };
  const other = { id: 'other', firstName: 'Sam', lastName: 'Roux' };

  it('retient tous les matches du joueur, joués comme à venir', () => {
    const ids = minePathIds(
      [
        match('m1', 1, 1, { player1: me, player2: other, status: 'finished', winner: me }),
        match('m2', 2, 1, { player1: me }),
        match('m3', 2, 2, { player1: other, player2: other }),
      ],
      'me',
    );
    expect([...ids].sort()).toEqual(['m1', 'm2']);
  });

  it('ne retient rien sans joueur identifié', () => {
    expect(minePathIds([match('m1', 1, 1, { player1: me })], null).size).toBe(0);
    expect(minePathIds([match('m1', 1, 1, { player1: me })], undefined).size).toBe(0);
  });
});
