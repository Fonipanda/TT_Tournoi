import { prisma } from '@tt/db';
import { PlayerList } from '@/components/admin/PlayerList';

export const dynamic = 'force-dynamic';

interface Props {
  searchParams: Promise<{ search?: string }>;
}

export default async function AdminJoueursPage({ searchParams }: Props) {
  const { search } = await searchParams;

  const where = search
    ? {
        isActive: true,
        OR: [
          { lastName: { contains: search, mode: 'insensitive' as const } },
          { firstName: { contains: search, mode: 'insensitive' as const } },
          { licenseNumber: { contains: search } },
          { club: { contains: search, mode: 'insensitive' as const } },
        ],
      }
    : { isActive: true };

  const players = await prisma.player.findMany({
    where,
    orderBy: [{ lastName: 'asc' }],
    take: 200,
  });

  return (
    <div data-testid="admin-joueurs">
      <PlayerList players={players} />
    </div>
  );
}
