import React from "react";
import { defaultRangeExtractor, useVirtualizer, type Range } from "@tanstack/react-virtual";
import { cn } from "./ui";

/**
 * Windowed list rendering for the artifact lists.
 *
 * Every list in the app used to render one DOM subtree per row with no cap,
 * and the server limits are generous (5000 notes, 2000 todos), so a heavy
 * workspace mounted thousands of nodes that then re-reconciled on every
 * AppProvider render. This renders only what's near the viewport.
 *
 * Two deliberate design choices, both about not breaking the common case:
 *
 * 1. **`threshold`.** Below it, every row renders exactly as before —
 *    no absolute positioning, no measurement. Most users have tens of rows,
 *    not thousands, and for them windowing buys nothing while costing
 *    browser find-in-page and any DOM query over off-screen rows. The
 *    windowed path is what stops the tail from melting the browser.
 * 2. **`scrollToKey` instead of `document.querySelector`.** Screens used to
 *    jump to a row by querying `[data-*-row-id]` and calling
 *    `scrollIntoView`. That silently does nothing once the target is
 *    unmounted, so the lookup goes through the virtualizer's index instead
 *    and works whether or not the row is currently rendered.
 */

export type VirtualListHandle = {
  /**
   * Scroll a row into view by its key. Returns false when the key isn't in
   * the current list, so callers can tell "not found" from "scrolled".
   */
  scrollToKey: (key: string, options?: { align?: "start" | "center" | "end"; behavior?: "auto" | "smooth" }) => boolean;
  /** The scroll container, for callers that need to read or set scrollTop directly. */
  getScrollElement: () => HTMLElement | null;
};

type VirtualListProps<T> = {
  items: T[];
  /** Stable per-row identity. Also emitted as `data-virtual-key` for tests and DOM lookups. */
  getKey: (item: T, index: number) => string;
  renderItem: (item: T, index: number) => React.ReactNode;
  /**
   * Starting height guess in px, refined by real measurement as rows mount.
   * Only affects scrollbar accuracy before anything has been measured, so a
   * rough average of a typical row is fine.
   */
  estimateSize?: number;
  /** Rows rendered beyond each edge of the viewport. Higher = smoother fling, more DOM. */
  overscan?: number;
  /** Vertical gap between rows, in px. Replaces `space-y-*`, which can't apply to absolutely positioned rows. */
  gap?: number;
  /**
   * Turns the list into a grid: the container measures itself and packs as
   * many columns of at least this width as fit, matching CSS
   * `repeat(auto-fit, minmax(Npx, 1fr))`. Windowing then works a row of
   * columns at a time, which is the only way to window a grid — an absolutely
   * positioned row has no idea how many siblings share its line.
   */
  minColumnWidth?: number;
  /** Render every row (no windowing) at or below this many items. */
  threshold?: number;
  /**
   * Rows that must stay mounted even when scrolled far out of view — the row
   * being edited, most importantly, whose editor state and outside-click refs
   * would otherwise be destroyed mid-edit by a scroll.
   */
  pinnedKeys?: readonly string[];
  /** Classes for the scroll container (or, with `scrollRef`, for the sizing wrapper). */
  className?: string;
  /**
   * Scroll in an ancestor element instead of owning the scroll container.
   * For lists that sit inside a page that scrolls as a whole.
   */
  scrollRef?: React.RefObject<HTMLElement>;
  /** Rendered above the windowed rows, inside the scroll container. */
  header?: React.ReactNode;
  /** Rendered below the windowed rows — composers, bottom-nav spacers. */
  footer?: React.ReactNode;
  /** Passed through to the container element, for tests that anchor on the list. */
  testId?: string;
  style?: React.CSSProperties;
};

/**
 * Column count for a `minColumnWidth` grid, mirroring what CSS
 * `repeat(auto-fit, minmax(min, 1fr))` would have produced. Returns 1 when no
 * minimum is set (a plain list) and while the element is unmeasured, so the
 * first paint is a single column rather than an empty one.
 */
