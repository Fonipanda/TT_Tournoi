/**
 * GET    /api/sms/adapters/:id
 * PATCH  /api/sms/adapters/:id
 * DELETE /api/sms/adapters/:id
 */

import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { prisma, Prisma } from '@tt/db';
import { errorResponse, requireRole } from '@/lib/auth/server';
import { invalidateAdapterCache } from '@tt/sms/config';
import { maskAdapterConfig, mergeAdapterConfig } from '@tt/sms/secrets';

interface Params { params: Promise<{ id: string }> }

export async function GET(_req: NextRequest, { params }: Params) {
  await requireRole(['admin']);
  const { id } = await params;
  const a = await prisma.smsAdapterConfig.findUnique({ where: { id } });
  if (!a) return NextResponse.json({ error: 'Introuvable' }, { status: 404 });
  return NextResponse.json({
    ...a,
    config: maskAdapterConfig(a.adapterType, a.config as Record<string, unknown>),
  });
}

const Schema = z.object({
  name: z.string().optional(),
  config: z.record(z.unknown()).optional(),
  defaultSender: z.string().optional(),
  isActive: z.boolean().optional(),
});

export async function PATCH(req: NextRequest, { params }: Params) {
  try {
    await requireRole(['admin']);
    const { id } = await params;
    const body = Schema.parse(await req.json());

    const existing = await prisma.smsAdapterConfig.findUnique({ where: { id } });
    if (!existing) return NextResponse.json({ error: 'Introuvable' }, { status: 404 });

    const data: Record<string, unknown> = { ...body };
    if (body.config !== undefined) {
      // Un secret laissé masqué par l'UI conserve sa valeur enregistrée.
      data.config = mergeAdapterConfig(
        existing.adapterType,
        body.config,
        existing.config as Record<string, unknown>,
      ) as Prisma.InputJsonValue;
    }

    const updated = await prisma.smsAdapterConfig.update({ where: { id }, data });
    invalidateAdapterCache();
    return NextResponse.json({
      ...updated,
      config: maskAdapterConfig(updated.adapterType, updated.config as Record<string, unknown>),
    });
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
    await prisma.smsAdapterConfig.delete({ where: { id } });
    invalidateAdapterCache();
    return new NextResponse(null, { status: 204 });
  } catch (e) {
    return errorResponse(e);
  }
}
