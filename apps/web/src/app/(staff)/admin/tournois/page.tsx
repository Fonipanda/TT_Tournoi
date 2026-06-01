import { prisma } from '@tt/db';
import { TournamentList } from '@/components/admin/TournamentList';

export const dynamic = 'force-dynamic';

export default async function AdminTournoisPage() {
  const tournaments = await prisma.tournament.findMany({
    orderBy: [{ isActive: 'desc' }, { startDate: 'desc' }],
    include: { _count: { select: { brackets: true } } },
  });

  return (
    <div data-testid="admin-tournois">
      <TournamentList tournaments={tournaments} />
    </div>
  );
}
