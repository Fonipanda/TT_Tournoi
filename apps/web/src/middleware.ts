/**
 * Middleware Next.js — vérification JWT + RBAC sur les routes protégées.
 *
 * Tourne en Edge Runtime → pas d'import argon2/bullmq/Prisma ici.
 * Utilise UNIQUEMENT @tt/auth/jwt qui est Edge-compatible (jose).
 */

import { NextResponse, type NextRequest } from 'next/server';
import { verifyAccessToken, isJwtExpired } from '@tt/auth/jwt';
import { findRoutePolicy, hasRole } from '@tt/auth/rbac';

const ACCESS_COOKIE = 'tt_access';
const REFRESH_COOKIE = 'tt_refresh';

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // Bypass : assets statiques, API auth (login/refresh public), API health
  if (
    pathname.startsWith('/_next') ||
    pathname.startsWith('/icons') ||
    pathname.startsWith('/fonts') ||
    pathname === '/manifest.webmanifest' ||
    pathname === '/sw.js' ||
    pathname.startsWith('/api/auth/login') ||
    pathname.startsWith('/api/auth/refresh') ||
    pathname.startsWith('/api/health')
  ) {
    return NextResponse.next();
  }

  const policy = findRoutePolicy(pathname);

  // Routes publiques : aucune vérification, on continue
  if (!policy || policy.includes('visitor')) {
    // mais on tente quand même de décoder le token pour exposer le rôle
    const token = req.cookies.get(ACCESS_COOKIE)?.value;
    if (token) {
      try {
        const claims = await verifyAccessToken(token);
        const res = NextResponse.next();
        res.headers.set('x-user-role', claims.role);
        res.headers.set('x-user-id', claims.sub);
        return res;
      } catch {
        // token invalide/expiré, mais route publique → on laisse passer
      }
    }
    return NextResponse.next();
  }

  // Route protégée : il faut un token valide
  const token = req.cookies.get(ACCESS_COOKIE)?.value;
  if (!token) {
    return redirectToLogin(req);
  }

  try {
    const claims = await verifyAccessToken(token);
    if (!hasRole(claims.role, policy)) {
      // authentifié mais rôle insuffisant
      return NextResponse.redirect(new URL('/login?error=forbidden', req.url));
    }
    const res = NextResponse.next();
    res.headers.set('x-user-role', claims.role);
    res.headers.set('x-user-id', claims.sub);
    if (claims.playerId) res.headers.set('x-player-id', claims.playerId);
    return res;
  } catch (err) {
    if (isJwtExpired(err)) {
      // Le client doit appeler /api/auth/refresh — on redirige vers login
      // qui détectera le cookie refresh et relancera un access.
      return redirectToLogin(req, 'expired');
    }
    return redirectToLogin(req, 'invalid');
  }
}

function redirectToLogin(req: NextRequest, reason?: string) {
  const url = new URL('/login', req.url);
  url.searchParams.set('redirect', req.nextUrl.pathname);
  if (reason) url.searchParams.set('reason', reason);
  const res = NextResponse.redirect(url);
  // En cas d'access invalide, on supprime le cookie corrompu
  res.cookies.delete(ACCESS_COOKIE);
  return res;
}

// Le middleware tourne sur tout sauf assets statiques et /api/auth public
export const config = {
  matcher: [
    /*
     * Match toutes les routes sauf :
     * - _next (assets internes Next)
     * - icons, fonts (assets PWA)
     * - manifest.webmanifest, sw.js (PWA)
     * - favicon.ico
     */
    '/((?!_next|icons|fonts|manifest.webmanifest|sw.js|favicon.ico).*)',
  ],
};
