export function ZoomIndicator({ percent, visible }: { percent: number; visible: boolean }) {
  return (
    <div
      aria-hidden={!visible}
      className={[
        "pointer-events-none fixed left-1/2 top-4 z-app-popover -translate-x-1/2 rounded-full border border-app-line bg-app-surface-raised px-3 py-1.5 text-sm font-bold text-app-ink shadow-app-menu transition-opacity duration-app-base ease-app-in-out",
        visible ? "opacity-100" : "opacity-0",
      ].join(" ")}
    >
      {percent}%
    </div>
  );
}
