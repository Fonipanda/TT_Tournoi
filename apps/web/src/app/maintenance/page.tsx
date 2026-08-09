import type { Metadata } from 'next';
import Link from 'next/link';
import { getCurrentUser } from '@/lib/auth/server';
import { canBypassMaintenance, getMaintenanceState } from '@/lib/maintenance';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Maintenance en cours',
  robots: { index: false, follow: false },
};

/**
 * Page affichée aux visiteurs et aux joueurs quand le mode maintenance est
 * actif. Volontairement autonome (pas de layout public) : la navigation
 * habituelle n'aurait pas de sens puisque toutes les pages redirigent ici.
 */
export default async function MaintenancePage() {
  const [{ enabled, message }, user] = await Promise.all([
    getMaintenanceState(),
    getCurrentUser(),
  ]);

  const isStaff = canBypassMaintenance(user?.role);

  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center px-4 py-12 text-center bg-gradient-to-br from-primary-soft to-accent-soft"
      data-testid="maintenance-page"
    >
      <div className="text-7xl mb-6 select-none animate-spin-slow" aria-hidden="true">
        🏓
      </div>

      <h1 className="font-heading text-3xl sm:text-4xl uppercase tracking-wide mb-4">
        Maintenance en cours
      </h1>

      <p className="text-foreground-muted max-w-md mb-8 whitespace-pre-line">{message}</p>

      {!enabled && (
        <p className="card border-success bg-success-soft text-success text-sm rounded-xl mb-6">
          La maintenance est terminée&nbsp;: le site est de nouveau accessible.
        </p>
      )}

      {isStaff && (
        <p className="card border-primary bg-surface text-sm rounded-xl mb-6 max-w-md">
          Tu es connecté avec un compte d&apos;organisation : l&apos;accès au site reste ouvert
          pour toi.
        </p>
      )}

      <div className="flex flex-wrap gap-3 justify-center">
        {!enabled && (
          <Link href="/" className="btn-primary rounded-full text-sm">
            Retour à l&apos;accueil
          </Link>
        )}
        {isStaff ? (
          <Link href="/admin/parametres" className="btn-secondary rounded-full text-sm">
            Gérer la maintenance
          </Link>
        ) : (
          <Link href="/login" className="btn-secondary rounded-full text-sm">
            Espace organisation
          </Link>
        )}
      </div>

      <p className="text-xs text-foreground-subtle mt-10">
        © Chelles Tennis de Table — TT Tournoi
      </p>
    </div>
  );
}
