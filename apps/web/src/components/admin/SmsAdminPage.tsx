'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  SmsAdapterFormModal,
  SmsTemplateFormModal,
  SmsTestModal,
  type SmsAdapterForm,
  type SmsTemplateForm,
} from './SmsForms';
import { ConfirmDialog } from '@/components/ui/modal';
import { toast } from '@/components/ui/toast';
import { apiDelete, apiPatch, ApiError } from '@/lib/api-client';

interface Adapter {
  id: string;
  name: string;
  adapterType: 'test' | 'ovh' | 'twilio' | 'free_mobile' | 'smpp';
  config: Record<string, unknown>;
  defaultSender: string;
  isActive: boolean;
}

interface Template {
  id: string;
  name: string;
  content: string;
  isActive: boolean;
}

interface Log {
  id: string;
  recipientPhone: string;
  recipientName: string;
  message: string;
  status: string;
  errorMessage: string;
  kind: string;
  trigger: string;
  createdAt: string | Date;
}

interface Props {
  adapters: Adapter[];
  templates: Template[];
  recentLogs: Log[];
}

export function SmsAdminPage({ adapters, templates, recentLogs }: Props) {
  const router = useRouter();
  const [tab, setTab] = useState<'adapters' | 'templates' | 'logs'>('adapters');
  const [createAdapterOpen, setCreateAdapterOpen] = useState(false);
  const [editAdapter, setEditAdapter] = useState<SmsAdapterForm | null>(null);
  const [confirmDeleteAdapter, setConfirmDeleteAdapter] = useState<Adapter | null>(null);
  const [createTplOpen, setCreateTplOpen] = useState(false);
  const [editTpl, setEditTpl] = useState<SmsTemplateForm | null>(null);
  const [testOpen, setTestOpen] = useState(false);

  const activate = async (a: Adapter) => {
    try {
      await apiPatch(`/api/sms/adapters/${a.id}`, { isActive: true });
      toast.success(`${a.name} activé`);
      router.refresh();
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : 'Erreur');
    }
  };

  const onDeleteAdapter = async () => {
    if (!confirmDeleteAdapter) return;
    try {
      await apiDelete(`/api/sms/adapters/${confirmDeleteAdapter.id}`);
      toast.success('Adaptateur supprimé');
      router.refresh();
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : 'Erreur');
    } finally {
      setConfirmDeleteAdapter(null);
    }
  };

  return (
    <div data-testid="admin-sms">
      <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
        <h1 className="font-heading text-3xl uppercase tracking-wide">SMS</h1>
        <button
          type="button"
          onClick={() => setTestOpen(true)}
          className="btn-secondary text-sm"
          data-testid="sms-test-btn"
        >
          Envoyer un SMS test
        </button>
      </div>

      {/* Onglets */}
      <div className="flex border-b border-border mb-4">
        {[
          { id: 'adapters' as const, label: `Adaptateurs (${adapters.length})` },
          { id: 'templates' as const, label: `Templates (${templates.length})` },
          { id: 'logs' as const, label: `Historique (${recentLogs.length})` },
        ].map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px ${
              tab === t.id
                ? 'border-primary text-primary'
                : 'border-transparent text-foreground-muted hover:text-foreground'
            }`}
            data-testid={`tab-${t.id}`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'adapters' && (
        <section>
          <div className="flex justify-end mb-3">
            <button
              type="button"
              onClick={() => setCreateAdapterOpen(true)}
              className="btn-primary text-sm"
            >
              + Nouvel adaptateur
            </button>
          </div>
          <div className="card overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-xs uppercase tracking-widest text-foreground-muted">
                <tr className="border-b border-border">
                  <th className="text-left py-2">Nom</th>
                  <th className="text-left py-2">Type</th>
                  <th className="text-left py-2">Expéditeur</th>
                  <th className="text-center py-2">Statut</th>
                  <th className="text-right py-2">Actions</th>
                </tr>
              </thead>
              <tbody>
                {adapters.map((a) => (
                  <tr key={a.id} className="border-b border-border" data-testid={`adapter-${a.id}`}>
                    <td className="py-2 font-medium">{a.name}</td>
                    <td className="py-2 font-mono text-xs">{a.adapterType}</td>
                    <td className="py-2 text-foreground-muted">{a.defaultSender || '—'}</td>
                    <td className="py-2 text-center">
                      {a.isActive ? (
                        <span className="text-xs bg-success-soft text-success px-2 py-1">✓ Actif</span>
                      ) : (
                        <button
                          type="button"
                          onClick={() => activate(a)}
                          className="text-xs text-primary hover:underline"
                        >
                          Activer
                        </button>
                      )}
                    </td>
                    <td className="py-2 text-right space-x-2">
                      <button
                        type="button"
                        onClick={() =>
                          setEditAdapter({
                            id: a.id,
                            name: a.name,
                            adapterType: a.adapterType,
                            config: a.config as Record<string, string>,
                            defaultSender: a.defaultSender,
                            isActive: a.isActive,
                          })
                        }
                        className="text-primary text-xs hover:underline"
                      >
                        Éditer
                      </button>
                      <button
                        type="button"
                        onClick={() => setConfirmDeleteAdapter(a)}
                        className="text-danger text-xs hover:underline"
                      >
                        Suppr.
                      </button>
                    </td>
                  </tr>
                ))}
                {adapters.length === 0 && (
                  <tr>
                    <td colSpan={5} className="py-6 text-center text-foreground-muted">
                      Aucun adaptateur. Configure OVH SMS Pro pour activer les notifications.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {tab === 'templates' && (
        <section>
          <div className="flex justify-end mb-3">
            <button
              type="button"
              onClick={() => setCreateTplOpen(true)}
              className="btn-primary text-sm"
            >
              + Nouveau template
            </button>
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
            {templates.map((t) => (
              <div key={t.id} className="card" data-testid={`template-${t.name}`}>
                <div className="flex items-start justify-between mb-2 gap-2">
                  <p className="font-mono text-sm text-primary">{t.name}</p>
                  <button
                    type="button"
                    onClick={() =>
                      setEditTpl({
                        id: t.id,
                        name: t.name,
                        content: t.content,
                        isActive: t.isActive,
                      })
                    }
                    className="text-primary text-xs hover:underline"
                  >
                    Éditer
                  </button>
                </div>
                <p className="text-sm whitespace-pre-wrap">{t.content}</p>
              </div>
            ))}
            {templates.length === 0 && (
              <p className="card col-span-full text-center text-foreground-muted py-6">
                Aucun template SMS.
              </p>
            )}
          </div>
        </section>
      )}

      {tab === 'logs' && (
        <section>
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
                        title={log.errorMessage || undefined}
                      >
                        {log.status}
                      </span>
                    </td>
                  </tr>
                ))}
                {recentLogs.length === 0 && (
                  <tr>
                    <td colSpan={5} className="py-6 text-center text-foreground-muted">
                      Aucun SMS envoyé.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      )}

      <SmsAdapterFormModal open={createAdapterOpen} onClose={() => setCreateAdapterOpen(false)} />
      {editAdapter && (
        <SmsAdapterFormModal
          open={!!editAdapter}
          onClose={() => setEditAdapter(null)}
          initial={editAdapter}
        />
      )}
      <SmsTemplateFormModal open={createTplOpen} onClose={() => setCreateTplOpen(false)} />
      {editTpl && (
        <SmsTemplateFormModal open={!!editTpl} onClose={() => setEditTpl(null)} initial={editTpl} />
      )}
      <SmsTestModal open={testOpen} onClose={() => setTestOpen(false)} />
      <ConfirmDialog
        open={!!confirmDeleteAdapter}
        title="Supprimer l'adaptateur ?"
        message={
          <>
            L'adaptateur <strong>{confirmDeleteAdapter?.name}</strong> sera supprimé.
          </>
        }
        confirmLabel="Supprimer"
        danger
        onConfirm={onDeleteAdapter}
        onCancel={() => setConfirmDeleteAdapter(null)}
      />
    </div>
  );
}
