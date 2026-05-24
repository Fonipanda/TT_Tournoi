import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth/server';
import { prisma } from '@tt/db';

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
    <div data-testid="mon-espace">
      <h1 className="font-heading text-3xl uppercase tracking-wide mb-6">Mon espace</h1>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <div className="card">
          <p className="text-xs uppercase tracking-widest text-foreground-muted">Joueur</p>
          <p className="font-heading text-2xl mt-1">
            {player.lastName} {player.firstName}
          </p>
          <p className="text-foreground-muted text-sm">{player.club ?? '—'}</p>
        </div>
        <div className="card text-center">
          <p className="text-xs uppercase tracking-widest text-foreground-muted">
            Points actuels
          </p>
          <p className="font-heading text-4xl tabular text-primary mt-1">
            {Math.round(player.points)}
          </p>
        </div>
        <div className="card text-center">
          <p className="text-xs uppercase tracking-widest text-foreground-muted">Licence</p>
          <p className="font-mono text-2xl tabular mt-1">{player.licenseNumber ?? '—'}</p>
        </div>
      </div>

      <h2 className="font-heading text-xl uppercase tracking-wide mb-3">Mes inscriptions</h2>
      {player.registrations.length === 0 ? (
        <p className="text-foreground-muted">Aucune inscription pour le moment.</p>
      ) : (
        <div className="card">
          <ul className="divide-y divide-border">
            {player.registrations.map((r) => (
              <li
                key={r.id}
                className="py-3 flex items-center justify-between"
                data-testid={`registration-${r.id}`}
              >
                <div>
                  <p className="font-medium">{r.bracket.name}</p>
                  <p className="text-sm text-foreground-muted">
                    {r.bracket.tournament.name}
                  </p>
                </div>
                <span
                  className={`text-xs px-2 py-1 ${
                    r.paymentStatus === 'paid'
                      ? 'bg-success-soft text-success'
                      : 'bg-warning-soft text-warning'
                  }`}
                >
                  {r.paymentStatus === 'paid' ? 'Payé' : 'En attente'}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
