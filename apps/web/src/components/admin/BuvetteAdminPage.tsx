'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Modal, ConfirmDialog } from '@/components/ui/modal';
import { TextField, NumberField, TextAreaField, CheckboxField } from '@/components/ui/fields';
import { toast } from '@/components/ui/toast';
import { apiPost, apiPatch, apiDelete, ApiError } from '@/lib/api-client';

interface MenuItem {
  id: string;
  name: string;
  description: string | null;
  price: string | number;
  imageUrl: string | null;
  isAvailable: boolean;
  order: number;
}

interface MenuSection {
  id: string;
  name: string;
  order: number;
  items: MenuItem[];
}

interface Tournament {
  id: string;
  name: string;
}

interface Props {
  tournaments: Tournament[];
  selectedTournamentId: string;
  sections: MenuSection[];
}

// =============================================================================
// Section form
// =============================================================================

interface SectionFormData {
  id?: string;
  tournamentId: string;
  name: string;
  order: number;
}

function SectionFormModal({
  open,
  onClose,
  initial,
}: {
  open: boolean;
  onClose: () => void;
  initial: SectionFormData;
}) {
  const router = useRouter();
  const isEdit = !!initial.id;
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState(initial);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      if (isEdit) {
        await apiPatch(`/api/menu/sections/${initial.id}`, {
          name: form.name,
          order: form.order,
        });
        toast.success('Section mise à jour');
      } else {
        await apiPost('/api/menu/sections', form);
        toast.success('Section créée');
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
    <Modal open={open} onClose={onClose} title={isEdit ? 'Modifier la section' : 'Nouvelle section'} size="sm">
      <form onSubmit={submit} className="space-y-4" data-testid="section-form">
        <TextField
          label="Nom"
          required
          value={form.name}
          onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
          placeholder="Boissons / Restauration / Sucré"
        />
        <NumberField
          label="Ordre d'affichage"
          value={form.order}
          onChange={(e) => setForm((f) => ({ ...f, order: Number(e.target.value) }))}
          min={0}
          step={1}
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
// Item form
// =============================================================================

interface ItemFormData {
  id?: string;
  sectionId: string;
  name: string;
  description?: string;
  price: number;
  imageUrl?: string;
  isAvailable: boolean;
  order: number;
}

function ItemFormModal({
  open,
  onClose,
  initial,
}: {
  open: boolean;
  onClose: () => void;
  initial: ItemFormData;
}) {
  const router = useRouter();
  const isEdit = !!initial.id;
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState(initial);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      if (isEdit) {
        await apiPatch(`/api/menu/items/${initial.id}`, form);
        toast.success('Article mis à jour');
      } else {
        await apiPost('/api/menu/items', form);
        toast.success('Article créé');
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
    <Modal open={open} onClose={onClose} title={isEdit ? "Modifier l'article" : 'Nouvel article'} size="md">
      <form onSubmit={submit} className="space-y-4" data-testid="item-form">
        <TextField
          label="Nom"
          required
          value={form.name}
          onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
          placeholder="Sandwich jambon-beurre"
        />
        <TextAreaField
          label="Description"
          value={form.description ?? ''}
          onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
          placeholder="Baguette tradition, jambon de Paris, beurre AOP"
        />
        <div className="grid grid-cols-2 gap-3">
          <NumberField
            label="Prix (€)"
            required
            value={form.price}
            onChange={(e) => setForm((f) => ({ ...f, price: Number(e.target.value) }))}
            min={0}
            step={0.5}
          />
          <NumberField
            label="Ordre"
            value={form.order}
            onChange={(e) => setForm((f) => ({ ...f, order: Number(e.target.value) }))}
            min={0}
          />
        </div>
        <TextField
          label="Chemin de l'image (optionnel)"
          value={form.imageUrl ?? ''}
          onChange={(e) => setForm((f) => ({ ...f, imageUrl: e.target.value }))}
          placeholder="/images/sandwich.jpg ou https://..."
          helper="Formats acceptés : PNG, JPEG, WEBP, SVG"
        />
        <CheckboxField
          label="Disponible (visible par les visiteurs)"
          checked={form.isAvailable}
          onChange={(e) => setForm((f) => ({ ...f, isAvailable: e.target.checked }))}
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
// Main page
// =============================================================================

export function BuvetteAdminPage({ tournaments, selectedTournamentId, sections }: Props) {
  const router = useRouter();
  const [createSecOpen, setCreateSecOpen] = useState(false);
  const [editSec, setEditSec] = useState<SectionFormData | null>(null);
  const [confirmDelSec, setConfirmDelSec] = useState<MenuSection | null>(null);
  const [createItemFor, setCreateItemFor] = useState<string | null>(null);
  const [editItem, setEditItem] = useState<ItemFormData | null>(null);
  const [confirmDelItem, setConfirmDelItem] = useState<MenuItem | null>(null);

  const onDelSec = async () => {
    if (!confirmDelSec) return;
    try {
      await apiDelete(`/api/menu/sections/${confirmDelSec.id}`);
      toast.success('Section supprimée');
      router.refresh();
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : 'Erreur');
    } finally {
      setConfirmDelSec(null);
    }
  };

  const onDelItem = async () => {
    if (!confirmDelItem) return;
    try {
      await apiDelete(`/api/menu/items/${confirmDelItem.id}`);
      toast.success('Article supprimé');
      router.refresh();
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : 'Erreur');
    } finally {
      setConfirmDelItem(null);
    }
  };

  const toggleAvailable = async (item: MenuItem) => {
    try {
      await apiPatch(`/api/menu/items/${item.id}`, { isAvailable: !item.isAvailable });
      router.refresh();
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : 'Erreur');
    }
  };

  const nextItemOrder = (s: MenuSection) =>
    s.items.length > 0 ? Math.max(...s.items.map((i) => i.order)) + 1 : 0;

  return (
    <>
      <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
        <h1 className="font-heading text-3xl uppercase tracking-wide">Buvette</h1>
        <div className="flex items-center gap-3">
          {tournaments.length > 1 && (
            <select
              value={selectedTournamentId}
              onChange={(e) => router.push(`/admin/buvette?tournamentId=${e.target.value}`)}
              className="input text-sm py-1"
            >
              {tournaments.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
          )}
          <button
            type="button"
            onClick={() => setCreateSecOpen(true)}
            className="btn-primary text-sm"
            data-testid="new-section"
          >
            + Nouvelle section
          </button>
        </div>
      </div>

      <div className="space-y-4">
        {sections.map((s) => (
          <div key={s.id} className="card" data-testid={`section-${s.id}`}>
            <div className="flex items-center justify-between mb-3 gap-3 flex-wrap">
              <div>
                <h2 className="font-heading text-2xl uppercase tracking-wide text-primary">
                  {s.name}
                </h2>
                <p className="text-xs text-foreground-subtle">
                  {s.items.length} articles · ordre {s.order}
                </p>
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setCreateItemFor(s.id)}
                  className="btn-secondary text-sm"
                >
                  + Article
                </button>
                <button
                  type="button"
                  onClick={() =>
                    setEditSec({
                      id: s.id,
                      tournamentId: selectedTournamentId,
                      name: s.name,
                      order: s.order,
                    })
                  }
                  className="text-primary text-sm hover:underline"
                >
                  Éditer
                </button>
                <button
                  type="button"
                  onClick={() => setConfirmDelSec(s)}
                  className="text-danger text-sm hover:underline"
                >
                  Suppr.
                </button>
              </div>
            </div>
            <table className="w-full text-sm">
              <tbody>
                {s.items.map((it) => (
                  <tr key={it.id} className="border-b border-border last:border-0">
                    <td className="py-2 w-6">
                      <input
                        type="checkbox"
                        checked={it.isAvailable}
                        onChange={() => toggleAvailable(it)}
                        title="Disponible / Indisponible"
                      />
                    </td>
                    <td className={`py-2 ${!it.isAvailable ? 'text-foreground-subtle line-through' : ''}`}>
                      <p className="font-medium">{it.name}</p>
                      {it.description && (
                        <p className="text-xs text-foreground-muted">{it.description}</p>
                      )}
                    </td>
                    <td className="py-2 text-right tabular font-mono text-primary font-semibold whitespace-nowrap">
                      {Number(it.price).toFixed(2)} €
                    </td>
                    <td className="py-2 text-right space-x-2 w-32">
                      <button
                        type="button"
                        onClick={() =>
                          setEditItem({
                            id: it.id,
                            sectionId: s.id,
                            name: it.name,
                            description: it.description ?? '',
                            price: Number(it.price),
                            imageUrl: it.imageUrl ?? '',
                            isAvailable: it.isAvailable,
                            order: it.order,
                          })
                        }
                        className="text-primary text-xs hover:underline"
                      >
                        Éditer
                      </button>
                      <button
                        type="button"
                        onClick={() => setConfirmDelItem(it)}
                        className="text-danger text-xs hover:underline"
                      >
                        Suppr.
                      </button>
                    </td>
                  </tr>
                ))}
                {s.items.length === 0 && (
                  <tr>
                    <td colSpan={4} className="py-4 text-center text-foreground-subtle text-sm">
                      Aucun article. Cliquez « + Article ».
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        ))}
        {sections.length === 0 && (
          <p className="card text-center text-foreground-muted py-8">
            Aucune section. Cliquez « + Nouvelle section » pour commencer.
          </p>
        )}
      </div>

      <SectionFormModal
        open={createSecOpen}
        onClose={() => setCreateSecOpen(false)}
        initial={{
          tournamentId: selectedTournamentId,
          name: '',
          order: sections.length,
        }}
      />
      {editSec && (
        <SectionFormModal open={!!editSec} onClose={() => setEditSec(null)} initial={editSec} />
      )}
      {createItemFor && (
        <ItemFormModal
          open={!!createItemFor}
          onClose={() => setCreateItemFor(null)}
          initial={{
            sectionId: createItemFor,
            name: '',
            price: 0,
            isAvailable: true,
            order: nextItemOrder(sections.find((s) => s.id === createItemFor)!),
          }}
        />
      )}
      {editItem && (
        <ItemFormModal open={!!editItem} onClose={() => setEditItem(null)} initial={editItem} />
      )}

      <ConfirmDialog
        open={!!confirmDelSec}
        title="Supprimer la section ?"
        message={
          <>
            La section <strong>{confirmDelSec?.name}</strong> et tous ses articles seront supprimés.
          </>
        }
        confirmLabel="Supprimer"
        danger
        onConfirm={onDelSec}
        onCancel={() => setConfirmDelSec(null)}
      />
      <ConfirmDialog
        open={!!confirmDelItem}
        title="Supprimer l'article ?"
        message={
          <>
            <strong>{confirmDelItem?.name}</strong> sera supprimé.
          </>
        }
        confirmLabel="Supprimer"
        danger
        onConfirm={onDelItem}
        onCancel={() => setConfirmDelItem(null)}
      />
    </>
  );
}
