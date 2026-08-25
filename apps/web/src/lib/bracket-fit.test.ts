import { describe, it, expect } from 'vitest';
import {
  STRETCH_GAP,
  computeBracketFits,
  describeRange,
  isStretch,
  type BracketFitInput,
} from './bracket-fit';

const b = (
  id: string,
  minPoints: number | null,
  maxPoints: number | null,
  day: string | null = 'Samedi',
  fill?: { maxPlayers: number; registeredCount: number; tournamentId?: string },
): BracketFitInput => ({
  id,
  tournamentId: fill?.tournamentId ?? 'T1',
  day,
  minPoints,
  maxPoints,
  // Par défaut un tableau vide : la fenêtre de points s'applique pleinement.
  maxPlayers: fill?.maxPlayers ?? 32,
  registeredCount: fill?.registeredCount ?? 0,
});

/** Classement vérifié auprès de la FFTT — cas nominal. */
const verified = (points: number) => ({ points, verified: true });

/** Raccourci de lecture : niveau attribué à un tableau. */
const level = (list: BracketFitInput[], points: number, id: string) =>
  computeBracketFits(list, verified(points)).get(id)?.level;

describe('Fenêtre de points — lecture joueur', () => {
  it('recommande le tableau dont le plafond serre au plus près le classement', () => {
    const list = [b('700', null, 700), b('1000', null, 1000), b('1500', null, 1500)];
    // 650 pts : les trois sont ouverts, mais « ≤ 700 » est taillé pour lui.
    const fits = computeBracketFits(list, verified(650));
    expect(fits.get('700')?.level).toBe('recommended');
    expect(fits.get('1000')?.level).toBe('accessible');
    expect(fits.get('1500')?.level).toBe('accessible');
  });

  it('refuse un tableau réservé à plus fort que soi', () => {
    const list = [b('elite', 1500, null)];
    const fit = computeBracketFits(list, verified(1200)).get('elite');
    expect(fit?.level).toBe('stretch');
    expect(fit?.blocking).toBe(true);
  });

  it('distingue un cran au-dessus d’un pari nettement au-dessus', () => {
    const list = [b('proche', 1200, null), b('loin', 1900, null)];
    // 1000 pts : 200 d'écart, puis 900. Les deux sont refusés.
    expect(level(list, 1000, 'proche')).toBe('stretch');
    expect(level(list, 1000, 'loin')).toBe('far_stretch');
  });

  it('bascule sur far_stretch strictement au-delà du seuil', () => {
    const points = 1000;
    const list = [
      b('limite', points + STRETCH_GAP, null),
      b('au-dela', points + STRETCH_GAP + 1, null),
    ];
    expect(level(list, points, 'limite')).toBe('stretch');
    expect(level(list, points, 'au-dela')).toBe('far_stretch');
  });

  it('refuse le plafond de points dépassé', () => {
    const list = [b('petit', null, 900)];
    const fit = computeBracketFits(list, verified(1400)).get('petit');
    expect(fit?.level).toBe('closed');
    expect(fit?.blocking).toBe(true);
    expect(fit?.detail).toContain('900');
    expect(fit?.detail).toContain('1400');
  });

  it('accepte le joueur pile sur le plafond', () => {
    expect(level([b('x', null, 900)], 900, 'x')).toBe('recommended');
  });

  it('accepte le joueur pile sur le plancher', () => {
    expect(level([b('x', 900, 1200)], 900, 'x')).toBe('recommended');
  });

  it('n’ouvre jamais un tableau que le serveur refuserait', () => {
    // Invariant central : tout niveau autre que recommended/accessible bloque.
    const list = [
      b('trop-fort', 1500, null),
      b('trop-faible', null, 700),
      b('ok', null, 1500),
    ];
    const fits = computeBracketFits(list, verified(1000));
    expect(fits.get('trop-fort')?.blocking).toBe(true);
    expect(fits.get('trop-faible')?.blocking).toBe(true);
    expect(fits.get('ok')?.blocking).toBe(false);
  });

  it('juge le meilleur choix journée par journée', () => {
    const list = [
      b('sam-700', null, 700, 'Samedi'),
      b('sam-1500', null, 1500, 'Samedi'),
      b('dim-1200', null, 1200, 'Dimanche'),
      b('dim-2000', null, 2000, 'Dimanche'),
    ];
    const fits = computeBracketFits(list, verified(650));
    // Un tableau recommandé pour chaque journée, pas un seul sur les quatre.
    expect(fits.get('sam-700')?.level).toBe('recommended');
    expect(fits.get('sam-1500')?.level).toBe('accessible');
    expect(fits.get('dim-1200')?.level).toBe('recommended');
    expect(fits.get('dim-2000')?.level).toBe('accessible');
  });

  it('ne recommande rien quand aucun tableau de la journée n’a de plafond', () => {
    const list = [b('ouvert-1', null, null), b('ouvert-2', 400, null)];
    const fits = computeBracketFits(list, verified(800));
    expect(fits.get('ouvert-1')?.level).toBe('accessible');
    expect(fits.get('ouvert-2')?.level).toBe('accessible');
  });

  it('recommande les ex æquo sans en privilégier un arbitrairement', () => {
    const list = [b('a', null, 1000), b('b', null, 1000)];
    const fits = computeBracketFits(list, verified(800));
    expect(fits.get('a')?.level).toBe('recommended');
    expect(fits.get('b')?.level).toBe('recommended');
  });

  it('ignore les tableaux refusés dans le choix du recommandé', () => {
    const list = [b('trop-petit', null, 700), b('juste', null, 1200)];
    const fits = computeBracketFits(list, verified(900));
    expect(fits.get('trop-petit')?.level).toBe('closed');
    // Sans exclusion, l'écart négatif de « ≤ 700 » l'aurait emporté.
    expect(fits.get('juste')?.level).toBe('recommended');
  });

  it('ne conseille rien si le classement est inconnu', () => {
    const list = [b('x', null, 900)];
    expect(computeBracketFits(list, { points: null, verified: true }).size).toBe(0);
    expect(computeBracketFits(list, { points: undefined, verified: true }).size).toBe(0);
    expect(computeBracketFits(list, { points: Number.NaN, verified: true }).size).toBe(0);
  });

  it('arrondit les points FFTT décimaux', () => {
    // Les points sont stockés en flottant (swap FFTT).
    expect(level([b('x', null, 900)], 900.4, 'x')).toBe('recommended');
    const fit = computeBracketFits([b('x', null, 900)], verified(900.6)).get('x');
    expect(fit?.level).toBe('closed');
    expect(fit?.detail).toContain('901');
  });

  it('regroupe les tableaux sans journée dans leur propre comparaison', () => {
    const list = [b('sans-jour', null, 800, null), b('samedi', null, 700, 'Samedi')];
    const fits = computeBracketFits(list, verified(650));
    expect(fits.get('sans-jour')?.level).toBe('recommended');
    expect(fits.get('samedi')?.level).toBe('recommended');
  });

  it('expose les niveaux « au-dessus » via isStretch', () => {
    expect(isStretch('stretch')).toBe(true);
    expect(isStretch('far_stretch')).toBe(true);
    expect(isStretch('recommended')).toBe(false);
    expect(isStretch('accessible')).toBe(false);
    expect(isStretch('closed')).toBe(false);
    expect(isStretch('unverified')).toBe(false);
    expect(isStretch('open_fill')).toBe(false);
  });

  it('décrit la fenêtre de points de façon lisible', () => {
    expect(describeRange({ minPoints: 500, maxPoints: 900 })).toBe('De 500 à 900 pts');
    expect(describeRange({ minPoints: null, maxPoints: 900 })).toBe("Jusqu'à 900 pts");
    expect(describeRange({ minPoints: 1500, maxPoints: null })).toBe('À partir de 1500 pts');
    expect(describeRange({ minPoints: null, maxPoints: null })).toBe(
      'Ouvert à tous les classements',
    );
  });
});

