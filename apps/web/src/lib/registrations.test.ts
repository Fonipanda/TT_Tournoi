import { describe, it, expect } from 'vitest';
import {
  MAX_BRACKETS_PER_DAY,
  bracketDayKey,
  findDailyQuotaViolation,
  type BracketDay,
} from './registrations';

const b = (id: string, name: string, day: string | null): BracketDay => ({ id, name, day });

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
    expect(bracketDayKey(null)).toBe('');
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

  it('expose une limite de 2', () => {
    expect(MAX_BRACKETS_PER_DAY).toBe(2);
  });
});
