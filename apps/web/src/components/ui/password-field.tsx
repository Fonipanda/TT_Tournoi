'use client';

import { useId, useState } from 'react';
import { PASSWORD_RULES, isPasswordStrong } from '@tt/auth/password-policy';

interface PasswordFieldProps {
  label?: string;
  value: string;
  onChange: (value: string) => void;
  /** Affiche la checklist des règles (formulaires de création/changement). */
  showChecklist?: boolean;
  autoComplete?: 'current-password' | 'new-password';
  required?: boolean;
  disabled?: boolean;
  placeholder?: string;
  error?: string | null;
  helper?: string;
  'data-testid'?: string;
}

/**
 * Champ mot de passe avec bouton afficher/masquer et, optionnellement, la
 * checklist temps réel de la politique de sécurité.
 */
export function PasswordField({
  label = 'Mot de passe',
  value,
  onChange,
  showChecklist = false,
  autoComplete = 'current-password',
  required = true,
  disabled = false,
  placeholder,
  error,
  helper,
  'data-testid': testId,
}: PasswordFieldProps) {
  const [visible, setVisible] = useState(false);
  const id = useId();

  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={id} className="text-sm font-medium text-foreground">
        {label}
        {required && <span className="text-danger ml-0.5">*</span>}
      </label>

      <div className="relative">
        <input
          id={id}
          data-testid={testId}
          type={visible ? 'text' : 'password'}
          required={required}
          disabled={disabled}
          placeholder={placeholder}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          autoComplete={autoComplete}
          className={`input pr-16 ${error ? 'border-danger' : ''}`}
        />
        <button
          type="button"
          onClick={() => setVisible((v) => !v)}
          className="absolute inset-y-0 right-0 px-3 text-xs font-medium text-foreground-muted hover:text-foreground"
          aria-label={visible ? 'Masquer le mot de passe' : 'Afficher le mot de passe'}
          tabIndex={-1}
        >
          {visible ? 'Masquer' : 'Afficher'}
        </button>
      </div>

      {helper && !error && <p className="text-xs text-foreground-muted">{helper}</p>}
      {error && (
        <p className="text-xs text-danger" data-testid="password-error">
          {error}
        </p>
      )}

      {showChecklist && value.length > 0 && (
        <ul className="mt-1 grid gap-0.5" data-testid="password-checklist">
          {PASSWORD_RULES.map((rule) => {
            const ok = rule.test(value);
            return (
              <li
                key={rule.id}
                className={`text-xs flex items-center gap-1.5 ${
                  ok ? 'text-success' : 'text-foreground-muted'
                }`}
                data-testid={`rule-${rule.id}`}
                data-ok={ok}
              >
                <span aria-hidden="true">{ok ? '✓' : '○'}</span>
                {rule.label}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

/** Ré-export pratique pour les formulaires. */
export { isPasswordStrong };
