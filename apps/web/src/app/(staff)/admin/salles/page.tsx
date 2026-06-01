import { prisma } from '@tt/db';
import { RoomList } from '@/components/admin/RoomList';

export const dynamic = 'force-dynamic';

export default async function AdminSallesPage() {
  const [rooms, tournaments] = await Promise.all([
    prisma.room.findMany({
      where: { isActive: true },
      include: { tables: { orderBy: { number: 'asc' } } },
      orderBy: { name: 'asc' },
    }),
    prisma.tournament.findMany({
      where: { isActive: true },
      select: { id: true, name: true },
      orderBy: { startDate: 'desc' },
    }),
  ]);

  return (
    <div data-testid="admin-salles">
      <RoomList rooms={rooms} tournaments={tournaments} />
    </div>
  );
}
