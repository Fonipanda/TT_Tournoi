'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Modal } from '@/components/ui/modal';
import { TextField, SelectField, CheckboxField } from '@/components/ui/fields';
import { toast } from '@/components/ui/toast';
import { apiPatch, apiPost, ApiError } from '@/lib/api-client';

type AdapterType = 'test' | 'ovh' | 'twilio' | 'free_mobile' | 'smpp';

export interface SmsAdapterForm {
  id?: string;
  name: string;
  adapterType: AdapterType;
  config: Record<string, string>;
  defaultSender: string;
  isActive: boolean;
}

interface FieldDef {
  name: string;
  label: string;
  type: 'text' | 'password';
  placeholder?: string;
  helper?: string;
}

// Définitions des champs par type d'adaptateur (mirroir du backend)
const FIELDS_BY_TYPE: Record<AdapterType, FieldDef[]> = {
  ovh: [
    { name: 'appKey', label: 'Application Key', type: 'text', helper: 'https://api.ovh.com/createToken' },
    { name: 'appSecret', label: 'Application Secret', type: 'password' },
    { name: 'consumerKey', label: 'Consumer Key', type: 'password' },
    { name: 'serviceName', label: 'Service Name', type: 'text', placeholder: 'sms-xxxxx-1' },
    { name: 'senderName', label: 'Expéditeur (optionnel)', type: 'text', placeholder: 'ChellesTT', helper: '11 chars max alphanumériques, validé chez OVH' },
  ],
  twilio: [
    { name: 'accountSid', label: 'Account SID', type: 'text' },
    { name: 'authToken', label: 'Auth Token', type: 'password' },
    { name: 'fromNumber', label: 'Numéro Twilio', type: 'text', placeholder: '+33756123456' },
  ],
  free_mobile: [
    { name: 'user', label: 'Identifiant Free', type: 'text' },
    { name: 'pass', label: 'Clé d\'API SMS', type: 'password' },
  ],
  smpp: [
    { name: 'host', label: 'Hôte SMPP', type: 'text' },
    { name: 'port', label: 'Port', type: 'text', placeholder: '2775' },
    { name: 'systemId', label: 'System ID', type: 'text' },
    { name: 'password', label: 'Password', type: 'password' },
  ],
  test: [],
};

interface Props {
  open: boolean;
  onClose: () => void;
  initial?: SmsAdapterForm;
}

export function SmsAdapterFormModal({ open, onClose, initial }: Props) {
  const router = useRouter();
  const isEdit = !!initial?.id;
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState<SmsAdapterForm>(
    initial ?? {
      name: '',
      adapterType: 'ovh',
      config: {},
      defaultSender: 'ChellesTT',
      isActive: false,
    },
  );

  const fields = FIELDS_BY_TYPE[form.adapterType];

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      if (isEdit) {
        await apiPatch(`/api/sms/adapters/${initial!.id}`, form);
        toast.success('Adaptateur mis à jour');
      } else {
        await apiPost('/api/sms/adapters', form);
        toast.success('Adaptateur créé');
      }
      router.refresh();
      onClose();
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : 'Erreur');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={isEdit ? "Modifier l'adaptateur SMS" : 'Nouvel adaptateur SMS'}
      size="lg"
    >
      <form onSubmit={submit} className="space-y-4" data-testid="sms-adapter-form">
        <div className="grid grid-cols-2 gap-3">
          <TextField
            label="Nom"
            required
            value={form.name}
            onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
            placeholder="OVH SMS Pro Production"
          />
          <SelectField
            label="Type"
            value={form.adapterType}
            onChange={(e) =>
              setForm((f) => ({ ...f, adapterType: e.target.value as AdapterType, config: {} }))
            }
            options={[
              { value: 'ovh', label: 'OVH SMS Pro (recommandé France)' },
              { value: 'twilio', label: 'Twilio (international)' },
              { value: 'free_mobile', label: 'Free Mobile (gratuit, 1 destinataire)' },
              { value: 'smpp', label: 'SMPP (non implémenté)' },
              { value: 'test', label: 'Test (logger console)' },
            ]}
            disabled={isEdit}
          />
        </div>

        {fields.length > 0 && (
          <fieldset className="border border-border p-3">
            <legend className="text-sm font-medium px-2">
              Configuration {form.adapterType.toUpperCase()}
            </legend>
            <div className="space-y-3 mt-2">
              {fields.map((f) => (
                <TextField
                  key={f.name}
                  label={f.label}
                  type={f.type}
                  value={form.config[f.name] ?? ''}
                  onChange={(e) =>
                    setForm((prev) => ({
                      ...prev,
                      config: { ...prev.config, [f.name]: e.target.value },
                    }))
                  }
                  placeholder={f.placeholder}
                  helper={f.helper}
                  autoComplete="off"
                />
              ))}
            </div>
          </fieldset>
        )}

        <TextField
          label="Expéditeur par défaut"
          value={form.defaultSender}
          onChange={(e) => setForm((f) => ({ ...f, defaultSender: e.target.value }))}
          placeholder="ChellesTT"
          helper="Sera utilisé si l'expéditeur n'est pas fourni à l'envoi"
        />

        <CheckboxField
          label="Activer cet adaptateur"
          helper="Trigger SQL : un seul adaptateur peut être actif à la fois"
          checked={form.isActive}
          onChange={(e) => setForm((f) => ({ ...f, isActive: e.target.checked }))}
        />

        <div className="flex gap-2 justify-end pt-3 border-t border-border">
          <button type="button" onClick={onClose} className="btn-secondary text-sm">
            Annuler
          </button>
          <button
            type="submit"
            disabled={submitting}
            className="btn-primary text-sm disabled:opacity-50"
          >
            {submitting ? '…' : isEdit ? 'Enregistrer' : 'Créer'}
          </button>
        </div>
      </form>
    </Modal>
  );
}

