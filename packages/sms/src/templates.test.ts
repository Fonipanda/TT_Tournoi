import { describe, it, expect } from 'vitest';
import { renderTemplate, countSegments, SMS_TEMPLATE_VARIABLES } from './templates';

describe('renderTemplate', () => {
  it('remplace les variables', () => {
    const out = renderTemplate('Bonjour {joueur}, table {table}', { joueur: 'DUPONT', table: 5 });
    expect(out).toBe('Bonjour DUPONT, table 5');
  });

  it('variables manquantes deviennent vides', () => {
    const out = renderTemplate('Hello {nom} dans {salle}', { nom: 'Jean' });
    expect(out).toBe('Hello Jean dans ');
  });

  it('ne casse pas si pas de placeholder', () => {
    expect(renderTemplate('texte simple')).toBe('texte simple');
  });

  it('SMS_TEMPLATE_VARIABLES contient les 7 variables documentées', () => {
    expect(SMS_TEMPLATE_VARIABLES).toHaveLength(7);
    expect(SMS_TEMPLATE_VARIABLES.map((v) => v.name)).toEqual([
      'joueur',
      'table',
      'tableau',
      'adversaire',
      'heure',
      'salle',
      'message',
    ]);
  });
});

describe('countSegments', () => {
  it('1 segment GSM-7 si <= 160 chars', () => {
    expect(countSegments('a'.repeat(160))).toEqual({ segments: 1, chars: 160, encoding: 'GSM-7' });
  });
  it('2 segments GSM-7 si > 160 chars (153 ch/segment)', () => {
    const r = countSegments('a'.repeat(161));
    expect(r.segments).toBe(2);
    expect(r.encoding).toBe('GSM-7');
  });
  it('UCS-2 si emoji', () => {
    const r = countSegments('Hello 🎾');
    expect(r.encoding).toBe('UCS-2');
    expect(r.segments).toBe(1);
  });
  it('GSM-7 accepte les accents européens', () => {
    expect(countSegments('Bonjour à tous, café et thé').encoding).toBe('GSM-7');
  });
});
