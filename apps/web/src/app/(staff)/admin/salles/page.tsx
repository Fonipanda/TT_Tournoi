import { prisma } from '@tt/db';
import { RoomList } from '@/components/admin/RoomList';

export const dynamic = 'force-dynamic';

interface Props {
  searchParams: Promise<{ inactive?: string }>;
}

export default async function AdminSallesPage({ searchParams }: Props) {
  const { inactive } = await searchParams;
  const showInactive = inactive === '1';

  const [rooms, tournaments] = await Promise.all([
    prisma.room.findMany({
      where: showInactive ? {} : { isActive: true },
      include: { tables: { orderBy: { number: 'asc' } } },
      orderBy: [{ isActive: 'desc' }, { name: 'asc' }],
    }),
    prisma.tournament.findMany({
      where: { isActive: true },
      select: { id: true, name: true },
      orderBy: { startDate: 'desc' },
    }),
  ]);

  return (
    <div data-testid="admin-salles">
      <RoomList
        rooms={rooms.map((r) => ({
          id: r.id,
          name: r.name,
          description: r.description,
          width: r.width,
          height: r.height,
          isActive: r.isActive,
          tables: r.tables,
        }))}
        tournaments={tournaments}
        showInactive={showInactive}
      />
    </div>
  );
}
