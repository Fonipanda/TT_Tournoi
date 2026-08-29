import { prisma } from '@tt/db';
import Link from 'next/link';

export const dynamic = 'force-dynamic';

export default async function ProgressionPage() {
  const brackets = await prisma.bracket.findMany({
    where: { isActive: true, tournament: { isActive: true } },
    orderBy: [{ tournament: { startDate: 'desc' } }, { name: 'asc' }],
    include: {
      tournament: { select: { id: true, name: true } },
      _count: {
        select: {
          matches: true,
          // Les inscriptions annulées sont désactivées, pas effacées : sans ce
          // filtre l'effectif resterait figé au maximum atteint.
          registrations: { where: { isActive: true } },
        },
      },
      // Prisma ne sait pas compter des valeurs distinctes dans un `include` :
      // on récupère les numéros de poule et on les déduplique en mémoire.
      matches: { where: { poolNumber: { not: null } }, select: { poolNumber: true } },
    },
  });

  return (
    <div data-testid="progression-page">
      <h1 className="font-heading text-3xl uppercase tracking-wide mb-6">Progression</h1>
      {brackets.length === 0 ? (
        <p className="text-foreground-muted">Aucun tableau actif.</p>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {brackets.map((b) => {
            const poolCount = new Set(b.matches.map((m) => m.poolNumber)).size;
            return (
              <Link
                key={b.id}
                href={`/progression/${b.id}`}
                className="card hover:border-primary transition-colors"
                data-testid={`bracket-card-${b.id}`}
              >
                <h2 className="font-heading text-2xl uppercase tracking-wide">{b.name}</h2>
                <p className="text-foreground-muted text-sm mt-1">{b.category}</p>
                <p className="font-mono text-xs text-foreground-subtle mt-3">
                  {b._count.matches} matches · {b.startTime ?? '—'}
                </p>
                <p className="font-mono text-xs text-foreground-subtle mt-1">
                  {poolCount} poule{poolCount > 1 ? 's' : ''} · {b._count.registrations} joueur
                  {b._count.registrations > 1 ? 's' : ''}
                </p>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
