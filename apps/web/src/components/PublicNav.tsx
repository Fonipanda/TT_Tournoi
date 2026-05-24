'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const NAV_ITEMS = [
  { href: '/', label: 'Accueil' },
  { href: '/live', label: 'Live' },
  { href: '/progression', label: 'Progression' },
  { href: '/buvette', label: 'Buvette' },
  { href: '/reglement', label: 'Règlement' },
];

export function PublicNav() {
  const pathname = usePathname();
  return (
    <header
      className="sticky top-0 z-40 bg-surface border-b border-border"
      data-testid="public-nav"
    >
      <div className="max-w-7xl mx-auto px-4 flex items-center justify-between h-14">
        <Link
          href="/"
          className="font-heading text-xl font-semibold tracking-wide text-primary uppercase"
          data-testid="logo"
        >
          TT Tournoi
        </Link>
        <nav className="flex items-center gap-1">
          {NAV_ITEMS.map((item) => {
            const active =
              item.href === '/' ? pathname === '/' : pathname.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                data-testid={`nav-${item.href.slice(1) || 'home'}`}
                className={`px-3 h-14 flex items-center text-sm font-medium border-b-2 transition-colors ${
                  active
                    ? 'border-primary text-primary'
                    : 'border-transparent text-foreground-muted hover:text-foreground'
                }`}
              >
                {item.label}
              </Link>
            );
          })}
          <Link
            href="/login"
            className="ml-4 btn-primary text-sm"
            data-testid="login-link"
          >
            Se connecter
          </Link>
        </nav>
      </div>
    </header>
  );
}
