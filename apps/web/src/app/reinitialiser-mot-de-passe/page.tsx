'use client';

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { PasswordField } from '@/components/ui/password-field';
import { isPasswordStrong, PASSWORD_POLICY_MESSAGE } from '@tt/auth/password-policy';

type TokenState = 'checking' | 'valid' | 'invalid';

function ResetPasswordForm() {
  const router = useRouter();
  const params = useSearchParams();
  const token = params.get('token') ?? '';

  const [tokenState, setTokenState] = useState<TokenState>('checking');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  const matches = password === confirm;
  const canSubmit = !loading && isPasswordStrong(password) && matches && confirm.length > 0;

  // Vérifie la validité du lien avant d'afficher le formulaire.
  useEffect(() => {
    if (!token) {
      setTokenState('invalid');
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(
          `/api/auth/reset-password?token=${encodeURIComponent(token)}`,
        );
        const data = await res.json().catch(() => ({ valid: false }));
        if (!cancelled) setTokenState(data.valid ? 'valid' : 'invalid');
      } catch {
        if (!cancelled) setTokenState('invalid');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [token]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!isPasswordStrong(password)) {
      setError(PASSWORD_POLICY_MESSAGE);
      return;
    }
    if (!matches) {
      setError('Les deux mots de passe ne correspondent pas.');
      return;
    }

    setError(null);
    setLoading(true);
    try {
      const res = await fetch('/api/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, password }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? 'Une erreur est survenue.');
        if (data.code === 'invalid_token') setTokenState('invalid');
        return;
      }
      setDone(true);
      setTimeout(() => router.push('/login'), 2500);
    } catch {
      setError('Erreur réseau');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-sm mx-auto mt-12">
      <h1 className="font-heading text-3xl uppercase tracking-wide mb-3 text-center">
        Nouveau mot de passe
      </h1>

      <div className="card">
        {tokenState === 'checking' && (
          <p className="text-sm text-foreground-muted text-center py-4">
            Vérification du lien…
          </p>
        )}

        {tokenState === 'invalid' && (
          <div className="space-y-4" data-testid="reset-invalid">
            <div className="card border-danger bg-danger-soft text-danger text-sm rounded-xl px-3 py-2">
              Ce lien de réinitialisation est invalide, expiré ou déjà utilisé.
            </div>
            <Link
              href="/mot-de-passe-oublie"
              className="btn-primary w-full block text-center"
            >
              Demander un nouveau lien
            </Link>
          </div>
        )}

        {tokenState === 'valid' && done && (
          <div className="space-y-4" data-testid="reset-done">
            <div className="card border-success bg-success-soft text-success text-sm rounded-xl px-3 py-2">
              Mot de passe mis à jour. Redirection vers la connexion…
            </div>
            <Link href="/login" className="btn-primary w-full block text-center">
              Se connecter
            </Link>
          </div>
        )}

        {tokenState === 'valid' && !done && (
          <form onSubmit={submit} className="space-y-3" data-testid="reset-form">
            {error && (
              <div
                className="card border-danger bg-danger-soft text-danger text-sm rounded-xl px-3 py-2"
                role="alert"
                data-testid="reset-error"
              >
                {error}
              </div>
            )}

            <PasswordField
              data-testid="password"
              label="Nouveau mot de passe"
              value={password}
              onChange={setPassword}
              autoComplete="new-password"
              helper={PASSWORD_POLICY_MESSAGE}
              showChecklist
            />

            <PasswordField
              data-testid="password-confirm"
              label="Confirmer le mot de passe"
              value={confirm}
              onChange={setConfirm}
              autoComplete="new-password"
              error={
                confirm.length > 0 && !matches
                  ? 'Les deux mots de passe ne correspondent pas.'
                  : null
              }
            />

            <p className="text-xs text-foreground-muted">
              Toutes tes sessions ouvertes seront déconnectées.
            </p>

            <button
              type="submit"
              disabled={!canSubmit}
              className="btn-primary w-full disabled:opacity-50"
              data-testid="submit-reset"
            >
              {loading ? '…' : 'Changer mon mot de passe'}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={<p className="text-center mt-12">Chargement…</p>}>
      <ResetPasswordForm />
    </Suspense>
  );
}
