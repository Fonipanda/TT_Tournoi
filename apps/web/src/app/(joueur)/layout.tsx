import type { ReactNode } from 'react';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth/server';
import { PublicNav } from '@/components/PublicNav';

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
          <form action="/api/auth/logout" method="post" className="ml-auto">
            <button
              type="submit"
              formAction="/api/auth/logout"
              className="text-sm text-danger hover:underline"
              data-testid="logout"
            >
              Déconnexion
            </button>
          </form>
        </nav>
        <main>{children}</main>
      </div>
    </>
  );
}
