/**
 * PATCH  /api/registrations/:id  — paiement / check-in / dossard
 * DELETE /api/registrations/:id  — désactiver une inscription
 */

import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { Prisma, prisma } from '@tt/db';
import { errorResponse, requireRole } from '@/lib/auth/server';

interface Params { params: Promise<{ id: string }> }

const Schema = z.object({
  paymentStatus: z.enum(['pending', 'paid', 'cancelled']).optional(),
  amountPaid: z.number().nonnegative().optional(),
  checkinStatus: z.string().optional(),
  dossardNumber: z.number().int().nullable().optional(),
});

export async function PATCH(req: NextRequest, { params }: Params) {
  try {
    await requireRole(['admin', 'juge_arbitre']);
    const { id } = await params;
    const body = Schema.parse(await req.json());
    const data: Record<string, unknown> = { ...body };
    if (typeof body.amountPaid === 'number') data.amountPaid = new Prisma.Decimal(body.amountPaid);
    const updated = await prisma.playerBracketRegistration.update({ where: { id }, data });
    return NextResponse.json(updated);
  } catch (e) {
    if (e instanceof z.ZodError) {
      return NextResponse.json({ error: 'Validation', details: e.errors }, { status: 400 });
    }
    return errorResponse(e);
  }
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  try {
    await requireRole(['admin']);
    const { id } = await params;
    await prisma.playerBracketRegistration.update({
      where: { id },
      data: { isActive: false },
    });
    return new NextResponse(null, { status: 204 });
  } catch (e) {
    return errorResponse(e);
  }
}
