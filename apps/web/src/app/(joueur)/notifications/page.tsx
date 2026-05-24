'use client';

import { useEffect, useState } from 'react';

interface Notif {
  id: string;
  type: string;
  title: string;
  message: string;
  isRead: boolean;
  createdAt: string;
}

export default function NotificationsPage() {
  const [notifs, setNotifs] = useState<Notif[]>([]);
  const [unreadOnly, setUnreadOnly] = useState(false);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    const r = await fetch(`/api/notifications${unreadOnly ? '?unread=1' : ''}`);
    const j = await r.json();
    setNotifs(j.data ?? []);
    setLoading(false);
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [unreadOnly]);

  const markRead = async (id: string) => {
    await fetch(`/api/notifications/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ isRead: true }),
    });
    setNotifs((prev) => prev.map((n) => (n.id === id ? { ...n, isRead: true } : n)));
  };

  return (
    <div data-testid="notifications-page">
      <div className="flex items-center justify-between mb-6">
        <h1 className="font-heading text-3xl uppercase tracking-wide">Notifications</h1>
        <label className="text-sm flex items-center gap-2">
          <input
            type="checkbox"
            checked={unreadOnly}
            onChange={(e) => setUnreadOnly(e.target.checked)}
            data-testid="unread-only"
          />
          Non lues uniquement
        </label>
      </div>

      {loading && <p className="text-foreground-muted">Chargement…</p>}
      {!loading && notifs.length === 0 && (
        <p className="text-foreground-muted">Aucune notification.</p>
      )}

      <ul className="space-y-2" data-testid="notif-list">
        {notifs.map((n) => (
          <li
            key={n.id}
            data-testid={`notif-${n.id}`}
            className={`card p-3 cursor-pointer ${
              n.isRead ? 'opacity-70' : 'border-primary'
            }`}
            onClick={() => !n.isRead && markRead(n.id)}
          >
            <div className="flex items-center justify-between gap-2">
              <p className="font-medium">{n.title}</p>
              {!n.isRead && (
                <span className="text-xs uppercase text-primary tracking-widest">
                  Non lue
                </span>
              )}
            </div>
            <p className="text-sm text-foreground-muted mt-1">{n.message}</p>
            <p className="text-xs text-foreground-subtle mt-2">
              {new Date(n.createdAt).toLocaleString('fr-FR')}
            </p>
          </li>
        ))}
      </ul>
    </div>
  );
}
