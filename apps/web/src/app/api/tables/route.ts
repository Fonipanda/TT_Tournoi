/**
 * GET  /api/tables?roomId=...
 * POST /api/tables                 (admin)
 */

import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { prisma } from '@tt/db';
import { errorResponse, requireRole } from '@/lib/auth/server';

export async function GET(req: NextRequest) {
  const roomId = req.nextUrl.searchParams.get('roomId') ?? undefined;
  const where = roomId ? { roomId } : {};
  const tables = await prisma.tableModel.findMany({
    where,
    orderBy: { number: 'asc' },
    include: { currentMatch: { include: { player1: true, player2: true } } },
  });
  return NextResponse.json({ data: tables });
}

const CreateSchema = z.object({
  roomId: z.string().uuid(),
  number: z.number().int().min(1),
  x: z.number().int().default(100),
  y: z.number().int().default(100),
  rotation: z.number().int().default(0),
});

export async function POST(req: NextRequest) {
  try {
    await requireRole(['admin']);
    const body = CreateSchema.parse(await req.json());
    const created = await prisma.tableModel.create({ data: body });
    return NextResponse.json(created, { status: 201 });
  } catch (e) {
    if (e instanceof z.ZodError) {
      return NextResponse.json({ error: 'Validation', details: e.errors }, { status: 400 });
    }
    return errorResponse(e);
  }
}
