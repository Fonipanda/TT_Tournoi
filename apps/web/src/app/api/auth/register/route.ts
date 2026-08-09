/**
 * POST /api/auth/register — inscription publique (sans login préalable).
 *
 * Crée un Player + un UserAccount role=player protégé par mot de passe.
 * Le numéro de licence FFTT sert à récupérer l'identité du joueur ; l'adresse
 * email est l'identifiant de connexion et doit être confirmée par lien.
 *
 * Contrôles sur l'email : format (regex), fournisseur jetable, enregistrements
 * MX du domaine, puis lien d'activation. Pas de SMTP VRFY (désactivé sur la
 * plupart des serveurs et assimilé à du spam).
 *
 * Body : { firstName, lastName, email, password, phone?, licenseNumber?, club? }
 */

import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { prisma } from '@tt/db';
import { hashPassword, isPasswordStrong, PASSWORD_POLICY_MESSAGE } from '@tt/auth/password';
import { errorResponse, HttpError } from '@/lib/auth/server';
import { clientIp, enforceRateLimits } from '@/lib/rate-limit';
import { validateEmail } from '@/lib/email-validation';
import {
  createEmailVerificationLink,
  isEmailVerificationRequired,
  VERIFICATION_TOKEN_TTL_HOURS,
} from '@/lib/auth/email-verification';
import { sendEmailVerificationEmail } from '@/lib/mailer';
import { optionalPhoneField } from '@/lib/validation/phone';

const Schema = z.object({
  firstName: z.string().min(1).max(50),
  lastName: z.string().min(1).max(50),
  email: z.string().email('Adresse email invalide').max(254),
  password: z.string().min(1, 'Mot de passe requis').max(128),
  phone: optionalPhoneField,
  licenseNumber: z
    .string()
    .regex(/^\d{6,10}$/)
    .optional()
    .or(z.literal('')),
  club: z.string().max(100).optional().or(z.literal('')),
});

export async function POST(req: NextRequest) {
  try {
    const ip = clientIp(req);
    const limited = await enforceRateLimits([
      { key: `register:ip:${ip}`, limit: 5, windowSec: 3600 },
    ]);
    if (limited) return limited;

    const body = Schema.parse(await req.json());
    const email = body.email.trim();

    if (!isPasswordStrong(body.password)) {
      throw new HttpError(400, PASSWORD_POLICY_MESSAGE, 'weak_password');
    }

    // Format + fournisseur jetable + MX du domaine.
    const emailCheck = await validateEmail(email);
    if (!emailCheck.ok) {
      throw new HttpError(400, emailCheck.message, emailCheck.code);
    }

    // Une licence ou un email déjà utilisés ne peuvent pas être réinscrits.
    const existingPlayer = await prisma.player.findFirst({
      where: {
        OR: [
          ...(body.licenseNumber ? [{ licenseNumber: body.licenseNumber }] : []),
          { email: { equals: email, mode: 'insensitive' as const } },
        ],
      },
    });
    const existingAccount = await prisma.userAccount.findFirst({
      where: { email: { equals: email, mode: 'insensitive' } },
    });
    if (existingPlayer || existingAccount) {
      throw new HttpError(
        409,
        'Un compte existe déjà avec cette licence ou cet email. Connecte-toi ou utilise « Mot de passe oublié ».',
        'duplicate',
      );
    }

    const passwordHash = await hashPassword(body.password);
    const verificationRequired = isEmailVerificationRequired();

    // Créer le joueur
    const player = await prisma.player.create({
      data: {
        firstName: body.firstName,
        lastName: body.lastName.toUpperCase(),
        email,
        phone: body.phone || null,
        licenseNumber: body.licenseNumber || null,
        club: body.club || '',
        points: 500, // valeur par défaut, modifiable plus tard
      },
    });

    // Créer le compte UserAccount lié
    const username = body.licenseNumber
      ? `licence-${body.licenseNumber}`
      : `email-${email.replace(/[^a-z0-9]/gi, '_').slice(0, 30)}`;
    const account = await prisma.userAccount.create({
      data: {
        username,
        email,
        passwordHash,
        role: 'player',
        playerId: player.id,
        passwordNeedsReset: false,
        // Sans vérification exigée, le compte est actif immédiatement.
        emailVerifiedAt: verificationRequired ? null : new Date(),
      },
    });

    // Pas d'auto-connexion : le compte doit d'abord être activé via le lien.
    if (verificationRequired) {
      const verifyUrl = await createEmailVerificationLink(account.id, email, ip);
      const result = await sendEmailVerificationEmail(
        email,
        verifyUrl,
        player.firstName,
        VERIFICATION_TOKEN_TTL_HOURS,
      );
      if (!result.delivered) {
        console.error(
          `[register] Email d'activation non délivré pour ${account.id} (${result.reason ?? 'inconnu'})`,
        );
      }
    }

    return NextResponse.json(
      {
        user: {
          id: account.id,
          username: account.username,
          role: 'player',
          playerId: player.id,
        },
        player: {
          id: player.id,
          firstName: player.firstName,
          lastName: player.lastName,
        },
        emailVerificationRequired: verificationRequired,
        email,
      },
      { status: 201 },
    );
  } catch (e) {
    if (e instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Validation', details: e.errors, code: 'validation' },
        { status: 400 },
      );
    }
    return errorResponse(e);
  }
}
