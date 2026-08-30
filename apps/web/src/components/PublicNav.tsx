'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import { LogoutButton } from '@/components/LogoutButton';

const NAV_ITEMS = [
  { href: '/', label: 'Accueil' },
  { href: '/live', label: 'Live' },
  { href: '/progression', label: 'Progression' },
  { href: '/buvette', label: 'Buvette' },
  { href: '/reglement', label: 'Règlement' },
];

const MON_ESPACE_ITEM = { href: '/mon-espace', label: 'Mon espace' };

interface Props {
  /**
   * Utilisateur courant, résolu côté serveur par le layout.
   *
   * Passé en prop plutôt que récupéré en `fetch` côté client : le bouton
   * afficherait sinon « Se connecter » pendant un instant à chaque chargement,
   * y compris pour un utilisateur connecté.
   */
  user?: { username?: string | null; role: string; playerId?: string | null } | null;
}

export function PublicNav({ user = null }: Props) {
  const pathname = usePathname();
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);

  /**
   * « Mon espace » n'est proposé qu'aux comptes joueur rattachés à une fiche.
   *
   * La condition porte aussi sur `playerId` : la page redirige vers l'écran de
   * connexion quand le compte n'a pas de fiche joueur, l'onglet renverrait
   * alors vers un cul-de-sac.
   */
  const navItems = useMemo(() => {
    if (user?.role !== 'player' || !user.playerId) return NAV_ITEMS;
    return [NAV_ITEMS[0]!, MON_ESPACE_ITEM, ...NAV_ITEMS.slice(1)];
  }, [user?.role, user?.playerId]);

  useEffect(() => {
    fetch('/api/settings')
      .then((r) => r.json())
      .then((j) => {
        if (j.data?.logo) setLogoUrl(j.data.logo);
      })
      .catch(() => undefined);
  }, []);

  // Ferme le menu mobile au changement de page
  useEffect(() => {
    setMenuOpen(false);
  }, [pathname]);

  const isActive = (href: string) =>
    href === '/' ? pathname === '/' : pathname.startsWith(href);

  return (
    <header
      className="sticky top-0 z-40 bg-surface border-b border-border"
      data-testid="public-nav"
    >
      <div className="max-w-7xl mx-auto px-4 flex items-center justify-between h-14">
        <Link href="/" className="flex items-center" data-testid="logo">
          {logoUrl ? (
            <img
              src={logoUrl}
              alt="Logo"
              className="max-h-10 w-auto object-contain"
            />
          ) : (
            <span className="font-heading text-base sm:text-xl font-semibold tracking-wide text-primary uppercase">
              TT Tournoi
            </span>
          )}
        </Link>

        {/* Desktop nav (≥ md) */}
        <nav className="hidden md:flex items-center gap-1">
          {navItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              data-testid={`nav-${item.href.slice(1) || 'home'}`}
              className={`px-3 h-14 flex items-center text-sm font-medium border-b-2 transition-colors ${
                isActive(item.href)
                  ? 'border-primary text-primary'
                  : 'border-transparent text-foreground-muted hover:text-foreground'
              }`}
            >
              {item.label}
            </Link>
          ))}
          {user ? (
            <LogoutButton
              label="Se déconnecter"
              redirectTo="/"
              className="ml-4 btn-secondary text-sm border-danger text-danger hover:bg-danger-soft disabled:opacity-50"
            />
          ) : (
            <Link
              href="/login"
              className="ml-4 btn-primary text-sm"
              data-testid="login-link"
            >
              Se connecter
            </Link>
          )}
        </nav>

        {/* Mobile burger button (< md) */}
        <button
          type="button"
          className="md:hidden inline-flex items-center justify-center w-11 h-11 rounded text-foreground hover:bg-bg-alt"
          aria-label={menuOpen ? 'Fermer le menu' : 'Ouvrir le menu'}
          aria-expanded={menuOpen}
          onClick={() => setMenuOpen((v) => !v)}
        >
          {menuOpen ? (
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          ) : (
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <line x1="3" y1="6" x2="21" y2="6" />
              <line x1="3" y1="12" x2="21" y2="12" />
              <line x1="3" y1="18" x2="21" y2="18" />
            </svg>
          )}
        </button>
      </div>

      {/* Mobile drawer */}
      {menuOpen && (
        <div className="md:hidden border-t border-border bg-surface">
          <nav className="flex flex-col px-4 py-2">
            {navItems.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={`py-3 px-2 text-sm font-medium border-b border-border/50 last:border-0 ${
                  isActive(item.href)
                    ? 'text-primary'
                    : 'text-foreground-muted'
                }`}
                onClick={() => setMenuOpen(false)}
              >
                {item.label}
              </Link>
            ))}
            {user ? (
              <div className="mt-3 mb-2">
                {user.username && (
                  <p className="text-xs text-foreground-muted px-2 pb-2">
                    Connecté en tant que <span className="font-medium">{user.username}</span>
                  </p>
                )}
                <LogoutButton
                  label="Se déconnecter"
                  redirectTo="/"
                  className="btn-secondary text-sm w-full border-danger text-danger hover:bg-danger-soft disabled:opacity-50"
                />
              </div>
            ) : (
              <Link
                href="/login"
                className="btn-primary text-sm mt-3 mb-2 text-center"
                onClick={() => setMenuOpen(false)}
              >
                Se connecter
              </Link>
            )}
          </nav>
        </div>
      )}
    </header>
  );
}
