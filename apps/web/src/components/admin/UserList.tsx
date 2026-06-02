'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Modal, ConfirmDialog } from '@/components/ui/modal';
import { TextField, SelectField, CheckboxField } from '@/components/ui/fields';
import { toast } from '@/components/ui/toast';
import { apiPost, apiPatch, apiDelete, ApiError } from '@/lib/api-client';

type Role = 'admin' | 'juge_arbitre' | 'player';

interface UserAccount {
  id: string;
  username: string;
  email: string | null;
  role: Role;
  isActive: boolean;
  passwordNeedsReset: boolean;
  playerId: string | null;
  player: { firstName: string; lastName: string; licenseNumber: string | null } | null;
  createdAt: string;
}

const ROLE_LABEL: Record<Role, string> = {
  admin: 'Administrateur',
  juge_arbitre: 'Juge-Arbitre',
  player: 'Joueur',
};

const ROLE_BADGE: Record<Role, string> = {
  admin: 'bg-danger-soft text-danger',
  juge_arbitre: 'bg-warning-soft text-warning',
  player: 'bg-primary-soft text-primary',
};

interface UserFormData {
  id?: string;
  username: string;
  email: string;
  password: string;
  role: Role;
  isActive: boolean;
}

interface FormProps {
  open: boolean;
  onClose: () => void;
  initial?: UserFormData;
}

function UserFormModal({ open, onClose, initial }: FormProps) {
  const router = useRouter();
  const isEdit = !!initial?.id;
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState<UserFormData>(
    initial ?? { username: '', email: '', password: '', role: 'admin', isActive: true },
  );

  const update = <K extends keyof UserFormData>(key: K, value: UserFormData[K]) =>
    setForm((f) => ({ ...f, [key]: value }));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      if (isEdit) {
        const payload: Record<string, unknown> = {
          email: form.email,
          role: form.role,
          isActive: form.isActive,
        };
        if (form.password) payload.password = form.password;
        await apiPatch(`/api/users/${initial!.id}`, payload);
        toast.success('Compte mis à jour');
      } else {
        await apiPost('/api/users', form);
        toast.success('Compte créé');
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
    <Modal open={open} onClose={onClose} title={isEdit ? 'Modifier le compte' : 'Nouveau compte'} size="md">
      <form onSubmit={submit} className="space-y-4" data-testid="user-form">
        <TextField
          label="Identifiant"
          required
          value={form.username}
          onChange={(e) => update('username', e.target.value.replace(/[^a-zA-Z0-9_-]/g, ''))}
          placeholder="admin2"
          disabled={isEdit}
          helper={isEdit ? 'Non modifiable' : 'Lettres/chiffres/_/- uniquement, 3+ caractères'}
        />
        <TextField
          label="Email (optionnel)"
          type="email"
          value={form.email}
          onChange={(e) => update('email', e.target.value)}
        />
        <TextField
          label={isEdit ? 'Nouveau mot de passe (vide = inchangé)' : 'Mot de passe'}
          type="password"
          required={!isEdit}
          minLength={6}
          value={form.password}
          onChange={(e) => update('password', e.target.value)}
          helper="6+ caractères. Recommandé : 16+ pour les comptes admin."
        />
        <SelectField
          label="Rôle"
          value={form.role}
          onChange={(e) => update('role', e.target.value as Role)}
          options={[
            { value: 'admin', label: 'Administrateur (accès complet)' },
            { value: 'juge_arbitre', label: 'Juge-Arbitre (saisie de score)' },
            { value: 'player', label: 'Joueur (mon espace + inscriptions)' },
          ]}
        />
        {isEdit && (
          <CheckboxField
            label="Compte actif"
            checked={form.isActive}
            onChange={(e) => update('isActive', e.target.checked)}
            helper="Désactiver pour bloquer la connexion"
          />
        )}
        <div className="flex gap-2 justify-end pt-3 border-t border-border">
          <button type="button" onClick={onClose} className="btn-secondary text-sm">
            Annuler
          </button>
          <button
            type="submit"
            disabled={submitting}
            className="btn-primary text-sm disabled:opacity-50"
            data-testid="submit-user"
          >
            {submitting ? '…' : isEdit ? 'Enregistrer' : 'Créer'}
          </button>
        </div>
      </form>
    </Modal>
  );
}

