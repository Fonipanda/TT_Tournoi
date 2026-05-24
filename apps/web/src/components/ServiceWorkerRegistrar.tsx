'use client';

import { useEffect } from 'react';

/**
 * Enregistre le service worker /sw.js dès le boot client.
 * À placer dans le layout racine.
 */
export function ServiceWorkerRegistrar() {
  useEffect(() => {
    if (
      typeof window === 'undefined' ||
      !('serviceWorker' in navigator) ||
      process.env.NODE_ENV !== 'production'
    ) {
      return;
    }
    navigator.serviceWorker
      .register('/sw.js', { scope: '/' })
      .catch((err) => {
        console.warn('[sw] registration failed:', err);
      });
  }, []);
  return null;
}
