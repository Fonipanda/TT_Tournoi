/**
 * POST /api/sms/test — envoi unitaire synchrone (test connectivité adapter)
 */

import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { errorResponse, requireRole } from '@/lib/auth/server';
import { sendSmsSync } from '@tt/sms/engine';

const Schema = z.object({
  to: z.string().min(8),
  message: z.string().min(1).max(1000),
  sender: z.string().optional(),
});

export async function POST(req: NextRequest) {
  try {
    await requireRole(['admin']);
    const body = Schema.parse(await req.json());
    const log = await sendSmsSync(body.to, body.message, {
      sender: body.sender,
      kind: 'manual',
      trigger: 'test',
    });
    return NextResponse.json({
      ok: log.status === 'sent',
      log,
    });
  } catch (e) {
    if (e instanceof z.ZodError) {
      return NextResponse.json({ error: 'Validation', details: e.errors }, { status: 400 });
    }
    return errorResponse(e);
  }
}
