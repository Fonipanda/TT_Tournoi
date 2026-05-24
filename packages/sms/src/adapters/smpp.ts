/**
 * Adaptateur SMPP — DESACTIVE V1.
 *
 * Stub pour compatibilité avec l'architecture multi-adaptateur du dépôt A.
 * Implémentation réelle nécessite une lib SMPP (smpp ou node-smpp) ; non
 * activé en v1 (aucun cas d'usage immédiat).
 */

import { BaseSmsAdapter } from '../adapter.js';
import type { AdapterField, SmsSendResult } from '@tt/types';

export class SmppSmsAdapter extends BaseSmsAdapter {
  readonly type = 'smpp' as const;
  readonly name = 'SMPP (non implémenté)';

  override requiredFields(): AdapterField[] {
    return [
      { name: 'host', label: 'Hôte SMPP', type: 'text', required: true },
      { name: 'port', label: 'Port', type: 'number', required: true, placeholder: '2775' },
      { name: 'systemId', label: 'System ID', type: 'text', required: true },
      { name: 'password', label: 'Password', type: 'password', secret: true, required: true },
    ];
  }

  override async send(_to: string, _message: string): Promise<SmsSendResult> {
    return {
      success: false,
      error: "Adaptateur SMPP non implémenté en v1. Utilisez OVH ou Twilio.",
    };
  }
}
