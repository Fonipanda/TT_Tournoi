import { prisma } from '@tt/db';

export const dynamic = 'force-dynamic';

export default async function BuvettePage() {
  const tournament = await prisma.tournament.findFirst({
    where: { isActive: true },
    orderBy: { startDate: 'desc' },
  });
  if (!tournament) {
    return <p className="text-foreground-muted">Aucun tournoi actif.</p>;
  }
  const sections = await prisma.menuSection.findMany({
    where: { tournamentId: tournament.id },
    orderBy: { order: 'asc' },
    include: {
      items: { where: { isAvailable: true }, orderBy: { order: 'asc' } },
    },
  });

  return (
    <div data-testid="buvette-page">
      <h1 className="font-heading text-3xl uppercase tracking-wide mb-6">Buvette</h1>
      {sections.length === 0 ? (
        <p className="text-foreground-muted">Menu non encore configuré.</p>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {sections.map((s) => (
            <section key={s.id} className="card" data-testid={`menu-section-${s.id}`}>
              <h2 className="font-heading text-2xl uppercase tracking-wide mb-3 text-primary">
                {s.name}
              </h2>
              <ul className="divide-y divide-border">
                {s.items.map((it) => (
                  <li key={it.id} className="py-2 flex items-center justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <p className="font-medium">{it.name}</p>
                      {it.description && (
                        <p className="text-sm text-foreground-muted truncate">
                          {it.description}
                        </p>
                      )}
                    </div>
                    <span className="font-mono tabular text-primary font-semibold whitespace-nowrap">
                      {Number(it.price).toFixed(2)} €
                    </span>
                  </li>
                ))}
                {s.items.length === 0 && (
                  <li className="py-2 text-foreground-subtle text-sm">Aucun article</li>
                )}
              </ul>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
