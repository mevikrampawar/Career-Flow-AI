import { type ButtonHTMLAttributes, type ReactNode } from "react";

type Variant = "primary" | "secondary" | "ghost" | "danger" | "outline-danger";
type Size = "sm" | "md" | "lg";

const base =
  "inline-flex items-center justify-center gap-2 font-medium rounded-sm transition-colors " +
  "focus-ring disabled:opacity-50 disabled:pointer-events-none select-none whitespace-nowrap";

const variants: Record<Variant, string> = {
  primary: "bg-primary-container text-on-primary hover:opacity-90 active:opacity-80",
  secondary:
    "bg-transparent text-primary border border-outline-variant hover:bg-surface-container-low",
  ghost: "bg-transparent text-on-surface hover:bg-surface-container",
  danger: "bg-error-container text-on-error-container hover:opacity-90",
  "outline-danger": "bg-transparent text-error border border-error/40 hover:bg-error-container/40",
};

const sizes: Record<Size, string> = {
  sm: "h-8 px-3 text-label-sm",
  md: "h-10 px-4 text-label-md",
  lg: "h-12 px-6 text-label-md",
};

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
  children: ReactNode;
}

export function Button({
  variant = "primary",
  size = "md",
  loading = false,
  disabled,
  className = "",
  children,
  ...rest
}: ButtonProps) {
  return (
    <button
      className={`${base} ${variants[variant]} ${sizes[size]} ${className}`}
      disabled={disabled || loading}
      {...rest}
    >
      {loading && <Spinner className="size-4" />}
      {children}
    </button>
  );
}

export function Spinner({ className = "size-5" }: { className?: string }) {
  return (
    <span
      className={`inline-block animate-spin rounded-full border-2 border-current border-t-transparent ${className}`}
      role="status"
      aria-label="Loading"
    />
  );
}
