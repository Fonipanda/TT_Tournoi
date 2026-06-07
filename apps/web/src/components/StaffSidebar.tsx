'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import { LogoutButton } from '@/components/LogoutButton';

interface Props {
  isAdmin: boolean;
  username: string;
}

/**
 * Sidebar staff responsive :
 * - Desktop (≥ md) : visible en permanence à gauche, w-56
 * - Mobile (< md) : drawer toggleable via burger button en haut
 */
export function StaffSidebar({ isAdmin, username }: Props) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();

  // Ferme le drawer au changement de route
  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  // Empêche scroll body quand drawer ouvert
  useEffect(() => {
    if (open) {
      document.body.style.overflow = 'hidden';
      return () => {
        document.body.style.overflow = '';
      };
    }
  }, [open]);

  return (
    <>
      {/* Mobile top bar avec burger */}
      <div className="md:hidden fixed top-0 left-0 right-0 z-40 bg-slate-900 text-slate-100 flex items-center justify-between px-3 h-12">
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="inline-flex items-center justify-center w-11 h-11 -ml-3 rounded hover:bg-slate-800"
          aria-label="Ouvrir le menu"
        >
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <line x1="3" y1="6" x2="21" y2="6" />
            <line x1="3" y1="12" x2="21" y2="12" />
            <line x1="3" y1="18" x2="21" y2="18" />
          </svg>
        </button>
        <span className="font-heading text-sm uppercase tracking-wide">TT · Staff</span>
        <span className="w-11" /> {/* spacer */}
      </div>

      {/* Backdrop mobile */}
      {open && (
        <div
          className="md:hidden fixed inset-0 z-40 bg-black/50"
          onClick={() => setOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* Sidebar */}
      <aside
        className={`bg-slate-900 text-slate-100 p-4 flex flex-col w-64 md:w-56 fixed md:sticky md:top-0 md:h-screen z-50 inset-y-0 left-0 transform transition-transform md:transform-none ${
          open ? 'translate-x-0' : '-translate-x-full md:translate-x-0'
        }`}
        data-testid="staff-sidebar"
      >
        <div className="flex items-center justify-between mb-6">
          <Link
            href={isAdmin ? '/admin' : '/juge-arbitre'}
            className="font-heading text-xl uppercase tracking-wide text-tv-accent"
          >
            TT · Staff
          </Link>
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="md:hidden inline-flex items-center justify-center w-9 h-9 rounded hover:bg-slate-800"
            aria-label="Fermer le menu"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        <nav className="flex flex-col gap-1 text-sm">
          {isAdmin && (
            <>
              <Link href="/admin" className="hover:bg-slate-800 px-2 py-3 md:py-2 rounded">
                Tableau de bord
              </Link>
              <Link href="/admin/tournois" className="hover:bg-slate-800 px-2 py-3 md:py-2 rounded">
                Tournois
              </Link>
              <Link href="/admin/tableaux" className="hover:bg-slate-800 px-2 py-3 md:py-2 rounded">
                Tableaux
              </Link>
              <Link href="/admin/joueurs" className="hover:bg-slate-800 px-2 py-3 md:py-2 rounded">
                Joueurs
              </Link>
              <Link href="/admin/salles" className="hover:bg-slate-800 px-2 py-3 md:py-2 rounded">
                Salles & tables
              </Link>
              <Link href="/admin/buvette" className="hover:bg-slate-800 px-2 py-3 md:py-2 rounded">
                Buvette
              </Link>
              <Link href="/admin/sms" className="hover:bg-slate-800 px-2 py-3 md:py-2 rounded">
                SMS
              </Link>
              <Link href="/admin/comptes" className="hover:bg-slate-800 px-2 py-3 md:py-2 rounded">
                Comptes
              </Link>
              <Link href="/admin/parametres" className="hover:bg-slate-800 px-2 py-3 md:py-2 rounded">
                Paramètres
              </Link>
              <Link href="/admin/sync-status" className="hover:bg-slate-800 px-2 py-3 md:py-2 rounded">
                Sync (PWA)
              </Link>
            </>
          )}
          <Link
            href="/juge-arbitre"
            className="hover:bg-slate-800 px-2 py-3 md:py-2 rounded mt-2 border-t border-slate-700 pt-3"
          >
            Juge-Arbitre
          </Link>
          <Link
            href="/live"
            className="hover:bg-slate-800 px-2 py-3 md:py-2 rounded text-slate-400"
            target="_blank"
          >
            Live (public) ↗
          </Link>
        </nav>

        <div className="mt-auto">
          <LogoutButton
            label={`Déconnexion (${username})`}
            className="w-full text-sm text-danger hover:underline pt-4 border-t border-slate-700 text-left disabled:opacity-50"
          />
        </div>
      </aside>
    </>
  );
}
