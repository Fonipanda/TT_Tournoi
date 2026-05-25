'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

interface Props {
  className?: string;
  label?: string;
  redirectTo?: string;
}

export function LogoutButton({
  className = '',
  label = 'Déconnexion',
  redirectTo = '/login',
}: Props) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  const handleLogout = async () => {
    setLoading(true);
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
    } catch {
      /* ignore */
    } finally {
      // Reset complet de l'état React (vide le cookie côté serveur)
      router.push(redirectTo);
      router.refresh();
    }
  };

  return (
    <button
      type="button"
      onClick={handleLogout}
      disabled={loading}
      className={className || 'text-sm text-danger hover:underline disabled:opacity-50'}
      data-testid="logout-button"
    >
      {loading ? '…' : label}
    </button>
  );
}
