'use client';

import { useId, type InputHTMLAttributes, type TextareaHTMLAttributes } from 'react';
import { cn } from '@/lib/cn';

interface FieldProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'id'> {
  label: string;
  error?: string;
  hint?: string;
  multiline?: boolean;
  rows?: number;
}

/** Hairline-underlined field with a floating caption label. No boxes. */
export function Field({ label, error, hint, className, multiline, rows = 2, required, ...rest }: FieldProps) {
  const id = useId();
  const describedBy = error ? `${id}-error` : hint ? `${id}-hint` : undefined;
  const inputClass = cn(
    'peer w-full bg-transparent py-3 font-display text-[1.125rem] text-fg placeholder-transparent',
    'border-b transition-colors duration-500',
    error ? 'border-burgundy' : 'border-line focus:border-line-strong',
    'focus:outline-none',
  );
  return (
    <div className={cn('relative pt-5', className)}>
      {multiline ? (
        <textarea
          id={id}
          rows={rows}
          placeholder={label}
          aria-invalid={Boolean(error)}
          aria-describedby={describedBy}
          required={required}
          className={cn(inputClass, 'resize-none')}
          {...(rest as unknown as TextareaHTMLAttributes<HTMLTextAreaElement>)}
        />
      ) : (
        <input id={id} placeholder={label} aria-invalid={Boolean(error)} aria-describedby={describedBy} required={required} className={inputClass} {...rest} />
      )}
      <label
        htmlFor={id}
        className={cn(
          'micro pointer-events-none absolute left-0 top-0 text-fg-muted transition-all duration-300',
          'peer-placeholder-shown:top-[1.55rem] peer-placeholder-shown:text-[0.8125rem] peer-placeholder-shown:normal-case peer-placeholder-shown:tracking-normal',
          'peer-focus:top-0 peer-focus:text-[0.6875rem] peer-focus:uppercase peer-focus:tracking-[0.24em]',
        )}
      >
        {label}
        {required && <span aria-hidden> *</span>}
      </label>
      {error ? (
        <p id={`${id}-error`} className="mt-2 text-[0.75rem] text-burgundy ivory:text-burgundy">
          {error}
        </p>
      ) : hint ? (
        <p id={`${id}-hint`} className="mt-2 text-[0.75rem] text-fg-muted">
          {hint}
        </p>
      ) : null}
    </div>
  );
}

interface PillGroupProps {
  label: string;
  options: { value: string; label: string }[];
  value: string | null;
  onChange: (v: string) => void;
  error?: string;
}

/** A row of tracked words with a sliding hairline beneath the chosen one — no pills. */
export function ChoiceRow({ label, options, value, onChange, error }: PillGroupProps) {
  const id = useId();
  return (
    <div role="radiogroup" aria-labelledby={`${id}-label`} className="pt-5">
      <p id={`${id}-label`} className="micro text-fg-muted">
        {label}
      </p>
      <div className="mt-3 flex flex-wrap gap-x-7 gap-y-2">
        {options.map((o) => {
          const active = o.value === value;
          return (
            <button
              key={o.value}
              type="button"
              role="radio"
              aria-checked={active}
              onClick={() => onChange(o.value)}
              className={cn(
                'eyebrow relative pb-1 transition-colors duration-300',
                active ? 'text-fg' : 'text-fg-muted hover:text-fg',
              )}
            >
              {o.label}
              <span
                aria-hidden
                className={cn('hairline absolute inset-x-0 bottom-0 origin-left transition-transform duration-500 ease-[var(--ease-out-expo)]', active ? 'scale-x-100' : 'scale-x-0')}
              />
            </button>
          );
        })}
      </div>
      {error && <p className="mt-2 text-[0.75rem] text-burgundy">{error}</p>}
    </div>
  );
}
