/**
 * /api/auth/refresh — renouvelle le couple access/refresh.
 *
 * POST : appelé par le client (`api-client`) quand une requête reçoit un 401.
 *        Réponse JSON.
 * GET  : appelé par une redirection du middleware quand une **navigation**
 *        présente un access token expiré alors que le cookie de refresh est
 *        toujours valide. Renvoie l'utilisateur sur la page qu'il demandait,
 *        avec des cookies à jour : la session survit à la navigation.
 */

import { NextResponse, type NextRequest } from 'next/server';
import { ACCESS_COOKIE, REFRESH_COOKIE, tryRefreshTokens } from '@/lib/auth/server';

export async function POST() {
  const result = await tryRefreshTokens();
  if (!result) {
    const res = NextResponse.json({ error: 'Refresh invalide' }, { status: 401 });
    // Cookies inexploitables : on les retire pour ne pas boucler.
    res.cookies.delete(ACCESS_COOKIE);
    res.cookies.delete(REFRESH_COOKIE);
    return res;
  }
  return NextResponse.json({ user: result.user });
}

/**
 * N'accepte qu'un chemin interne : un `redirect` contrôlé par l'appelant
 * ouvrirait une redirection vers un domaine tiers (hameçonnage).
 */
function safeRedirect(raw: string | null): string {
  if (!raw) return '/';
  // Interdit les URLs absolues (`https://…`) et les URLs protocol-relative (`//…`).
  if (!raw.startsWith('/') || raw.startsWith('//')) return '/';
  // Ne jamais renvoyer sur cette route : boucle assurée.
  if (raw.startsWith('/api/auth/refresh')) return '/';
  return raw;
}

export async function GET(req: NextRequest) {
  const target = safeRedirect(req.nextUrl.searchParams.get('redirect'));
  const result = await tryRefreshTokens();

  if (!result) {
    // Refresh expiré, révoqué ou rejoué : la session est réellement terminée.
    const url = new URL('/login', req.url);
    url.searchParams.set('redirect', target);
    url.searchParams.set('reason', 'expired');
    const res = NextResponse.redirect(url);
    // Indispensable : sans suppression, le middleware redirigerait de nouveau
    // ici à la requête suivante, indéfiniment.
    res.cookies.delete(ACCESS_COOKIE);
    res.cookies.delete(REFRESH_COOKIE);
    return res;
  }

  const res = NextResponse.redirect(new URL(target, req.url));
  // Une réponse de renouvellement ne doit jamais être mise en cache.
  res.headers.set('Cache-Control', 'no-store');
  return res;
}
