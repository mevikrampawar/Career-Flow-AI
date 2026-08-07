import { type ReactNode } from "react";
import { Card } from "./Card";
import { Icon } from "./Icon";

export function EmptyState({
  icon,
  title,
  description,
  action,
  className = "",
}: {
  icon: string;
  title: ReactNode;
  description?: ReactNode;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <Card
      className={`relative flex flex-col items-center gap-3 overflow-hidden px-8 py-14 text-center ${className}`}
    >
      <div className="pointer-events-none absolute -top-20 left-1/2 h-44 w-44 -translate-x-1/2 rounded-full bg-primary-fixed opacity-60 blur-3xl" />
      <span className="relative grid size-16 place-items-center rounded-2xl border border-border-variant bg-surface-container-lowest shadow-soft">
        <Icon name={icon} size={32} className="text-primary" />
      </span>
      <h3 className="relative font-headline-md text-headline-md text-on-surface">{title}</h3>
      {description && (
        <p className="relative max-w-md font-body-md text-body-md text-on-surface-variant">
          {description}
        </p>
      )}
      {action && <div className="relative mt-2">{action}</div>}
    </Card>
  );
}
