/**
 * POST   /api/menu/items
 * PATCH  /api/menu/items/:id
 * DELETE /api/menu/items/:id
 */

import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { Prisma, prisma } from '@tt/db';
import { errorResponse, requireRole } from '@/lib/auth/server';

const CreateSchema = z.object({
  sectionId: z.string().uuid(),
  name: z.string().min(1),
  description: z.string().optional(),
  price: z.number().nonnegative(),
  imageUrl: z.string().url().optional().or(z.literal('')),
  isAvailable: z.boolean().default(true),
  order: z.number().int().default(0),
});

export async function POST(req: NextRequest) {
  try {
    await requireRole(['admin']);
    const body = CreateSchema.parse(await req.json());
    const created = await prisma.menuItem.create({
      data: {
        ...body,
        price: new Prisma.Decimal(body.price),
        imageUrl: body.imageUrl || null,
      },
    });
    return NextResponse.json(created, { status: 201 });
  } catch (e) {
    if (e instanceof z.ZodError) {
      return NextResponse.json({ error: 'Validation', details: e.errors }, { status: 400 });
    }
    return errorResponse(e);
  }
}
