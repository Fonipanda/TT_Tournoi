import { prisma } from '@tt/db';
import { UserList } from '@/components/admin/UserList';

export const dynamic = 'force-dynamic';

export default async function AdminComptesPage() {
  const users = await prisma.userAccount.findMany({
    orderBy: [{ role: 'asc' }, { username: 'asc' }],
    include: {
      player: { select: { firstName: true, lastName: true, licenseNumber: true } },
    },
  });

  return (
    <div data-testid="admin-comptes">
      <UserList
        users={users.map((u) => ({
          id: u.id,
          username: u.username,
          email: u.email,
          role: u.role,
          isActive: u.isActive,
          passwordNeedsReset: u.passwordNeedsReset,
          playerId: u.playerId,
          player: u.player,
          createdAt: u.createdAt.toISOString(),
        }))}
      />
    </div>
  );
}
