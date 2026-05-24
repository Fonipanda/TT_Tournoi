'use client';

import { useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';

function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const redirect = params.get('redirect') ?? '/';

  const [mode, setMode] = useState<'admin' | 'player'>('admin');
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          identifier,
          password: mode === 'admin' ? password : undefined,
          mode,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? 'Erreur de connexion');
        return;
      }
      router.push(redirect);
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
            Joueur (licence FFTT)
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3" data-testid="login-form">
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
          {mode === 'admin' && (
            <div>
              <label className="block text-sm font-medium mb-1">Mot de passe</label>
              <input
                data-testid="password"
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="input"
                autoComplete="current-password"
              />
            </div>
          )}

          {error && (
            <p className="text-danger text-sm" data-testid="login-error">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="btn-primary w-full disabled:opacity-50"
            data-testid="submit"
          >
            {loading ? '…' : 'Se connecter'}
          </button>
        </form>
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
