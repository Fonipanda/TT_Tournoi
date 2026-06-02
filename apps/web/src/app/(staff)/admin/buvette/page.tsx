import { redirect } from 'next/navigation';
import { prisma } from '@tt/db';
import { BuvetteAdminPage } from '@/components/admin/BuvetteAdminPage';
import { serialize } from '@/lib/serialize';

export const dynamic = 'force-dynamic';

export default async function AdminBuvettePage() {
  const tournaments = await prisma.tournament.findMany({
    where: { isActive: true },
    select: { id: true, name: true },
    orderBy: { startDate: 'desc' },
  });

  // S'il n'y a aucun tournoi, on en crée un implicite "default" pour rattacher les sections
  let defaultTournamentId: string | null = tournaments[0]?.id ?? null;

  if (!defaultTournamentId) {
    return (
      <div className="card text-center py-12 text-foreground-muted" data-testid="no-tournament">
        Aucun tournoi actif.{' '}
        <a href="/admin/tournois" className="text-primary underline">
          Créer un tournoi
        </a>{' '}
        avant de configurer la buvette.
      </div>
    );
  }

  // Toutes les sections de tous les tournois (buvette globale)
  const sections = await prisma.menuSection.findMany({
    orderBy: [{ order: 'asc' }, { name: 'asc' }],
    include: { items: { orderBy: { order: 'asc' } } },
  });

  return (
    <div data-testid="admin-buvette">
      <BuvetteAdminPage
        tournaments={tournaments}
        selectedTournamentId={defaultTournamentId}
        sections={serialize(
          sections.map((s) => ({
            id: s.id,
            name: s.name,
            order: s.order,
            items: s.items.map((it) => ({
              id: it.id,
              name: it.name,
              description: it.description,
              price: it.price.toString(),
              imageUrl: it.imageUrl,
              isAvailable: it.isAvailable,
              order: it.order,
            })),
          })),
        )}
      />
    </div>
  );
}
