/**
 * Adaptateur Test — log console (utilisé en développement / tests).
 */

import { BaseSmsAdapter } from '../adapter.js';
import type { AdapterField, SmsSendResult } from '@tt/types';

export class TestSmsAdapter extends BaseSmsAdapter {
  readonly type = 'test' as const;
  readonly name = 'Test (Console)';

  override requiredFields(): AdapterField[] {
    return [];
  }

  override async send(to: string, message: string, sender?: string): Promise<SmsSendResult> {
    console.info(`[SMS:TEST] de=${sender ?? '-'} a=${to} msg="${message}"`);
    return {
      success: true,
      providerId: `test-${Date.now()}`,
    };
  }
}
