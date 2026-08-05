'use client';

import { useState } from 'react';
import Link from 'next/link';

/**
 * /mot-de-passe-oublie — demande d'un lien de réinitialisation par email.
 *
 * La réponse de l'API est volontairement neutre (elle ne révèle pas si un
 * compte existe) : l'écran de confirmation est donc toujours le même.
 */
export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await fetch('/api/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? 'Une erreur est survenue. Réessaie dans un instant.');
        return;
      }
      setSent(true);
    } catch {
      setError('Erreur réseau');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-sm mx-auto mt-12">
      <h1 className="font-heading text-3xl uppercase tracking-wide mb-3 text-center">
        Mot de passe oublié
      </h1>

      <div className="card">
        {sent ? (
          <div className="space-y-4" data-testid="forgot-sent">
            <div className="card border-success bg-success-soft text-success text-sm rounded-xl px-3 py-2">
              Si un compte est associé à cette adresse, un email de réinitialisation vient
              d&apos;être envoyé.
            </div>
            <p className="text-sm text-foreground-muted">
              Pense à vérifier tes spams. Le lien est valable 1 heure et ne peut servir
              qu&apos;une seule fois.
            </p>
            <Link href="/login" className="btn-primary w-full block text-center">
              Retour à la connexion
            </Link>
          </div>
        ) : (
          <>
            <p className="text-sm text-foreground-muted mb-4">
              Saisis l&apos;adresse email de ton compte : tu recevras un lien pour choisir un
              nouveau mot de passe.
            </p>

            <form onSubmit={submit} className="space-y-3" data-testid="forgot-form">
              {error && (
                <div
                  className="card border-danger bg-danger-soft text-danger text-sm rounded-xl px-3 py-2"
                  role="alert"
                  data-testid="forgot-error"
                >
                  {error}
                </div>
              )}

              <div>
                <label htmlFor="email" className="block text-sm font-medium mb-1">
                  Adresse email
                </label>
                <input
                  id="email"
                  data-testid="email"
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="input"
                  autoComplete="email"
                  placeholder="prenom.nom@exemple.fr"
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                className="btn-primary w-full disabled:opacity-50"
                data-testid="submit-forgot"
              >
                {loading ? '…' : 'Envoyer le lien'}
              </button>
            </form>

            <div className="mt-4 text-center">
              <Link href="/login" className="text-sm text-primary hover:underline">
                ← Retour à la connexion
              </Link>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
