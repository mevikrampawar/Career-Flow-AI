import { type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes, type TextareaHTMLAttributes } from "react";

const fieldBase =
  "w-full rounded-lg border border-border-variant bg-surface-container-lowest px-3 py-2 text-body-md text-on-surface " +
  "placeholder:text-on-surface-variant/70 focus-ring disabled:bg-surface-container disabled:opacity-60";

export function Field({
  label,
  hint,
  error,
  children,
}: {
  label?: string;
  hint?: ReactNode;
  error?: string;
  children: ReactNode;
}) {
  return (
    <label className="block space-y-1.5">
      {label && <span className="text-label-md text-on-surface">{label}</span>}
      {children}
      {hint && !error && (
        <span className="block text-body-sm text-on-surface-variant">{hint}</span>
      )}
      {error && (
        <span className="block text-body-sm text-error">{error}</span>
      )}
    </label>
  );
}

export function Input({ className = "", ...rest }: InputHTMLAttributes<HTMLInputElement>) {
  return <input className={`${fieldBase} ${className}`} {...rest} />;
}

export function Textarea({ className = "", ...rest }: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea className={`${fieldBase} min-h-28 resize-y ${className}`} {...rest} />;
}

export function Select({ className = "", children, ...rest }: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select className={`${fieldBase} ${className}`} {...rest}>
      {children}
    </select>
  );
}
