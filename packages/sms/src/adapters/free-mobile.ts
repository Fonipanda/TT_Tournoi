/**
 * Adaptateur Free Mobile — DESACTIVE V1.
 *
 * Service gratuit Free Mobile : 1 destinataire = uniquement le numéro
 * du compte Free configuré. Utile pour tests perso.
 */

import { BaseSmsAdapter } from '../adapter';
import type { AdapterField, SmsSendResult } from '@tt/types';

interface FreeMobileConfig {
  user: string;
  pass: string;
}

export class FreeMobileSmsAdapter extends BaseSmsAdapter {
  readonly type = 'free_mobile' as const;
  readonly name = 'Free Mobile';

  override requiredFields(): AdapterField[] {
    return [
      { name: 'user', label: 'Identifiant Free', type: 'text', required: true },
      {
        name: 'pass',
        label: 'Clé d\'API (Mon Compte > SMS)',
        type: 'password',
        secret: true,
        required: true,
      },
    ];
  }

  override async send(_to: string, message: string): Promise<SmsSendResult> {
    const cfg = this.config as Partial<FreeMobileConfig>;
    if (!cfg.user || !cfg.pass) {
      return { success: false, error: 'Free Mobile non configuré.' };
    }
    const url = new URL('https://smsapi.free-mobile.fr/sendmsg');
    url.searchParams.set('user', cfg.user);
    url.searchParams.set('pass', cfg.pass);
    url.searchParams.set('msg', message);

    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(15000) });
      if (res.status === 200) return { success: true };
      return { success: false, error: `Free Mobile HTTP ${res.status}` };
    } catch (e) {
      return { success: false, error: e instanceof Error ? e.message : String(e) };
    }
  }
}
