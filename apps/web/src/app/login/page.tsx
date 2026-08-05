'use client';

import { useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { PasswordField } from '@/components/ui/password-field';

function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const redirectParam = params.get('redirect');

  const [mode, setMode] = useState<'admin' | 'player'>('admin');
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  /**
   * Détermine la page d'accueil par défaut selon le rôle.
   * Si l'utilisateur arrivait d'une page protégée (?redirect=...), on
   * respecte cette destination.
   */
  function pickDestination(role: string | undefined): string {
    if (redirectParam && redirectParam !== '/' && redirectParam !== '/login') {
      return redirectParam;
    }
    if (role === 'admin') return '/admin';
    if (role === 'juge_arbitre') return '/juge-arbitre';
    if (role === 'player') return '/mon-espace';
    return '/';
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ identifier, password, mode }),
      });
      const data = await res.json();
      if (!res.ok) {
        // L'API renvoie volontairement une erreur générique : elle ne révèle
        // pas si le compte existe. Le lien « Créer un compte » ci-dessous
        // couvre le cas du joueur qui ne s'est jamais inscrit.
        setError(data.error ?? 'Erreur de connexion');
        return;
      }
      const target = pickDestination(data.user?.role);
      router.push(target);
      router.refresh();
    } catch {
      setError('Erreur réseau');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-sm mx-auto mt-12">
      <h1 className="font-heading text-3xl uppercase tracking-wide mb-6 text-center">
        Connexion
      </h1>

      <div className="card">
        <div className="grid grid-cols-2 gap-1 mb-4 border border-border-strong">
          <button
            type="button"
            data-testid="mode-admin"
            className={`py-2 text-sm font-medium ${
              mode === 'admin'
                ? 'bg-primary text-primary-fg'
                : 'bg-surface text-foreground-muted hover:bg-bg-alt'
            }`}
            onClick={() => setMode('admin')}
          >
            Staff
          </button>
          <button
            type="button"
            data-testid="mode-player"
            className={`py-2 text-sm font-medium ${
              mode === 'player'
                ? 'bg-primary text-primary-fg'
                : 'bg-surface text-foreground-muted hover:bg-bg-alt'
            }`}
            onClick={() => setMode('player')}
          >
            Joueur
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3" data-testid="login-form">
          {error && (
            <div
              className="card border-danger bg-danger-soft text-danger text-sm rounded-xl px-3 py-2 flex items-start gap-2"
              data-testid="login-error"
              role="alert"
            >
              <span aria-hidden="true">⚠</span>
              <span>{error}</span>
            </div>
          )}

          <div>
            <label className="block text-sm font-medium mb-1">
              {mode === 'admin' ? 'Identifiant' : 'Numéro de licence FFTT'}
            </label>
            <input
              data-testid="identifier"
              type="text"
              required
              value={identifier}
              onChange={(e) => setIdentifier(e.target.value)}
              className="input"
              autoComplete={mode === 'admin' ? 'username' : 'off'}
              inputMode={mode === 'player' ? 'numeric' : 'text'}
              placeholder={mode === 'admin' ? 'admin' : '7711100001'}
            />
          </div>

          <PasswordField
            data-testid="password"
            label="Mot de passe"
            value={password}
            onChange={setPassword}
            autoComplete="current-password"
          />

          <button
            type="submit"
            disabled={loading}
            className="btn-primary w-full disabled:opacity-50"
            data-testid="submit"
          >
            {loading ? '…' : 'Se connecter'}
          </button>
        </form>

        <div className="mt-4 flex flex-col items-center gap-2">
          <Link
            href="/mot-de-passe-oublie"
            className="text-sm text-primary hover:underline"
            data-testid="forgot-password-link"
          >
            Mot de passe oublié ?
          </Link>
          {mode === 'player' && (
            <p className="text-sm text-foreground-muted">
              Pas encore de compte ?{' '}
              <Link
                href={
                  /^\d{6,10}$/.test(identifier)
                    ? `/register?licence=${identifier}`
                    : '/register'
                }
                className="text-primary underline"
                data-testid="register-link"
              >
                Créer un compte
              </Link>
            </p>
          )}
          <Link href="/" className="text-sm text-foreground-muted hover:underline">
            ← Retour à l'accueil
          </Link>
        </div>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<p>Chargement…</p>}>
      <LoginForm />
    </Suspense>
  );
}
