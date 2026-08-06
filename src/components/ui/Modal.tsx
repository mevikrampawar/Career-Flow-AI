import { useEffect, type ReactNode } from "react";

export function Modal({
  open,
  onClose,
  title,
  children,
  wide = false,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  wide?: boolean;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-40 flex items-center justify-center bg-inverse-surface/40 p-4 backdrop-blur-[2px]"
      onClick={onClose}
    >
      <div
        className={`w-full ${wide ? "max-w-3xl" : "max-w-lg"} max-h-[88vh] overflow-auto rounded-lg bg-surface-container-lowest p-6 shadow-modal`}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-headline-md text-on-surface">{title}</h2>
          <button
            onClick={onClose}
            className="grid size-8 place-items-center rounded-sm text-on-surface-variant hover:bg-surface-container"
            aria-label="Close"
          >
            ✕
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
