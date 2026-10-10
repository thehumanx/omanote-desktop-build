import { cn } from "./ui";

/**
 * The omanote logo. Its wordmark is dark green, which disappears on a dark
 * surface, so dark mode swaps in a copy with a white wordmark. Both are
 * `<img>`s switched by CSS (`.brand-logo-*` in index.css) rather than one SVG
 * that reads the theme: an SVG in an `<img>` can't see the app's theme class,
 * and public pages pin the light palette whatever the theme (`.public-page`).
 */
export function BrandLogo({ alt = "omanote", className }: { alt?: string; className?: string }) {
  return (
    <span
      role={alt ? "img" : undefined}
      aria-label={alt || undefined}
      aria-hidden={alt ? undefined : true}
      className="inline-flex shrink-0"
    >
      <img src="/logo.svg" alt="" className={cn("brand-logo-light", className)} />
      <img src="/logo-dark.svg" alt="" className={cn("brand-logo-dark", className)} />
    </span>
  );
}
