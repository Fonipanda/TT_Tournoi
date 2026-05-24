/**
 * POST /api/brackets/:id/generate-elimination
 */

import { NextResponse, type NextRequest } from 'next/server';
import { errorResponse, requireRole } from '@/lib/auth/server';
import { generateElimination } from '@/lib/fftt/engine';
import { publishLiveEvent } from '@/lib/live/publisher';

interface Params { params: Promise<{ id: string }> }

export async function POST(_req: NextRequest, { params }: Params) {
  try {
    await requireRole(['admin']);
    const { id } = await params;
    const result = await generateElimination(id);
    await publishLiveEvent({ type: 'elimination_generated', bracketId: id });
    return NextResponse.json(result);
  } catch (e) {
    return errorResponse(e);
  }
}
