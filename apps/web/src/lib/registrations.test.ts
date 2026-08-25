import { describe, it, expect } from 'vitest';
import {
  MAX_BRACKETS_PER_DAY,
  FILL_OPEN_RATIO,
  bracketScopeKey,
  findDailyQuotaViolation,
  findPointsWindowViolation,
  hasPointsWindow,
  isOpenByFill,
  pointsWindowMessage,
  type BracketDay,
  type BracketPointsWindow,
  type PlayerRanking,
} from './registrations';

const b = (id: string, name: string, day: string | null, tournamentId = 'T1'): BracketDay => ({
  id,
  name,
  tournamentId,
  day,
});

describe('Quota d’inscription — 2 tableaux par jour', () => {
  it('accepte 2 tableaux sur la même journée', () => {
    const incoming = [b('1', 'A', 'Samedi'), b('2', 'B', 'Samedi')];
    expect(findDailyQuotaViolation([], incoming)).toBeNull();
  });

  it('refuse le 3e tableau d’une même journée', () => {
    const incoming = [b('1', 'A', 'Samedi'), b('2', 'B', 'Samedi'), b('3', 'C', 'Samedi')];
    const v = findDailyQuotaViolation([], incoming);
    expect(v?.bracket.id).toBe('3');
    expect(v?.day).toBe('Samedi');
  });

  it('autorise 2 tableaux par journée sur deux journées différentes', () => {
    const incoming = [
      b('1', 'A', 'Samedi'),
      b('2', 'B', 'Samedi'),
      b('3', 'C', 'Dimanche'),
      b('4', 'D', 'Dimanche'),
    ];
    // 4 tableaux au total : refusé par une limite globale, accepté par la règle FFTT.
    expect(findDailyQuotaViolation([], incoming)).toBeNull();
  });

  it('tient compte des inscriptions déjà validées', () => {
    const existing = [b('1', 'A', 'Samedi')];
    expect(findDailyQuotaViolation(existing, [b('2', 'B', 'Samedi')])).toBeNull();
    const v = findDailyQuotaViolation(existing, [b('2', 'B', 'Samedi'), b('3', 'C', 'Samedi')]);
    expect(v?.bracket.id).toBe('3');
  });

  it('est idempotent : réinscrire à un tableau déjà pris ne consomme pas de quota', () => {
    const existing = [b('1', 'A', 'Samedi'), b('2', 'B', 'Samedi')];
    expect(findDailyQuotaViolation(existing, [b('1', 'A', 'Samedi')])).toBeNull();
  });

  it('ignore les doublons dans la demande', () => {
    const incoming = [b('1', 'A', 'Samedi'), b('1', 'A', 'Samedi'), b('2', 'B', 'Samedi')];
    expect(findDailyQuotaViolation([], incoming)).toBeNull();
  });

  it('regroupe les tableaux sans journée dans leur propre compteur', () => {
    expect(bracketScopeKey({ tournamentId: 'T1', day: null })).not.toBe(
      bracketScopeKey({ tournamentId: 'T1', day: 'Samedi' }),
    );
    // 2 sans journée + 2 le samedi : aucun groupe ne dépasse la limite.
    const incoming = [
      b('1', 'A', null),
      b('2', 'B', null),
      b('3', 'C', 'Samedi'),
      b('4', 'D', 'Samedi'),
    ];
    expect(findDailyQuotaViolation([], incoming)).toBeNull();
    // Le 3e sans journée dépasse.
    const v = findDailyQuotaViolation([], [...incoming, b('5', 'E', null)]);
    expect(v?.bracket.id).toBe('5');
    expect(v?.day).toBeNull();
  });

  it('cloisonne le quota par tournoi — deux tournois ont des dates distinctes', () => {
    // « Samedi » du tournoi T1 et « Samedi » du tournoi T2 ne désignent pas le
    // même jour : consommer le quota de l'un sur l'autre serait une erreur.
    const incoming = [
      b('1', 'A', 'Samedi', 'T1'),
      b('2', 'B', 'Samedi', 'T1'),
      b('3', 'C', 'Samedi', 'T2'),
      b('4', 'D', 'Samedi', 'T2'),
    ];
    expect(findDailyQuotaViolation([], incoming)).toBeNull();
    // Le 3e sur T1 dépasse, sans que T2 y soit pour quelque chose.
    const v = findDailyQuotaViolation([], [...incoming, b('5', 'E', 'Samedi', 'T1')]);
    expect(v?.bracket.id).toBe('5');
  });

  it('distingue deux tournois dans la clé de portée', () => {
    expect(bracketScopeKey({ tournamentId: 'T1', day: 'Samedi' })).not.toBe(
      bracketScopeKey({ tournamentId: 'T2', day: 'Samedi' }),
    );
    // Aucun recollement possible entre identifiant et libellé.
    expect(bracketScopeKey({ tournamentId: 'A', day: 'BC' })).not.toBe(
      bracketScopeKey({ tournamentId: 'AB', day: 'C' }),
    );
  });

  it('expose une limite de 2', () => {
    expect(MAX_BRACKETS_PER_DAY).toBe(2);
  });
});

