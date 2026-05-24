import { prisma } from '@tt/db';
import Link from 'next/link';

export const dynamic = 'force-dynamic';

export default async function AdminDashboardPage() {
  const [tournaments, brackets, players, matchesInProgress, smsSent24h, activeAdapter] =
    await Promise.all([
      prisma.tournament.count(),
      prisma.bracket.count({ where: { isActive: true } }),
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

  const stats = [
    { label: 'Tournois', value: tournaments, href: '/admin/tournois' },
    { label: 'Tableaux actifs', value: brackets, href: '/admin/tableaux' },
    { label: 'Joueurs', value: players, href: '/admin/joueurs' },
    { label: 'Matches en cours', value: matchesInProgress, href: '/live' },
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
            className="card hover:border-primary text-center"
            data-testid={`stat-${s.label.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`}
          >
            <p className="font-heading text-4xl tabular text-primary">{s.value}</p>
            <p className="text-xs uppercase tracking-widest text-foreground-muted mt-1">
              {s.label}
            </p>
          </Link>
        ))}
      </div>

      {!activeAdapter && (
        <div
          className="card border-warning bg-warning-soft text-warning"
          data-testid="warning-no-sms"
        >
          ⚠ Aucun adaptateur SMS actif. Va dans <strong>SMS</strong> pour activer OVH.
        </div>
      )}

      {activeAdapter && (
        <div className="card border-success bg-success-soft text-success">
          ✓ SMS actif : <strong>{activeAdapter.name}</strong> ({activeAdapter.adapterType})
        </div>
      )}
    </div>
  );
}
