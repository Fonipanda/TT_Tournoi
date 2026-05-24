/**
 * GET   /api/players?search=...
 * POST  /api/players                  (admin)
 */

import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { prisma } from '@tt/db';
import { errorResponse, requireRole } from '@/lib/auth/server';

export async function GET(req: NextRequest) {
  const search = req.nextUrl.searchParams.get('search')?.trim();
  const limit = Math.min(Number(req.nextUrl.searchParams.get('limit') ?? 100), 500);
  const where = search
    ? {
        isActive: true,
        OR: [
          { lastName: { contains: search, mode: 'insensitive' as const } },
          { firstName: { contains: search, mode: 'insensitive' as const } },
          { licenseNumber: { contains: search } },
          { club: { contains: search, mode: 'insensitive' as const } },
        ],
      }
    : { isActive: true };
  const players = await prisma.player.findMany({
    where,
    orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }],
    take: limit,
  });
  return NextResponse.json({ data: players });
}

const CreateSchema = z.object({
  firstName: z.string().min(1),
  lastName: z.string().min(1),
  licenseNumber: z.string().regex(/^\d{6,10}$/).optional(),
  ranking: z.string().optional(),
  points: z.number().nonnegative().default(500),
  club: z.string().optional(),
  email: z.string().email().or(z.literal('')).default(''),
  phone: z.string().optional(),
});

export async function POST(req: NextRequest) {
  try {
    await requireRole(['admin']);
    const body = CreateSchema.parse(await req.json());
    const created = await prisma.player.create({ data: body });
    return NextResponse.json(created, { status: 201 });
  } catch (e) {
    if (e instanceof z.ZodError) {
      return NextResponse.json({ error: 'Validation', details: e.errors }, { status: 400 });
    }
    return errorResponse(e);
  }
}
