/**
 * GET   /api/sms/adapters
 * POST  /api/sms/adapters       (admin) — créer ou mettre à jour
 */

import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { prisma, Prisma } from '@tt/db';
import { errorResponse, requireRole } from '@/lib/auth/server';
import { invalidateAdapterCache } from '@tt/sms/engine';
import { listAdapterTypes } from '@tt/sms/registry';

export async function GET() {
  await requireRole(['admin']);
  const adapters = await prisma.smsAdapterConfig.findMany({
    orderBy: { createdAt: 'desc' },
  });
  return NextResponse.json({
    data: adapters,
    types: listAdapterTypes(),
  });
}

const Schema = z.object({
  name: z.string().min(1),
  adapterType: z.enum(['test', 'ovh', 'twilio', 'free_mobile', 'smpp']),
  config: z.record(z.unknown()).default({}),
  defaultSender: z.string().default(''),
  isActive: z.boolean().default(false),
});

export async function POST(req: NextRequest) {
  try {
    await requireRole(['admin']);
    const body = Schema.parse(await req.json());
    const created = await prisma.smsAdapterConfig.create({
      data: {
        ...body,
        config: body.config as Prisma.InputJsonValue,
      },
    });
    invalidateAdapterCache();
    return NextResponse.json(created, { status: 201 });
  } catch (e) {
    if (e instanceof z.ZodError) {
      return NextResponse.json({ error: 'Validation', details: e.errors }, { status: 400 });
    }
    return errorResponse(e);
  }
}
