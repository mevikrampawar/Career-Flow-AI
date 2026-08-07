export function Skeleton({ className = "" }: { className?: string }) {
  return (
    <div
      aria-hidden
      className={`animate-pulse rounded-lg bg-surface-container-high ${className}`}
    />
  );
}

export function SkeletonText({
  width = "w-24",
  className = "h-3.5",
}: {
  width?: string;
  className?: string;
}) {
  return <Skeleton className={`h-3.5 ${width} ${className}`} />;
}

export function SkeletonJobCard({ className = "" }: { className?: string }) {
  return (
    <div
      className={`flex flex-col gap-4 rounded-xl border border-border-variant bg-surface-container-lowest p-6 ${className}`}
    >
      <div className="flex items-start justify-between">
        <Skeleton className="size-12 rounded-lg" />
        <Skeleton className="h-5 w-16 rounded-full" />
      </div>
      <div className="space-y-2">
        <SkeletonText width="w-3/4" className="h-4" />
        <SkeletonText width="w-1/3" className="h-3" />
      </div>
      <div className="space-y-2">
        <SkeletonText width="w-full" />
        <SkeletonText width="w-5/6" />
        <SkeletonText width="w-2/3" />
      </div>
      <div className="mt-auto flex gap-2 border-t border-border-variant pt-4">
        <Skeleton className="h-8 w-24 rounded-lg" />
        <Skeleton className="h-8 w-20 rounded-lg" />
        <Skeleton className="ml-auto h-8 w-28 rounded-lg" />
      </div>
    </div>
  );
}

export function SkeletonRow({ className = "" }: { className?: string }) {
  return (
    <div
      className={`flex items-center justify-between gap-4 rounded-xl border border-border-variant bg-surface-container-lowest p-4 ${className}`}
    >
      <div className="flex min-w-0 flex-1 items-center gap-3">
        <Skeleton className="size-10 shrink-0 rounded-lg" />
        <div className="min-w-0 flex-1 space-y-2">
          <SkeletonText width="w-1/2" className="h-3.5" />
          <SkeletonText width="w-1/3" className="h-3" />
        </div>
      </div>
      <Skeleton className="h-6 w-20 rounded-full" />
    </div>
  );
}
