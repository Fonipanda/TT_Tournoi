'use client';

import { useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { TextField } from '@/components/ui/fields';
import { toast, ToastViewport } from '@/components/ui/toast';
import { apiPost, ApiError } from '@/lib/api-client';

function RegisterForm() {
  const router = useRouter();
  const params = useSearchParams();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const initialLicence = params.get('licence') ?? '';
  const reason = params.get('reason'); // 'fftt-not-found' si redirigé du login

  const [form, setForm] = useState({
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    licenseNumber: initialLicence,
    club: '',
  });

  const update = <K extends keyof typeof form>(key: K, value: string) =>
    setForm((f) => ({ ...f, [key]: value }));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const res = await apiPost<{ user: { role: string } }>('/api/auth/register', form);
      toast.success('Compte créé · Bienvenue !');
      router.push(res.user.role === 'player' ? '/mon-espace' : '/');
      router.refresh();
    } catch (e) {
      const msg = e instanceof ApiError ? e.message : 'Erreur réseau';
      setError(msg);
      toast.error(msg);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="max-w-md mx-auto mt-12">
      <h1 className="font-heading text-3xl uppercase tracking-wide mb-3 text-center">
        Créer un compte
      </h1>
      <p className="text-center text-foreground-muted text-sm mb-6">
        Inscris-toi pour pouvoir t'inscrire aux tournois TT Chelles.
      </p>

      {reason === 'fftt-not-found' && (
        <div className="card border-warning bg-warning-soft text-warning mb-4 text-sm">
          ⚠ Licence FFTT introuvable dans la base officielle. Tu peux quand même créer un
          compte ici (avec ou sans licence) pour t'inscrire.
        </div>
      )}

      <div className="card">
        <form onSubmit={submit} className="space-y-3" data-testid="register-form">
          <div className="grid grid-cols-2 gap-3">
            <TextField
              label="Prénom"
              required
              value={form.firstName}
              onChange={(e) => update('firstName', e.target.value)}
            />
            <TextField
              label="Nom"
              required
              value={form.lastName}
              onChange={(e) => update('lastName', e.target.value.toUpperCase())}
            />
          </div>

          <TextField
            label="Email"
            type="email"
            required
            value={form.email}
            onChange={(e) => update('email', e.target.value)}
            autoComplete="email"
          />

          <TextField
            label="Téléphone (pour SMS du tournoi)"
            type="tel"
            value={form.phone}
            onChange={(e) => update('phone', e.target.value)}
            placeholder="+33612345678"
            autoComplete="tel"
            helper="Format international (+33...)"
          />

          <TextField
            label="N° licence FFTT (optionnel)"
            value={form.licenseNumber}
            onChange={(e) => update('licenseNumber', e.target.value.replace(/\D/g, ''))}
            inputMode="numeric"
            maxLength={10}
            placeholder="7711100001"
            helper="Si tu n'as pas de licence, laisse vide"
          />

          <TextField
            label="Club (optionnel)"
            value={form.club}
            onChange={(e) => update('club', e.target.value)}
            placeholder="Chelles TT"
          />

          {error && (
            <p className="text-danger text-sm" data-testid="register-error">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={submitting}
            className="btn-primary w-full disabled:opacity-50"
            data-testid="submit-register"
          >
            {submitting ? '…' : 'Créer mon compte'}
          </button>
        </form>

        <p className="text-xs text-foreground-muted text-center mt-4">
          Tu as déjà un compte ?{' '}
          <Link href="/login" className="text-primary underline">
            Se connecter
          </Link>
        </p>
      </div>

      <ToastViewport />
    </div>
  );
}

export default function RegisterPage() {
  return (
    <Suspense fallback={<p className="text-center mt-12">Chargement…</p>}>
      <RegisterForm />
    </Suspense>
  );
}
