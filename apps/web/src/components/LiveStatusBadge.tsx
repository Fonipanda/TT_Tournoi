'use client';

import { useLiveWebSocket } from '@/lib/live/useLiveWebSocket';
import type { LiveEvent } from '@tt/types';

export function LiveStatusBadge({
  onEvent,
  hideWhenDisconnected = false,
}: {
  onEvent?: (e: LiveEvent) => void;
  /**
   * Masque entièrement le badge tant que le flux n'est pas établi.
   *
   * Destiné aux pages publiques : l'état de la liaison temps réel n'y est pas
   * une information utile au visiteur. Un point gris privé de libellé serait
   * plus intrigant que le texte retiré, d'où le retrait complet.
   */
  hideWhenDisconnected?: boolean;
}) {
  const { connected } = useLiveWebSocket(onEvent);
  if (!connected && hideWhenDisconnected) return null;
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
