import { notFound } from 'next/navigation';
import { prisma } from '@tt/db';
import { BracketRegistrationsPage } from '@/components/admin/BracketRegistrationsPage';
import { serialize } from '@/lib/serialize';

export const dynamic = 'force-dynamic';

interface Props {
  params: Promise<{ id: string }>;
}

export default async function AdminBracketDetail({ params }: Props) {
  const { id } = await params;

  const bracket = await prisma.bracket.findUnique({
    where: { id },
    include: {
      registrations: {
        where: { isActive: true },
        include: { player: true },
      },
      matches: {
        orderBy: [{ poolNumber: 'asc' }, { poolMatchOrder: 'asc' }, { roundNumber: 'asc' }],
        include: {
          player1: { select: { id: true, firstName: true, lastName: true, points: true } },
          player2: { select: { id: true, firstName: true, lastName: true, points: true } },
          table: { select: { id: true, number: true, roomId: true } },
        },
      },
    },
  });

  if (!bracket) notFound();

  // Get available tables (free ones)
  const availableTables = await prisma.tableModel.findMany({
    where: { status: 'free' },
    orderBy: { number: 'asc' },
    select: { id: true, number: true, room: { select: { name: true } } },
  });

  // Get players currently in_progress on any table (to prevent double assignment)
  const busyPlayers = await prisma.match.findMany({
    where: { status: 'in_progress', tableId: { not: null } },
    select: { player1Id: true, player2Id: true },
  });
  const busyPlayerIds = new Set(
    busyPlayers.flatMap((m) => [m.player1Id, m.player2Id].filter(Boolean) as string[]),
  );

  return (
    <BracketRegistrationsPage
      bracketId={bracket.id}
      bracketName={bracket.name}
      registrations={serialize(bracket.registrations)}
      matches={serialize(bracket.matches)}
      availableTables={serialize(availableTables)}
      busyPlayerIds={[...busyPlayerIds]}
    />
  );
}
