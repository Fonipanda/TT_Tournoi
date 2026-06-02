import { prisma } from '@tt/db';
import { TournamentList } from '@/components/admin/TournamentList';

export const dynamic = 'force-dynamic';

export default async function AdminTournoisPage() {
  const tournaments = await prisma.tournament.findMany({
    orderBy: [{ isActive: 'desc' }, { startDate: 'desc' }],
    include: { _count: { select: { brackets: true } } },
  });

  // Sérialiser dates et JSON pour Client Components
  const serialized = tournaments.map((t) => ({
    ...t,
    startDate: t.startDate ? t.startDate.toISOString() : null,
    endDate: t.endDate ? t.endDate.toISOString() : null,
    createdAt: t.createdAt.toISOString(),
    updatedAt: t.updatedAt.toISOString(),
  }));

  return (
    <div data-testid="admin-tournois">
      <TournamentList tournaments={serialized} />
    </div>
  );
}
