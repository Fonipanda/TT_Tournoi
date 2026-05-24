import { prisma } from '@tt/db';
import Link from 'next/link';

export const dynamic = 'force-dynamic';

export default async function ProgressionPage() {
  const brackets = await prisma.bracket.findMany({
    where: { isActive: true, tournament: { isActive: true } },
    orderBy: [{ tournament: { startDate: 'desc' } }, { startTime: 'asc' }],
    include: {
      tournament: { select: { id: true, name: true } },
      _count: { select: { matches: true } },
    },
  });

  return (
    <div data-testid="progression-page">
      <h1 className="font-heading text-3xl uppercase tracking-wide mb-6">Progression</h1>
      {brackets.length === 0 ? (
        <p className="text-foreground-muted">Aucun tableau actif.</p>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {brackets.map((b) => (
            <Link
              key={b.id}
              href={`/progression/${b.id}`}
              className="card hover:border-primary transition-colors"
              data-testid={`bracket-card-${b.id}`}
            >
              <p className="text-xs uppercase tracking-widest text-foreground-muted">
                {b.tournament.name}
              </p>
              <h2 className="font-heading text-2xl uppercase tracking-wide mt-1">{b.name}</h2>
              <p className="text-foreground-muted text-sm mt-1">{b.category}</p>
              <p className="font-mono text-xs text-foreground-subtle mt-3">
                {b._count.matches} matches · {b.startTime ?? '—'}
              </p>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