describe('Classement non vérifié', () => {
  const unverified = (points: number) => ({ points, verified: false });

  it('verrouille tout tableau comportant une borne', () => {
    const list = [b('plafond', null, 900), b('plancher', 400, null), b('fenetre', 400, 900)];
    const fits = computeBracketFits(list, unverified(600));
    for (const id of ['plafond', 'plancher', 'fenetre']) {
      expect(fits.get(id)?.level).toBe('unverified');
      expect(fits.get(id)?.blocking).toBe(true);
    }
  });

  it('laisse ouvert un tableau Toutes Séries', () => {
    const fits = computeBracketFits([b('open', null, null)], unverified(600));
    expect(fits.get('open')?.level).toBe('accessible');
    expect(fits.get('open')?.blocking).toBe(false);
  });

  it('prime sur la comparaison de points : on ne compare pas un classement douteux', () => {
    // 1400 pts dépasserait le plafond, mais le motif affiché doit rester le
    // défaut de vérification — c'est lui qui est actionnable par le joueur.
    const fits = computeBracketFits([b('petit', null, 900)], unverified(1400));
    expect(fits.get('petit')?.level).toBe('unverified');
  });

  it('invite explicitement à synchroniser', () => {
    const fits = computeBracketFits([b('x', null, 900)], unverified(600));
    expect(fits.get('x')?.detail).toContain('FFTT');
  });

  it('n’exige plus la vérification sur un tableau rempli au seuil', () => {
    const plein = b('x', null, 900, 'Samedi', { maxPlayers: 10, registeredCount: 7 });
    const fits = computeBracketFits([plein], unverified(1400));
    expect(fits.get('x')?.level).toBe('open_fill');
    expect(fits.get('x')?.blocking).toBe(false);
  });
});

