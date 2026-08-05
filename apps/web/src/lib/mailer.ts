/**
 * Mailer — envoi d'emails transactionnels via SMTP (nodemailer).
 *
 * Configuration (variables d'environnement) :
 *   SMTP_HOST      ex. ssl0.ovh.net
 *   SMTP_PORT      465 (SSL) ou 587 (STARTTLS) — défaut 587
 *   SMTP_SECURE    'true' pour le port 465 — défaut : true si port 465
 *   SMTP_USER      identifiant SMTP
 *   SMTP_PASS      mot de passe SMTP
 *   MAIL_FROM      ex. "TT Tournoi <no-reply@tournoi-chellestt.fr>"
 *
 * Si SMTP_HOST n'est pas configuré, les emails ne sont pas envoyés : leur
 * contenu est journalisé dans la console (mode développement). Le flux
 * applicatif n'échoue jamais à cause d'un mailer non configuré.
 *
 * Node.js only — ne pas importer dans le middleware Edge.
 */

export interface MailMessage {
  to: string;
  subject: string;
  text: string;
  html: string;
}

export interface MailResult {
  delivered: boolean;
  reason?: string;
}

export function isMailerConfigured(): boolean {
  return Boolean(process.env.SMTP_HOST);
}

function getFrom(): string {
  return process.env.MAIL_FROM || 'TT Tournoi <no-reply@localhost>';
}

