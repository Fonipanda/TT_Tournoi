import Link from 'next/link';

const ITEMS = [
  { href: '/mon-espace', label: 'Mon espace' },
  { href: '/mon-parcours', label: 'Mon parcours' },
  { href: '/mes-points', label: 'Mes points' },
  { href: '/notifications', label: 'Notifications' },
  { href: '/inscription', label: 'Inscription' },
];

/**
 * Barre de navigation de l'espace joueur.
 *
 * Partagée entre le layout des pages joueur et `/inscription`, qui appartient
 * au groupe public : le joueur doit retrouver les mêmes boutons partout dans
 * son espace, sans qu'un second jeu de liens ait à être maintenu en parallèle.
 *
 * Maintenue à l'écran au défilement : `top-14` correspond à la hauteur de
 * l'en-tête (`h-14`, lui-même `sticky top-0 z-40`), et `z-30` la fait passer
 * sous celui-ci plutôt que devant.
 *
 * Aucun état ni effet : le composant reste importable depuis un layout serveur
 * comme depuis une page client.
 */
export function PlayerNav() {
  return (
    <nav
      className="card mb-4 flex items-center gap-2 flex-wrap sticky top-14 z-30"
      data-testid="player-nav"
    >
      {ITEMS.map((item) => (
        <Link key={item.href} href={item.href} className="btn-secondary text-sm">
          {item.label}
        </Link>
      ))}
      {/* La déconnexion est portée par la barre de navigation principale :
          un second bouton ici induirait en erreur. */}
    </nav>
  );
}
