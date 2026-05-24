/**
 * GET    /api/tournaments/:id
 * PATCH  /api/tournaments/:id    (admin) — bumpe qrVersion automatiquement
 * DELETE /api/tournaments/:id    (admin)
 */

import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { prisma } from '@tt/db';
import { errorResponse, requireRole } from '@/lib/auth/server';

interface Params { params: Promise<{ id: string }> }

export async function GET(_req: NextRequest, { params }: Params) {
  const { id } = await params;
  const t = await prisma.tournament.findUnique({
    where: { id },
    include: { brackets: true, rooms: true },
  });
  if (!t) return NextResponse.json({ error: 'Introuvable' }, { status: 404 });
  return NextResponse.json(t);
}

const UpdateSchema = z.object({
  name: z.string().min(1).optional(),
  description: z.string().optional(),
  date: z.string().optional(),
  startDate: z.string().datetime().optional().nullable(),
  endDate: z.string().datetime().optional().nullable(),
  location: z.string().optional(),
  contact: z.string().optional(),
  hours: z.string().optional(),
  schedule: z.array(z.record(z.unknown())).optional(),
  assoConnectUrl: z.string().optional(),
  publicUrl: z.string().optional(),
  smsAutoOnTableAssigned: z.boolean().optional(),
  smsAutoOnMatchCreated: z.boolean().optional(),
  smsAutoOnResult: z.boolean().optional(),
  isActive: z.boolean().optional(),
});

export async function PATCH(req: NextRequest, { params }: Params) {
  try {
    await requireRole(['admin']);
    const { id } = await params;
    const body = UpdateSchema.parse(await req.json());
    const data: Record<string, unknown> = { ...body };
    if (body.startDate !== undefined) data.startDate = body.startDate ? new Date(body.startDate) : null;
    if (body.endDate !== undefined) data.endDate = body.endDate ? new Date(body.endDate) : null;
    // bump qrVersion à chaque update (cache-bust QR)
    const updated = await prisma.tournament.update({
      where: { id },
      data: { ...data, qrVersion: { increment: 1 } },
    });
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
    await prisma.tournament.delete({ where: { id } });
    return new NextResponse(null, { status: 204 });
  } catch (e) {
    return errorResponse(e);
  }
}
