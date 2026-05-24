/**
 * GET   /api/sms/templates
 * POST  /api/sms/templates       (admin)
 */

import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { prisma } from '@tt/db';
import { errorResponse, requireRole } from '@/lib/auth/server';
import { SMS_TEMPLATE_VARIABLES } from '@tt/sms/templates';

export async function GET() {
  const templates = await prisma.smsTemplate.findMany({ orderBy: { name: 'asc' } });
  return NextResponse.json({
    data: templates,
    variables: SMS_TEMPLATE_VARIABLES,
  });
}

const Schema = z.object({
  name: z.string().min(1),
  content: z.string().min(1).max(1000),
  isActive: z.boolean().default(true),
});

export async function POST(req: NextRequest) {
  try {
    await requireRole(['admin']);
    const body = Schema.parse(await req.json());
    const created = await prisma.smsTemplate.create({ data: body });
    return NextResponse.json(created, { status: 201 });
  } catch (e) {
    if (e instanceof z.ZodError) {
      return NextResponse.json({ error: 'Validation', details: e.errors }, { status: 400 });
    }
    return errorResponse(e);
  }
}
