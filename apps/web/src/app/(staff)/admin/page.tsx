import { prisma } from '@tt/db';
import Link from 'next/link';

export const dynamic = 'force-dynamic';

export default async function AdminDashboardPage() {
  const [tournaments, brackets, players, matchesInProgress, smsSent24h, activeAdapter] =
    await Promise.all([
      prisma.tournament.count(),
      prisma.bracket.findMany({
        where: { isActive: true, tournament: { isActive: true } },
        include: {
          _count: { select: { registrations: { where: { isActive: true } } } },
          tournament: { select: { name: true } },
        },
        orderBy: { name: 'asc' },
      }),
      prisma.player.count({ where: { isActive: true } }),
      prisma.match.count({ where: { status: 'in_progress' } }),
      prisma.smsLog.count({
        where: {
          status: 'sent',
          createdAt: { gte: new Date(Date.now() - 86400_000) },
        },
      }),
      prisma.smsAdapterConfig.findFirst({ where: { isActive: true } }),
    ]);

  // Stats globales tournoi actif
  const totalInscrits = brackets.reduce((sum, b) => sum + b._count.registrations, 0);
  const totalPlaces = brackets.reduce((sum, b) => sum + b.maxPlayers, 0);
  const tauxGlobal = totalPlaces > 0 ? Math.round((totalInscrits / totalPlaces) * 100) : 0;

  // Sérialiser les Decimal éventuels
  const bracketsView = brackets.map((b) => ({
    id: b.id,
    name: b.name,
    category: b.category,
    maxPlayers: b.maxPlayers,
    inscrits: b._count.registrations,
  }));

  const stats = [
    { label: 'Tournois', value: tournaments, href: '/admin/tournois' },
    { label: 'Tableaux actifs', value: brackets.length, href: '/admin/tableaux' },
    { label: 'Joueurs', value: players, href: '/admin/joueurs' },
    { label: 'Matches en cours', value: matchesInProgress, href: '/juge-arbitre' },
    { label: 'SMS envoyés (24h)', value: smsSent24h, href: '/admin/sms' },
  ];

  return (
    <div data-testid="admin-dashboard">
      <h1 className="font-heading text-3xl uppercase tracking-wide mb-6">Tableau de bord</h1>

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3 mb-6">
        {stats.map((s) => (
          <Link
            key={s.label}
            href={s.href}
            className="card rounded-xl hover:border-primary text-center transition-all hover:shadow-md"
            data-testid={`stat-${s.label.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`}
          >
            <p className="font-heading text-4xl tabular text-primary">{s.value}</p>
            <p className="text-xs uppercase tracking-widest text-foreground-muted mt-1">
              {s.label}
            </p>
          </Link>
        ))}
      </div>

      {/* Taux de remplissage global + par tableau */}
      <section className="mb-6">
        <div className="card rounded-2xl bg-gradient-to-br from-primary-soft to-accent-soft border-primary mb-3">
          <div className="flex items-end justify-between mb-2">
            <div>
              <p className="text-xs uppercase tracking-widest text-foreground-muted">
                📊 Taux de remplissage global
              </p>
              <p className="font-heading text-4xl text-primary tabular leading-none mt-1">
                {totalInscrits}
                <span className="text-2xl text-foreground-muted">/{totalPlaces}</span>
                <span className="text-2xl ml-3">{tauxGlobal}%</span>
              </p>
            </div>
          </div>
          <div className="h-3 bg-surface rounded-full overflow-hidden">
            <div
              className={`h-full transition-all ${
                tauxGlobal >= 100 ? 'bg-danger' : tauxGlobal > 75 ? 'bg-warning' : 'bg-primary'
              }`}
              style={{ width: `${Math.min(tauxGlobal, 100)}%` }}
            />
          </div>
        </div>

        <h2 className="font-heading text-xl uppercase tracking-wide mb-2">
          Détail par tableau
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {bracketsView.map((b) => {
            const inscrits = b.inscrits;
            const taux = b.maxPlayers > 0 ? Math.round((inscrits / b.maxPlayers) * 100) : 0;
            const full = inscrits >= b.maxPlayers;
            return (
              <Link
                key={b.id}
                href={`/admin/tableaux/${b.id}`}
                className="card rounded-xl hover:shadow-md transition-shadow"
              >
                <div className="flex items-start justify-between mb-2">
                  <div>
                    <p className="font-heading text-lg uppercase tracking-wide">{b.name}</p>
                    <p className="text-xs text-foreground-muted">{b.category}</p>
                  </div>
                  <span
                    className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                      full
                        ? 'bg-danger-soft text-danger'
                        : taux > 75
                          ? 'bg-warning-soft text-warning'
                          : 'bg-success-soft text-success'
                    }`}
                  >
                    {taux}%
                  </span>
                </div>
                <p className="text-sm tabular">
                  <span className="font-semibold text-primary">{inscrits}</span>
                  <span className="text-foreground-muted"> / {b.maxPlayers} places</span>
                </p>
                <div className="mt-2 h-1.5 bg-bg-alt rounded-full overflow-hidden">
                  <div
                    className={`h-full transition-all ${
                      full ? 'bg-danger' : taux > 75 ? 'bg-warning' : 'bg-success'
                    }`}
                    style={{ width: `${Math.min(taux, 100)}%` }}
                  />
                </div>
              </Link>
            );
          })}
          {bracketsView.length === 0 && (
            <p className="col-span-full card text-center text-foreground-muted py-6">
              Aucun tableau actif.
            </p>
          )}
        </div>
      </section>

      {!activeAdapter && (
        <div
          className="card rounded-xl border-warning bg-warning-soft text-warning"
          data-testid="warning-no-sms"
        >
          ⚠ Aucun adaptateur SMS actif. Va dans <strong>SMS</strong> pour activer OVH.
        </div>
      )}

      {activeAdapter && (
        <div className="card rounded-xl border-success bg-success-soft text-success">
          ✓ SMS actif : <strong>{activeAdapter.name}</strong> ({activeAdapter.adapterType})
        </div>
      )}
    </div>
  );
}
