/**
 * Outbox PWA — file IndexedDB de mutations à rejouer en cas de réseau coupé.
 *
 * Chaque mutation Juge-Arbitre passe par `enqueueOrSubmit()` :
 *  - si online → fetch direct, retourne {ok, queued: false}
 *  - si offline → push dans IndexedDB, retourne {ok: true, queued: true}
 *
 * Au retour 'online', drainOutbox() rejoue les entrées en FIFO avec
 * idempotency (chaque body contient un optimisticId UNIQUE par MatchEvent).
 */

const DB_NAME = 'tt-pwa-outbox';
const DB_VERSION = 1;
const STORE = 'outbox';

export interface OutboxEntry {
  id: string;
  url: string;
  method: 'POST' | 'PATCH' | 'PUT' | 'DELETE';
  body: unknown;
  status: 'pending' | 'syncing' | 'failed' | 'conflict';
  createdAt: number;
  lastError?: string;
  attempts: number;
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof window === 'undefined' || !('indexedDB' in window)) {
      reject(new Error('IndexedDB unavailable'));
      return;
    }
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE, { keyPath: 'id' });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function withStore<T>(
  mode: IDBTransactionMode,
  fn: (store: IDBObjectStore) => Promise<T> | T,
): Promise<T> {
  const db = await openDb();
  return new Promise<T>((resolve, reject) => {
    const tx = db.transaction(STORE, mode);
    const store = tx.objectStore(STORE);
    Promise.resolve(fn(store))
      .then((res) => {
        tx.oncomplete = () => resolve(res);
        tx.onerror = () => reject(tx.error);
      })
      .catch(reject);
  });
}

function uid(): string {
  return `out-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

export async function enqueueMutation(
  url: string,
  method: OutboxEntry['method'],
  body: unknown,
): Promise<OutboxEntry> {
  const entry: OutboxEntry = {
    id: uid(),
    url,
    method,
    body,
    status: 'pending',
    createdAt: Date.now(),
    attempts: 0,
  };
  await withStore('readwrite', (store) => {
    store.add(entry);
  });
  return entry;
}

export async function getPendingEntries(): Promise<OutboxEntry[]> {
  return withStore('readonly', (store) => {
    return new Promise<OutboxEntry[]>((resolve, reject) => {
      const req = store.getAll();
      req.onsuccess = () =>
        resolve(
          (req.result as OutboxEntry[])
            .filter((e) => e.status !== 'conflict')
            .sort((a, b) => a.createdAt - b.createdAt),
        );
      req.onerror = () => reject(req.error);
    });
  });
}

export async function deleteEntry(id: string): Promise<void> {
  await withStore('readwrite', (store) => {
    store.delete(id);
  });
}

export async function updateEntry(id: string, patch: Partial<OutboxEntry>): Promise<void> {
  await withStore('readwrite', (store) => {
    return new Promise<void>((resolve, reject) => {
      const req = store.get(id);
      req.onsuccess = () => {
        const cur = req.result as OutboxEntry | undefined;
        if (!cur) return resolve();
        const updated = { ...cur, ...patch };
        const putReq = store.put(updated);
        putReq.onsuccess = () => resolve();
        putReq.onerror = () => reject(putReq.error);
      };
      req.onerror = () => reject(req.error);
    });
  });
}

/**
 * Wrapper principal utilisé par les pages (Juge-Arbitre, etc.).
 * Si online et fetch réussit → return { ok:true, queued:false, status:200 }
 * Si offline ou network error → enqueue et return { ok:true, queued:true }
 * Si 409 conflict → return { ok:false, queued:false, status:409 }
 */
export async function enqueueOrSubmit(
  url: string,
  method: OutboxEntry['method'],
  body: unknown,
): Promise<{ ok: boolean; queued: boolean; status?: number; data?: unknown }> {
  const isOnline = typeof navigator === 'undefined' || navigator.onLine;
  if (!isOnline) {
    await enqueueMutation(url, method, body);
    return { ok: true, queued: true };
  }
  try {
    const res = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (res.status === 409) {
      return { ok: false, queued: false, status: 409 };
    }
    if (!res.ok) {
      // Erreur serveur réelle (5xx) : on retente plus tard via outbox
      await enqueueMutation(url, method, body);
      return { ok: false, queued: true, status: res.status };
    }
    const data = await res.json().catch(() => ({}));
    return { ok: true, queued: false, status: res.status, data };
  } catch {
    // Network error → enqueue
    await enqueueMutation(url, method, body);
    return { ok: true, queued: true };
  }
}

/**
 * Vide l'outbox en rejouant les mutations FIFO.
 * À appeler au `online` event ou via Background Sync (service worker).
 */
export async function drainOutbox(): Promise<{
  drained: number;
  failed: number;
  conflicts: number;
}> {
  const entries = await getPendingEntries();
  let drained = 0;
  let failed = 0;
  let conflicts = 0;

  for (const entry of entries) {
    await updateEntry(entry.id, { status: 'syncing', attempts: entry.attempts + 1 });
    try {
      const res = await fetch(entry.url, {
        method: entry.method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(entry.body),
      });
      if (res.status === 409) {
        await updateEntry(entry.id, { status: 'conflict', lastError: 'Version conflict' });
        conflicts++;
        continue;
      }
      if (res.ok) {
        await deleteEntry(entry.id);
        drained++;
      } else {
        const text = await res.text().catch(() => '');
        await updateEntry(entry.id, { status: 'failed', lastError: text || `HTTP ${res.status}` });
        failed++;
      }
    } catch (e) {
      await updateEntry(entry.id, {
        status: 'failed',
        lastError: e instanceof Error ? e.message : String(e),
      });
      failed++;
    }
  }
  return { drained, failed, conflicts };
}

// Auto-drain au retour online
if (typeof window !== 'undefined') {
  window.addEventListener('online', () => {
    void drainOutbox();
  });
}
