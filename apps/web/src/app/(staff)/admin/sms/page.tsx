import { prisma } from '@tt/db';
import { SmsAdminPage } from '@/components/admin/SmsAdminPage';

export const dynamic = 'force-dynamic';

export default async function AdminSmsRoute() {
  const [adapters, templates, recentLogs] = await Promise.all([
    prisma.smsAdapterConfig.findMany({ orderBy: { createdAt: 'desc' } }),
    prisma.smsTemplate.findMany({ orderBy: { name: 'asc' } }),
    prisma.smsLog.findMany({
      orderBy: { createdAt: 'desc' },
      take: 50,
    }),
  ]);

  return (
    <SmsAdminPage
      adapters={adapters.map((a) => ({
        ...a,
        config: a.config as Record<string, unknown>,
      }))}
      templates={templates}
      recentLogs={recentLogs.map((l) => ({
        ...l,
        createdAt: l.createdAt.toISOString(),
      }))}
    />
  );
}
