import type { ReactNode } from 'react';
import { redirect } from 'next/navigation';
import { PublicNav } from '@/components/PublicNav';
import { getCurrentUser } from '@/lib/auth/server';
import { canBypassMaintenance, getMaintenanceState } from '@/lib/maintenance';

// L'état de maintenance est lu à chaque requête : une page mise en cache
// continuerait de s'afficher après l'activation du mode.
export const dynamic = 'force-dynamic';

export default async function PublicLayout({ children }: { children: ReactNode }) {
  // Lu systématiquement : la barre de navigation doit refléter l'état de
  // session sur toutes les pages publiques, pas seulement en maintenance.
  const user = await getCurrentUser();

  const { enabled } = await getMaintenanceState();
  if (enabled) {
    // L'organisation garde l'accès, sinon plus personne ne pourrait
    // désactiver le mode maintenance depuis le site.
    if (!canBypassMaintenance(user?.role)) redirect('/maintenance');
  }

  return (
    <div className="min-h-screen flex flex-col">
      <PublicNav
        user={
          user
            ? { username: user.username, role: user.role, playerId: user.playerId }
            : null
        }
      />
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 py-6">{children}</main>
      <footer className="border-t border-border bg-surface mt-auto">
        <div className="max-w-7xl mx-auto px-4 py-4 text-xs text-foreground-muted flex flex-wrap justify-between items-center gap-2">
          <span>© Chelles Tennis de Table — TT Tournoi v2</span>
          <span className="font-mono">Conforme FFTT I.301-305</span>
        </div>
      </footer>
    </div>
  );
}
