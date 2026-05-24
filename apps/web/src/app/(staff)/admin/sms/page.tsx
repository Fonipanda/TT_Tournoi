import { prisma } from '@tt/db';
import { listAdapterTypes } from '@tt/sms/registry';

export const dynamic = 'force-dynamic';

export default async function AdminSmsPage() {
  const [adapters, templates, recentLogs, queueStats] = await Promise.all([
    prisma.smsAdapterConfig.findMany({ orderBy: { createdAt: 'desc' } }),
    prisma.smsTemplate.findMany({ orderBy: { name: 'asc' } }),
    prisma.smsLog.findMany({
      orderBy: { createdAt: 'desc' },
      take: 50,
      include: { player: true },
    }),
    Promise.resolve(null), // queue stats nécessitent runtime BullMQ
  ]);

  void queueStats;

  return (
    <div data-testid="admin-sms">
      <h1 className="font-heading text-3xl uppercase tracking-wide mb-6">SMS</h1>

      <section className="mb-8">
        <h2 className="font-heading text-xl uppercase tracking-wide mb-3">
          Adaptateurs ({adapters.length})
        </h2>
        <p className="text-sm text-foreground-muted mb-3">
          Types disponibles : {listAdapterTypes().join(', ')}. Un seul peut être actif à la fois
          (garanti par trigger SQL).
        </p>
        <div className="card overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-xs uppercase tracking-widest text-foreground-muted">
              <tr className="border-b border-border">
                <th className="text-left py-2">Nom</th>
                <th className="text-left py-2">Type</th>
                <th className="text-left py-2">Expéditeur</th>
                <th className="text-center py-2">Actif</th>
              </tr>
            </thead>
            <tbody>
              {adapters.map((a) => (
                <tr
                  key={a.id}
                  className="border-b border-border"
                  data-testid={`adapter-${a.id}`}
                >
                  <td className="py-2 font-medium">{a.name}</td>
                  <td className="py-2 font-mono">{a.adapterType}</td>
                  <td className="py-2 text-foreground-muted">{a.defaultSender || '—'}</td>
                  <td className="py-2 text-center">
                    {a.isActive ? (
                      <span className="text-xs bg-success-soft text-success px-2 py-1">
                        ✓ Actif
                      </span>
                    ) : (
                      <span className="text-xs text-foreground-subtle">—</span>
                    )}
                  </td>
                </tr>
              ))}
              {adapters.length === 0 && (
                <tr>
                  <td colSpan={4} className="py-4 text-center text-foreground-muted">
                    Aucun adaptateur configuré.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section className="mb-8">
        <h2 className="font-heading text-xl uppercase tracking-wide mb-3">
          Templates ({templates.length})
        </h2>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
          {templates.map((t) => (
            <div key={t.id} className="card" data-testid={`template-${t.name}`}>
              <p className="font-mono text-sm text-primary">{t.name}</p>
              <p className="mt-1 text-sm whitespace-pre-wrap">{t.content}</p>
            </div>
          ))}
        </div>
      </section>

      <section>
        <h2 className="font-heading text-xl uppercase tracking-wide mb-3">
          Historique récent
        </h2>
        <div className="card overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-xs uppercase tracking-widest text-foreground-muted">
              <tr className="border-b border-border">
                <th className="text-left py-2">Date</th>
                <th className="text-left py-2">Destinataire</th>
                <th className="text-left py-2">Trigger</th>
                <th className="text-left py-2">Message</th>
                <th className="text-center py-2">Statut</th>
              </tr>
            </thead>
            <tbody>
              {recentLogs.map((log) => (
                <tr key={log.id} className="border-b border-border">
                  <td className="py-2 text-xs font-mono text-foreground-muted whitespace-nowrap">
                    {new Date(log.createdAt).toLocaleString('fr-FR')}
                  </td>
                  <td className="py-2 text-xs font-mono">{log.recipientPhone}</td>
                  <td className="py-2 text-xs text-foreground-muted">
                    {log.kind === 'auto' ? log.trigger : 'manuel'}
                  </td>
                  <td className="py-2 text-xs truncate max-w-md">{log.message}</td>
                  <td className="py-2 text-center">
                    <span
                      className={`text-xs px-2 py-0.5 ${
                        log.status === 'sent'
                          ? 'bg-success-soft text-success'
                          : log.status === 'failed'
                            ? 'bg-danger-soft text-danger'
                            : 'bg-warning-soft text-warning'
                      }`}
                    >
                      {log.status}
                    </span>
                  </td>
                </tr>
              ))}
              {recentLogs.length === 0 && (
                <tr>
                  <td colSpan={5} className="py-4 text-center text-foreground-muted">
                    Aucun SMS envoyé.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