// =============================================================================
// SMS Template Form
// =============================================================================

export interface SmsTemplateForm {
  id?: string;
  name: string;
  content: string;
  isActive: boolean;
}

const TEMPLATE_VARIABLES = [
  { name: 'joueur', label: 'Nom du joueur', example: 'DUPONT Martin' },
  { name: 'table', label: 'Numéro de table', example: '5' },
  { name: 'tableau', label: 'Nom du tableau', example: 'Tableau A' },
  { name: 'adversaire', label: "Nom de l'adversaire", example: 'MARTIN Paul' },
  { name: 'heure', label: 'Heure', example: '14:30' },
  { name: 'salle', label: 'Salle', example: 'Salle Principale' },
];

export function SmsTemplateFormModal({
  open,
  onClose,
  initial,
}: {
  open: boolean;
  onClose: () => void;
  initial?: SmsTemplateForm;
}) {
  const router = useRouter();
  const isEdit = !!initial?.id;
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState<SmsTemplateForm>(
    initial ?? { name: '', content: '', isActive: true },
  );

  const segments = (() => {
    const len = form.content.length;
    return len <= 160 ? 1 : Math.ceil(len / 153);
  })();

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      if (isEdit) {
        await apiPatch(`/api/sms/templates/${initial!.id}`, form);
        toast.success('Template mis à jour');
      } else {
        await apiPost('/api/sms/templates', form);
        toast.success('Template créé');
      }
      router.refresh();
      onClose();
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : 'Erreur');
    } finally {
      setSubmitting(false);
    }
  };

  const insert = (varName: string) => {
    const insertText = `{${varName}}`;
    setForm((f) => ({ ...f, content: f.content + insertText }));
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={isEdit ? 'Modifier le template' : 'Nouveau template SMS'}
      size="lg"
    >
      <form onSubmit={submit} className="space-y-4" data-testid="sms-template-form">
        <TextField
          label="Nom interne (clé)"
          required
          value={form.name}
          onChange={(e) =>
            setForm((f) => ({ ...f, name: e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, '_') }))
          }
          placeholder="table_assigned"
          helper="Snake_case, utilisé pour identifier le template depuis le code"
          disabled={isEdit}
        />
        <div>
          <label className="text-sm font-medium block mb-1">Variables disponibles</label>
          <div className="flex gap-2 flex-wrap mb-2">
            {TEMPLATE_VARIABLES.map((v) => (
              <button
                key={v.name}
                type="button"
                onClick={() => insert(v.name)}
                className="text-xs bg-bg-alt border border-border px-2 py-1 hover:bg-primary-soft hover:border-primary"
                title={`${v.label} — ex: ${v.example}`}
              >
                {`{${v.name}}`}
              </button>
            ))}
          </div>
          <textarea
            value={form.content}
            onChange={(e) => setForm((f) => ({ ...f, content: e.target.value }))}
            className="input min-h-[120px]"
            required
            placeholder="Bonjour {joueur}, votre prochain match est sur la table {table}…"
          />
          <p className="text-xs text-foreground-muted mt-1">
            {form.content.length} caractères · {segments} SMS
          </p>
        </div>
        <CheckboxField
          label="Template actif"
          checked={form.isActive}
          onChange={(e) => setForm((f) => ({ ...f, isActive: e.target.checked }))}
        />
        <div className="flex gap-2 justify-end pt-3 border-t border-border">
          <button type="button" onClick={onClose} className="btn-secondary text-sm">
            Annuler
          </button>
          <button
            type="submit"
            disabled={submitting}
            className="btn-primary text-sm disabled:opacity-50"
          >
            {submitting ? '…' : isEdit ? 'Enregistrer' : 'Créer'}
          </button>
        </div>
      </form>
    </Modal>
  );
}

// =============================================================================
// SMS Test Send
// =============================================================================

export function SmsTestModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [to, setTo] = useState('');
  const [message, setMessage] = useState('Test TT Tournoi · ' + new Date().toLocaleTimeString('fr-FR'));
  const [submitting, setSubmitting] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const res = await apiPost<{ ok: boolean; log: { errorMessage?: string } }>('/api/sms/test', {
        to,
        message,
      });
      if (res.ok) toast.success('SMS envoyé !');
      else toast.error(res.log.errorMessage ?? 'Échec envoi');
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : 'Erreur');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal open={open} onClose={onClose} title="Test d'envoi SMS" size="md">
      <form onSubmit={submit} className="space-y-4" data-testid="sms-test-form">
        <TextField
          label="Numéro destinataire"
          type="tel"
          required
          value={to}
          onChange={(e) => setTo(e.target.value)}
          placeholder="+33612345678"
          helper="Format international (+33...). L'adaptateur actif sera utilisé."
        />
        <TextField
          label="Message"
          required
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          maxLength={160}
        />
        <div className="flex gap-2 justify-end pt-3 border-t border-border">
          <button type="button" onClick={onClose} className="btn-secondary text-sm">
            Fermer
          </button>
          <button
            type="submit"
            disabled={submitting || !to}
            className="btn-primary text-sm disabled:opacity-50"
          >
            {submitting ? '…' : 'Envoyer'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