export function UserList({ users }: { users: UserAccount[] }) {
  const router = useRouter();
  const [createOpen, setCreateOpen] = useState(false);
  const [editing, setEditing] = useState<UserFormData | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<UserAccount | null>(null);
  const [confirmHardDelete, setConfirmHardDelete] = useState<UserAccount | null>(null);

  const onDelete = async () => {
    if (!confirmDelete) return;
    try {
      await apiDelete(`/api/users/${confirmDelete.id}`);
      toast.success('Compte désactivé');
      router.refresh();
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : 'Erreur');
    } finally {
      setConfirmDelete(null);
    }
  };

  const onHardDelete = async () => {
    if (!confirmHardDelete) return;
    try {
      await apiDelete(`/api/users/${confirmHardDelete.id}?hard=true`);
      toast.success('Compte supprimé définitivement');
      router.refresh();
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : 'Erreur');
    } finally {
      setConfirmHardDelete(null);
    }
  };

  return (
    <>
      <div className="flex items-center justify-between mb-6">
        <h1 className="font-heading text-3xl uppercase tracking-wide">Comptes utilisateurs</h1>
        <button
          type="button"
          onClick={() => setCreateOpen(true)}
          className="btn-primary text-sm"
          data-testid="new-user"
        >
          + Nouveau compte
        </button>
      </div>

      <div className="card overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="text-xs uppercase tracking-widest text-foreground-muted">
            <tr className="border-b border-border">
              <th className="text-left py-2">Identifiant</th>
              <th className="text-left py-2">Email</th>
              <th className="text-left py-2">Rôle</th>
              <th className="text-left py-2">Lié à</th>
              <th className="text-center py-2">Statut</th>
              <th className="text-right py-2">Actions</th>
            </tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.id} className="border-b border-border hover:bg-bg-alt">
                <td className="py-2 font-medium font-mono">{u.username}</td>
                <td className="py-2 text-foreground-muted">{u.email ?? '—'}</td>
                <td className="py-2">
                  <span className={`text-xs px-2 py-0.5 ${ROLE_BADGE[u.role]}`}>
                    {ROLE_LABEL[u.role]}
                  </span>
                </td>
                <td className="py-2 text-xs text-foreground-muted">
                  {u.player
                    ? `${u.player.lastName} ${u.player.firstName}${u.player.licenseNumber ? ' · ' + u.player.licenseNumber : ''}`
                    : '—'}
                </td>
                <td className="py-2 text-center">
                  {u.isActive ? (
                    <span className="text-xs bg-success-soft text-success px-2 py-1">Actif</span>
                  ) : (
                    <span className="text-xs bg-bg-alt text-foreground-subtle px-2 py-1">Désactivé</span>
                  )}
                  {u.passwordNeedsReset && (
                    <span className="block text-xs text-warning mt-1">⚠ reset requis</span>
                  )}
                </td>
                <td className="py-2 text-right space-x-2 whitespace-nowrap">
                  <button
                    type="button"
                    onClick={() =>
                      setEditing({
                        id: u.id,
                        username: u.username,
                        email: u.email ?? '',
                        password: '',
                        role: u.role,
                        isActive: u.isActive,
                      })
                    }
                    className="text-primary text-xs hover:underline"
                  >
                    Éditer
                  </button>
                  {u.isActive && u.username !== 'admin' && (
                    <button
                      type="button"
                      onClick={() => setConfirmDelete(u)}
                      className="text-warning text-xs hover:underline"
                      title="Désactivation"
                    >
                      Désact.
                    </button>
                  )}
                  {u.username !== 'admin' && (
                    <button
                      type="button"
                      onClick={() => setConfirmHardDelete(u)}
                      className="text-danger text-xs hover:underline"
                      title="Suppression définitive"
                    >
                      🗑 Suppr.
                    </button>
                  )}
                </td>
              </tr>
            ))}
            {users.length === 0 && (
              <tr>
                <td colSpan={6} className="py-6 text-center text-foreground-muted">
                  Aucun compte.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <UserFormModal open={createOpen} onClose={() => setCreateOpen(false)} />
      {editing && (
        <UserFormModal open={!!editing} onClose={() => setEditing(null)} initial={editing} />
      )}
      <ConfirmDialog
        open={!!confirmDelete}
        title="Désactiver ce compte ?"
        message={
          <>
            Le compte <strong>{confirmDelete?.username}</strong> ne pourra plus se connecter.
            Réactivable plus tard.
          </>
        }
        confirmLabel="Désactiver"
        danger
        onConfirm={onDelete}
        onCancel={() => setConfirmDelete(null)}
      />
      <ConfirmDialog
        open={!!confirmHardDelete}
        title="⚠ Supprimer DÉFINITIVEMENT le compte ?"
        message={
          <>
            <p>
              Le compte <strong>{confirmHardDelete?.username}</strong> et toutes ses sessions
              seront <strong className="text-danger">supprimés de la base</strong>.
            </p>
            <p className="mt-2 text-danger">Cette action est IRRÉVERSIBLE.</p>
          </>
        }
        confirmLabel="Supprimer définitivement"
        danger
        onConfirm={onHardDelete}
        onCancel={() => setConfirmHardDelete(null)}
      />
    </>
  );
}
