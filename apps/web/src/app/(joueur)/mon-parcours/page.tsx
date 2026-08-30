import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth/server';
import { prisma } from '@tt/db';
import { MonParcoursContent } from './MonParcoursContent';

export const dynamic = 'force-dynamic';

export default async function MonParcoursPage() {
  const me = await getCurrentUser();
  if (!me?.playerId) redirect('/login');

  const player = await prisma.player.findUnique({
    where: { id: me.playerId },
    include: {
      // Les inscriptions annulées ne font pas partie du parcours : leur
      // tableau serait proposé au sélecteur sans que le joueur y figure.
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
    <MonParcoursContent
      playerId={player.id}
      registrations={player.registrations.map((r) => ({
        id: r.id,
        bracket: {
          id: r.bracketId,
          name: r.bracket.name,
          tournament: { name: r.bracket.tournament.name },
        },
      }))}
    />
  );
}
