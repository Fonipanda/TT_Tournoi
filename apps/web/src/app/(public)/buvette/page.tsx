import { prisma } from '@tt/db';
import { BuvetteMenu } from './BuvetteMenu';

export const dynamic = 'force-dynamic';

export default async function BuvettePage() {
  const tournament = await prisma.tournament.findFirst({
    where: { isActive: true },
    orderBy: { startDate: 'desc' },
  });
  if (!tournament) {
    return <p className="text-foreground-muted">Aucun tournoi actif.</p>;
  }
  const sections = await prisma.menuSection.findMany({
    where: { tournamentId: tournament.id },
    orderBy: { order: 'asc' },
    include: {
      items: { where: { isAvailable: true }, orderBy: { order: 'asc' } },
    },
  });

  return (
    <BuvetteMenu
      sections={sections.map((s) => ({
        id: s.id,
        name: s.name,
        items: s.items.map((it) => ({
          id: it.id,
          name: it.name,
          description: it.description,
          price: it.price.toString(),
          imageUrl: it.imageUrl,
        })),
      }))}
    />
  );
}
