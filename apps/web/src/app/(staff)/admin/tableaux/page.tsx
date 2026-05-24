import { prisma } from '@tt/db';
import Link from 'next/link';

export const dynamic = 'force-dynamic';

export default async function AdminTableauxPage() {
  const brackets = await prisma.bracket.findMany({
    where: { isActive: true },
    include: {
      tournament: { select: { name: true } },
      _count: { select: { matches: true, registrations: true } },
    },
    orderBy: [{ tournament: { startDate: 'desc' } }, { startTime: 'asc' }],
  });

  return (
    <div data-testid="admin-tableaux">
      <h1 className="font-heading text-3xl uppercase tracking-wide mb-6">Tableaux</h1>
      <div className="card overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="text-xs uppercase tracking-widest text-foreground-muted">
            <tr className="border-b border-border">
              <th className="text-left py-2">Tournoi</th>
              <th className="text-left py-2">Tableau</th>
              <th className="text-left py-2">Catégorie</th>
              <th className="text-center py-2">Inscrits</th>
              <th className="text-center py-2">Matches</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {brackets.map((b) => (
              <tr key={b.id} className="border-b border-border hover:bg-bg-alt">
                <td className="py-2 text-foreground-muted">{b.tournament.name}</td>
                <td className="py-2 font-medium">{b.name}</td>
                <td className="py-2 text-foreground-muted">{b.category}</td>
                <td className="py-2 text-center tabular">{b._count.registrations}</td>
                <td className="py-2 text-center tabular">{b._count.matches}</td>
                <td className="py-2 text-right">
                  <Link
                    href={`/progression/${b.id}`}
                    className="text-primary text-sm hover:underline"
                  >
                    Voir →
                  </Link>
                </td>
              </tr>
            ))}
            {brackets.length === 0 && (
              <tr>
                <td colSpan={6} className="py-6 text-center text-foreground-muted">
                  Aucun tableau.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
