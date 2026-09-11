import type { InputHTMLAttributes } from 'react';

interface AuthFormFieldProps extends InputHTMLAttributes<HTMLInputElement> {
  label: string;
  hint?: string;
}

export function AuthFormField({ label, hint, id, className = '', ...props }: AuthFormFieldProps) {
  return (
    <div>
      <label htmlFor={id} className="label-kicker mb-2 block">
        {label}
      </label>
      <input id={id} className={`auth-input ${className}`} {...props} />
      {hint ? <p className="mt-1.5 text-xs text-slate-600">{hint}</p> : null}
    </div>
  );
}
