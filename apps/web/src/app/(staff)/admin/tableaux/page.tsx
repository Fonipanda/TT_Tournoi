import { prisma } from '@tt/db';
import { BracketList } from '@/components/admin/BracketList';
import { serialize } from '@/lib/serialize';

export const dynamic = 'force-dynamic';

interface Props {
  searchParams: Promise<{ tournamentId?: string }>;
}

export default async function AdminTableauxPage({ searchParams }: Props) {
  const { tournamentId } = await searchParams;

  const [brackets, tournaments] = await Promise.all([
    prisma.bracket.findMany({
      where: tournamentId ? { tournamentId, isActive: true } : { isActive: true },
      include: {
        tournament: { select: { id: true, name: true } },
        _count: {
          select: { matches: true, registrations: { where: { isActive: true } } },
        },
      },
      orderBy: [{ tournament: { startDate: 'desc' } }, { startTime: 'asc' }],
    }),
    prisma.tournament.findMany({
      where: { isActive: true },
      select: { id: true, name: true },
      orderBy: { startDate: 'desc' },
    }),
  ]);

  return (
    <div data-testid="admin-tableaux">
      <BracketList
        brackets={serialize(brackets) as unknown as Parameters<typeof BracketList>[0]['brackets']}
        tournaments={serialize(tournaments)}
        selectedTournamentId={tournamentId}
      />
    </div>
  );
}
