/**
 * GET   /api/menu/sections?tournamentId=...
 * POST  /api/menu/sections   (admin)
 */

import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { prisma } from '@tt/db';
import { errorResponse, requireRole } from '@/lib/auth/server';

export async function GET(req: NextRequest) {
  const tournamentId = req.nextUrl.searchParams.get('tournamentId');
  if (!tournamentId) {
    return NextResponse.json({ error: 'tournamentId requis' }, { status: 400 });
  }
  const sections = await prisma.menuSection.findMany({
    where: { tournamentId },
    orderBy: { order: 'asc' },
    include: { items: { orderBy: { order: 'asc' } } },
  });
  return NextResponse.json({ data: sections });
}

const CreateSchema = z.object({
  tournamentId: z.string().uuid(),
  name: z.string().min(1),
  order: z.number().int().default(0),
});

export async function POST(req: NextRequest) {
  try {
    await requireRole(['admin']);
    const body = CreateSchema.parse(await req.json());
    const created = await prisma.menuSection.create({ data: body });
    return NextResponse.json(created, { status: 201 });
  } catch (e) {
    if (e instanceof z.ZodError) {
      return NextResponse.json({ error: 'Validation', details: e.errors }, { status: 400 });
    }
    return errorResponse(e);
  }
}
