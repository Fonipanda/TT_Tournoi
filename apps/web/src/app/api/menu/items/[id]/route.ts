/**
 * PATCH  /api/menu/items/:id
 * DELETE /api/menu/items/:id
 */

import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { Prisma, prisma } from '@tt/db';
import { errorResponse, requireRole } from '@/lib/auth/server';

interface Params { params: Promise<{ id: string }> }

const Schema = z.object({
  name: z.string().optional(),
  description: z.string().optional(),
  price: z.number().nonnegative().optional(),
  imageUrl: z.string().optional(),
  isAvailable: z.boolean().optional(),
  order: z.number().int().optional(),
});

export async function PATCH(req: NextRequest, { params }: Params) {
  try {
    await requireRole(['admin']);
    const { id } = await params;
    const body = Schema.parse(await req.json());
    const data: Record<string, unknown> = { ...body };
    if (typeof body.price === 'number') data.price = new Prisma.Decimal(body.price);
    if (body.imageUrl === '') data.imageUrl = null;
    const updated = await prisma.menuItem.update({ where: { id }, data });
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
    await prisma.menuItem.delete({ where: { id } });
    return new NextResponse(null, { status: 204 });
  } catch (e) {
    return errorResponse(e);
  }
}
