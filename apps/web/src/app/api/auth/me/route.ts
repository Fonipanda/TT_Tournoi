/**
 * GET /api/auth/me — Renvoie l'utilisateur courant ou 401.
 * POST /api/auth/refresh — Rafraîchit l'access token via le cookie refresh.
 */

import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth/server';

export async function GET() {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });
  }
  return NextResponse.json({ user });
}
