import { redirect } from 'next/navigation';
import { prisma } from '@tt/db';
import { BuvetteAdminPage } from '@/components/admin/BuvetteAdminPage';

export const dynamic = 'force-dynamic';

interface Props {
  searchParams: Promise<{ tournamentId?: string }>;
}

export default async function AdminBuvettePage({ searchParams }: Props) {
  const { tournamentId } = await searchParams;

  const tournaments = await prisma.tournament.findMany({
    where: { isActive: true },
    select: { id: true, name: true },
    orderBy: { startDate: 'desc' },
  });

  if (tournaments.length === 0) {
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

  // Si pas de tournament en query, prendre le premier
  if (!tournamentId) {
    redirect(`/admin/buvette?tournamentId=${tournaments[0].id}`);
  }

  const sections = await prisma.menuSection.findMany({
    where: { tournamentId },
    orderBy: { order: 'asc' },
    include: { items: { orderBy: { order: 'asc' } } },
  });

  return (
    <div data-testid="admin-buvette">
      <BuvetteAdminPage
        tournaments={tournaments}
        selectedTournamentId={tournamentId}
        sections={sections.map((s) => ({
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
        }))}
      />
    </div>
  );
}
