/**
 * POST /api/auth/refresh — rafraîchit l'access token via cookie refresh.
 */

import { NextResponse } from 'next/server';
import { tryRefreshTokens } from '@/lib/auth/server';

export async function POST() {
  const result = await tryRefreshTokens();
  if (!result) {
    return NextResponse.json({ error: 'Refresh invalide' }, { status: 401 });
  }
  return NextResponse.json({ user: result.user });
}
