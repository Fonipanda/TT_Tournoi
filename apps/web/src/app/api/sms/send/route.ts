/**
 * POST /api/sms/send
 *
 * Body : { recipients: [{phone, name?, playerId?}], message: string, sender?: string }
 *   ou : { templateName: string, context: SmsTemplateContext, recipientPlayers: string[] }
 */

import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { prisma } from '@tt/db';
import { errorResponse, requireRole } from '@/lib/auth/server';
import { sendBulkSms, resolveSubscribers } from '@tt/sms/engine';
import { renderTemplate } from '@tt/sms/templates';

const RecipientSchema = z.object({
  phone: z.string(),
  name: z.string().optional(),
  playerId: z.string().uuid().optional(),
});

const Schema = z.union([
  z.object({
    recipients: z.array(RecipientSchema).min(1).max(2000),
    message: z.string().min(1).max(1000),
    sender: z.string().optional(),
  }),
  z.object({
    templateName: z.string().min(1),
    context: z.record(z.union([z.string(), z.number()])).optional(),
    recipientPlayers: z.array(z.string().uuid()).min(1).max(2000),
    sender: z.string().optional(),
  }),
]);

export async function POST(req: NextRequest) {
  try {
    await requireRole(['admin', 'juge_arbitre']);
    const body = Schema.parse(await req.json());

    if ('templateName' in body) {
      const template = await prisma.smsTemplate.findUnique({ where: { name: body.templateName } });
      if (!template) {
        return NextResponse.json({ error: 'Template introuvable' }, { status: 404 });
      }
      const message = renderTemplate(template.content, body.context);

      // Résoudre les destinataires depuis les playerIds (avec subs et fallback)
      const recipients = (
        await Promise.all(body.recipientPlayers.map((id) => resolveSubscribers(id)))
      ).flat();

      // Déduplication par téléphone
      const seen = new Set<string>();
      const unique = recipients.filter((r) => (seen.has(r.phone) ? false : (seen.add(r.phone), true)));

      const result = await sendBulkSms(unique, message, {
        sender: body.sender,
        kind: 'manual',
        trigger: `template:${body.templateName}`,
      });
      return NextResponse.json(result);
    }

    const result = await sendBulkSms(body.recipients, body.message, {
      sender: body.sender,
      kind: 'manual',
    });
    return NextResponse.json(result);
  } catch (e) {
    if (e instanceof z.ZodError) {
      return NextResponse.json({ error: 'Validation', details: e.errors }, { status: 400 });
    }
    return errorResponse(e);
  }
}
