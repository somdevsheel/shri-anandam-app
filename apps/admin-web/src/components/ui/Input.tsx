import type { InputHTMLAttributes, SelectHTMLAttributes, TextareaHTMLAttributes } from "react";

interface FieldWrapperProps {
  label?: string;
  error?: string;
  hint?: string;
}

const baseFieldClasses =
  "w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-text placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary disabled:opacity-50";

export function Input({ label, error, hint, className = "", ...props }: FieldWrapperProps & InputHTMLAttributes<HTMLInputElement>) {
  return (
    <label className="block">
      {label ? <span className="mb-1 block text-sm font-semibold text-text">{label}</span> : null}
      <input {...props} className={`${baseFieldClasses} ${error ? "border-danger" : ""} ${className}`} />
      {hint && !error ? <span className="mt-1 block text-xs text-text-muted">{hint}</span> : null}
      {error ? <span className="mt-1 block text-xs text-danger">{error}</span> : null}
    </label>
  );
}

export function Textarea({ label, error, hint, className = "", ...props }: FieldWrapperProps & TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <label className="block">
      {label ? <span className="mb-1 block text-sm font-semibold text-text">{label}</span> : null}
      <textarea {...props} className={`${baseFieldClasses} ${error ? "border-danger" : ""} ${className}`} />
      {hint && !error ? <span className="mt-1 block text-xs text-text-muted">{hint}</span> : null}
      {error ? <span className="mt-1 block text-xs text-danger">{error}</span> : null}
    </label>
  );
}

export function Select({
  label,
  error,
  hint,
  className = "",
  children,
  ...props
}: FieldWrapperProps & SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <label className="block">
      {label ? <span className="mb-1 block text-sm font-semibold text-text">{label}</span> : null}
      <select {...props} className={`${baseFieldClasses} ${error ? "border-danger" : ""} ${className}`}>
        {children}
      </select>
      {hint && !error ? <span className="mt-1 block text-xs text-text-muted">{hint}</span> : null}
      {error ? <span className="mt-1 block text-xs text-danger">{error}</span> : null}
    </label>
  );
}
