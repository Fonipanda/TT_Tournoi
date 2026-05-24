import { prisma } from '@tt/db';

export const dynamic = 'force-dynamic';

export default async function AdminJoueursPage() {
  const players = await prisma.player.findMany({
    where: { isActive: true },
    orderBy: [{ lastName: 'asc' }],
    take: 200,
  });

  return (
    <div data-testid="admin-joueurs">
      <h1 className="font-heading text-3xl uppercase tracking-wide mb-6">Joueurs</h1>
      <div className="card overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="text-xs uppercase tracking-widest text-foreground-muted">
            <tr className="border-b border-border">
              <th className="text-left py-2">Licence</th>
              <th className="text-left py-2">Nom</th>
              <th className="text-left py-2">Prénom</th>
              <th className="text-left py-2">Club</th>
              <th className="text-right py-2">Points</th>
              <th className="text-left py-2">Téléphone</th>
            </tr>
          </thead>
          <tbody>
            {players.map((p) => (
              <tr key={p.id} className="border-b border-border hover:bg-bg-alt">
                <td className="py-2 font-mono tabular text-xs">{p.licenseNumber}</td>
                <td className="py-2 font-medium uppercase">{p.lastName}</td>
                <td className="py-2">{p.firstName}</td>
                <td className="py-2 text-foreground-muted">{p.club ?? '—'}</td>
                <td className="py-2 text-right tabular">{Math.round(p.points)}</td>
                <td className="py-2 font-mono text-xs text-foreground-muted">{p.phone ?? '—'}</td>
              </tr>
            ))}
            {players.length === 0 && (
              <tr>
                <td colSpan={6} className="py-6 text-center text-foreground-muted">
                  Aucun joueur.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
