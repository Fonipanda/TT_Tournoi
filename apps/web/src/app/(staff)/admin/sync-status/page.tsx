'use client';

import { useEffect, useState } from 'react';

interface OutboxEntry {
  id: string;
  url: string;
  method: string;
  status: 'pending' | 'syncing' | 'failed' | 'conflict';
  createdAt: number;
  lastError?: string;
}

export default function AdminSyncStatusPage() {
  const [entries, setEntries] = useState<OutboxEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      // Page admin lue : on tente de lire l'IndexedDB partagée si disponible
      // (en pratique, chaque navigateur a sa propre outbox locale)
      if (typeof window === 'undefined' || !('indexedDB' in window)) {
        setLoading(false);
        return;
      }
      try {
        const db = await new Promise<IDBDatabase>((resolve, reject) => {
          const req = indexedDB.open('tt-pwa-outbox', 1);
          req.onsuccess = () => resolve(req.result);
          req.onerror = () => reject(req.error);
          req.onupgradeneeded = () => {
            const d = req.result;
            if (!d.objectStoreNames.contains('outbox')) {
              d.createObjectStore('outbox', { keyPath: 'id' });
            }
          };
        });
        const tx = db.transaction('outbox', 'readonly');
        const store = tx.objectStore('outbox');
        const all = await new Promise<OutboxEntry[]>((resolve, reject) => {
          const req = store.getAll();
          req.onsuccess = () => resolve(req.result as OutboxEntry[]);
          req.onerror = () => reject(req.error);
        });
        setEntries(all);
      } catch {
        /* ignore */
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  return (
    <div data-testid="sync-status-page">
      <h1 className="font-heading text-3xl uppercase tracking-wide mb-6">Sync Status (PWA)</h1>
      <p className="text-foreground-muted text-sm mb-6">
        Outbox locale du navigateur — mutations en attente / en erreur. Cette page lit
        uniquement l'IndexedDB du navigateur courant.
      </p>

      {loading && <p>Chargement…</p>}
      {!loading && entries.length === 0 && (
        <p className="card text-foreground-muted text-center py-8">
          Aucune mutation en attente ✓
        </p>
      )}

      {entries.length > 0 && (
        <div className="card overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-xs uppercase tracking-widest text-foreground-muted">
              <tr className="border-b border-border">
                <th className="text-left py-2">Date</th>
                <th className="text-left py-2">Méthode</th>
                <th className="text-left py-2">URL</th>
                <th className="text-center py-2">Statut</th>
                <th className="text-left py-2">Erreur</th>
              </tr>
            </thead>
            <tbody>
              {entries.map((e) => (
                <tr key={e.id} className="border-b border-border">
                  <td className="py-2 font-mono text-xs">
                    {new Date(e.createdAt).toLocaleString('fr-FR')}
                  </td>
                  <td className="py-2 font-mono text-xs">{e.method}</td>
                  <td className="py-2 font-mono text-xs truncate max-w-sm">{e.url}</td>
                  <td className="py-2 text-center">
                    <span
                      className={`text-xs px-2 py-0.5 ${
                        e.status === 'failed' || e.status === 'conflict'
                          ? 'bg-danger-soft text-danger'
                          : e.status === 'syncing'
                            ? 'bg-primary-soft text-primary'
                            : 'bg-warning-soft text-warning'
                      }`}
                    >
                      {e.status}
                    </span>
                  </td>
                  <td className="py-2 text-xs text-danger">{e.lastError ?? ''}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
