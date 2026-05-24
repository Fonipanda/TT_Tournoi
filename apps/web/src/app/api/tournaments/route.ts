/**
 * GET    /api/tournaments        — liste (public)
 * POST   /api/tournaments        — créer (admin)
 */

import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { prisma } from '@tt/db';
import { errorResponse, requireRole } from '@/lib/auth/server';

export async function GET() {
  const tournaments = await prisma.tournament.findMany({
    orderBy: [{ isActive: 'desc' }, { startDate: 'desc' }],
    include: {
      _count: { select: { brackets: true, rooms: true } },
    },
  });
  return NextResponse.json({ data: tournaments });
}

const CreateSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
  date: z.string().default(''),
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),
  location: z.string().default(''),
  contact: z.string().default(''),
  hours: z.string().default(''),
  schedule: z.array(z.record(z.unknown())).default([]),
  assoConnectUrl: z.string().url().optional().or(z.literal('')),
  publicUrl: z.string().url().optional().or(z.literal('')),
  smsAutoOnTableAssigned: z.boolean().optional(),
  smsAutoOnMatchCreated: z.boolean().optional(),
  smsAutoOnResult: z.boolean().optional(),
});

export async function POST(req: NextRequest) {
  try {
    await requireRole(['admin']);
    const data = CreateSchema.parse(await req.json());
    const created = await prisma.tournament.create({
      data: {
        ...data,
        startDate: data.startDate ? new Date(data.startDate) : null,
        endDate: data.endDate ? new Date(data.endDate) : null,
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
