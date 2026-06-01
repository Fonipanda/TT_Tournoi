import type { ReactNode } from 'react';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth/server';
import { LogoutButton } from '@/components/LogoutButton';
import { ToastViewport } from '@/components/ui/toast';

export default async function StaffLayout({ children }: { children: ReactNode }) {
  const me = await getCurrentUser();
  if (!me) redirect('/login?redirect=/admin');
  if (me.role !== 'admin' && me.role !== 'juge_arbitre') redirect('/?error=forbidden');

  const isAdmin = me.role === 'admin';

  return (
    <div className="min-h-screen flex">
      <aside
        className="w-56 bg-slate-900 text-slate-100 p-4 flex flex-col"
        data-testid="staff-sidebar"
      >
        <Link
          href={isAdmin ? '/admin' : '/juge-arbitre'}
          className="font-heading text-xl uppercase tracking-wide text-tv-accent mb-6"
        >
          TT · Staff
        </Link>
        <nav className="flex flex-col gap-1 text-sm">
          {isAdmin && (
            <>
              <Link href="/admin" className="hover:bg-slate-800 px-2 py-2">
                Tableau de bord
              </Link>
              <Link href="/admin/tournois" className="hover:bg-slate-800 px-2 py-2">
                Tournois
              </Link>
              <Link href="/admin/tableaux" className="hover:bg-slate-800 px-2 py-2">
                Tableaux
              </Link>
              <Link href="/admin/joueurs" className="hover:bg-slate-800 px-2 py-2">
                Joueurs
              </Link>
              <Link href="/admin/salles" className="hover:bg-slate-800 px-2 py-2">
                Salles & tables
              </Link>
              <Link href="/admin/buvette" className="hover:bg-slate-800 px-2 py-2">
                Buvette
              </Link>
              <Link href="/admin/sms" className="hover:bg-slate-800 px-2 py-2">
                SMS
              </Link>
              <Link href="/admin/comptes" className="hover:bg-slate-800 px-2 py-2">
                Comptes
              </Link>
              <Link href="/admin/parametres" className="hover:bg-slate-800 px-2 py-2">
                Paramètres
              </Link>
              <Link
                href="/admin/sync-status"
                className="hover:bg-slate-800 px-2 py-2"
              >
                Sync (PWA)
              </Link>
            </>
          )}
          <Link
            href="/juge-arbitre"
            className="hover:bg-slate-800 px-2 py-2 mt-2 border-t border-slate-700 pt-3"
          >
            Juge-Arbitre
          </Link>
          <Link
            href="/live"
            className="hover:bg-slate-800 px-2 py-2 text-slate-400"
            target="_blank"
          >
            Live (public) ↗
          </Link>
        </nav>
        <div className="mt-auto">
          <LogoutButton
            label={`Déconnexion (${me.username ?? me.role})`}
            className="w-full text-sm text-danger hover:underline pt-4 border-t border-slate-700 text-left disabled:opacity-50"
          />
        </div>
      </aside>
      <main className="flex-1 p-6 overflow-x-auto">{children}</main>
      <ToastViewport />
    </div>
  );
}
