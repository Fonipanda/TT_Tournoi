import { describe, it, expect } from 'vitest';
import {
  DEFAULT_POINTS_COEFFICIENT,
  ffttMatchPoints,
  ffttTablePoints,
  formatCoefficient,
  formatPoints,
  isAbnormalResult,
  parsePointsCoefficient,
} from './points';

// =============================================================================
// Table du barème — valeur brute, avant coefficient
// =============================================================================

describe('ffttTablePoints — tranches du barème', () => {
  it('0 à 24 points d’écart : le résultat ne dépend pas de la nature', () => {
    expect(ffttTablePoints(0, true, false)).toBe(6);
    expect(ffttTablePoints(24, true, true)).toBe(6);
    expect(ffttTablePoints(0, false, false)).toBe(-5);
    expect(ffttTablePoints(24, false, true)).toBe(-5);
  });

  it('25 à 49', () => {
    expect(ffttTablePoints(25, true, false)).toBe(5.5);
    expect(ffttTablePoints(49, true, true)).toBe(7);
    expect(ffttTablePoints(25, false, false)).toBe(-4.5);
    expect(ffttTablePoints(49, false, true)).toBe(-6);
  });

  it('50 à 99', () => {
    expect(ffttTablePoints(50, true, false)).toBe(5);
    expect(ffttTablePoints(99, true, true)).toBe(8);
    expect(ffttTablePoints(50, false, false)).toBe(-4);
    expect(ffttTablePoints(99, false, true)).toBe(-7);
  });

  it('100 à 149', () => {
    expect(ffttTablePoints(100, true, false)).toBe(4);
    expect(ffttTablePoints(149, true, true)).toBe(10);
    expect(ffttTablePoints(100, false, false)).toBe(-3);
    expect(ffttTablePoints(149, false, true)).toBe(-8);
  });

  it('150 à 199', () => {
    expect(ffttTablePoints(150, true, false)).toBe(3);
    expect(ffttTablePoints(199, true, true)).toBe(13);
    expect(ffttTablePoints(150, false, false)).toBe(-2);
    expect(ffttTablePoints(199, false, true)).toBe(-10);
  });

  it('200 à 299', () => {
    expect(ffttTablePoints(200, true, false)).toBe(2);
    expect(ffttTablePoints(299, true, true)).toBe(17);
    expect(ffttTablePoints(200, false, false)).toBe(-1);
    expect(ffttTablePoints(299, false, true)).toBe(-12.5);
  });

  it('300 à 399', () => {
    expect(ffttTablePoints(300, true, false)).toBe(1);
    expect(ffttTablePoints(399, true, true)).toBe(22);
    expect(ffttTablePoints(300, false, false)).toBe(-0.5);
    expect(ffttTablePoints(399, false, true)).toBe(-16);
  });

  it('400 à 499', () => {
    expect(ffttTablePoints(400, true, false)).toBe(0.5);
    expect(ffttTablePoints(499, true, true)).toBe(28);
    expect(ffttTablePoints(400, false, false)).toBe(0);
    expect(ffttTablePoints(499, false, true)).toBe(-20);
  });

  it('500 et au-delà', () => {
    expect(ffttTablePoints(500, true, false)).toBe(0);
    expect(ffttTablePoints(1200, true, true)).toBe(40);
    expect(ffttTablePoints(500, false, false)).toBe(0);
    expect(ffttTablePoints(1200, false, true)).toBe(-29);
  });

  it('l’écart est lu en valeur absolue', () => {
    expect(ffttTablePoints(-260, true, true)).toBe(17);
  });
});

// =============================================================================
// Nature du résultat
// =============================================================================

describe('isAbnormalResult', () => {
  it('battre un mieux classé est une performance', () => {
    expect(isAbnormalResult(800, 1200, true)).toBe(true);
  });

  it('perdre contre un moins bien classé est un contre', () => {
    expect(isAbnormalResult(1200, 800, false)).toBe(true);
  });

  it('le classement respecté ne produit rien d’anormal', () => {
    expect(isAbnormalResult(1200, 800, true)).toBe(false);
    expect(isAbnormalResult(800, 1200, false)).toBe(false);
  });

  it('à points égaux, aucun des deux n’était favori', () => {
    expect(isAbnormalResult(1000, 1000, true)).toBe(false);
    expect(isAbnormalResult(1000, 1000, false)).toBe(false);
  });
});

// =============================================================================
// Calcul complet, coefficient appliqué
// =============================================================================

