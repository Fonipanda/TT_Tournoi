'use client';

/**
 * /verifier-email — page d'activation de compte.
 *
 * Deux usages :
 *  - avec `?token=…` : consomme le lien reçu par email et active le compte ;
 *  - sans token (ou après échec) : permet de redemander un email d'activation.
 */

import { useState, useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { TextField } from '@/components/ui/fields';

type State = 'idle' | 'checking' | 'verified' | 'already' | 'invalid';

function VerifyEmailContent() {
  const params = useSearchParams();
  const token = params.get('token') ?? '';
  const emailParam = params.get('email') ?? '';
  const justSent = params.get('sent') === '1';

  const [state, setState] = useState<State>(token ? 'checking' : 'idle');
  const [email, setEmail] = useState(emailParam);
  const [resending, setResending] = useState(false);
  const [resendMessage, setResendMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!token) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch('/api/auth/verify-email', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ token }),
        });
        const data = await res.json().catch(() => ({}));
        if (cancelled) return;
        if (!res.ok) {
          setState('invalid');
          return;
        }
        setState(data.status === 'already_verified' ? 'already' : 'verified');
      } catch {
        if (!cancelled) setState('invalid');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [token]);

  const resend = async (e: React.FormEvent) => {
    e.preventDefault();
    setResending(true);
    setResendMessage(null);
    try {
      const res = await fetch('/api/auth/resend-verification', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      const data = await res.json().catch(() => ({}));
      setResendMessage(
        data.message ??
          "Si un compte en attente d'activation existe pour cette adresse, un nouvel email vient d'être envoyé.",
      );
    } catch {
      setResendMessage('Erreur réseau. Réessaie dans un instant.');
    } finally {
      setResending(false);
    }
  };

  return (
    <div className="max-w-sm mx-auto mt-12">
      <h1 className="font-heading text-3xl uppercase tracking-wide mb-3 text-center">
        Activation du compte
      </h1>

      <div className="card">
        {state === 'checking' && (
          <p className="text-sm text-foreground-muted text-center py-4">
            Vérification du lien…
          </p>
        )}

        {(state === 'verified' || state === 'already') && (
          <div className="space-y-4" data-testid="verify-done">
            <div className="card border-success bg-success-soft text-success text-sm rounded-xl px-3 py-2">
              {state === 'verified'
                ? 'Ton adresse email est confirmée : ton compte est actif.'
                : 'Ce compte est déjà activé.'}
            </div>
            <Link href="/login" className="btn-primary w-full block text-center">
              Se connecter
            </Link>
          </div>
        )}

        {(state === 'invalid' || state === 'idle') && (
          <form onSubmit={resend} className="space-y-3" data-testid="verify-resend">
            {state === 'invalid' && (
              <div
                className="card border-danger bg-danger-soft text-danger text-sm rounded-xl px-3 py-2"
                role="alert"
                data-testid="verify-error"
              >
                Ce lien de confirmation est invalide, expiré ou déjà utilisé.
              </div>
            )}

            <p className="text-sm text-foreground-muted">
              {justSent && state === 'idle'
                ? "Ton compte est créé. Ouvre le lien d'activation que nous venons d'envoyer à ton adresse email pour pouvoir te connecter."
                : 'Indique ton adresse email pour recevoir un nouveau lien d’activation.'}
            </p>

            <TextField
              data-testid="email"
              label="Email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
              required
            />

            {resendMessage && (
              <div
                className="card border-success bg-success-soft text-success text-sm rounded-xl px-3 py-2"
                role="status"
                data-testid="verify-resend-message"
              >
                {resendMessage}
              </div>
            )}

            <button
              type="submit"
              disabled={resending || email.trim().length === 0}
              className="btn-primary w-full disabled:opacity-50"
              data-testid="submit-resend"
            >
              {resending ? '…' : justSent && !resendMessage ? "Je n'ai rien reçu — renvoyer" : 'Renvoyer le lien'}
            </button>

            <p className="text-xs text-foreground-muted text-center">
              <Link href="/login" className="underline">
                Retour à la connexion
              </Link>
            </p>
          </form>
        )}
      </div>
    </div>
  );
}

export default function VerifyEmailPage() {
  return (
    <Suspense fallback={<p className="text-center mt-12">Chargement…</p>}>
      <VerifyEmailContent />
    </Suspense>
  );
}