/** URL publique de l'application, utilisée pour construire les liens. */
export function appUrl(): string {
  return (process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000').replace(/\/+$/, '');
}

// -----------------------------------------------------------------------------
// Transport (créé paresseusement, réutilisé entre les requêtes)
// -----------------------------------------------------------------------------

type Transporter = { sendMail(options: Record<string, unknown>): Promise<unknown> };
type CreateTransport = (options: Record<string, unknown>) => Transporter;

let transporterPromise: Promise<Transporter | null> | null = null;

async function getTransporter(): Promise<Transporter | null> {
  if (!isMailerConfigured()) return null;
  if (!transporterPromise) {
    transporterPromise = (async () => {
      try {
        // Import dynamique : nodemailer est un module CJS, l'interop peut
        // exposer `createTransport` à la racine ou sous `default`.
        const mod = (await import('nodemailer')) as unknown as {
          createTransport?: CreateTransport;
          default?: { createTransport?: CreateTransport };
        };
        const create = mod.createTransport ?? mod.default?.createTransport;
        if (!create) throw new Error('nodemailer.createTransport introuvable');

        const port = Number(process.env.SMTP_PORT ?? 587);
        const secure = process.env.SMTP_SECURE
          ? process.env.SMTP_SECURE === 'true'
          : port === 465;
        const user = process.env.SMTP_USER;
        const pass = process.env.SMTP_PASS;

        return create({
          host: process.env.SMTP_HOST,
          port,
          secure,
          auth: user && pass ? { user, pass } : undefined,
        });
      } catch (e) {
        console.error('[mailer] Transport SMTP indisponible :', e);
        return null;
      }
    })();
  }
  return transporterPromise;
}

/**
 * Envoie un email. N'échoue jamais : retourne `delivered: false` et
 * journalise en cas de problème (le flux appelant reste fonctionnel).
 */
export async function sendMail(message: MailMessage): Promise<MailResult> {
  const transporter = await getTransporter();

  if (!transporter) {
    console.warn(
      `[mailer] SMTP non configuré — email NON envoyé.\n` +
        `  À : ${message.to}\n` +
        `  Objet : ${message.subject}\n` +
        `  ${message.text.replace(/\n/g, '\n  ')}`,
    );
    return { delivered: false, reason: 'smtp_not_configured' };
  }

  try {
    await transporter.sendMail({
      from: getFrom(),
      to: message.to,
      subject: message.subject,
      text: message.text,
      html: message.html,
    });
    return { delivered: true };
  } catch (e) {
    console.error('[mailer] Échec de l\'envoi :', e);
    return { delivered: false, reason: 'send_failed' };
  }
}

// -----------------------------------------------------------------------------
// Templates
// -----------------------------------------------------------------------------

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function layout(title: string, bodyHtml: string): string {
  return `<!doctype html>
<html lang="fr">
  <body style="margin:0;padding:24px;background:#f5f5f4;font-family:Helvetica,Arial,sans-serif;color:#1c1917;">
    <div style="max-width:560px;margin:0 auto;background:#ffffff;border:1px solid #e7e5e4;border-radius:12px;padding:32px;">
      <h1 style="margin:0 0 16px;font-size:20px;text-transform:uppercase;letter-spacing:0.05em;">${escapeHtml(title)}</h1>
      ${bodyHtml}
      <hr style="margin:32px 0 16px;border:none;border-top:1px solid #e7e5e4;" />
      <p style="margin:0;font-size:12px;color:#78716c;">TT Tournoi — Chelles TT</p>
    </div>
  </body>
</html>`;
}

/** Email de réinitialisation de mot de passe. */
export async function sendPasswordResetEmail(
  to: string,
  resetUrl: string,
  displayName?: string,
  expiryMinutes = 60,
): Promise<MailResult> {
  const hello = displayName ? `Bonjour ${displayName},` : 'Bonjour,';
  const text = [
    hello,
    '',
    'Tu as demandé la réinitialisation de ton mot de passe TT Tournoi.',
    `Ouvre ce lien pour choisir un nouveau mot de passe (valable ${expiryMinutes} minutes) :`,
    resetUrl,
    '',
    "Si tu n'es pas à l'origine de cette demande, ignore simplement cet email :",
    "ton mot de passe actuel reste inchangé.",
  ].join('\n');

  const html = layout(
    'Réinitialisation du mot de passe',
    `<p style="margin:0 0 16px;font-size:15px;">${escapeHtml(hello)}</p>
     <p style="margin:0 0 24px;font-size:15px;">Tu as demandé la réinitialisation de ton mot de passe TT&nbsp;Tournoi.</p>
     <p style="margin:0 0 24px;">
       <a href="${escapeHtml(resetUrl)}" style="display:inline-block;background:#1c1917;color:#ffffff;text-decoration:none;padding:12px 24px;border-radius:9999px;font-weight:600;font-size:15px;">
         Choisir un nouveau mot de passe
       </a>
     </p>
     <p style="margin:0 0 8px;font-size:13px;color:#57534e;">Ce lien est valable ${expiryMinutes} minutes et ne peut servir qu'une seule fois.</p>
     <p style="margin:0 0 16px;font-size:13px;color:#57534e;word-break:break-all;">${escapeHtml(resetUrl)}</p>
     <p style="margin:0;font-size:13px;color:#57534e;">Si tu n'es pas à l'origine de cette demande, ignore cet email : ton mot de passe actuel reste inchangé.</p>`,
  );

  return sendMail({
    to,
    subject: 'Réinitialisation de ton mot de passe — TT Tournoi',
    text,
    html,
  });
}

/** Confirmation après changement effectif du mot de passe. */
export async function sendPasswordChangedEmail(
  to: string,
  displayName?: string,
): Promise<MailResult> {
  const hello = displayName ? `Bonjour ${displayName},` : 'Bonjour,';
  const text = [
    hello,
    '',
    'Ton mot de passe TT Tournoi vient d\'être modifié.',
    'Toutes tes sessions ouvertes ont été déconnectées.',
    '',
    "Si tu n'es pas à l'origine de ce changement, contacte immédiatement l'organisateur du tournoi.",
  ].join('\n');

  const html = layout(
    'Mot de passe modifié',
    `<p style="margin:0 0 16px;font-size:15px;">${escapeHtml(hello)}</p>
     <p style="margin:0 0 16px;font-size:15px;">Ton mot de passe TT&nbsp;Tournoi vient d'être modifié et toutes tes sessions ouvertes ont été déconnectées.</p>
     <p style="margin:0;font-size:13px;color:#57534e;">Si tu n'es pas à l'origine de ce changement, contacte immédiatement l'organisateur du tournoi.</p>`,
  );

  return sendMail({ to, subject: 'Ton mot de passe a été modifié — TT Tournoi', text, html });
}
