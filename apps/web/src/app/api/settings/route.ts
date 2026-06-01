/**
 * GET  /api/settings           — public, retourne logo et autres settings
 * PUT  /api/settings/:key      — admin, set un setting
 */

import { NextResponse, type NextRequest } from 'next/server';
import { prisma } from '@tt/db';
import { errorResponse } from '@/lib/auth/server';

export async function GET() {
  try {
    const settings = await prisma.siteSetting.findMany();
    const map: Record<string, string> = {};
    for (const s of settings) map[s.key] = s.value;
    return NextResponse.json({ data: map });
  } catch (e) {
    return errorResponse(e);
  }
}
