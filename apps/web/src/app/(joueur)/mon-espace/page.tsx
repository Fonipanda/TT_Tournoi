import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth/server';
import { prisma } from '@tt/db';
import { MonEspaceContent } from './MonEspaceContent';

export const dynamic = 'force-dynamic';

export default async function MonEspacePage() {
  const me = await getCurrentUser();
  if (!me?.playerId) redirect('/login');

  const player = await prisma.player.findUnique({
    where: { id: me.playerId },
    include: {
      registrations: {
        where: { isActive: true },
        include: { bracket: { include: { tournament: true } } },
      },
    },
  });

  if (!player) {
    return <p className="text-foreground-muted">Joueur introuvable.</p>;
  }

  return (
    <MonEspaceContent
      player={{
        id: player.id,
        firstName: player.firstName,
        lastName: player.lastName,
        club: player.club,
        points: player.points,
        licenseNumber: player.licenseNumber,
      }}
      registrations={player.registrations.map((r) => ({
        id: r.id,
        paymentStatus: r.paymentStatus,
        bracket: { name: r.bracket.name, tournament: { name: r.bracket.tournament.name } },
      }))}
    />
  );
}