function useColumnCount(ref: React.RefObject<HTMLElement>, minColumnWidth: number | undefined, gap: number) {
  const [width, setWidth] = React.useState(0);

  React.useEffect(() => {
    const element = ref.current;
    if (!element || minColumnWidth === undefined) return;
    // jsdom and older Safari have no ResizeObserver; a static column count is
    // a worse layout, not a broken one, so degrade instead of throwing.
    if (typeof ResizeObserver === "undefined") {
      setWidth(element.getBoundingClientRect().width);
      return;
    }
    const observer = new ResizeObserver(([entry]) => {
      const next = entry?.contentRect.width ?? 0;
      setWidth((current) => (Math.abs(current - next) < 1 ? current : next));
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, [ref, minColumnWidth]);

  if (minColumnWidth === undefined || width <= 0) return 1;
  return Math.max(1, Math.floor((width + gap) / (minColumnWidth + gap)));
}

const DEFAULT_THRESHOLD = 60;
const DEFAULT_OVERSCAN = 8;
const DEFAULT_ESTIMATE = 72;

function VirtualListInner<T>(
  {
    items,
    getKey,
    renderItem,
    estimateSize = DEFAULT_ESTIMATE,
    overscan = DEFAULT_OVERSCAN,
    gap = 0,
    minColumnWidth,
    threshold = DEFAULT_THRESHOLD,
    pinnedKeys,
    className,
    scrollRef,
    header,
    footer,
    testId,
    style,
  }: VirtualListProps<T>,
  ref: React.ForwardedRef<VirtualListHandle>,
) {
  const ownScrollRef = React.useRef<HTMLDivElement>(null);
  const sizerRef = React.useRef<HTMLDivElement>(null);
  const scrollElementRef = scrollRef ?? ownScrollRef;
  const ownsScroll = !scrollRef;

  const keys = React.useMemo(() => items.map((item, index) => getKey(item, index)), [items, getKey]);
  const indexByKey = React.useMemo(() => new Map(keys.map((key, index) => [key, index] as const)), [keys]);

  const columns = useColumnCount(sizerRef, minColumnWidth, gap);
  const rowCount = Math.ceil(items.length / columns);

  // Below the threshold we render everything, and the virtualizer must not
  // also be driving layout — but hooks can't be skipped, so it stays mounted
  // with a count of 0 and simply produces no rows.
  const windowed = items.length > threshold;

  const pinnedIndices = React.useMemo(() => {
    if (!pinnedKeys?.length) return [] as number[];
    return pinnedKeys
      .map((key) => indexByKey.get(key))
      .filter((index): index is number => index !== undefined)
      .map((index) => Math.floor(index / columns));
  }, [pinnedKeys, indexByKey, columns]);

  // Widening the rendered range is the supported way to force a row to stay
  // mounted: it keeps the row's real measured offset, unlike rendering it
  // separately, which would leave it floating at the wrong position.
  const rangeExtractor = React.useCallback(
    (range: Range) => {
      const base = defaultRangeExtractor(range);
      if (!pinnedIndices.length) return base;
      return Array.from(new Set([...base, ...pinnedIndices])).sort((a, b) => a - b);
    },
    [pinnedIndices],
  );

  const virtualizer = useVirtualizer({
    count: windowed ? rowCount : 0,
    getScrollElement: () => scrollElementRef.current,
    estimateSize: () => estimateSize,
    // Keyed by the row's leading item so a row keeps its measured height when
    // the list around it shifts. Falls back to the index for the degenerate
    // empty-row case.
    getItemKey: (rowIndex) => keys[rowIndex * columns] ?? rowIndex,
    overscan,
    gap,
    rangeExtractor,
  });

  React.useImperativeHandle(
    ref,
    () => ({
      getScrollElement: () => scrollElementRef.current,
      scrollToKey: (key, options) => {
        const index = indexByKey.get(key);
        if (index === undefined) return false;
        if (windowed) {
          virtualizer.scrollToIndex(Math.floor(index / columns), {
            align: options?.align ?? "center",
            behavior: options?.behavior ?? "smooth",
          });
          return true;
        }
        // Unwindowed, every row is mounted, so the plain DOM path is both
        // available and better — it respects scroll padding and sticky headers.
        const container = scrollElementRef.current;
        const row = container?.querySelector<HTMLElement>(`[data-virtual-key="${CSS.escape(key)}"]`);
        row?.scrollIntoView({ behavior: options?.behavior ?? "smooth", block: options?.align ?? "center" });
        return !!row;
      },
    }),
    [indexByKey, virtualizer, windowed, scrollElementRef],
  );

  // One column is still a "grid" of a single track, so list and grid share
  // one layout path rather than diverging into two.
  const rowStyle: React.CSSProperties = {
    display: "grid",
    gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))`,
    ...(gap ? { gap } : undefined),
  };

  const renderCell = (index: number) => {
    const item = items[index];
    if (item === undefined) return null;
    return (
      <div key={keys[index]} data-index={index} data-virtual-key={keys[index]}>
        {renderItem(item, index)}
      </div>
    );
  };

  const rows = windowed ? (
    <div className="relative w-full" style={{ height: virtualizer.getTotalSize() }}>
      {virtualizer.getVirtualItems().map((virtualRow) => {
        const start = virtualRow.index * columns;
        return (
          <div
            key={virtualRow.key}
            data-index={virtualRow.index}
            ref={virtualizer.measureElement}
            className="absolute top-0 left-0 w-full"
            style={{ ...rowStyle, transform: `translateY(${virtualRow.start}px)` }}
          >
            {Array.from({ length: columns }, (_, offset) => renderCell(start + offset))}
          </div>
        );
      })}
    </div>
  ) : (
    <div className="w-full" style={rowStyle}>
      {items.map((_, index) => renderCell(index))}
    </div>
  );

  // Wrapping here rather than in each branch: when this lived only in the
  // ancestor-scroll branch, a self-scrolling grid never measured itself and
  // silently stayed one column wide.
  const sizedRows = (
    <div ref={sizerRef} className="w-full">
      {rows}
    </div>
  );

  if (!ownsScroll) {
    return (
      <div className={className} style={style} data-testid={testId}>
        {header}
        {sizedRows}
        {footer}
      </div>
    );
  }

  return (
    // `overflowAnchor: none` for the same reason the note list always set it:
    // the browser's scroll anchoring fights measurement-driven height changes
    // and yields a visible jitter as rows above the viewport settle.
    <div
      ref={ownScrollRef}
      className={cn("overflow-y-auto", className)}
      style={{ overflowAnchor: "none", ...style }}
      data-testid={testId}
    >
      {header}
      {sizedRows}
      {footer}
    </div>
  );
}

/**
 * `forwardRef` erases generics, so the cast restores `VirtualList` as a
 * generic component. Standard workaround; the implementation above is the
 * type-checked part.
 */
export const VirtualList = React.forwardRef(VirtualListInner) as <T>(
  props: VirtualListProps<T> & { ref?: React.ForwardedRef<VirtualListHandle> },
) => React.ReactElement | null;
