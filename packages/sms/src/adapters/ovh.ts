/**
 * Adaptateur OVH SMS Pro — ACTIF en v1.
 *
 * Référence officielle : https://docs.ovh.com/fr/sms/
 * Port TypeScript du `backend/tournament/sms/adapters/ovh.py` (dépôt A).
 *
 * Authentification par signature SHA1 avec préfixe '$1$' :
 *   signature = '$1$' + sha1(appSecret + '+' + consumerKey + '+' + method + '+' + url + '+' + body + '+' + timestamp)
 */

import crypto from 'node:crypto';
import { BaseSmsAdapter } from '../adapter';
import type { AdapterField, SmsSendResult } from '@tt/types';

const OVH_API_BASE = 'https://eu.api.ovh.com/1.0';

interface OvhConfig {
  appKey: string;
  appSecret: string;
  consumerKey: string;
  serviceName: string;
  senderName?: string;
}

export class OvhSmsAdapter extends BaseSmsAdapter {
  readonly type = 'ovh' as const;
  readonly name = 'OVH SMS Pro';

  override requiredFields(): AdapterField[] {
    return [
      {
        name: 'appKey',
        label: 'Application Key',
        type: 'text',
        required: true,
        help: "Clé d'application OVH (https://api.ovh.com/createToken)",
      },
      {
        name: 'appSecret',
        label: 'Application Secret',
        type: 'password',
        secret: true,
        required: true,
      },
      {
        name: 'consumerKey',
        label: 'Consumer Key',
        type: 'password',
        secret: true,
        required: true,
      },
      {
        name: 'serviceName',
        label: 'Service Name',
        type: 'text',
        required: true,
        placeholder: 'sms-xxxxx-1',
        help: "Identifiant du service SMS OVH (ex : sms-ab12345-1)",
      },
      {
        name: 'senderName',
        label: 'Expéditeur (optionnel)',
        type: 'text',
        required: false,
        placeholder: 'ChellesTT',
        help: '11 caractères max alphanumériques. Si vide, utilise le sender par défaut.',
      },
    ];
  }

  override async send(to: string, message: string, sender?: string): Promise<SmsSendResult> {
    const cfg = this.config as Partial<OvhConfig>;
    if (!cfg.appKey || !cfg.appSecret || !cfg.consumerKey || !cfg.serviceName) {
      return { success: false, error: 'OVH non configuré (appKey/appSecret/consumerKey/serviceName manquants)' };
    }

    const url = `${OVH_API_BASE}/sms/${cfg.serviceName}/jobs`;
    const senderName = sender || cfg.senderName || '';

    const payload: Record<string, unknown> = {
      message,
      receivers: [to],
      noStopClause: true,
      priority: 'high',
      charset: 'UTF-8',
    };
    if (senderName) payload.sender = senderName;

    const bodyStr = JSON.stringify(payload);
    const timestamp = Math.floor(Date.now() / 1000).toString();
    const method = 'POST';
    const preHash = `${cfg.appSecret}+${cfg.consumerKey}+${method}+${url}+${bodyStr}+${timestamp}`;
    const signature = '$1$' + crypto.createHash('sha1').update(preHash).digest('hex');

    const headers = {
      'Content-Type': 'application/json',
      'X-Ovh-Application': cfg.appKey,
      'X-Ovh-Consumer': cfg.consumerKey,
      'X-Ovh-Timestamp': timestamp,
      'X-Ovh-Signature': signature,
    };

    try {
      const res = await fetch(url, {
        method,
        headers,
        body: bodyStr,
        signal: AbortSignal.timeout(15000),
      });
      const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;

      if (res.ok) {
        const ids = (data.ids as unknown[]) ?? [];
        return {
          success: true,
          providerId: ids[0] != null ? String(ids[0]) : undefined,
          rawResponse: data,
        };
      }
      return {
        success: false,
        error: typeof data.message === 'string' ? data.message : `HTTP ${res.status}`,
        rawResponse: data,
      };
    } catch (e) {
      return {
        success: false,
        error: e instanceof Error ? e.message : String(e),
      };
    }
  }
}
