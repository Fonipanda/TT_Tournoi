'use client';

import { useState } from 'react';
import { Modal } from '@/components/ui/modal';
import { toast } from '@/components/ui/toast';
import { apiPost, ApiError } from '@/lib/api-client';

interface BracketSummary {
  id: string;
  registrationId?: string;
  name: string;
  entryFee: number;
}

interface Props {
  open: boolean;
  registrations: BracketSummary[]; // {registrationId, name, entryFee}
  onCancel: () => void;
  onSuccess: () => void;
}

export function PaymentModal({ open, registrations, onCancel, onSuccess }: Props) {
  const [submitting, setSubmitting] = useState(false);
  const total = registrations.reduce((s, r) => s + Number(r.entryFee), 0);

  const pay = async (method: 'card' | 'cash' | 'transfer') => {
    setSubmitting(true);
    try {
      const ids = registrations.map((r) => r.registrationId).filter((id): id is string => !!id);
      if (ids.length === 0) {
        toast.error('Aucune inscription à payer');
        return;
      }
      await apiPost('/api/registrations/pay', { registrationIds: ids, method });
      toast.success(
        method === 'card'
          ? '✓ Paiement par carte enregistré'
          : method === 'cash'
            ? '✓ Paiement en espèces noté (à régler sur place)'
            : '✓ Paiement par virement noté',
      );
      onSuccess();
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : 'Erreur');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal open={open} onClose={onCancel} title="Paiement" size="md">
      <div className="space-y-4" data-testid="payment-modal">
        <div>
          <h3 className="text-sm font-semibold uppercase tracking-widest text-foreground-muted mb-2">
            Récapitulatif
          </h3>
          <div className="card rounded-xl bg-bg-alt p-3">
            <ul className="divide-y divide-border">
              {registrations.map((r) => (
                <li key={r.id} className="py-2 flex items-center justify-between text-sm">
                  <span className="font-medium">{r.name}</span>
                  <span className="font-mono tabular text-primary font-semibold">
                    {Number(r.entryFee).toFixed(2)} €
                  </span>
                </li>
              ))}
            </ul>
            <div className="border-t-2 border-foreground mt-2 pt-2 flex items-center justify-between">
              <span className="font-heading text-lg uppercase tracking-wide">Total</span>
              <span className="font-heading text-2xl tabular text-primary">
                {total.toFixed(2)} €
              </span>
            </div>
          </div>
        </div>

        <div>
          <h3 className="text-sm font-semibold uppercase tracking-widest text-foreground-muted mb-2">
            Mode de paiement
          </h3>
          <div className="grid grid-cols-1 gap-2">
            <button
              type="button"
              onClick={() => pay('card')}
              disabled={submitting}
              className="card rounded-xl hover:border-primary hover:shadow-md transition-all text-left p-3 flex items-center gap-3 disabled:opacity-50"
              data-testid="pay-card"
            >
              <span className="text-2xl">💳</span>
              <div className="flex-1">
                <p className="font-semibold">Carte bancaire</p>
                <p className="text-xs text-foreground-muted">Paiement immédiat sécurisé</p>
              </div>
              <span className="text-primary">→</span>
            </button>

            <button
              type="button"
              onClick={() => pay('cash')}
              disabled={submitting}
              className="card rounded-xl hover:border-primary hover:shadow-md transition-all text-left p-3 flex items-center gap-3 disabled:opacity-50"
              data-testid="pay-cash"
            >
              <span className="text-2xl">💶</span>
              <div className="flex-1">
                <p className="font-semibold">Espèces sur place</p>
                <p className="text-xs text-foreground-muted">À régler à l'accueil le jour J</p>
              </div>
              <span className="text-primary">→</span>
            </button>

            <button
              type="button"
              onClick={() => pay('transfer')}
              disabled={submitting}
              className="card rounded-xl hover:border-primary hover:shadow-md transition-all text-left p-3 flex items-center gap-3 disabled:opacity-50"
              data-testid="pay-transfer"
            >
              <span className="text-2xl">🏦</span>
              <div className="flex-1">
                <p className="font-semibold">Virement bancaire</p>
                <p className="text-xs text-foreground-muted">RIB envoyé par email</p>
              </div>
              <span className="text-primary">→</span>
            </button>
          </div>
        </div>

        <div className="flex justify-end pt-2 border-t border-border">
          <button
            type="button"
            onClick={onCancel}
            disabled={submitting}
            className="btn-secondary text-sm"
          >
            Annuler
          </button>
        </div>

        <p className="text-xs text-foreground-subtle text-center">
          ⚠ V1 : le paiement par carte n'est pas encore connecté à Stripe. Pour l'instant,
          tous les modes de paiement marquent l'inscription comme « payé ». Stripe arrivera en
          V2.
        </p>
      </div>
    </Modal>
  );
}
