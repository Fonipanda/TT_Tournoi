'use client';

import type { ReactNode, InputHTMLAttributes, TextareaHTMLAttributes, SelectHTMLAttributes } from 'react';

/**
 * Champs de formulaire stylés cohérents avec le design system.
 * Tous gèrent label + helper + error.
 */

interface FieldShellProps {
  label?: ReactNode;
  helper?: ReactNode;
  error?: ReactNode;
  required?: boolean;
  children: ReactNode;
  className?: string;
}

function FieldShell({ label, helper, error, required, children, className = '' }: FieldShellProps) {
  return (
    <div className={`flex flex-col gap-1 ${className}`}>
      {label && (
        <label className="text-sm font-medium text-foreground">
          {label}
          {required && <span className="text-danger ml-0.5">*</span>}
        </label>
      )}
      {children}
      {helper && !error && <p className="text-xs text-foreground-muted">{helper}</p>}
      {error && <p className="text-xs text-danger" data-testid="field-error">{error}</p>}
    </div>
  );
}

interface TextFieldProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: ReactNode;
  helper?: ReactNode;
  error?: ReactNode;
}

export function TextField({ label, helper, error, required, className, ...rest }: TextFieldProps) {
  return (
    <FieldShell label={label} helper={helper} error={error} required={required}>
      <input
        {...rest}
        required={required}
        className={`input ${error ? 'border-danger' : ''} ${className ?? ''}`}
      />
    </FieldShell>
  );
}

interface NumberFieldProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: ReactNode;
  helper?: ReactNode;
  error?: ReactNode;
}

export function NumberField({ label, helper, error, required, className, ...rest }: NumberFieldProps) {
  return (
    <FieldShell label={label} helper={helper} error={error} required={required}>
      <input
        type="number"
        {...rest}
        required={required}
        className={`input tabular ${error ? 'border-danger' : ''} ${className ?? ''}`}
      />
    </FieldShell>
  );
}

interface TextAreaFieldProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: ReactNode;
  helper?: ReactNode;
  error?: ReactNode;
}

export function TextAreaField({ label, helper, error, required, className, ...rest }: TextAreaFieldProps) {
  return (
    <FieldShell label={label} helper={helper} error={error} required={required}>
      <textarea
        {...rest}
        required={required}
        className={`input min-h-[80px] resize-y ${error ? 'border-danger' : ''} ${className ?? ''}`}
      />
    </FieldShell>
  );
}

interface SelectFieldProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label?: ReactNode;
  helper?: ReactNode;
  error?: ReactNode;
  options: Array<{ value: string; label: string }>;
}

export function SelectField({
  label,
  helper,
  error,
  required,
  options,
  className,
  ...rest
}: SelectFieldProps) {
  return (
    <FieldShell label={label} helper={helper} error={error} required={required}>
      <select
        {...rest}
        required={required}
        className={`input ${error ? 'border-danger' : ''} ${className ?? ''}`}
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </FieldShell>
  );
}

interface CheckboxFieldProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'type'> {
  label: ReactNode;
  helper?: ReactNode;
}

export function CheckboxField({ label, helper, className, ...rest }: CheckboxFieldProps) {
  return (
    <label className={`flex items-start gap-2 cursor-pointer ${className ?? ''}`}>
      <input type="checkbox" {...rest} className="mt-1" />
      <span className="text-sm">
        <span className="font-medium">{label}</span>
        {helper && <span className="block text-xs text-foreground-muted">{helper}</span>}
      </span>
    </label>
  );
}
