import { describe, it, expect } from 'vitest';
import { normalizePhone, normalizePhoneOrNull, isValidPhone } from './phone';

describe('normalizePhone', () => {
  it('convertit un numéro national français', () => {
    expect(normalizePhone('0612345678')).toEqual({ ok: true, e164: '+33612345678' });
  });

  it('accepte les séparateurs usuels', () => {
    for (const input of [
      '06 12 34 56 78',
      '06.12.34.56.78',
      '06-12-34-56-78',
      ' 06 12 34 56 78 ',
      '(0)6 12 34 56 78'.replace('(0)', '0'),
    ]) {
      expect(normalizePhone(input)).toEqual({ ok: true, e164: '+33612345678' });
    }
  });

  it('gère les espaces insécables', () => {
    expect(normalizePhone('06\u00a012\u00a034\u00a056\u00a078')).toEqual({
      ok: true,
      e164: '+33612345678',
    });
  });

  it('conserve un numéro déjà en E.164', () => {
    expect(normalizePhone('+33612345678')).toEqual({ ok: true, e164: '+33612345678' });
  });

  it('normalise le préfixe 0033', () => {
    expect(normalizePhone('0033612345678')).toEqual({ ok: true, e164: '+33612345678' });
  });

  it('accepte un numéro étranger au format international', () => {
    expect(normalizePhone('+32470123456')).toEqual({ ok: true, e164: '+32470123456' });
  });

  it('rejette une chaîne vide', () => {
    expect(normalizePhone('')).toEqual({ ok: false, reason: 'numéro vide' });
    expect(normalizePhone(null)).toEqual({ ok: false, reason: 'numéro vide' });
    expect(normalizePhone(undefined)).toEqual({ ok: false, reason: 'numéro vide' });
  });

  it('rejette un numéro trop court', () => {
    const res = normalizePhone('0612');
    expect(res.ok).toBe(false);
  });

  it('rejette un numéro trop long', () => {
    const res = normalizePhone('+3361234567890123456');
    expect(res.ok).toBe(false);
  });

  it('rejette un texte sans chiffre', () => {
    const res = normalizePhone('non communiqué');
    expect(res.ok).toBe(false);
  });

  it('rejette un format non reconnu', () => {
    const res = normalizePhone('612345678');
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.reason).toContain('format non reconnu');
  });
});

describe('normalizePhoneOrNull', () => {
  it('renvoie le numéro normalisé', () => {
    expect(normalizePhoneOrNull('06 12 34 56 78')).toBe('+33612345678');
  });

  it('renvoie null si inexploitable', () => {
    expect(normalizePhoneOrNull('inconnu')).toBeNull();
    expect(normalizePhoneOrNull('')).toBeNull();
  });
});

describe('isValidPhone', () => {
  it('discrimine les numéros exploitables', () => {
    expect(isValidPhone('0612345678')).toBe(true);
    expect(isValidPhone('06')).toBe(false);
  });
});