const win = (
  name: string,
  minPoints: number | null,
  maxPoints: number | null,
  fill?: { maxPlayers: number; registeredCount: number },
): BracketPointsWindow => ({
  id: name,
  name,
  minPoints,
  maxPoints,
  // Par défaut un tableau vide : la fenêtre de points s'applique pleinement.
  maxPlayers: fill?.maxPlayers ?? 32,
  registeredCount: fill?.registeredCount ?? 0,
});

/** Fiche dont le classement provient de la fédération. */
const checked = (points: number): PlayerRanking => ({
  points,
  ffttSyncedAt: new Date('2026-08-01T10:00:00Z'),
});

/** Fiche jamais confrontée à la base fédérale. */
const unchecked = (points: number): PlayerRanking => ({ points, ffttSyncedAt: null });

describe('Fenêtre de points — règle FFTT', () => {
  it('accepte un joueur dans la fenêtre', () => {
    expect(findPointsWindowViolation([win('Série 900-1300', 900, 1300)], checked(1100))).toBeNull();
  });

  it('accepte un joueur pile sur chaque borne — les limites sont inclusives', () => {
    const t = [win('Série 900-1300', 900, 1300)];
    expect(findPointsWindowViolation(t, checked(900))).toBeNull();
    expect(findPointsWindowViolation(t, checked(1300))).toBeNull();
  });

  it('refuse un joueur au-dessus du plafond', () => {
    const v = findPointsWindowViolation([win('Moins de 1099 points', null, 1099)], checked(1400));
    expect(v?.reason).toBe('above_max');
    expect(v?.points).toBe(1400);
  });

  it('refuse un joueur sous le plancher — viser plus fort n’est plus autorisé', () => {
    const v = findPointsWindowViolation([win('Élite', 1500, null)], checked(900));
    expect(v?.reason).toBe('below_min');
    expect(v?.bracket.name).toBe('Élite');
  });

  it('laisse passer un tableau Toutes Séries, quel que soit le classement', () => {
    const open = [win('Toutes Séries', null, null)];
    expect(findPointsWindowViolation(open, checked(3200))).toBeNull();
    expect(findPointsWindowViolation(open, checked(500))).toBeNull();
  });

  it('dispense le tableau Toutes Séries de vérification FFTT', () => {
    // Sans borne, il n'y a rien à comparer : exiger la synchro n'aurait
    // aucun objet et fermerait la seule porte des joueurs non licenciés.
    expect(findPointsWindowViolation([win('Toutes Séries', null, null)], unchecked(500))).toBeNull();
  });

  it('refuse tout tableau borné tant que le classement n’est pas vérifié', () => {
    const v = findPointsWindowViolation([win('Moins de 1099 points', null, 1099)], unchecked(600));
    expect(v?.reason).toBe('unverified');
  });

  it('donne le défaut de vérification comme motif, même si la fenêtre est violée', () => {
    // Le joueur ne peut agir que sur la synchronisation : c'est ce qu'il faut
    // lui dire. Annoncer « classement trop élevé » sur des points non
    // certifiés serait au surplus infondé.
    const v = findPointsWindowViolation([win('-900', null, 900)], unchecked(1400));
    expect(v?.reason).toBe('unverified');
  });

  it('signale le premier tableau fautif d’une demande multiple', () => {
    const demande = [win('Toutes Séries', null, null), win('-900', null, 900), win('-700', null, 700)];
    expect(findPointsWindowViolation(demande, checked(1000))?.bracket.name).toBe('-900');
  });

  it('arrondit le classement flottant issu du swap FFTT', () => {
    expect(findPointsWindowViolation([win('-900', null, 900)], checked(900.4))).toBeNull();
    expect(findPointsWindowViolation([win('-900', null, 900)], checked(900.6))?.points).toBe(901);
  });

  it('refuse un classement illisible sur un tableau borné', () => {
    const v = findPointsWindowViolation([win('-900', null, 900)], {
      points: Number.NaN,
      ffttSyncedAt: new Date(),
    });
    expect(v?.reason).toBe('unverified');
  });

  it('reconnaît les tableaux sans borne', () => {
    expect(hasPointsWindow(win('Open', null, null))).toBe(false);
    expect(hasPointsWindow(win('Plafond', null, 900))).toBe(true);
    expect(hasPointsWindow(win('Plancher', 900, null))).toBe(true);
  });

  it('produit un message actionnable pour chaque motif', () => {
    const above = pointsWindowMessage(
      findPointsWindowViolation([win('Moins de 1099 points', null, 1099)], checked(1400))!,
    );
    expect(above).toContain('Moins de 1099 points');
    expect(above).toContain('1099');
    expect(above).toContain('1400');

    const below = pointsWindowMessage(
      findPointsWindowViolation([win('Élite', 1500, null)], checked(900))!,
    );
    expect(below).toContain('1500');
    expect(below).toContain('900');

    const unverified = pointsWindowMessage(
      findPointsWindowViolation([win('-900', null, 900)], unchecked(600))!,
    );
    expect(unverified).toContain('FFTT');
  });
});

