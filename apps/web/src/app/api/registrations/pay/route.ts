/**
 * POST /api/registrations/pay
 * Body: { registrationIds: string[], method: 'card' | 'cash' | 'transfer' }
 *
 * Marque les inscriptions comme payées (V1 : pas de Stripe, juste un toggle).
 * Stripe sera intégré en V2.
 */

import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { Prisma, prisma } from '@tt/db';
import { errorResponse, getCurrentUser, HttpError } from '@/lib/auth/server';

const Schema = z.object({
  registrationIds: z.array(z.string().uuid()).min(1).max(8),
  method: z.enum(['card', 'cash', 'transfer']).default('card'),
});

export async function POST(req: NextRequest) {
  try {
    const me = await getCurrentUser();
    if (!me) throw new HttpError(401, 'Auth requise');
    const body = Schema.parse(await req.json());

    // Vérifier que toutes les inscriptions appartiennent au joueur courant (sauf si admin)
    const registrations = await prisma.playerBracketRegistration.findMany({
      where: { id: { in: body.registrationIds } },
      include: { bracket: { select: { entryFee: true } } },
    });

    if (registrations.length === 0) {
      throw new HttpError(404, 'Aucune inscription trouvée');
    }

    if (me.role !== 'admin' && me.playerId) {
      const allMine = registrations.every((r) => r.playerId === me.playerId);
      if (!allMine) throw new HttpError(403, 'Accès refusé');
    }

    // Calculer le total
    const totalCents = registrations.reduce(
      (sum, r) => sum + Math.round(Number(r.bracket.entryFee) * 100),
      0,
    );

    // Marquer toutes comme payées
    await prisma.playerBracketRegistration.updateMany({
      where: { id: { in: body.registrationIds } },
      data: { paymentStatus: 'paid' },
    });
    // amountPaid au prorata (Decimal)
    for (const r of registrations) {
      await prisma.playerBracketRegistration.update({
        where: { id: r.id },
        data: { amountPaid: r.bracket.entryFee },
      });
    }

    return NextResponse.json({
      ok: true,
      paid: registrations.length,
      totalEur: totalCents / 100,
      method: body.method,
    });
  } catch (e) {
    if (e instanceof z.ZodError) {
      return NextResponse.json({ error: 'Validation', details: e.errors }, { status: 400 });
    }
    return errorResponse(e);
  }
}