describe('Ouverture par remplissage — lecture joueur', () => {
  it('ouvre un tableau plafonné au joueur trop bien classé', () => {
    const plein = b('petit', null, 900, 'Samedi', { maxPlayers: 20, registeredCount: 14 });
    const fit = computeBracketFits([plein], verified(1400)).get('petit');
    expect(fit?.level).toBe('open_fill');
    expect(fit?.blocking).toBe(false);
    expect(fit?.detail).toContain('70');
  });

  it('ouvre un tableau à plancher au joueur trop faible', () => {
    const plein = b('elite', 1500, null, 'Samedi', { maxPlayers: 10, registeredCount: 7 });
    expect(computeBracketFits([plein], verified(900)).get('elite')?.level).toBe('open_fill');
  });

  it('bloque encore juste sous le seuil', () => {
    const presque = b('petit', null, 900, 'Samedi', { maxPlayers: 20, registeredCount: 13 });
    const fit = computeBracketFits([presque], verified(1400)).get('petit');
    expect(fit?.level).toBe('closed');
    expect(fit?.blocking).toBe(true);
  });

  it('garde le verdict habituel pour le joueur qui respecte la fenêtre', () => {
    // Lui afficher « ouvert à tous » masquerait que ce tableau est, pour lui,
    // le choix ajusté.
    const plein = b('petit', null, 900, 'Samedi', { maxPlayers: 20, registeredCount: 14 });
    expect(computeBracketFits([plein], verified(800)).get('petit')?.level).toBe('recommended');
  });

  it('ne perturbe pas le choix du recommandé', () => {
    const list = [
      b('plein-700', null, 700, 'Samedi', { maxPlayers: 10, registeredCount: 8 }),
      b('juste', null, 1200, 'Samedi'),
    ];
    const fits = computeBracketFits(list, verified(900));
    // « ≤ 700 » n'est ouvert que par remplissage : il ne doit pas voler la
    // recommandation au tableau réellement taillé pour le joueur.
    expect(fits.get('plein-700')?.level).toBe('open_fill');
    expect(fits.get('juste')?.level).toBe('recommended');
  });

  it('n’affecte pas un tableau Toutes Séries', () => {
    const plein = b('open', null, null, 'Samedi', { maxPlayers: 10, registeredCount: 9 });
    expect(computeBracketFits([plein], verified(1400)).get('open')?.level).toBe('accessible');
  });

  it('sépare la recommandation par tournoi', () => {
    const list = [
      b('t1-700', null, 700, 'Samedi', { maxPlayers: 32, registeredCount: 0, tournamentId: 'T1' }),
      b('t2-1500', null, 1500, 'Samedi', { maxPlayers: 32, registeredCount: 0, tournamentId: 'T2' }),
    ];
    const fits = computeBracketFits(list, verified(650));
    // Sans cloisonnement, « ≤ 700 » aurait éclipsé « ≤ 1500 » d'un autre tournoi.
    expect(fits.get('t1-700')?.level).toBe('recommended');
    expect(fits.get('t2-1500')?.level).toBe('recommended');
  });
});
