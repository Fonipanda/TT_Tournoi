/**
 * Adapter — réexports + classe abstraite de référence.
 *
 * Le contrat `SmsAdapter` est défini dans @tt/types pour permettre aux
 * composants UI (admin SMS) d'importer les types sans Node-only deps.
 */

export type {
  SmsAdapter,
  AdapterField,
  AdapterType,
  SmsSendResult,
} from '@tt/types';

import type { AdapterField, AdapterType, SmsAdapter, SmsSendResult } from '@tt/types';

export abstract class BaseSmsAdapter implements SmsAdapter {
  abstract readonly type: AdapterType;
  abstract readonly name: string;

  constructor(protected readonly config: Record<string, unknown> = {}) {}

  abstract send(to: string, message: string, sender?: string): Promise<SmsSendResult>;
  abstract requiredFields(): AdapterField[];

  validateConfig(_cfg: Record<string, unknown>): void {
    const required = this.requiredFields().filter((f) => f.required);
    for (const f of required) {
      const v = _cfg[f.name];
      if (v === undefined || v === null || v === '') {
        throw new Error(`[SMS:${this.type}] Champ requis manquant : ${f.name}`);
      }
    }
  }
}
