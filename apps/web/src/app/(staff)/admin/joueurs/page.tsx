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
        include: { bracket: { select: { id: true, name: true } } },
      },
    },
  });

  // Tableaux et tournois pour la colonne éditable et la modale « Éditer ».
  // `tournamentId` est indispensable : sans lui la modale ne pourrait pas
  // regrouper les tableaux par tournoi ni préserver les inscriptions posées
  // sur un autre tournoi que celui affiché.
  //
  // Les tableaux désactivés sont inclus : un joueur peut y être inscrit, et les
  // masquer rendrait son inscription invisible donc irrévocable — il resterait
  // rattaché à un tableau qui ne se tiendra pas, sans possibilité de le
  // basculer vers un autre.
  const [allBrackets, tournaments] = await Promise.all([
    prisma.bracket.findMany({
      select: {
        id: true,
        name: true,
        tournamentId: true,
        day: true,
        minPoints: true,
        maxPoints: true,
        maxPlayers: true,
        isActive: true,
        _count: { select: { registrations: { where: { isActive: true } } } },
      },
      orderBy: { name: 'asc' },
    }),
    prisma.tournament.findMany({
      orderBy: [{ isActive: 'desc' }, { startDate: 'desc' }],
      select: { id: true, name: true, isActive: true },
    }),
  ]);

  const bracketOptions = allBrackets.map((b) => ({
    id: b.id,
    name: b.name,
    tournamentId: b.tournamentId,
    day: b.day,
    minPoints: b.minPoints,
    maxPoints: b.maxPoints,
    maxPlayers: b.maxPlayers,
    isActive: b.isActive,
    registeredCount: b._count.registrations,
  }));

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
    bracketIds: p.registrations.map((r) => r.bracket.id),
  }));

  return (
    <div data-testid="admin-joueurs">
      <PlayerList
        players={serialize(playersWithBrackets)}
        allBrackets={serialize(bracketOptions)}
        tournaments={serialize(tournaments)}
      />
    </div>
  );
}
