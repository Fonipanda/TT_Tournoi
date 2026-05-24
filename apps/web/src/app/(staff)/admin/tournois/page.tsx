import { prisma } from '@tt/db';
import Link from 'next/link';

export const dynamic = 'force-dynamic';

export default async function AdminTournoisPage() {
  const tournaments = await prisma.tournament.findMany({
    orderBy: [{ isActive: 'desc' }, { startDate: 'desc' }],
    include: { _count: { select: { brackets: true } } },
  });

  return (
    <div data-testid="admin-tournois">
      <div className="flex items-center justify-between mb-6">
        <h1 className="font-heading text-3xl uppercase tracking-wide">Tournois</h1>
        <button className="btn-primary text-sm" data-testid="new-tournament">
          + Nouveau tournoi
        </button>
      </div>

      <div className="card overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="text-xs uppercase tracking-widest text-foreground-muted">
            <tr className="border-b border-border">
              <th className="text-left py-2">Nom</th>
              <th className="text-left py-2">Date</th>
              <th className="text-left py-2">Lieu</th>
              <th className="text-center py-2">Tableaux</th>
              <th className="text-center py-2">Statut</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {tournaments.map((t) => (
              <tr key={t.id} className="border-b border-border hover:bg-bg-alt">
                <td className="py-2 font-medium">{t.name}</td>
                <td className="py-2 text-foreground-muted">{t.date}</td>
                <td className="py-2 text-foreground-muted">{t.location}</td>
                <td className="py-2 text-center tabular">{t._count.brackets}</td>
                <td className="py-2 text-center">
                  <span
                    className={`text-xs px-2 py-1 ${
                      t.isActive ? 'bg-success-soft text-success' : 'bg-bg-alt text-foreground-subtle'
                    }`}
                  >
                    {t.isActive ? 'Actif' : 'Archivé'}
                  </span>
                </td>
                <td className="py-2 text-right">
                  <Link
                    href={`/admin/tournois/${t.id}`}
                    className="text-primary text-sm hover:underline"
                  >
                    Détail →
                  </Link>
                </td>
              </tr>
            ))}
            {tournaments.length === 0 && (
              <tr>
                <td colSpan={6} className="py-6 text-center text-foreground-muted">
                  Aucun tournoi.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