describe('ffttMatchPoints', () => {
  it('applique le coefficient 0,75 par défaut', () => {
    const r = ffttMatchPoints({ playerPoints: 1000, opponentPoints: 1010, victory: true });
    expect(r.coefficient).toBe(DEFAULT_POINTS_COEFFICIENT);
    expect(r.rawPoints).toBe(6);
    expect(r.points).toBe(4.5); // 6 × 0,75
  });

  it('qualifie une performance et valorise l’écart', () => {
    const r = ffttMatchPoints({
      playerPoints: 800,
      opponentPoints: 1050,
      victory: true,
      coefficient: 0.75,
    });
    expect(r.kind).toBe('perf');
    expect(r.isAbnormal).toBe(true);
    expect(r.gap).toBe(250);
    expect(r.rawPoints).toBe(17);
    expect(r.points).toBe(12.75); // 17 × 0,75
  });

  it('qualifie un contre et en fait payer le prix', () => {
    const r = ffttMatchPoints({
      playerPoints: 1050,
      opponentPoints: 800,
      victory: false,
      coefficient: 0.75,
    });
    expect(r.kind).toBe('contre');
    expect(r.rawPoints).toBe(-12.5);
    expect(r.points).toBe(-9.37); // −12,5 × 0,75, arrondi au centième
  });

  it('le barème n’est pas à somme nulle', () => {
    const gain = ffttMatchPoints({ playerPoints: 800, opponentPoints: 1050, victory: true }).points;
    const perte = ffttMatchPoints({
      playerPoints: 1050,
      opponentPoints: 800,
      victory: false,
    }).points;
    expect(gain).toBeGreaterThan(Math.abs(perte));
  });

  it('une victoire attendue rapporte peu, la défaite attendue coûte peu', () => {
    const gain = ffttMatchPoints({ playerPoints: 1200, opponentPoints: 800, victory: true });
    const perte = ffttMatchPoints({ playerPoints: 800, opponentPoints: 1200, victory: false });
    expect(gain.kind).toBe('normal');
    expect(gain.rawPoints).toBe(0.5);
    expect(perte.kind).toBe('normal');
    expect(perte.rawPoints).toBe(0);
  });

  it('honore un coefficient personnalisé', () => {
    const r = ffttMatchPoints({
      playerPoints: 1000,
      opponentPoints: 1010,
      victory: true,
      coefficient: 1.5,
    });
    expect(r.points).toBe(9); // 6 × 1,5
  });

  it('retombe sur le défaut si le coefficient est aberrant', () => {
    const r = ffttMatchPoints({
      playerPoints: 1000,
      opponentPoints: 1010,
      victory: true,
      coefficient: 42,
    });
    expect(r.coefficient).toBe(DEFAULT_POINTS_COEFFICIENT);
    expect(r.points).toBe(4.5);
  });
});

describe('ffttMatchPoints — parties hors barème', () => {
  it('un forfait ne rapporte ni ne coûte rien', () => {
    const r = ffttMatchPoints({
      playerPoints: 800,
      opponentPoints: 1500,
      victory: true,
      isForfeit: true,
    });
    expect(r.excluded).toBe('forfait');
    expect(r.points).toBe(0);
    expect(r.rawPoints).toBe(0);
  });

  it('un passage direct est signalé plutôt qu’escamoté', () => {
    const r = ffttMatchPoints({ playerPoints: 800, opponentPoints: null, victory: true });
    expect(r.excluded).toBe('sans_adversaire');
    expect(r.points).toBe(0);
    expect(r.kind).toBe('normal');
  });

  it('le forfait prime sur l’absence d’adversaire', () => {
    const r = ffttMatchPoints({
      playerPoints: 800,
      opponentPoints: null,
      victory: false,
      isForfeit: true,
    });
    expect(r.excluded).toBe('forfait');
  });

  it('des points de joueur non numériques ne cassent pas le calcul', () => {
    const r = ffttMatchPoints({ playerPoints: Number.NaN, opponentPoints: 500, victory: false });
    expect(Number.isFinite(r.points)).toBe(true);
  });
});

// =============================================================================
// Coefficient : lecture et mise en forme
// =============================================================================

describe('parsePointsCoefficient', () => {
  it('accepte un nombre et une chaîne', () => {
    expect(parsePointsCoefficient(1.5)).toBe(1.5);
    expect(parsePointsCoefficient('1.5')).toBe(1.5);
  });

  it('accepte la virgule décimale', () => {
    expect(parsePointsCoefficient('0,75')).toBe(0.75);
  });

  it('retombe sur le défaut pour toute valeur inexploitable', () => {
    expect(parsePointsCoefficient(null)).toBe(DEFAULT_POINTS_COEFFICIENT);
    expect(parsePointsCoefficient(undefined)).toBe(DEFAULT_POINTS_COEFFICIENT);
    expect(parsePointsCoefficient('')).toBe(DEFAULT_POINTS_COEFFICIENT);
    expect(parsePointsCoefficient('abc')).toBe(DEFAULT_POINTS_COEFFICIENT);
    expect(parsePointsCoefficient(Number.NaN)).toBe(DEFAULT_POINTS_COEFFICIENT);
  });

  it('refuse les valeurs hors bornes', () => {
    expect(parsePointsCoefficient(0)).toBe(DEFAULT_POINTS_COEFFICIENT);
    expect(parsePointsCoefficient(-1)).toBe(DEFAULT_POINTS_COEFFICIENT);
    expect(parsePointsCoefficient(10)).toBe(DEFAULT_POINTS_COEFFICIENT);
  });

  it('accepte les bornes elles-mêmes', () => {
    expect(parsePointsCoefficient(0.25)).toBe(0.25);
    expect(parsePointsCoefficient(3)).toBe(3);
  });
});

describe('formatPoints', () => {
  it('n’affiche pas de décimale inutile', () => {
    expect(formatPoints(6)).toBe('6');
    expect(formatPoints(6, true)).toBe('+6');
  });

  it('affiche les décimales significatives seulement', () => {
    expect(formatPoints(4.5, true)).toBe('+4,5');
    expect(formatPoints(4.13, true)).toBe('+4,13');
  });

  it('utilise le signe moins typographique', () => {
    expect(formatPoints(-9.37)).toBe('−9,37');
    expect(formatPoints(-5, true)).toBe('−5');
  });

  it('zéro ne porte jamais de signe', () => {
    expect(formatPoints(0, true)).toBe('0');
  });

  it('protège contre une valeur non numérique', () => {
    expect(formatPoints(Number.NaN)).toBe('0');
  });
});

describe('formatCoefficient', () => {
  it('affiche la virgule décimale', () => {
    expect(formatCoefficient(0.75)).toBe('0,75');
    expect(formatCoefficient(1)).toBe('1');
  });
});
