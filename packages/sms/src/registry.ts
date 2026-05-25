/**
 * Registry — Map des constructeurs d'adaptateurs SMS par type.
 */

import type { AdapterType, SmsAdapter } from '@tt/types';
import { OvhSmsAdapter } from './adapters/ovh';
import { TestSmsAdapter } from './adapters/test';
import { TwilioSmsAdapter } from './adapters/twilio';
import { FreeMobileSmsAdapter } from './adapters/free-mobile';
import { SmppSmsAdapter } from './adapters/smpp';

export type AdapterFactory = (config: Record<string, unknown>) => SmsAdapter;

const REGISTRY: Record<AdapterType, AdapterFactory> = {
  test: (cfg) => new TestSmsAdapter(cfg),
  ovh: (cfg) => new OvhSmsAdapter(cfg),
  twilio: (cfg) => new TwilioSmsAdapter(cfg),
  free_mobile: (cfg) => new FreeMobileSmsAdapter(cfg),
  smpp: (cfg) => new SmppSmsAdapter(cfg),
};

export function getAdapter(type: AdapterType, config: Record<string, unknown> = {}): SmsAdapter {
  const factory = REGISTRY[type];
  if (!factory) {
    throw new Error(`[SMS] Adaptateur inconnu: ${type}`);
  }
  return factory(config);
}

export function listAdapterTypes(): AdapterType[] {
  return Object.keys(REGISTRY) as AdapterType[];
}

/**
 * Renvoie les champs requis pour un type sans instancier l'adaptateur
 * (utile pour l'UI admin qui veut lister les champs avant de connaître la conf).
 */
export function getAdapterFields(type: AdapterType) {
  const adapter = getAdapter(type, {});
  return adapter.requiredFields();
}
