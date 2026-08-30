import type { ReactNode } from 'react';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth/server';
import { canBypassMaintenance, getMaintenanceState } from '@/lib/maintenance';
import { PublicNav } from '@/components/PublicNav';

export const dynamic = 'force-dynamic';

export default async function JoueurLayout({ children }: { children: ReactNode }) {
  const me = await getCurrentUser();
  if (!me) redirect('/login?redirect=/mon-espace');

  const { enabled } = await getMaintenanceState();
  if (enabled && !canBypassMaintenance(me.role)) redirect('/maintenance');

  return (
    <>
      <PublicNav user={{ username: me.username, role: me.role, playerId: me.playerId }} />
      <div className="max-w-7xl mx-auto px-4 py-6">
        {/*
          Barre maintenue à l'écran au défilement : `top-14` correspond à la
          hauteur de l'en-tête (`h-14`, lui-même `sticky top-0 z-40`), et
          `z-30` la fait passer sous celui-ci plutôt que devant.
        */}
        <nav
          className="card mb-4 flex items-center gap-2 flex-wrap sticky top-14 z-30"
          data-testid="player-nav"
        >
          <Link href="/mon-espace" className="btn-secondary text-sm">
            Mon espace
          </Link>
          <Link href="/mon-parcours" className="btn-secondary text-sm">
            Mon parcours
          </Link>
          <Link href="/mes-points" className="btn-secondary text-sm">
            Mes points
          </Link>
          <Link href="/notifications" className="btn-secondary text-sm">
            Notifications
          </Link>
          <Link href="/inscription" className="btn-secondary text-sm">
            Inscription
          </Link>
          {/* La déconnexion est portée par la barre de navigation principale :
              un second bouton ici induirait en erreur. */}
        </nav>
        <main>{children}</main>
      </div>
    </>
  );
}
