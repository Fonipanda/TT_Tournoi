/**
 * GET   /api/users        — liste comptes (admin)
 * POST  /api/users        — créer compte avec password (admin)
 */

import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { prisma } from '@tt/db';
import { hashPassword, isPasswordStrong, PASSWORD_POLICY_MESSAGE } from '@tt/auth/password';
import { errorResponse, requireRole, HttpError } from '@/lib/auth/server';

export async function GET() {
  try {
    await requireRole(['admin']);
    const users = await prisma.userAccount.findMany({
      orderBy: [{ role: 'asc' }, { username: 'asc' }],
      include: { player: { select: { firstName: true, lastName: true, licenseNumber: true } } },
    });
    return NextResponse.json({
      data: users.map((u) => ({
        id: u.id,
        username: u.username,
        email: u.email,
        role: u.role,
        isActive: u.isActive,
        passwordNeedsReset: u.passwordNeedsReset,
        playerId: u.playerId,
        player: u.player,
        createdAt: u.createdAt,
      })),
    });
  } catch (e) {
    return errorResponse(e);
  }
}

const CreateSchema = z.object({
  username: z.string().min(3).regex(/^[a-zA-Z0-9_-]+$/),
  email: z.string().email().optional().or(z.literal('')),
  password: z.string().max(128).refine(isPasswordStrong, PASSWORD_POLICY_MESSAGE),
  role: z.enum(['admin', 'juge_arbitre', 'player']),
  playerId: z.string().uuid().nullable().optional(),
});

export async function POST(req: NextRequest) {
  try {
    await requireRole(['admin']);
    const body = CreateSchema.parse(await req.json());

    const existing = await prisma.userAccount.findFirst({
      where: { OR: [{ username: body.username }, ...(body.email ? [{ email: body.email }] : [])] },
    });
    if (existing) {
      throw new HttpError(409, 'Un compte avec ce nom/email existe déjà', 'duplicate');
    }

    const hash = await hashPassword(body.password);
    const created = await prisma.userAccount.create({
      data: {
        username: body.username,
        email: body.email || null,
        passwordHash: hash,
        role: body.role,
        playerId: body.playerId || null,
        passwordNeedsReset: false,
      },
    });
    return NextResponse.json({
      id: created.id,
      username: created.username,
      role: created.role,
      isActive: created.isActive,
    }, { status: 201 });
  } catch (e) {
    if (e instanceof z.ZodError) {
      return NextResponse.json({ error: 'Validation', details: e.errors }, { status: 400 });
    }
    return errorResponse(e);
  }
}
