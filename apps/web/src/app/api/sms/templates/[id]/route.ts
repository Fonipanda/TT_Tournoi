/**
 * PATCH  /api/sms/templates/:id
 * DELETE /api/sms/templates/:id
 */

import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { prisma } from '@tt/db';
import { errorResponse, requireRole } from '@/lib/auth/server';

interface Params { params: Promise<{ id: string }> }

const Schema = z.object({
  name: z.string().optional(),
  content: z.string().optional(),
  isActive: z.boolean().optional(),
});

export async function PATCH(req: NextRequest, { params }: Params) {
  try {
    await requireRole(['admin']);
    const { id } = await params;
    const body = Schema.parse(await req.json());
    const updated = await prisma.smsTemplate.update({ where: { id }, data: body });
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
    await prisma.smsTemplate.delete({ where: { id } });
    return new NextResponse(null, { status: 204 });
  } catch (e) {
    return errorResponse(e);
  }
}
