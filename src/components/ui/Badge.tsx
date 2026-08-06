import { type ReactNode } from "react";

type Tone = "neutral" | "primary" | "success" | "warning" | "error" | "info";

const tones: Record<Tone, string> = {
  neutral: "bg-surface-container-high text-on-surface-variant",
  primary: "bg-primary-container/12 text-primary",
  success: "bg-success-container text-on-success-container",
  warning: "bg-warning-container text-warning",
  error: "bg-error-container text-on-error-container",
  info: "bg-secondary-container text-on-secondary-container",
};

export function Badge({
  tone = "neutral",
  dot,
  children,
  className = "",
}: {
  tone?: Tone;
  dot?: boolean;
  children: ReactNode;
  className?: string;
}) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-label-sm uppercase ${tones[tone]} ${className}`}
    >
      {dot && <span className="size-1.5 rounded-full bg-current" />}
      {children}
    </span>
  );
}

export function Chip({
  children,
  onRemove,
}: {
  children: ReactNode;
  onRemove?: () => void;
}) {
  return (
    <span className="inline-flex items-center gap-1 rounded-sm bg-surface-container px-2.5 py-1 text-body-sm text-on-surface-variant">
      {children}
      {onRemove && (
        <button
          type="button"
          onClick={onRemove}
          className="ml-0.5 text-on-surface-variant/70 hover:text-on-surface"
          aria-label="Remove"
        >
          ×
        </button>
      )}
    </span>
  );
}
