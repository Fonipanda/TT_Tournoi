/**
 * GET    /api/players/:id
 * PATCH  /api/players/:id        (admin ou player lui-même)
 * DELETE /api/players/:id        (admin)
 */

import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { prisma } from '@tt/db';
import { errorResponse, getCurrentUser, HttpError, requireRole } from '@/lib/auth/server';
import { optionalPhoneField } from '@/lib/validation/phone';

interface Params { params: Promise<{ id: string }> }

export async function GET(_req: NextRequest, { params }: Params) {
  const { id } = await params;
  const p = await prisma.player.findUnique({
    where: { id },
    include: {
      registrations: { include: { bracket: true } },
    },
  });
  if (!p) return NextResponse.json({ error: 'Introuvable' }, { status: 404 });
  return NextResponse.json(p);
}

const UpdateSchema = z.object({
  firstName: z.string().optional(),
  lastName: z.string().optional(),
  licenseNumber: z.string().optional(),
  ranking: z.string().optional(),
  points: z.number().optional(),
  club: z.string().optional(),
  email: z.string().email().or(z.literal('')).optional(),
  phone: optionalPhoneField,
  isActive: z.boolean().optional(),
  bracketIds: z.array(z.string()).optional(),
});

export async function PATCH(req: NextRequest, { params }: Params) {
  try {
    const { id } = await params;
    const me = await getCurrentUser();
    if (!me) throw new HttpError(401, 'Auth requise');
    if (me.role !== 'admin' && me.playerId !== id) {
      throw new HttpError(403, 'Modification interdite');
    }
    const body = UpdateSchema.parse(await req.json());
    const { bracketIds, ...playerData } = body;

    // Update player fields
    const updated = await prisma.player.update({ where: { id }, data: playerData });

    // If bracketIds provided, sync registrations (admin only)
    if (bracketIds !== undefined && me.role === 'admin') {
      // Get current active registrations
      const existing = await prisma.playerBracketRegistration.findMany({
        where: { playerId: id, isActive: true },
        select: { id: true, bracketId: true },
      });
      const existingBracketIds = existing.map((r: { id: string; bracketId: string }) => r.bracketId);

      // Add new registrations
      const toAdd = bracketIds.filter((bid) => !existingBracketIds.includes(bid));
      for (const bracketId of toAdd) {
        await prisma.playerBracketRegistration.create({
          data: {
            playerId: id,
            bracketId,
            paymentStatus: 'pending',
            isActive: true,
            qrToken: `${id}-${bracketId}-${Date.now().toString(36)}`,
          },
        });
      }

      // Deactivate removed registrations
      const toRemove = existing.filter((r: { id: string; bracketId: string }) => !bracketIds.includes(r.bracketId));
      for (const reg of toRemove) {
        await prisma.playerBracketRegistration.update({
          where: { id: reg.id },
          data: { isActive: false },
        });
      }
    }

    return NextResponse.json(updated);
  } catch (e) {
    if (e instanceof z.ZodError) {
      return NextResponse.json({ error: 'Validation', details: e.errors }, { status: 400 });
    }
    return errorResponse(e);
  }
}

export async function DELETE(req: NextRequest, { params }: Params) {
  try {
    await requireRole(['admin']);
    const { id } = await params;
    const hard = req.nextUrl.searchParams.get('hard') === 'true';
    if (hard) {
      // Suppression physique : cascade sur registrations, notifications, matchs
      await prisma.player.delete({ where: { id } });
    } else {
      await prisma.player.update({ where: { id }, data: { isActive: false } });
    }
    return new NextResponse(null, { status: 204 });
  } catch (e) {
    return errorResponse(e);
  }
}
