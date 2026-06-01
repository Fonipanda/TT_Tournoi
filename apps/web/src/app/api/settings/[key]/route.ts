/**
 * PUT    /api/settings/:key    — admin, set/upsert un setting
 * DELETE /api/settings/:key    — admin, supprime un setting
 */

import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { prisma } from '@tt/db';
import { errorResponse, requireRole } from '@/lib/auth/server';
import { ensureSiteSettingTable } from '../route';

interface Params { params: Promise<{ key: string }> }

const Schema = z.object({ value: z.string().max(2_000_000) });

export async function PUT(req: NextRequest, { params }: Params) {
  try {
    await requireRole(['admin']);
    await ensureSiteSettingTable();
    const { key } = await params;
    const body = Schema.parse(await req.json());
    const result = await prisma.siteSetting.upsert({
      where: { key },
      update: { value: body.value },
      create: { key, value: body.value },
    });
    return NextResponse.json(result);
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
    await ensureSiteSettingTable();
    const { key } = await params;
    await prisma.siteSetting.delete({ where: { key } }).catch(() => undefined);
    return new NextResponse(null, { status: 204 });
  } catch (e) {
    return errorResponse(e);
  }
}
