import Link from 'next/link';
import { prisma } from '@tt/db';

export const dynamic = 'force-dynamic';

async function getActiveTournament() {
  return prisma.tournament.findFirst({
    where: { isActive: true },
    orderBy: { startDate: 'desc' },
    include: {
      brackets: {
        where: { isActive: true },
        orderBy: { startTime: 'asc' },
        include: { _count: { select: { registrations: true } } },
      },
    },
  });
}

export default async function HomePage() {
  const tournament = await getActiveTournament();

  if (!tournament) {
    return (
      <div className="card text-center py-16" data-testid="home-empty">
        <h1 className="font-heading text-3xl uppercase tracking-wide mb-4">
          Aucun tournoi actif
        </h1>
        <p className="text-foreground-muted">
          Reviens plus tard ou consulte la page{' '}
          <Link href="/reglement" className="text-primary underline">
            Règlement
          </Link>
          .
        </p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-12 gap-4" data-testid="home-bento">
      {/* Hero */}
      <section className="col-span-12 lg:col-span-8 card bg-primary text-primary-fg p-8 lg:p-12">
        <p className="text-primary-100 text-sm uppercase tracking-widest mb-2">
          {tournament.date || 'Tournoi'}
        </p>
        <h1
          className="font-heading text-4xl lg:text-6xl uppercase tracking-wide leading-none mb-4"
          data-testid="tournament-name"
        >
          {tournament.name}
        </h1>
        {tournament.location && (
          <p className="text-primary-100 text-lg mb-2">📍 {tournament.location}</p>
        )}
        {tournament.hours && (
          <p className="text-primary-100 text-lg mb-6">🕐 {tournament.hours}</p>
        )}
        {tournament.description && (
          <p className="text-primary-100/90 max-w-2xl">{tournament.description}</p>
        )}
        <div className="mt-8 flex gap-3 flex-wrap">
          <Link
            href="/live"
            className="bg-surface text-primary font-medium px-5 py-3 hover:bg-bg-alt transition-colors"
          >
            Voir le Live →
          </Link>
          <Link
            href="/inscription"
            className="border border-primary-fg text-primary-fg font-medium px-5 py-3 hover:bg-primary-fg/10 transition-colors"
          >
            S'inscrire
          </Link>
        </div>
      </section>

      {/* Compteurs inscrits par tableau */}
      <section className="col-span-12 lg:col-span-4 grid grid-cols-2 gap-4">
        {tournament.brackets.slice(0, 4).map((b) => (
          <div key={b.id} className="card text-center" data-testid={`bracket-counter-${b.id}`}>
            <p className="text-xs uppercase tracking-widest text-foreground-muted mb-1">
              {b.name}
            </p>
            <p className="font-heading text-4xl text-primary tabular">
              {b._count.registrations}
            </p>
            <p className="text-xs text-foreground-subtle mt-1">{b.category}</p>
          </div>
        ))}
        {tournament.brackets.length === 0 && (
          <div className="col-span-2 card text-center text-foreground-muted py-8">
            Aucun tableau
          </div>
        )}
      </section>

      {/* Programme */}
      {Array.isArray(tournament.schedule) && tournament.schedule.length > 0 && (
        <section className="col-span-12 lg:col-span-8 card">
          <h2 className="font-heading text-2xl uppercase tracking-wide mb-4">Programme</h2>
          <ul className="divide-y divide-border" data-testid="schedule">
            {(tournament.schedule as Array<{ title: string; start: string; end: string }>).map(
              (s, i) => (
                <li key={i} className="py-3 flex items-center justify-between">
                  <span className="font-medium">{s.title}</span>
                  <span className="font-mono text-sm text-foreground-muted">
                    {s.start} – {s.end}
                  </span>
                </li>
              ),
            )}
          </ul>
        </section>
      )}

      {/* Contact */}
      <section className="col-span-12 lg:col-span-4 card">
        <h2 className="font-heading text-2xl uppercase tracking-wide mb-4">Contact</h2>
        {tournament.contact ? (
          <p className="text-foreground-muted">{tournament.contact}</p>
        ) : (
          <p className="text-foreground-subtle">Aucun contact renseigné</p>
        )}
        {tournament.assoConnectUrl && (
          <a
            href={tournament.assoConnectUrl}
            className="btn-secondary mt-4 w-full"
            target="_blank"
            rel="noreferrer"
          >
            Inscription en ligne →
          </a>
        )}
      </section>
    </div>
  );
}
