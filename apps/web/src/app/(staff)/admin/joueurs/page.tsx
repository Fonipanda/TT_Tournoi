import { prisma } from '@tt/db';
import { PlayerList } from '@/components/admin/PlayerList';
import { serialize } from '@/lib/serialize';

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
    include: {
      registrations: {
        where: { isActive: true },
        include: { bracket: { select: { name: true } } },
      },
    },
  });

  // Mapper avec les noms de tableaux
  const playersWithBrackets = players.map((p) => ({
    id: p.id,
    firstName: p.firstName,
    lastName: p.lastName,
    licenseNumber: p.licenseNumber,
    ranking: p.ranking,
    points: p.points,
    club: p.club,
    email: p.email,
    phone: p.phone,
    isActive: p.isActive,
    bracketNames: p.registrations.map((r) => r.bracket.name),
  }));

  return (
    <div data-testid="admin-joueurs">
      <PlayerList players={serialize(playersWithBrackets)} />
    </div>
  );
}
