/**
 * Middleware Next.js — vérification JWT + RBAC sur les routes protégées.
 *
 * Tourne en Edge Runtime → pas d'import argon2/bullmq/Prisma ici.
 * Utilise UNIQUEMENT @tt/auth/jwt qui est Edge-compatible (jose).
 *
 * Continuité de session
 * ---------------------
 * L'access token ne vit que 15 minutes, mais le cookie de refresh vit 7 jours.
 * Tant que ce dernier est présent, une navigation dont l'access token a expiré
 * ne renvoie PAS vers la page de connexion : elle passe par
 * `/api/auth/refresh`, qui régénère le couple de jetons puis renvoie
 * l'utilisateur sur la page demandée. La session ne se termine donc que sur
 * déconnexion explicite (ou après 7 jours d'inactivité).
 *
 * Le renouvellement ne peut pas être fait ici : il nécessite Prisma (contrôle
 * de révocation en base), indisponible en Edge Runtime.
 */

import { NextResponse, type NextRequest } from 'next/server';
import { verifyAccessToken, isJwtExpired } from '@tt/auth/jwt';
import { findRoutePolicy, hasRole } from '@tt/auth/rbac';

const ACCESS_COOKIE = 'tt_access';
const REFRESH_COOKIE = 'tt_refresh';

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // Bypass : assets statiques, API auth publiques, API health
  if (
    pathname.startsWith('/_next') ||
    pathname.startsWith('/icons') ||
    pathname.startsWith('/fonts') ||
    pathname === '/manifest.webmanifest' ||
    pathname === '/sw.js' ||
    pathname.startsWith('/api/auth/login') ||
    pathname.startsWith('/api/auth/refresh') ||
    pathname.startsWith('/api/auth/logout') ||
    pathname.startsWith('/api/auth/register') ||
    pathname.startsWith('/api/auth/forgot-password') ||
    pathname.startsWith('/api/auth/reset-password') ||
    pathname.startsWith('/api/auth/verify-email') ||
    pathname.startsWith('/api/auth/resend-verification') ||
    pathname.startsWith('/api/health')
  ) {
    return NextResponse.next();
  }

  const isApi = pathname.startsWith('/api/');
  const hasRefresh = Boolean(req.cookies.get(REFRESH_COOKIE)?.value);
  const token = req.cookies.get(ACCESS_COOKIE)?.value;

  const policy = findRoutePolicy(pathname);
  const isPublic = !policy || policy.includes('visitor');

  if (token) {
    try {
      const claims = await verifyAccessToken(token);
      if (!isPublic && !hasRole(claims.role, policy!)) {
        // Authentifié mais rôle insuffisant : ce n'est pas un problème de
        // session, inutile de renvoyer vers la connexion avec un refresh.
        if (isApi) {
          return NextResponse.json({ error: 'Accès refusé', code: 'forbidden' }, { status: 403 });
        }
        return NextResponse.redirect(new URL('/login?error=forbidden', req.url));
      }
      const res = NextResponse.next();
      res.headers.set('x-user-role', claims.role);
      res.headers.set('x-user-id', claims.sub);
      if (claims.playerId) res.headers.set('x-player-id', claims.playerId);
      return res;
    } catch (err) {
      if (!isJwtExpired(err)) {
        // Jeton corrompu ou signature invalide : on repart de zéro.
        return isPublic ? continueAnonymously() : rejectSession(req, isApi, 'invalid');
      }
      // Expiré : traité juste en dessous, comme une absence de jeton.
    }
  }

  // Ici : aucun access token exploitable.

  // Session encore ouverte côté refresh → renouvellement transparent.
  // Réservé aux navigations de page : une réponse 302 vers du HTML casserait
  // un appel `fetch` qui attend du JSON.
  //
  // Les préchargements de <Link> sont exclus : Next en émet plusieurs en
  // parallèle, et la rotation des refresh tokens interprète la présentation
  // concurrente d'un même jeton comme un rejeu — ce qui révoquerait TOUTES
  // les sessions de l'utilisateur. La navigation réelle fera le renouvellement.
  const isPrefetch =
    req.headers.get('next-router-prefetch') === '1' ||
    req.headers.get('purpose') === 'prefetch';

  if (hasRefresh && !isApi && !isPrefetch) {
    const url = new URL('/api/auth/refresh', req.url);
    url.searchParams.set('redirect', pathname + req.nextUrl.search);
    return NextResponse.redirect(url);
  }

  if (isPublic) return continueAnonymously();

  return rejectSession(req, isApi, 'expired');
}

function continueAnonymously() {
  return NextResponse.next();
}

/**
 * Fin de session : 401 JSON pour les appels API (le client tentera un
 * renouvellement puis rejouera la requête), redirection sinon.
 */
function rejectSession(req: NextRequest, isApi: boolean, reason: string) {
  if (isApi) {
    const res = NextResponse.json(
      { error: 'Authentification requise', code: 'unauthorized' },
      { status: 401 },
    );
    if (reason === 'invalid') res.cookies.delete(ACCESS_COOKIE);
    return res;
  }

  const url = new URL('/login', req.url);
  url.searchParams.set('redirect', req.nextUrl.pathname);
  url.searchParams.set('reason', reason);
  const res = NextResponse.redirect(url);
  // Le cookie d'access inexploitable est supprimé pour éviter de le
  // représenter à chaque requête suivante.
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
