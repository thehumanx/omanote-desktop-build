import { useEffect, useRef, useState, type ReactNode } from "react";

/**
 * Fires once when the element first comes into view, to start its entrance.
 * `rootMargin` shrinks the viewport so the entrance plays a little way in
 * rather than while the element is still peeking in at the bottom edge.
 */
export function useRevealOnce<T extends HTMLElement>(rootMargin = "-10% 0px") {
  const ref = useRef<T>(null);
  const [revealed, setRevealed] = useState(false);

  useEffect(() => {
    const element = ref.current;
    if (!element || revealed) return;
    if (typeof IntersectionObserver === "undefined") {
      setRevealed(true);
      return;
    }
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) setRevealed(true);
      },
      { rootMargin },
    );
    observer.observe(element);
    return () => observer.disconnect();
  }, [revealed, rootMargin]);

  return { ref, revealed };
}

/**
 * A block whose direct children rise and fade in, one after another, the
 * first time it scrolls into view. The landing page's sections use it so
 * everything below the tour arrives the same way. Plays once; content stays in
 * the DOM throughout, so it's still there for search and screen readers.
 */
export function Reveal({ className = "", children }: { className?: string; children: ReactNode }) {
  const { ref, revealed } = useRevealOnce<HTMLDivElement>();
  return (
    <div ref={ref} className={`omanote-reveal ${revealed ? "is-revealed" : ""} ${className}`}>
      {children}
    </div>
  );
}
