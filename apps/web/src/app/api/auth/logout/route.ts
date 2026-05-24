/**
 * POST /api/auth/logout — révoque le refresh + clear cookies.
 */

import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { verifyRefreshToken } from '@tt/auth/jwt';
import { clearAuthCookies, revokeRefreshTokenById, REFRESH_COOKIE } from '@/lib/auth/server';

export async function POST() {
  const cookieStore = await cookies();
  const refresh = cookieStore.get(REFRESH_COOKIE)?.value;
  if (refresh) {
    try {
      const claims = await verifyRefreshToken(refresh);
      if (claims.jti) await revokeRefreshTokenById(claims.jti);
    } catch {
      /* token invalide → on clear quand même */
    }
  }
  await clearAuthCookies();
  return NextResponse.json({ ok: true });
}
