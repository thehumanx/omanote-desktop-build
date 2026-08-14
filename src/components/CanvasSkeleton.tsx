function SkeletonBar({ className }: { className: string }) {
  return <div className={`animate-pulse rounded-full bg-app-line ${className}`} />;
}

/**
 * Shown in place of today's canvas content while todos/notes/bookmarks/events
 * are decrypting for the first time this session (see AppProvider's
 * `isCanvasContentLoading`). Roughly matches the real layout's proportions so
 * there's no visible reflow once the real content swaps in.
 */
export function CanvasSkeleton() {
  return (
    <div aria-hidden="true" className="mt-4 flex flex-col gap-10">
      <div className="flex flex-col gap-6">
        <div className="flex flex-col gap-4">
          <SkeletonBar className="h-4 w-28" />
          <SkeletonBar className="h-10 w-72" />
          <div className="flex flex-col gap-1.5 rounded-lg border border-app-line bg-app-surface px-4 py-3">
            <SkeletonBar className="h-3.5 w-40" />
            <SkeletonBar className="h-4 w-64" />
          </div>
        </div>
      </div>

      <div className="flex flex-col gap-4">
        <SkeletonBar className="h-3 w-24" />
        <div className="flex flex-col gap-3">
          <SkeletonBar className="h-6 w-full max-w-md" />
          <SkeletonBar className="h-6 w-full max-w-sm" />
          <SkeletonBar className="h-6 w-full max-w-lg" />
        </div>
      </div>
    </div>
  );
}
