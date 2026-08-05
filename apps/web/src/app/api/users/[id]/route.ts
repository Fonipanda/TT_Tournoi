/**
 * PATCH  /api/users/:id   — modifier (rôle, password, désactiver)
 * DELETE /api/users/:id   — désactiver (soft-delete)
 */

import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { prisma } from '@tt/db';
import { hashPassword, isPasswordStrong, PASSWORD_POLICY_MESSAGE } from '@tt/auth/password';
import { errorResponse, requireRole, revokeAllUserRefreshTokens } from '@/lib/auth/server';

interface Params { params: Promise<{ id: string }> }

const UpdateSchema = z.object({
  email: z.string().email().or(z.literal('')).optional(),
  password: z.string().max(128).refine(isPasswordStrong, PASSWORD_POLICY_MESSAGE).optional(),
  role: z.enum(['admin', 'juge_arbitre', 'player']).optional(),
  isActive: z.boolean().optional(),
  passwordNeedsReset: z.boolean().optional(),
});

export async function PATCH(req: NextRequest, { params }: Params) {
  try {
    await requireRole(['admin']);
    const { id } = await params;
    const body = UpdateSchema.parse(await req.json());

    const data: Record<string, unknown> = { ...body };
    if (body.password) {
      data.passwordHash = await hashPassword(body.password);
      data.passwordNeedsReset = false;
      delete data.password;
    }
    if (body.email === '') data.email = null;

    const updated = await prisma.userAccount.update({ where: { id }, data });

    // Changement de mot de passe ou désactivation → on coupe les sessions.
    if (body.password || body.isActive === false) {
      await revokeAllUserRefreshTokens(id);
    }

    return NextResponse.json({
      id: updated.id,
      username: updated.username,
      role: updated.role,
      isActive: updated.isActive,
    });
  } catch (e) {
    if (e instanceof z.ZodError) {
      return NextResponse.json({ error: 'Validation', details: e.errors }, { status: 400 });
    }
    return errorResponse(e);
  }
}

export async function DELETE(req: NextRequest, { params }: Params) {
  try {
    await requireRole(['admin']);
    const { id } = await params;
    const hard = req.nextUrl.searchParams.get('hard') === 'true';
    if (hard) {
      await prisma.$transaction([
        prisma.refreshToken.deleteMany({ where: { userId: id } }),
        prisma.userAccount.delete({ where: { id } }),
      ]);
    } else {
      await prisma.userAccount.update({ where: { id }, data: { isActive: false } });
    }
    return new NextResponse(null, { status: 204 });
  } catch (e) {
    return errorResponse(e);
  }
}
