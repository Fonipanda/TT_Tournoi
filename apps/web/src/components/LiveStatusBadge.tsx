'use client';

import { useLiveWebSocket } from '@/lib/live/useLiveWebSocket';
import type { LiveEvent } from '@tt/types';

export function LiveStatusBadge({ onEvent }: { onEvent?: (e: LiveEvent) => void }) {
  const { connected } = useLiveWebSocket(onEvent);
  return (
    <div
      className="inline-flex items-center gap-2 text-xs text-foreground-muted"
      data-testid="live-status"
    >
      <span
        className={`inline-block w-2 h-2 ${
          connected ? 'bg-success animate-pulse' : 'bg-foreground-subtle'
        }`}
        aria-hidden="true"
      />
      <span>{connected ? 'Live connecté' : 'Reconnexion…'}</span>
    </div>
  );
}
