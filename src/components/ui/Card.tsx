import { type HTMLAttributes, type ReactNode } from "react";

export function Card({
  className = "",
  children,
  ...rest
}: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={`rounded-xl border border-border-variant bg-surface-container-lowest ${className}`}
      {...rest}
    >
      {children}
    </div>
  );
}

export function CardHeader({
  title,
  subtitle,
  action,
  className = "",
}: {
  title: ReactNode;
  subtitle?: ReactNode;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div className={`flex items-start justify-between gap-4 p-6 pb-3 ${className}`}>
      <div>
        <h3 className="font-display text-headline-md text-on-surface">{title}</h3>
        {subtitle && (
          <p className="mt-1 text-body-sm text-on-surface-variant">{subtitle}</p>
        )}
      </div>
      {action}
    </div>
  );
}
