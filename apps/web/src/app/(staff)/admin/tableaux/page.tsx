import { prisma } from '@tt/db';
import { BracketList } from '@/components/admin/BracketList';

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
        _count: { select: { matches: true, registrations: true } },
      },
      orderBy: [{ tournament: { startDate: 'desc' } }, { startTime: 'asc' }],
    }),
    prisma.tournament.findMany({
      where: { isActive: true },
      select: { id: true, name: true },
      orderBy: { startDate: 'desc' },
    }),
  ]);

  // Sérialiser les Decimal en number pour passer aux Client Components
  const serializedBrackets = brackets.map((b) => ({
    ...b,
    entryFee: Number(b.entryFee),
    dotationQuarter: Number(b.dotationQuarter),
    dotationSemi: Number(b.dotationSemi),
    dotationFinalist: Number(b.dotationFinalist),
    dotationWinner: Number(b.dotationWinner),
    createdAt: b.createdAt.toISOString(),
  }));

  return (
    <div data-testid="admin-tableaux">
      <BracketList
        brackets={serializedBrackets}
        tournaments={tournaments}
        selectedTournamentId={tournamentId}
      />
    </div>
  );
}