describe('Ouverture par remplissage — seuil de 70 %', () => {
  it('expose un seuil de 70 %', () => {
    expect(FILL_OPEN_RATIO).toBe(0.7);
  });

  it('lève la fenêtre de points dès le seuil atteint', () => {
    // 14/20 = 70 % : un joueur de 1400 pts entre sur un tableau « -900 ».
    const plein = win('-900', null, 900, { maxPlayers: 20, registeredCount: 14 });
    expect(findPointsWindowViolation([plein], checked(1400))).toBeNull();
  });

  it('applique encore la fenêtre juste sous le seuil', () => {
    // 13/20 = 65 %.
    const presque = win('-900', null, 900, { maxPlayers: 20, registeredCount: 13 });
    expect(findPointsWindowViolation([presque], checked(1400))?.reason).toBe('above_max');
  });

  it('lève aussi le plancher de points', () => {
    const plein = win('Élite', 1500, null, { maxPlayers: 10, registeredCount: 7 });
    expect(findPointsWindowViolation([plein], checked(900))).toBeNull();
  });

  it('lève l’exigence de classement vérifié', () => {
    // Cette exigence n'existait que pour appliquer la fenêtre : la maintenir
    // seule refuserait le joueur sans qu'aucune borne ne lui soit opposée.
    const plein = win('-900', null, 900, { maxPlayers: 10, registeredCount: 7 });
    expect(findPointsWindowViolation([plein], unchecked(1400))).toBeNull();
  });

  it('n’ouvre rien sans jauge exploitable', () => {
    expect(isOpenByFill({ maxPlayers: 0, registeredCount: 5 })).toBe(false);
    expect(isOpenByFill({ maxPlayers: 10, registeredCount: -1 })).toBe(false);
    expect(isOpenByFill({ maxPlayers: Number.NaN, registeredCount: 5 })).toBe(false);
  });

  it('reste vrai au-delà du seuil, jusqu’au tableau complet', () => {
    expect(isOpenByFill({ maxPlayers: 10, registeredCount: 7 })).toBe(true);
    expect(isOpenByFill({ maxPlayers: 10, registeredCount: 10 })).toBe(true);
    expect(isOpenByFill({ maxPlayers: 10, registeredCount: 6 })).toBe(false);
  });
});

