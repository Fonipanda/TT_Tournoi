import { describe, it, expect } from 'vitest';
import {
  hasRole,
  hasExactRole,
  assertRole,
  findRoutePolicy,
  ForbiddenError,
  UnauthorizedError,
} from './rbac';

describe('RBAC — hasRole', () => {
  it('admin a accès à tout (super-user)', () => {
    expect(hasRole('admin', ['player'])).toBe(true);
    expect(hasRole('admin', ['juge_arbitre'])).toBe(true);
    expect(hasRole('admin', ['visitor'])).toBe(true);
  });

  it('player accède aux routes player', () => {
    expect(hasRole('player', ['player'])).toBe(true);
    expect(hasRole('player', ['admin'])).toBe(false);
  });

  it('visiteur (null/undefined) accès limité', () => {
    expect(hasRole(null, ['visitor'])).toBe(true);
    expect(hasRole(null, ['player'])).toBe(false);
    expect(hasRole(undefined, ['admin'])).toBe(false);
  });
});

describe('RBAC — hasExactRole (sans bypass admin)', () => {
  it('admin n\'est pas implicitement juge-arbitre', () => {
    expect(hasExactRole('admin', ['juge_arbitre'])).toBe(false);
    expect(hasExactRole('juge_arbitre', ['juge_arbitre'])).toBe(true);
  });
});

describe('RBAC — assertRole', () => {
  it('lance UnauthorizedError pour role null', () => {
    expect(() => assertRole(null, ['player'])).toThrow(UnauthorizedError);
  });
  it('lance ForbiddenError pour role insuffisant', () => {
    expect(() => assertRole('player', ['admin'])).toThrow(ForbiddenError);
  });
  it('passe pour admin', () => {
    expect(() => assertRole('admin', ['player'])).not.toThrow();
  });
});

describe('RBAC — findRoutePolicy', () => {
  it('match exact /admin', () => {
    const p = findRoutePolicy('/admin');
    expect(p).toEqual(['admin']);
  });
  it('match préfixe /admin/joueurs', () => {
    const p = findRoutePolicy('/admin/joueurs');
    expect(p).toEqual(['admin']);
  });
  it('match /juge-arbitre', () => {
    expect(findRoutePolicy('/juge-arbitre')).toEqual(['juge_arbitre']);
  });
  it('routes publiques accessibles à tous', () => {
    expect(findRoutePolicy('/live')).toContain('visitor');
    expect(findRoutePolicy('/buvette')).toContain('visitor');
  });
  it('retourne null pour route inconnue', () => {
    expect(findRoutePolicy('/unknown')).toBe(null);
  });
});
