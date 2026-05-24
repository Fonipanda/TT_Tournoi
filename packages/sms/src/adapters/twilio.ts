/**
 * Adaptateur Twilio — DESACTIVE V1.
 *
 * Conservé pour évolution future (basculement provider).
 * Utilise l'API REST Twilio Messages.
 */

import { BaseSmsAdapter } from '../adapter.js';
import type { AdapterField, SmsSendResult } from '@tt/types';

interface TwilioConfig {
  accountSid: string;
  authToken: string;
  fromNumber: string;
}

export class TwilioSmsAdapter extends BaseSmsAdapter {
  readonly type = 'twilio' as const;
  readonly name = 'Twilio';

  override requiredFields(): AdapterField[] {
    return [
      { name: 'accountSid', label: 'Account SID', type: 'text', required: true },
      { name: 'authToken', label: 'Auth Token', type: 'password', secret: true, required: true },
      {
        name: 'fromNumber',
        label: 'Numéro Twilio',
        type: 'text',
        required: true,
        placeholder: '+33756123456',
      },
    ];
  }

  override async send(to: string, message: string, sender?: string): Promise<SmsSendResult> {
    const cfg = this.config as Partial<TwilioConfig>;
    if (!cfg.accountSid || !cfg.authToken || !cfg.fromNumber) {
      return { success: false, error: 'Twilio non configuré.' };
    }

    const url = `https://api.twilio.com/2010-04-01/Accounts/${cfg.accountSid}/Messages.json`;
    const auth = Buffer.from(`${cfg.accountSid}:${cfg.authToken}`).toString('base64');
    const params = new URLSearchParams({
      To: to,
      From: sender || cfg.fromNumber,
      Body: message,
    });

    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: {
          Authorization: `Basic ${auth}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: params.toString(),
        signal: AbortSignal.timeout(15000),
      });
      const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;
      if (res.ok) {
        return { success: true, providerId: String(data.sid ?? ''), rawResponse: data };
      }
      return {
        success: false,
        error: typeof data.message === 'string' ? data.message : `HTTP ${res.status}`,
        rawResponse: data,
      };
    } catch (e) {
      return { success: false, error: e instanceof Error ? e.message : String(e) };
    }
  }
}
