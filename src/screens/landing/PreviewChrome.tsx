import type React from "react";
import { useRef } from "react";
import { Plus } from "lucide-react";
import { writeTabs } from "../../components/layout/BottomNav";
import {
  SegmentedHighlight,
  SegmentedItemLabel,
  SegmentedShell,
  segmentedItemClass,
} from "../../components/ui";
import { useMeasuredHighlight } from "../../hooks/useMeasuredHighlight";

/** The preview always sits on the canvas, so Canvas is the active tab. */
const ACTIVE_TAB = "/canvas";

/**
 * A static stand-in for the app's bottom nav pill and "+" compose button.
 *
 * The real `BottomNav` is 482 lines wired to `AppProvider`, route state, swipe
 * gestures and the composer sheet — far too much to drag onto a marketing
 * page. This is the one piece of the preview that is deliberately hand-built.
 *
 * The drift surface is kept as small as possible: the tab list is imported
 * from BottomNav rather than copied, the pill uses the same `Segmented*`
 * primitives and utility classes as the real desktop nav (see FullBottomNav),
 * and the active pill is positioned by the same `useMeasuredHighlight` hook,
 * so it looks identical rather than approximately right. Only layout and the
 * fixed "Canvas is active" state are restated here.
 *
 * Renders as spans, not links or buttons: nothing here navigates, and the
 * whole preview is `inert` anyway.
 */
export function PreviewChrome({
  /** The tour points its composer step at the "+" specifically, not the nav. */
  composeRef,
}: {
  composeRef?: React.Ref<HTMLSpanElement>;
} = {}) {
  const pillRef = useRef<HTMLDivElement>(null);
  const tabRefs = useRef<Record<string, HTMLSpanElement | null>>({});

  const highlightStyle = useMeasuredHighlight<HTMLSpanElement>({
    activeKey: ACTIVE_TAB,
    containerRef: pillRef,
    itemRefs: tabRefs,
    layoutKey: "preview-chrome",
    observeResize: false,
  });

  return (
    <div className="pointer-events-none mx-auto flex h-12 w-full max-w-[1024px] items-center justify-center gap-2 px-4">
      <SegmentedShell ref={pillRef} className="min-w-0 gap-1 p-2 shadow-nav">
        {highlightStyle ? <SegmentedHighlight style={highlightStyle} /> : null}
        {writeTabs.map(({ to, label, icon: Icon }) => (
          <span
            key={to}
            ref={(node) => {
              tabRefs.current[to] = node;
            }}
            className={segmentedItemClass({
              active: to === ACTIVE_TAB,
              className: "relative flex items-center justify-center px-3 py-2 text-app-ink-muted sm:px-4",
            })}
          >
            <Icon className="relative z-10 h-3.5 w-3.5" />
            {/* Five labelled tabs don't fit a phone — the real mobile nav drops
                to icons for the same reason. Hidden rather than unrendered so
                the measured highlight still lines up. */}
            <SegmentedItemLabel
              visible
              withLeadingGap
              className="relative z-10 hidden font-medium text-[14px] leading-none sm:inline"
            >
              {label}
            </SegmentedItemLabel>
          </span>
        ))}
      </SegmentedShell>
      <span ref={composeRef} className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full border border-app-line bg-app-surface p-0 text-app-ink-muted shadow-soft">
        <Plus className="h-5 w-5" />
      </span>
    </div>
  );
}
