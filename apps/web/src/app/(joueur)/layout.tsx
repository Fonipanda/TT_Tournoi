import type { ReactNode } from 'react';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth/server';
import { PublicNav } from '@/components/PublicNav';
import { LogoutButton } from '@/components/LogoutButton';

export default async function JoueurLayout({ children }: { children: ReactNode }) {
  const me = await getCurrentUser();
  if (!me) redirect('/login?redirect=/mon-espace');

  return (
    <>
      <PublicNav />
      <div className="max-w-7xl mx-auto px-4 py-6">
        <nav className="card mb-4 flex items-center gap-2 flex-wrap" data-testid="player-nav">
          <Link href="/mon-espace" className="btn-secondary text-sm">
            Mon espace
          </Link>
          <Link href="/notifications" className="btn-secondary text-sm">
            Notifications
          </Link>
          <Link href="/inscription" className="btn-secondary text-sm">
            Inscription
          </Link>
          <div className="ml-auto">
            <LogoutButton label="Déconnexion" redirectTo="/" />
          </div>
        </nav>
        <main>{children}</main>
      </div>
    </>
  );
}
