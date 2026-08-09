import { prisma } from '@tt/db';
import { maskAdapterConfig } from '@tt/sms/secrets';
import { SmsAdminPage } from '@/components/admin/SmsAdminPage';
import { SMS_TRIGGERS, getTriggerStates, triggerSettingKey } from '@/lib/sms/triggers';

export const dynamic = 'force-dynamic';

export default async function AdminSmsRoute() {
  const [adapters, templates, recentLogs, triggerStates] = await Promise.all([
    prisma.smsAdapterConfig.findMany({ orderBy: { createdAt: 'desc' } }),
    prisma.smsTemplate.findMany({ orderBy: { name: 'asc' } }),
    prisma.smsLog.findMany({
      orderBy: { createdAt: 'desc' },
      take: 50,
    }),
    getTriggerStates(),
  ]);

  return (
    <SmsAdminPage
      adapters={adapters.map((a) => ({
        ...a,
        // Les secrets ne doivent pas être sérialisés dans le HTML envoyé au client.
        config: maskAdapterConfig(a.adapterType, a.config as Record<string, unknown>),
      }))}
      templates={templates}
      triggers={SMS_TRIGGERS.map((t) => ({
        key: t.key,
        settingKey: triggerSettingKey(t.key),
        label: t.label,
        description: t.description,
        enabled: triggerStates[t.key],
      }))}
      recentLogs={recentLogs.map((l) => ({
        ...l,
        createdAt: l.createdAt.toISOString(),
      }))}
    />
  );
}
